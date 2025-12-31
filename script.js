/* =========================================
   边境契约 - 核心逻辑 (AI 全量驱动版)
   ========================================= */

const initialKnightPersona = `你扮演维克多·银刃，银月骑士团团长。
性格：冷峻、严谨、外冷内热。说话不带表情符号，简洁有力，有骑士风度。
动机：表面催债，实则监视这片区域寻找骗局线索，同时也隐晦地希望洛落能活下去。
对玩家称呼："你" 或 "洛落"。`;

// 初始状态
const defaultState = {
    season: "新绿季", 
    day: 10,          
    money: 200,       
    debt: 300000,     
    daysUntilPay: 7,  
    ap: 5,
    user: {
        hp: 100, max_hp: 100,
        lv: 1, xp: 0, next_lv_xp: 100,
        clothes: "旧亚麻裙",
        status: "正常",
        lust: "微弱",
        genital: "干燥"
    },
    knight: {
        love: 50, mood: "普通", 
        location: "村庄", action: "巡逻",
        lust: "中", genital: "微微勃起", clothes: "轻便胸甲",
        eval: "* 评价: \"保持警惕。\""
    },
    house: {
        name: "【刚维修完的】猎人小屋",
        desc: "养父留下的唯一遗产，虽然破旧，但勉强能遮风挡雨。",
        rooms: [
            { name: "卧室 LV1", desc: "家具: 单人床1，床头柜1，新衣柜1" },
            { name: "厨房 LV1", desc: "家具: 新灶台1，烤炉1，橱柜1" },
            { name: "客厅 LV1", desc: "家具: 方木桌1，摇椅1，铜灯1" },
            { name: "平台阳台 LV1", desc: "家具: 无" }
        ]
    },
    farms: [
        { id: 1, type: "旱田", crop: "无", status: "空闲" },
        { id: 2, type: "旱田", crop: "无", status: "空闲" }
    ],
    inventory: ["破损的水壶"], // [新增] 随身物品
    quest: { name: "暂无", desc: "暂无委托", reward: 0, cost: 0 }, // 动态
    dailyActions: [], // [新增] 动态行动列表
    shopItems: []     // [新增] 动态商店列表
};

// 全局变量
let gameState = JSON.parse(JSON.stringify(defaultState));
let backupState = null; // 用于重Roll结算
let config = {
    apiKey: "",
    baseUrl: "https://api.deepseek.com",
    knightPrompt: initialKnightPersona,
    worldLore: [] 
};
let chatHistory = [];
let dailyLogs = [];
let cart = [];
let pendingQuestReward = 0;
let lastActionResult = ""; // 记录上一次行动的AI反馈

window.onload = function() {
    loadData();
    // 初始化动态数据
    if(gameState.dailyActions.length === 0) generateDefaultActions();
    if(gameState.shopItems.length === 0) generateDefaultShop();
    if(!gameState.quest || gameState.quest.name === "暂无") generateDefaultQuest();
    
    updateInputFields();
    renderUI();
    
    if(chatHistory.length === 0) {
        addMsg("系统: 连接建立... 骑士团长维克多已上线。", "system");
    } else {
        const box = document.getElementById('chat-box');
        box.innerHTML = '';
        chatHistory.forEach(c => {
            // 只显示最近的消息，防止刷屏，但数据保留
            if(c.role !== 'system') addMsg(c.content, c.role === 'user' ? 'user' : 'knight');
        });
    }
};

// --- 数据管理 ---
function saveData() {
    const data = { gameState, config, chatHistory };
    localStorage.setItem('rpg_save_data_enhanced', JSON.stringify(data));
}

function loadData() {
    const raw = localStorage.getItem('rpg_save_data_enhanced');
    if(raw) {
        try {
            const data = JSON.parse(raw);
            gameState = { ...defaultState, ...data.gameState }; // 合并防止新字段缺失
            config = data.config || config;
            if (typeof config.worldLore === 'string') config.worldLore = [];
            chatHistory = data.chatHistory || [];
        } catch(e) { console.error("Load Error", e); }
    }
}

