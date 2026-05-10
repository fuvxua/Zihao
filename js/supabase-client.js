// ========== 在这里填写你的 Supabase 项目信息 ==========
const SUPABASE_URL = 'https://tyqkxvngutamwbdjccwg.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InR5cWt4dm5ndXRhbXdiZGpjY3dnIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzgzODg4MjgsImV4cCI6MjA5Mzk2NDgyOH0.LHdrhCkAlEgUwH_a-4IwoNkbJiixxxe_hre-K-K4omU';

// 创建客户端（全局变量）
const supabaseClient = supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
