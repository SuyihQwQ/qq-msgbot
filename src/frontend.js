export const FRONTEND_HTML = `
<!DOCTYPE html>
<html lang="zh-CN">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>QQ MsgBot 控制台</title>
<style>
/* ... (保留之前所有的 CSS 样式) ... */
.recall-btn { font-size: 12px; color: #ff4d4f; cursor: pointer; margin-left: 10px; text-decoration: underline;}
.kick-btn { font-size: 12px; color: #fa8c16; cursor: pointer; margin-left: 8px; text-decoration: underline;}
</style>
</head>
<body>
<!-- ... (保留之前的 HTML 结构) ... -->

<script>
// ... (保留之前所有的变量声明和基础函数) ...

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

      // 撤回按钮：仅对机器人发送且 2 分钟内的消息显示
      const showRecallBtn = isOut && isWithin2Mins;
      // 踢人按钮：仅群聊且非机器人发送的消息显示
      const showKickBtn = !isOut && currentSession.is_group === 1;

      let attachmentsHtml = '';
      // ... (保留附件渲染逻辑) ...

      return \`
      <div class="msg \${isOut ? 'outgoing' : 'incoming'}">
      <div class="msg-author">
      \${!isOut ? escapeHTML(m.author_name || '用户') : ''}
      \${showKickBtn ? \`<span class="kick-btn" onclick="kickMember('\${escapeHTML(m.author_name)}')">踢</span>\` : ''}
      </div>
      <div class="msg-bubble">
      \${m.content ? escapeHTML(m.content) : ''}
      \${attachmentsHtml}
      </div>
      <div class="msg-meta">
      \${new Date(m.timestamp).toLocaleTimeString()}
      \${isOut && m.is_passive ? '<span style="color:#52c41a">(被动回复)</span>' : ''}
      \${showRecallBtn ? \`<span class="recall-btn" onclick="recallMessage('\${escapeHTML(m.msg_id)}')">撤回</span>\` : ''}
      \${showReplyBtn ? \`<span class="reply-btn" onclick="startReply('\${escapeHTML(m.msg_id)}', '\${escapeHTML(m.author_name)}')">回复此消息(被动)</span>\` : ''}
      </div>
      </div>
      \`;
    }).join('');

    // 自动滚动逻辑
    const isNearBottom = msgEl.scrollHeight - msgEl.scrollTop - msgEl.clientHeight < 150;
    if (!isPush || isNearBottom) {
      setTimeout(() => { msgEl.scrollTop = msgEl.scrollHeight; }, 0);
    }
  } catch (e) {}
}

// 👇 修改 startReply，支持自动插入 @ 标签
function startReply(msgId, authorName) {
  replyToMsg = msgId;
  document.getElementById('mode-label').innerText = '被动回复 (5分钟内有效)';
  document.getElementById('mode-label').style.color = '#ff4d4f';
  document.getElementById('reply-tip').style.display = 'block';

  // 自动 @ 对方（如果对方是普通用户而非机器人）
  if (authorName && authorName !== '未知用户' && !authorName.includes('Bot')) {
    // 注意：QQ 的 @ 需要 member_openid，这里作者名存的就是完整 ID
    const atTag = \`<qqbot-at-user id="\${authorName}" /> \`;
    const inputEl = document.getElementById('msg-input');
    if (!inputEl.value.includes(atTag)) {
      inputEl.value = atTag + inputEl.value;
    }
  }
  document.getElementById('msg-input').focus();
}

// 👇 新增：撤回消息
async function recallMessage(msgId) {
  if (!confirm('确定要撤回这条消息吗？')) return;
  try {
    const res = await fetch('/api/recall', {
      method: 'POST',
      headers: { 'Authorization': 'Bearer ' + token, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        sessionId: currentSession.id,
        isGroup: currentSession.is_group === 1,
        messageId: msgId
      })
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error);
    document.getElementById('messages').dataset.count = -1; // 强制刷新
  } catch (e) {
    alert(e.message);
  }
}

// 👇 新增：踢人
async function kickMember(memberOpenid) {
  if (!confirm(\`确定要将用户 \${memberOpenid} 踢出群聊吗？\`)) return;

  const addToBlacklist = confirm('是否同时加入群黑名单？点击"确定"加入，点击"取消"仅踢出');

  try {
    const res = await fetch('/api/kick', {
      method: 'POST',
      headers: { 'Authorization': 'Bearer ' + token, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        groupOpenid: currentSession.id,
        memberOpenid: memberOpenid,
        addToBlacklist: addToBlacklist
      })
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error);
    alert('踢人操作成功');
  } catch (e) {
    alert(e.message);
  }
}

// ... (保留 cancelReply, sendMessage, loadSessions, initWebSocket 等函数不变)
</script>
</body>
</html>
`;