function exportData() {
    saveData();
    const raw = localStorage.getItem('rpg_save_data_enhanced');
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
        } catch(err) { alert("存档格式错误"); }
    };
    reader.readAsText(file);
}

// --- 默认生成器 (当AI未介入时) ---
function generateDefaultActions() {
    gameState.dailyActions = [
        { name: "农田浇水", cost: 1, desc: "照顾作物" },
        { name: "整理房间", cost: 1, desc: "改善环境" },
        { name: "酒馆帮工", cost: 2, desc: "赚取铜币" }
    ];
}
function generateDefaultShop() {
    gameState.shopItems = [
        { name: "黑麦面包", price: 5 },
        { name: "番茄种子", price: 10 },
        { name: "初级治疗药水", price: 50 },
        { name: "亚麻布", price: 20 }
    ];
}
function generateDefaultQuest() {
    gameState.quest = { name: "清理碎石", desc: "村长需要人手清理道路。", reward: 30, cost: 2 };
}

// --- 游戏交互 ---

function acceptQuest() {
    const q = gameState.quest;
    if(gameState.ap < q.cost) { addMsg("系统: 行动力不足。", "system"); return; }
    gameState.ap -= q.cost;
    pendingQuestReward = q.reward;
    dailyLogs.push(`[委托] 完成了"${q.name}"，预期报酬 ${q.reward}。`);
    addMsg(`系统: 完成委托 "${q.name}" (耗时 ${q.cost} AP)。`, "system");
    renderUI();
    saveData();
}

function doAction(name, cost) {
    if(gameState.ap < cost) { addMsg("系统: 行动力不足。", "system"); return; }
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
        list.innerHTML = '(空)'; totalEl.innerText = '0'; return;
    }
    let total = 0;
    list.innerHTML = cart.map(item => {
        total += item.price;
        return `<div class="cart-item"><span>${item.name}</span><span>${item.price}</span></div>`;
    }).join('');
    totalEl.innerText = total;
    totalEl.style.color = total > gameState.money ? 'red' : 'inherit';
}

// --- AI 核心 ---

function getActiveLoreText() {
    return config.worldLore.filter(i => i.active).map(i => i.text).join('\n\n');
}

// 辅助：获取最近3天的消息，减少Token
function getRecentContext() {
    const currentDay = gameState.day;
    // 假设每天平均10条消息，这里取最后30条作为近似“最近三天”
    // 为了更精准，我们在存消息时可以加时间戳，这里简化处理
    return chatHistory.slice(-30);
}

// 1. 聊天
async function sendChat() {
    const input = document.getElementById('user-input');
    const text = input.value.trim();
    if(!text) return;

    addMsg(text, "user");
    input.value = "";
    chatHistory.push({role: "user", content: text, day: gameState.day}); // 记录天数
    saveData();

    const btn = document.getElementById('send-btn');
    btn.innerText = "..."; btn.disabled = true;

    const sysPrompt = `
    【基本设定】
    ${config.knightPrompt}
    【世界设定】
    ${getActiveLoreText()}
    【当前状态】
    日期: ${gameState.season} 第${gameState.day}日
    好感: ${gameState.knight.love} | 心情: ${gameState.knight.mood}
    当前行为: ${gameState.knight.action}
    洛落位置: ${gameState.knight.location}附近
    
    请以维克多身份回复。回复需简短有力。
    `;

    try {
        const messages = [{role: "system", content: sysPrompt}, ...getRecentContext()];
        const reply = await callAPI(messages, false);
        if(reply) {
            addMsg(reply, "knight");
            chatHistory.push({role: "assistant", content: reply, day: gameState.day});
            saveData();
        }
    } catch(e) {
        addMsg("系统: 通讯失败。", "system");
    } finally {
        btn.innerText = "发送"; btn.disabled = false;
    }
}

