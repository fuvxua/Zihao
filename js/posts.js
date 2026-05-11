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
      <div class="post-title">${escapeHtml(post.title)}</div>
      <div class="post-meta">
        <span>${escapeHtml(post.author_name)}</span>
        <span>${formatTime(post.created_at)}</span>
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
      author_name: getUserName(session)
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
