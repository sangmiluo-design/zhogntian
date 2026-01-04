// --- 核心配置 ---
const CONFIG = {
    seasons: ["新绿季", "炎阳季", "金穗季", "霜寂季"],
    cycleLength: 31
};

// --- 用户设置 ---
let userConfig = {
    // 默认设置为DeepSeek的配置
    apiUrl: "https://api.deepseek.com/chat/completions",
    apiKey: "", 
    model: "deepseek-chat", 
    persona: `【维克多·银刃】
姓名：维克多·银刃
年龄：32岁
种族：人类
属性总览：力量B/敏捷A/耐力B/智力B/魅力A
外貌：黑发紫眸，左脸有道细疤，身材高大
性格：冷峻/严谨/外冷内热
职位：银月骑士团团长
家族：银月城骑士世家，父亲是现任骑士团总帅
【洛落】
身份：欠债少女 | 玩家
目标：打工还清3000金币。`,
    worldBook: [
        { id: 1, active: true, content: "银月国：崇尚骑士精神的人类王国。" },
        { id: 2, active: true, content: "月光宝石：最近出现大量赝品，维克多正在调查此事。" }
    ]
};

// --- 游戏数据 ---
let gameState = {
    date: { totalDays: 1, cycleDay: 1 },
    money: 200, 
    debt: { amount: 10000, isPaid: false },
    player: { status: "健康", level: 1, exp: 0, lust: 0, organs: "未开发", ap: 100, maxAp: 100 },
    npc: { name: "维克多", location: "客厅", action: "阅读", affection: 30, lust: 5, organs: "正常", abnormal: "无" },
    home: {
        rooms: [
            { id: 'bed', level: 1, name: '卧室', desc: '重新布置的睡眠区。屋内家具：单人床1，床头柜1，新衣柜1' },
            { id: 'living', level: 1, name: '客厅', desc: '重新铺设地板的起居区。屋内家具：方木桌1，摇椅1，铜灯1' }
        ]
    },
    farm: [
        { id: 1, level: 1, type: '旱田', crop: '月光麦', stage: '生长期', water: '充足' }
    ],
    pendingActions: [],
    chatLog: [{ type: 'system', text: '系统: 连接建立... 骑士团长维克多已上线。' }]
};

// --- 初始化 ---
document.addEventListener('DOMContentLoaded', () => {
    rebuildChatDOM();
    updateUI();
    renderHome();

    // 手机端菜单逻辑
    const sideNav = document.getElementById('side-nav');
    const navOverlay = document.getElementById('nav-overlay');
    const menuBtn = document.getElementById('mobile-menu-btn');

    function toggleMenu() {
        sideNav.classList.toggle('open');
        navOverlay.classList.toggle('hidden');
    }

    menuBtn.addEventListener('click', toggleMenu);
    navOverlay.addEventListener('click', toggleMenu);

    // 导航点击后自动收起菜单 (手机端)
    document.querySelectorAll('.nav-btn').forEach(btn => {
        btn.addEventListener('click', (e) => {
            // 切换 Tab
            document.querySelectorAll('.nav-btn').forEach(b => b.classList.remove('active'));
            document.querySelectorAll('.tab-content').forEach(t => t.classList.remove('active'));
            e.currentTarget.classList.add('active');
            document.getElementById(`tab-${e.currentTarget.dataset.tab}`).classList.add('active');
            
            // 收起菜单
            if(window.innerWidth <= 768) toggleMenu();
        });
    });

    // 顶部设置
    document.getElementById('btn-settings').addEventListener('click', openSettings);
    document.getElementById('btn-lore').addEventListener('click', openLore);
    
    // 模态框操作
    document.getElementById('btn-save-settings').addEventListener('click', saveSettings);
    document.getElementById('btn-close-settings').addEventListener('click', () => document.getElementById('modal-settings-overlay').classList.add('hidden'));
    document.getElementById('btn-export-save').addEventListener('click', exportSave);
    document.getElementById('file-import-save').addEventListener('change', importSave);
    document.getElementById('btn-fetch-models').addEventListener('click', fetchModels); // 新增

    // 设定操作
    document.getElementById('btn-save-lore').addEventListener('click', saveLore);
    document.getElementById('btn-close-lore').addEventListener('click', () => document.getElementById('modal-lore-overlay').classList.add('hidden'));
    document.getElementById('btn-add-lore').addEventListener('click', addLoreEntry);

    // 游戏操作
    document.getElementById('btn-new-field').addEventListener('click', expandField);
    document.getElementById('btn-expand-house').addEventListener('click', expandHouse);
    document.getElementById('btn-end-day').addEventListener('click', endDay);
    document.getElementById('send-btn').addEventListener('click', handleUserChat);
    document.getElementById('btn-repay').addEventListener('click', repayDebt);
    document.getElementById('modal-cancel').addEventListener('click', closeModal);
});

