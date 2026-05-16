// ========== 帖子 CRUD（Flask API） ==========

// 加载帖子列表
async function loadPosts(containerId) {
  var container = document.getElementById(containerId);
  if (!container) return;

  container.innerHTML = '<div class="text-center py-10 text-sm text-subtle">加载中...</div>';

  try {
    var result = await apiFetch('/api/posts?limit=20');
    var posts = result.results || [];

    if (posts.length === 0) {
      container.innerHTML =
        '<div class="text-center py-16 text-subtle">' +
        '<p class="text-base mb-4">还没有帖子，快来发第一贴吧！</p>' +
        '<a href="create.html" class="inline-flex items-center bg-primary text-white rounded-full px-6 py-2.5 text-sm font-semibold hover:bg-primary-hover transition-all duration-200 no-underline">发帖</a>' +
        '</div>';
      return;
    }

    var html = '';
    for (var i = 0; i < posts.length; i++) {
      var post = posts[i];
      var title = escapeHtml(post.title);
      var authorName = escapeHtml(post.authorName);
      var avatarUrl = post.avatarUrl || '';
      var time = formatTime(post.createdAt);
      var excerpt = post.content ? escapeHtml(post.content.substring(0, 80)) : '';
      if (post.content && post.content.length > 80) excerpt += '...';
      var viewCount = post.viewCount || 0;
      var replyCount = post.replyCount || 0;
      var likeCount = post.likeCount || 0;
      var isLiked = post.isLiked;
      html +=
        '<a href="post.html?id=' + post.id + '" class="flex items-center gap-5 px-6 py-4 hover:bg-emerald-50/40 transition-all duration-200 no-underline text-ink">' +
        '<div class="flex items-center gap-2.5 min-w-[160px] shrink-0">' +
        renderUserAvatar(authorName, avatarUrl, 34) +
        '<div class="flex flex-col min-w-0">' +
        '<span class="text-[13px] font-semibold text-ink truncate">' + authorName + '</span>' +
        '<span class="text-xs text-subtle">' + time + '</span>' +
        '</div></div>' +
        '<div class="flex-1 min-w-0">' +
        '<div class="text-[15px] font-semibold text-slate-800 mb-0.5 flex items-center gap-1.5">' + title +
        (post.isPinned ? ' <span class="bg-amber-500 text-white text-[11px] px-2 py-0.5 rounded-md font-semibold">置顶</span>' : '') +
        '</div>' +
        (excerpt ? '<div class="text-[13px] text-slate-500 truncate">' + excerpt + '</div>' : '') +
        '</div>' +
        '<div class="shrink-0"><div class="flex items-center gap-4">' +
        '<span class="flex items-center gap-1 text-[13px] text-subtle"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg> ' + viewCount + '</span>' +
        '<span class="flex items-center gap-1 text-[13px] text-subtle"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg> ' + replyCount + '</span>' +
        '<span class="flex items-center gap-1 text-[13px] ' + (isLiked ? 'text-primary' : 'text-subtle') + '"><svg width="14" height="14" viewBox="0 0 24 24" ' + (isLiked ? 'fill="currentColor"' : 'fill="none"') + ' stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"/></svg> ' + likeCount + '</span>' +
        '</div></div></a>';
    }
    container.innerHTML = html;
  } catch (e) {
    container.innerHTML = '<div class="text-center py-10 text-sm text-red-400">加载失败，请刷新重试</div>';
    console.error('加载帖子失败:', e);
  }
}

// 加载单个帖子
async function loadPost(postId) {
  try {
    var post = await apiFetch('/api/posts/' + postId);
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

  var result = await apiFetch('/api/posts', {
    method: 'POST',
    body: JSON.stringify({ title: title, content: content })
  });
  return true;
}

// 更新帖子
async function updatePost(postId, title, content) {
  var user = await requireAuth();
  if (!user) return false;

  await apiFetch('/api/posts/' + postId, {
    method: 'PUT',
    body: JSON.stringify({ title: title, content: content })
  });
  return true;
}

// 删除帖子
async function deletePost(postId) {
  var user = await requireAuth();
  if (!user) return false;

  await apiFetch('/api/posts/' + postId, { method: 'DELETE' });
  return true;
}

// 上传图片
async function uploadImage(file) {
  var user = await requireAuth();
  if (!user) return null;

  var formData = new FormData();
  formData.append('file', file);
  var r = await fetch(API_BASE + '/api/upload', {
    method: 'POST',
    headers: { 'X-Session-Token': user.sessionToken },
    body: formData
  });
  var result = await r.json();
  if (!r.ok) throw new Error(result.error || '上传失败');
  return result.url;
}

// 安全渲染帖子内容（支持图片）
function renderPostContent(content) {
  if (!content) return '';
  var div = document.createElement('div');
  div.textContent = content;
  var safeHtml = div.innerHTML;
  safeHtml = safeHtml.replace(/\[img:(https?:\/\/[^\]]+)\]/g, '<img src="$1" style="max-width:100%;border-radius:8px;margin:8px 0;">');
  safeHtml = safeHtml.replace(/\[img:(\/[^\]]+)\]/g, '<img src="$1" style="max-width:100%;border-radius:8px;margin:8px 0;">');
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
