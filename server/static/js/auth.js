// ========== 认证逻辑（Flask API） ==========

var API_BASE = '';

function apiFetch(url, options) {
  options = options || {};
  options.headers = options.headers || {};
  options.headers['Content-Type'] = 'application/json';
  var user = localStorage.getItem('forum_user');
  if (user) {
    var token = JSON.parse(user).sessionToken;
    if (token) options.headers['X-Session-Token'] = token;
  }
  return fetch(API_BASE + url, options).then(function(r) {
    return r.json().then(function(data) {
      if (!r.ok) throw new Error(data.error || '请求失败');
      return data;
    });
  });
}

// 注册
async function register(email, password, displayName) {
  var data = await apiFetch('/api/register', {
    method: 'POST',
    body: JSON.stringify({ username: email, password: password, email: email, displayName: displayName })
  });
  return data;
}

// 登录
async function login(username, password) {
  var data = await apiFetch('/api/login', {
    method: 'POST',
    body: JSON.stringify({ username: username, password: password })
  });
  localStorage.setItem('forum_user', JSON.stringify(data));
  sessionStorage.setItem('showAnnouncementPopup', '1');
  return data;
}

// 登出
async function logout() {
  localStorage.removeItem('forum_user');
  window.location.href = 'login.html';
}

// 检查登录状态
async function checkAuth() {
  var cached = localStorage.getItem('forum_user');
  if (!cached) return null;
  try {
    var data = await apiFetch('/api/users/me');
    localStorage.setItem('forum_user', JSON.stringify(data));
    return data;
  } catch (e) {
    localStorage.removeItem('forum_user');
    return null;
  }
}

// 需要登录的页面调用
async function requireAuth() {
  var user = await checkAuth();
  if (!user) {
    var returnUrl = encodeURIComponent(window.location.pathname + window.location.search);
    window.location.href = 'login.html?return=' + returnUrl;
    return null;
  }
  return user;
}

// 获取当前用户名
function getUserName(user) {
  if (!user) return '匿名';
  return user.displayName || user.username || '匿名';
}

// 获取用户名首字母
function getUserInitial(user) {
  var name = getUserName(user);
  return name.charAt(0).toUpperCase();
}

// 获取用户头像 URL
function getAvatarUrl(user) {
  if (!user) return null;
  return user.avatarUrl || null;
}

