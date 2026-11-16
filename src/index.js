import { FRONTEND_HTML } from './frontend.js';
import { createPrivateKey, createPublicKey, sign, verify } from 'node:crypto';
import { DurableObject } from 'cloudflare:workers';
import PostalMime from 'postal-mime';

const QQ_TOKEN_URL = 'https://api.bot.qq.com/app/getAppAccessToken';
const QQ_SEND_BASE = 'https://api.sgroup.qq.com/v2';
const PKCS8_HEADER = Buffer.from('302e020100300506032b657004220420', 'hex');

// ================= 工具函数 =================
function buildEd25519Seed(secret) {
  if (!secret) throw new Error('QQ_CLIENT_SECRET is empty');
  let seed = new TextEncoder().encode(secret);
  const concat = (a, b) => { const o = new Uint8Array(a.length + b.length); o.set(a); o.set(b, a.length); return o; };
  while (seed.length < 32) seed = concat(seed, seed);
  return seed.slice(0, 32);
}
function hexToBytes(hex) {
  const bytes = new Uint8Array(hex.length / 2);
  for (let i = 0; i < bytes.length; i++) bytes[i] = parseInt(hex.substr(i * 2, 2), 16);
  return bytes;
}

function parseMessageContent(d) {
  let contentText = d.content || '';
  if (!contentText.trim() && d.attachments && d.attachments.length > 0) {
    const voiceAtt = d.attachments.find(att => att.content_type?.includes('voice'));
    if (voiceAtt) {
      const asrText = d.asr_refer_text || voiceAtt.asr_refer_text;
      if (asrText) return `[语音] ${asrText}`;
      return `[语音]`;
    }
  }
  contentText = contentText.replace(/<faceType=[^>]+>/gi, '[表情]');
  contentText = contentText.replace(/<face[^>]+>/gi, '[表情]');
  contentText = contentText.replace(/<@!?([A-Za-z0-9]+)>/gi, (match, openid) => `@${openid}`);
  return contentText.trim() || '[暂不支持的消息]'; 
}

function makePrivateKey(secret) {
  const seed = buildEd25519Seed(secret);
  const pkcs8 = Buffer.concat([PKCS8_HEADER, Buffer.from(seed)]);
  return createPrivateKey({ key: pkcs8, format: 'der', type: 'pkcs8' });
}

// ================= 自动初始化 D1 =================
let dbInitialized = false;
async function ensureTables(env) {
  if (dbInitialized) return;
  try {
    await env.DB.batch([
      env.DB.prepare(`CREATE TABLE IF NOT EXISTS sessions (id TEXT PRIMARY KEY, is_group INTEGER NOT NULL, name TEXT, last_active INTEGER, last_message TEXT)`),
      env.DB.prepare(`CREATE TABLE IF NOT EXISTS messages (
        id INTEGER PRIMARY KEY AUTOINCREMENT, session_id TEXT NOT NULL, type TEXT NOT NULL, role TEXT NOT NULL, 
        content TEXT NOT NULL, attachments TEXT, msg_id TEXT, timestamp INTEGER, is_passive INTEGER DEFAULT 0, 
        author_name TEXT, quote_msg_id TEXT, quote_content TEXT
      )`),
      env.DB.prepare(`CREATE TABLE IF NOT EXISTS id_mapping (id TEXT PRIMARY KEY, nickname TEXT NOT NULL)`),
      env.DB.prepare(`CREATE TABLE IF NOT EXISTS email_mappings (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        email TEXT NOT NULL,
        session_id TEXT NOT NULL,
        is_group INTEGER NOT NULL
      )`)
    ]);
    dbInitialized = true;
  } catch (e) { console.error('❌ D1 数据库初始化失败:', e.message); }
}

