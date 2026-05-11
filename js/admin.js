// ========== 管理员 API ==========

// 加载所有帖子（管理员用，支持分页）
async function adminLoadPosts(page = 1, pageSize = 20) {
  const from = (page - 1) * pageSize;
  const to = from + pageSize - 1;

  const { data, error, count } = await supabaseClient
    .from('posts')
    .select('*', { count: 'exact' })
    .order('is_pinned', { ascending: false })
    .order('created_at', { ascending: false })
    .range(from, to);

  if (error) throw error;
  return { data: data || [], count: count || 0 };
}

// 置顶/取消置顶
async function togglePin(postId, currentStatus) {
  const { error } = await supabaseClient
    .from('posts')
    .update({ is_pinned: !currentStatus })
    .eq('id', postId);
  if (error) throw error;
}

// 锁定/取消锁定
async function toggleLock(postId, currentStatus) {
  const { error } = await supabaseClient
    .from('posts')
    .update({ is_locked: !currentStatus })
    .eq('id', postId);
  if (error) throw error;
}

// 管理员删除帖子（不限作者）
async function adminDeletePost(postId) {
  // 先删回复
  await supabaseClient.from('replies').delete().eq('post_id', postId);
  // 再删帖子
  const { error } = await supabaseClient
    .from('posts')
    .delete()
    .eq('id', postId);
  if (error) throw error;
}

// 加载用户列表
async function adminLoadUsers() {
  const { data, error } = await supabaseClient
    .from('user_list')
    .select('*')
    .order('created_at', { ascending: false });

  if (error) throw error;
  return data || [];
}

// 设置用户角色
async function setUserRole(userId, role) {
  // 先删已有角色
  await supabaseClient
    .from('user_roles')
    .delete()
    .eq('user_id', userId);

  // 再插入新角色（如果不是普通用户）
  if (role !== 'user') {
    const { error } = await supabaseClient
      .from('user_roles')
      .insert({ user_id: userId, role: role });
    if (error) throw error;
  }
}

// 获取统计数据
async function getStats() {
  const [postsRes, usersRes, todayRes] = await Promise.all([
    supabaseClient.from('posts').select('id', { count: 'exact', head: true }),
    supabaseClient.from('user_list').select('id', { count: 'exact', head: true }),
    supabaseClient.from('posts').select('id', { count: 'exact', head: true })
      .gte('created_at', new Date(new Date().setHours(0, 0, 0, 0)).toISOString())
  ]);

  return {
    totalPosts: postsRes.count || 0,
    totalUsers: usersRes.count || 0,
    todayPosts: todayRes.count || 0
  };
}

// 渲染管理员帖子表格
function renderAdminPosts(posts, container) {
  if (!posts || posts.length === 0) {
    container.innerHTML = '<div class="loading">暂无帖子</div>';
    return;
  }

  container.innerHTML = `
    <table class="admin-table">
      <thead>
        <tr>
          <th>标题</th>
          <th>作者</th>
          <th>回复</th>
          <th>浏览</th>
          <th>状态</th>
          <th>发布时间</th>
          <th>操作</th>
        </tr>
      </thead>
      <tbody>
        ${posts.map(post => `
          <tr>
            <td><a href="post.html?id=${post.id}">${escapeHtml(post.title)}</a></td>
            <td>${escapeHtml(post.author_name)}</td>
            <td>${post.reply_count || 0}</td>
            <td>${post.view_count || 0}</td>
            <td>
              ${post.is_pinned ? '<span class="role-badge admin">置顶</span>' : ''}
              ${post.is_locked ? '<span class="role-badge moderator">锁定</span>' : ''}
              ${!post.is_pinned && !post.is_locked ? '<span class="role-badge user">正常</span>' : ''}
            </td>
            <td>${formatTime(post.created_at)}</td>
            <td class="actions">
              <button class="btn-action ${post.is_pinned ? 'active' : ''}" onclick="handleTogglePin('${post.id}', ${post.is_pinned})">置顶</button>
              <button class="btn-action ${post.is_locked ? 'active' : ''}" onclick="handleToggleLock('${post.id}', ${post.is_locked})">锁定</button>
              <button class="btn-action danger" onclick="handleAdminDeletePost('${post.id}')">删除</button>
            </td>
          </tr>
        `).join('')}
      </tbody>
    </table>
  `;
}

