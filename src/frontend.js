// ... (其他代码保持不变)

// 1. 解析消息时，检测是否 @ 了 Bot
function checkIfMentionedBot(content, botId) {
  if (!botId) return false;
  // QQ 的 @ 标签格式可能是 <@!123456> 或 <@123456>
  return content.includes(`<@!${botId}>`) || content.includes(`<@${botId}>`);
}

// 2. 修改 loadMessages 渲染逻辑
async function loadMessages(sessionId, isPush) {
  // ... (前面的 fetch 逻辑不变)
  currentMsgs = msgs;

  const botId = myBotId; 
  msgEl.innerHTML = msgs.map((m, i) => {
    // ... (系统消息直接返回)
    
    // 👇 核心：判断是否 @ 了 Bot
    const isMentioned = !isOut && checkIfMentionedBot(m.content, botId);
    const mentionHtml = isMentioned ? `<div style="font-size:12px; color:#fa8c16; margin-bottom:6px; display:flex; align-items:center; gap:4px;"><span>🔔</span>有人@你</div>` : '';

    // 👇 头像逻辑：如果是 Bot，固定 'A' 蓝色；如果是用户，取备注首字母，颜色按 ID 哈希
    let avatarChar = 'U';
    let avatarColor = '#ccc';
    
    if (isOut) {
      avatarChar = 'A';
      avatarColor = '#1890ff'; // Bot 专属蓝色
    } else {
      // 优先取备注名的首字母，没有备注则取 ID 的后两位（或特定字符）
      const displayName = formatName(rawAuthorName, isGroup, false); 
      avatarChar = displayName.charAt(0).toUpperCase() || 'U';
      avatarColor = getColor(rawAuthorName); // 根据原始 ID 生成颜色
    }

    // 渲染气泡
    return `
      <div class="msg ${isOut ? 'outgoing' : 'incoming'}">
        ${mentionHtml}
        <div class="msg-author" ...>
          <div class="avatar-circle" style="background: ${avatarColor};">${avatarChar}</div>
          ${displayName}
        </div>
        ...
      </div>
    `;
  }).join('');
  // ...
}

// 3. 修改备注弹窗逻辑，保存后立即刷新
async function showMappingDialog(id) {
  // ... (弹窗逻辑不变)
  if (!confirm) return;
  const newName = document.getElementById('mapping-input').value.trim();
  
  try {
    await fetch('/api/mapping', { ... });
    idMap[id] = newName; // 更新本地字典
    showToast('备注已更新', 'success');
    
    // 👇 即时刷新：重新渲染列表和当前聊天
    await loadSessions();
    if (currentSession) {
      await loadMessages(currentSession.id, false); 
    }
  } catch (e) { ... }
}

// 4. 会话列表：整个卡片可点击，点击即修改备注
async function loadSessions() {
  // ...
  listEl.innerHTML = sessionsData.map((s, i) => {
    const displayName = formatName(s.id, s.is_group === 1);
    return `
      <!-- 👇 点击整个卡片触发 editSessionMapping，而不是只点名字 -->
      <div class="session-item ..." onclick="editSessionMapping(${i}, event)">
        <div class="session-name">${s.is_group ? '👥 ' : '👤 '}${displayName}</div>
        <div class="session-id">...</div>
        <div class="session-preview">...</div>
        <span class="delete-session-btn" onclick="event.stopPropagation(); deleteSession(${i})">🗑️</span>
      </div>
    `;
  }).join('');
}
