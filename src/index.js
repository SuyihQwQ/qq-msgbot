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

// ================= node:crypto 密钥构造 =================
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
                       env.DB.prepare(`CREATE TABLE IF NOT EXISTS id_mapping (id TEXT PRIMARY KEY, nickname TEXT NOT NULL)`)
    ]);
    // 兼容老数据
    try { await env.DB.exec(`ALTER TABLE messages ADD COLUMN attachments TEXT`); } catch (e) {}
    try { await env.DB.exec(`ALTER TABLE messages ADD COLUMN quote_msg_id TEXT`); } catch (e) {}
    try { await env.DB.exec(`ALTER TABLE messages ADD COLUMN quote_content TEXT`); } catch (e) {}
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

async function recallQQMessage(env, targetId, isGroup, messageId) {
  const token = await getAccessToken(env);
  const url = isGroup ? `${QQ_SEND_BASE}/groups/${targetId}/messages/${messageId}` : `${QQ_SEND_BASE}/users/${targetId}/messages/${messageId}`;
  const res = await fetch(url, { method: 'DELETE', headers: { Authorization: `QQBot ${token}` } });
  if (!res.ok) {
    let errMsg = '';
    try {
      const error = await res.json();
      if (error.code === 11253) errMsg = '无操作权限：请确保机器人是群管理员，且该接口已在平台申请白名单。';
      else if (error.code === 40064004) errMsg = '消息发送超过 2 分钟，无法撤回。';
      else errMsg = `撤回失败: ${error.code} ${error.message || ''}`;
    } catch (e) { errMsg = '撤回失败: 未知错误'; }
    throw new Error(errMsg);
  }
  return true;
}

async function kickGroupMember(env, groupOpenid, memberOpenid, addToBlacklist = false) {
  const token = await getAccessToken(env);
  const res = await fetch(`${QQ_SEND_BASE}/groups/${groupOpenid}/batch_remove_members`, {
    method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `QQBot ${token}` },
    body: JSON.stringify({ member_openids: [memberOpenid], add_to_member_blacklist: addToBlacklist }),
  });
  const data = await res.json();
  if (data.code) {
    let errMsg = `踢人失败: ${data.code} ${data.message || ''}`;
    if (data.code === 11253) errMsg = '踢人失败: 该接口需要向平台申请白名单（11253）';
    throw new Error(errMsg);
  }
  return data;
}

async function muteGroupMember(env, groupOpenid, memberOpenid, durationMins) {
  const token = await getAccessToken(env);
  const muteExpireAt = new Date(Date.now() + durationMins * 60 * 1000).toISOString().replace('Z', '+00:00');
  const res = await fetch(`${QQ_SEND_BASE}/groups/${groupOpenid}/restrict_chat_setting`, {
    method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `QQBot ${token}` },
    body: JSON.stringify({ members: [{ op: "add", member_openid: memberOpenid, mute_expire_at: muteExpireAt }] }),
  });
  const data = await res.json();
  if (data.code) {
    let errMsg = `禁言失败: ${data.code} ${data.message || ''}`;
    if (data.code === 11253) errMsg = '禁言失败: 该接口需要向平台申请白名单（11253）';
    throw new Error(errMsg);
  }
  return data;
}

async function unmuteGroupMember(env, groupOpenid, memberOpenid) {
  const token = await getAccessToken(env);
  const res = await fetch(`${QQ_SEND_BASE}/groups/${groupOpenid}/restrict_chat_setting`, {
    method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `QQBot ${token}` },
    body: JSON.stringify({ members: [{ op: "del", member_openid: memberOpenid, mute_expire_at: "" }] }),
  });
  const data = await res.json();
  if (data.code) {
    let errMsg = `解除禁言失败: ${data.code} ${data.message || ''}`;
    if (data.code === 11253) errMsg = '解除禁言失败: 该接口需要向平台申请白名单（11253）';
    throw new Error(errMsg);
  }
  return data;
}

async function getMuteStatus(env, groupOpenid, memberOpenid) {
  const token = await getAccessToken(env);
  const res = await fetch(`${QQ_SEND_BASE}/groups/${groupOpenid}/restrict_chat_setting`, {
    method: 'GET', headers: { Authorization: `QQBot ${token}` },
  });
  const data = await res.json();
  if (data.code) throw new Error(`查询失败: ${data.code} ${data.message || ''}`);

  const mutedMember = data.members?.find(m => m.member_openid === memberOpenid);
  return {
    isMuted: !!mutedMember,
    expireAt: mutedMember ? mutedMember.mute_expire_at : null,
    globalRule: data.global_rule
  };
}

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

