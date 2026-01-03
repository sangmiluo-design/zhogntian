// --- 核心配置 ---
const CONFIG = {
    rates: { gold: 100, silver: 10 },
    seasons: ["新绿季 (春)", "炎阳季 (夏)", "金穗季 (秋)", "霜寂季 (冬)"],
    cycleLength: 31,
    repaymentDay: 29
};

// --- 用户自定义配置 (默认值) ---
let userConfig = {
    apiUrl: "https://api.openai.com/v1/chat/completions",
    apiKey: "", // 用户未填
    persona: `【维克多·银刃档案】
姓名：维克多·银刃 | 年龄：32岁 | 种族：人类
属性：力量B/敏捷A/耐力B/智力B/魅力A
职位：银月骑士团团长 | 家族：银月城骑士世家
外貌：黑发紫眸，左脸有道细疤，身材高大。
性格：冷峻、严谨、外冷内热、有责任感。
背景：维克托替洛落养父还了赌债，现为洛落的债主。他暂住在洛落家（猎人小屋）是为了监视进出森林的可疑人员，调查"月光宝石"骗局。

【洛落档案】
姓名：洛落 | 性别：女 | 种族：人类
背景：被半精灵猎人收养的弃婴。养父欠债跑路，洛落独自面对债务。目前在维克多的监督下努力打工还钱。

【关系】
维克多是债主和房客，洛落是欠债人和房东。两人同住一个屋檐下。`,
    worldBook: [
        { id: 1, active: true, content: "银月国：位于大陆西侧的人类王国，崇尚骑士精神。" },
        { id: 2, active: true, content: "月光宝石：一种传说能增强魔力的宝石，最近市面上出现了大量赝品。" }
    ]
};

// --- 游戏状态 ---
let gameState = {
    date: {
        totalDays: 1,
        cycleDay: 1,
        seasonIndex: 0
    },
    money: 200, // 铜币
    debt: {
        amount: 10000, 
        isPaid: false
    },
    player: {
        status: "健康",
        level: 1,
        exp: 0,
        lust: 0,
        organs: "未开发",
        abnormal: "无",
        ap: 100,
        maxAp: 100
    },
    npc: {
        name: "维克多·银刃",
        location: "客厅",
        cloth: "轻便骑士服",
        action: "阅读调查报告",
        affection: 30,
        lust: 5,
        organs: "正常",
        abnormal: "旧伤隐痛"
    },
    home: {
        rooms: [
            { id: 'bed', level: 1, name: '卧室', desc: '睡眠区重新布置。单人床、床头柜、新衣柜。' },
            { id: 'kitchen', level: 1, name: '厨房', desc: '基础烹饪。灶台、烤炉、橱柜。' },
            { id: 'living', level: 1, name: '客厅', desc: '重新铺设地板。方木桌、摇椅、铜灯。' }
        ]
    },
    farm: [
        { id: 1, level: 1, type: '旱田', crop: '月光麦', stage: '抽穗期', water: '充足' },
        { id: 2, level: 1, type: '旱田', crop: '月光麦', stage: '抽穗期', water: '充足' }
    ],
    pendingActions: []
};

// --- 初始化 ---
document.addEventListener('DOMContentLoaded', () => {
    updateUI();
    renderHome();
    
    // UI Tab切换
    document.querySelectorAll('.nav-btn').forEach(btn => {
        btn.addEventListener('click', (e) => {
            document.querySelectorAll('.nav-btn').forEach(b => b.classList.remove('active'));
            document.querySelectorAll('.tab-content').forEach(t => t.classList.remove('active'));
            e.currentTarget.classList.add('active');
            document.getElementById(`tab-${e.currentTarget.dataset.tab}`).classList.add('active');
        });
    });

    // 顶部设置按钮
    document.getElementById('btn-settings').addEventListener('click', openSettings);
    document.getElementById('btn-lore').addEventListener('click', openLore);
    
    // 设置/设定保存按钮
    document.getElementById('btn-save-settings').addEventListener('click', saveSettings);
    document.getElementById('btn-close-settings').addEventListener('click', () => document.getElementById('modal-settings-overlay').classList.add('hidden'));
    document.getElementById('btn-save-lore').addEventListener('click', saveLore);
    document.getElementById('btn-close-lore').addEventListener('click', () => document.getElementById('modal-lore-overlay').classList.add('hidden'));
    document.getElementById('btn-add-lore').addEventListener('click', addLoreEntry);

    // 游戏内按钮
    document.getElementById('btn-new-field').addEventListener('click', expandField);
    document.getElementById('btn-expand-house').addEventListener('click', expandHouse);
    document.getElementById('btn-end-day').addEventListener('click', endDay);
    document.getElementById('send-btn').addEventListener('click', handleUserChat);
    document.getElementById('btn-repay').addEventListener('click', repayDebt);
    document.getElementById('modal-cancel').addEventListener('click', closeModal);
});

