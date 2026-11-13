import { FRONTEND_HTML } from './frontend.js';

const QQ_TOKEN_URL = 'https://api.bot.qq.com/app/getAppAccessToken';
const QQ_SEND_BASE = 'https://api.sgroup.qq.com/v2';

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
function bytesToHex(bytes) {
  return Array.from(bytes, b => b.toString(16).padStart(2, '0')).join('');
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

// ================= 👇 原生 Web Crypto Ed25519 密钥导入 =================
// PKCS#8 头部：将 32 字节 raw seed 包装为标准 PKCS#8 私钥
const PKCS8_HEADER = new Uint8Array([
  0x30, 0x2e, 0x02, 0x01, 0x00, 0x30, 0x05, 0x06,
  0x03, 0x2b, 0x65, 0x70, 0x04, 0x22, 0x04, 0x20
]);

async function importPrivateKey(secret) {
  const seed = buildEd25519Seed(secret);
  const pkcs8 = new Uint8Array(PKCS8_HEADER.length + seed.length);
  pkcs8.set(PKCS8_HEADER);
  pkcs8.set(seed, PKCS8_HEADER.length);
  return crypto.subtle.importKey(
    'pkcs8',
    pkcs8,
    { name: 'Ed25519' },
    false,
    ['sign']
  );
}

async function importPublicKey(secret) {
  const privateKey = await importPrivateKey(secret);
  const jwk = await crypto.subtle.exportKey('jwk', privateKey);
  // 清理私钥字段，转为公钥 JWK
  delete jwk.d;
  jwk.key_ops = ['verify'];
  return crypto.subtle.importKey(
    'jwk',
    jwk,
    { name: 'Ed25519' },
    false,
    ['verify']
  );
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

// ================= 👇 原生 Web Crypto 签名与验签 =================
async function handleValidation(plainToken, eventTs, env) {
  const privateKey = await importPrivateKey(env.QQ_CLIENT_SECRET);
  // 官方要求：event_ts + plain_token
  const msg = new TextEncoder().encode(eventTs + plainToken);
  const signature = await crypto.subtle.sign('Ed25519', privateKey, msg);
  return Response.json({
    plain_token: plainToken,
    signature: bytesToHex(new Uint8Array(signature)),
  });
}

async function verifyQQSignature(env, signatureHex, timestamp, rawBody) {
  const publicKey = await importPublicKey(env.QQ_CLIENT_SECRET);
  const msg = new TextEncoder().encode(timestamp);
  const message = new Uint8Array([...msg, ...new Uint8Array(rawBody)]);
  return crypto.subtle.verify(
    'Ed25519',
    publicKey,
    hexToBytes(signatureHex),
    message
  );
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
    if (path === '/api/health' && request.method === 'GET') {
      const missingEnvs = [];
      if (!env.QQ_APP_ID) missingEnvs.push('QQ_APP_ID');
      if (!env.QQ_CLIENT_SECRET) missingEnvs.push('QQ_CLIENT_SECRET');
      if (!env.WEB_PASSWORD) missingEnvs.push('WEB_PASSWORD');

      if (missingEnvs.length > 0) return Response.json({ error: 'ENV_MISSING', missing: missingEnvs }, { status: 500 });
      if (!env.BOT_KV) return Response.json({ error: 'KV_NOT_BOUND' }, { status: 500 });
      
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

    if (payload.op === 13 && payload.d?.plain_token) {
      return await handleValidation(payload.d.plain_token, payload.d.event_ts, env);
    }

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
    console.error('【Webhook 异常】', e.message, e.stack);
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
