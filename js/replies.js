// ========== 回复逻辑（LeanCloud） ==========

// 加载回复列表
async function loadReplies(postId, containerId) {
  var container = document.getElementById(containerId);
  if (!container) return;

  try {
    var query = new AV.Query('Reply');
    query.equalTo('postId', postId);
    query.ascending('createdAt');
    var replies = await query.find();

    if (!replies || replies.length === 0) {
      container.innerHTML = '<p style="color:#999; padding: 12px 0;">暂无回复，来说两句吧</p>';
      return;
    }

    var user = await checkAuth();
    var currentUserId = user ? user.id : null;
    var admin = await isAdmin();

    var html = '';
    for (var i = 0; i < replies.length; i++) {
      var reply = replies[i];
      var authorName = escapeHtml(reply.get('authorName'));
      var avatarUrl = reply.get('avatarUrl') || '';
      var content = escapeHtml(reply.get('content'));
      var time = formatTime(reply.createdAt);
      var canDelete = reply.get('authorId') === currentUserId || admin;

      html +=
        '<div class="reply-item">' +
        '<div class="reply-meta">' +
        renderUserAvatar(authorName, avatarUrl, 24) +
        '<strong>' + authorName + '</strong>' +
        '<span>' + time + '</span>' +
        (canDelete ? '<span class="reply-delete" onclick="handleDeleteReply(\'' + reply.id + '\', \'' + postId + '\')">删除</span>' : '') +
        '</div>' +
        '<div class="reply-content">' + content + '</div>' +
        '</div>';
    }
    container.innerHTML = html;
  } catch (e) {
    container.innerHTML = '<div class="loading">加载回复失败</div>';
    console.error('加载回复失败:', e);
  }
}

// 发表回复
async function createReply(postId, content) {
  var user = await requireAuth();
  if (!user) return false;

  var Reply = AV.Object.extend('Reply');
  var reply = new Reply();
  reply.set('postId', postId);
  reply.set('content', content);
  reply.set('authorId', user.id);
  reply.set('authorName', getUserName(user));
  reply.set('avatarUrl', getAvatarUrl(user) || '');
  await reply.save();

  // 更新帖子回复数
  try {
    var post = await loadPost(postId);
    if (post) {
      post.increment('replyCount');
      await post.save();
    }
  } catch (e) {
    console.error('更新回复数失败:', e);
  }

  return true;
}

// 删除回复
async function deleteReply(replyId) {
  var user = await requireAuth();
  if (!user) return false;

  var query = new AV.Query('Reply');
  var reply = await query.get(replyId);
  if (!reply) throw new Error('回复不存在');

  var admin = await isAdmin();
  if (reply.get('authorId') !== user.id && !admin) {
    throw new Error('没有权限删除');
  }

  var postId = reply.get('postId');
  await reply.destroy();

  // 更新帖子回复数
  try {
    var post = await loadPost(postId);
    if (post && post.get('replyCount') > 0) {
      post.increment('replyCount', -1);
      await post.save();
    }
  } catch (e) {
    console.error('更新回复数失败:', e);
  }

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
