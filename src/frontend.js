export const FRONTEND_HTML = `
<!DOCTYPE html>
<html lang="zh-CN">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no">
<title>QQ MsgBot 控制台</title>
<link rel="icon" href="data:image/svg+xml,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 100 100'><rect width='100' height='100' rx='22' fill='%231890ff'/><text x='50' y='70' font-family='Arial, sans-serif' font-size='60' font-weight='bold' fill='white' text-anchor='middle'>:)</text></svg>">
<style>
* { box-sizing: border-box; margin: 0; padding: 0; -webkit-tap-highlight-color: transparent; }

html, body { height: 100%; height: 100dvh; overflow: hidden; margin: 0; padding: 0; }
body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif; background: #e9ecef; display: flex; color: #333; }

#js-error-layer { display: none; position: fixed; top: 0; left: 0; width: 100%; height: 100%; background: #fff; z-index: 99999; padding: 20px; color: #ff4d4f; flex-direction: column; }
#js-error-layer h2 { margin-bottom: 10px; }
#js-error-layer pre { white-space: pre-wrap; font-size: 13px; background: #f5f5f5; padding: 15px; border-radius: 8px; overflow: auto; }

.toast { position: fixed; top: 20px; left: 50%; transform: translateX(-50%) translateY(-20px); background: rgba(0,0,0,0.8); color: #fff; padding: 10px 20px; border-radius: 8px; font-size: 14px; z-index: 10000; opacity: 0; transition: all 0.3s cubic-bezier(0.68, -0.55, 0.27, 1.55); pointer-events: none; display: flex; align-items: center; gap: 8px; backdrop-filter: blur(4px);}
.toast.show { opacity: 1; transform: translateX(-50%) translateY(0); }
.toast.success { background: rgba(82, 196, 26, 0.95); }
.toast.error { background: rgba(255, 77, 79, 0.95); }

#loading-page { display: flex; width: 100%; height: 100%; justify-content: center; align-items: center; font-size: 15px; color: #666; flex-direction: column; gap: 12px; background: #f0f2f5;}
.spinner { width: 36px; height: 36px; border: 3px solid #d9d9d9; border-top-color: #1890ff; border-radius: 50%; animation: spin 0.8s linear infinite; }
@keyframes spin { to { transform: rotate(360deg); } }

#login-page { display: none; width: 100%; height: 100%; justify-content: center; align-items: center; background: #f0f2f5; padding: 20px; overflow-y: auto;}
.login-box { background: white; padding: 40px 30px; border-radius: 12px; box-shadow: 0 8px 24px rgba(0,0,0,0.08); width: 100%; max-width: 320px; }
.login-box h2 { text-align: center; margin-bottom: 25px; font-weight: 600; color: #1a1a1a; }
.login-box input { width: 100%; padding: 12px 15px; margin-bottom: 20px; border: 1px solid #d9d9d9; border-radius: 8px; font-size: 14px; outline: none; transition: border-color 0.2s; background: #fafafa;}
.login-box input:focus { border-color: #1890ff; background: #fff;}
.login-box button { width: 100%; padding: 12px; background: #1890ff; color: white; border: none; border-radius: 8px; font-size: 15px; cursor: pointer; transition: background 0.2s;}

#app { display: none; width: 100%; height: 100%; height: 100dvh; position: absolute; top: 0; left: 0; right: 0; bottom: 0; background: white; overflow: hidden; }

.mobile-header { display: none; height: 60px; background: #fff; border-bottom: 1px solid #e8e8e8; align-items: center; padding: 0 15px; justify-content: space-between; flex-shrink: 0; z-index: 10;}
.menu-btn { background: none; border: none; font-size: 20px; cursor: pointer; padding: 5px; color: #333;}

.sidebar { width: 320px; background: #f7f9fa; border-right: 1px solid #e8e8e8; display: flex; flex-direction: column; transition: transform 0.3s ease; flex-shrink: 0; z-index: 100; height: 100%;}
.session-list { flex: 1; overflow-y: auto; -webkit-overflow-scrolling: touch; padding: 10px; }
.session-item { padding: 12px 15px; border-radius: 8px; cursor: pointer; transition: all 0.2s; position: relative; margin-bottom: 5px; background: #fff; border: 1px solid transparent;}
.session-item:hover, .session-item.active { background: #e6f7ff; border-color: #91d5ff;}
.session-name { font-weight: 600; margin-bottom: 4px; font-size: 14px; color: #333; padding-right: 30px; display: flex; align-items: center; gap: 6px;}
.session-id { font-size: 10px; color: #888; margin-bottom: 6px; word-break: break-all; line-height: 1.3; display: flex; align-items: flex-start; gap: 4px;}
.session-id span.full-id { color: #1890ff; text-decoration: underline; font-weight: 500; cursor: pointer;}
.session-preview { font-size: 12px; color: #999; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.delete-session-btn { position: absolute; right: 10px; top: 12px; font-size: 14px; cursor: pointer; opacity: 0; transition: opacity 0.2s; color: #ff4d4f; padding: 4px;}
.session-item:hover .delete-session-btn { opacity: 1; }
.session-item.active { background: #e6f7ff; border-left: 4px solid #1890ff; padding-left: 11px;}

.sidebar-overlay { display: none; position: fixed; top: 0; left: 0; width: 100%; height: 100%; background: rgba(0,0,0,0.5); z-index: 99; opacity: 0; transition: opacity 0.3s;}

.chat-area { flex: 1; display: flex; flex-direction: column; background: #f0f2f5; position: relative; min-width: 0; height: 100%; min-height: 0; }
.messages { flex: 1; overflow-y: auto; -webkit-overflow-scrolling: touch; padding: 20px 20px 60px 20px; display: flex; flex-direction: column; }

.sidebar-header, .chat-header { height: 60px; padding: 0 20px; display: flex; align-items: center; justify-content: space-between; font-weight: 600; font-size: 16px; background: #fff; color: #1a1a1a; border-bottom: 1px solid #e8e8e8; flex-shrink: 0; z-index: 10;}
.sidebar-header { justify-content: flex-start; gap: 8px; }

.msg { margin-bottom: 20px; display: flex; flex-direction: column; max-width: 85%; }
.msg.incoming { align-self: flex-start; }
.msg.outgoing { align-self: flex-end; align-items: flex-end; }

.msg-author { font-size: 12px; color: #888; margin-bottom: 6px; padding: 0 4px; display: flex; align-items: center; gap: 6px; cursor: pointer; transition: opacity 0.2s;}
.msg-author:hover { opacity: 0.7; }
.msg-author.bot-author { color: #1890ff; }

.avatar-circle { width: 16px; height: 16px; border-radius: 50%; color: #fff; display: flex; align-items: center; justify-content: center; font-size: 10px; font-weight: bold;}
.avatar-circle.bot-avatar { background: #1890ff; font-family: Arial, sans-serif; }

.msg-bubble { padding: 12px 16px; border-radius: 12px; font-size: 14px; line-height: 1.5; word-wrap: break-word; position: relative; box-shadow: 0 1px 2px rgba(0,0,0,0.05);}
.msg.incoming .msg-bubble { background: #fff; color: #333; border-top-left-radius: 2px;}
.msg.outgoing .msg-bubble { background: #1890ff; color: #fff; border-top-right-radius: 2px;}

.msg.system { align-self: center; align-items: center; max-width: 90%; margin: 15px 0;}
.msg-system-text { font-size: 12px; color: #888; background: rgba(0,0,0,0.05); padding: 4px 12px; border-radius: 12px; text-align: center; }
.quote-box { background: rgba(0,0,0,0.04); border-left: 3px solid #ccc; padding: 6px 10px; margin-bottom: 10px; font-size: 12px; color: #666; border-radius: 4px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;}
.msg.outgoing .quote-box { background: rgba(255,255,255,0.15); border-left-color: #fff; color: rgba(255,255,255,0.85); }

.msg-meta { font-size: 12px; color: #b3b3b3; margin-top: 6px; display: flex; align-items: center; gap: 8px; flex-wrap: wrap; opacity: 0; transition: opacity 0.2s;}
.msg:hover .msg-meta { opacity: 1; }
@media (hover: none) { .msg-meta { opacity: 1; } }
.msg.outgoing .msg-meta { justify-content: flex-end; }

.action-btn { cursor: pointer; padding: 2px 6px; border-radius: 4px; background: #fff; border: 1px solid #e8e8e8; transition: all 0.2s; font-size: 13px; box-shadow: 0 1px 2px rgba(0,0,0,0.03); user-select: none;}
.action-btn:hover { background: #f0f0f0; }
.msg.outgoing .action-btn { background: rgba(255,255,255,0.2); border: none; color: #fff; }

.attachment-img-box { margin-top: 8px; max-width: 100%; }
.chat-img { max-width: 200px; max-height: 200px; border-radius: 8px; cursor: pointer; object-fit: cover; display: block;}
.attachment-error { display: inline-block; font-size: 12px; color: #999; background: #f5f5f5; padding: 4px 8px; border-radius: 4px; margin-top: 5px;}
.attachment-link { display: inline-flex; align-items: center; gap: 6px; margin-top: 8px; padding: 8px 14px; background: #fff; border-radius: 6px; color: #1890ff; text-decoration: none; font-size: 13px; border: 1px solid #e8e8e8;}
.msg.outgoing .attachment-link { background: rgba(255,255,255,0.15); border-color: transparent; color: #fff;}

.reply-tip { font-size: 13px; padding: 8px 15px; display: none; background: #fffbe6; color: #fa8c16; justify-content: space-between; align-items: center; border-top: 1px solid #ffe58f; flex-shrink: 0;}
.reply-tip .btn-group { display: flex; gap: 10px; }
.reply-tip span { cursor: pointer; font-weight: 500; }
.toggle-mode { color: #1890ff; }
.toggle-mode:hover { text-decoration: underline; }
.cancel { color: #ff4d4f; }

.input-area { padding: 10px 15px; background: #fff; display: flex; gap: 10px; align-items: flex-end; flex-shrink: 0; padding-bottom: calc(10px + env(safe-area-inset-bottom)); }
.input-area textarea { flex: 1; height: 50px; padding: 12px; border: 1px solid #d9d9d9; border-radius: 8px; resize: none; font-size: 14px; font-family: inherit; outline: none; background: #fafafa;}
.input-area textarea:focus { border-color: #1890ff; background: #fff;}
.input-area button { padding: 0 20px; height: 40px; background: #1890ff; color: white; border: none; border-radius: 6px; cursor: pointer; font-size: 14px; font-weight: 500; margin-bottom: 5px;}

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

.mute-status-box { background: #f8f9fa; border-radius: 8px; padding: 15px; margin-bottom: 20px; border: 1px solid #e8e8e8; }
.mute-status-text { font-size: 14px; font-weight: bold; margin-bottom: 5px; }
.mute-status-desc { font-size: 12px; color: #888; }
.mute-actions { display: flex; gap: 10px; margin-bottom: 10px; flex-wrap: wrap;}
.mute-chip { padding: 6px 12px; background: #e6f7ff; color: #1890ff; border: 1px solid #91d5ff; border-radius: 16px; font-size: 13px; cursor: pointer;}
.mute-chip.active { background: #1890ff; color: #fff; }

@media (max-width: 768px) {
  #app { flex-direction: column; }
  .mobile-header { display: flex; }
  .chat-header { display: none; }
  .sidebar { position: fixed; top: 0; left: 0; height: 100%; transform: translateX(-100%); width: 300px; box-shadow: 2px 0 10px rgba(0,0,0,0.1);}
  .sidebar.open { transform: translateX(0); }
  .sidebar-overlay.open { display: block; opacity: 1; }
  .messages { padding: 15px 15px 60px 15px; }
  .msg { max-width: 90%; }
  .input-area { padding: 10px; gap: 8px; padding-bottom: calc(10px + env(safe-area-inset-bottom)); }
  .input-area textarea { height: 45px; padding: 10px; font-size: 14px;}
  .modal-box { padding: 20px; }
}

@media (prefers-color-scheme: dark) {
  body { background: #121212; color: #e0e0e0; }
  #js-error-layer { background: #121212; }
  #js-error-layer pre { background: #2a2a2a; color: #ff7875;}
  #loading-page, #login-page { background: #121212; }
  .login-box { background: #1e1e1e; box-shadow: 0 8px 24px rgba(0,0,0,0.5); }
  .login-box h2 { color: #fff; }
  .login-box input { background: #2a2a2a; border-color: #333; color: #fff; }
  #app { background: #121212; }
  .sidebar { background: #1e1e1e; border-color: #333; }
  .sidebar-header, .chat-header, .mobile-header, .input-area { background: #1e1e1e; border-color: #333; color: #e0e0e0; }
  .menu-btn { color: #e0e0e0; }
  .session-item { background: #2a2a2a; border-color: #333; }
  .session-item:hover, .session-item.active { background: #1a3b5c; border-color: #1890ff; }
  .session-name { color: #e0e0e0; }
  .session-id { color: #888; }
  .session-id span.full-id { color: #40a9ff; }
  .chat-area { background: #121212; }
  .msg.incoming .msg-bubble { background: #2a2a2a; color: #e0e0e0; border-color: #333; }
  .msg-meta { color: #888; }
  .action-btn { background: #333; border-color: #444; color: #e0e0e0; }
  .action-btn:hover { background: #444; }
  .input-area textarea { background: #2a2a2a; border-color: #333; color: #e0e0e0; }
  .input-area textarea:focus { background: #333; border-color: #1890ff; }
  .modal-box { background: #1e1e1e; border: 1px solid #333; }
  .modal-title { color: #fff; }
  .modal-content { color: #aaa; }
  .modal-input { background: #2a2a2a; border-color: #333; color: #fff; }
  .modal-btn.cancel { background: #333; color: #e0e0e0; }
  .mute-status-box { background: #2a2a2a; border-color: #333; }
  .quote-box { background: rgba(255,255,255,0.1); color: #aaa; }
  .reply-tip { background: #3b3214; border-color: #5a4a1a; color: #e6a23c; }
}
</style>
<script>
window.onerror = function(msg, url, line, col, error) {
  const errLayer = document.getElementById('js-error-layer');
  if (errLayer) {
    errLayer.style.display = 'flex';
    const pre = errLayer.querySelector('pre');
    pre.innerText = msg + '\\n\\n位置: ' + line + ':' + col + '\\n\\n' + (error ? error.stack : '');
  }
};
</script>
</head>
<body>
<div id="js-error-layer">
<h2>⚠️ 页面脚本运行出错</h2>
<p>请将以下错误信息发给开发者修复：</p>
<pre></pre>
</div>

<div id="loading-page"><div class="spinner"></div><div>正在连接...</div></div>

<div id="login-page">
<div class="login-box">
<h2>🤖 MsgBot</h2>
<input type="password" id="pwd" placeholder="请输入登录密码" onkeypress="if(event.key==='Enter') login()">
<button onclick="login()">立即登录</button>
</div>
</div>

<div id="app">
<div class="mobile-header">
<button class="menu-btn" onclick="toggleSidebar()">☰</button>
<span id="mobile-title" style="font-weight: 600; font-size: 15px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;">请选择会话</span>
<button class="menu-btn" style="font-size: 16px;" onclick="openBotSettings()">⚙️</button>
</div>

<div class="sidebar-overlay" id="sidebar-overlay" onclick="toggleSidebar()"></div>

<div class="sidebar" id="sidebar">
<div class="sidebar-header">💬 会话列表</div>
<div class="session-list" id="session-list"></div>
</div>

<div class="chat-area">
<div class="chat-header">
<span id="chat-title">请选择左侧会话</span>
<span style="display:flex; align-items:center; gap:10px;">
<span style="font-size: 12px; color: #888; font-weight: normal;">模式: <span id="mode-label">主动</span></span>
<span style="cursor:pointer; font-size:18px;" onclick="openBotSettings()" title="设置 Bot ID">⚙️</span>
</span>
</div>

<div class="messages" id="messages"></div>

<div class="reply-tip" id="reply-tip">
<span id="tip-text">正在回复...</span>
<div class="btn-group">
<span class="toggle-mode" id="toggle-mode-btn" onclick="toggleMode()">转为主动</span>
<span class="cancel" onclick="cancelReply()">✖ 取消</span>
</div>
</div>

<div class="input-area">
<textarea id="msg-input" placeholder="输入消息..." onkeydown="if(event.key==='Enter'&&!event.shiftKey){event.preventDefault();sendMessage();}"></textarea>
<button onclick="sendMessage()">发送</button>
</div>
</div>
</div>

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
let myBotId = localStorage.getItem('custom_bot_id') || '';
let currentSession = null;
let replyToMsg = null;
let quoteToMsg = null;
let sessionsData = [];
let currentMsgs = [];
let idMap = {};
let ws = null;

let replyBaseTime = 0;
let replyTimeoutTimer = null;

const originalFetch = window.fetch;
window.fetch = async function(...args) {
  const res = await originalFetch.apply(this, args);
  if (res.status === 401 && !args[0].includes('/api/login')) {
    localStorage.removeItem('bot_token');
    localStorage.removeItem('bot_expires_at');
    alert('登录已过期，请重新登录');
    location.reload();
  }
  return res;
};

window.scrollToBottom = function() {
  const msgEl = document.getElementById('messages');
  if (msgEl) msgEl.scrollTop = msgEl.scrollHeight;
};

function formatName(id, isGroup = false, isBot = false) {
  if (idMap[id]) return idMap[id];
  if (isBot) {
    if (!myBotId) return 'Bot';
    return 'Bot_' + (myBotId.length > 4 ? myBotId.slice(-4) : myBotId);
  }
  if (!id || id === '未知用户') return '用户_未知';
  const suffix = id.length > 4 ? id.slice(-4) : id;
  if (isGroup) return '群聊_' + suffix;
  return '用户_' + suffix;
}

function getColor(id) {
  if (!id || id === 'Bot') return '#1890ff';
  let hash = 0;
  for (let i = 0; i < id.length; i++) {
    hash = id.charCodeAt(i) + ((hash << 5) - hash);
  }
  const h = Math.abs(hash) % 360;
  return 'hsl(' + h + ', 65%, 55%)';
}

function escapeHTML(str) {
  if (str === null || str === undefined) return '';
  return String(str).replace(/[&<>'"]/g, tag => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;' }[tag] || tag));
}

async function openBotSettings() {
  const html = '<div style="margin-bottom:15px;font-size:13px;color:#888;">请填入机器人的真实 OpenID，用于在聊天区识别和显示。</div>' +
  '<input type="text" id="bot-id-input" class="modal-input" value="' + escapeHTML(myBotId) + '" placeholder="填写 Bot 的 OpenID">';

  const confirm = await showModal({
    title: 'Bot 设置',
    html: html,
    buttons: [{ text: '取消', value: false, type: 'cancel' }, { text: '保存', value: true, type: 'confirm' }]
  });

  if (!confirm) return;
  const newId = document.getElementById('bot-id-input').value.trim();
  myBotId = newId;
  localStorage.setItem('custom_bot_id', myBotId);
  showToast('Bot 设置已保存', 'success');
  if (currentSession) loadMessages(currentSession.id, false);
}

async function loadMappings() {
  try {
    const res = await fetch('/api/mappings', { headers: { 'Authorization': 'Bearer ' + token } });
    const data = await res.json();
    if (Array.isArray(data)) {
      idMap = {};
      data.forEach(item => { idMap[item.id] = item.nickname; });
    }
  } catch (e) {}
}

// 👇 修复：通过索引获取数据，避免直接传字符串导致语法截断
async function editSessionMapping(index, event) {
  if (event) event.stopPropagation();
  const id = sessionsData[index].id;
  await showMappingDialog(id);
}

async function editMsgMapping(index, event) {
  if (event) event.stopPropagation();
  const m = currentMsgs[index];
  if (!m) return;
  const id = m.type === 'outgoing' ? (myBotId || 'Bot') : (m.author_name || '未知用户');
  await showMappingDialog(id);
}

async function showMappingDialog(id) {
  if (!id || id === '未知用户') return;

  const currentName = idMap[id] || formatName(id, false, id === myBotId);
  const html = '<div style="margin-bottom:15px;font-size:13px;color:#888;word-break:break-all;">ID: ' + escapeHTML(id) + '</div>' +
  '<input type="text" id="mapping-input" class="modal-input" value="' + escapeHTML(currentName) + '" placeholder="输入备注昵称">';

  const confirm = await showModal({
    title: '设置备注',
    html: html,
    buttons: [{ text: '取消', value: false, type: 'cancel' }, { text: '保存', value: true, type: 'confirm' }]
  });

  if (!confirm) return;
  const newName = document.getElementById('mapping-input').value.trim();
  if (!newName || newName === currentName) return;

  try {
    await fetch('/api/mapping', {
      method: 'POST', headers: { 'Authorization': 'Bearer ' + token, 'Content-Type': 'application/json' },
      body: JSON.stringify({ id, nickname: newName })
    });
    idMap[id] = newName;
    showToast('备注已更新', 'success');
    loadSessions();
    if (currentSession) loadMessages(currentSession.id, false);
  } catch (e) {
    showToast('设置失败', 'error');
  }
}

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

function showModal({ title, html, buttons }) {
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

function isTokenValid() {
  if (!token || !expiresAt) return false;
  if (Date.now() > parseInt(expiresAt)) return false;
  return true;
}

function handleImgError(img) {
  const span = document.createElement('span');
  span.className = 'attachment-error';
  span.innerText = '[图片已过期]';
  img.replaceWith(span);
  window.scrollToBottom();
}

async function checkSystemStatus() {
  try {
    const res = await fetch('/api/health');
    const data = await res.json();
    document.getElementById('loading-page').style.display = 'none';

    if (isTokenValid()) {
      await loadMappings();
      showApp();
    } else {
      document.getElementById('login-page').style.display = 'flex';
    }
  } catch (e) {
    document.getElementById('loading-page').innerHTML = '<span style="color:red">连接失败，请刷新</span>';
    throw e;
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
    await loadMappings();
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

async function loadSessions() {
  if (!isTokenValid()) return;
  const res = await fetch('/api/sessions', { headers: { 'Authorization': 'Bearer ' + token } });
  if (res.status === 401) return;
  sessionsData = await res.json();

  if (!Array.isArray(sessionsData)) {
    return showToast('获取会话失败', 'error');
  }

  const listEl = document.getElementById('session-list');
  listEl.innerHTML = sessionsData.map((s, i) => {
    const displayName = formatName(s.id, s.is_group === 1);
    return '<div class="session-item ' + (currentSession?.id === s.id ? 'active' : '') + '" onclick="selectSession(' + i + ')">' +
    '<div class="session-name" title="点击设置备注" onclick="editSessionMapping(' + i + ', event)">' + (s.is_group ? '👥 ' : '👤 ') + displayName + '</div>' +
    '<div class="session-id">' +
    '<span class="full-id">' + escapeHTML(s.id) + '</span>' +
    '</div>' +
    '<div class="session-preview">' + escapeHTML(s.last_message || '暂无消息') + '</div>' +
    '<span class="delete-session-btn" onclick="event.stopPropagation(); deleteSession(' + i + ')">🗑️</span>' +
    '</div>';
  }).join('');
}

async function selectSession(index) {
  const id = sessionsData[index].id;
  if (currentSession?.id === id) {
    if (window.innerWidth <= 768) toggleSidebar();
    return;
  }
  currentSession = sessionsData[index];
  const shortTitle = (currentSession.is_group ? '👥 群聊' : '👤 私聊') + ' (' + formatName(id, currentSession.is_group === 1) + ')';
  document.getElementById('chat-title').innerText = shortTitle;
  document.getElementById('mobile-title').innerText = shortTitle;

  cancelReply();
  document.getElementById('messages').dataset.count = -1;
  await loadMessages(id, false);
  loadSessions();

  if (window.innerWidth <= 768) toggleSidebar();
}

async function deleteSession(index) {
  const id = sessionsData[index].id;
  const resVal = await showModal({
    title: '删除会话',
    html: '确定要删除该会话及记录吗？',
    buttons: [{ text: '取消', value: false, type: 'cancel' }, { text: '删除', value: true, type: 'danger' }]
  });
  if (!resVal) return;
  await fetch('/api/delete_session', { method: 'POST', headers: { 'Authorization': 'Bearer ' + token, 'Content-Type': 'application/json' }, body: JSON.stringify({ sessionId: id }) });
  if (currentSession?.id === id) { currentSession = null; document.getElementById('messages').innerHTML = ''; document.getElementById('chat-title').innerText = '请选择左侧会话'; document.getElementById('mobile-title').innerText = '请选择会话'; }
  loadSessions();
}

async function loadMessages(sessionId, isPush) {
  if (!isTokenValid()) return;
  const res = await fetch('/api/messages?id=' + sessionId, { headers: { 'Authorization': 'Bearer ' + token } });
  const msgs = await res.json();

  if (sessionId !== currentSession.id) return;

  if (!Array.isArray(msgs)) {
    return showToast('获取消息失败: ' + (msgs.error || '未知错误'), 'error');
  }

  const msgEl = document.getElementById('messages');
  if (msgEl.dataset.count == msgs.length) return;
  msgEl.dataset.count = msgs.length;

  currentMsgs = msgs;

  const now = Date.now();
  msgEl.innerHTML = msgs.map((m, i) => {
    if (m.type === 'system') {
      return '<div class="msg system"><div class="msg-system-text">' + escapeHTML(m.content) + '</div></div>';
    }

    const isOut = m.type === 'outgoing';
    const isGroup = currentSession.is_group === 1;
    const isWithin2Mins = (now - m.timestamp) < 2 * 60 * 1000;
    const isWithin5Mins = (now - m.timestamp) < 5 * 60 * 1000;

    const showRecallBtn = (isOut && isWithin2Mins) || (!isOut && isGroup && isWithin2Mins);
    const showReplyBtn = !isOut && isWithin5Mins;
    const showGroupOps = !isOut && isGroup;

    let rawAuthorName = isOut ? (myBotId || 'Bot') : (m.author_name || '未知用户');
    let displayName = isOut ? formatName(myBotId, isGroup, true) : formatName(rawAuthorName, false);
    let color = getColor(rawAuthorName);

    let authorHtml = '';
    if (isOut) {
      authorHtml = '<div class="msg-author bot-author" title="点击设置备注" onclick="editMsgMapping(' + i + ', event)">' +
      '<div class="avatar-circle bot-avatar">A</div> ' + displayName +
      '</div>';
    } else {
      authorHtml = '<div class="msg-author" title="点击设置备注" onclick="editMsgMapping(' + i + ', event)">' +
      '<div class="avatar-circle" style="background: ' + color + ';">' + (rawAuthorName.slice(-2, -1) || 'U') + '</div> ' + displayName +
      '</div>';
    }

    let quoteHtml = m.quote_content ? '<div class="quote-box">' + escapeHTML(m.quote_content) + '</div>' : '';

    let attHtml = '';
    if (m.attachments) {
      try {
        JSON.parse(m.attachments).forEach(att => {
          if (att.error) {
            attHtml += '<div><span class="attachment-error">[' + escapeHTML(att.error) + ']</span></div>';
          } else if (att.content_type && att.content_type.startsWith('image/')) {
            attHtml += '<img src="' + escapeHTML(att.url) + '" class="chat-img" onload="window.scrollToBottom()" onerror="handleImgError(this)" onclick="window.open(this.src)" />';
          } else {
            attHtml += '<a href="' + escapeHTML(att.url) + '" target="_blank" class="attachment-link">📄 [文件] 点击下载</a>';
          }
        });
      } catch (e) {}
    }

    return '<div class="msg ' + (isOut ? 'outgoing' : 'incoming') + '">' +
    authorHtml +
    '<div class="msg-bubble">' +
    quoteHtml +
    (m.content ? escapeHTML(m.content) : '') +
    attHtml +
    '</div>' +
    '<div class="msg-meta">' +
    '<span>' + new Date(m.timestamp).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'}) + '</span>' +
    (showRecallBtn ? '<span class="action-btn" title="撤回" onclick="recallMessage(' + i + ')">🗑️</span>' : '') +
    (showReplyBtn ? '<span class="action-btn" title="被动回复" onclick="startReply(' + i + ')">↩️</span>' : '') +
    '<span class="action-btn" title="引用并回复" onclick="startQuote(' + i + ')">💬</span>' +
    (showGroupOps ? '<span class="action-btn" title="提及" onclick="insertAtTag(' + i + ')">@</span>' : '') +
    (showGroupOps ? '<span class="action-btn" title="禁言管理" onclick="openMutePanel(' + i + ')">🔇</span>' : '') +
    (showGroupOps ? '<span class="action-btn" title="踢出" onclick="kickMember(' + i + ')">👢</span>' : '') +
    '</div>' +
    '</div>';
  }).join('');

  window.scrollToBottom();
  requestAnimationFrame(() => {
    window.scrollToBottom();
    setTimeout(window.scrollToBottom, 100);
    setTimeout(window.scrollToBottom, 300);
    setTimeout(window.scrollToBottom, 500);
  });
}

async function openMutePanel(index) {
  const memberOpenid = currentMsgs[index].author_name;
  const loadingHtml = '<div class="mute-status-box">' +
  '<div class="mute-status-text" style="color:#1890ff">正在查询禁言状态...</div>' +
  '</div>' +
  '<div class="modal-btns"><button class="modal-btn cancel" onclick="closeModal()">关闭</button></div>';

  showModal({ title: '管理成员: ' + formatName(memberOpenid), html: loadingHtml, buttons: [] });

  try {
    const res = await fetch('/api/mute_status?group_id=' + currentSession.id + '&member_id=' + memberOpenid, {
      headers: { 'Authorization': 'Bearer ' + token }
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || '查询失败');

    let statusHtml = '';
    let btns = [{ text: '关闭', value: null, type: 'cancel' }];

    if (data.isMuted) {
      statusHtml = '<div class="mute-status-box">' +
      '<div class="mute-status-text" style="color:#ff4d4f">🔇 当前状态：已禁言</div>' +
      '<div class="mute-status-desc">到期时间：' + new Date(data.expireAt).toLocaleString() + '</div>' +
      '</div>';
  btns.unshift({ text: '解除禁言', value: 'unmute', type: 'success' });
    } else {
      statusHtml = '<div class="mute-status-box">' +
      '<div class="mute-status-text" style="color:#52c41a">🔊 当前状态：未禁言</div>' +
      '</div>' +
      '<div style="margin-bottom: 10px; font-size: 14px;">选择禁言时长：</div>' +
      '<div class="mute-actions">' +
      '<div class="mute-chip" onclick="selectMuteTime(this, 10)">10分钟</div>' +
      '<div class="mute-chip" onclick="selectMuteTime(this, 60)">1小时</div>' +
      '<div class="mute-chip" onclick="selectMuteTime(this, 1440)">1天</div>' +
      '</div>' +
      '<input type="number" id="custom-mute-mins" class="modal-input" placeholder="自定义分钟数" style="margin-top:10px;">';
      btns.unshift({ text: '确认禁言', value: 'mute', type: 'danger' });
    }

    const action = await showModal({ title: '成员: ' + formatName(memberOpenid), html: statusHtml, buttons: btns });

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
    showModal({ title: '错误', html: '<div style="color:red;margin-bottom:15px">' + err.message + '</div>', buttons: [{ text: '关闭', value: null, type: 'cancel' }] });
  }
}

window.selectMuteTime = function(el, mins) {
  document.querySelectorAll('.mute-chip').forEach(c => c.classList.remove('active'));
  el.classList.add('active');
  document.getElementById('custom-mute-mins').value = mins;
};

function insertAtTag(index) {
  const authorId = currentMsgs[index].author_name;
  if (!authorId) return;
  const inputEl = document.getElementById('msg-input');
  const tag = '<qqbot-at-user id="' + authorId + '" /> ';
  if (!inputEl.value.includes(tag)) inputEl.value += tag;
  inputEl.focus();
}

function updateModeUI() {
  const label = document.getElementById('mode-label');
  const btn = document.getElementById('toggle-mode-btn');
  const tipText = document.getElementById('tip-text');

  if (replyTimeoutTimer) clearInterval(replyTimeoutTimer);

  if (replyToMsg) {
    label.innerText = '被动';
    label.style.color = '#52c41a';
    btn.innerText = '转为主动';

    const expireTime = Number(replyBaseTime) + 5 * 60 * 1000;

    replyTimeoutTimer = setInterval(() => {
      const remaining = expireTime - Date.now();
      if (remaining <= 0) {
        clearInterval(replyTimeoutTimer);
        cancelReply();
        showToast('被动回复已超时（发出已超5分钟），自动转为主动模式', 'error');
      } else {
        const mins = Math.floor(remaining / 60000);
        const secs = Math.floor((remaining % 60000) / 1000);
        const timeStr = mins + '分' + secs.toString().padStart(2, '0') + '秒';
        const originalText = quoteToMsg ? '正在引用: ' + (quoteToMsg.content || '[非文本]').substring(0, 10) + '...' : '正在被动回复...';
        tipText.innerText = originalText + ' (剩余 ' + timeStr + ')';
      }
    }, 1000);

    const remaining = expireTime - Date.now();
    const mins = Math.floor(remaining / 60000);
    const secs = Math.floor((remaining % 60000) / 1000);
    const timeStr = mins + '分' + secs.toString().padStart(2, '0') + '秒';
    const originalText = quoteToMsg ? '正在引用: ' + (quoteToMsg.content || '[非文本]').substring(0, 10) + '...' : '正在被动回复...';
    tipText.innerText = originalText + ' (剩余 ' + timeStr + ')';

  } else {
    label.innerText = '主动';
    label.style.color = '#fa8c16';
    btn.innerText = '需要被动？去点消息回复';
    tipText.innerText = quoteToMsg ? '正在主动引用: ' + (quoteToMsg.content || '[非文本]').substring(0, 15) + '...' : '正在主动发送...';
  }

  if (!replyToMsg && !quoteToMsg) {
    document.getElementById('reply-tip').style.display = 'none';
  } else {
    document.getElementById('reply-tip').style.display = 'flex';
  }
}

function startReply(index) {
  const m = currentMsgs[index];
  const timestamp = Number(m.timestamp) || Date.now();
  if (Date.now() - timestamp > 5 * 60 * 1000) {
    return showToast('该消息已超过 5 分钟，无法被动回复', 'error');
  }
  replyToMsg = m.msg_id;
  replyBaseTime = timestamp;
  updateModeUI();
  document.getElementById('msg-input').focus();
}

function startQuote(index) {
  const m = currentMsgs[index];
  quoteToMsg = { msgId: m.msg_id, content: m.content };
  replyBaseTime = Number(m.timestamp) || Date.now();
  updateModeUI();
  document.getElementById('msg-input').focus();
}

function toggleMode() {
  if (replyToMsg) {
    replyToMsg = null;
  } else {
    showToast('请先在聊天记录点击“↩️”选择要被动回复的对象', 'info');
    return;
  }
  updateModeUI();
}

function cancelReply() {
  replyToMsg = null; quoteToMsg = null;
  updateModeUI();
}

async function recallMessage(index) {
  const msgId = currentMsgs[index].msg_id;
  const confirm = await showModal({ title: '撤回', html: '确定要撤回这条消息吗？', buttons: [{ text: '取消', value: false, type: 'cancel' }, { text: '撤回', value: true, type: 'danger' }] });
  if (!confirm) return;
  const res = await fetch('/api/recall', { method: 'POST', headers: { 'Authorization': 'Bearer ' + token, 'Content-Type': 'application/json' }, body: JSON.stringify({ sessionId: currentSession.id, isGroup: currentSession.is_group === 1, messageId: msgId }) });
  const data = await res.json();
  if (res.ok) { document.getElementById('messages').dataset.count = -1; loadMessages(currentSession.id, false); }
  else showToast(data.error, 'error');
}

async function kickMember(index) {
  const memberOpenid = currentMsgs[index].author_name;
  const html = '<div style="margin-bottom:15px;font-size:14px;">确定要将 <b>' + formatName(memberOpenid) + '</b> 踢出群吗？</div>' +
  '<label style="display:flex;align-items:center;gap:8px;font-size:14px;cursor:pointer;color:#ff4d4f;">' +
  '<input type="checkbox" id="kick-blacklist" style="width:16px;height:16px;accent-color:#ff4d4f;">' +
  '同时加入群黑名单' +
  '</label>';

  const confirm = await showModal({
    title: '踢出群聊',
    html: html,
    buttons: [{ text: '取消', value: false, type: 'cancel' }, { text: '确认踢出', value: true, type: 'danger' }]
  });

  if (!confirm) return;
  const addToBlacklist = document.getElementById('kick-blacklist').checked;

  const res = await fetch('/api/kick', {
    method: 'POST',
    headers: { 'Authorization': 'Bearer ' + token, 'Content-Type': 'application/json' },
    body: JSON.stringify({ groupOpenid: currentSession.id, memberOpenid: memberOpenid, addToBlacklist: addToBlacklist })
  });

  const data = await res.json();
  if (res.ok) showToast('踢出成功', 'success');
  else showToast(data.error, 'error');
}

async function sendMessage() {
  if (!currentSession) return showToast('请先选择会话', 'error');
  const content = document.getElementById('msg-input').value.trim();
  if (!content) return;

  if (replyToMsg && Date.now() - replyBaseTime > 5 * 60 * 1000) {
    cancelReply();
    return showToast('被动回复已超时，请重新点击回复按钮', 'error');
  }

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