// ================= 异步处理：系统事件 =================
async function processSystemEvent(payload, env, ctx) {
  try {
    await ensureTables(env);
    const d = payload.d || {}; const t = payload.t;
    let sessionId = ''; let isGroup = 1; let content = '';

    switch (t) {
      case 'GROUP_ADD_ROBOT': sessionId = d.group_openid; content = `[系统] 机器人加入了群聊`; break;
      case 'GROUP_DEL_ROBOT': sessionId = d.group_openid; content = `[系统] 机器人被移出了群聊`; break;
      case 'GROUP_MEMBER_ADD': sessionId = d.group_openid; content = `[系统] 新成员 ${d.member_openid || '未知'} 加入了群聊`; break;
      case 'GROUP_MEMBER_REMOVE': sessionId = d.group_openid; content = `[系统] 成员 ${d.member_openid || '未知'} 退出了群聊`; break;
      case 'GROUP_MSG_RECEIVE': sessionId = d.group_openid; content = `[系统] 群聊开启了消息推送`; break;
      case 'GROUP_MSG_REJECT': sessionId = d.group_openid; content = `[系统] 群聊关闭了消息推送`; break;
      case 'GROUP_JOIN_REQUEST': sessionId = d.group_openid; content = `[系统] 收到新的加群申请`; break;
      case 'FRIEND_ADD': sessionId = d.openid; isGroup = 0; content = `[系统] 用户添加了机器人好友`; break;
      case 'FRIEND_DEL': sessionId = d.openid; isGroup = 0; content = `[系统] 用户删除了机器人好友`; break;
      case 'C2C_MSG_RECEIVE': sessionId = d.openid; isGroup = 0; content = `[系统] 用户开启了单聊消息推送`; break;
      case 'C2C_MSG_REJECT': sessionId = d.openid; isGroup = 0; content = `[系统] 用户关闭了单聊消息推送`; break;
      default: return;
    }

    if (!sessionId) return;
    const now = Date.now();

    await env.DB.prepare(
      `INSERT INTO sessions (id, is_group, name, last_active, last_message) VALUES (?, ?, ?, ?, ?) ON CONFLICT(id) DO UPDATE SET last_active = excluded.last_active, last_message = excluded.last_message`
    ).bind(sessionId, isGroup, isGroup ? `群聊 (${sessionId})` : `用户 (${sessionId})`, now, content).run();

    await env.DB.prepare(
      `INSERT INTO messages (session_id, type, role, content, msg_id, timestamp, author_name) VALUES (?, 'system', 'system', ?, ?, ?, 'System')`
    ).bind(sessionId, content, `sys_${crypto.randomUUID()}`, now).run();

    ctx.waitUntil(env.CHAT_ROOM.get(env.CHAT_ROOM.idFromName('global')).broadcast({ type: 'update', sessionId }));
  } catch (e) { console.error('【系统事件处理失败】:', e.message); }
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

    if (path === '/api/sessions' && request.method === 'GET') {
      const { results } = await env.DB.prepare(`SELECT * FROM sessions ORDER BY last_active DESC LIMIT 100`).all();
      return Response.json(results);
    }

    // 👇 修复：改用子查询获取最新的 500 条记录
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

    if (path === '/api/recall' && request.method === 'POST') {
      const { sessionId, isGroup, messageId } = await request.json();
      if (!sessionId || !messageId) return Response.json({ error: '参数缺失' }, { status: 400 });
      await recallQQMessage(env, sessionId, isGroup, messageId);
      await env.DB.prepare(`DELETE FROM messages WHERE msg_id = ?`).bind(messageId).run();
      ctx.waitUntil(env.CHAT_ROOM.get(env.CHAT_ROOM.idFromName('global')).broadcast({ type: 'update', sessionId }));
      return Response.json({ ok: true });
    }

    if (path === '/api/kick' && request.method === 'POST') {
      const { groupOpenid, memberOpenid, addToBlacklist } = await request.json();
      if (!groupOpenid || !memberOpenid) return Response.json({ error: '参数缺失' }, { status: 400 });
      await kickGroupMember(env, groupOpenid, memberOpenid, addToBlacklist);
      return Response.json({ ok: true });
    }

    if (path === '/api/mute_status' && request.method === 'GET') {
      const urlObj = new URL(request.url);
      const groupOpenid = urlObj.searchParams.get('group_id');
      const memberOpenid = urlObj.searchParams.get('member_id');
      if (!groupOpenid || !memberOpenid) return Response.json({ error: '参数缺失' }, { status: 400 });

      const status = await getMuteStatus(env, groupOpenid, memberOpenid);
      return Response.json(status);
    }

    if (path === '/api/mute' && request.method === 'POST') {
      const { groupOpenid, memberOpenid, durationMins } = await request.json();
      if (!groupOpenid || !memberOpenid || !durationMins) return Response.json({ error: '参数缺失' }, { status: 400 });
      await muteGroupMember(env, groupOpenid, memberOpenid, durationMins);
      return Response.json({ ok: true });
    }

    if (path === '/api/unmute' && request.method === 'POST') {
      const { groupOpenid, memberOpenid } = await request.json();
      if (!groupOpenid || !memberOpenid) return Response.json({ error: '参数缺失' }, { status: 400 });
      await unmuteGroupMember(env, groupOpenid, memberOpenid);
      return Response.json({ ok: true });
    }

    if (path === '/api/delete_session' && request.method === 'POST') {
      const { sessionId } = await request.json();
      if (!sessionId) return Response.json({ error: '参数缺失' }, { status: 400 });
      await env.DB.prepare(`DELETE FROM messages WHERE session_id = ?`).bind(sessionId).run();
      await env.DB.prepare(`DELETE FROM sessions WHERE id = ?`).bind(sessionId).run();
      return Response.json({ ok: true });
    }

    return Response.json({ error: 'Not Found' }, { status: 404 });
  } catch (err) {
    console.error('API异常:', err);
    return Response.json({ error: err.message || 'Server Error' }, { status: 500 });
  }
}

