import * as ed from '@noble/ed25519';
import { sha512 } from '@noble/hashes/sha512';
import { FRONTEND_HTML } from './frontend.js';

// 👈 核心修复：适配 v1 版本的同步注入方式
ed.etc.sha512Sync = (...m) => sha512(ed.etc.concatBytes(...m));

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
  if (tokenPromise && now < tokenExpiresAt - 60_000) return tokenPromise;
  tokenPromise = (async () => {
    const res = await fetch(QQ_TOKEN_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ appId: env.QQ_APP_ID, clientSecret: env.QQ_CLIENT_SECRET }),
    });
    const data = await res.json();
    if (data.code) {
      tokenPromise = null;
      throw new Error(`获取 token 失败: ${data.code}`);
    }
    tokenExpiresAt = now + (data.expires_in || 7200) * 1000;
    return data.access_token;
  })();
  try { return await tokenPromise; } 
  catch (e) { tokenPromise = null; throw e; }
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
  const seed = buildEd25519Seed(env.QQ_CLIENT_SECRET);
  const msg = new TextEncoder().encode(eventTs + plainToken);
  return Response.json({ plain_token: plainToken, signature: bytesToHex(ed.sign(msg, seed)) });
}

async function verifyQQSignature(env, signatureHex, timestamp, rawBody) {
  const seed = buildEd25519Seed(env.QQ_CLIENT_SECRET);
  const publicKey = ed.getPublicKey(seed);
  const message = concatBytes(new TextEncoder().encode(timestamp), new Uint8Array(rawBody));
  return ed.verify(hexToBytes(signatureHex), message, publicKey);
}

// ================= 异步处理 QQ 消息 =================
async function processIncomingMessage(payload, env) {
  try {
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
    if (msgs.some(m => m.msgId === d.id)) return;

    msgs.push({ type: 'incoming', role: 'user', content: safeContent, msgId: d.id, timestamp: Date.now(), authorName });
    if (msgs.length > 500) msgs = msgs.slice(-500);
    await env.BOT_KV.put(msgKey, JSON.stringify(msgs));
  } catch (e) {
    console.error('【后台处理】消息写入 KV 失败:', e.message);
  }
}

// ================= API 路由 =================
async function handleApi(request, env, path) {
  try {
    if (path === '/api/login' && request.method === 'POST') {
      const { password } = await request.json();
      if (password === env.WEB_PASSWORD) return Response.json({ token: env.WEB_PASSWORD });
      return Response.json({ error: '密码错误' }, { status: 401 });
    }

    const authHeader = request.headers.get('Authorization');
    if (authHeader !== `Bearer ${env.WEB_PASSWORD}`) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    // 拦截未绑定 KV 的请求
    if (!env.BOT_KV) {
      return Response.json({ error: 'KV_NOT_BOUND' }, { status: 500 });
    }

    if (path === '/api/sessions' && request.method === 'GET') {
      const list = await env.BOT_KV.list({ prefix: 'session:' });
      const sessions = await Promise.all(list.keys.map(async k => JSON.parse(await env.BOT_KV.get(k.name))));
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
      msgs.push({ type: 'outgoing', role: 'bot', content, msgId: res.id, timestamp: Date.now(), isPassive: !!msgId });
      if (msgs.length > 500) msgs = msgs.slice(-500);
      await env.BOT_KV.put(key, JSON.stringify(msgs));
      return Response.json({ ok: true, msgId: res.id });
    }

    return Response.json({ error: 'Not Found' }, { status: 404 });
  } catch (err) {
    return Response.json({ error: err.message || 'Server Error' }, { status: 500 });
  }
}

// ================= Webhook =================
async function handleQQWebhook(request, env, ctx) {
  try {
    const rawBody = await request.arrayBuffer();
    const payload = JSON.parse(new TextDecoder().decode(rawBody));

    if (payload.op === 13 && payload.d?.plain_token) return handleValidation(payload.d.plain_token, payload.d.event_ts, env);

    const signature = request.headers.get('X-Signature-Ed25519');
    const timestamp = request.headers.get('X-Signature-Timestamp');
    if (signature && timestamp) {
      const valid = await verifyQQSignature(env, signature, timestamp, rawBody);
      if (!valid) console.warn('验签未通过');
    }

    if (['GROUP_AT_MESSAGE_CREATE', 'GROUP_MESSAGE_CREATE', 'C2C_MESSAGE_CREATE'].includes(payload.t)) {
      if (!env.BOT_KV) {
        console.error('收到消息但未绑定 KV，无法存储');
      } else {
        ctx.waitUntil(processIncomingMessage(payload, env)); 
      }
    }
    return Response.json({ ok: true });
  } catch (e) {
    return new Response('Bad Request', { status: 400 });
  }
}

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
