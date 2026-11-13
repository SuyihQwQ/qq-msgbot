export const FRONTEND_HTML = `
<!DOCTYPE html>
<html lang="zh-CN">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no">
<title>QQ MsgBot 控制台</title>
<style>
* { box-sizing: border-box; margin: 0; padding: 0; -webkit-tap-highlight-color: transparent; }
body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif; background: #e9ecef; height: 100vh; display: flex; color: #333; overflow: hidden; }

/* 通用 Toast */
.toast { position: fixed; top: 20px; left: 50%; transform: translateX(-50%) translateY(-20px); background: rgba(0,0,0,0.8); color: #fff; padding: 10px 20px; border-radius: 8px; font-size: 14px; z-index: 10000; opacity: 0; transition: all 0.3s cubic-bezier(0.68, -0.55, 0.27, 1.55); pointer-events: none; display: flex; align-items: center; gap: 8px; backdrop-filter: blur(4px);}
.toast.show { opacity: 1; transform: translateX(-50%) translateY(0); }
.toast.success { background: rgba(82, 196, 26, 0.95); }
.toast.error { background: rgba(255, 77, 79, 0.95); }

/* Loading 与 错误 */
#loading-page { display: flex; width: 100%; height: 100%; justify-content: center; align-items: center; font-size: 15px; color: #666; flex-direction: column; gap: 12px;}
.spinner { width: 36px; height: 36px; border: 3px solid #d9d9d9; border-top-color: #1890ff; border-radius: 50%; animation: spin 0.8s linear infinite; }
@keyframes spin { to { transform: rotate(360deg); } }

#login-page { display: none; width: 100%; height: 100%; justify-content: center; align-items: center; background: #f0f2f5; padding: 20px;}
.login-box { background: white; padding: 40px 30px; border-radius: 12px; box-shadow: 0 8px 24px rgba(0,0,0,0.08); width: 100%; max-width: 320px; }
.login-box h2 { text-align: center; margin-bottom: 25px; font-weight: 600; color: #1a1a1a; }
.login-box input { width: 100%; padding: 12px 15px; margin-bottom: 20px; border: 1px solid #d9d9d9; border-radius: 8px; font-size: 14px; outline: none; transition: border-color 0.2s;}
.login-box input:focus { border-color: #1890ff; }
.login-box button { width: 100%; padding: 12px; background: #1890ff; color: white; border: none; border-radius: 8px; font-size: 15px; cursor: pointer; transition: background 0.2s;}

/* 主界面 */
#app { display: none; width: 100%; height: 100%; background: white; position: relative; }

/* 移动端 Header */
.mobile-header { display: none; height: 50px; background: #fff; border-bottom: 1px solid #e8e8e8; align-items: center; padding: 0 15px; justify-content: space-between; flex-shrink: 0;}
.menu-btn { background: none; border: none; font-size: 20px; cursor: pointer; padding: 5px; color: #333;}

/* 侧边栏 */
.sidebar { width: 300px; background: #f7f9fa; border-right: 1px solid #e8e8e8; display: flex; flex-direction: column; transition: transform 0.3s ease; flex-shrink: 0; z-index: 100;}
.sidebar-header { padding: 20px 15px; border-bottom: 1px solid #e8e8e8; font-weight: 600; font-size: 18px; background: #fff; color: #1a1a1a; display: flex; align-items: center; gap: 8px;}
.session-list { flex: 1; overflow-y: auto; padding: 10px; }
.session-item { padding: 12px 15px; border-radius: 8px; cursor: pointer; transition: all 0.2s; position: relative; margin-bottom: 5px; background: #fff; border: 1px solid transparent;}
.session-item:hover, .session-item.active { background: #e6f7ff; border-color: #91d5ff;}

.session-name { font-weight: 600; margin-bottom: 4px; font-size: 14px; color: #333; padding-right: 30px;}
/* 👇 新增：专门用于显示长 ID 的样式 */
.session-id { font-size: 11px; color: #888; margin-bottom: 6px; word-break: break-all; line-height: 1.2;}

.session-preview { font-size: 12px; color: #999; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.delete-session-btn { position: absolute; right: 10px; top: 12px; font-size: 14px; cursor: pointer; opacity: 0; transition: opacity 0.2s; color: #ff4d4f; padding: 4px;}
.session-item:hover .delete-session-btn { opacity: 1; }
.session-item.active { background: #e6f7ff; border-left: 4px solid #1890ff; padding-left: 11px;}

/* 侧边栏遮罩（移动端） */
.sidebar-overlay { display: none; position: fixed; top: 0; left: 0; width: 100%; height: 100%; background: rgba(0,0,0,0.5); z-index: 99; opacity: 0; transition: opacity 0.3s;}

/* 聊天区 */
.chat-area { flex: 1; display: flex; flex-direction: column; background: #f0f2f5; position: relative; min-width: 0;}
.chat-header { padding: 15px 20px; border-bottom: 1px solid #e8e8e8; font-weight: 600; display: flex; justify-content: space-between; align-items: center; background: #fff; color: #1a1a1a; z-index: 10; flex-shrink: 0;}
.messages { flex: 1; overflow-y: auto; padding: 20px; display: flex; flex-direction: column; scroll-behavior: smooth;}

/* 气泡 */
.msg { margin-bottom: 20px; display: flex; flex-direction: column; max-width: 85%; }
.msg.incoming { align-self: flex-start; }
.msg.outgoing { align-self: flex-end; align-items: flex-end; }
.msg-author { font-size: 12px; color: #999; margin-bottom: 6px; padding: 0 4px; word-break: break-all;}
.msg-bubble { padding: 12px 16px; border-radius: 12px; font-size: 14px; line-height: 1.5; word-wrap: break-word; position: relative; box-shadow: 0 1px 2px rgba(0,0,0,0.05);}
.msg.incoming .msg-bubble { background: #fff; color: #333; border-top-left-radius: 2px;}
.msg.outgoing .msg-bubble { background: #1890ff; color: #fff; border-top-right-radius: 2px;}

/* 系统消息与引用 */
.msg.system { align-self: center; align-items: center; max-width: 90%; margin: 15px 0;}
.msg-system-text { font-size: 12px; color: #888; background: rgba(0,0,0,0.05); padding: 4px 12px; border-radius: 12px; text-align: center; }
.quote-box { background: rgba(0,0,0,0.04); border-left: 3px solid #ccc; padding: 6px 10px; margin-bottom: 10px; font-size: 12px; color: #666; border-radius: 4px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;}
.msg.outgoing .quote-box { background: rgba(255,255,255,0.15); border-left-color: #fff; color: rgba(255,255,255,0.85); }

/* 操作区 */
.msg-meta { font-size: 12px; color: #b3b3b3; margin-top: 6px; display: flex; align-items: center; gap: 8px; flex-wrap: wrap; opacity: 0; transition: opacity 0.2s;}
.msg:hover .msg-meta { opacity: 1; }
/* 移动端直接显示操作栏 */
@media (hover: none) { .msg-meta { opacity: 1; } }
.msg.outgoing .msg-meta { justify-content: flex-end; }

.action-btn { cursor: pointer; padding: 2px 6px; border-radius: 4px; background: #fff; border: 1px solid #e8e8e8; transition: all 0.2s; font-size: 13px; box-shadow: 0 1px 2px rgba(0,0,0,0.03); user-select: none;}
.action-btn:hover { background: #f0f0f0; }
.msg.outgoing .action-btn { background: rgba(255,255,255,0.2); border: none; color: #fff; }

/* 附件 */
.attachment-img-box { margin-top: 8px; max-width: 100%; }
.chat-img { max-width: 200px; max-height: 200px; border-radius: 8px; cursor: pointer; object-fit: cover; display: block;}
.attachment-error { display: inline-block; font-size: 12px; color: #999; background: #f5f5f5; padding: 4px 8px; border-radius: 4px; margin-top: 5px;}
.attachment-link { display: inline-flex; align-items: center; gap: 6px; margin-top: 8px; padding: 8px 14px; background: #fff; border-radius: 6px; color: #1890ff; text-decoration: none; font-size: 13px; border: 1px solid #e8e8e8;}
.msg.outgoing .attachment-link { background: rgba(255,255,255,0.15); border-color: transparent; color: #fff;}

/* 输入区 */
.input-area { padding: 10px 15px; background: #fff; border-top: 1px solid #e8e8e8; display: flex; gap: 10px; align-items: flex-end; flex-shrink: 0;}
.input-area textarea { flex: 1; height: 50px; padding: 12px; border: 1px solid #d9d9d9; border-radius: 8px; resize: none; font-size: 14px; font-family: inherit; outline: none; background: #fafafa;}
.input-area textarea:focus { border-color: #1890ff; background: #fff;}
.input-area button { padding: 0 20px; height: 40px; background: #1890ff; color: white; border: none; border-radius: 6px; cursor: pointer; font-size: 14px; font-weight: 500; margin-bottom: 5px;}

.reply-tip { font-size: 13px; padding: 8px 15px; display: none; background: #fffbe6; border-bottom: 1px solid #ffe58f; color: #fa8c16; justify-content: space-between;}
.reply-tip span.cancel { cursor: pointer; color: #1890ff; font-weight: 500;}

/* 弹窗组件 */
.modal-overlay { position: fixed; top: 0; left: 0; width: 100%; height: 100%; background: rgba(0,0,0,0.5); z-index: 10001; display: flex; justify-content: center; align-items: center; opacity: 0; pointer-events: none; transition: opacity 0.2s; backdrop-filter: blur(2px);}
.modal-overlay.show { opacity: 1; pointer-events: auto; }
.modal-box { background: #fff; border-radius: 12px; width: 90%; max-width: 400px; padding: 25px; box-shadow: 0 10px 30px rgba(0,0,0,0.2); transform: scale(0.9); transition: transform 0.2s cubic-bezier(0.175, 0.885, 0.32, 1.275); }
.modal-overlay.show .modal-box { transform: scale(1); }
.modal-title { font-size: 16px; font-weight: 600; margin-bottom: 15px; color: #333; }
.modal-content { font-size: 14px; color: #555; margin-bottom: 20px; line-height: 1.5; word-break: break-all;}

.modal-input { width: 100%; padding: 10px; border: 1px solid #d9d9d9; border-radius: 8px; margin-bottom: 20px; outline: none; font-size: 15px; }
.modal-btns { display: flex; justify-content: flex-end; gap: 10px; flex-wrap: wrap;}
.modal-btn { padding: 8px 16px; border-radius: 6px; font-size: 14px; cursor: pointer; border: none; transition: 0.2s; }
.modal-btn.cancel { background: #f0f0f0; color: #333; }
.modal-btn.confirm { background: #1890ff; color: #fff; }
.modal-btn.danger { background: #ff4d4f; color: #fff; }
.modal-btn.success { background: #52c41a; color: #fff; }

/* 禁言管理专属面板 */
.mute-status-box { background: #f8f9fa; border-radius: 8px; padding: 15px; margin-bottom: 20px; border: 1px solid #e8e8e8; }
.mute-status-text { font-size: 14px; font-weight: bold; margin-bottom: 5px; }
.mute-status-desc { font-size: 12px; color: #888; }
.mute-actions { display: flex; gap: 10px; margin-bottom: 10px; flex-wrap: wrap;}
.mute-chip { padding: 6px 12px; background: #e6f7ff; color: #1890ff; border: 1px solid #91d5ff; border-radius: 16px; font-size: 13px; cursor: pointer;}
.mute-chip.active { background: #1890ff; color: #fff; }

/* 响应式 (手机端) */
@media (max-width: 768px) {
  #app { flex-direction: column; }
  .mobile-header { display: flex; }
  .sidebar { position: fixed; top: 0; left: 0; height: 100%; transform: translateX(-100%); width: 280px; box-shadow: 2px 0 10px rgba(0,0,0,0.1);}
  .sidebar.open { transform: translateX(0); }
  .sidebar-overlay.open { display: block; opacity: 1; }
  .chat-header { padding: 12px 15px; font-size: 14px;}
  .messages { padding: 15px; }
  .msg { max-width: 90%; }
  .input-area { padding: 10px; gap: 8px;}
  .input-area textarea { height: 45px; padding: 10px; font-size: 14px;}
  .modal-box { padding: 20px; }
}
</style>
</head>
<body>
<div id="loading-page"><div class="spinner"></div><div>正在连接...</div></div>

<div id="login-page">
<div class="login-box">
<h2>🤖 MsgBot</h2>
<input type="password" id="pwd" placeholder="请输入登录密码" onkeypress="if(event.key==='Enter') login()">
<button onclick="login()">立即登录</button>
</div>
</div>

<div id="app">
<!-- 移动端顶栏 -->
<div class="mobile-header">
<button class="menu-btn" onclick="toggleSidebar()">☰</button>
<span id="mobile-title" style="font-weight: 600; font-size: 15px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;">请选择会话</span>
<div style="width: 30px;"></div>
</div>

<!-- 侧边栏遮罩 -->
<div class="sidebar-overlay" id="sidebar-overlay" onclick="toggleSidebar()"></div>

<!-- 侧边栏 -->
<div class="sidebar" id="sidebar">
<div class="sidebar-header">💬 会话列表</div>
<div class="session-list" id="session-list"></div>
</div>

<!-- 聊天区 -->
<div class="chat-area">
<div class="chat-header">
<span id="chat-title" style="display: none;">请选择</span>
<span style="font-size: 12px; color: #888;">模式: <span id="mode-label">主动</span></span>
</div>
<div class="reply-tip" id="reply-tip">
<span id="tip-text">正在回复...</span> <span class="cancel" onclick="cancelReply()">✖ 取消</span>
</div>
<div class="messages" id="messages"></div>
<div class="input-area">
<textarea id="msg-input" placeholder="输入消息..." onkeydown="if(event.key==='Enter'&&!event.shiftKey){event.preventDefault();sendMessage();}"></textarea>
<button onclick="sendMessage()">发送</button>
</div>
</div>
</div>

<!-- 通用弹窗 -->
<div id="modal" class="modal-overlay">
<div class="modal-box" id="modal-box">
<div class="modal-title" id="modal-title">提示</div>
<div class="modal-content" id="modal-content">内容</div>
<input type="text" id="modal-input" class="modal-input" style="display:none;">
<div class="modal-btns" id="modal-btns"></div>
</div>
</div>

<div id="toast" class="toast"></div>

<script>
let token = localStorage.getItem('bot_token');
let expiresAt = localStorage.getItem('bot_expires_at');
let currentSession = null;
let replyToMsg = null;
let quoteToMsg = null;
let sessionsData = [];
let ws = null;

// ================= UI 基础 =================
function toggleSidebar() {
  document.getElementById('sidebar').classList.toggle('open');
  document.getElementById('sidebar-overlay').classList.toggle('open');
}

let toastTimeout = null;
function showToast(msg, type = 'info') {
  const el = document.getElementById('toast');
  el.innerText = msg;
  el.className = 'toast show ' + type;
  if (toastTimeout) clearTimeout(toastTimeout);
  toastTimeout = setTimeout(() => el.classList.remove('show'), 3000);
}

function showModal({ title, html, inputs, buttons }) {
  return new Promise((resolve) => {
    document.getElementById('modal-title').innerText = title;
    document.getElementById('modal-content').innerHTML = html;

    const btnContainer = document.getElementById('modal-btns');
    btnContainer.innerHTML = '';

    buttons.forEach(btn => {
      const b = document.createElement('button');
      b.className = 'modal-btn ' + (btn.type || 'confirm');
      b.innerText = btn.text;
      b.onclick = () => {
        document.getElementById('modal').classList.remove('show');
        resolve(btn.value);
      };
      btnContainer.appendChild(b);
    });

    document.getElementById('modal').classList.add('show');
  });
}

function closeModal() { document.getElementById('modal').classList.remove('show'); }

// ================= 基础逻辑 =================
function isTokenValid() {
  if (!token || !expiresAt) return false;
  if (Date.now() > parseInt(expiresAt)) return false;
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

async function checkSystemStatus() {
  try {
    const res = await fetch('/api/health');
    const data = await res.json();
    document.getElementById('loading-page').style.display = 'none';

    if (isTokenValid()) {
      showApp();
    } else {
      document.getElementById('login-page').style.display = 'flex';
    }
  } catch (e) {
    document.getElementById('loading-page').innerHTML = '<span style="color:red">连接失败，请刷新</span>';
  }
}

checkSystemStatus();

async function login() {
  const pwd = document.getElementById('pwd').value;
  const res = await fetch('/api/login', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ password: pwd }) });
  const data = await res.json();
  if (res.ok) {
    token = data.token;
    expiresAt = Date.now() + (data.expiresIn * 1000);
    localStorage.setItem('bot_token', token);
    localStorage.setItem('bot_expires_at', expiresAt.toString());
    document.getElementById('login-page').style.display = 'none';
    showApp();
  } else showToast(data.error || '密码错误', 'error');
}

function showApp() {
  document.getElementById('login-page').style.display = 'none';
  document.getElementById('app').style.display = 'flex';
  loadSessions();
  initWebSocket();
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

// ================= 会话列表 =================
async function loadSessions() {
  if (!isTokenValid()) return;
  const res = await fetch('/api/sessions', { headers: { 'Authorization': 'Bearer ' + token } });
  if (res.status === 401) { localStorage.clear(); location.reload(); return; }
  sessionsData = await res.json();

  const listEl = document.getElementById('session-list');
  // 👇 修复：将会话 ID 直接展示在名称下方
  listEl.innerHTML = sessionsData.map(s => \`
  <div class="session-item \${currentSession?.id === s.id ? 'active' : ''}" onclick="selectSession('\${escapeHTML(s.id)}')">
  <div class="session-name">\${s.is_group ? '👥 群聊' : '👤 私聊'}</div>
  <div class="session-id">\${escapeHTML(s.id)}</div>
  <div class="session-preview">\${escapeHTML(s.last_message || '暂无消息')}</div>
  <span class="delete-session-btn" onclick="event.stopPropagation(); deleteSession('\${escapeHTML(s.id)}')">🗑️</span>
  </div>
  \`).join('');
}

async function selectSession(id) {
  if (currentSession?.id === id) {
    if (window.innerWidth <= 768) toggleSidebar();
    return;
  }
  currentSession = sessionsData.find(s => s.id === id);
  const titleText = (currentSession.is_group ? '👥 群聊' : '👤 私聊') + ' - ' + id;
  document.getElementById('chat-title').innerText = titleText;
  document.getElementById('mobile-title').innerText = titleText;

  cancelReply();
  document.getElementById('messages').dataset.count = -1;
  await loadMessages(id, false);
  loadSessions();

  if (window.innerWidth <= 768) toggleSidebar();
}

async function deleteSession(id) {
  const resVal = await showModal({
    title: '删除会话',
    html: '确定要删除该会话及记录吗？',
    buttons: [{ text: '取消', value: false, type: 'cancel' }, { text: '删除', value: true, type: 'danger' }]
  });
  if (!resVal) return;
  await fetch('/api/delete_session', { method: 'POST', headers: { 'Authorization': 'Bearer ' + token, 'Content-Type': 'application/json' }, body: JSON.stringify({ sessionId: id }) });
  if (currentSession?.id === id) { currentSession = null; document.getElementById('messages').innerHTML = ''; document.getElementById('chat-title').innerText = '请选择'; }
  loadSessions();
}

// ================= 消息列表渲染 =================
async function loadMessages(sessionId, isPush) {
  if (!isTokenValid()) return;
  const res = await fetch(\`/api/messages?id=\${sessionId}\`, { headers: { 'Authorization': 'Bearer ' + token } });
  const msgs = await res.json();

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

    let authorName = isOut ? (isGroup ? (currentSession.bot_openid || 'Bot') : 'Bot') : (m.author_name || '用户');
    let quoteHtml = m.quote_content ? \`<div class="quote-box">\${escapeHTML(m.quote_content)}</div>\` : '';

    let attHtml = '';
    if (m.attachments) {
      try {
        JSON.parse(m.attachments).forEach(att => {
          if (att.error) attHtml += \`<div><span class="attachment-error">[\${escapeHTML(att.error)}]</span></div>\`;
          else if (att.content_type?.startsWith('image/')) attHtml += \`<img src="\${escapeHTML(att.url)}" class="chat-img" onerror="handleImgError(this)" onclick="window.open('\${escapeHTML(att.url)}')" />\`;
          else attHtml += \`<a href="\${escapeHTML(att.url)}" target="_blank" class="attachment-link">🎤 [语音/文件]</a>\`;
        });
      } catch (e) {}
    }

    return \`
    <div class="msg \${isOut ? 'outgoing' : 'incoming'}">
    <div class="msg-author">\${escapeHTML(authorName)}</div>
    <div class="msg-bubble">
    \${quoteHtml}
    \${m.content ? escapeHTML(m.content) : ''}
    \${attHtml}
    </div>
    <div class="msg-meta">
    <span>\${new Date(m.timestamp).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}</span>
    \${showRecallBtn ? \`<span class="action-btn" onclick="recallMessage('\${escapeHTML(m.msg_id)}')">🗑️</span>\` : ''}
    \${showReplyBtn ? \`<span class="action-btn" onclick="startReply('\${escapeHTML(m.msg_id)}')">↩️</span>\` : ''}
    <span class="action-btn" onclick="startQuote('\${escapeHTML(m.msg_id)}', '\${escapeHTML(m.content)}')">💬</span>
    \${showGroupOps ? \`<span class="action-btn" onclick="insertAtTag('\${escapeHTML(m.author_name)}')">@</span>\` : ''}
    \${showGroupOps ? \`<span class="action-btn" onclick="openMutePanel('\${escapeHTML(m.author_name)}')">🔇 禁言</span>\` : ''}
    \${showGroupOps ? \`<span class="action-btn" onclick="kickMember('\${escapeHTML(m.author_name)}')">👢</span>\` : ''}
    </div>
    </div>
    \`;
  }).join('');

  const isNearBottom = msgEl.scrollHeight - msgEl.scrollTop - msgEl.clientHeight < 150;
  if (!isPush || isNearBottom) setTimeout(() => { msgEl.scrollTop = msgEl.scrollHeight; }, 0);
}

// ================= 禁言管理专属面板 =================
async function openMutePanel(memberOpenid) {
  const loadingHtml = \`
  <div class="mute-status-box">
  <div class="mute-status-text" style="color:#1890ff">正在查询禁言状态...</div>
  </div>
  <div class="modal-btns"><button class="modal-btn cancel" onclick="closeModal()">关闭</button></div>
  \`;
  showModal({ title: \`管理成员: \${memberOpenid}\`, html: loadingHtml, buttons: [] });

  try {
    const res = await fetch(\`/api/mute_status?group_id=\${currentSession.id}&member_id=\${memberOpenid}\`, {
      headers: { 'Authorization': 'Bearer ' + token }
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || '查询失败');

    let statusHtml = '';
    let btns = [{ text: '关闭', value: null, type: 'cancel' }];

    if (data.isMuted) {
      statusHtml = \`
      <div class="mute-status-box">
      <div class="mute-status-text" style="color:#ff4d4f">🔇 当前状态：已禁言</div>
      <div class="mute-status-desc">到期时间：\${new Date(data.expireAt).toLocaleString()}</div>
      </div>
      \`;
      btns.unshift({ text: '解除禁言', value: 'unmute', type: 'success' });
    } else {
      statusHtml = \`
      <div class="mute-status-box">
      <div class="mute-status-text" style="color:#52c41a">🔊 当前状态：未禁言</div>
      </div>
      <div style="margin-bottom: 10px; font-size: 14px;">选择禁言时长：</div>
      <div class="mute-actions">
      <div class="mute-chip" onclick="selectMuteTime(this, 10)">10分钟</div>
      <div class="mute-chip" onclick="selectMuteTime(this, 60)">1小时</div>
      <div class="mute-chip" onclick="selectMuteTime(this, 1440)">1天</div>
      </div>
      <input type="number" id="custom-mute-mins" class="modal-input" placeholder="自定义分钟数" style="margin-top:10px;">
      \`;
      btns.unshift({ text: '确认禁言', value: 'mute', type: 'danger' });
    }

    const action = await showModal({ title: \`成员: \${memberOpenid}\`, html: statusHtml, buttons: btns });

    if (action === 'unmute') {
      const req = await fetch('/api/unmute', {
        method: 'POST', headers: { 'Authorization': 'Bearer ' + token, 'Content-Type': 'application/json' },
        body: JSON.stringify({ groupOpenid: currentSession.id, memberOpenid: memberOpenid })
      });
      if (req.ok) showToast('解除禁言成功', 'success');
      else showToast('解除禁言失败', 'error');
    } else if (action === 'mute') {
      let mins = parseInt(document.getElementById('custom-mute-mins').value);
      const activeChip = document.querySelector('.mute-chip.active');
      if (!mins && activeChip) mins = parseInt(activeChip.dataset.mins);

      if (!mins || mins <= 0) return showToast('请输入或选择有效的时长', 'error');

      const req = await fetch('/api/mute', {
        method: 'POST', headers: { 'Authorization': 'Bearer ' + token, 'Content-Type': 'application/json' },
        body: JSON.stringify({ groupOpenid: currentSession.id, memberOpenid: memberOpenid, durationMins: mins })
      });
      if (req.ok) showToast('禁言成功', 'success');
      else showToast('禁言失败', 'error');
    }
  } catch (err) {
    showModal({ title: '错误', html: \`<div style="color:red;margin-bottom:15px">\${err.message}</div>\`, buttons: [{ text: '关闭', value: null, type: 'cancel' }] });
  }
}

window.selectMuteTime = function(el, mins) {
  document.querySelectorAll('.mute-chip').forEach(c => c.classList.remove('active'));
  el.classList.add('active');
  document.getElementById('custom-mute-mins').value = mins;
};

// ================= 通用操作 =================
function insertAtTag(authorId) {
  if (!authorId) return;
  const inputEl = document.getElementById('msg-input');
  const tag = \`<qqbot-at-user id="\${authorId}" /> \`;
  if (!inputEl.value.includes(tag)) inputEl.value += tag;
  inputEl.focus();
}

function startReply(msgId) {
  replyToMsg = msgId; quoteToMsg = null;
  document.getElementById('mode-label').innerText = '被动';
  document.getElementById('reply-tip').style.display = 'flex';
  document.getElementById('msg-input').focus();
}

function startQuote(msgId, content) {
  quoteToMsg = { msgId, content }; replyToMsg = null;
  document.getElementById('mode-label').innerText = '引用';
  document.getElementById('reply-tip').style.display = 'flex';
  document.getElementById('tip-text').innerText = '正在引用: ' + (content || '[非文本]').substring(0, 10) + '...';
  document.getElementById('msg-input').focus();
}

function cancelReply() {
  replyToMsg = null; quoteToMsg = null;
  document.getElementById('mode-label').innerText = '主动';
  document.getElementById('reply-tip').style.display = 'none';
}

async function recallMessage(msgId) {
  const confirm = await showModal({ title: '撤回', html: '确定要撤回这条消息吗？', buttons: [{ text: '取消', value: false, type: 'cancel' }, { text: '撤回', value: true, type: 'danger' }] });
  if (!confirm) return;
  const res = await fetch('/api/recall', { method: 'POST', headers: { 'Authorization': 'Bearer ' + token, 'Content-Type': 'application/json' }, body: JSON.stringify({ sessionId: currentSession.id, isGroup: currentSession.is_group === 1, messageId: msgId }) });
  const data = await res.json();
  if (res.ok) { document.getElementById('messages').dataset.count = -1; loadMessages(currentSession.id, false); }
  else showToast(data.error, 'error');
}

async function kickMember(memberOpenid) {
  const confirm = await showModal({ title: '踢人', html: \`确定要将 \${memberOpenid} 踢出群吗？\`, buttons: [{ text: '取消', value: false, type: 'cancel' }, { text: '踢出', value: true, type: 'danger' }] });
  if (!confirm) return;
  const res = await fetch('/api/kick', { method: 'POST', headers: { 'Authorization': 'Bearer ' + token, 'Content-Type': 'application/json' }, body: JSON.stringify({ groupOpenid: currentSession.id, memberOpenid: memberOpenid, addToBlacklist: false }) });
  const data = await res.json();
  if (res.ok) showToast('踢出成功', 'success');
  else showToast(data.error, 'error');
}

async function sendMessage() {
  if (!currentSession) return showToast('请先选择会话', 'error');
  const content = document.getElementById('msg-input').value.trim();
  if (!content) return;

  const body = { sessionId: currentSession.id, isGroup: currentSession.is_group === 1, content: content };
  if (replyToMsg) { body.msgId = replyToMsg; body.msgSeq = Math.floor(Math.random() * 100) + 1; }
  if (quoteToMsg) { body.quoteMsgId = quoteToMsg.msgId; body.quoteContent = quoteToMsg.content; }

  document.getElementById('msg-input').value = '';
  const btn = document.querySelector('.input-area button');
  btn.disabled = true; btn.innerText = '...';

  try {
    const res = await fetch('/api/send', { method: 'POST', headers: { 'Authorization': 'Bearer ' + token, 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error);
    cancelReply();
  } catch (e) {
    showToast(e.message, 'error');
    if (!document.getElementById('msg-input').value) document.getElementById('msg-input').value = content;
  } finally { btn.disabled = false; btn.innerText = '发送'; }
}
</script>
</body>
</html>
`;
