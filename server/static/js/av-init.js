// ========== Bmob REST API 封装 ==========
// 请填入你的 Bmob 应用凭证
var BMOB_APP_ID = '你的ApplicationID';
var BMOB_API_KEY = '你的REST API Key';
var BMOB_BASE = 'https://api2.bmob.cn/1';

// Bmob REST API 请求封装
var BmobDB = {
  // 查询
  find: function(className, params) {
    var url = BMOB_BASE + '/classes/' + className;
    if (params) {
      var qs = [];
      for (var k in params) {
        qs.push(encodeURIComponent(k) + '=' + encodeURIComponent(JSON.stringify(params[k])));
      }
      if (qs.length) url += '?' + qs.join('&');
    }
    return fetch(url, {
      headers: {
        'X-Bmob-Application-Id': BMOB_APP_ID,
        'X-Bmob-REST-API-Key': BMOB_API_KEY,
        'Content-Type': 'application/json'
      }
    }).then(function(r) { return r.json(); });
  },

  // 获取单条
  get: function(className, objectId) {
    return fetch(BMOB_BASE + '/classes/' + className + '/' + objectId, {
      headers: {
        'X-Bmob-Application-Id': BMOB_APP_ID,
        'X-Bmob-REST-API-Key': BMOB_API_KEY,
        'Content-Type': 'application/json'
      }
    }).then(function(r) { return r.json(); });
  },

  // 创建
  create: function(className, data) {
    return fetch(BMOB_BASE + '/classes/' + className, {
      method: 'POST',
      headers: {
        'X-Bmob-Application-Id': BMOB_APP_ID,
        'X-Bmob-REST-API-Key': BMOB_API_KEY,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(data)
    }).then(function(r) { return r.json(); });
  },

  // 更新
  update: function(className, objectId, data) {
    return fetch(BMOB_BASE + '/classes/' + className + '/' + objectId, {
      method: 'PUT',
      headers: {
        'X-Bmob-Application-Id': BMOB_APP_ID,
        'X-Bmob-REST-API-Key': BMOB_API_KEY,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(data)
    }).then(function(r) { return r.json(); });
  },

  // 删除
  del: function(className, objectId) {
    return fetch(BMOB_BASE + '/classes/' + className + '/' + objectId, {
      method: 'DELETE',
      headers: {
        'X-Bmob-Application-Id': BMOB_APP_ID,
        'X-Bmob-REST-API-Key': BMOB_API_KEY,
        'Content-Type': 'application/json'
      }
    }).then(function(r) { return r.json(); });
  },

  // 统计
  count: function(className, where) {
    var url = BMOB_BASE + '/classes/' + className + '?count=1&limit=0';
    if (where) {
      url += '&where=' + encodeURIComponent(JSON.stringify(where));
    }
    return fetch(url, {
      headers: {
        'X-Bmob-Application-Id': BMOB_APP_ID,
        'X-Bmob-REST-API-Key': BMOB_API_KEY,
        'Content-Type': 'application/json'
      }
    }).then(function(r) { return r.json(); });
  },

  // 递增
  increment: function(className, objectId, field, amount) {
    var data = {};
    data[field] = { '__op': 'Increment', 'amount': amount || 1 };
    return BmobDB.update(className, objectId, data);
  }
};

// Bmob 用户 API
var BmobUser = {
  // 注册
  signUp: function(username, password, email, displayName) {
    return fetch(BMOB_BASE + '/users', {
      method: 'POST',
      headers: {
        'X-Bmob-Application-Id': BMOB_APP_ID,
        'X-Bmob-REST-API-Key': BMOB_API_KEY,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        username: username,
        password: password,
        email: email,
        displayName: displayName
      })
    }).then(function(r) { return r.json(); });
  },

  // 登录
  logIn: function(username, password) {
    return fetch(BMOB_BASE + '/login?username=' + encodeURIComponent(username) + '&password=' + encodeURIComponent(password), {
      headers: {
        'X-Bmob-Application-Id': BMOB_APP_ID,
        'X-Bmob-REST-API-Key': BMOB_API_KEY,
        'Content-Type': 'application/json'
      }
    }).then(function(r) { return r.json(); });
  },

  // 获取当前用户
  current: function() {
    var data = localStorage.getItem('bmob_user');
    return data ? JSON.parse(data) : null;
  },

  // 保存用户到本地
  saveSession: function(user) {
    localStorage.setItem('bmob_user', JSON.stringify(user));
  },

  // 登出
  logOut: function() {
    localStorage.removeItem('bmob_user');
  },

  // 更新用户
  update: function(objectId, data, sessionToken) {
    return fetch(BMOB_BASE + '/users/' + objectId, {
      method: 'PUT',
      headers: {
        'X-Bmob-Application-Id': BMOB_APP_ID,
        'X-Bmob-REST-API-Key': BMOB_API_KEY,
        'X-Bmob-Session-Token': sessionToken,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(data)
    }).then(function(r) { return r.json(); });
  }
};

// Bmob 文件上传
var BmobFile = {
  upload: function(file) {
    var formData = new FormData();
    formData.append('file', file);
    return fetch(BMOB_BASE + '/files/' + file.name, {
      method: 'POST',
      headers: {
        'X-Bmob-Application-Id': BMOB_APP_ID,
        'X-Bmob-REST-API-Key': BMOB_API_KEY
      },
      body: formData
    }).then(function(r) { return r.json(); });
  },

  del: function(filename) {
    return fetch(BMOB_BASE + '/files/' + filename, {
      method: 'DELETE',
      headers: {
        'X-Bmob-Application-Id': BMOB_APP_ID,
        'X-Bmob-REST-API-Key': BMOB_API_KEY
      }
    }).then(function(r) { return r.json(); });
  }
};
