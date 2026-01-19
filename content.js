// =====================================  UI 注入逻辑  =====================================
function injectAuditPanel() {
    if (document.getElementById('audit-tool-panel')) return;

    const panel = document.createElement('div');
    panel.id = 'audit-tool-panel';
    panel.style = `
    position: fixed; top: 15px; right: 15px; z-index: 2147483647;
    background: #fff; border: 2px solid #67c23a; border-radius: 8px;
    padding: 12px; width: 380px; box-shadow: 0 4px 20px rgba(0,0,0,0.4);
    font-family: "Microsoft YaHei", sans-serif; 
    max-height: 95vh; /* 面板不超过屏幕高度 */
    display: flex; flex-direction: column; 
    overflow: hidden; /* 防止外层出现多余滚动条 */
    `;
    
    panel.innerHTML = `
        <div id="audit-panel-header" style="font-weight:bold; color:#333; margin-bottom:8px; display:flex; justify-content:space-between; align-items:center; cursor: move; user-select: none;">
            <span>浙北党员之家助手 v2.0</span>
            <button id="close-audit-panel" style="background:none; border:none; cursor:pointer; color:#999; font-size:18px;">&times;</button>
         </div>

        <div style="font-size: 10px; color: #999; margin-bottom: 10px; font-style: italic; border-bottom: 1px solid #eee; padding-bottom: 4px;">
            developed by ph1lomel
        </div>
        
        <div style="margin-bottom:10px; border-bottom:1px solid #eee; padding-bottom:10px;">
            <button class="tab-button" id="tab-audit" style="padding:5px 10px; border:1px solid #ddd; border-bottom:none; background:#f0f0f0; cursor:pointer;">活动核查</button>
            <button class="tab-button" id="tab-signin" style="padding:5px 10px; border:1px solid #ddd; border-bottom:none; background:#f0f0f0; cursor:pointer;">批量签到</button>
        </div>

        <div id="tab-content-audit" class="tab-content" style="display:block;">
            <div style="font-size:13px; margin-bottom:10px; background:#f9f9f9; padding:8px; border-radius:4px;">
                月份：<input type="month" id="audit-input-month" style="border:1px solid #ddd; border-radius:3px; padding:2px;">
                <button id="run-audit-btn-plugin" style="margin-left:5px; background:#67c23a; color:#fff; border:none; padding:4px 10px; border-radius:4px; cursor:pointer;">开始核查</button>
            </div>
            
            <div id="audit-plugin-status" style="font-size:12px; color:#666; margin-bottom:5px;">准备就绪</div>
            <div id="audit-result-container" style="max-height: 400px; overflow-y: auto; border: 1px solid #eee; border-radius: 4px; display: none; margin-top: 5px;">
                <table style="width: 100%; border-collapse: collapse; font-size: 11px; text-align: left;">
                    <thead style="position: sticky; top: 0; background: #eee; z-index: 10;">
                        <tr>
                            <th style="padding: 5px; border-bottom: 1px solid #ddd; width: 60%;">支部名称</th>
                            <th style="padding: 5px; border-bottom: 1px solid #ddd; width: 40%;">结果</th>
                        </tr>
                    </thead>
                    <tbody id="audit-result-tbody"></tbody>
                </table>
            </div>
        </div>

        <div id="tab-content-signin" class="tab-content" style="display:none;">
            <div style="font-size:13px; margin-bottom:10px; background:#f9f9f9; padding:8px; border-radius:4px;">
                <label style="font-weight:bold;">1. 拖入活动二维码：</label>
                <div id="qrcode-drop-area" style="border:2px dashed #bbb; padding:15px; text-align:center; margin-top:5px; background:#fff; cursor:pointer;">
                    将二维码图片拖到这里
                </div>
                <div id="qrcode-result" style="margin-top:5px; font-size:12px; color:#333;"></div>
            </div>

            <div style="font-size:13px; margin-bottom:10px; background:#f9f9f9; padding:8px; border-radius:4px;">
                <label style="font-weight:bold;">2. 粘贴人员名单（身份证号 密码）：</label>
                <textarea id="signin-member-list" rows="5" placeholder="一行一条，格式如：330xxxxxxxxxxxxx 200907" style="width:100%; border:1px solid #ddd; padding:5px; margin-top:5px; font-family:monospace; font-size:12px;"></textarea>
            </div>

            <button id="run-signin-btn-plugin" style="width:100%; background:#2196F3; color:#fff; border:none; padding:8px; border-radius:4px; cursor:pointer; font-weight:bold;">开始批量签到</button>
            <div id="signin-plugin-status" style="margin-top:10px; font-size:11px; color:#666; max-height:80px; overflow-y:auto; border-top:1px solid #eee; padding-top:5px;">准备就绪</div>
        </div>
    `;
    document.body.appendChild(panel);
    makePanelDraggable(panel);

    // 设置默认月份
    const now = new Date();
    document.getElementById('audit-input-month').value = `${now.getFullYear()}-${(now.getMonth() + 1).toString().padStart(2, '0')}`;
}

