/* =========================================
   边境契约 - 核心逻辑
   ========================================= */

// --- 初始默认数据 ---
const initialKnightPersona = `你扮演维克多·银刃，银月骑士团团长。
性格：冷峻、严谨、外冷内热。说话不带表情符号，简洁有力，有骑士风度。
动机：表面催债，实则监视这片区域寻找骗局线索，同时也隐晦地希望洛落能活下去。
对玩家称呼："你" 或 "洛落"。`;

const defaultState = {
    season: "新绿季", 
    day: 10,          
    money: 200,       // 200铜
    debt: 300000,     // 3000金
    daysUntilPay: 7,  
    ap: 5,
    user: {
        hp: 100, max_hp: 100,
        lv: 1, xp: 0, next_lv_xp: 100,
        clothes: "旧亚麻裙",
        status: "营养不良/羞耻/困惑",
        lust: "微弱",
        genital: "处女/干燥"
    },
    knight: {
        love: 50, mood: "普通", 
        location: "村庄", action: "站在田边平复情绪",
        lust: "中",
        genital: "微微勃起",
        clothes: "轻便胸甲/黑色亚麻内搭/深棕皮裤/长筒皮靴"
    },
    farms: [
        { id: 1, type: "旱田", crop: "无", status: "空闲" },
        { id: 2, type: "旱田", crop: "无", status: "空闲" }
    ],
    quest: null
};

// 全局变量
let gameState = JSON.parse(JSON.stringify(defaultState));
let config = {
    apiKey: "",
    baseUrl: "https://api.deepseek.com",
    knightPrompt: initialKnightPersona,
    // 世界书数组: [{text:"...", active:true}]
    worldLore: [] 
};
let chatHistory = [];
let dailyLogs = [];
let cart = [];
let pendingQuestReward = 0;

// --- 启动逻辑 ---
window.onload = function() {
    loadData(); 
    if(!gameState.quest) generateDailyQuest();
    updateInputFields();
    renderUI();
    
    // 首次无记录时显示
    if(chatHistory.length === 0) {
        addMsg("系统: 连接建立... 骑士团长维克多已上线。", "system");
    } else {
        const box = document.getElementById('chat-box');
        box.innerHTML = '';
        chatHistory.forEach(c => {
            if(c.role !== 'system') addMsg(c.content, c.role === 'user' ? 'user' : 'knight');
        });
    }
};

// --- 数据持久化 ---
function saveData() {
    const data = {
        gameState: gameState,
        config: config,
        chatHistory: chatHistory
    };
    localStorage.setItem('rpg_save_data_split', JSON.stringify(data));
}

function loadData() {
    const raw = localStorage.getItem('rpg_save_data_split');
    if(raw) {
        try {
            const data = JSON.parse(raw);
            gameState = data.gameState || defaultState;
            config = data.config || config;
            // 格式兼容
            if (typeof config.worldLore === 'string') {
                config.worldLore = []; 
            }
            chatHistory = data.chatHistory || [];
        } catch(e) {
            console.error("存档读取失败", e);
        }
    }
}

function exportData() {
    saveData();
    const raw = localStorage.getItem('rpg_save_data_split');
    const blob = new Blob([raw], {type: "application/json"});
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `边境契约_存档_${new Date().toISOString().slice(0,10)}.json`;
    a.click();
}

function importData(input) {
    const file = input.files[0];
    if(!file) return;
    const reader = new FileReader();
    reader.onload = function(e) {
        try {
            const data = JSON.parse(e.target.result);
            gameState = data.gameState;
            config = data.config;
            chatHistory = data.chatHistory;
            saveData();
            location.reload();
        } catch(err) {
            alert("存档文件格式错误！");
        }
    };
    reader.readAsText(file);
}

// --- 游戏逻辑 ---

function generateDailyQuest() {
    const quests = [
        { name: "杂货店的忙碌", desc: "杂货店老板闪了腰，急需人搬货。", reward: 50, cost: 3 },
        { name: "清理田边碎石", desc: "田边的碎石影响了耕作。", reward: 30, cost: 2 },
        { name: "帮骑士擦拭铠甲", desc: "维克多需要人保养备用铠甲。", reward: 60, cost: 3 },
        { name: "采集药草", desc: "森林边缘有一些止血草。", reward: 40, cost: 2 }
    ];
    const q = quests[Math.floor(Math.random() * quests.length)];
    gameState.quest = q;
    pendingQuestReward = 0;
    renderQuestArea();
}