// ================= Durable Object =================
export class ChatRoom extends DurableObject {
  async fetch(request) {
    const upgradeHeader = request.headers.get('Upgrade');
    if (!upgradeHeader || upgradeHeader !== 'websocket') return new Response('Expected WebSocket', { status: 426 });
    const webSocketPair = new WebSocketPair();
    const [client, server] = Object.values(webSocketPair);
    this.ctx.acceptWebSocket(server);
    return new Response(null, { status: 101, webSocket: client });
  }
  async broadcast(data) {
    const message = JSON.stringify(data);
    for (const ws of this.ctx.getWebSockets()) {
      try { ws.send(message); } catch (e) {}
    }
  }
}

// ================= KV 文件转存 =================
async function processAttachments(env, attachments) {
  if (!attachments || attachments.length === 0) return null;
  const processed = [];
  for (const att of attachments) {
    const type = att.content_type || '';
    if (type.startsWith('image/')) {
      try {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 10000);
        const fileRes = await fetch(att.url, { signal: controller.signal, headers: { 'Referer': 'https://q.qq.com/' } });
        clearTimeout(timeoutId);
        
        if (!fileRes.ok) throw new Error('下载失败');
        const buffer = await fileRes.arrayBuffer();
        if (buffer.byteLength > 2 * 1024 * 1024) {
          processed.push({ ...att, url: '', error: '文件过大(>2MB)' }); continue;
        }
        const fileId = crypto.randomUUID();
        await env.BOT_KV.put(`file:${fileId}`, buffer, { expirationTtl: 604800 });
        processed.push({ ...att, url: `/api/file/${fileId}` });
      } catch (err) {
        processed.push({ ...att, url: '', error: '图片已过期或无法加载' });
      }
    }
  }
  return processed.length > 0 ? JSON.stringify(processed) : null;
}

// ================= QQ API 逻辑 =================
let tokenPromise = null;
let tokenExpiresAt = 0;

async function getAccessToken(env) {
  const now = Date.now();
  if (tokenPromise && now < tokenExpiresAt - 60_000) return tokenPromise;
  tokenPromise = (async () => {
    const res = await fetch(QQ_TOKEN_URL, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ appId: env.QQ_APP_ID, clientSecret: env.QQ_CLIENT_SECRET }),
    });
    const data = await res.json();
    if (data.code) { tokenPromise = null; throw new Error(`获取 token 失败: ${data.code}`); }
    tokenExpiresAt = now + (data.expires_in || 7200) * 1000;
    return data.access_token;
  })();
  try { return await tokenPromise; } catch (e) { tokenPromise = null; throw e; }
}

async function sendQQMessage(env, targetId, isGroup, content, msgId = null, msgSeq = 1, quoteMsgId = null) {
  const token = await getAccessToken(env);
  const url = isGroup ? `${QQ_SEND_BASE}/groups/${targetId}/messages` : `${QQ_SEND_BASE}/users/${targetId}/messages`;
  const body = {};
  if (msgId) { body.msg_id = msgId; body.msg_seq = msgSeq; }
  if (quoteMsgId) { body.message_reference = { message_id: quoteMsgId }; }
  
  if (content.includes('<qqbot-at-user') || content.includes('<qqbot-at-everyone')) {
    body.msg_type = 2; body.markdown = { content: content }; body.content = ''; 
  } else {
    body.msg_type = 0; body.content = content;
  }
  
  const res = await fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `QQBot ${token}` }, body: JSON.stringify(body) });
  const data = await res.json();
  if (data.code) throw new Error(`发送失败: ${data.code} ${data.message || ''}`);
  return data;
}

// ... (省略部分与之前相同的 API 函数 recallQQMessage, kickGroupMember 等，保持逻辑一致)
async function handleValidation(plainToken, eventTs, env) {
  const privateKey = makePrivateKey(env.QQ_CLIENT_SECRET);
  const msg = Buffer.from(eventTs + plainToken, 'utf-8');
  return Response.json({ plain_token: plainToken, signature: sign(null, msg, privateKey).toString('hex') });
}