// --- UI 渲染 ---
function updateUI() {
    // 顶部
    const sIndex = Math.floor((gameState.date.totalDays - 1) / 30) % 4;
    document.getElementById('date-display').innerText = `${CONFIG.seasons[sIndex]} ${gameState.date.cycleDay}`;
    
    const m = gameState.money;
    document.getElementById('money-display').innerText = `${Math.floor(m/100)}金 ${m%10}铜`; // 简化显示
    document.getElementById('ap-display').innerText = `${gameState.player.ap}`;

    // 角色状态
    document.getElementById('p-status').innerText = gameState.player.status;
    document.getElementById('p-lust').innerText = gameState.player.lust + '%';
    document.getElementById('v-location').innerText = gameState.npc.location;
    document.getElementById('v-action').innerText = gameState.npc.action;
    document.getElementById('v-affection').innerText = gameState.npc.affection;

    // 按钮
    const btnRepay = document.getElementById('btn-repay');
    if (gameState.date.cycleDay >= 29 && !gameState.debt.isPaid) {
        btnRepay.style.display = 'block';
        btnRepay.innerText = "还款 (100金)";
    } else {
        btnRepay.style.display = 'none';
    }
}

function renderHome() {
    const houseList = document.getElementById('house-rooms-list');
    houseList.innerHTML = '';
    gameState.home.rooms.forEach((room, index) => {
        houseList.innerHTML += `
            <div class="estate-block">
                <h4>${room.name} Lv.${room.level} <button class="upgrade-btn-small" onclick="upgradeRoom(${index})">UP</button></h4>
                <p class="desc-text">${room.desc}</p>
            </div>`;
    });

    const farmList = document.getElementById('farm-fields-list');
    farmList.innerHTML = '';
    gameState.farm.forEach((field, index) => {
        farmList.innerHTML += `
            <div class="estate-block">
                <h4>${field.id}号田 Lv.${field.level} <button class="upgrade-btn-small" onclick="upgradeField(${index})">UP</button></h4>
                <p class="desc-text">${field.crop} | ${field.stage}</p>
            </div>`;
    });
}

function rebuildChatDOM() {
    const box = document.getElementById('chat-history');
    box.innerHTML = '';
    gameState.chatLog.forEach(msg => {
        const div = document.createElement('div');
        div.className = `msg ${msg.type}`;
        let name = msg.type === 'user' ? "洛落" : (msg.type === 'ai' ? "维克多" : "系统");
        if(msg.type === 'error') name = "错误";
        div.innerHTML = `<span class="msg-name">${name}</span><div class="msg-body">${msg.text}</div>`;
        box.appendChild(div);
    });
    box.scrollTop = box.scrollHeight;
}

// --- 游戏逻辑 ---
window.upgradeRoom = (idx) => {
    const cost = 2000;
    showModal("升级", `花费20银升级房间？`, () => {
        if(gameState.money >= cost) { gameState.money-=cost; gameState.home.rooms[idx].level++; updateUI(); renderHome(); }
    });
};
window.upgradeField = (idx) => {
    const cost = 1000;
    showModal("升级", `花费10银升级农田？`, () => {
        if(gameState.money >= cost) { gameState.money-=cost; gameState.farm[idx].level++; updateUI(); renderHome(); }
    });
};

