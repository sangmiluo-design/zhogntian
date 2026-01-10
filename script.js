// --- 核心配置 ---
const CONFIG = {
    seasons: ["新绿季", "炎阳季", "金穗季", "霜寂季"],
    cycleLength: 31,
    saveKey: "silver_blade_save_v2"
};

// --- 用户设置 ---
let userConfig = {
    apiUrl: "https://api.deepseek.com/chat/completions",
    apiKey: "", 
    model: "deepseek-chat", 
    persona: `【维克多·银刃】
身份：银月骑士团长 | 债主
性格：冷峻、严谨、外冷内热。
背景：在洛落家监视森林，同时监督洛落还债。
【洛落】
身份：欠债少女 | 玩家
目标：打工还清100金币。`,
    worldBook: [
        { id: 1, active: true, content: "银月国：崇尚骑士精神的人类王国。" },
        { id: 2, active: true, content: "月光宝石：最近出现大量赝品，维克多正在调查此事。" }
    ]
};

// --- 游戏数据 (初始值) ---
const initialGameState = {
    date: { totalDays: 1, cycleDay: 1 },
    money: 200, 
    debt: { amount: 10000, isPaid: false },
    player: { status: "健康", level: 1, exp: 0, lust: 0, organs: "未开发", ap: 100, maxAp: 100 },
    npc: { name: "维克多", location: "客厅", action: "阅读", affection: 30, lust: 5, organs: "正常", abnormal: "旧伤" },
    home: {
        rooms: [
            { id: 'bed', level: 1, name: '卧室', desc: '单人床、简易衣柜。' },
            { id: 'living', level: 1, name: '客厅', desc: '方木桌、摇椅。' }
        ]
    },
    farm: [
        { id: 1, level: 1, type: '旱田', crop: '月光麦', stage: '生长期', water: '充足' }
    ],
    pendingActions: [],
    chatLog: [{ type: 'system', text: '连接建立...骑士团长维克多已上线。' }]
};

let gameState = JSON.parse(JSON.stringify(initialGameState));

// --- 初始化 ---
document.addEventListener('DOMContentLoaded', () => {
    autoLoad(); // 启动时自动读取本地存档
    
    // UI 初始化
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

    document.querySelectorAll('.nav-btn').forEach(btn => {
        btn.addEventListener('click', (e) => {
            document.querySelectorAll('.nav-btn').forEach(b => b.classList.remove('active'));
            document.querySelectorAll('.tab-content').forEach(t => t.classList.remove('active'));
            e.currentTarget.classList.add('active');
            document.getElementById(`tab-${e.currentTarget.dataset.tab}`).classList.add('active');
            if(window.innerWidth <= 768) toggleMenu();
        });
    });

    // 按钮事件绑定
    document.getElementById('btn-settings').addEventListener('click', openSettings);
    document.getElementById('btn-lore').addEventListener('click', openLore);
    document.getElementById('btn-save-settings').addEventListener('click', saveSettings);
    document.getElementById('btn-close-settings').addEventListener('click', () => document.getElementById('modal-settings-overlay').classList.add('hidden'));
    document.getElementById('btn-export-save').addEventListener('click', exportSave);
    document.getElementById('file-import-save').addEventListener('change', importSave);
    document.getElementById('btn-fetch-models').addEventListener('click', fetchModels);
    document.getElementById('btn-save-lore').addEventListener('click', saveLore);
    document.getElementById('btn-close-lore').addEventListener('click', () => document.getElementById('modal-lore-overlay').classList.add('hidden'));
    document.getElementById('btn-add-lore').addEventListener('click', addLoreEntry);
    document.getElementById('btn-new-field').addEventListener('click', expandField);
    document.getElementById('btn-expand-house').addEventListener('click', expandHouse);
    document.getElementById('btn-end-day').addEventListener('click', endDay);
    document.getElementById('send-btn').addEventListener('click', handleUserChat);
    document.getElementById('btn-repay').addEventListener('click', repayDebt);
    document.getElementById('modal-cancel').addEventListener('click', closeModal);
    document.getElementById('btn-reset').addEventListener('click', resetGame);
    
    // 模型选择框联动
    const modelSelect = document.getElementById('cfg-model-select');
    modelSelect.addEventListener('change', function() {
        const manualInput = document.getElementById('cfg-model-manual');
        if (this.value === 'manual') {
            manualInput.style.display = 'block';
        } else {
            manualInput.style.display = 'none';
        }
    });
});

// --- 本地存储逻辑 ---

function autoSave() {
    const data = { gameState, userConfig };
    localStorage.setItem(CONFIG.saveKey, JSON.stringify(data));
}

function autoLoad() {
    const raw = localStorage.getItem(CONFIG.saveKey);
    if (raw) {
        try {
            const data = JSON.parse(raw);
            if(data.gameState) gameState = data.gameState;
            if(data.userConfig) userConfig = data.userConfig;
            console.log("本地存档已加载");
        } catch(e) {
            console.error("存档损坏", e);
        }
    }
}

function resetGame() {
    if(confirm("确定要重置所有进度吗？这将无法撤销。")) {
        localStorage.removeItem(CONFIG.saveKey);
        location.reload();
    }
}

