import * as ed from '@noble/ed25519';
import { sha512 } from '@noble/hashes/sha2.js';

ed.hashes.sha512 = sha512;

const QQ_TOKEN_URL = 'https://api.bot.qq.com/app/getAppAccessToken';
const QQ_SEND_BASE = 'https://api.sgroup.qq.com/v2';

// ================= 工具函数 =================
function concatBytes(a, b) {
  const out = new Uint8Array(a.length + b.length);
  out.set(a); out.set(b, a.length);
  return out;
}
function hexToBytes(hex) {
  const bytes = new Uint8Array(hex.length / 2);
  for (let i = 0; i < bytes.length; i++) bytes[i] = parseInt(hex.substr(i * 2, 2), 16);
  return bytes;
}
function bytesToHex(bytes) {
  return Array.from(bytes, b => b.toString(16).padStart(2, '0')).join('');
}
function buildEd25519Seed(secret) {
  if (!secret) throw new Error('QQ_CLIENT_SECRET is empty');
  let seed = new TextEncoder().encode(secret);
  while (seed.length < 32) seed = concatBytes(seed, seed);
  return seed.slice(0, 32);
}

// 解析消息内容（支持多附件）
function parseMessageContent(d) {
  let contentText = d.content || '';
  if (!contentText.trim() && d.attachments && d.attachments.length > 0) {
    const tags = d.attachments.map(att => {
      if (att.content_type?.includes('image')) return '[图片]';
      if (att.content_type?.includes('voice')) return '[语音]';
      if (att.content_type?.includes('video')) return '[视频]';
      return '[文件/附件]';
    });
    contentText = tags.join(' ');
  }
  if (!contentText.trim()) contentText = '[不支持的消息类型]';
  return contentText;
}

// ================= QQ API 逻辑 =================
let tokenPromise = null;
let tokenExpiresAt = 0;

async function getAccessToken(env) {
  const now = Date.now();
  if (tokenPromise && now < tokenExpiresAt - 60_000) {
    return tokenPromise;
  }

  // 使用 Promise 防止并发穿透
  tokenPromise = (async () => {
    const res = await fetch(QQ_TOKEN_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ appId: env.QQ_APP_ID, clientSecret: env.QQ_CLIENT_SECRET }),
    });
    const data = await res.json();
    if (data.code) {
      tokenPromise = null; // 失败则清空，允许下次重试
      throw new Error(`获取 token 失败: ${data.code} ${data.message || ''}`);
    }
    tokenExpiresAt = now + (data.expires_in || 7200) * 1000;
    return data.access_token;
  })();

  try {
    return await tokenPromise;
  } catch (e) {
    tokenPromise = null;
    throw e;
  }
}

async function sendQQMessage(env, targetId, isGroup, content, msgId = null, msgSeq = 1) {
  const token = await getAccessToken(env);
  const url = isGroup ? `${QQ_SEND_BASE}/groups/${targetId}/messages` : `${QQ_SEND_BASE}/users/${targetId}/messages`;
  const body = { msg_type: 0, content };
  
  if (msgId) {
    body.msg_id = msgId;
    body.msg_seq = msgSeq;
  }
  
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `QQBot ${token}` },
    body: JSON.stringify(body),
  });
  const data = await res.json();
  if (data.code) throw new Error(`发送失败: ${data.code} ${data.message || ''}`);
  return data;
}

async function handleValidation(plainToken, eventTs, env) {
  const seed = buildEd25519Seed(env.QQ_CLIENT_SECRET);
  const msg = new TextEncoder().encode(eventTs + plainToken);
  const signature = ed.sign(msg, seed);
  return Response.json({ plain_token: plainToken, signature: bytesToHex(signature) });
}

async function verifyQQSignature(env, signatureHex, timestamp, rawBody) {
  const seed = buildEd25519Seed(env.QQ_CLIENT_SECRET);
  const publicKey = ed.getPublicKey(seed);
  const message = concatBytes(new TextEncoder().encode(timestamp), new Uint8Array(rawBody));
  return ed.verify(hexToBytes(signatureHex), message, publicKey);
}