// 重Roll对话
async function rerollChat() {
    if(chatHistory.length === 0) return;
    const lastMsg = chatHistory[chatHistory.length - 1];
    
    if(lastMsg.role === 'assistant') {
        // 移除最后一条AI回复
        chatHistory.pop();
        // 移除界面上的最后一条
        const box = document.getElementById('chat-box');
        if(box.lastChild) box.removeChild(box.lastChild);
        
        // 如果再上一条是用户的，则重新触发发送逻辑（但不重复添加用户消息）
        const userMsg = chatHistory[chatHistory.length - 1];
        if(userMsg && userMsg.role === 'user') {
            const btn = document.getElementById('send-btn');
            btn.innerText = "重试中..."; btn.disabled = true;

            const sysPrompt = `
            ${config.knightPrompt}
            (请重新生成上一条回复，尝试不同的语气或内容)
            `;
            try {
                const messages = [{role: "system", content: sysPrompt}, ...getRecentContext()];
                const reply = await callAPI(messages, false);
                if(reply) {
                    addMsg(reply, "knight");
                    chatHistory.push({role: "assistant", content: reply, day: gameState.day});
                    saveData();
                }
            } catch(e) { addMsg("系统: 重试失败。", "system"); } 
            finally { btn.innerText = "发送"; btn.disabled = false; }
        }
    }
}

// 2. 每日结算 (重头戏)
async function endDay() {
    const btn = document.getElementById('end-day-btn');
    const rerollBtn = document.getElementById('settle-reroll-btn');
    if(btn.classList.contains('processing')) return;
    
    // 备份状态用于重Roll
    backupState = JSON.parse(JSON.stringify(gameState));
    
    btn.classList.add('processing'); btn.innerText = "结算中...";
    rerollBtn.style.display = 'none'; // 结算中隐藏重试

    // 预计算金钱，防止AI算错
    let cartTotal = cart.reduce((sum, item) => sum + item.price, 0);
    let estimatedMoney = gameState.money + pendingQuestReward - cartTotal;
    if(estimatedMoney < 0) estimatedMoney = 0; // 防止负债

    const sysPrompt = `
    你是一个硬核RPG游戏主脑。请根据今日数据进行结算，并以 **纯JSON格式** 返回结果。
    
    【世界设定】
    ${getActiveLoreText()}
    
    【当前数据】
    ${JSON.stringify(gameState)}
    
    【今日发生】
    日志: ${JSON.stringify(dailyLogs)}
    购买: ${JSON.stringify(cart)} (总价: ${cartTotal})
    委托奖励: ${pendingQuestReward}
    对话摘要: ${JSON.stringify(getRecentContext().slice(-5))}
    
    【计算约束】
    理论剩余金钱 = ${gameState.money} + ${pendingQuestReward} - ${cartTotal} = ${estimatedMoney}。
    请以此数值为基础，若有额外剧情收入/支出可微调。
    
    【任务要求】
    1. **全量更新状态**: 根据剧情推导所有角色的所有字段（含性欲、好感、位置、评价）。
    2. **剧情推进**:
       - 如果购买了种子且有浇水，农田作物应生长或成熟。
       - 如果购买了物品，必须加入 inventory。
       - 必须生成 3 个符合明日剧情的新行动 (newActions)。
       - 必须生成 4 个商店新货 (newShop)。
       - 必须生成 1 个新委托 (newQuest)。
       - 更新房屋描述 (house) 如果有变化。
    3. **反馈集成**: 在 narrative 中简要描述每个行动的结果。
    
    【JSON 输出格式】
    {
        "newState": { ...完整的gameState对象... },
        "narrative": "剧情总结，包含对购物、行动的反馈",
        "knightComment": "维克多的一句评价"
    }
    `;

    try {
        const reply = await callAPI([{role: "user", content: sysPrompt}], true);
        const cleanJson = reply.replace(/```json/g, '').replace(/```/g, '').trim();
        const result = JSON.parse(cleanJson);

        // 应用更新
        gameState = result.newState;
        
        // 强制重置部分循环逻辑
        gameState.ap = 5; 
        dailyLogs = [];
        cart = [];
        pendingQuestReward = 0;
        gameState.day += 1; // 确保天数增加
        gameState.daysUntilPay = Math.max(0, gameState.daysUntilPay - 1);

        updateCartDisplay();
        renderUI();
        
        addMsg("------ [ 日结报告 ] ------", "system");
        addMsg(result.narrative, "system");
        addMsg(`维克多: "${result.knightComment}"`, "knight");
        
        saveData();
        
        // 显示重试按钮
        rerollBtn.style.display = 'block';

    } catch(e) {
        console.error(e);
        addMsg("系统: 结算数据解析失败，请检查设置。", "system");
        // 恢复备份
        gameState = JSON.parse(JSON.stringify(backupState));
    } finally {
        btn.classList.remove('processing'); btn.innerText = "结束今日 / 结算数据";
    }
}