// --- UI 更新逻辑 ---

function updateUI() {
    // 基础显示
    const sIndex = Math.floor((gameState.date.totalDays - 1) / 30) % 4;
    document.getElementById('date-display').innerText = `${CONFIG.seasons[sIndex]} 第 ${gameState.date.cycleDay} 天`;

    const m = gameState.money;
    document.getElementById('money-display').innerText = `${Math.floor(m / 100)}金 ${Math.floor((m % 100) / 10)}银 ${m % 10}铜`;
    document.getElementById('ap-display').innerText = `${gameState.player.ap}/${gameState.player.maxAp}`;

    // 洛落
    document.getElementById('p-status').innerText = gameState.player.status;
    document.getElementById('p-level').innerText = gameState.player.level;
    document.getElementById('p-exp').innerText = `${gameState.player.exp}/100`;
    document.getElementById('p-lust').innerText = `${gameState.player.lust}%`;
    document.getElementById('p-organs').innerText = gameState.player.organs;
    document.getElementById('p-abnormal').innerText = gameState.player.abnormal;

    // 维克多
    document.getElementById('v-location').innerText = gameState.npc.location;
    document.getElementById('v-cloth').innerText = gameState.npc.cloth;
    document.getElementById('v-action').innerText = gameState.npc.action;
    document.getElementById('v-affection').innerText = `${gameState.npc.affection}/100`;
    document.getElementById('v-lust').innerText = `${gameState.npc.lust}%`;
    document.getElementById('v-organs').innerText = gameState.npc.organs;
    document.getElementById('v-abnormal').innerText = gameState.npc.abnormal;

    // 还款按钮
    const btnRepay = document.getElementById('btn-repay');
    if (gameState.date.cycleDay === 29 && !gameState.debt.isPaid) {
        btnRepay.style.display = 'block';
        btnRepay.innerText = "立即还款 (100金)";
    } else if (gameState.debt.isPaid) {
        btnRepay.style.display = 'block';
        btnRepay.innerText = "本期已结清";
        btnRepay.disabled = true;
    } else {
        btnRepay.style.display = 'none';
    }
}

function renderHome() {
    // 渲染房屋
    const houseList = document.getElementById('house-rooms-list');
    houseList.innerHTML = '';
    gameState.home.rooms.forEach((room, index) => {
        const div = document.createElement('div');
        div.className = 'estate-block';
        div.innerHTML = `
            <h4>
                ${room.name} Lv.${room.level}
                <button class="upgrade-btn-small" onclick="upgradeRoom(${index})">⬆ 升级</button>
            </h4>
            <p class="desc-text">${room.desc}</p>
        `;
        houseList.appendChild(div);
    });

    // 渲染农田
    const farmList = document.getElementById('farm-fields-list');
    farmList.innerHTML = '';
    gameState.farm.forEach((field, index) => {
        const div = document.createElement('div');
        div.className = 'estate-block';
        div.innerHTML = `
            <h4>
                ${field.id}号 ${field.type} (Lv.${field.level})
                <button class="upgrade-btn-small" onclick="upgradeField(${index})">⬆ 升级</button>
            </h4>
            <p class="desc-text">作物: ${field.crop} | 阶段: ${field.stage} | 水量: ${field.water}</p>
        `;
        farmList.appendChild(div);
    });
}

// --- 升级与扩建系统 ---

function upgradeRoom(index) {
    const room = gameState.home.rooms[index];
    const cost = room.level * 2000; // 升级费用: 等级*20银
    showModal("升级房间", `将 [${room.name}] 升级到 Lv.${room.level + 1}？\n费用: ${cost/10} 银币`, () => {
        if (gameState.money >= cost) {
            gameState.money -= cost;
            room.level++;
            // 简单的描述变更，可由AI后续润色
            room.desc += " (已修缮翻新)";
            updateUI();
            renderHome();
            addMessage("system", `房间 ${room.name} 升级成功！环境变得更舒适了。`);
        } else {
            alert("资金不足！");
        }
    });
}