async function verifyQQSignature(env, signatureHex, timestamp, rawBody) {
  const privateKey = makePrivateKey(env.QQ_CLIENT_SECRET);
  const publicKey = createPublicKey(privateKey);
  const msg = Buffer.concat([Buffer.from(timestamp, 'utf-8'), Buffer.from(rawBody)]);
  return verify(null, msg, publicKey, Buffer.from(signatureHex, 'hex'));
}

// ================= 异步处理：普通聊天消息 =================
async function processIncomingMessage(payload, env, ctx) {
  try {
    await ensureTables(env);
    const d = payload.d || {};
    const isGroup = payload.t.startsWith('GROUP');
    const sessionId = isGroup ? d.group_openid : d.author?.user_openid;
    const authorOpenid = isGroup ? d.author?.member_openid : d.author?.user_openid;
    const authorName = authorOpenid ? authorOpenid : '未知用户';
    if (!sessionId) return;

    let safeContent = parseMessageContent(d);
    let quoteMsgId = null;
    let quoteContent = null;
    if (d.message_type === 103 && d.msg_elements && d.msg_elements.length > 0) {
      const refElement = d.msg_elements[0];
      quoteMsgId = refElement.msg_idx || null; 
      quoteContent = parseMessageContent(refElement);
      if (!safeContent) safeContent = '[引用消息]';
    }

    const attachmentsData = await processAttachments(env, d.attachments);
    
    let previewContent = safeContent;
    if (!previewContent && attachmentsData) {
      try {
        const atts = JSON.parse(attachmentsData);
        if (atts.some(a => a.content_type?.includes('image'))) previewContent = '[图片]';
        else previewContent = '[文件]';
      } catch(e) { previewContent = '[附件]'; }
    }
    
    const suffix = authorName && authorName.length > 4 ? authorName.slice(-4) : '未知';
    const finalPreview = `[用户_${suffix}] ${previewContent}`;

    const now = Date.now();

    await env.DB.prepare(
      `INSERT INTO sessions (id, is_group, name, last_active, last_message) VALUES (?, ?, ?, ?, ?) ON CONFLICT(id) DO UPDATE SET last_active = excluded.last_active, last_message = excluded.last_message`
    ).bind(sessionId, isGroup ? 1 : 0, isGroup ? `群聊 (${sessionId})` : `用户 (${authorName})`, now, finalPreview).run();

    const existing = await env.DB.prepare(`SELECT id FROM messages WHERE msg_id = ?`).bind(d.id).first();
    if (!existing) {
      await env.DB.prepare(
        `INSERT INTO messages (session_id, type, role, content, attachments, msg_id, timestamp, author_name, quote_msg_id, quote_content) 
         VALUES (?, 'incoming', 'user', ?, ?, ?, ?, ?, ?, ?)`
      ).bind(
        sessionId, safeContent, attachmentsData, d.id, now, authorName, quoteMsgId, quoteContent
      ).run();
    }

    ctx.waitUntil(env.CHAT_ROOM.get(env.CHAT_ROOM.idFromName('global')).broadcast({ type: 'update', sessionId }));
  } catch (e) { console.error('【消息写入失败】:', e.message); }
}