// 重Roll结算
function rerollSettlement() {
    if(!backupState) return;
    if(confirm("确定要回滚到结算前并重新计算吗？")) {
        gameState = JSON.parse(JSON.stringify(backupState));
        // 清除界面上的日结消息（可选，这里简单处理直接刷新或再次调用endDay）
        renderUI();
        addMsg("系统: 已回滚状态，正在重试结算...", "system");
        endDay();
    }
}

// --- API 调用 ---
async function callAPI(messages, jsonMode) {
    if(!config.apiKey) { alert("请配置 API Key"); return null; }
    
    const payload = {
        model: "deepseek-chat", // 可在设置里改
        messages: messages,
        temperature: 0.8, // 稍微提高创造性
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

// --- 渲染 UI ---
function formatMoney(copper) {
    if(isNaN(copper)) return "0铜";
    if(copper < 100) return `${Math.floor(copper)}铜`;
    const silver = Math.floor(copper / 10);
    if(silver < 10) return `${silver}银 ${Math.floor(copper%10)}铜`;
    const gold = Math.floor(copper / 100);
    return `${gold}金 ${Math.floor((copper%100)/10)}银`;
}

function renderUI() {
    // 顶栏
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
    document.getElementById('k-eval').innerText = k.eval || "";

    // 用户
    const u = gameState.user;
    document.getElementById('u-hp-text').innerText = `${u.hp}/${u.max_hp}`;
    document.getElementById('hp-bar').style.width = `${Math.min(100, (u.hp / u.max_hp) * 100)}%`;
    
    document.getElementById('u-xp-text').innerText = `${u.xp}/${u.next_lv_xp}`;
    document.getElementById('xp-bar').style.width = `${Math.min(100, (u.xp / u.next_lv_xp) * 100)}%`;

    document.getElementById('u-lv').innerText = u.lv;
    document.getElementById('u-cloth').innerText = u.clothes;
    document.getElementById('u-debt').innerText = formatMoney(gameState.debt);
    document.getElementById('days-left').innerText = gameState.daysUntilPay;
    document.getElementById('u-state').innerText = u.status;
    document.getElementById('u-lust').innerText = u.lust;
    document.getElementById('u-genital').innerText = u.genital;

    // 房屋
    if(gameState.house) {
        document.getElementById('house-name').innerText = gameState.house.name;
        document.getElementById('house-desc').innerText = gameState.house.desc;
        const roomDiv = document.getElementById('room-list');
        roomDiv.innerHTML = gameState.house.rooms.map(r => `
            <div class="room-item">
                <strong>${r.name}</strong><br>
                <span class="furniture">${r.desc}</span>
            </div>
        `).join('');
    }

    // 农田
    const farmDiv = document.getElementById('farm-list');
    farmDiv.innerHTML = gameState.farms.map(f => 
        `<div style="padding:4px 0; border-bottom:1px dashed #eee;">
            ${f.id}号${f.type}: <strong>${f.crop}</strong> (${f.status})
        </div>`
    ).join('');

    // [新增] 随身物品
    const invDiv = document.getElementById('inventory-list');
    if(gameState.inventory && gameState.inventory.length > 0) {
        invDiv.innerHTML = gameState.inventory.map(item => 
            `<div class="inv-item" title="持有物品">${item}</div>`
        ).join('');
    } else {
        invDiv.innerHTML = '<span style="color:#999; font-style:italic;">暂无物品</span>';
    }
    
    // 动态生成：委托
    const q = gameState.quest;
    const qArea = document.getElementById('quest-content');
    if(q) {
        qArea.innerHTML = `
            <div style="font-weight:bold; margin-bottom:2px;">${q.name}</div>
            <div style="font-size:0.85rem; color:#555; margin-bottom:5px;">${q.desc}</div>
            <div style="font-size:0.85rem;">
                <span>报酬: ${formatMoney(q.reward)}</span> | <span>耗时: ${q.cost} AP</span>
            </div>
        `;
        const qBtn = document.getElementById('quest-btn');
        const qStatus = document.getElementById('quest-status');
        if (pendingQuestReward > 0) {
            qBtn.style.display = 'none'; qStatus.style.display = 'block';
        } else {
            qBtn.style.display = 'block'; qStatus.style.display = 'none';
            qBtn.innerText = "接受委托"; qBtn.disabled = false;
        }
    }

    // 动态生成：行动列表
    const actDiv = document.getElementById('action-list-container');
    if(gameState.dailyActions) {
        actDiv.innerHTML = gameState.dailyActions.map(act => `
            <button class="act-btn" onclick="doAction('${act.name}', ${act.cost})">
                <span>${act.name}</span> <span class="cost-tag">${act.cost} AP</span>
            </button>
        `).join('');
    }

    // 动态生成：商店列表
    const shopDiv = document.getElementById('shop-list-container');
    if(gameState.shopItems) {
        shopDiv.innerHTML = gameState.shopItems.map(item => `
            <button class="act-btn" onclick="addToCart('${item.name}', ${item.price})">
                <span>${item.name}</span> <span class="cost-tag">${formatMoney(item.price)}</span>
            </button>
        `).join('');
    }
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

// 设置
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
function renderLoreList() {
    const container = document.getElementById('lore-list');
    container.innerHTML = "";
    config.worldLore.forEach((lore, index) => {
        const div = document.createElement('div');
        div.className = `lore-item ${!lore.active ? 'disabled' : ''}`;
        div.innerHTML = `
            <div class="lore-item-header">
                <div>
                    <input type="checkbox" ${lore.active ? 'checked' : ''} onchange="toggleLore(${index})">
                    <span style="font-size:0.85rem; font-weight:bold; color:var(--wine-red);">条目 #${index+1}</span>
                </div>
                <button class="config-btn small" style="color:red; border:none;" onclick="deleteLore(${index})">删除</button>
            </div>
            <textarea placeholder="输入世界观..." onchange="updateLoreText(${index}, this.value)">${lore.text}</textarea>
        `;
        container.appendChild(div);
    });
}
function addLoreEntry() { config.worldLore.push({ text: "", active: true }); renderLoreList(); }
function deleteLore(index) { config.worldLore.splice(index, 1); renderLoreList(); }
function toggleLore(index) { config.worldLore[index].active = !config.worldLore[index].active; renderLoreList(); }
function updateLoreText(index, text) { config.worldLore[index].text = text; }
function saveConfigAndClose() {
    config.apiKey = document.getElementById('api-key').value;
    config.baseUrl = document.getElementById('api-url').value;
    config.knightPrompt = document.getElementById('knight-prompt').value;
    saveData();
    document.getElementById('config-modal').classList.remove('open');
    alert("设置已保存");
}
