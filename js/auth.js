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
  window.location.href = 'index.html';
}

// 检查登录状态，返回 session（未登录返回 null）
async function checkAuth() {
  const { data: { session } } = await supabaseClient.auth.getSession();
  return session;
}

// 需要登录的页面调用，未登录则跳转
async function requireAuth() {
  const session = await checkAuth();
  if (!session) {
    window.location.href = 'login.html';
    return null;
  }
  return session;
}

// 获取当前用户名
function getUserName(session) {
  if (!session || !session.user) return '匿名';
  return session.user.user_metadata?.display_name || session.user.email;
}

// 更新导航栏显示
async function updateNav() {
  const session = await checkAuth();
  const navLinks = document.getElementById('nav-links');
  if (!navLinks) return;

  if (session) {
    const name = getUserName(session);
    navLinks.innerHTML = `
      <li><a href="index.html">首页</a></li>
      <li><a href="create.html" class="btn-nav">发帖</a></li>
      <li class="user-info">${name}</li>
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
