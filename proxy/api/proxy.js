const SUPABASE_HOST = 'tyqkxvngutamwbdjccwg.supabase.co';

export default async function handler(req, res) {
  // CORS
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, PATCH, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', '*');

  if (req.method === 'OPTIONS') {
    res.status(200).end();
    return;
  }

  // 从 URL 中提取 Supabase 路径
  // 请求格式: /proxy/rest/v1/xxx 或 /proxy/auth/v1/xxx 或 /proxy/storage/v1/xxx
  const proxyPath = req.url.replace(/^\/proxy/, '') || '/';

  const targetUrl = `https://${SUPABASE_HOST}${proxyPath}`;

  try {
    // 构建请求头
    const headers = {};
    for (const [key, value] of Object.entries(req.headers)) {
      // 跳过 host 和 connection
      if (['host', 'connection'].includes(key.toLowerCase())) continue;
      headers[key] = value;
    }

    const fetchOptions = {
      method: req.method,
      headers,
    };

    // 读取请求体（非 GET/HEAD）
    if (req.method !== 'GET' && req.method !== 'HEAD') {
      const body = await getBody(req);
      if (body) {
        fetchOptions.body = body;
      }
    }

    const response = await fetch(targetUrl, fetchOptions);

    // 转发响应头
    response.headers.forEach((value, key) => {
      if (['transfer-encoding'].includes(key.toLowerCase())) return;
      res.setHeader(key, value);
    });

    res.status(response.status);

    // 判断是否是二进制内容
    const contentType = response.headers.get('content-type') || '';
    if (contentType.includes('application/json') || contentType.includes('text/')) {
      const text = await response.text();
      res.send(text);
    } else {
      const buffer = await response.arrayBuffer();
      res.send(Buffer.from(buffer));
    }
  } catch (error) {
    console.error('Proxy error:', error);
    res.status(502).json({ error: 'Proxy error', message: error.message });
  }
}

// 读取请求体
function getBody(req) {
  return new Promise((resolve) => {
    const chunks = [];
    req.on('data', (chunk) => chunks.push(chunk));
    req.on('end', () => {
      if (chunks.length === 0) {
        resolve(null);
      } else {
        resolve(Buffer.concat(chunks));
      }
    });
  });
}
