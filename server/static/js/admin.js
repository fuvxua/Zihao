// ========== 管理员 API（Flask API） ==========

// 加载所有帖子
async function adminLoadPosts(page) {
  page = page || 1;
  var result = await apiFetch('/api/admin/posts?page=' + page);
  return { data: result.results || [], count: result.count || 0 };
}

// 置顶/取消置顶
async function togglePin(postId) {
  await apiFetch('/api/admin/posts/' + postId + '/pin', { method: 'POST' });
}

// 锁定/取消锁定
async function toggleLock(postId) {
  await apiFetch('/api/admin/posts/' + postId + '/lock', { method: 'POST' });
}

// 管理员删除帖子
async function adminDeletePost(postId) {
  await apiFetch('/api/posts/' + postId, { method: 'DELETE' });
}

// 加载用户列表
async function adminLoadUsers() {
  var result = await apiFetch('/api/admin/users');
  return result.results || [];
}

// 设置用户角色
async function setUserRole(userId, role) {
  await apiFetch('/api/admin/users/' + userId + '/role', {
    method: 'POST',
    body: JSON.stringify({ role: role })
  });
}

// 删除用户账号
async function adminDeleteUser(userId) {
  await apiFetch('/api/admin/users/' + userId, { method: 'DELETE' });
}

// 获取统计数据
async function getStats() {
  return await apiFetch('/api/admin/stats');
}

// 渲染帖子表格
function renderAdminPosts(posts, container) {
  if (!posts || posts.length === 0) {
    container.innerHTML = '<div class="text-center py-10 text-sm text-subtle">暂无帖子</div>';
    return;
  }

  var tableClass = 'w-full border-collapse bg-white rounded-card overflow-hidden shadow-sm shadow-green-900/5';
  var thClass = 'px-4 py-3 text-left text-sm font-semibold text-ink bg-slate-50 border-b border-slate-200/50';
  var tdClass = 'px-4 py-3 text-sm text-ink border-b border-slate-200/50';
  var btnClass = 'px-2.5 py-1 border border-slate-200 rounded-lg bg-white cursor-pointer text-xs transition-all hover:bg-slate-50';
  var btnActiveClass = 'px-2.5 py-1 border border-primary rounded-lg bg-primary text-white cursor-pointer text-xs transition-all';
  var btnDangerClass = 'px-2.5 py-1 border border-red-300 rounded-lg bg-white text-red-500 cursor-pointer text-xs transition-all hover:bg-red-500 hover:text-white';

  var html =
    '<table class="' + tableClass + '"><thead><tr>' +
    '<th class="' + thClass + '">标题</th><th class="' + thClass + '">作者</th><th class="' + thClass + '">回复</th><th class="' + thClass + '">浏览</th><th class="' + thClass + '">状态</th><th class="' + thClass + '">发布时间</th><th class="' + thClass + '">操作</th>' +
    '</tr></thead><tbody>';

  for (var i = 0; i < posts.length; i++) {
    var post = posts[i];
    var isPinned = post.isPinned;
    var isLocked = post.isLocked;
    var statusHtml = '';
    if (isPinned) statusHtml += '<span class="inline-block px-2 py-0.5 rounded-md text-xs font-semibold bg-amber-500 text-white">置顶</span> ';
    if (isLocked) statusHtml += '<span class="inline-block px-2 py-0.5 rounded-md text-xs font-semibold bg-blue-500 text-white">锁定</span> ';
    if (!isPinned && !isLocked) statusHtml = '<span class="inline-block px-2 py-0.5 rounded-md text-xs font-semibold bg-slate-100 text-slate-500">正常</span>';

    html +=
      '<tr class="hover:bg-emerald-50/40 transition-colors">' +
      '<td class="' + tdClass + '"><a href="post.html?id=' + post.id + '" class="text-primary hover:underline">' + escapeHtml(post.title) + '</a></td>' +
      '<td class="' + tdClass + '">' + escapeHtml(post.authorName) + '</td>' +
      '<td class="' + tdClass + '">' + (post.replyCount || 0) + '</td>' +
      '<td class="' + tdClass + '">' + (post.viewCount || 0) + '</td>' +
      '<td class="' + tdClass + '">' + statusHtml + '</td>' +
      '<td class="' + tdClass + '">' + formatTime(post.createdAt) + '</td>' +
      '<td class="' + tdClass + ' flex gap-2">' +
      '<button class="' + (isPinned ? btnActiveClass : btnClass) + '" onclick="handleTogglePin(' + post.id + ')">置顶</button>' +
      '<button class="' + (isLocked ? btnActiveClass : btnClass) + '" onclick="handleToggleLock(' + post.id + ')">锁定</button>' +
      '<button class="' + btnDangerClass + '" onclick="handleAdminDeletePost(' + post.id + ')">删除</button>' +
      '</td></tr>';
  }
  html += '</tbody></table>';
  container.innerHTML = html;
}