// ===================================== 通用工具函数 =====================================
const sleep = (ms) => new Promise(r => setTimeout(r, ms));

// ===================================== 1.1 核查模块 =====================================
async function startPluginAudit() {
    const statusBox = document.getElementById('audit-plugin-status');
    const resultContainer = document.getElementById('audit-result-container');
    const resultTbody = document.getElementById('audit-result-tbody');
    const btn = document.getElementById('run-audit-btn-plugin');
    const targetMonthStr = document.getElementById('audit-input-month').value;

    if (!targetMonthStr) return alert("请先选择月份");

    btn.disabled = true;
    btn.innerText = "核查中...";
    resultTbody.innerHTML = ""; 
    resultContainer.style.display = "block";
    // statusBox.innerText = "⏳正在初始化树节点...";
    statusBox.innerText = " 正在初始化树节点...";

    function analyzeTable() {
        let rows = document.querySelectorAll('.el-table__body-wrapper tbody tr.el-table__row');
        if (!rows || rows.length === 0 || (rows[0] && rows[0].innerText.includes('暂无数据'))) {
            return { status: "本月无活动", color: "#f56c6c" };
        }

        let hasAnyActivityThisMonth = false;
        let hasThemeDayThisMonth = false;

        for (let row of rows) {
            let cols = row.querySelectorAll('td');
            if (cols.length < 6) continue;
            let timeText = cols[3].innerText.trim();
            let typeText = cols[5].innerText.trim();

            if (timeText.startsWith(targetMonthStr)) {
                hasAnyActivityThisMonth = true;
                if (typeText.includes("支部主题党日")) {
                    hasThemeDayThisMonth = true;
                    break;
                }
            }
        }

        if (!hasAnyActivityThisMonth) {
            // return { status: "❌ 本月无活动", color: "#f56c6c" };
            return { status: "本月无活动", color: "#f56c6c" };
        } else if (!hasThemeDayThisMonth) {
            // return { status: "⚠️ 缺少主题党日", color: "#e6a23c" };
            return { status: "缺少主题党日", color: "#e6a23c" };
        } else {
            // return { status: "✅ 达标", color: "#67c23a" };
            return { status: "已建立主题党日", color: "#67c23a" };
        }
    }

    function addResultRow(name, result) {
        const row = document.createElement('tr');
        row.innerHTML = `
            <td style="padding:5px; border-bottom:1px solid #eee;">${name}</td>
            <td style="padding:5px; border-bottom:1px solid #eee; color:${result.color}; font-weight:bold;">${result.status}</td>
        `;
        resultTbody.appendChild(row);
        resultTbody.lastElementChild.scrollIntoView();
    }

    try {
        let l2Nodes = document.querySelectorAll('.el-tree > .el-tree-node.is-expanded > .el-tree-node__children > .el-tree-node');
        if (l2Nodes.length === 0) {
            statusBox.innerHTML = "<span style='color:red'>请手动展开左侧‘林城镇党委’</span>";
            throw new Error("Tree not expanded");
        }

        for (let i = 0; i < l2Nodes.length; i++) {
            let node = l2Nodes[i];
            let labelSpan = node.querySelector('.el-tree-node__label');
            let labelText = labelSpan ? labelSpan.innerText.trim() : `未知`;
            let expandIcon = node.querySelector('.el-tree-node__expand-icon');

            statusBox.innerText = `⏳ 正在检查: ${labelText}`;
            node.scrollIntoView({ behavior: "smooth", block: "center" });

            if (expandIcon && expandIcon.classList.contains('is-leaf')) {
                labelSpan.click();
                await sleep(1500);
                let res = analyzeTable();
                addResultRow(labelText, res);
            } else {
                if (!expandIcon.classList.contains('expanded')) expandIcon.click();
                await sleep(1000);
                let childNodes = node.querySelectorAll('.el-tree-node__children .el-tree-node');
                for (let cNode of childNodes) {
                    let cLabel = cNode.querySelector('.el-tree-node__label');
                    statusBox.innerText = `🔍 子级: ${cLabel.innerText}`;
                    cLabel.click();
                    await sleep(1500);
                    let res = analyzeTable();
                    addResultRow(cLabel.innerText.trim(), res);
                }
                expandIcon.click();
            }
        }
        statusBox.innerHTML = "<b style='color:green'>核查完成！</b>";
    } catch (e) {
        console.error("核查错误:", e);
        statusBox.innerHTML = `<b style='color:red'>核查失败: ${e.message}</b>`;
    } finally {
        btn.disabled = false;
        btn.innerText = "开始核查";
    }
}

