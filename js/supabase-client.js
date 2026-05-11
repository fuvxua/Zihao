// ========== 在这里填写你的 Supabase 项目信息 ==========
const SUPABASE_URL = 'https://tyqkxvngutamwbdjccwg.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InR5cWt4dm5ndXRhbXdiZGpjY3dnIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzgzODg4MjgsImV4cCI6MjA5Mzk2NDgyOH0.LHdrhCkAlEgUwH_a-4IwoNkbJiixxxe_hre-K-K4omU';

// ========== 代理地址（部署 Vercel 代理后填入） ==========
// 如果不需要代理，设为 null
const PROXY_URL = null; // 例如: 'https://你的项目.vercel.app/proxy'

// 创建客户端（全局变量）
const supabaseClient = supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
  global: PROXY_URL ? {
    fetch: (url, options) => {
      const proxiedUrl = url.replace(SUPABASE_URL, PROXY_URL);
      return fetch(proxiedUrl, options);
    }
  } : undefined
});

// 获取代理后的 Storage URL
function getProxiedUrl(url) {
  if (!PROXY_URL || !url) return url;
  return url.replace(SUPABASE_URL, PROXY_URL);
}
