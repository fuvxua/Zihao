// ========== 管理员 API（LeanCloud） ==========

// 加载所有帖子
async function adminLoadPosts(page) {
  page = page || 1;
  var pageSize = 20;
  var skip = (page - 1) * pageSize;

  var query = new AV.Query('Post');
  query.descending('createdAt');
  query.limit(pageSize);
  query.skip(skip);
  var posts = await query.find();

  // 获取总数
  var countQuery = new AV.Query('Post');
  var total = await countQuery.count();

  return { data: posts || [], count: total || 0 };
}

// 置顶/取消置顶
async function togglePin(postId, currentStatus) {
  var post = await loadPost(postId);
  if (!post) return;
  post.set('isPinned', !currentStatus);
  await post.save();
}

// 锁定/取消锁定
async function toggleLock(postId, currentStatus) {
  var post = await loadPost(postId);
  if (!post) return;
  post.set('isLocked', !currentStatus);
  await post.save();
}

// 管理员删除帖子
async function adminDeletePost(postId) {
  var replyQuery = new AV.Query('Reply');
  replyQuery.equalTo('postId', postId);
  var replies = await replyQuery.find();
  if (replies.length > 0) {
    await AV.Object.destroyAll(replies);
  }

  var post = await loadPost(postId);
  if (post) await post.destroy();
}

// 加载用户列表（从 _User 表）
async function adminLoadUsers() {
  var query = new AV.Query(AV.User);
  query.descending('createdAt');
  query.limit(100);
  var users = await query.find();
  return users || [];
}

// 设置用户角色
async function setUserRole(userId, role) {
  var query = new AV.Query(AV.User);
  var user = await query.get(userId);
  if (!user) return;
  user.set('role', role);
  await user.save();
}

// 获取统计数据
async function getStats() {
  var postQuery = new AV.Query('Post');
  var totalPosts = await postQuery.count();

  var userQuery = new AV.Query(AV.User);
  var totalUsers = await userQuery.count();

  var today = new Date();
  today.setHours(0, 0, 0, 0);
  var todayQuery = new AV.Query('Post');
  todayQuery.greaterThanOrEqualTo('createdAt', today);
  var todayPosts = await todayQuery.count();

  return {
    totalPosts: totalPosts || 0,
    totalUsers: totalUsers || 0,
    todayPosts: todayPosts || 0
  };
}

// 渲染帖子表格
function renderAdminPosts(posts, container) {
  if (!posts || posts.length === 0) {
    container.innerHTML = '<div class="loading">暂无帖子</div>';
    return;
  }

  var html =
    '<table class="admin-table"><thead><tr>' +
    '<th>标题</th><th>作者</th><th>回复</th><th>浏览</th><th>状态</th><th>发布时间</th><th>操作</th>' +
    '</tr></thead><tbody>';

  for (var i = 0; i < posts.length; i++) {
    var post = posts[i];
    var isPinned = post.get('isPinned');
    var isLocked = post.get('isLocked');
    var statusHtml = '';
    if (isPinned) statusHtml += '<span class="role-badge admin">置顶</span> ';
    if (isLocked) statusHtml += '<span class="role-badge moderator">锁定</span> ';
    if (!isPinned && !isLocked) statusHtml = '<span class="role-badge user">正常</span>';

    html +=
      '<tr>' +
      '<td><a href="post.html?id=' + post.id + '">' + escapeHtml(post.get('title')) + '</a></td>' +
      '<td>' + escapeHtml(post.get('authorName')) + '</td>' +
      '<td>' + (post.get('replyCount') || 0) + '</td>' +
      '<td>' + (post.get('viewCount') || 0) + '</td>' +
      '<td>' + statusHtml + '</td>' +
      '<td>' + formatTime(post.createdAt) + '</td>' +
      '<td class="actions">' +
      '<button class="btn-action' + (isPinned ? ' active' : '') + '" onclick="handleTogglePin(\'' + post.id + '\',' + isPinned + ')">置顶</button> ' +
      '<button class="btn-action' + (isLocked ? ' active' : '') + '" onclick="handleToggleLock(\'' + post.id + '\',' + isLocked + ')">锁定</button> ' +
      '<button class="btn-action danger" onclick="handleAdminDeletePost(\'' + post.id + '\')">删除</button>' +
      '</td></tr>';
  }
  html += '</tbody></table>';
  container.innerHTML = html;
}

