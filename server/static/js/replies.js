// ========== 回复逻辑（Flask API） ==========

// 加载回复列表
async function loadReplies(postId, containerId) {
  var container = document.getElementById(containerId);
  if (!container) return;

  try {
    var result = await apiFetch('/api/posts/' + postId + '/replies');
    var replies = result.results || [];

    // 获取当前用户信息
    var user = await checkAuth();
    var currentUserId = user ? user.objectId : null;
    var isAdminUser = user ? (user.role === 'admin') : false;

    if (replies.length === 0) {
      container.innerHTML = '<p class="text-subtle text-sm py-3">暂无回复，来说两句吧</p>';
      return;
    }

    var html = '';
    for (var i = 0; i < replies.length; i++) {
      var reply = replies[i];
      var authorName = escapeHtml(reply.authorName);
      var avatarUrl = reply.avatarUrl || '';
      var content = escapeHtml(reply.content);
      var time = formatTime(reply.createdAt);
      var canDelete = currentUserId && (reply.authorId === currentUserId || isAdminUser);

      html +=
        '<div class="py-3.5">' +
        '<div class="flex items-center justify-between mb-2">' +
        '<div class="flex items-center gap-2 text-[13px] text-slate-500">' +
        renderUserAvatar(authorName, avatarUrl, 24) +
        '<strong class="text-ink">' + authorName + '</strong>' +
        '<span>' + time + '</span>' +
        '</div>' +
        (canDelete ? '<span class="text-sm text-slate-400 cursor-pointer opacity-50 hover:opacity-100 hover:text-red-500 transition-all px-1 rounded" onclick="handleDeleteReply(' + reply.id + ', ' + postId + ')" title="删除回复">删除</span>' : '') +
        '</div>' +
        '<div class="text-[15px] leading-relaxed whitespace-pre-wrap break-words">' + content + '</div>' +
        '</div>';
    }
    container.innerHTML = html;
  } catch (e) {
    container.innerHTML = '<div class="text-center py-10 text-sm text-red-400">加载回复失败</div>';
    alert('错误: ' + e.message);
  }
}

// 发表回复
async function createReply(postId, content) {
  var user = await requireAuth();
  if (!user) return false;

  await apiFetch('/api/posts/' + postId + '/replies', {
    method: 'POST',
    body: JSON.stringify({ content: content })
  });
  return true;
}

// 删除回复
async function deleteReply(replyId) {
  var user = await requireAuth();
  if (!user) return false;

  await apiFetch('/api/replies/' + replyId, { method: 'DELETE' });
  return true;
}

// 处理删除回复
async function handleDeleteReply(replyId, postId) {
  if (!confirm('确定要删除这条回复吗？')) return;
  try {
    await deleteReply(replyId);
    await loadReplies(postId, 'replies-list');
  } catch (e) {
    alert('删除失败: ' + e.message);
  }
}