// 渲染用户列表
function renderAdminUsers(users, container) {
  if (!users || users.length === 0) {
    container.innerHTML = '<div class="loading">暂无用户</div>';
    return;
  }

  container.innerHTML = `
    <table class="admin-table">
      <thead>
        <tr>
          <th>昵称</th>
          <th>邮箱</th>
          <th>角色</th>
          <th>注册时间</th>
          <th>操作</th>
        </tr>
      </thead>
      <tbody>
        ${users.map(user => `
          <tr>
            <td>${escapeHtml(user.display_name || '未设置')}</td>
            <td>${escapeHtml(user.email)}</td>
            <td><span class="role-badge ${user.role}">${user.role === 'admin' ? '管理员' : user.role === 'moderator' ? '版主' : '用户'}</span></td>
            <td>${formatTime(user.created_at)}</td>
            <td class="actions">
              <select onchange="handleSetRole('${user.id}', this.value)" style="padding:4px 8px; border:1px solid var(--border); border-radius:4px; font-size:12px;">
                <option value="user" ${user.role === 'user' ? 'selected' : ''}>普通用户</option>
                <option value="moderator" ${user.role === 'moderator' ? 'selected' : ''}>版主</option>
                <option value="admin" ${user.role === 'admin' ? 'selected' : ''}>管理员</option>
              </select>
            </td>
          </tr>
        `).join('')}
      </tbody>
    </table>
  `;
}

// 交互处理函数
async function handleTogglePin(postId, currentStatus) {
  try {
    await togglePin(postId, currentStatus);
    loadAdminPosts();
  } catch (e) {
    alert('操作失败: ' + e.message);
  }
}

async function handleToggleLock(postId, currentStatus) {
  try {
    await toggleLock(postId, currentStatus);
    loadAdminPosts();
  } catch (e) {
    alert('操作失败: ' + e.message);
  }
}

async function handleAdminDeletePost(postId) {
  if (!confirm('确定要删除这篇帖子吗？删除后不可恢复。')) return;
  try {
    await adminDeletePost(postId);
    loadAdminPosts();
  } catch (e) {
    alert('删除失败: ' + e.message);
  }
}

async function handleSetRole(userId, role) {
  try {
    await setUserRole(userId, role);
    loadAdminUsers();
  } catch (e) {
    alert('操作失败: ' + e.message);
  }
}

// 当前页码
let adminCurrentPage = 1;

async function loadAdminPosts(page) {
  if (page) adminCurrentPage = page;
  const container = document.getElementById('admin-posts-list');
  if (!container) return;

  container.innerHTML = '<div class="loading">加载中...</div>';

  try {
    const { data, count } = await adminLoadPosts(adminCurrentPage);
    renderAdminPosts(data, container);

    // 分页
    const totalPages = Math.ceil(count / 20);
    const paginationDiv = document.getElementById('admin-posts-pagination');
    if (paginationDiv && totalPages > 1) {
      let html = '';
      for (let i = 1; i <= totalPages; i++) {
        html += `<button class="btn-action ${i === adminCurrentPage ? 'active' : ''}" onclick="loadAdminPosts(${i})">${i}</button>`;
      }
      paginationDiv.innerHTML = html;
    }
  } catch (e) {
    container.innerHTML = '<div class="loading">加载失败: ' + e.message + '</div>';
  }
}

async function loadAdminUsers() {
  const container = document.getElementById('admin-users-list');
  if (!container) return;

  container.innerHTML = '<div class="loading">加载中...</div>';

  try {
    const users = await adminLoadUsers();
    renderAdminUsers(users, container);
  } catch (e) {
    container.innerHTML = '<div class="loading">加载失败: ' + e.message + '</div>';
  }
}

async function loadAdminStats() {
  try {
    const stats = await getStats();
    document.getElementById('stat-posts').textContent = stats.totalPosts;
    document.getElementById('stat-users').textContent = stats.totalUsers;
    document.getElementById('stat-today').textContent = stats.todayPosts;
  } catch (e) {
    console.error('加载统计失败:', e);
  }
}
