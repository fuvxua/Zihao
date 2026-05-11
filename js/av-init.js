// ========== LeanCloud 初始化 ==========
// 请填入你的 LeanCloud 应用凭证
const LC_APP_ID = '你的AppID';
const LC_APP_KEY = '你的AppKey';
const LC_SERVER_URL = '你的REST API地址'; // 例如: 'https://xxx.lc-cn-n1-shared.com'

AV.init({
  appId: LC_APP_ID,
  appKey: LC_APP_KEY,
  serverURL: LC_SERVER_URL
});