function upgradeField(index) {
    const field = gameState.farm[index];
    const cost = field.level * 1000; // 10银
    showModal("改良土壤", `升级 ${field.id}号农田的土壤肥力？\n费用: ${cost/10} 银币`, () => {
        if (gameState.money >= cost) {
            gameState.money -= cost;
            field.level++;
            updateUI();
            renderHome();
            addMessage("system", `${field.id}号农田土壤改良完成，作物生长速度可能提升。`);
        } else {
            alert("资金不足！");
        }
    });
}

function expandField() {
    const currentFields = gameState.farm.length;
    const cost = 500 + (currentFields - 2) * 500; 
    showModal("开垦荒地", `开辟第 ${currentFields + 1} 号农田。\n费用: ${cost/10} 银币`, () => {
        if (gameState.money >= cost) {
            gameState.money -= cost;
            gameState.farm.push({
                id: currentFields + 1,
                level: 1,
                type: '旱田',
                crop: '无',
                stage: '荒芜',
                water: '干燥'
            });
            updateUI();
            renderHome();
            addMessage("system", `已开辟新农田。`);
        } else {
            alert("资金不足！");
        }
    });
}

function expandHouse() {
    const cost = 10000;
    showModal("增建房屋", `扩建房屋增加一个新区域。\n费用: 100 金币`, () => {
        if (gameState.money >= cost) {
            const areaName = prompt("请输入新区域名称 (如：观景阳台)：", "观景阳台");
            if(areaName) {
                gameState.money -= cost;
                gameState.home.rooms.push({
                    id: 'extra_' + Date.now(),
                    level: 1,
                    name: areaName,
                    desc: '刚刚建成的崭新区域。'
                });
                updateUI();
                renderHome();
                addMessage("system", `房屋扩建成功：${areaName}`);
            }
        } else {
            alert("资金不足！");
        }
    });
}

// --- 设置与世界书逻辑 ---

function openSettings() {
    document.getElementById('cfg-api-url').value = userConfig.apiUrl;
    document.getElementById('cfg-api-key').value = userConfig.apiKey;
    document.getElementById('modal-settings-overlay').classList.remove('hidden');
}

function saveSettings() {
    userConfig.apiUrl = document.getElementById('cfg-api-url').value;
    userConfig.apiKey = document.getElementById('cfg-api-key').value;
    document.getElementById('modal-settings-overlay').classList.add('hidden');
    addMessage("system", "系统设置已保存。");
}

function openLore() {
    document.getElementById('cfg-persona').value = userConfig.persona;
    renderWorldBookList();
    document.getElementById('modal-lore-overlay').classList.remove('hidden');
}

function renderWorldBookList() {
    const list = document.getElementById('worldbook-list');
    list.innerHTML = '';
    userConfig.worldBook.forEach((entry, index) => {
        const div = document.createElement('div');
        div.className = 'worldbook-item';
        div.innerHTML = `
            <input type="checkbox" class="wb-checkbox" ${entry.active ? 'checked' : ''} onchange="toggleLore(${index})">
            <input type="text" class="wb-input" value="${entry.content}" onchange="updateLoreText(${index}, this.value)">
            <button class="wb-del-btn" onclick="deleteLore(${index})">X</button>
        `;
        list.appendChild(div);
    });
}

function addLoreEntry() {
    userConfig.worldBook.push({ id: Date.now(), active: true, content: "新设定的内容..." });
    renderWorldBookList();
}

window.toggleLore = (index) => { userConfig.worldBook[index].active = !userConfig.worldBook[index].active; };
window.updateLoreText = (index, val) => { userConfig.worldBook[index].content = val; };
window.deleteLore = (index) => {
    userConfig.worldBook.splice(index, 1);
    renderWorldBookList();
};

function saveLore() {
    userConfig.persona = document.getElementById('cfg-persona').value;
    // WorldBook is already updated in real-time via onchange
    document.getElementById('modal-lore-overlay').classList.add('hidden');
    addMessage("system", "世界书与人物设定已更新。");
}

// --- 游戏行为 ---

function quickAction(type) {
    if (type === 'hunt') {
        if(gameState.player.ap < 20) return alert("体力不足");
        gameState.player.ap -= 20;
        gameState.pendingActions.push("在森林边缘狩猎采集");
        addMessage("system", "你出发去森林寻找物资...");
    } else if (type === 'work_tavern') {
        if(gameState.player.ap < 30) return alert("体力不足");
        gameState.player.ap -= 30;
        gameState.pendingActions.push("在酒馆当服务生赚取铜币");
        addMessage("system", "你在酒馆忙碌了一整天。");
    } else if (type === 'housework') {
        if(gameState.player.ap < 15) return alert("体力不足");
        gameState.player.ap -= 15;
        gameState.pendingActions.push("打扫家里卫生，维克多就在旁边");
        addMessage("system", "你开始整理家务...");
    }
    updateUI();
}

