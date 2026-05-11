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
    const initial = getUserInitial(session);
    const admin = await isAdmin();
    navLinks.innerHTML = `
      <li><a href="index.html">首页</a></li>
      <li><a href="create.html" class="btn-nav">发帖</a></li>
      ${admin ? '<li><a href="admin.html" class="btn-nav btn-admin">管理</a></li>' : ''}
      <li class="user-info">
        <span class="user-avatar">${initial}</span>
        ${name}
        ${admin ? '<span class="admin-badge">管理员</span>' : ''}
      </li>
      <li><a href="#" onclick="logout(); return false;">退出</a></li>
    `;
  } else {
    navLinks.innerHTML = `
      <li><a href="index.html">首页</a></li>
      <li><a href="login.html" class="btn-nav">登录/注册</a></li>
    `;
  }
}

// 页面加载时更新导航栏
document.addEventListener('DOMContentLoaded', updateNav);