function escapeNavHtml(text) {
  if (text == null) return '';
  return String(text)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

// 获取用户背景图 URL
function getBackgroundUrl(user) {
  if (!user) return null;
  return user.backgroundUrl || null;
}

// 更新当前用户资料
async function updateCurrentUserProfile(data) {
  var user = await requireAuth();
  if (!user) return null;

  var updated = await apiFetch('/api/users/' + user.objectId, {
    method: 'PUT',
    body: JSON.stringify(data)
  });
  var nextUser = Object.assign({}, user, updated);
  localStorage.setItem('forum_user', JSON.stringify(nextUser));
  return nextUser;
}

// 上传头像
async function uploadAvatar(file) {
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

  await apiFetch('/api/users/' + user.objectId, {
    method: 'PUT',
    body: JSON.stringify({ avatarUrl: result.url })
  });

  user.avatarUrl = result.url;
  localStorage.setItem('forum_user', JSON.stringify(user));
  return result.url;
}

// 上传背景图
async function uploadBackground(file) {
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

  await apiFetch('/api/users/' + user.objectId, {
    method: 'PUT',
    body: JSON.stringify({ backgroundUrl: result.url })
  });

  user.backgroundUrl = result.url;
  localStorage.setItem('forum_user', JSON.stringify(user));
  return result.url;
}

// 渲染头像 HTML
function renderAvatar(user, size) {
  size = size || 32;
  var avatarUrl = getAvatarUrl(user);
  var initial = getUserInitial(user);
  var imgClass = 'rounded-full object-cover mr-1.5 shrink-0';
  var spanClass = 'inline-flex items-center justify-center rounded-full bg-primary text-white font-semibold mr-1.5 shrink-0';
  if (avatarUrl) {
    return '<img src="' + avatarUrl + '" class="' + imgClass + '" style="width:' + size + 'px;height:' + size + 'px;" alt="头像">';
  }
  return '<span class="' + spanClass + '" style="width:' + size + 'px;height:' + size + 'px;font-size:' + (size * 0.45) + 'px;">' + initial + '</span>';
}

// 渲染任意用户头像
function renderUserAvatar(name, avatarUrl, size) {
  size = size || 32;
  var imgClass = 'rounded-full object-cover mr-1.5 shrink-0';
  var spanClass = 'inline-flex items-center justify-center rounded-full bg-primary text-white font-semibold mr-1.5 shrink-0';
  if (avatarUrl) {
    return '<img src="' + avatarUrl + '" class="' + imgClass + '" style="width:' + size + 'px;height:' + size + 'px;" alt="头像">';
  }
  var initial = name ? name.charAt(0).toUpperCase() : '?';
  return '<span class="' + spanClass + '" style="width:' + size + 'px;height:' + size + 'px;font-size:' + (size * 0.45) + 'px;">' + initial + '</span>';
}

// 检查是否是管理员
async function isAdmin() {
  var user = await checkAuth();
  if (!user) return false;
  return user.role === 'admin';
}

// 获取用户角色
async function getUserRoles() {
  var user = await checkAuth();
  if (!user) return [];
  return [user.role || 'user'];
}

// 更新导航栏
async function updateNav() {
  var user = await checkAuth();
  var navLinks = document.getElementById('nav-links');
  if (!navLinks) return;

  var linkClass = 'px-3.5 py-2 text-sm font-medium text-slate-500 rounded-lg hover:text-ink hover:bg-primary-light transition-colors duration-200 no-underline';
  var activePath = window.location.pathname.split('/').pop() || 'index.html';

  function navLink(href, label) {
    var isActive = activePath === href;
    return '<li><a href="' + href + '" class="' + linkClass + (isActive ? ' !text-primary font-semibold' : '') + '">' + label + '</a></li>';
  }

  if (user) {
    var name = getUserName(user);
    var admin = await isAdmin();
    var avatarHtml = renderAvatar(user, 28);
    navLinks.innerHTML =
      navLink('index.html', '首页') +
      navLink('announcements.html', '公告') +
      '<li><a href="create.html" class="inline-flex items-center gap-1 bg-emerald-600 text-white rounded-full px-4 py-1.5 text-xs font-semibold shadow-sm shadow-green-900/5 hover:bg-primary-hover transition-all duration-200 no-underline">发帖</a></li>' +
      (admin ? '<li><a href="admin.html" class="inline-flex items-center bg-amber-500 text-white rounded-full px-4 py-1.5 text-xs font-semibold hover:bg-amber-600 transition-all duration-200 no-underline">管理</a></li>' : '') +
      '<li><a href="profile.html" class="flex items-center gap-1.5 px-3 py-1.5 text-sm text-slate-500 hover:text-ink rounded-lg hover:bg-primary-light transition-colors duration-200 no-underline" title="个人主页">' +
      avatarHtml + ' ' + escapeNavHtml(name) +
      (admin ? ' <span class="bg-amber-500 text-white text-[11px] px-2 py-0.5 rounded-md font-semibold ml-1">管理员</span>' : '') +
      '</a></li>' +
      '<li><a href="#" onclick="logout(); return false;" class="px-3 py-2 text-sm text-slate-400 hover:text-red-500 transition-colors duration-200 no-underline">退出</a></li>';
  } else {
    navLinks.innerHTML =
      navLink('index.html', '首页') +
      navLink('announcements.html', '公告') +
      '<li><a href="login.html" class="inline-flex items-center bg-emerald-600 text-white rounded-full px-4 py-1.5 text-xs font-semibold shadow-sm shadow-green-900/5 hover:bg-primary-hover transition-all duration-200 no-underline">登录/注册</a></li>';
  }
}

document.addEventListener('DOMContentLoaded', updateNav);