function renderQuestArea() {
    const area = document.getElementById('quest-content');
    const q = gameState.quest;
    if(!q) return;
    area.innerHTML = `
        <div style="font-weight:bold; margin-bottom:2px;">${q.name}</div>
        <div style="font-size:0.85rem; color:#555; margin-bottom:5px;">${q.desc}</div>
        <div style="font-size:0.85rem;">
            <span>报酬: ${formatMoney(q.reward)}</span> | <span>耗时: ${q.cost} AP</span>
        </div>
    `;
    const btn = document.getElementById('quest-btn');
    const status = document.getElementById('quest-status');
    
    if (pendingQuestReward > 0) {
        btn.style.display = 'none';
        status.style.display = 'block';
    } else {
        btn.style.display = 'block';
        status.style.display = 'none';
        btn.innerText = "接受委托";
        btn.disabled = false;
    }
}

function acceptQuest() {
    const q = gameState.quest;
    if(gameState.ap < q.cost) {
        addMsg("系统: 行动力不足。", "system");
        return;
    }
    gameState.ap -= q.cost;
    pendingQuestReward = q.reward;
    dailyLogs.push(`[委托] 完成了"${q.name}"，预计报酬 ${q.reward}铜。`);
    addMsg(`系统: 你完成了委托 "${q.name}"。`, "system");
    renderUI();
    saveData();
}

function doAction(name, cost) {
    if(gameState.ap < cost) {
        addMsg("系统: 行动力不足。", "system");
        return;
    }
    gameState.ap -= cost;
    dailyLogs.push(`[行动] 进行了"${name}"。`);
    addMsg(`系统: 进行 ${name} (消耗 ${cost} AP)。`, "system");
    renderUI();
    saveData();
}

function addToCart(name, price) {
    cart.push({name, price});
    updateCartDisplay();
}

function updateCartDisplay() {
    const list = document.getElementById('cart-list');
    const totalEl = document.getElementById('cart-total');
    
    if(cart.length === 0) {
        list.innerHTML = '(空)';
        totalEl.innerText = '0';
        return;
    }
    let total = 0;
    list.innerHTML = cart.map(item => {
        total += item.price;
        return `<div class="cart-item"><span>${item.name}</span><span>${item.price}</span></div>`;
    }).join('');
    totalEl.innerText = total;
    totalEl.style.color = total > gameState.money ? 'red' : 'inherit';
}

// --- AI 交互核心 ---

// 获取当前启用的世界书文本
function getActiveLoreText() {
    return config.worldLore
        .filter(item => item.active)
        .map(item => item.text)
        .join('\n\n'); 
}

async function sendChat() {
    const input = document.getElementById('user-input');
    const text = input.value.trim();
    if(!text) return;

    addMsg(text, "user");
    input.value = "";
    chatHistory.push({role: "user", content: text});
    saveData();

    const btn = document.getElementById('send-btn');
    btn.innerText = "..."; btn.disabled = true;

    const sysPrompt = `
    【世界设定】
    ${getActiveLoreText()}
    
    【角色扮演设定】
    ${config.knightPrompt}
    
    【当前游戏状态】
    季节日期: ${gameState.season} 第${gameState.day}日
    洛落状态: 欠债${gameState.debt}铜，存款${gameState.money}铜，HP:${gameState.user.hp}，衣着:${gameState.user.clothes}。
    生理状态: 性欲(${gameState.user.lust})，性器(${gameState.user.genital})。
    骑士状态: 好感(${gameState.knight.love})，性欲(${gameState.knight.lust})，性器(${gameState.knight.genital})。
    
    请以维克多的身份回复玩家。
    `;

    try {
        const messages = [{role: "system", content: sysPrompt}, ...chatHistory.slice(-8)];
        const reply = await callAPI(messages, false);
        if(reply) {
            addMsg(reply, "knight");
            chatHistory.push({role: "assistant", content: reply});
            saveData();
        }
    } catch(e) {
        addMsg("系统: 通讯干扰 (API错误)。", "system");
    } finally {
        btn.innerText = "发送"; btn.disabled = false;
    }
}