// 渲染用户列表
function renderAdminUsers(users, container) {
  if (!users || users.length === 0) {
    container.innerHTML = '<div class="loading">暂无用户</div>';
    return;
  }

  var html =
    '<table class="admin-table"><thead><tr>' +
    '<th>昵称</th><th>邮箱</th><th>角色</th><th>注册时间</th><th>操作</th>' +
    '</tr></thead><tbody>';

  for (var i = 0; i < users.length; i++) {
    var user = users[i];
    var role = user.get('role') || 'user';
    var roleName = role === 'admin' ? '管理员' : role === 'moderator' ? '版主' : '用户';

    html +=
      '<tr>' +
      '<td>' + escapeHtml(user.get('displayName') || '未设置') + '</td>' +
      '<td>' + escapeHtml(user.getEmail() || '') + '</td>' +
      '<td><span class="role-badge ' + role + '">' + roleName + '</span></td>' +
      '<td>' + formatTime(user.createdAt) + '</td>' +
      '<td><select onchange="handleSetRole(\'' + user.id + '\', this.value)" style="padding:4px 8px;border:1px solid var(--border);border-radius:4px;font-size:12px;">' +
      '<option value="user"' + (role === 'user' ? ' selected' : '') + '>普通用户</option>' +
      '<option value="moderator"' + (role === 'moderator' ? ' selected' : '') + '>版主</option>' +
      '<option value="admin"' + (role === 'admin' ? ' selected' : '') + '>管理员</option>' +
      '</select></td></tr>';
  }
  html += '</tbody></table>';
  container.innerHTML = html;
}

// 交互处理
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
  if (!confirm('确定删除这篇帖子吗？')) return;
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

var adminCurrentPage = 1;

async function loadAdminPosts(page) {
  if (page) adminCurrentPage = page;
  var container = document.getElementById('admin-posts-list');
  if (!container) return;
  container.innerHTML = '<div class="loading">加载中...</div>';

  try {
    var result = await adminLoadPosts(adminCurrentPage);
    renderAdminPosts(result.data, container);

    var totalPages = Math.ceil(result.count / 20);
    var paginationDiv = document.getElementById('admin-posts-pagination');
    if (paginationDiv && totalPages > 1) {
      var html = '';
      for (var i = 1; i <= totalPages; i++) {
        html += '<button class="btn-action' + (i === adminCurrentPage ? ' active' : '') + '" onclick="loadAdminPosts(' + i + ')">' + i + '</button>';
      }
      paginationDiv.innerHTML = html;
    }
  } catch (e) {
    container.innerHTML = '<div class="loading">加载失败: ' + e.message + '</div>';
  }
}

async function loadAdminUsers() {
  var container = document.getElementById('admin-users-list');
  if (!container) return;
  container.innerHTML = '<div class="loading">加载中...</div>';

  try {
    var users = await adminLoadUsers();
    renderAdminUsers(users, container);
  } catch (e) {
    container.innerHTML = '<div class="loading">加载失败: ' + e.message + '</div>';
  }
}

async function loadAdminStats() {
  try {
    var stats = await getStats();
    document.getElementById('stat-posts').textContent = stats.totalPosts;
    document.getElementById('stat-users').textContent = stats.totalUsers;
    document.getElementById('stat-today').textContent = stats.todayPosts;
  } catch (e) {
    console.error('加载统计失败:', e);
  }
}