// 渲染用户列表
function renderAdminUsers(users, container) {
  if (!users || users.length === 0) {
    container.innerHTML = '<div class="text-center py-10 text-sm text-subtle">暂无用户</div>';
    return;
  }

  var tableClass = 'w-full border-collapse bg-white rounded-card overflow-hidden shadow-sm shadow-green-900/5';
  var thClass = 'px-4 py-3 text-left text-sm font-semibold text-ink bg-slate-50 border-b border-slate-200/50';
  var tdClass = 'px-4 py-3 text-sm text-ink border-b border-slate-200/50';
  var btnDangerClass = 'px-2.5 py-1 border border-red-300 rounded-lg bg-white text-red-500 cursor-pointer text-xs transition-all hover:bg-red-500 hover:text-white';

  var html =
    '<table class="' + tableClass + '"><thead><tr>' +
    '<th class="' + thClass + '">昵称</th><th class="' + thClass + '">邮箱</th><th class="' + thClass + '">角色</th><th class="' + thClass + '">注册时间</th><th class="' + thClass + '">操作</th>' +
    '</tr></thead><tbody>';

  for (var i = 0; i < users.length; i++) {
    var user = users[i];
    var role = user.role || 'user';
    var roleName = role === 'admin' ? '管理员' : role === 'moderator' ? '版主' : '用户';

    html +=
      '<tr class="hover:bg-emerald-50/40 transition-colors">' +
      '<td class="' + tdClass + '">' + escapeHtml(user.displayName || '未设置') + '</td>' +
      '<td class="' + tdClass + '">' + escapeHtml(user.email || '') + '</td>' +
      '<td class="' + tdClass + '"><span class="inline-block px-2 py-0.5 rounded-md text-xs font-semibold ' + (role === 'admin' ? 'bg-amber-500 text-white' : role === 'moderator' ? 'bg-blue-500 text-white' : 'bg-slate-100 text-slate-500') + '">' + roleName + '</span></td>' +
      '<td class="' + tdClass + '">' + formatTime(user.createdAt) + '</td>' +
      '<td class="' + tdClass + ' flex gap-2 items-center"><select onchange="handleSetRole(' + user.id + ', this.value)" class="px-2 py-1 border border-slate-200 rounded-lg text-xs bg-white">' +
      '<option value="user"' + (role === 'user' ? ' selected' : '') + '>普通用户</option>' +
      '<option value="moderator"' + (role === 'moderator' ? ' selected' : '') + '>版主</option>' +
      '<option value="admin"' + (role === 'admin' ? ' selected' : '') + '>管理员</option>' +
      '</select>' +
      '<button class="' + btnDangerClass + '" onclick="handleAdminDeleteUser(' + user.id + ')">删除账号</button>' +
      '</td></tr>';
  }
  html += '</tbody></table>';
  container.innerHTML = html;
}

// 交互处理
async function handleTogglePin(postId) {
  try {
    await togglePin(postId);
    loadAdminPosts();
  } catch (e) {
    alert('操作失败: ' + e.message);
  }
}