async function endDay() {
    const btn = document.getElementById('end-day-btn');
    if(btn.classList.contains('processing')) return;
    btn.classList.add('processing'); btn.innerText = "结算中...";

    const sysPrompt = `
    你是一个严谨的RPG数值结算系统。请根据玩家一天的行为进行结算。
    
    【世界设定】
    ${getActiveLoreText()}

    【当前数据】
    ${JSON.stringify(gameState)}
    今日行动: ${JSON.stringify(dailyLogs)}
    购物清单: ${JSON.stringify(cart)} (若钱不够则购买失败)
    待发任务奖励: ${pendingQuestReward}
    最近对话概要: ${JSON.stringify(chatHistory.slice(-3))}

    【结算规则】
    1. 资金结算：先加上任务奖励，再扣除购物花费。
    2. 时间推进：日期+1。注意季节更替(每季30天: 新绿->炎阳->金穗->霜寂)。
    3. 还款倒计时：daysUntilPay - 1。
    4. 农田：如果有"浇水"行动，作物生长；没浇水则干涸。
    5. 状态更新：
       - 根据行动增加经验值(XP)，XP满100时LV+1并重置XP。
       - 调整HP、骑士好感度。
       - 更新双方的"lust"(性欲)和"genital"(性器)状态描述。
    
    【输出要求】
    必须返回纯 JSON 格式：
    {
        "newState": { ...更新后的完整gameState... },
        "narrative": "剧情总结(不含表情符号，描述购物结果、身体状况、骑士反应)",
        "knightComment": "维克多的一句评价"
    }
    `;

    try {
        const reply = await callAPI([{role: "user", content: sysPrompt}], true); 
        const cleanJson = reply.replace(/```json/g, '').replace(/```/g, '').trim();
        const result = JSON.parse(cleanJson);

        gameState = result.newState;
        gameState.ap = 5; 
        gameState.quest = null;
        pendingQuestReward = 0;
        dailyLogs = [];
        cart = [];
        
        generateDailyQuest();
        updateCartDisplay();
        renderUI();
        
        addMsg("------ [ 日结报告 ] ------", "system");
        addMsg(result.narrative, "system");
        addMsg(`维克多: "${result.knightComment}"`, "knight");
        
        saveData();

    } catch(e) {
        console.error(e);
        addMsg("系统: 结算数据解析失败，请检查API配置或网络。", "system");
    } finally {
        btn.classList.remove('processing'); btn.innerText = "结束今日 / 结算数据";
    }
}

// --- 工具函数 ---

async function callAPI(messages, jsonMode) {
    if(!config.apiKey) { alert("请先在设置中配置 API Key"); return null; }
    
    const payload = {
        model: "deepseek-chat",
        messages: messages,
        temperature: 0.7,
        stream: false
    };
    if(jsonMode) payload.response_format = { type: "json_object" };

    const res = await fetch(`${config.baseUrl}/chat/completions`, {
        method: "POST",
        headers: { "Content-Type": "application/json", "Authorization": `Bearer ${config.apiKey}` },
        body: JSON.stringify(payload)
    });
    const data = await res.json();
    return data.choices[0].message.content;
}

function formatMoney(copper) {
    if(copper < 100) return `${copper}铜`;
    const silver = Math.floor(copper / 10);
    if(silver < 10) return `${silver}银 ${copper%10}铜`;
    const gold = Math.floor(copper / 100);
    return `${gold}金 ${Math.floor((copper%100)/10)}银`;
}