// ================= 异步处理 QQ 消息 (写库) =================
async function processIncomingMessage(payload, env) {
  try {
    console.log('【后台处理】收到事件类型:', payload.t);

    const d = payload.d || {};
    const isGroup = payload.t.startsWith('GROUP');
    const sessionId = isGroup ? d.group_openid : d.author?.user_openid;
    const authorName = isGroup ? d.author?.member_openid : d.author?.user_openid;

    if (!sessionId) return;

    const sessionKey = `session:${sessionId}`;
    let sessionData = await env.BOT_KV.get(sessionKey);
    let session = sessionData ? JSON.parse(sessionData) : { id: sessionId, isGroup, name: isGroup ? `群聊 (${sessionId})` : `用户 (${authorName})` };
    
    const safeContent = parseMessageContent(d);

    session.lastActive = Date.now();
    session.lastMessage = safeContent;
    await env.BOT_KV.put(sessionKey, JSON.stringify(session));

    const msgKey = `messages:${sessionId}`;
    let msgs = JSON.parse(await env.BOT_KV.get(msgKey) || '[]');
    
    if (msgs.some(m => m.msgId === d.id)) return; // 消息去重

    msgs.push({
      type: 'incoming', role: 'user',
      content: safeContent, msgId: d.id, timestamp: Date.now(),
      authorName: authorName
    });
    
    if (msgs.length > 500) msgs = msgs.slice(-500);
    await env.BOT_KV.put(msgKey, JSON.stringify(msgs));

    console.log('【后台处理】消息写入 KV 成功, session:', sessionId);
  } catch (e) {
    console.error('【后台处理】消息写入 KV 失败:', e.message);
  }
}

// ================= API 路由 (供前端调用) =================
async function handleApi(request, env, path) {
  try {
    if (path === '/api/login' && request.method === 'POST') {
      const { password } = await request.json();
      if (password === env.WEB_PASSWORD) {
        return Response.json({ token: env.WEB_PASSWORD });
      }
      return Response.json({ error: '密码错误' }, { status: 401 });
    }

    const authHeader = request.headers.get('Authorization');
    if (authHeader !== `Bearer ${env.WEB_PASSWORD}`) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    if (path === '/api/sessions' && request.method === 'GET') {
      const list = await env.BOT_KV.list({ prefix: 'session:' });
      const sessions = await Promise.all(list.keys.map(async k => {
        const data = await env.BOT_KV.get(k.name);
        return JSON.parse(data);
      }));
      sessions.sort((a, b) => b.lastActive - a.lastActive);
      return Response.json(sessions);
    }

    if (path === '/api/messages' && request.method === 'GET') {
      const sessionId = new URL(request.url).searchParams.get('id');
      if (!sessionId) return Response.json({ error: 'Missing ID' }, { status: 400 });
      const data = await env.BOT_KV.get(`messages:${sessionId}`);
      return Response.json(data ? JSON.parse(data) : []);
    }

    if (path === '/api/send' && request.method === 'POST') {
      const { sessionId, isGroup, content, msgId, msgSeq } = await request.json();
      if (!sessionId || !content) return Response.json({ error: '参数缺失' }, { status: 400 });

      const res = await sendQQMessage(env, sessionId, isGroup, content, msgId, msgSeq || 1);
      
      const key = `messages:${sessionId}`;
      let msgs = JSON.parse(await env.BOT_KV.get(key) || '[]');
      msgs.push({
        type: 'outgoing', role: 'bot',
        content, msgId: res.id, timestamp: Date.now(),
        isPassive: !!msgId
      });
      if (msgs.length > 500) msgs = msgs.slice(-500);
      await env.BOT_KV.put(key, JSON.stringify(msgs));
      
      return Response.json({ ok: true, msgId: res.id });
    }

    return Response.json({ error: 'Not Found' }, { status: 404 });
  } catch (err) {
    return Response.json({ error: err.message || 'Server Error' }, { status: 500 });
  }
}

