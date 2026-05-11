// ========== 认证逻辑（LeanCloud） ==========

// 注册
async function register(email, password, displayName) {
  const user = new AV.User();
  user.setUsername(email);
  user.setPassword(password);
  user.setEmail(email);
  user.set('displayName', displayName);
  await user.signUp();
  return user;
}

// 登录
async function login(email, password) {
  const user = await AV.User.logIn(email, password);
  return user;
}

// 登出
async function logout() {
  AV.User.logOut();
  window.location.href = 'login.html';
}

// 检查登录状态
async function checkAuth() {
  const user = AV.User.current();
  return user;
}

// 需要登录的页面调用
async function requireAuth() {
  const user = await checkAuth();
  if (!user) {
    const returnUrl = encodeURIComponent(window.location.pathname + window.location.search);
    window.location.href = 'login.html?return=' + returnUrl;
    return null;
  }
  return user;
}

// 获取当前用户名
function getUserName(user) {
  if (!user) return '匿名';
  return user.get('displayName') || user.getUsername() || '匿名';
}

// 获取用户名首字母
function getUserInitial(user) {
  const name = getUserName(user);
  return name.charAt(0).toUpperCase();
}

// 获取用户头像 URL
function getAvatarUrl(user) {
  if (!user) return null;
  return user.get('avatarUrl') || null;
}

// 上传头像
async function uploadAvatar(file) {
  const user = await requireAuth();
  if (!user) return null;

  const avFile = new AV.File('avatar-' + Date.now(), file);
  await avFile.save();

  const avatarUrl = avFile.url();
  user.set('avatarUrl', avatarUrl);
  await user.save();

  return avatarUrl;
}

// 渲染头像 HTML
function renderAvatar(user, size) {
  size = size || 32;
  const avatarUrl = getAvatarUrl(user);
  const initial = getUserInitial(user);

  if (avatarUrl) {
    return '<img src="' + avatarUrl + '" class="avatar-img" style="width:' + size + 'px;height:' + size + 'px;" alt="头像">';
  }
  return '<span class="user-avatar" style="width:' + size + 'px;height:' + size + 'px;font-size:' + (size * 0.45) + 'px;">' + initial + '</span>';
}

// 渲染任意用户头像
function renderUserAvatar(name, avatarUrl, size) {
  size = size || 32;
  if (avatarUrl) {
    return '<img src="' + avatarUrl + '" class="avatar-img" style="width:' + size + 'px;height:' + size + 'px;" alt="头像">';
  }
  var initial = name ? name.charAt(0).toUpperCase() : '?';
  return '<span class="user-avatar" style="width:' + size + 'px;height:' + size + 'px;font-size:' + (size * 0.45) + 'px;">' + initial + '</span>';
}

// 检查是否是管理员
async function isAdmin() {
  const user = await checkAuth();
  if (!user) return false;

  const role = user.get('role');
  if (role === 'admin') return true;

  // 也检查 Role 表
  try {
    const query = new AV.Query(AV.Role);
    query.equalTo('name', 'admin');
    query.equalTo('users', user);
    const roleObj = await query.first();
    return !!roleObj;
  } catch (e) {
    return false;
  }
}

// 获取用户角色
async function getUserRoles() {
  const user = await checkAuth();
  if (!user) return [];
  const role = user.get('role');
  return role ? [role] : ['user'];
}

// 更新导航栏
async function updateNav() {
  const user = await checkAuth();
  const navLinks = document.getElementById('nav-links');
  if (!navLinks) return;

  if (user) {
    const name = getUserName(user);
    const admin = await isAdmin();
    const avatarHtml = renderAvatar(user, 28);
    navLinks.innerHTML =
      '<li><a href="index.html">首页</a></li>' +
      '<li><a href="create.html" class="btn-nav">发帖</a></li>' +
      (admin ? '<li><a href="admin.html" class="btn-nav btn-admin">管理</a></li>' : '') +
      '<li class="user-info" onclick="document.getElementById(\'avatar-input\').click()" style="cursor:pointer;" title="点击更换头像">' +
      avatarHtml + ' ' + name +
      (admin ? ' <span class="admin-badge">管理员</span>' : '') +
      '</li>' +
      '<li><a href="#" onclick="logout(); return false;">退出</a></li>';

    // 头像上传
    if (!document.getElementById('avatar-input')) {
      var input = document.createElement('input');
      input.type = 'file';
      input.id = 'avatar-input';
      input.accept = 'image/*';
      input.style.display = 'none';
      input.addEventListener('change', async function(e) {
        var file = e.target.files[0];
        if (!file) return;
        if (file.size > 2 * 1024 * 1024) {
          alert('头像不能超过 2MB');
          return;
        }
        try {
          await uploadAvatar(file);
          location.reload();
        } catch (err) {
          alert('上传失败: ' + err.message);
        }
      });
      document.body.appendChild(input);
    }
  } else {
    navLinks.innerHTML =
      '<li><a href="index.html">首页</a></li>' +
      '<li><a href="login.html" class="btn-nav">登录/注册</a></li>';
  }
}

document.addEventListener('DOMContentLoaded', updateNav);
