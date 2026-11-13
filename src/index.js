// ... (保留之前的导入、工具函数、Durable Object、KV、Token 获取等逻辑不变)

// ================= 新增：撤回消息 API =================
async function recallQQMessage(env, targetId, isGroup, messageId) {
  const token = await getAccessToken(env);
  const url = isGroup
  ? `${QQ_SEND_BASE}/groups/${targetId}/messages/${messageId}`
  : `${QQ_SEND_BASE}/users/${targetId}/messages/${messageId}`;

  const res = await fetch(url, {
    method: 'DELETE',
    headers: { Authorization: `QQBot ${token}` },
  });

  if (!res.ok) {
    const error = await res.json();
    throw new Error(`撤回失败: ${error.code} ${error.message || ''}`);
  }
  return true;
}

// ================= 新增：移除成员 (单个踢人) API =================
async function kickGroupMember(env, groupOpenid, memberOpenid, addToBlacklist = false) {
  const token = await getAccessToken(env);
  const url = `${QQ_SEND_BASE}/groups/${groupOpenid}/batch_remove_members`;

  const body = {
    member_openids: [memberOpenid], // 单个踢人：数组中只传一个 ID
    add_to_member_blacklist: addToBlacklist
  };

  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `QQBot ${token}` },
    body: JSON.stringify(body),
  });

  const data = await res.json();
  if (data.code) throw new Error(`踢人失败: ${data.code} ${data.message || ''}`);
  return data;
}

// ================= 更新：发送消息 API (支持 @ 提及) =================
async function sendQQMessage(env, targetId, isGroup, content, msgId = null, msgSeq = 1) {
  const token = await getAccessToken(env);
  const url = isGroup ? `${QQ_SEND_BASE}/groups/${targetId}/messages` : `${QQ_SEND_BASE}/users/${targetId}/messages`;

  const body = {};
  if (msgId) { body.msg_id = msgId; body.msg_seq = msgSeq; }

  // 自动检测 @ 标签，若存在则使用 Markdown 消息类型
  if (content.includes('<qqbot-at-user') || content.includes('<qqbot-at-everyone')) {
    body.msg_type = 2; // Markdown 类型
    body.markdown = { content: content };
    body.content = '';
  } else {
    body.msg_type = 0; // 普通文本
    body.content = content;
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

// ================= API 路由 (新增 /api/recall 和 /api/kick) =================
async function handleApi(request, env, path) {
  try {
    // ... (保留健康检查、文件读取、登录、会话/消息列表等逻辑)

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

    // 👇 新增：撤回消息接口
    if (path === '/api/recall' && request.method === 'POST') {
      const { sessionId, isGroup, messageId } = await request.json();
      if (!sessionId || !messageId) return Response.json({ error: '参数缺失' }, { status: 400 });

      await recallQQMessage(env, sessionId, isGroup, messageId);

      // 从数据库中删除该消息记录
      await env.DB.prepare(`DELETE FROM messages WHERE msg_id = ?`).bind(messageId).run();

      const id = env.CHAT_ROOM.idFromName('global');
      await env.CHAT_ROOM.get(id).broadcast({ type: 'update', sessionId });

      return Response.json({ ok: true });
    }

    // 👇 新增：单个踢人接口
    if (path === '/api/kick' && request.method === 'POST') {
      const { groupOpenid, memberOpenid, addToBlacklist } = await request.json();
      if (!groupOpenid || !memberOpenid) return Response.json({ error: '参数缺失' }, { status: 400 });

      await kickGroupMember(env, groupOpenid, memberOpenid, addToBlacklist);
      return Response.json({ ok: true });
    }

    return Response.json({ error: 'Not Found' }, { status: 404 });
  } catch (err) {
    console.error('【API 异常】', path, err.message, err.stack);
    return Response.json({ error: err.message || 'Server Error' }, { status: 500 });
  }
}

// ... (保留 Webhook 和入口逻辑不变)
