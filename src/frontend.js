export const FRONTEND_HTML = `
<!DOCTYPE html>
<html lang="zh-CN">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>QQ MsgBot 控制台</title>
<style>
* { box-sizing: border-box; margin: 0; padding: 0; }
body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif; background: #e9ecef; height: 100vh; display: flex; color: #333; overflow: hidden; }

/* Loading */
#loading-page { display: flex; width: 100%; height: 100%; justify-content: center; align-items: center; font-size: 15px; color: #666; flex-direction: column; gap: 12px;}
.spinner { width: 36px; height: 36px; border: 3px solid #d9d9d9; border-top-color: #1890ff; border-radius: 50%; animation: spin 0.8s linear infinite; }
@keyframes spin { to { transform: rotate(360deg); } }

/* 登录 */
#login-page { display: none; width: 100%; height: 100%; justify-content: center; align-items: center; background: #f0f2f5;}
.login-box { background: white; padding: 40px 30px; border-radius: 12px; box-shadow: 0 8px 24px rgba(0,0,0,0.08); width: 320px; }
.login-box h2 { text-align: center; margin-bottom: 25px; font-weight: 600; color: #1a1a1a; }
.login-box input { width: 100%; padding: 12px 15px; margin-bottom: 20px; border: 1px solid #d9d9d9; border-radius: 8px; font-size: 14px; outline: none; transition: border-color 0.2s;}
.login-box input:focus { border-color: #1890ff; }
.login-box button { width: 100%; padding: 12px; background: #1890ff; color: white; border: none; border-radius: 8px; font-size: 15px; cursor: pointer; transition: background 0.2s;}
.login-box button:hover { background: #40a9ff; }

/* 错误遮罩 */
.error-layer { display: none; position: fixed; top: 0; left: 0; width: 100%; height: 100%; background: rgba(0,0,0,0.75); z-index: 9999; justify-content: center; align-items: center; backdrop-filter: blur(4px); }
.error-box { background: #fff; padding: 40px; border-radius: 12px; border-top: 4px solid #ff4d4f; max-width: 600px; box-shadow: 0 10px 30px rgba(0,0,0,0.2); }
.error-box h2 { color: #ff4d4f; margin-bottom: 20px; text-align: center; font-size: 20px;}
.error-box p { line-height: 1.6; margin-bottom: 15px; font-size: 14px; color: #555; }
.error-box code { background: #f5f5f5; padding: 2px 6px; border-radius: 4px; color: #d81e06; font-family: monospace; }
.error-box ol { margin-left: 20px; color: #555; font-size: 14px; line-height: 1.8; }
.missing-list { color: #ff4d4f; font-weight: bold; font-size: 16px; display: block; margin: 10px 0; text-align: center;}

/* 主界面 */
#app { display: none; width: 100%; height: 100%; background: white; box-shadow: 0 0 20px rgba(0,0,0,0.05); }

/* 侧边栏 */
.sidebar { width: 300px; background: #f7f9fa; border-right: 1px solid #e8e8e8; display: flex; flex-direction: column; }
.sidebar-header { padding: 20px 15px; border-bottom: 1px solid #e8e8e8; font-weight: 600; font-size: 18px; background: #fff; color: #1a1a1a; display: flex; align-items: center; gap: 8px;}
.session-list { flex: 1; overflow-y: auto; padding: 10px; }
.session-item { padding: 15px; border-radius: 8px; cursor: pointer; transition: all 0.2s; position: relative; margin-bottom: 5px; background: #fff; border: 1px solid transparent;}
.session-item:hover, .session-item.active { background: #e6f7ff; border-color: #91d5ff;}
.session-name { font-weight: 600; margin-bottom: 6px; font-size: 14px; color: #333; word-break: break-all; padding-right: 40px;}
.session-preview { font-size: 12px; color: #999; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.delete-session-btn { position: absolute; right: 10px; top: 15px; font-size: 14px; cursor: pointer; opacity: 0; transition: opacity 0.2s; color: #ff4d4f; padding: 4px;}
.session-item:hover .delete-session-btn { opacity: 1; }
.session-item.active { background: #e6f7ff; border-left: 4px solid #1890ff; padding-left: 11px;}

/* 聊天区 */
.chat-area { flex: 1; display: flex; flex-direction: column; background: #f0f2f5; position: relative;}
.chat-header { padding: 20px 25px; border-bottom: 1px solid #e8e8e8; font-weight: 600; display: flex; justify-content: space-between; align-items: center; background: #fff; color: #1a1a1a; z-index: 10;}
.messages { flex: 1; overflow-y: auto; padding: 25px; display: flex; flex-direction: column; scroll-behavior: smooth;}

/* 气泡 */
.msg { margin-bottom: 20px; display: flex; flex-direction: column; max-width: 75%; }
.msg.incoming { align-self: flex-start; }
.msg.outgoing { align-self: flex-end; align-items: flex-end; }
.msg-author { font-size: 12px; color: #999; margin-bottom: 6px; padding: 0 4px; word-break: break-all;}
.msg-bubble { padding: 12px 16px; border-radius: 12px; font-size: 14px; line-height: 1.5; word-wrap: break-word; position: relative; box-shadow: 0 1px 2px rgba(0,0,0,0.05);}
.msg.incoming .msg-bubble { background: #fff; color: #333; border-top-left-radius: 2px;}
.msg.outgoing .msg-bubble { background: #1890ff; color: #fff; border-top-right-radius: 2px;}

/* 引用与系统消息 */
.msg.system { align-self: center; align-items: center; max-width: 90%; margin: 15px 0;}
.msg-system-text { font-size: 12px; color: #888; background: rgba(0,0,0,0.05); padding: 4px 12px; border-radius: 12px; text-align: center; }
.quote-box { background: rgba(0,0,0,0.04); border-left: 3px solid #ccc; padding: 6px 10px; margin-bottom: 10px; font-size: 12px; color: #666; border-radius: 4px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;}
.msg.outgoing .quote-box { background: rgba(255,255,255,0.15); border-left-color: #fff; color: rgba(255,255,255,0.85); }

/* 底部元数据及操作栏 */
.msg-meta { font-size: 12px; color: #b3b3b3; margin-top: 6px; display: flex; align-items: center; gap: 10px; opacity: 0; transition: opacity 0.2s;}
.msg:hover .msg-meta { opacity: 1; }
.msg.outgoing .msg-meta { justify-content: flex-end; }

.action-btn { cursor: pointer; padding: 2px 6px; border-radius: 4px; background: #fff; border: 1px solid #e8e8e8; transition: all 0.2s; font-size: 13px; box-shadow: 0 1px 2px rgba(0,0,0,0.03);}
.action-btn:hover { background: #f0f0f0; border-color: #d9d9d9; transform: translateY(-1px);}
.msg.outgoing .action-btn { background: rgba(255,255,255,0.2); border: none; color: #fff; }

/* 附件 */
.attachment-img-box { margin-top: 8px; max-width: 100%; }
.chat-img { max-width: 220px; max-height: 220px; border-radius: 8px; cursor: pointer; object-fit: cover; display: block; box-shadow: 0 2px 8px rgba(0,0,0,0.1);}
.attachment-error { display: inline-block; font-size: 12px; color: #999; background: #f5f5f5; padding: 4px 8px; border-radius: 4px; font-style: italic; margin-top: 5px;}
.attachment-link { display: inline-flex; align-items: center; gap: 6px; margin-top: 8px; padding: 8px 14px; background: #fff; border-radius: 6px; color: #1890ff; text-decoration: none; font-size: 13px; border: 1px solid #e8e8e8; transition: background 0.2s;}
.attachment-link:hover { background: #f0f7ff; }
.msg.outgoing .attachment-link { background: rgba(255,255,255,0.15); border-color: transparent; color: #fff;}

/* 输入区 */
.input-area { padding: 15px 25px; background: #fff; border-top: 1px solid #e8e8e8; display: flex; gap: 15px; align-items: flex-end;}
.input-area textarea { flex: 1; height: 60px; padding: 12px 15px; border: 1px solid #d9d9d9; border-radius: 8px; resize: none; font-size: 14px; font-family: inherit; outline: none; transition: border-color 0.2s; background: #fafafa;}
.input-area textarea:focus { border-color: #1890ff; background: #fff;}
.input-area button { padding: 0 25px; height: 40px; background: #1890ff; color: white; border: none; border-radius: 6px; cursor: pointer; font-size: 14px; font-weight: 500; transition: background 0.2s; margin-bottom: 10px;}
.input-area button:hover { background: #40a9ff; }
.input-area button:disabled { background: #ccc; cursor: not-allowed; }

.reply-tip { font-size: 13px; padding: 8px 25px; display: none; background: #fffbe6; border-bottom: 1px solid #ffe58f; color: #fa8c16; display: flex; justify-content: space-between;}
.reply-tip span.cancel { cursor: pointer; color: #1890ff; font-weight: 500;}

/* 👇 现代化弹窗与 Toast 提示组件 👇 */
.toast { position: fixed; top: 20px; left: 50%; transform: translateX(-50%) translateY(-20px); background: rgba(0,0,0,0.75); color: #fff; padding: 10px 20px; border-radius: 8px; font-size: 14px; z-index: 10000; opacity: 0; transition: all 0.3s cubic-bezier(0.68, -0.55, 0.27, 1.55); pointer-events: none; display: flex; align-items: center; gap: 8px; backdrop-filter: blur(4px);}
.toast.show { opacity: 1; transform: translateX(-50%) translateY(0); }
.toast.success { background: rgba(82, 196, 26, 0.9); }
.toast.error { background: rgba(255, 77, 79, 0.9); }

.modal-overlay { position: fixed; top: 0; left: 0; width: 100%; height: 100%; background: rgba(0,0,0,0.5); z-index: 10001; display: flex; justify-content: center; align-items: center; opacity: 0; pointer-events: none; transition: opacity 0.2s; backdrop-filter: blur(2px);}
.modal-overlay.show { opacity: 1; pointer-events: auto; }
.modal-box { background: #fff; border-radius: 12px; width: 320px; padding: 25px; box-shadow: 0 10px 30px rgba(0,0,0,0.2); transform: scale(0.9); transition: transform 0.2s cubic-bezier(0.175, 0.885, 0.32, 1.275); }
.modal-overlay.show .modal-box { transform: scale(1); }
.modal-title { font-size: 16px; font-weight: 600; margin-bottom: 15px; color: #333; }
.modal-content { font-size: 14px; color: #555; margin-bottom: 20px; line-height: 1.5; word-break: break-all;}
.modal-input { width: 100%; padding: 8px 12px; border: 1px solid #d9d9d9; border-radius: 6px; margin-bottom: 20px; outline: none; font-size: 14px; }
.modal-input:focus { border-color: #1890ff; }
.modal-btns { display: flex; justify-content: flex-end; gap: 10px; }
.modal-btn { padding: 8px 16px; border-radius: 6px; font-size: 14px; cursor: pointer; border: none; transition: 0.2s; }
.modal-btn.cancel { background: #f0f0f0; color: #333; }
.modal-btn.cancel:hover { background: #e0e0e0; }
.modal-btn.confirm { background: #1890ff; color: #fff; }
.modal-btn.confirm:hover { background: #40a9ff; }
.modal-btn.danger { background: #ff4d4f; color: #fff; }
.modal-btn.danger:hover { background: #ff7875; }
</style>
</head>
<body>
<div id="loading-page"><div class="spinner"></div><div>正在连接 QQ MsgBot...</div></div>

<div id="env-error-layer" class="error-layer">
<div class="error-box">
<h2>⚠️ 系统未就绪：缺少环境变量</h2>
<p>检测到以下必需的环境变量未配置：</p>
<span id="missing-envs" class="missing-list"></span>
<p><b>解决方法：</b></p>
<ol>
<li>前往 Cloudflare 控制台，进入当前 Worker 的 <b>Settings (设置) -> Variables (变量)</b>。</li>
<li>在 <b>Environment Variables (环境变量)</b> 处，点击 <b>Add variable (添加变量)</b>。</li>
<li>将上面缺失的变量名作为 Key，填入对应的值。</li>
<li>点击保存并刷新此页面。</li>
</ol>
</div>
</div>

<div id="db-error-layer" class="error-layer">
<div class="error-box">
<h2>⚠️ 系统未就绪：缺少 D1 或 KV</h2>
<p>检测到尚未绑定 Cloudflare D1 数据库或 KV。</p>
<p><b>解决方法：</b></p>
<ol>
<li>前往 Cloudflare 控制台，进入当前 Worker 的 <b>Settings (设置) -> Bindings (绑定)</b>。</li>
<li>添加 D1 Database，变量名填：<code>DB</code></li>
<li>添加 KV Namespace，变量名填：<code>BOT_KV</code></li>
<li>点击保存并刷新此页面。</li>
</ol>
</div>
</div>

<div id="login-page">
<div class="login-box">
<h2>🤖 QQ MsgBot 控制台</h2>
<input type="password" id="pwd" placeholder="请输入登录密码" onkeypress="if(event.key==='Enter') login()">
<button onclick="login()">立即登录</button>
</div>
</div>

<div id="app">
<div class="sidebar">
<div class="sidebar-header">💬 会话列表</div>
<div class="session-list" id="session-list"></div>
</div>
<div class="chat-area">
<div class="chat-header">
<span id="chat-title">请选择左侧会话</span>
<span style="font-size: 12px; color: #888; background: #f0f0f0; padding: 4px 10px; border-radius: 12px;">模式: <span id="mode-label">主动消息</span></span>
</div>

<div class="reply-tip" id="reply-tip">
<span id="tip-text">正在回复消息...</span> <span class="cancel" onclick="cancelReply()">✖ 取消</span>
</div>

<div class="messages" id="messages"></div>

<div class="input-area">
<textarea id="msg-input" placeholder="输入消息内容... (Enter 发送，Shift+Enter 换行)" onkeydown="if(event.key==='Enter'&&!event.shiftKey){event.preventDefault();sendMessage();}"></textarea>
<button onclick="sendMessage()">发送</button>
</div>
</div>
</div>

<!-- 👇 自定义 UI 组件容器 👇 -->
<div id="toast" class="toast"></div>

<div id="modal" class="modal-overlay">
<div class="modal-box">
<div class="modal-title" id="modal-title">提示</div>
<div class="modal-content" id="modal-content">内容</div>
<input type="text" id="modal-input" class="modal-input" style="display:none;">
<div class="modal-btns">
<button class="modal-btn cancel" id="modal-btn-cancel" onclick="closeModal(false)">取消</button>
<button class="modal-btn confirm" id="modal-btn-confirm" onclick="closeModal(true)">确定</button>
</div>
</div>
</div>

<script>
let token = localStorage.getItem('bot_token');
let expiresAt = localStorage.getItem('bot_expires_at');
let currentSession = null;
let replyToMsg = null;
let quoteToMsg = null;
let sessionsData = [];
let ws = null;
let modalResolve = null;

// ================= 自定义 UI 逻辑 =================
let toastTimeout = null;
function showToast(msg, type = 'info') {
  const el = document.getElementById('toast');
  el.innerText = msg;
  el.className = 'toast show ' + type;
  if (toastTimeout) clearTimeout(toastTimeout);
  toastTimeout = setTimeout(() => {
    el.classList.remove('show');
  }, 3000);
}

function showModal({ title = '提示', content = '', input = false, defaultValue = '', isDanger = false, showCancel = true }) {
  return new Promise((resolve) => {
    modalResolve = resolve;
    document.getElementById('modal-title').innerText = title;
    document.getElementById('modal-content').innerText = content;

    const inputEl = document.getElementById('modal-input');
    if (input) {
      inputEl.style.display = 'block';
      inputEl.value = defaultValue;
      setTimeout(() => inputEl.focus(), 100);
    } else {
      inputEl.style.display = 'none';
    }

    const cancelBtn = document.getElementById('modal-btn-cancel');
    cancelBtn.style.display = showCancel ? 'block' : 'none';

    const confirmBtn = document.getElementById('modal-btn-confirm');
    confirmBtn.className = 'modal-btn ' + (isDanger ? 'danger' : 'confirm');

    document.getElementById('modal').classList.add('show');

    // 支持回车确认
    if (input) {
      inputEl.onkeydown = (e) => { if (e.key === 'Enter') closeModal(true); };
    }
  });
}

function closeModal(result) {
  document.getElementById('modal').classList.remove('show');
  if (modalResolve) {
    if (result) {
      const inputEl = document.getElementById('modal-input');
      modalResolve(inputEl.style.display === 'block' ? inputEl.value : true);
    } else {
      modalResolve(false);
    }
    modalResolve = null;
  }
}

// ================= 核心业务逻辑 =================
function isTokenValid() {
  if (!token || !expiresAt) return false;
  if (Date.now() > parseInt(expiresAt)) {
    localStorage.removeItem('bot_token');
    localStorage.removeItem('bot_expires_at');
    return false;
  }
  return true;
}

function escapeHTML(str) {
  return String(str).replace(/[&<>'"]/g, tag => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;' }[tag] || tag));
}

function handleImgError(img) {
  const span = document.createElement('span');
  span.className = 'attachment-error';
  span.innerText = '[图片已过期]';
  img.replaceWith(span);
}

function checkFatalError(data) {
  if (!data) return false;
  if (data.error === 'ENV_MISSING') {
    document.getElementById('loading-page').style.display = 'none';
    document.getElementById('missing-envs').innerText = data.missing.join(', ');
    document.getElementById('env-error-layer').style.display = 'flex';
    if (ws) ws.close();
    return true;
  }
  if (data.error === 'DB_NOT_BOUND') {
    document.getElementById('loading-page').style.display = 'none';
    document.getElementById('db-error-layer').style.display = 'flex';
    if (ws) ws.close();
    return true;
  }
  return false;
}

async function checkSystemStatus() {
  try {
    const res = await fetch('/api/health');
    const data = await res.json();
    if (checkFatalError(data)) return;
    document.getElementById('loading-page').style.display = 'none';

    if (isTokenValid()) {
      showApp();
    } else {
      document.getElementById('login-page').style.display = 'flex';
    }
  } catch (e) {
    document.getElementById('loading-page').innerHTML = '<span style="color:red">无法连接到服务器，请刷新重试</span>';
  }
}

checkSystemStatus();

async function login() {
  const pwd = document.getElementById('pwd').value;
  try {
    const res = await fetch('/api/login', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ password: pwd }) });
    const data = await res.json();
    if (checkFatalError(data)) return;
    if (res.ok) {
      token = data.token;
      expiresAt = Date.now() + (data.expiresIn * 1000);
      localStorage.setItem('bot_token', token);
      localStorage.setItem('bot_expires_at', expiresAt.toString());

      document.getElementById('login-page').style.display = 'none';
      showApp();
    } else showToast(data.error || '密码错误', 'error');
  } catch (e) { showToast('网络请求失败', 'error'); }
}

function showApp() {
  document.getElementById('login-page').style.display = 'none';
  document.getElementById('app').style.display = 'flex';
  loadSessions();
  initWebSocket();

  setInterval(() => {
    if (!isTokenValid()) {
      showModal({ title: '登录已过期', content: '您的登录状态已过期，请重新登录。', showCancel: false })
      .then(() => location.reload());
    }
  }, 60000);
}

function initWebSocket() {
  if (ws) ws.close();
  const wsProtocol = window.location.protocol === 'https:' ? 'wss://' : 'ws://';
  ws = new WebSocket(wsProtocol + window.location.host + '/ws');
  ws.onmessage = (event) => {
    try {
      const data = JSON.parse(event.data);
      if (data.type === 'update') {
        loadSessions();
        if (currentSession && data.sessionId === currentSession.id) loadMessages(currentSession.id, true);
      }
    } catch (e) {}
  };
  ws.onclose = () => setTimeout(initWebSocket, 5000);
}

async function loadSessions() {
  if (!isTokenValid()) return;
  try {
    const res = await fetch('/api/sessions', { headers: { 'Authorization': 'Bearer ' + token } });
    const data = await res.json();
    if (checkFatalError(data)) return;
    if (res.status === 401) { location.reload(); return; }
    sessionsData = data;

    const listEl = document.getElementById('session-list');
    listEl.innerHTML = sessionsData.map(s => \`
    <div class="session-item \${currentSession?.id === s.id ? 'active' : ''}" onclick="selectSession('\${escapeHTML(s.id)}')">
    <div class="session-name">\${s.is_group ? '👥 群聊' : '👤 私聊'}</div>
    <div class="session-preview">\${escapeHTML(s.last_message || '暂无消息')}</div>
    <span class="delete-session-btn" onclick="event.stopPropagation(); deleteSession('\${escapeHTML(s.id)}')">🗑️</span>
    </div>
    \`).join('');
  } catch (e) {}
}

async function deleteSession(id) {
  const confirmed = await showModal({ title: '删除会话', content: '确定要删除该会话及其所有本地消息记录吗？', isDanger: true });
  if (!confirmed) return;

  try {
    const res = await fetch('/api/delete_session', {
      method: 'POST',
      headers: { 'Authorization': 'Bearer ' + token, 'Content-Type': 'application/json' },
      body: JSON.stringify({ sessionId: id })
    });
    if (!res.ok) throw new Error('删除失败');
    if (currentSession?.id === id) {
      currentSession = null;
      document.getElementById('messages').innerHTML = '';
      document.getElementById('chat-title').innerText = '请选择左侧会话';
    }
    loadSessions();
    showToast('删除成功', 'success');
  } catch (e) { showToast(e.message, 'error'); }
}

async function selectSession(id) {
  if (currentSession?.id === id) return;
  currentSession = sessionsData.find(s => s.id === id);
  document.getElementById('chat-title').innerText = (currentSession.is_group ? '👥 群聊' : '👤 私聊') + ' - ' + id;
  cancelReply();
  document.getElementById('messages').dataset.count = -1;
  await loadMessages(id, false);
  loadSessions();
}

async function loadMessages(sessionId, isPush) {
  if (!isTokenValid()) return;
  try {
    const res = await fetch(\`/api/messages?id=\${sessionId}\`, { headers: { 'Authorization': 'Bearer ' + token } });
    const msgs = await res.json();
    if (checkFatalError(msgs)) return;

    const msgEl = document.getElementById('messages');
    if (msgEl.dataset.count == msgs.length) return;
    msgEl.dataset.count = msgs.length;

    const now = Date.now();
    msgEl.innerHTML = msgs.map(m => {
      if (m.type === 'system') {
        return \`<div class="msg system"><div class="msg-system-text">\${escapeHTML(m.content)}</div></div>\`;
      }

      const isOut = m.type === 'outgoing';
      const isGroup = currentSession.is_group === 1;
      const isWithin2Mins = (now - m.timestamp) < 2 * 60 * 1000;
      const isWithin5Mins = (now - m.timestamp) < 5 * 60 * 1000;

      const showRecallBtn = (isOut && isWithin2Mins) || (!isOut && isGroup && isWithin2Mins);
      const showReplyBtn = !isOut && isWithin5Mins;
      const showGroupOps = !isOut && isGroup;

      let authorName = '';
      if (isOut) {
        authorName = isGroup ? (currentSession.bot_openid || 'Bot (ID未知)') : 'Bot';
      } else {
        authorName = m.author_name || '用户';
      }

      let quoteHtml = '';
      if (m.quote_content) {
        quoteHtml = \`<div class="quote-box">\${escapeHTML(m.quote_content)}</div>\`;
      }

      let attachmentsHtml = '';
      if (m.attachments) {
        try {
          const atts = JSON.parse(m.attachments);
          atts.forEach(att => {
            if (att.error) {
              attachmentsHtml += \`<div><span class="attachment-error">[\${escapeHTML(att.error)}]</span></div>\`;
            } else if (att.content_type && att.content_type.startsWith('image/')) {
              attachmentsHtml += \`<div class="attachment-img-box">
              <img src="\${escapeHTML(att.url)}" class="chat-img"
              onerror="handleImgError(this)"
              onclick="window.open('\${escapeHTML(att.url)}')" />
              </div>\`;
            } else if (att.content_type && (att.content_type.includes('voice') || att.content_type === 'voice')) {
              attachmentsHtml += \`<div><a href="\${escapeHTML(att.url)}" target="_blank" class="attachment-link">🎤 语音播放</a></div>\`;
            } else {
              attachmentsHtml += \`<div><span class="attachment-error">[不支持的文件]</span></div>\`;
            }
          });
        } catch (e) {}
      }

      return \`
      <div class="msg \${isOut ? 'outgoing' : 'incoming'}">
      <div class="msg-author">\${escapeHTML(authorName)}</div>
      <div class="msg-bubble">
      \${quoteHtml}
      \${m.content ? escapeHTML(m.content) : ''}
      \${attachmentsHtml}
      </div>
      <div class="msg-meta">
      <span>\${new Date(m.timestamp).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}</span>
      \${isOut && m.is_passive ? '<span style="color:#52c41a">(被动)</span>' : ''}
      \${showRecallBtn ? \`<span class="action-btn" title="撤回消息" onclick="recallMessage('\${escapeHTML(m.msg_id)}')">🗑️</span>\` : ''}
      \${showReplyBtn ? \`<span class="action-btn" title="回复" onclick="startReply('\${escapeHTML(m.msg_id)}', '\${escapeHTML(m.author_name)}')">↩️</span>\` : ''}
      <span class="action-btn" title="引用" onclick="startQuote('\${escapeHTML(m.msg_id)}', '\${escapeHTML(m.content)}')">💬</span>
      \${showGroupOps ? \`<span class="action-btn" title="@他" onclick="insertAtTag('\${escapeHTML(m.author_name)}')">@</span>\` : ''}
      \${showGroupOps ? \`<span class="action-btn" title="禁言" onclick="muteMember('\${escapeHTML(m.author_name)}')">🔇</span>\` : ''}
      \${showGroupOps ? \`<span class="action-btn" title="踢出" onclick="kickMember('\${escapeHTML(m.author_name)}')">👢</span>\` : ''}
      </div>
      </div>
      \`;
    }).join('');

    const isNearBottom = msgEl.scrollHeight - msgEl.scrollTop - msgEl.clientHeight < 150;
    if (!isPush || isNearBottom) {
      setTimeout(() => { msgEl.scrollTop = msgEl.scrollHeight; }, 0);
    }
  } catch (e) { console.error(e); }
}

function startQuote(msgId, content) {
  quoteToMsg = { msgId, content };
  document.getElementById('mode-label').innerText = '引用消息';
  document.getElementById('reply-tip').style.display = 'flex';
  document.getElementById('tip-text').innerText = '正在引用: ' + (content || '[非文本]').substring(0, 20) + '...';
  document.getElementById('msg-input').focus();
}

function insertAtTag(authorId) {
  if (!authorId || authorId === '未知用户') return;
  const inputEl = document.getElementById('msg-input');
  const tag = \`<qqbot-at-user id="\${authorId}" /> \`;
  if (!inputEl.value.includes(tag)) {
    inputEl.value += tag;
  }
  inputEl.focus();
}

function startReply(msgId, authorName) {
  replyToMsg = msgId;
  quoteToMsg = null;
  document.getElementById('mode-label').innerText = '被动回复';
  document.getElementById('reply-tip').style.display = 'flex';
  document.getElementById('tip-text').innerText = '正在回复消息...';
  document.getElementById('msg-input').focus();
}

function cancelReply() {
  replyToMsg = null;
  quoteToMsg = null;
  document.getElementById('mode-label').innerText = '主动消息';
  document.getElementById('reply-tip').style.display = 'none';
}

async function recallMessage(msgId) {
  const confirmed = await showModal({ title: '撤回消息', content: '确定要撤回这条消息吗？', isDanger: true });
  if (!confirmed) return;

  try {
    const res = await fetch('/api/recall', {
      method: 'POST',
      headers: { 'Authorization': 'Bearer ' + token, 'Content-Type': 'application/json' },
      body: JSON.stringify({ sessionId: currentSession.id, isGroup: currentSession.is_group === 1, messageId: msgId })
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error);
    document.getElementById('messages').dataset.count = -1;
    loadMessages(currentSession.id, false);
    showToast('撤回成功', 'success');
  } catch (e) {
    showModal({ title: '撤回失败', content: e.message, showCancel: false });
  }
}

async function muteMember(memberOpenid) {
  const mins = await showModal({
    title: '禁言成员',
    content: \`请输入要禁言用户 \${memberOpenid} 的分钟数：\`,
    input: true,
    defaultValue: '10'
  });

  if (!mins) return;
  const durationMins = parseInt(mins, 10);
  if (isNaN(durationMins) || durationMins <= 0) return showToast('请输入有效的分钟数', 'error');

  try {
    const res = await fetch('/api/mute', {
      method: 'POST',
      headers: { 'Authorization': 'Bearer ' + token, 'Content-Type': 'application/json' },
      body: JSON.stringify({ groupOpenid: currentSession.id, memberOpenid: memberOpenid, durationMins: durationMins })
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error);
    showToast(\`禁言成功，时长 \${durationMins} 分钟\`, 'success');
  } catch (e) {
    showModal({ title: '禁言失败', content: e.message, showCancel: false });
  }
}

async function kickMember(memberOpenid) {
  const confirmed = await showModal({
    title: '踢出群聊',
    content: \`确定要将用户 \${memberOpenid} 踢出群聊吗？\`,
    isDanger: true
  });
  if (!confirmed) return;

  const addToBlacklist = await showModal({
    title: '加入黑名单',
    content: '是否同时将该用户加入群黑名单？',
    isDanger: true
  });

  try {
    const res = await fetch('/api/kick', {
      method: 'POST',
      headers: { 'Authorization': 'Bearer ' + token, 'Content-Type': 'application/json' },
      body: JSON.stringify({ groupOpenid: currentSession.id, memberOpenid: memberOpenid, addToBlacklist: !!addToBlacklist })
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error);
    showToast('踢人操作成功', 'success');
  } catch (e) {
    showModal({ title: '踢人失败', content: e.message, showCancel: false });
  }
}

async function sendMessage() {
  if (!currentSession) return showToast('请先选择会话', 'error');
  if (!isTokenValid()) return showToast('登录已过期', 'error');

  const content = document.getElementById('msg-input').value.trim();
  if (!content) return;

  const body = { sessionId: currentSession.id, isGroup: currentSession.is_group === 1, content: content };
  if (replyToMsg) {
    body.msgId = replyToMsg;
    body.msgSeq = Math.floor(Math.random() * 100) + 1;
  }
  if (quoteToMsg) {
    body.quoteMsgId = quoteToMsg.msgId;
    body.quoteContent = quoteToMsg.content;
  }

  document.getElementById('msg-input').value = '';
  const btn = document.querySelector('.input-area button');
  btn.disabled = true; btn.innerText = '发送中...';

  try {
    const res = await fetch('/api/send', {
      method: 'POST',
      headers: { 'Authorization': 'Bearer ' + token, 'Content-Type': 'application/json' },
      body: JSON.stringify(body)
    });
    const data = await res.json();
    if (checkFatalError(data)) return;
    if (!res.ok) throw new Error(data.error);
    cancelReply();
  } catch (e) {
    showToast(e.message, 'error');
    // 如果发送失败，把内容还回输入框
    if (!document.getElementById('msg-input').value) {
      document.getElementById('msg-input').value = content;
    }
  } finally {
    btn.disabled = false; btn.innerText = '发送';
  }
}
</script>
</body>
</html>
`;
