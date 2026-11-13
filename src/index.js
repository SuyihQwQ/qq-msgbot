import { FRONTEND_HTML } from './frontend.js';
import { createPrivateKey, createPublicKey, sign, verify } from 'node:crypto';
import { DurableObject } from 'cloudflare:workers';

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
  if (!contentText.trim() && d.attachments?.length > 0) {
    const tags = d.attachments.map(att => {
      if (att.content_type?.includes('image')) return '[图片]';
      if (att.content_type?.includes('voice')) return '[语音]';
      if (att.content_type?.includes('video')) return '[视频]';
      return '[文件/附件]';
    });
    contentText = tags.join(' ');
  }
  return contentText.trim() || '[不支持的消息类型]';
}

// ================= node:crypto 密钥构造 =================
function makePrivateKey(secret) {
  const seed = buildEd25519Seed(secret);
  const pkcs8 = Buffer.concat([PKCS8_HEADER, Buffer.from(seed)]);
  return createPrivateKey({ key: pkcs8, format: 'der', type: 'pkcs8' });
}

// ================= 👇 Durable Object =================
export class ChatRoom extends DurableObject {
  async fetch(request) {
    const upgradeHeader = request.headers.get('Upgrade');
    if (!upgradeHeader || upgradeHeader !== 'websocket') {
      return new Response('Expected WebSocket', { status: 426 });
    }
    const webSocketPair = new WebSocketPair();
    const [client, server] = Object.values(webSocketPair);
    this.ctx.acceptWebSocket(server);
    return new Response(null, { status: 101, webSocket: client });
  }

  async broadcast(data) {
    const message = JSON.stringify(data);
    for (const ws of this.ctx.getWebSockets()) {
      try { ws.send(message); } catch (e) { /* ignore */ }
    }
  }
}

// ================= QQ API 逻辑 =================
let tokenPromise = null;
let tokenExpiresAt = 0;

async function getAccessToken(env) {
  const now = Date.now();
  if (tokenPromise && now < tokenExpiresAt - 60_000) return tokenPromise;
  tokenPromise = (async () => {
    const res = await fetch(QQ_TOKEN_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ appId: env.QQ_APP_ID, clientSecret: env.QQ_CLIENT_SECRET }),
    });
    const data = await res.json();
    if (data.code) { tokenPromise = null; throw new Error(`获取 token 失败: ${data.code}`); }
    tokenExpiresAt = now + (data.expires_in || 7200) * 1000;
    return data.access_token;
  })();
  try { return await tokenPromise; } catch (e) { tokenPromise = null; throw e; }
}

async function sendQQMessage(env, targetId, isGroup, content, msgId = null, msgSeq = 1) {
  const token = await getAccessToken(env);
  const url = isGroup ? `${QQ_SEND_BASE}/groups/${targetId}/messages` : `${QQ_SEND_BASE}/users/${targetId}/messages`;
  const body = { msg_type: 0, content };
  if (msgId) { body.msg_id = msgId; body.msg_seq = msgSeq; }
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
  const privateKey = makePrivateKey(env.QQ_CLIENT_SECRET);
  const msg = Buffer.from(eventTs + plainToken, 'utf-8');
  const signature = sign(null, msg, privateKey);
  return Response.json({ plain_token: plainToken, signature: signature.toString('hex') });
}

async function verifyQQSignature(env, signatureHex, timestamp, rawBody) {
  const privateKey = makePrivateKey(env.QQ_CLIENT_SECRET);
  const publicKey = createPublicKey(privateKey);
  const msg = Buffer.concat([Buffer.from(timestamp, 'utf-8'), Buffer.from(rawBody)]);
  return verify(null, msg, publicKey, Buffer.from(signatureHex, 'hex'));
}

// ================= 异步处理 QQ 消息 =================
async function processIncomingMessage(payload, env, ctx) {
  try {
    const d = payload.d || {};
    const isGroup = payload.t.startsWith('GROUP');
    const sessionId = isGroup ? d.group_openid : d.author?.user_openid;
    const authorName = isGroup ? d.author?.member_openid : d.author?.user_openid;
    if (!sessionId) return;

    const safeContent = parseMessageContent(d);
    const now = Date.now();

    await env.DB.prepare(
      `INSERT INTO sessions (id, is_group, name, last_active, last_message)
       VALUES (?, ?, ?, ?, ?)
       ON CONFLICT(id) DO UPDATE SET last_active = excluded.last_active, last_message = excluded.last_message`
    ).bind(sessionId, isGroup ? 1 : 0, isGroup ? `群聊 (${sessionId})` : `用户 (${authorName})`, now, safeContent).run();

    const existing = await env.DB.prepare(`SELECT id FROM messages WHERE msg_id = ?`).bind(d.id).first();
    if (!existing) {
      await env.DB.prepare(
        `INSERT INTO messages (session_id, type, role, content, msg_id, timestamp, author_name)
         VALUES (?, 'incoming', 'user', ?, ?, ?, ?)`
      ).bind(sessionId, safeContent, d.id, now, authorName).run();
    }

    const id = env.CHAT_ROOM.idFromName('global');
    const stub = env.CHAT_ROOM.get(id);
    ctx.waitUntil(stub.broadcast({ type: 'update', sessionId }));
  } catch (e) {
    console.error('【后台处理】消息写入失败:', e.message);
  }
}