// ================= API 路由 =================
async function handleApi(request, env, path, ctx) {
  try {
    if (!env.WEB_PASSWORD) {
      return Response.json({ error: 'SERVER_CONFIG_ERROR', message: 'WEB_PASSWORD not set' }, { status: 500 });
    }

    if (path === '/api/health' && request.method === 'GET') {
      const missingEnvs = [];
      if (!env.QQ_APP_ID) missingEnvs.push('QQ_APP_ID');
      if (!env.QQ_CLIENT_SECRET) missingEnvs.push('QQ_CLIENT_SECRET');
      if (missingEnvs.length > 0) return Response.json({ error: 'ENV_MISSING', missing: missingEnvs }, { status: 500 });
      if (!env.DB || !env.BOT_KV) return Response.json({ error: 'DB_NOT_BOUND' }, { status: 500 });
      return Response.json({ ok: true });
    }

    if (path.startsWith('/api/file/') && request.method === 'GET') {
      const fileId = path.split('/').pop();
      const fileBuffer = await env.BOT_KV.get(`file:${fileId}`, 'arrayBuffer');
      if (!fileBuffer) return new Response('File Not Found', { status: 404 });
      
      const uint8 = new Uint8Array(fileBuffer.slice(0, 4));
      let contentType = 'application/octet-stream';
      if (uint8[0] === 0xFF && uint8[1] === 0xD8) contentType = 'image/jpeg';
      else if (uint8[0] === 0x89 && uint8[1] === 0x50) contentType = 'image/png';

      return new Response(fileBuffer, { 
        headers: { 'Content-Type': contentType, 'Cache-Control': 'public, max-age=604800' } 
      });
    }

    if (path === '/api/login' && request.method === 'POST') {
      const { password } = await request.json();
      if (password === env.WEB_PASSWORD) return Response.json({ token: env.WEB_PASSWORD, expiresIn: 86400 });
      return Response.json({ error: '密码错误' }, { status: 401 });
    }

    const authHeader = request.headers.get('Authorization');
    if (authHeader !== `Bearer ${env.WEB_PASSWORD}`) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    await ensureTables(env);

    if (path === '/api/mappings' && request.method === 'GET') {
      const { results } = await env.DB.prepare(`SELECT * FROM id_mapping`).all();
      return Response.json(results);
    }

    if (path === '/api/mapping' && request.method === 'POST') {
      const { id, nickname } = await request.json();
      if (!id || !nickname) return Response.json({ error: '参数缺失' }, { status: 400 });
      await env.DB.prepare(
        `INSERT INTO id_mapping (id, nickname) VALUES (?, ?) ON CONFLICT(id) DO UPDATE SET nickname = excluded.nickname`
      ).bind(id, nickname).run();
      return Response.json({ ok: true });
    }

    // 👇 新增：邮件转发配置路由
    if (path === '/api/email_mappings' && request.method === 'GET') {
      const { results } = await env.DB.prepare(`SELECT * FROM email_mappings`).all();
      return Response.json(results);
    }

    if (path === '/api/email_mapping' && request.method === 'POST') {
      const { email, session_id, is_group } = await request.json();
      if (!email || !session_id) return Response.json({ error: '参数缺失' }, { status: 400 });
      await env.DB.prepare(
        `INSERT INTO email_mappings (email, session_id, is_group) VALUES (?, ?, ?)`
      ).bind(email, session_id, is_group ? 1 : 0).run();
      return Response.json({ ok: true });
    }

    if (path === '/api/email_mapping' && request.method === 'DELETE') {
      const id = new URL(request.url).searchParams.get('id');
      if (!id) return Response.json({ error: '参数缺失' }, { status: 400 });
      await env.DB.prepare(`DELETE FROM email_mappings WHERE id = ?`).bind(id).run();
      return Response.json({ ok: true });
    }

    if (path === '/api/sessions' && request.method === 'GET') {
      const { results } = await env.DB.prepare(`SELECT * FROM sessions ORDER BY last_active DESC LIMIT 100`).all();
      return Response.json(results);
    }

    if (path === '/api/messages' && request.method === 'GET') {
      const sessionId = new URL(request.url).searchParams.get('id');
      if (!sessionId) return Response.json({ error: 'Missing ID' }, { status: 400 });
      
      const { results } = await env.DB.prepare(
        `SELECT * FROM (
          SELECT * FROM messages WHERE session_id = ? ORDER BY timestamp DESC LIMIT 500
        ) ORDER BY timestamp ASC`
      ).bind(sessionId).all();
      
      return Response.json(results);
    }

    if (path === '/api/send' && request.method === 'POST') {
      const reqData = await request.json();
      const sessionId = reqData.sessionId || null;
      const isGroup = reqData.isGroup ? 1 : 0;
      const content = reqData.content || '';
      const msgId = reqData.msgId || null;
      const msgSeq = reqData.msgSeq || 1;
      const quoteMsgId = reqData.quoteMsgId || null;
      const quoteContent = reqData.quoteContent || null;

      if (!sessionId || !content) return Response.json({ error: '参数缺失' }, { status: 400 });
      
      const res = await sendQQMessage(env, sessionId, isGroup, content, msgId, msgSeq, quoteMsgId);
      const now = Date.now();
      
      await env.DB.prepare(
        `INSERT INTO messages (session_id, type, role, content, msg_id, timestamp, is_passive, quote_msg_id, quote_content) 
         VALUES (?, 'outgoing', 'bot', ?, ?, ?, ?, ?, ?)`
      ).bind(
        sessionId, content, res.id || null, now, msgId ? 1 : 0, 
        quoteMsgId || null, quoteContent || null
      ).run();
      
      await env.DB.prepare(`UPDATE sessions SET last_active = ?, last_message = ? WHERE id = ?`).bind(now, `[我] ${content}`, sessionId).run();
      
      ctx.waitUntil(env.CHAT_ROOM.get(env.CHAT_ROOM.idFromName('global')).broadcast({ type: 'update', sessionId }));
      return Response.json({ ok: true, msgId: res.id || null });
    }

    // ... (其他 API 保持不变，如 recall, kick, mute 等，为了篇幅不再赘述，请保留之前的逻辑即可) ...

    return Response.json({ error: 'Not Found' }, { status: 404 });
  } catch (err) { 
    console.error('API异常:', err);
    return Response.json({ error: err.message || 'Server Error' }, { status: 500 }); 
  }
}

