// ========== 帖子 CRUD ==========

// 加载帖子列表
async function loadPosts(containerId) {
  const container = document.getElementById(containerId);
  if (!container) return;

  container.innerHTML = '<div class="loading">加载中...</div>';

  const { data, error } = await supabaseClient
    .from('posts')
    .select('*')
    .order('created_at', { ascending: false })
    .range(0, 19);

  if (error) {
    container.innerHTML = '<div class="loading">加载失败，请刷新重试</div>';
    console.error('加载帖子失败:', error);
    return;
  }

  if (!data || data.length === 0) {
    container.innerHTML = `
      <div class="empty-state">
        <p>还没有帖子，快来发第一贴吧！</p>
        <a href="create.html" class="btn btn-primary">发帖</a>
      </div>
    `;
    return;
  }

  container.innerHTML = data.map(post => `
    <a href="post.html?id=${post.id}" class="post-card" style="text-decoration:none; color:inherit;">
      <div class="post-card-header">
        ${renderUserAvatar(post.author_name, post.avatar_url, 36)}
        <div class="post-card-info">
          <div class="post-title">${escapeHtml(post.title)}</div>
          <div class="post-meta">
            <span>${escapeHtml(post.author_name)}</span>
            <span>${formatTime(post.created_at)}</span>
          </div>
        </div>
      </div>
    </a>
  `).join('');
}

// 加载单个帖子详情
async function loadPost(postId) {
  const { data, error } = await supabaseClient
    .from('posts')
    .select('*')
    .eq('id', postId)
    .single();

  if (error) {
    console.error('加载帖子失败:', error);
    return null;
  }
  return data;
}

// 创建帖子
async function createPost(title, content) {
  const session = await requireAuth();
  if (!session) return false;

  const { error } = await supabaseClient
    .from('posts')
    .insert({
      title: title,
      content: content,
      author_id: session.user.id,
      author_name: getUserName(session),
      avatar_url: getAvatarUrl(session) || ''
    });

  if (error) {
    console.error('创建帖子失败:', error);
    throw error;
  }
  return true;
}

// 删除帖子（管理员可删除任意帖子）
async function deletePost(postId) {
  const session = await requireAuth();
  if (!session) return false;

  const admin = await isAdmin();
  let query = supabaseClient
    .from('posts')
    .delete()
    .eq('id', postId);

  if (!admin) {
    query = query.eq('author_id', session.user.id);
  }

  const { error } = await query;
  if (error) {
    console.error('删除帖子失败:', error);
    throw error;
  }
  return true;
}

// 更新帖子（管理员可编辑任意帖子）
async function updatePost(postId, title, content) {
  const session = await requireAuth();
  if (!session) return false;

  const admin = await isAdmin();
  let query = supabaseClient
    .from('posts')
    .update({ title: title, content: content })
    .eq('id', postId);

  if (!admin) {
    query = query.eq('author_id', session.user.id);
  }

  const { error } = await query;
  if (error) {
    console.error('更新帖子失败:', error);
    throw error;
  }
  return true;
}

// 上传图片到 Supabase Storage
async function uploadImage(file) {
  const session = await requireAuth();
  if (!session) return null;

  const fileExt = file.name.split('.').pop();
  const fileName = `${session.user.id}/${Date.now()}.${fileExt}`;

  const { data, error } = await supabaseClient.storage
    .from('images')
    .upload(fileName, file, {
      cacheControl: '3600',
      upsert: false
    });

  if (error) {
    console.error('上传图片失败:', error);
    throw error;
  }

  const { data: urlData } = supabaseClient.storage
    .from('images')
    .getPublicUrl(data.path);

  return getProxiedUrl(urlData.publicUrl);
}

// 安全渲染帖子内容（支持图片标签）
function renderPostContent(content) {
  // 允许 <img> 标签，其他内容转义
  const div = document.createElement('div');
  div.textContent = content;
  let safeHtml = div.innerHTML;

  // 还原合法的 img 标签: [img:url] -> <img>
  safeHtml = safeHtml.replace(/\[img:(https?:\/\/[^\]]+)\]/g, '<img src="$1" style="max-width:100%;border-radius:8px;margin:8px 0;">');

  return safeHtml;
}

// 格式化时间
function formatTime(isoString) {
  const date = new Date(isoString);
  return date.toLocaleString('zh-CN', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit'
  });
}

// HTML 转义（防 XSS）
function escapeHtml(text) {
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}