// ===================================== 1.2 签到模块核心逻辑 =====================================
const LOGIN_URL = "https://app.changxinghuiyuan.com/DYGLH5-Test/api/logon";
const SIGNIN_URL = "https://app.changxinghuiyuan.com/DYGLH5-Test/Activity/JoinActivity";

let currentActivityId = null; // 用于存储解析到的活动ID

// --- 二维码解析功能 ---
function setupQRCodeDropArea() {
    const dropArea = document.getElementById('qrcode-drop-area');
    const qrcodeResultDiv = document.getElementById('qrcode-result');

    ['dragenter', 'dragover', 'dragleave', 'drop'].forEach(eventName => {
        dropArea.addEventListener(eventName, preventDefaults, false);
    });

    function preventDefaults(e) {
        e.preventDefault();
        e.stopPropagation();
    }

    ['dragenter', 'dragover'].forEach(eventName => {
        dropArea.addEventListener(eventName, () => dropArea.style.backgroundColor = '#e0f7fa', false);
    });

    ['dragleave', 'drop'].forEach(eventName => {
        dropArea.addEventListener(eventName, () => dropArea.style.backgroundColor = '', false);
    });

    dropArea.addEventListener('drop', handleDrop, false);

    // async function handleDrop(e) {
    //     const dt = e.dataTransfer;
    //     const files = dt.files;

    //     if (files.length === 0) {
    //         qrcodeResultDiv.innerHTML = "请拖入图片文件！";
    //         return;
    //     }
        
    //     const file = files[0];
    //     if (!file.type.startsWith('image/')) {
    //         qrcodeResultDiv.innerHTML = "请拖入图片文件！";
    //         return;
    //     }

    //     qrcodeResultDiv.innerHTML = "正在解析二维码...";
    //     const reader = new FileReader();
    //     reader.onload = async (event) => {
    //         const img = new Image();
    //         img.onload = () => {
    //             const canvas = document.createElement('canvas');
    //             const ctx = canvas.getContext('2d');
    //             canvas.width = img.width;
    //             canvas.height = img.height;
    //             ctx.drawImage(img, 0, 0, img.width, img.height);
    //             const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);

    //             try {
    //                 const code = jsQR(imageData.data, imageData.width, imageData.height);
    //                 if (code) {
    //                     const qrcodeUrl = code.data;
    //                     const urlObj = new URL(qrcodeUrl);
    //                     const id = urlObj.searchParams.get('id');
    //                     if (id) {
    //                         currentActivityId = id;
    //                         qrcodeResultDiv.innerHTML = `解析成功！活动ID: <b style="color:blue;">${id}</b>`;
    //                     } else {
    //                         qrcodeResultDiv.innerHTML = `解析到二维码内容，但未找到活动ID: ${qrcodeUrl}`;
    //                     }
    //                 } else {
    //                     qrcodeResultDiv.innerHTML = "未能识别图片中的二维码";
    //                 }
    //             } catch (error) {
    //                 qrcodeResultDiv.innerHTML = `解析二维码失败: ${error.message}`;
    //                 console.error("jsQR解析错误:", error);
    //             }
    //         };
    //         img.src = event.target.result;
    //     };
    //     reader.readAsDataURL(file);
    // }
        async function handleDrop(e) {
            const dt = e.dataTransfer;
            const files = dt.files;

            if (files.length === 0) {
                qrcodeResultDiv.innerHTML = "请拖入图片文件！";
                return;
            }
            
            const file = files[0];
            if (!file.type.startsWith('image/')) {
                qrcodeResultDiv.innerHTML = "请拖入图片文件！";
                return;
            }

            qrcodeResultDiv.innerHTML = "正在解析二维码...";
            const reader = new FileReader();
            reader.onload = async (event) => {
                const img = new Image();
                img.onload = () => {
                    const canvas = document.createElement('canvas');
                    const ctx = canvas.getContext('2d');
                    canvas.width = img.width;
                    canvas.height = img.height;
                    ctx.drawImage(img, 0, 0, img.width, img.height);
                    const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);

                    try {
                        const code = jsQR(imageData.data, imageData.width, imageData.height);
                        if (code) {
                            const qrcodeContent = code.data.trim();
                            console.log("二维码原始数据:", qrcodeContent);

                            let id = null;

                            // 逻辑 A：解析是否为 JSON 格式
                            try {
                                const jsonData = JSON.parse(qrcodeContent);
                                if (jsonData && jsonData.data) {
                                    id = jsonData.data; // 提取data字段
                                    console.log("从 JSON 中提取到 ID:", id);
                                }
                            } catch (jsonErr) {
                                // 如果不是 JSON，继续走传统解析逻辑
                            }

                            // 逻辑 B：网址格式
                            if (!id && qrcodeContent.startsWith('http')) {
                                try {
                                    const urlObj = new URL(qrcodeContent);
                                    id = urlObj.searchParams.get('id');
                                } catch (e) {}
                            }

                            // 逻辑 C：利用正则匹配 6 位左右的纯数字
                            if (!id) {
                                const match = qrcodeContent.match(/\d{6}/); 
                                id = match ? match[0] : qrcodeContent;
                            }

                            if (id) {
                                currentActivityId = id;
                                // qrcodeResultDiv.innerHTML = `✅ 解析成功！活动ID: <b style="color:blue; font-size:16px;">${id}</b>`;
                                qrcodeResultDiv.innerHTML = `解析成功！活动ID: <b style="color:blue; font-size:14px;">${id}</b>`;
                            } else {
                                // qrcodeResultDiv.innerHTML = `⚠️ 识别到内容但未找到ID: ${qrcodeContent}`;
                                qrcodeResultDiv.innerHTML = `识别到内容但未找到ID: ${qrcodeContent}`;
                            }
                        } else {
                            // qrcodeResultDiv.innerHTML = "❌ 未能识别，请确保二维码清晰且未被遮挡";
                            qrcodeResultDiv.innerHTML = "未能识别，请确保二维码清晰且未被遮挡";
                        }
                    } catch (error) {
                        // qrcodeResultDiv.innerHTML = `❌ 系统错误: ${error.message}`;
                        qrcodeResultDiv.innerHTML = `❌ 系统错误: ${error.message}`;
                        console.error("解析异常:", error);
                    }
                };
                img.src = event.target.result;
            };
            reader.readAsDataURL(file);
        }


}