// ================= Webhook 入口 =================
async function handleQQWebhook(request, env, ctx) {
  try {
    const rawBody = await request.arrayBuffer();
    const payload = JSON.parse(new TextDecoder().decode(rawBody));
    if (payload.op === 13 && payload.d?.plain_token) return await handleValidation(payload.d.plain_token, payload.d.event_ts, env);

    const signature = request.headers.get('X-Signature-Ed25519');
    const timestamp = request.headers.get('X-Signature-Timestamp');

    if (!signature || !timestamp) {
      return new Response('Missing Signature', { status: 401 });
    }

    const valid = await verifyQQSignature(env, signature, timestamp, rawBody);
    if (!valid) {
      console.warn('⛔ 验签未通过，拒绝处理请求');
      return new Response('Invalid Signature', { status: 401 });
    }

    const t = payload.t;
    const CHAT_EVENTS = ['GROUP_AT_MESSAGE_CREATE', 'GROUP_MESSAGE_CREATE', 'C2C_MESSAGE_CREATE'];
    const SYSTEM_EVENTS = ['GROUP_ADD_ROBOT', 'GROUP_DEL_ROBOT', 'GROUP_MEMBER_ADD', 'GROUP_MEMBER_REMOVE', 'GROUP_MSG_RECEIVE', 'GROUP_MSG_REJECT', 'GROUP_JOIN_REQUEST', 'FRIEND_ADD', 'FRIEND_DEL', 'C2C_MSG_RECEIVE', 'C2C_MSG_REJECT'];

    if (CHAT_EVENTS.includes(t)) ctx.waitUntil(processIncomingMessage(payload, env, ctx));
    else if (SYSTEM_EVENTS.includes(t)) ctx.waitUntil(processSystemEvent(payload, env, ctx));

    return Response.json({ ok: true });
  } catch (e) {
    console.error('Webhook 解析异常:', e);
    return new Response('Bad Request', { status: 400 });
  }
}

// ================= 路由入口 =================
export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);
    if (url.pathname === '/') return new Response(FRONTEND_HTML, { headers: { 'Content-Type': 'text/html; charset=utf-8' } });
    if (url.pathname === '/qq-webhook') return handleQQWebhook(request, env, ctx);
    if (url.pathname.startsWith('/api/')) return handleApi(request, env, url.pathname, ctx);
    if (url.pathname === '/ws') return env.CHAT_ROOM.get(env.CHAT_ROOM.idFromName('global')).fetch(request);
    return new Response('Not Found', { status: 404 });
  },
};