// ================= Webhook (接收 QQ 消息) =================
async function handleQQWebhook(request, env, ctx) {
  try {
    const rawBody = await request.arrayBuffer();
    const payload = JSON.parse(new TextDecoder().decode(rawBody));

    if (payload.op === 13 && payload.d?.plain_token && payload.d?.event_ts) {
      return handleValidation(payload.d.plain_token, payload.d.event_ts, env);
    }

    const signature = request.headers.get('X-Signature-Ed25519');
    const timestamp = request.headers.get('X-Signature-Timestamp');
    if (signature && timestamp) {
      const valid = await verifyQQSignature(env, signature, timestamp, rawBody);
      if (!valid) console.warn('验签未通过');
    }

    if (['GROUP_AT_MESSAGE_CREATE', 'GROUP_MESSAGE_CREATE', 'C2C_MESSAGE_CREATE'].includes(payload.t)) {
      ctx.waitUntil(processIncomingMessage(payload, env)); 
    }

    return Response.json({ ok: true });
  } catch (e) {
    console.error('Webhook 解析异常:', e.message);
    return new Response('Bad Request', { status: 400 });
  }
}

// ================= 前端 HTML 代码 =================
const FRONTEND_HTML = `
<!DOCTYPE html>
<html lang="zh-CN">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>QQ Bot 控制台</title>
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body { font-family: system-ui, sans-serif; background: #f0f2f5; height: 100vh; display: flex; }
    #login-page { display: flex; width: 100%; height: 100%; justify-content: center; align-items: center; }
    .login-box { background: white; padding: 30px; border-radius: 8px; box-shadow: 0 4px 12px rgba(0,0,0,0.1); width: 300px; }
    .login-box input { width: 100%; padding: 10px; margin: 15px 0; border: 1px solid #ccc; border-radius: 4px; }
    .login-box button { width: 100%; padding: 10px; background: #1890ff; color: white; border: none; border-radius: 4px; cursor: pointer; }
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
  <div id="login-page">
    <div class="login-box">
      <h2 style="text-align: center;">QQ Bot 控制台</h2>
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

    // 安全转义
    function escapeHTML(str) {
      return String(str).replace(/[&<>'"]/g, 
        tag => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;' }[tag] || tag)
      );
    }

    async function login() {
      const pwd = document.getElementById('pwd').value;
      try {
        const res = await fetch('/api/login', { 
          method: 'POST', 
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ password: pwd }) 
        });
        if (res.ok) {
          const data = await res.json();
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
      // 轮询
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
        if (res.status === 401) { localStorage.removeItem('bot_token'); location.reload(); return; }
        sessionsData = await res.json();
        
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
      document.getElementById('messages').dataset.count = -1; // 强制刷新
      await loadMessages(id, false);
      loadSessions();
    }

    async function loadMessages(sessionId, isPolling) {
      try {
        const res = await fetch(\`/api/messages?id=\${sessionId}\`, { headers: { 'Authorization': 'Bearer ' + token } });
        const msgs = await res.json();
        
        const msgEl = document.getElementById('messages');
        if (msgEl.dataset.count == msgs.length) return; // 数量无变化则跳过渲染
        msgEl.dataset.count = msgs.length;

        const now = Date.now();
        msgEl.innerHTML = msgs.map(m => {
          const isOut = m.type === 'outgoing';
          // 计算是否在 5 分钟内
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
        
        // 只有非轮询导致的刷新（如首次打开或发送消息后）才滚动到底部
        if (!isPolling) {
          msgEl.scrollTop = msgEl.scrollHeight;
        }
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

      const body = {
        sessionId: currentSession.id,
        isGroup: currentSession.isGroup,
        content: content,
      };
      
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

// ================= 路由入口 =================
export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);
    
    if (url.pathname === '/qq-webhook') return handleQQWebhook(request, env, ctx);
    if (url.pathname.startsWith('/api/')) return handleApi(request, env, url.pathname);
    if (url.pathname === '/') return new Response(FRONTEND_HTML, { headers: { 'Content-Type': 'text/html; charset=utf-8' } });
    
    return new Response('Not Found', { status: 404 });
  },
};