// ================= Webhook 入口 =================
async function handleQQWebhook(request, env, ctx) {
  // ... (保持原样) ...
}

// ================= 路由入口与 Email Handler =================
export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);
    if (url.pathname === '/') return new Response(FRONTEND_HTML, { headers: { 'Content-Type': 'text/html; charset=utf-8' } });
    if (url.pathname === '/qq-webhook') return handleQQWebhook(request, env, ctx);
    if (url.pathname.startsWith('/api/')) return handleApi(request, env, url.pathname, ctx);
    if (url.pathname === '/ws') return env.CHAT_ROOM.get(env.CHAT_ROOM.idFromName('global')).fetch(request);
    return new Response('Not Found', { status: 404 });
  },

  // 👇 新增：接收 Cloudflare Email Routing 的邮件
  async email(message, env, ctx) {
    try {
      await ensureTables(env);
      const to = message.to;
      const from = message.from;

      // 查库匹配收件地址
      const { results } = await env.DB.prepare(
        `SELECT * FROM email_mappings WHERE email = ?`
      ).bind(to).all();

      if (!results || results.length === 0) {
        console.log(`未找到 [${to}] 的转发规则，忽略。`);
        return;
      }

      // 解析邮件内容
      const rawEmail = new Response(message.raw);
      const email = await PostalMime.parse(await rawEmail.arrayBuffer());
      const subject = email.subject || '(无主题)';
      const textBody = email.text || '(无文本内容)';

      const qqContent = `📧 新邮件通知\n发件人: ${from}\n主题: ${subject}\n\n${textBody.substring(0, 500)}${textBody.length > 500 ? '...' : ''}`;

      // 群发到匹配的会话
      for (const rule of results) {
        await sendQQMessage(env, rule.session_id, rule.is_group === 1, qqContent);
        console.log(`邮件已转发至 ${rule.session_id}`);
      }
    } catch (e) {
      console.error('邮件转发处理失败:', e.message);
    }
  }
};
