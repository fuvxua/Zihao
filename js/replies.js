// ========== 回复逻辑 ==========

// 加载回复列表
async function loadReplies(postId, containerId) {
  const container = document.getElementById(containerId);
  if (!container) return;

  const { data, error } = await supabaseClient
    .from('replies')
    .select('*')
    .eq('post_id', postId)
    .order('created_at', { ascending: true });

  if (error) {
    container.innerHTML = '<div class="loading">加载回复失败</div>';
    console.error('加载回复失败:', error);
    return;
  }

  if (!data || data.length === 0) {
    container.innerHTML = '<p style="color:#999; padding: 12px 0;">暂无回复，来说两句吧</p>';
    return;
  }

  const session = await checkAuth();
  const currentUserId = session?.user?.id;
  const admin = await isAdmin();

  container.innerHTML = data.map(reply => `
    <div class="reply-item">
      <div class="reply-meta">
        <strong>${escapeHtml(reply.author_name)}</strong>
        <span>${formatTime(reply.created_at)}</span>
        ${(reply.author_id === currentUserId || admin) ? `<span class="reply-delete" onclick="handleDeleteReply(${reply.id}, ${postId})">删除</span>` : ''}
      </div>
      <div class="reply-content">${escapeHtml(reply.content)}</div>
    </div>
  `).join('');
}

// 发表回复
async function createReply(postId, content) {
  const session = await requireAuth();
  if (!session) return false;

  const { error } = await supabaseClient
    .from('replies')
    .insert({
      post_id: postId,
      content: content,
      author_id: session.user.id,
      author_name: getUserName(session)
    });

  if (error) {
    console.error('发表回复失败:', error);
    throw error;
  }
  return true;
}

// 删除回复（管理员可删除任意回复）
async function deleteReply(replyId) {
  const session = await requireAuth();
  if (!session) return false;

  const admin = await isAdmin();
  let query = supabaseClient
    .from('replies')
    .delete()
    .eq('id', replyId);

  if (!admin) {
    query = query.eq('author_id', session.user.id);
  }

  const { error } = await query;
  if (error) {
    console.error('删除回复失败:', error);
    throw error;
  }
  return true;
}

// 处理删除回复点击
async function handleDeleteReply(replyId, postId) {
  if (!confirm('确定要删除这条回复吗？')) return;
  try {
    await deleteReply(replyId);
    await loadReplies(postId, 'replies-list');
  } catch (e) {
    alert('删除失败: ' + e.message);
  }
}