function expandField() {
    const cost = 500;
    showModal("开垦", `花费50银开辟新田？`, () => {
        if(gameState.money>=cost) {
            gameState.money-=cost; 
            gameState.farm.push({id: gameState.farm.length+1, level:1, type:'旱田', crop:'无', stage:'荒芜', water:'少'});
            updateUI(); renderHome();
        }
    });
}

function expandHouse() {
    const cost = 10000;
    showModal("扩建", `花费100金扩建？`, () => {
        if(gameState.money>=cost) {
            const name = prompt("房间名：", "新房间");
            if(name) {
                gameState.money-=cost;
                gameState.home.rooms.push({id:'ext'+Date.now(), level:1, name:name, desc:'空荡荡的。'});
                updateUI(); renderHome();
            }
        }
    });
}

function quickAction(type) {
    let cost = 0;
    let text = "";
    if(type==='hunt') { cost=20; text="狩猎"; }
    if(type==='work_tavern') { cost=30; text="酒馆打工"; }
    if(type==='housework') { cost=15; text="做家务"; }

    if(gameState.player.ap >= cost) {
        gameState.player.ap -= cost;
        gameState.pendingActions.push(text);
        addMessage('system', `进行了 ${text}`);
        updateUI();
    } else {
        alert("体力不足");
    }
}

function repayDebt() {
    if(gameState.money >= gameState.debt.amount) {
        gameState.money -= gameState.debt.amount;
        gameState.debt.isPaid = true;
        addMessage('system', '债务已结清！');
        updateUI();
    } else {
        alert("钱不够");
    }
}

// --- API & 设置 ---
function openSettings() {
    document.getElementById('cfg-api-url').value = userConfig.apiUrl;
    document.getElementById('cfg-model-name').value = userConfig.model;
    document.getElementById('cfg-api-key').value = userConfig.apiKey;
    document.getElementById('modal-settings-overlay').classList.remove('hidden');
}

function saveSettings() {
    userConfig.apiUrl = document.getElementById('cfg-api-url').value;
    userConfig.model = document.getElementById('cfg-model-name').value;
    userConfig.apiKey = document.getElementById('cfg-api-key').value;
    document.getElementById('modal-settings-overlay').classList.add('hidden');
    addMessage('system', '设置已保存');
}

// 拉取模型列表（测试连接）
async function fetchModels() {
    const url = document.getElementById('cfg-api-url').value;
    const key = document.getElementById('cfg-api-key').value;
    const msgBox = document.getElementById('api-test-msg');

    if(!key) { msgBox.innerText = "请先填写API Key"; return; }

    // 尝试推断 Base URL (去除 /chat/completions)
    let baseUrl = url.replace('/chat/completions', '');
    if(baseUrl.endsWith('/v1')) baseUrl = baseUrl; // keep v1 if present
    else if(!baseUrl.endsWith('/v1')) baseUrl += '/v1'; // try adding v1 if missing
    
    // DeepSeek 具体路径可能是 https://api.deepseek.com/models
    // 通用 OpenAI 路径是 https://api.xxx.com/v1/models
    const tryUrl = "https://api.deepseek.com/models"; // 强制尝试DeepSeek的标准models路径

    msgBox.innerText = "正在连接 DeepSeek...";
    
    try {
        const res = await fetch(tryUrl, {
            method: 'GET',
            headers: { 'Authorization': `Bearer ${key}` }
        });

        if(!res.ok) throw new Error(res.status + " " + res.statusText);
        
        const data = await res.json();
        console.log(data);
        msgBox.innerText = "连接成功! 发现模型: " + (data.data ? data.data.map(m=>m.id).join(', ') : "未知结构");
    } catch(e) {
        msgBox.innerText = "连接失败: " + e.message + "\n(若是本地运行，可能是跨域CORS问题)";
    }
}

function exportSave() {
    const blob = new Blob([JSON.stringify({gameState, userConfig})], {type: "application/json"});
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = "save.json"; a.click();
}

function importSave(e) {
    const file = e.target.files[0];
    if(!file) return;
    const reader = new FileReader();
    reader.onload = (evt) => {
        try {
            const data = JSON.parse(evt.target.result);
            gameState = data.gameState;
            userConfig = data.userConfig;
            updateUI(); renderHome(); rebuildChatDOM();
            alert("读取成功");
            document.getElementById('modal-settings-overlay').classList.add('hidden');
        } catch(err) { alert("坏档"); }
    };
    reader.readAsText(file);
}