function repayDebt() {
    const amount = gameState.debt.amount;
    showModal("偿还债务", `偿还本期债务: 100 金币`, () => {
        if (gameState.money >= amount) {
            gameState.money -= amount;
            gameState.debt.isPaid = true;
            updateUI();
            addMessage("system", "债务已结清。维克多默默点了点头。");
        } else {
            alert("金额不足。");
        }
    });
}

// --- AI 集成 ---

async function endDay() {
    gameState.date.cycleDay++;
    gameState.date.totalDays++;
    gameState.player.ap = gameState.player.maxAp;

    // 简单收益模拟
    let dailyIncome = 0;
    if (gameState.pendingActions.some(a => a.includes("酒馆"))) dailyIncome += 50;
    if (gameState.pendingActions.some(a => a.includes("狩猎"))) dailyIncome += 30;
    gameState.money += dailyIncome;

    const actions = gameState.pendingActions.join("，");
    gameState.pendingActions = [];

    // 构建提示词
    const activeLore = userConfig.worldBook.filter(e => e.active).map(e => e.content).join("\n");
    const systemPrompt = `
${userConfig.persona}

【世界观补充 (World Book)】
${activeLore}

【当前状态】
时间：${CONFIG.seasons[Math.floor((gameState.date.totalDays - 1) / 30) % 4]} 第${gameState.date.cycleDay-1}天。
玩家(洛落)行为：${actions || "休息了一天"}。
维克多好感度：${gameState.npc.affection}。
玩家金钱：${gameState.money}铜。

请以【维克多·银刃】的视角或旁白视角，对今日进行结算总结。
    `;

    addMessage("system", `=== 第 ${gameState.date.cycleDay-1} 天结算 ===\n获得收益: ${dailyIncome}铜`);
    await callAI(systemPrompt, "请生成今日日结剧情。");
    
    updateUI();
}

async function handleUserChat() {
    const input = document.getElementById('user-input');
    const text = input.value.trim();
    if (!text) return;
    
    addMessage("user", text);
    input.value = '';

    const activeLore = userConfig.worldBook.filter(e => e.active).map(e => e.content).join("\n");
    const systemPrompt = `
${userConfig.persona}
【世界观补充】
${activeLore}
`;
    
    await callAI(systemPrompt, `(当前场景：洛落家中) 洛落说：${text}`);
}

async function callAI(systemContext, userMsg) {
    if (!userConfig.apiKey) {
        setTimeout(() => {
            addMessage("ai", "（请点击右上角⚙️设置按钮，配置API Key以开启AI对话功能）");
        }, 500);
        return;
    }

    try {
        const res = await fetch(userConfig.apiUrl, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${userConfig.apiKey}`
            },
            body: JSON.stringify({
                model: "gpt-3.5-turbo", // 如果是用DeepSeek，通常这里填 deepseek-chat
                messages: [
                    {role: "system", content: systemContext},
                    {role: "user", content: userMsg}
                ],
                temperature: 0.7
            })
        });
        
        if (!res.ok) throw new Error(`API Error: ${res.status}`);
        
        const data = await res.json();
        // 兼容不同API返回结构，通常是 choices[0].message.content
        const content = data.choices ? data.choices[0].message.content : JSON.stringify(data);
        addMessage("ai", content);
    } catch (e) {
        console.error(e);
        addMessage("system", "AI连接失败: " + e.message);
    }
}

// 辅助工具
function addMessage(type, text) {
    const box = document.getElementById('chat-history');
    const div = document.createElement('div');
    div.className = `msg ${type}`;
    let name = type === 'user' ? "洛落" : (type === 'ai' ? "维克多" : "系统");
    div.innerHTML = `<span class="msg-name">${name}</span><div class="msg-body">${text}</div>`;
    box.appendChild(div);
    box.scrollTop = box.scrollHeight;
}

function showModal(title, body, onConfirm) {
    document.getElementById('modal-title').innerText = title;
    document.getElementById('modal-body').innerText = body;
    document.getElementById('modal-overlay').classList.remove('hidden');
    const btn = document.getElementById('modal-confirm');
    const newBtn = btn.cloneNode(true);
    btn.parentNode.replaceChild(newBtn, btn);
    newBtn.addEventListener('click', () => { onConfirm(); closeModal(); });
}

function closeModal() { document.getElementById('modal-overlay').classList.add('hidden'); }
