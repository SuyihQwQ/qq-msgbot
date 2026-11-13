export const FRONTEND_HTML = `
<!DOCTYPE html>
<html lang="zh-CN">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>QQ MsgBot 控制台</title>
<style>
* { box-sizing: border-box; margin: 0; padding: 0; }
body { font-family: system-ui, sans-serif; background: #f0f2f5; height: 100vh; display: flex; }

#loading-page { display: flex; width: 100%; height: 100%; justify-content: center; align-items: center; font-size: 16px; color: #666; flex-direction: column; gap: 10px;}
.spinner { width: 30px; height: 30px; border: 3px solid #ccc; border-top-color: #1890ff; border-radius: 50%; animation: spin 1s linear infinite; }
@keyframes spin { to { transform: rotate(360deg); } }

#login-page { display: none; width: 100%; height: 100%; justify-content: center; align-items: center; }
.login-box { background: white; padding: 30px; border-radius: 8px; box-shadow: 0 4px 12px rgba(0,0,0,0.1); width: 300px; }
.login-box input { width: 100%; padding: 10px; margin: 15px 0; border: 1px solid #ccc; border-radius: 4px; }
.login-box button { width: 100%; padding: 10px; background: #1890ff; color: white; border: none; border-radius: 4px; cursor: pointer; }

.error-layer { display: none; position: fixed; top: 0; left: 0; width: 100%; height: 100%; background: rgba(0,0,0,0.85); z-index: 9999; justify-content: center; align-items: center; color: white; text-align: left; }
.error-box { background: #1e1e1e; padding: 40px; border-radius: 8px; border: 1px solid #ff4d4f; max-width: 600px; }
.error-box h2 { color: #ff4d4f; margin-bottom: 20px; text-align: center;}
.error-box p { line-height: 1.6; margin-bottom: 15px; font-size: 14px; color: #ccc; }
.error-box code { background: #333; padding: 2px 6px; border-radius: 4px; color: #ffbaba; font-family: monospace; }
.error-box ol { margin-left: 20px; color: #ccc; font-size: 14px; line-height: 1.8; }
.missing-list { color: #ff4d4f; font-weight: bold; font-size: 16px; display: block; margin: 10px 0; }

#app { display: none; width: 100%; height: 100%; background: white; }
.sidebar { width: 280px; background: #f7f7f7; border-right: 1px solid #e0e0e0; display: flex; flex-direction: column; }
.sidebar-header { padding: 15px; border-bottom: 1px solid #e0e0e0; font-weight: bold; font-size: 18px; background: #fff;}
.session-list { flex: 1; overflow-y: auto; }
.session-item { padding: 15px; border-bottom: 1px solid #e0e0e0; cursor: pointer; transition: background 0.2s; position: relative; }
.session-item:hover, .session-item.active { background: #e6f7ff; }
.session-name { font-weight: bold; margin-bottom: 5px; font-size: 14px; color: #333; word-break: break-all; padding-right: 40px;}
.session-preview { font-size: 12px; color: #888; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }

.delete-session-btn { position: absolute; right: 10px; top: 15px; font-size: 12px; color: #ff4d4f; cursor: pointer; opacity: 0; transition: opacity 0.2s;}
.session-item:hover .delete-session-btn { opacity: 1; }

.chat-area { flex: 1; display: flex; flex-direction: column; background: #fff; }
.chat-header { padding: 15px; border-bottom: 1px solid #e0e0e0; font-weight: bold; display: flex; justify-content: space-between; align-items: center; word-break: break-all; }
.messages { flex: 1; overflow-y: auto; padding: 20px; background: #fafafa; display: flex; flex-direction: column; }

.msg { margin-bottom: 15px; display: flex; flex-direction: column; max-width: 75%; }
.msg.incoming { align-self: flex-start; }
.msg.outgoing { align-self: flex-end; align-items: flex-end; }

/* 👇 修改：允许显示 bot 自己的名字并靠右 */
.msg-author { font-size: 12px; color: #888; margin-bottom: 4px; padding-left: 4px; word-break: break-all; }
.msg.outgoing .msg-author { padding-right: 4px; text-align: right; }

.msg-bubble { padding: 10px 15px; border-radius: 8px; font-size: 14px; word-wrap: break-word; position: relative; }
.msg.incoming .msg-bubble { background: #fff; border: 1px solid #e0e0e0; color: #333; }
.msg.outgoing .msg-bubble { background: #1890ff; color: #fff; }
.msg-meta { font-size: 12px; color: #aaa; margin-top: 5px; display: flex; gap: 8px;}

.action-btn { cursor: pointer; text-decoration: underline; }
.action-btn:hover { opacity: 0.8; }
.at-btn { color: #1890ff; }
.reply-btn { color: #1890ff; }
.recall-btn { color: #ff4d4f; }
.mute-btn { color: #faad14; }
.kick-btn { color: #fa8c16; }

.attachment-img-box { margin-top: 5px; max-width: 100%; }
.chat-img { max-width: 200px; max-height: 200px; border-radius: 6px; cursor: pointer; object-fit: cover; display: block; }
.attachment-error { display: inline-block; font-size: 12px; color: #999; background: #f5f5f5; padding: 4px 8px; border-radius: 4px; font-style: italic; margin-top: 5px;}
.attachment-link { display: inline-block; margin-top: 5px; padding: 6px 12px; background: #f0f2f5; border-radius: 4px; color: #1890ff; text-decoration: none; font-size: 13px; border: 1px solid #e0e0e0;}
.attachment-link:hover { background: #e6f7ff; }

.input-area { padding: 15px; border-top: 1px solid #e0e0e0; display: flex; gap: 10px; background: #fff; }
.input-area textarea { flex: 1; height: 60px; padding: 10px; border: 1px solid #ccc; border-radius: 4px; resize: none; }
.input-area button { padding: 0 20px; background: #1890ff; color: white; border: none; border-radius: 4px; cursor: pointer; }
.reply-tip { font-size: 12px; color: #ff4d4f; padding: 5px 15px; display: none; background: #fffbe6; border-bottom: 1px solid #ffe58f;}
.reply-tip span { cursor: pointer; color: #1890ff; margin-left: 10px; }
</style>
</head>
<body>
<div id="loading-page"><div class="spinner"></div><div>正在检查系统状态...</div></div>

<div id="env-error-layer" class="error-layer">
<div class="error-box">
<h2>⚠️ 系统未就绪：缺少必需环境变量</h2>
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
<h2 style="text-align: center;">QQ MsgBot</h2>
<input type="password" id="pwd" placeholder="请输入密码" onkeypress="if(event.key==='Enter') login()">
<button onclick="login()">登录</button>
</div>
</div>

<div id="app">
<div class="sidebar">
<div class="sidebar-header">会话列表</div>
<div class="session-list" id="session-list"></div>
</div>
<div class="chat-area">
<div class="chat-header">
<span id="chat-title">请选择会话</span>
<span style="font-size: 12px; color: #888; flex-shrink: 0; margin-left: 10px;">当前模式: <span id="mode-label">主动消息</span></span>
</div>
<div class="reply-tip" id="reply-tip">
正在回复消息... <span onclick="cancelReply()">取消回复</span>
</div>
<div class="messages" id="messages"></div>
<div class="input-area">
<textarea id="msg-input" placeholder="输入内容，Enter 发送 (Shift+Enter 换行)" onkeydown="if(event.key==='Enter'&&!event.shiftKey){event.preventDefault();sendMessage();}"></textarea>
<button onclick="sendMessage()">发送</button>
</div>
</div>
</div>

<script>
let token = localStorage.getItem('bot_token');
let currentSession = null;
let replyToMsg = null;
let sessionsData = [];
let ws = null;

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
    if (token) showApp();
    else document.getElementById('login-page').style.display = 'flex';
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
      localStorage.setItem('bot_token', token);
      document.getElementById('login-page').style.display = 'none';
      showApp();
    } else alert(data.error || '密码错误');
  } catch (e) { alert('网络请求失败'); }
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
  try {
    const res = await fetch('/api/sessions', { headers: { 'Authorization': 'Bearer ' + token } });
    const data = await res.json();
    if (checkFatalError(data)) return;
    if (res.status === 401) { localStorage.removeItem('bot_token'); location.reload(); return; }
    sessionsData = data;

    const listEl = document.getElementById('session-list');
    listEl.innerHTML = sessionsData.map(s => \`
    <div class="session-item \${currentSession?.id === s.id ? 'active' : ''}" onclick="selectSession('\${escapeHTML(s.id)}')">
    <div class="session-name">\${s.is_group ? '👥 群聊' : '👤 私聊'} - \${escapeHTML(s.id)}</div>
    <div class="session-preview">\${escapeHTML(s.last_message || '暂无消息')}</div>
    <span class="delete-session-btn" onclick="event.stopPropagation(); deleteSession('\${escapeHTML(s.id)}')">删除</span>
    </div>
    \`).join('');
  } catch (e) {}
}

async function deleteSession(id) {
  if (!confirm('确定要删除该会话及其所有本地消息记录吗？')) return;
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
      document.getElementById('chat-title').innerText = '请选择会话';
    }
    loadSessions();
  } catch (e) { alert(e.message); }
}

async function selectSession(id) {
  if (currentSession?.id === id) return;
  currentSession = sessionsData.find(s => s.id === id);
  document.getElementById('chat-title').innerText = (currentSession.is_group ? '群聊' : '私聊') + ' - ' + id;
  cancelReply();
  document.getElementById('messages').dataset.count = -1;
  await loadMessages(id, false);
  loadSessions();
}

async function loadMessages(sessionId, isPush) {
  try {
    const res = await fetch(\`/api/messages?id=\${sessionId}\`, { headers: { 'Authorization': 'Bearer ' + token } });
    const msgs = await res.json();
    if (checkFatalError(msgs)) return;

    const msgEl = document.getElementById('messages');
    if (msgEl.dataset.count == msgs.length) return;
    msgEl.dataset.count = msgs.length;

    const now = Date.now();
    msgEl.innerHTML = msgs.map(m => {
      const isOut = m.type === 'outgoing';
      const isWithin2Mins = (now - m.timestamp) < 2 * 60 * 1000;
      const isWithin5Mins = (now - m.timestamp) < 5 * 60 * 1000;

      const showReplyBtn = !isOut && isWithin5Mins;
      const showRecallBtn = isOut && isWithin2Mins;
      const showGroupOps = !isOut && currentSession.is_group === 1;

      // 👇 显示机器人的真实 ID
      const authorName = isOut ? (currentSession.bot_openid || 'Bot (ID未知)') : (m.author_name || '用户');

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
              attachmentsHtml += \`<div><a href="\${escapeHTML(att.url)}" target="_blank" class="attachment-link">🎤 [语音] 点击播放</a></div>\`;
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
      \${m.content ? escapeHTML(m.content) : ''}
      \${attachmentsHtml}
      </div>
      <div class="msg-meta">
      <span>\${new Date(m.timestamp).toLocaleTimeString()}</span>
      \${isOut && m.is_passive ? '<span style="color:#52c41a">(被动)</span>' : ''}
      \${showRecallBtn ? \`<span class="action-btn recall-btn" onclick="recallMessage('\${escapeHTML(m.msg_id)}')">撤回</span>\` : ''}
      \${showReplyBtn ? \`<span class="action-btn reply-btn" onclick="startReply('\${escapeHTML(m.msg_id)}', '\${escapeHTML(m.author_name)}')">回复</span>\` : ''}
      \${showGroupOps ? \`<span class="action-btn at-btn" onclick="insertAtTag('\${escapeHTML(m.author_name)}')">@</span>\` : ''}
      \${showGroupOps ? \`<span class="action-btn mute-btn" onclick="muteMember('\${escapeHTML(m.author_name)}')">禁言</span>\` : ''}
      \${showGroupOps ? \`<span class="action-btn kick-btn" onclick="kickMember('\${escapeHTML(m.author_name)}')">踢</span>\` : ''}
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
  document.getElementById('mode-label').innerText = '被动回复 (5分钟内有效)';
  document.getElementById('mode-label').style.color = '#ff4d4f';
  document.getElementById('reply-tip').style.display = 'block';
  document.getElementById('msg-input').focus();
}

function cancelReply() {
  replyToMsg = null;
  document.getElementById('mode-label').innerText = '主动消息';
  document.getElementById('mode-label').style.color = '#888';
  document.getElementById('reply-tip').style.display = 'none';
}

async function recallMessage(msgId) {
  if (!confirm('确定要撤回这条消息吗？')) return;
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
  } catch (e) { alert(e.message); }
}

async function muteMember(memberOpenid) {
  const mins = prompt(\`请输入要禁言用户 \${memberOpenid} 的分钟数：\`, '10');
  if (mins === null) return;
  const durationMins = parseInt(mins, 10);
  if (isNaN(durationMins) || durationMins <= 0) return alert('请输入有效的分钟数');

  try {
    const res = await fetch('/api/mute', {
      method: 'POST',
      headers: { 'Authorization': 'Bearer ' + token, 'Content-Type': 'application/json' },
      body: JSON.stringify({ groupOpenid: currentSession.id, memberOpenid: memberOpenid, durationMins: durationMins })
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error);
    alert(\`禁言成功，时长 \${durationMins} 分钟\`);
  } catch (e) { alert(e.message); }
}

async function kickMember(memberOpenid) {
  if (!confirm(\`确定要将用户 \${memberOpenid} 踢出群聊吗？\`)) return;
  const addToBlacklist = confirm('是否同时加入群黑名单？点击"确定"加入，点击"取消"仅踢出');
  try {
    const res = await fetch('/api/kick', {
      method: 'POST',
      headers: { 'Authorization': 'Bearer ' + token, 'Content-Type': 'application/json' },
      body: JSON.stringify({ groupOpenid: currentSession.id, memberOpenid: memberOpenid, addToBlacklist: addToBlacklist })
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error);
    alert('踢人操作成功');
  } catch (e) { alert(e.message); }
}

async function sendMessage() {
  if (!currentSession) return alert('请先选择会话');
  const content = document.getElementById('msg-input').value.trim();
  if (!content) return;

  const body = { sessionId: currentSession.id, isGroup: currentSession.is_group === 1, content: content };
  if (replyToMsg) {
    body.msgId = replyToMsg;
    body.msgSeq = Math.floor(Math.random() * 100) + 1;
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
    alert(e.message);
  } finally {
    btn.disabled = false; btn.innerText = '发送';
  }
}
</script>
</body>
</html>
`;