// --- 设定/世界书 ---
function openLore() {
    document.getElementById('cfg-persona').value = userConfig.persona;
    renderLoreList();
    document.getElementById('modal-lore-overlay').classList.remove('hidden');
}

function renderLoreList() {
    const list = document.getElementById('worldbook-list');
    list.innerHTML = '';
    userConfig.worldBook.forEach((item, idx) => {
        list.innerHTML += `
            <div class="worldbook-item">
                <input type="checkbox" class="wb-checkbox" ${item.active?'checked':''} onchange="toggleLore(${idx})">
                <textarea class="wb-input" onchange="updateLore(${idx}, this.value)">${item.content}</textarea>
                <button class="small-btn" onclick="delLore(${idx})">X</button>
            </div>`;
    });
}
window.toggleLore = (i) => userConfig.worldBook[i].active = !userConfig.worldBook[i].active;
window.updateLore = (i, v) => userConfig.worldBook[i].content = v;
window.delLore = (i) => { userConfig.worldBook.splice(i,1); renderLoreList(); };
function addLoreEntry() { userConfig.worldBook.push({active:true, content:""}); renderLoreList(); }
function saveLore() {
    userConfig.persona = document.getElementById('cfg-persona').value;
    document.getElementById('modal-lore-overlay').classList.add('hidden');
}

// --- AI 通讯 ---
async function endDay() {
    gameState.date.cycleDay++;
    gameState.date.totalDays++;
    gameState.player.ap = 100;
    
    // 简易收益
    let income = 0;
    if(gameState.pendingActions.join("").includes("酒馆")) income = 50;
    gameState.money += income;
    
    const actions = gameState.pendingActions.join(",") || "无";
    gameState.pendingActions = [];

    addMessage('system', `第${gameState.date.cycleDay-1}天结束。收益:${income}`);
    
    const prompt = `
${userConfig.persona}
【世界书】${userConfig.worldBook.filter(x=>x.active).map(x=>x.content).join("\n")}
【现状】洛落今天做了：${actions}。金钱：${gameState.money}。
请以维克多视角进行日结评价。
    `;
    await callAI(prompt, "日结");
    updateUI();
}

async function handleUserChat() {
    const input = document.getElementById('user-input');
    const val = input.value.trim();
    if(!val) return;
    addMessage('user', val);
    input.value = '';

    const prompt = `${userConfig.persona}\n【世界书】${userConfig.worldBook.filter(x=>x.active).map(x=>x.content).join("\n")}`;
    await callAI(prompt, val);
}

async function callAI(system, user) {
    if(!userConfig.apiKey) { addMessage('error', "请先设置API Key"); return; }
    
    try {
        const res = await fetch(userConfig.apiUrl, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${userConfig.apiKey}`
            },
            body: JSON.stringify({
                model: userConfig.model,
                messages: [
                    {role: "system", content: system},
                    {role: "user", content: user}
                ],
                temperature: 0.7
            })
        });

        if(!res.ok) {
            const err = await res.text();
            throw new Error(res.status + " " + err);
        }

        const data = await res.json();
        const reply = data.choices ? data.choices[0].message.content : "API返回格式异常";
        addMessage('ai', reply);
    } catch(e) {
        addMessage('error', "API错误: " + e.message);
    }
}

function addMessage(type, text) {
    gameState.chatLog.push({type, text});
    rebuildChatDOM();
}

function showModal(title, body, cb) {
    document.getElementById('modal-title').innerText = title;
    document.getElementById('modal-body').innerText = body;
    document.getElementById('modal-overlay').classList.remove('hidden');
    const btn = document.getElementById('modal-confirm');
    const nBtn = btn.cloneNode(true);
    btn.parentNode.replaceChild(nBtn, btn);
    nBtn.addEventListener('click', () => { cb(); closeModal(); });
}
function closeModal() { document.getElementById('modal-overlay').classList.add('hidden'); }
