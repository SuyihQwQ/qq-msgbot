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
    #login-page { display: flex; width: 100%; height: 100%; justify-content: center; align-items: center; }
    .login-box { background: white; padding: 30px; border-radius: 8px; box-shadow: 0 4px 12px rgba(0,0,0,0.1); width: 300px; }
    .login-box input { width: 100%; padding: 10px; margin: 15px 0; border: 1px solid #ccc; border-radius: 4px; }
    .login-box button { width: 100%; padding: 10px; background: #1890ff; color: white; border: none; border-radius: 4px; cursor: pointer; }
    
    /* 未绑定提示遮罩层 */
    #kv-error-layer { display: none; position: fixed; top: 0; left: 0; width: 100%; height: 100%; background: rgba(0,0,0,0.85); z-index: 9999; justify-content: center; align-items: center; color: white; text-align: left; }
    .kv-error-box { background: #1e1e1e; padding: 40px; border-radius: 8px; border: 1px solid #ff4d4f; max-width: 600px; }
    .kv-error-box h2 { color: #ff4d4f; margin-bottom: 20px; text-align: center;}
    .kv-error-box p { line-height: 1.6; margin-bottom: 15px; font-size: 14px; color: #ccc; }
    .kv-error-box code { background: #333; padding: 2px 6px; border-radius: 4px; color: #ffbaba; }
    .kv-error-box ol { margin-left: 20px; color: #ccc; font-size: 14px; line-height: 1.8; }

    #app { display: none; width: 100%; height: 100%; background: white; }
    .sidebar { width: 280px; background: #f7f7f7; border-right: 1px solid #e0e0e0; display: flex; flex-direction: column; }
    .sidebar-header { padding: 15px; border-bottom: 1px solid #e0e0e0; font-weight: bold; font-size: 18px; background: #fff;}
    .session-list { flex: 1; overflow-y: auto; }
    .session-item { padding: 15px; border-bottom: 1px solid #e0e0e0; cursor: pointer; transition: background 0.2s; }
    .session-item:hover, .session-item.active { background: #e6f7ff; }
    .session-name { font-weight: bold; margin-bottom: 5px; font-size: 14px; color: #333; }
    .session-preview { font-size: 12px; color: #888; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
    .chat-area { flex: 1; display: flex; flex-direction: column; background: #fff; }
    .chat-header { padding: 15px; border-bottom: 1px solid #e0e0e0; font-weight: bold; display: flex; justify-content: space-between; align-items: center;}
    .messages { flex: 1; overflow-y: auto; padding: 20px; background: #fafafa; display: flex; flex-direction: column; }
    .msg { margin-bottom: 15px; display: flex; flex-direction: column; max-width: 75%; }
    .msg.incoming { align-self: flex-start; }
    .msg.outgoing { align-self: flex-end; align-items: flex-end; }
    .msg-bubble { padding: 10px 15px; border-radius: 8px; font-size: 14px; word-wrap: break-word; position: relative; }
    .msg.incoming .msg-bubble { background: #fff; border: 1px solid #e0e0e0; color: #333; }
    .msg.outgoing .msg-bubble { background: #1890ff; color: #fff; }
    .msg-meta { font-size: 12px; color: #aaa; margin-top: 5px; }
    .reply-btn { font-size: 12px; color: #1890ff; cursor: pointer; margin-left: 10px; text-decoration: underline;}
    .input-area { padding: 15px; border-top: 1px solid #e0e0e0; display: flex; gap: 10px; background: #fff; }
    .input-area textarea { flex: 1; height: 60px; padding: 10px; border: 1px solid #ccc; border-radius: 4px; resize: none; }
    .input-area button { padding: 0 20px; background: #1890ff; color: white; border: none; border-radius: 4px; cursor: pointer; }
    .reply-tip { font-size: 12px; color: #ff4d4f; padding: 5px 15px; display: none; background: #fffbe6; border-bottom: 1px solid #ffe58f;}
    .reply-tip span { cursor: pointer; color: #1890ff; margin-left: 10px; }
  </style>
</head>
<body>
  <div id="kv-error-layer">
    <div class="kv-error-box">
      <h2>⚠️ 系统未就绪：缺少 KV 数据库</h2>
      <p>检测到尚未绑定 Cloudflare KV。本系统必须依赖 KV 才能存储聊天记录。</p>
      <p><b>解决方法：</b></p>
      <ol>
        <li>前往 Cloudflare 控制台，进入当前 Worker 的 <b>Settings (设置) -> Variables (变量)</b>。</li>
        <li>滚动到 <b>KV Namespace Bindings (KV 命名空间绑定)</b>，点击 <b>Add binding (添加绑定)</b>。</li>
        <li>Variable name 填入：<code>BOT_KV</code></li>
        <li>KV namespace 选择 <b>Create new (新建)</b> 或选择已有的空间。</li>
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
        <span style="font-size: 12px; color: #888;">当前模式: <span id="mode-label">主动消息</span></span>
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
    let pollInterval = null;

    function escapeHTML(str) {
      return String(str).replace(/[&<>'"]/g, 
        tag => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;' }[tag] || tag)
      );
    }

    function checkKvError(data) {
      if (data && data.error === 'KV_NOT_BOUND') {
        document.getElementById('kv-error-layer').style.display = 'flex';
        if (pollInterval) clearInterval(pollInterval);
        return true;
      }
      return false;
    }

    async function login() {
      const pwd = document.getElementById('pwd').value;
      try {
        const res = await fetch('/api/login', { 
          method: 'POST', 
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ password: pwd }) 
        });
        const data = await res.json();
        if (checkKvError(data)) return;
        
        if (res.ok) {
          token = data.token;
          localStorage.setItem('bot_token', token);
          showApp();
        } else {
          alert('密码错误');
        }
      } catch (e) {
        alert('网络请求失败');
      }
    }

    function showApp() {
      document.getElementById('login-page').style.display = 'none';
      document.getElementById('app').style.display = 'flex';
      loadSessions();
      if (pollInterval) clearInterval(pollInterval);
      pollInterval = setInterval(() => {
        loadSessions();
        if (currentSession) loadMessages(currentSession.id, true);
      }, 3000);
    }

    if (token) showApp();

    async function loadSessions() {
      try {
        const res = await fetch('/api/sessions', { headers: { 'Authorization': 'Bearer ' + token } });
        const data = await res.json();
        if (checkKvError(data)) return;
        
        if (res.status === 401) { localStorage.removeItem('bot_token'); location.reload(); return; }
        sessionsData = data;
        
        const listEl = document.getElementById('session-list');
        listEl.innerHTML = sessionsData.map(s => \`
          <div class="session-item \${currentSession?.id === s.id ? 'active' : ''}" onclick="selectSession('\${escapeHTML(s.id)}')">
            <div class="session-name">\${s.isGroup ? '👥 群聊' : '👤 私聊'} - \${escapeHTML(s.id.substring(0,8))}...</div>
            <div class="session-preview">\${escapeHTML(s.lastMessage || '暂无消息')}</div>
          </div>
        \`).join('');
      } catch (e) {}
    }

    async function selectSession(id) {
      if (currentSession?.id === id) return;
      currentSession = sessionsData.find(s => s.id === id);
      document.getElementById('chat-title').innerText = (currentSession.isGroup ? '群聊' : '私聊') + ' - ' + id.substring(0,12);
      cancelReply();
      document.getElementById('messages').dataset.count = -1;
      await loadMessages(id, false);
      loadSessions();
    }

    async function loadMessages(sessionId, isPolling) {
      try {
        const res = await fetch(\`/api/messages?id=\${sessionId}\`, { headers: { 'Authorization': 'Bearer ' + token } });
        const msgs = await res.json();
        if (checkKvError(msgs)) return;
        
        const msgEl = document.getElementById('messages');
        if (msgEl.dataset.count == msgs.length) return;
        msgEl.dataset.count = msgs.length;

        const now = Date.now();
        msgEl.innerHTML = msgs.map(m => {
          const isOut = m.type === 'outgoing';
          const isWithin5Mins = (now - m.timestamp) < 5 * 60 * 1000;
          const showReplyBtn = !isOut && isWithin5Mins;

          return \`
            <div class="msg \${isOut ? 'outgoing' : 'incoming'}">
              <div class="msg-bubble">\${escapeHTML(m.content)}</div>
              <div class="msg-meta">
                \${new Date(m.timestamp).toLocaleTimeString()}
                \${isOut && m.isPassive ? '<span style="color:#52c41a">(被动回复)</span>' : ''}
                \${showReplyBtn ? \`<span class="reply-btn" onclick="startReply('\${escapeHTML(m.msgId)}')">回复此消息(被动)</span>\` : ''}
              </div>
            </div>
          \`;
        }).join('');
        
        if (!isPolling) msgEl.scrollTop = msgEl.scrollHeight;
      } catch (e) {}
    }

    function startReply(msgId) {
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

    async function sendMessage() {
      if (!currentSession) return alert('请先选择会话');
      const content = document.getElementById('msg-input').value.trim();
      if (!content) return;

      const body = { sessionId: currentSession.id, isGroup: currentSession.isGroup, content: content };
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
        if (checkKvError(data)) return;
        if (!res.ok) throw new Error(data.error);
        
        cancelReply();
        document.getElementById('messages').dataset.count = -1;
        await loadMessages(currentSession.id, false);
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