// --- 批量签到功能 ---
async function startBatchSignIn() {
    const statusBox = document.getElementById('signin-plugin-status');
    const btn = document.getElementById('run-signin-btn-plugin');
    const memberListTextArea = document.getElementById('signin-member-list');

    if (!currentActivityId) {
        statusBox.innerHTML = "<span style='color:red'>请先拖入二维码解析出活动ID！</span>";
        return;
    }
    const memberListText = memberListTextArea.value.trim();
    if (!memberListText) {
        statusBox.innerHTML = "<span style='color:red'>请粘贴人员名单！</span>";
        return;
    }

    btn.disabled = true;
    btn.innerText = "签到中...";
    statusBox.innerHTML = "开始批量签到...";

    const members = memberListText.split('\n').map(line => line.trim()).filter(line => line);
    const results = [];

    for (let i = 0; i < members.length; i++) {
        const line = members[i];
        const parts = line.split(/\s+/); // 按空格或多个空格分割
        if (parts.length < 2) {
            results.push({ idCard: parts[0] || "未知", status: "格式错误" });
            statusBox.innerHTML = `⚠️ [${i + 1}/${members.length}] ${parts[0] || "未知"} 格式错误`;
            await sleep(500);
            continue;
        }
        const idCard = parts[0];
        const rawPassword = parts[1];

        statusBox.innerHTML = `⏳ [${i + 1}/${members.length}] 正在处理: ${idCard}`;
        
        try {
            let token = null;
            const passwordsToTry = [rawPassword];
            if (!rawPassword.includes("Dygl@")) { // 避免重复添加
                passwordsToTry.push(`Dygl@${rawPassword}`);
            }

            for (let pwd of passwordsToTry) {
                const loginPayload = { idCard: idCard, joinTime: pwd };
                const loginResponse = await fetch(LOGIN_URL, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json', 'User-Agent': 'Mozilla/5.0 (iPhone; CPU iPhone OS 16_6 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/16.6 Mobile/15E148 Safari/604.1' },
                    body: JSON.stringify(loginPayload)
                });
                const loginResult = await loginResponse.json();
                if (loginResult.Code === 200 && loginResult.Result && loginResult.Result.Token && loginResult.Result.Token.access_token) {
                    token = loginResult.Result.Token.access_token;
                    break;
                }
            }

            if (!token) {
                results.push({ idCard, status: "登录失败" });
                statusBox.innerHTML = `<span style='color:red'>❌ [${i + 1}/${members.length}] ${idCard} 登录失败</span>`;
                await sleep(1000);
                continue;
            }

            const signinResponse = await fetch(`${SIGNIN_URL}?id=${currentActivityId}`, {
                headers: { 'Authorization': `Bearer ${token}`, 'User-Agent': 'Mozilla/5.0 (iPhone; CPU iPhone OS 16_6 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/16.6 Mobile/15E148 Safari/604.1' },
            });
            const signinResult = await signinResponse.json();

            if (signinResult.Code === 200) {
                // results.push({ idCard, status: "✅ 签到成功" });
                // statusBox.innerHTML = `<span style='color:green'>✅ [${i + 1}/${members.length}] ${idCard} 签到成功</span>`;
                results.push({ idCard, status: "签到成功" });
                statusBox.innerHTML = `<span style='color:green'> [${i + 1}/${members.length}] ${idCard} 签到成功</span>`;
            } else {
                results.push({ idCard, status: `签到失败: ${signinResult.ErrorMSG || '未知错误'}` });
                statusBox.innerHTML = `<span style='color:red'>[${i + 1}/${members.length}] ${idCard} 签到失败</span>`;
            }

        } catch (error) {
            results.push({ idCard, status: `异常: ${error.message}` });
            statusBox.innerHTML = `<span style='color:red'> [${i + 1}/${members.length}] ${idCard} 异常: ${error.message}</span>`;
            console.error(`签到异常(${idCard}):`, error);
        }
        await sleep(1500); // 每个请求之间增加延迟，防止服务器封禁
    }
    
    statusBox.innerHTML = "<b style='color:green'>批量签到任务完成！</b>";
    alert(`批量签到完成！共处理 ${members.length} 人。`);
    console.table(results); // 详细结果可在F12控制台查看
}