async function handleToggleLock(postId) {
  try {
    await toggleLock(postId);
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

async function handleAdminDeleteUser(userId) {
  if (!confirm('确定删除这个账号吗？该用户的帖子和回复会保留，作者将显示为“已注销用户”。')) return;
  try {
    await adminDeleteUser(userId);
    loadAdminUsers();
    loadAdminStats();
  } catch (e) {
    alert('删除失败: ' + e.message);
  }
}

var adminCurrentPage = 1;

async function loadAdminPosts(page) {
  if (page) adminCurrentPage = page;
  var container = document.getElementById('admin-posts-list');
  if (!container) return;
  container.innerHTML = '<div class="text-center py-10 text-sm text-subtle">加载中...</div>';

  try {
    var result = await adminLoadPosts(adminCurrentPage);
    renderAdminPosts(result.data, container);

    var totalPages = Math.ceil(result.count / 20);
    var paginationDiv = document.getElementById('admin-posts-pagination');
    if (paginationDiv && totalPages > 1) {
      var html = '';
      for (var i = 1; i <= totalPages; i++) {
        html += '<button class="px-2.5 py-1 border border-slate-200 rounded-lg bg-white cursor-pointer text-xs transition-all hover:bg-slate-50' + (i === adminCurrentPage ? ' !bg-primary !text-white !border-primary' : '') + '" onclick="loadAdminPosts(' + i + ')">' + i + '</button>';
      }
      paginationDiv.innerHTML = html;
    }
  } catch (e) {
    container.innerHTML = '<div class="text-center py-10 text-sm text-red-400">加载失败: ' + e.message + '</div>';
  }
}

async function loadAdminUsers() {
  var container = document.getElementById('admin-users-list');
  if (!container) return;
  container.innerHTML = '<div class="text-center py-10 text-sm text-subtle">加载中...</div>';

  try {
    var users = await adminLoadUsers();
    renderAdminUsers(users, container);
  } catch (e) {
    container.innerHTML = '<div class="text-center py-10 text-sm text-red-400">加载失败: ' + e.message + '</div>';
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

// ========== 公告管理 ==========

async function loadAdminAnnouncements() {
  var container = document.getElementById('admin-announcements-list');
  if (!container) return;
  container.innerHTML = '<div class="text-center py-10 text-sm text-subtle">加载中...</div>';

  try {
    var data = await apiFetch('/api/announcements?limit=100');
    renderAdminAnnouncements(data.results || [], container);
  } catch (e) {
    container.innerHTML = '<div class="text-center py-10 text-sm text-red-400">加载失败: ' + escapeHtml(e.message) + '</div>';
  }
}

function renderAdminAnnouncements(announcements, container) {
  if (!announcements || announcements.length === 0) {
    container.innerHTML = '<div class="text-center py-10 text-sm text-subtle">暂无公告</div>';
    return;
  }

  var tableClass = 'w-full border-collapse bg-white rounded-card overflow-hidden shadow-sm shadow-green-900/5';
  var thClass = 'px-4 py-3 text-left text-sm font-semibold text-ink bg-slate-50 border-b border-slate-200/50';
  var tdClass = 'px-4 py-3 text-sm text-ink border-b border-slate-200/50';
  var btnClass = 'px-2.5 py-1 border border-slate-200 rounded-lg bg-white cursor-pointer text-xs transition-all hover:bg-slate-50';
  var btnActiveClass = 'px-2.5 py-1 border border-primary rounded-lg bg-primary text-white cursor-pointer text-xs transition-all';
  var btnDangerClass = 'px-2.5 py-1 border border-red-300 rounded-lg bg-white text-red-500 cursor-pointer text-xs transition-all hover:bg-red-500 hover:text-white';

  var html =
    '<table class="' + tableClass + '"><thead><tr>' +
    '<th class="' + thClass + '">标题</th><th class="' + thClass + '">作者</th><th class="' + thClass + '">状态</th><th class="' + thClass + '">发布时间</th><th class="' + thClass + '">操作</th>' +
    '</tr></thead><tbody>';

  for (var i = 0; i < announcements.length; i++) {
    var ann = announcements[i];
    var statusHtml = ann.isActive
      ? '<span class="inline-block px-2 py-0.5 rounded-md text-xs font-semibold bg-amber-500 text-white">启用</span>'
      : '<span class="inline-block px-2 py-0.5 rounded-md text-xs font-semibold bg-slate-100 text-slate-500">禁用</span>';

    html +=
      '<tr class="hover:bg-emerald-50/40 transition-colors">' +
      '<td class="' + tdClass + '">' + escapeHtml(ann.title) + '</td>' +
      '<td class="' + tdClass + '">' + escapeHtml(ann.authorName) + '</td>' +
      '<td class="' + tdClass + '">' + statusHtml + '</td>' +
      '<td class="' + tdClass + '">' + formatTime(ann.createdAt) + '</td>' +
      '<td class="' + tdClass + ' flex gap-2">' +
      '<button class="' + btnClass + '" onclick="showAnnouncementForm(' + ann.id + ')">编辑</button>' +
      '<button class="' + (!ann.isActive ? btnActiveClass : btnClass) + '" onclick="handleToggleAnnouncement(' + ann.id + ')">' + (ann.isActive ? '禁用' : '启用') + '</button>' +
      '<button class="' + btnDangerClass + '" onclick="handleDeleteAnnouncement(' + ann.id + ')">删除</button>' +
      '</td></tr>';
  }
  html += '</tbody></table>';
  container.innerHTML = html;
}

async function showAnnouncementForm(annId) {
  var formArea = document.getElementById('announcement-form-area');
  if (!formArea) return;

  var title = '';
  var content = '';

  if (annId) {
    try {
      var ann = await apiFetch('/api/announcements/' + annId);
      title = ann.title || '';
      content = ann.content || '';
    } catch (e) {
      alert('加载公告失败: ' + e.message);
      return;
    }
  }

  formArea.innerHTML =
    '<div class="mb-4">' +
    '<label class="block text-sm font-semibold mb-1.5">标题</label>' +
    '<input type="text" id="announcement-title" value="' + escapeHtml(title) + '" placeholder="公告标题" class="w-full px-3.5 py-2.5 rounded-xl bg-slate-50 border-none text-sm focus:ring-2 focus:ring-primary/20 outline-none">' +
    '</div>' +
    '<div class="mb-4">' +
    '<label class="block text-sm font-semibold mb-1.5">内容</label>' +
    '<textarea id="announcement-content" rows="4" placeholder="公告内容" class="w-full px-3.5 py-2.5 rounded-xl bg-slate-50 border-none text-sm focus:ring-2 focus:ring-primary/20 outline-none resize-y">' + escapeHtml(content) + '</textarea>' +
    '</div>' +
    '<div class="flex gap-2 mb-4">' +
    '<button class="bg-primary text-white rounded-xl px-5 py-2 text-sm font-semibold hover:bg-primary-hover transition-all" onclick="handleSaveAnnouncement(' + (annId || 0) + ')">保存</button>' +
    '<button class="bg-slate-100 text-slate-600 rounded-xl px-5 py-2 text-sm font-semibold hover:bg-slate-200 transition-all" onclick="document.getElementById(\'announcement-form-area\').innerHTML=\'\'">取消</button>' +
    '</div>';
}

async function handleSaveAnnouncement(annId) {
  var title = document.getElementById('announcement-title').value.trim();
  var content = document.getElementById('announcement-content').value.trim();

  if (!title || !content) {
    alert('标题和内容不能为空');
    return;
  }

  try {
    if (annId) {
      await apiFetch('/api/admin/announcements/' + annId, {
        method: 'PUT',
        body: JSON.stringify({ title: title, content: content })
      });
    } else {
      await apiFetch('/api/admin/announcements', {
        method: 'POST',
        body: JSON.stringify({ title: title, content: content })
      });
    }

    document.getElementById('announcement-form-area').innerHTML = '';
    loadAdminAnnouncements();
  } catch (e) {
    alert('保存失败: ' + e.message);
  }
}

async function handleDeleteAnnouncement(annId) {
  if (!confirm('确定删除这条公告吗？')) return;

  try {
    await apiFetch('/api/admin/announcements/' + annId, { method: 'DELETE' });
    loadAdminAnnouncements();
  } catch (e) {
    alert('删除失败: ' + e.message);
  }
}

async function handleToggleAnnouncement(annId) {
  try {
    await apiFetch('/api/admin/announcements/' + annId + '/toggle', { method: 'POST' });
    loadAdminAnnouncements();
  } catch (e) {
    alert('操作失败: ' + e.message);
  }
}