function renderUI() {
    document.getElementById('date-display').innerText = `${gameState.season} 第${gameState.day}日`;
    document.getElementById('money-display').innerText = formatMoney(gameState.money);
    document.getElementById('ap').innerText = gameState.ap;
    
    // 骑士
    const k = gameState.knight;
    document.getElementById('k-love').innerText = k.love;
    document.getElementById('k-loc').innerText = k.location;
    document.getElementById('k-mood').innerText = k.mood;
    document.getElementById('k-act').innerText = k.action;
    document.getElementById('k-lust').innerText = k.lust;
    document.getElementById('k-genital').innerText = k.genital;
    document.getElementById('k-cloth').innerText = k.clothes;

    // 用户
    const u = gameState.user;
    document.getElementById('u-hp-text').innerText = `${u.hp}/${u.max_hp || 100}`;
    document.getElementById('hp-bar').style.width = `${(u.hp / (u.max_hp || 100)) * 100}%`;
    
    // XP
    const xpPercent = (u.xp / (u.next_lv_xp || 100)) * 100;
    document.getElementById('u-xp-text').innerText = `${u.xp}/${u.next_lv_xp || 100}`;
    document.getElementById('xp-bar').style.width = `${xpPercent}%`;

    document.getElementById('u-lv').innerText = u.lv;
    document.getElementById('u-cloth').innerText = u.clothes;
    document.getElementById('u-debt').innerText = formatMoney(gameState.debt);
    document.getElementById('days-left').innerText = gameState.daysUntilPay;
    document.getElementById('u-state').innerText = u.status;
    document.getElementById('u-lust').innerText = u.lust;
    document.getElementById('u-genital').innerText = u.genital;

    // 农田
    const farmDiv = document.getElementById('farm-list');
    farmDiv.innerHTML = gameState.farms.map(f => 
        `<div style="padding:4px 0; border-bottom:1px dashed #eee;">
            ${f.id}号${f.type}: <strong>${f.crop}</strong> (${f.status})
        </div>`
    ).join('');
    
    renderQuestArea();
}

function addMsg(text, type) {
    const box = document.getElementById('chat-box');
    const div = document.createElement('div');
    div.className = `msg ${type}`;
    div.innerText = text;
    box.appendChild(div);
    box.scrollTop = box.scrollHeight;
}

function switchTab(id) {
    document.getElementById('tab-act').style.display = id==='act'?'block':'none';
    document.getElementById('tab-shop').style.display = id==='shop'?'block':'none';
    document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
    event.target.classList.add('active');
}

// --- 设置面板相关 (含世界书) ---

function openConfig() { 
    updateInputFields();
    document.getElementById('config-modal').classList.add('open'); 
}

function updateInputFields() {
    document.getElementById('api-key').value = config.apiKey;
    document.getElementById('api-url').value = config.baseUrl;
    document.getElementById('knight-prompt').value = config.knightPrompt;
    renderLoreList();
}

// 渲染世界书列表 - 修改为 textarea 输入框
function renderLoreList() {
    const container = document.getElementById('lore-list');
    container.innerHTML = "";
    config.worldLore.forEach((lore, index) => {
        const div = document.createElement('div');
        div.className = `lore-item ${!lore.active ? 'disabled' : ''}`;
        
        // 生成每一项的 HTML
        div.innerHTML = `
            <div class="lore-item-header">
                <div>
                    <input type="checkbox" ${lore.active ? 'checked' : ''} onchange="toggleLore(${index})">
                    <span style="font-size:0.85rem; font-weight:bold; color:var(--wine-red);">条目 #${index+1}</span>
                </div>
                <button class="config-btn small" style="color:red; border:none;" onclick="deleteLore(${index})">删除</button>
            </div>
            <textarea placeholder="在此输入世界观、场景描述或特殊规则..." onchange="updateLoreText(${index}, this.value)">${lore.text}</textarea>
        `;
        container.appendChild(div);
    });
}

function addLoreEntry() {
    config.worldLore.push({ text: "", active: true });
    renderLoreList();
}

function deleteLore(index) {
    config.worldLore.splice(index, 1);
    renderLoreList();
}

function toggleLore(index) {
    config.worldLore[index].active = !config.worldLore[index].active;
    renderLoreList();
}

function updateLoreText(index, text) {
    config.worldLore[index].text = text;
}

function saveConfigAndClose() {
    config.apiKey = document.getElementById('api-key').value;
    config.baseUrl = document.getElementById('api-url').value;
    config.knightPrompt = document.getElementById('knight-prompt').value;
    // World lore 已经在 updateLoreText 中实时更新了
    saveData();
    document.getElementById('config-modal').classList.remove('open');
    alert("设置已保存");
}
