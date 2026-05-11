// ========== 认证逻辑 ==========

// 注册
async function register(email, password, displayName) {
  const { data, error } = await supabaseClient.auth.signUp({
    email: email,
    password: password,
    options: {
      data: { display_name: displayName }
    }
  });
  if (error) throw error;
  return data;
}

// 登录
async function login(email, password) {
  const { data, error } = await supabaseClient.auth.signInWithPassword({
    email: email,
    password: password
  });
  if (error) throw error;
  return data;
}

// 登出
async function logout() {
  const { error } = await supabaseClient.auth.signOut();
  if (error) throw error;
  window.location.href = 'login.html';
}

// 检查登录状态，返回 session（未登录返回 null）
async function checkAuth() {
  const { data: { session } } = await supabaseClient.auth.getSession();
  return session;
}

// 需要登录的页面调用，未登录则跳转（支持 return URL）
async function requireAuth() {
  const session = await checkAuth();
  if (!session) {
    const returnUrl = encodeURIComponent(window.location.pathname + window.location.search);
    window.location.href = 'login.html?return=' + returnUrl;
    return null;
  }
  return session;
}

// 获取当前用户名
function getUserName(session) {
  if (!session || !session.user) return '匿名';
  return session.user.user_metadata?.display_name || session.user.email;
}

// 获取用户名首字母（用于头像）
function getUserInitial(session) {
  const name = getUserName(session);
  return name.charAt(0).toUpperCase();
}

// 获取用户头像 URL
function getAvatarUrl(session) {
  if (!session || !session.user) return null;
  return session.user.user_metadata?.avatar_url || null;
}

// 上传头像
async function uploadAvatar(file) {
  const session = await requireAuth();
  if (!session) return null;

  const fileExt = file.name.split('.').pop();
  const fileName = `${session.user.id}/avatar.${fileExt}`;

  const { data, error } = await supabaseClient.storage
    .from('avatars')
    .upload(fileName, file, {
      cacheControl: '3600',
      upsert: true
    });

  if (error) {
    console.error('上传头像失败:', error);
    throw error;
  }

  const { data: urlData } = supabaseClient.storage
    .from('avatars')
    .getPublicUrl(data.path);

  const avatarUrl = getProxiedUrl(urlData.publicUrl) + '?t=' + Date.now();

  // 更新用户 metadata
  await supabaseClient.auth.updateUser({
    data: { avatar_url: avatarUrl }
  });

  return avatarUrl;
}

// 渲染头像 HTML（支持图片和首字母）
function renderAvatar(session, size = 32) {
  const avatarUrl = getAvatarUrl(session);
  const initial = getUserInitial(session);

  if (avatarUrl) {
    return `<img src="${avatarUrl}" class="avatar-img" style="width:${size}px;height:${size}px;" alt="头像">`;
  }
  return `<span class="user-avatar" style="width:${size}px;height:${size}px;font-size:${size * 0.45}px;">${initial}</span>`;
}

// 渲染任意用户头像（通过名称和 URL）
function renderUserAvatar(name, avatarUrl, size = 32) {
  if (avatarUrl) {
    return `<img src="${avatarUrl}" class="avatar-img" style="width:${size}px;height:${size}px;" alt="头像">`;
  }
  const initial = name ? name.charAt(0).toUpperCase() : '?';
  return `<span class="user-avatar" style="width:${size}px;height:${size}px;font-size:${size * 0.45}px;">${initial}</span>`;
}

// 检查当前用户是否是管理员
async function isAdmin() {
  const session = await checkAuth();
  if (!session) return false;

  const { data } = await supabaseClient
    .from('user_roles')
    .select('role')
    .eq('user_id', session.user.id)
    .eq('role', 'admin')
    .maybeSingle();

  return !!data;
}

// 获取当前用户的所有角色
async function getUserRoles() {
  const session = await checkAuth();
  if (!session) return [];

  const { data } = await supabaseClient
    .from('user_roles')
    .select('role')
    .eq('user_id', session.user.id);

  return data ? data.map(r => r.role) : [];
}

// 更新导航栏显示
async function updateNav() {
  const session = await checkAuth();
  const navLinks = document.getElementById('nav-links');
  if (!navLinks) return;

  if (session) {
    const name = getUserName(session);
    const admin = await isAdmin();
    const avatarHtml = renderAvatar(session, 28);
    navLinks.innerHTML = `
      <li><a href="index.html">首页</a></li>
      <li><a href="create.html" class="btn-nav">发帖</a></li>
      ${admin ? '<li><a href="admin.html" class="btn-nav btn-admin">管理</a></li>' : ''}
      <li class="user-info" onclick="document.getElementById('avatar-input').click()" style="cursor:pointer;" title="点击更换头像">
        ${avatarHtml}
        ${name}
        ${admin ? '<span class="admin-badge">管理员</span>' : ''}
      </li>
      <li><a href="#" onclick="logout(); return false;">退出</a></li>
    `;

    // 添加隐藏的头像上传 input
    if (!document.getElementById('avatar-input')) {
      const input = document.createElement('input');
      input.type = 'file';
      input.id = 'avatar-input';
      input.accept = 'image/*';
      input.style.display = 'none';
      input.addEventListener('change', async (e) => {
        const file = e.target.files[0];
        if (!file) return;
        if (file.size > 2 * 1024 * 1024) {
          alert('头像图片不能超过 2MB');
          return;
        }
        try {
          await uploadAvatar(file);
          location.reload();
        } catch (err) {
          alert('上传头像失败: ' + err.message);
        }
      });
      document.body.appendChild(input);
    }
  } else {
    navLinks.innerHTML = `
      <li><a href="index.html">首页</a></li>
      <li><a href="login.html" class="btn-nav">登录/注册</a></li>
    `;
  }
}

// 页面加载时更新导航栏
document.addEventListener('DOMContentLoaded', updateNav);