// --- UI 渲染 ---
function updateUI() {
    // 顶部
    const sIndex = Math.floor((gameState.date.totalDays - 1) / 30) % 4;
    document.getElementById('date-display').innerText = `${CONFIG.seasons[sIndex]} ${gameState.date.cycleDay}`;
    
    const m = gameState.money;
    document.getElementById('money-display').innerText = `${Math.floor(m/100)}金 ${m%10}铜`; 
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
    
    // 每次刷新UI时自动保存
    autoSave();
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
    document.getElementById('cfg-api-key').value = userConfig.apiKey;
    
    // 初始化模型选择器
    const select = document.getElementById('cfg-model-select');
    const manualInput = document.getElementById('cfg-model-manual');
    
    // 检查当前模型是否在下拉列表里
    const exists = [...select.options].some(o => o.value === userConfig.model);
    
    if (exists) {
        select.value = userConfig.model;
        manualInput.style.display = 'none';
    } else {
        select.value = 'manual';
        manualInput.style.display = 'block';
        manualInput.value = userConfig.model;
    }
    
    document.getElementById('modal-settings-overlay').classList.remove('hidden');
}

function saveSettings() {
    userConfig.apiUrl = document.getElementById('cfg-api-url').value;
    userConfig.apiKey = document.getElementById('cfg-api-key').value;
    
    const select = document.getElementById('cfg-model-select');
    if (select.value === 'manual') {
        userConfig.model = document.getElementById('cfg-model-manual').value;
    } else {
        userConfig.model = select.value;
    }
    
    document.getElementById('modal-settings-overlay').classList.add('hidden');
    autoSave();
    addMessage('system', '设置已保存');
}

// 拉取模型列表（核心更新）
async function fetchModels() {
    const url = document.getElementById('cfg-api-url').value;
    const key = document.getElementById('cfg-api-key').value;
    const msgBox = document.getElementById('api-test-msg');
    const select = document.getElementById('cfg-model-select');

    if(!key) { msgBox.innerText = "请先填写API Key"; return; }
    
    msgBox.innerText = "正在拉取...";

    // 智能推断 models 路径
    let modelsUrl = url;
    if (url.includes('/chat/completions')) {
        modelsUrl = url.replace('/chat/completions', '/models');
        // 应对一些不规范的API转发 (比如 deepseek 有时是 /models 而不是 /v1/models)
        if(modelsUrl.includes('deepseek.com') && !modelsUrl.includes('/v1/')) {
             // deepseek official endpoint tweak if needed, mostly standard now
        }
    } else {
        // 尝试默认
        modelsUrl = "https://api.deepseek.com/models";
    }

    try {
        const res = await fetch(modelsUrl, {
            method: 'GET',
            headers: { 'Authorization': `Bearer ${key}` }
        });

        if(!res.ok) throw new Error("HTTP " + res.status);
        
        const data = await res.json();
        const models = data.data; // Standard OpenAI format: { data: [{id: "..."}] }
        
        if (Array.isArray(models)) {
            // 清空旧选项，保留前几个或者重新生成
            select.innerHTML = '';
            
            // 添加获取到的模型
            models.forEach(m => {
                const opt = document.createElement('option');
                opt.value = m.id;
                opt.text = m.id;
                select.appendChild(opt);
            });
            
            // 添加手动选项
            const manualOpt = document.createElement('option');
            manualOpt.value = 'manual';
            manualOpt.text = '手动输入...';
            select.appendChild(manualOpt);
            
            // 自动选中第一个
            select.value = models[0].id;
            document.getElementById('cfg-model-manual').style.display = 'none';
            
            msgBox.innerText = `成功获取 ${models.length} 个模型`;
        } else {
            throw new Error("返回格式不符");
        }
    } catch(e) {
        console.error(e);
        msgBox.innerText = "拉取失败: " + e.message + " (请尝试手动输入)";
    }
}

function exportSave() {
    const blob = new Blob([JSON.stringify({gameState, userConfig})], {type: "application/json"});
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = `silver_blade_save_${Date.now()}.json`; a.click();
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
            autoSave();
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
window.toggleLore = (i) => { userConfig.worldBook[i].active = !userConfig.worldBook[i].active; autoSave(); };
window.updateLore = (i, v) => { userConfig.worldBook[i].content = v; autoSave(); };
window.delLore = (i) => { userConfig.worldBook.splice(i,1); renderLoreList(); autoSave(); };
function addLoreEntry() { userConfig.worldBook.push({active:true, content:""}); renderLoreList(); }
function saveLore() {
    userConfig.persona = document.getElementById('cfg-persona').value;
    document.getElementById('modal-lore-overlay').classList.add('hidden');
    autoSave();
}

// --- AI 通讯 ---
async function endDay() {
    gameState.date.cycleDay++;
    gameState.date.totalDays++;
    gameState.player.ap = 100;
    
    let income = 0;
    if(gameState.pendingActions.join("").includes("酒馆")) income = 50;
    gameState.money += income;
    
    const actions = gameState.pendingActions.join(",") || "无";
    gameState.pendingActions = [];

    addMessage('system', `第${gameState.date.cycleDay-1}天结束。收益:${income}`);
    updateUI(); // 先保存一下状态
    
    const prompt = `
${userConfig.persona}
【世界书】${userConfig.worldBook.filter(x=>x.active).map(x=>x.content).join("\n")}
【现状】洛落今天做了：${actions}。金钱：${gameState.money}。
请以维克多视角进行日结评价。
    `;
    await callAI(prompt, "日结");
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
        autoSave(); // 收到消息后保存聊天记录
    } catch(e) {
        addMessage('error', "API错误: " + e.message);
    }
}

function addMessage(type, text) {
    gameState.chatLog.push({type, text});
    rebuildChatDOM();
    // 这里不需要显式调用autoSave，因为通常跟随UpdateUI或AI回调
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