// ================= API 路由 =================
async function handleApi(request, env, path) {
  try {
    if (path === '/api/health' && request.method === 'GET') {
      const missingEnvs = [];
      if (!env.QQ_APP_ID) missingEnvs.push('QQ_APP_ID');
      if (!env.QQ_CLIENT_SECRET) missingEnvs.push('QQ_CLIENT_SECRET');
      if (!env.WEB_PASSWORD) missingEnvs.push('WEB_PASSWORD');
      if (missingEnvs.length > 0) return Response.json({ error: 'ENV_MISSING', missing: missingEnvs }, { status: 500 });
      if (!env.DB) return Response.json({ error: 'D1_NOT_BOUND' }, { status: 500 });
      return Response.json({ ok: true });
    }

    if (path === '/api/login' && request.method === 'POST') {
      const { password } = await request.json();
      if (password === env.WEB_PASSWORD) return Response.json({ token: env.WEB_PASSWORD });
      return Response.json({ error: '密码错误' }, { status: 401 });
    }

    const authHeader = request.headers.get('Authorization');
    if (authHeader !== `Bearer ${env.WEB_PASSWORD}`) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    if (path === '/api/sessions' && request.method === 'GET') {
      const { results } = await env.DB.prepare(`SELECT * FROM sessions ORDER BY last_active DESC LIMIT 100`).all();
      return Response.json(results);
    }

    if (path === '/api/messages' && request.method === 'GET') {
      const sessionId = new URL(request.url).searchParams.get('id');
      if (!sessionId) return Response.json({ error: 'Missing ID' }, { status: 400 });
      const { results } = await env.DB.prepare(`SELECT * FROM messages WHERE session_id = ? ORDER BY timestamp ASC LIMIT 500`).bind(sessionId).all();
      return Response.json(results);
    }

    if (path === '/api/send' && request.method === 'POST') {
      const { sessionId, isGroup, content, msgId, msgSeq } = await request.json();
      if (!sessionId || !content) return Response.json({ error: '参数缺失' }, { status: 400 });
      const res = await sendQQMessage(env, sessionId, isGroup, content, msgId, msgSeq || 1);
      
      const now = Date.now();
      await env.DB.prepare(
        `INSERT INTO messages (session_id, type, role, content, msg_id, timestamp, is_passive) VALUES (?, 'outgoing', 'bot', ?, ?, ?, ?)`
      ).bind(sessionId, content, res.id, now, msgId ? 1 : 0).run();
      await env.DB.prepare(`UPDATE sessions SET last_active = ? WHERE id = ?`).bind(now, sessionId).run();
      
      const id = env.CHAT_ROOM.idFromName('global');
      await env.CHAT_ROOM.get(id).broadcast({ type: 'update', sessionId });
      
      return Response.json({ ok: true, msgId: res.id });
    }

    return Response.json({ error: 'Not Found' }, { status: 404 });
  } catch (err) {
    console.error('【API 异常】', path, err.message, err.stack);
    return Response.json({ error: err.message || 'Server Error' }, { status: 500 });
  }
}

// ================= Webhook & 入口 =================
async function handleQQWebhook(request, env, ctx) {
  try {
    const rawBody = await request.arrayBuffer();
    const payload = JSON.parse(new TextDecoder().decode(rawBody));
    if (payload.op === 13 && payload.d?.plain_token) return await handleValidation(payload.d.plain_token, payload.d.event_ts, env);

    const signature = request.headers.get('X-Signature-Ed25519');
    const timestamp = request.headers.get('X-Signature-Timestamp');
    if (signature && timestamp) {
      const valid = await verifyQQSignature(env, signature, timestamp, rawBody);
      if (!valid) console.warn('验签未通过');
    }

    if (['GROUP_AT_MESSAGE_CREATE', 'GROUP_MESSAGE_CREATE', 'C2C_MESSAGE_CREATE'].includes(payload.t)) {
      ctx.waitUntil(processIncomingMessage(payload, env, ctx));
    }
    return Response.json({ ok: true });
  } catch (e) {
    console.error('【Webhook 异常】', e.message, e.stack);
    return new Response('Bad Request', { status: 400 });
  }
}

export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);
    if (url.pathname === '/qq-webhook') return handleQQWebhook(request, env, ctx);
    if (url.pathname.startsWith('/api/')) return handleApi(request, env, url.pathname);
    if (url.pathname === '/ws') {
      const id = env.CHAT_ROOM.idFromName('global');
      const stub = env.CHAT_ROOM.get(id);
      return stub.fetch(request);
    }
    if (url.pathname === '/') return new Response(FRONTEND_HTML, { headers: { 'Content-Type': 'text/html; charset=utf-8' } });
    return new Response('Not Found', { status: 404 });
  },
};