// ===================================== 3. 事件与循环 =====================================
document.addEventListener('DOMContentLoaded', () => {
    // 确保DOM完全加载后才注入UI
    setTimeout(injectAuditPanel, 500); // 延迟加载，防止被页面初始化覆盖
    setupQRCodeDropArea(); // 初始化二维码拖拽区
});


document.addEventListener('click', (e) => {
    // 关闭面板
    if (e.target && e.target.id === 'close-audit-panel') {
        document.getElementById('audit-tool-panel').remove();
    }
    // 切换 Tab
    if (e.target && e.target.classList.contains('tab-button')) {
        document.querySelectorAll('.tab-content').forEach(content => content.style.display = 'none');
        document.querySelectorAll('.tab-button').forEach(btn => btn.style.background = '#f0f0f0');
        
        if (e.target.id === 'tab-audit') {
            document.getElementById('tab-content-audit').style.display = 'block';
        } else if (e.target.id === 'tab-signin') {
            document.getElementById('tab-content-signin').style.display = 'block';
            setupQRCodeDropArea(); // 确保拖拽区事件绑定
        }
        e.target.style.background = '#e6e6e6';
    }
    // 核查
    if (e.target && e.target.id === 'run-audit-btn-plugin') {
        startPluginAudit();
    }
    // 签到
    if (e.target && e.target.id === 'run-signin-btn-plugin') {
        startBatchSignIn();
    }
});

