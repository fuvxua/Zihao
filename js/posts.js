// ========== 帖子 CRUD（LeanCloud） ==========

// 加载帖子列表
async function loadPosts(containerId) {
  var container = document.getElementById(containerId);
  if (!container) return;

  container.innerHTML = '<div class="loading">加载中...</div>';

  try {
    var query = new AV.Query('Post');
    query.descending('createdAt');
    query.limit(20);
    var posts = await query.find();

    if (!posts || posts.length === 0) {
      container.innerHTML =
        '<div class="empty-state">' +
        '<p>还没有帖子，快来发第一贴吧！</p>' +
        '<a href="create.html" class="btn btn-primary">发帖</a>' +
        '</div>';
      return;
    }

    var html = '';
    for (var i = 0; i < posts.length; i++) {
      var post = posts[i];
      var title = escapeHtml(post.get('title'));
      var authorName = escapeHtml(post.get('authorName'));
      var avatarUrl = post.get('avatarUrl') || '';
      var time = formatTime(post.createdAt);
      html +=
        '<a href="post.html?id=' + post.id + '" class="post-card" style="text-decoration:none; color:inherit;">' +
        '<div class="post-card-header">' +
        renderUserAvatar(authorName, avatarUrl, 36) +
        '<div class="post-card-info">' +
        '<div class="post-title">' + title + '</div>' +
        '<div class="post-meta">' +
        '<span>' + authorName + '</span>' +
        '<span>' + time + '</span>' +
        '</div></div></div></a>';
    }
    container.innerHTML = html;
  } catch (e) {
    container.innerHTML = '<div class="loading">加载失败，请刷新重试</div>';
    console.error('加载帖子失败:', e);
  }
}

// 加载单个帖子
async function loadPost(postId) {
  try {
    var query = new AV.Query('Post');
    var post = await query.get(postId);
    return post;
  } catch (e) {
    console.error('加载帖子失败:', e);
    return null;
  }
}

// 创建帖子
async function createPost(title, content) {
  var user = await requireAuth();
  if (!user) return false;

  var Post = AV.Object.extend('Post');
  var post = new Post();
  post.set('title', title);
  post.set('content', content);
  post.set('authorId', user.id);
  post.set('authorName', getUserName(user));
  post.set('avatarUrl', getAvatarUrl(user) || '');
  post.set('viewCount', 0);
  post.set('replyCount', 0);
  post.set('isPinned', false);
  post.set('isLocked', false);

  await post.save();
  return true;
}

// 更新帖子
async function updatePost(postId, title, content) {
  var user = await requireAuth();
  if (!user) return false;

  var post = await loadPost(postId);
  if (!post) throw new Error('帖子不存在');

  var admin = await isAdmin();
  if (post.get('authorId') !== user.id && !admin) {
    throw new Error('没有权限编辑');
  }

  post.set('title', title);
  post.set('content', content);
  await post.save();
  return true;
}

// 删除帖子
async function deletePost(postId) {
  var user = await requireAuth();
  if (!user) return false;

  var post = await loadPost(postId);
  if (!post) throw new Error('帖子不存在');

  var admin = await isAdmin();
  if (post.get('authorId') !== user.id && !admin) {
    throw new Error('没有权限删除');
  }

  // 删除关联的回复
  var replyQuery = new AV.Query('Reply');
  replyQuery.equalTo('postId', postId);
  var replies = await replyQuery.find();
  if (replies.length > 0) {
    await AV.Object.destroyAll(replies);
  }

  await post.destroy();
  return true;
}

// 上传图片
async function uploadImage(file) {
  var user = await requireAuth();
  if (!user) return null;

  var avFile = new AV.File('image-' + Date.now(), file);
  await avFile.save();
  return avFile.url();
}

// 安全渲染帖子内容（支持图片）
function renderPostContent(content) {
  if (!content) return '';
  var div = document.createElement('div');
  div.textContent = content;
  var safeHtml = div.innerHTML;
  safeHtml = safeHtml.replace(/\[img:(https?:\/\/[^\]]+)\]/g, '<img src="$1" style="max-width:100%;border-radius:8px;margin:8px 0;">');
  return safeHtml;
}

// 格式化时间
function formatTime(date) {
  if (!date) return '';
  if (typeof date === 'string') date = new Date(date);
  return date.toLocaleString('zh-CN', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit'
  });
}

// HTML 转义
function escapeHtml(text) {
  if (!text) return '';
  var div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}