// 每隔一段时间检查并重新注入面板，防止SPA应用刷新DOM导致消失
setInterval(() => {
    if (!document.getElementById('audit-tool-panel')) {
        injectAuditPanel();
        setupQRCodeDropArea(); // 确保重新注入后也绑定事件
    }
}, 2000);

// ===================================== 拖拽移动逻辑 =====================================
function makePanelDraggable(panel) {
    const header = document.getElementById('audit-panel-header');
    let isDragging = false;
    let offset = { x: 0, y: 0 };

    header.addEventListener('mousedown', (e) => {
        isDragging = true;
        // 光标相对窗口左上角的偏移量
        offset.x = e.clientX - panel.offsetLeft;
        offset.y = e.clientY - panel.offsetTop;
        header.style.background = '#f9f9f9'; // 拖动变色反馈
    });

    document.addEventListener('mousemove', (e) => {
        if (!isDragging) return;

        // 计算新位置
        let newX = e.clientX - offset.x;
        let newY = e.clientY - offset.y;

        // 防拖出屏幕
        const maxX = window.innerWidth - panel.offsetWidth;
        const maxY = window.innerHeight - panel.offsetHeight;
        
        newX = Math.max(0, Math.min(newX, maxX));
        newY = Math.max(0, Math.min(newY, maxY));

        panel.style.left = newX + 'px';
        panel.style.top = newY + 'px';
        panel.style.right = 'auto'; // 清除初始定义的 right 属性，否则 left 不生效
    });

    document.addEventListener('mouseup', () => {
        isDragging = false;
        header.style.background = 'none';
    });
}
