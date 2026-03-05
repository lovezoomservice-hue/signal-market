/**
 * Signal Market - Cloudflare Worker
 * 
 * 无服务器 API
 */

const API_BASE = 'https://api.example.com'; // 替换为实际后端地址

// CORS 头
const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, x-api-key'
};

async function fetchBackend(path) {
  const res = await fetch(`${API_BASE}${path}`);
  return {
    status: res.status,
    headers: { 'Content-Type': 'application/json' },
    body: await res.text()
  };
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    const path = url.pathname;
    
    // 处理 CORS 预检
    if (request.method === 'OPTIONS') {
      return new Response(null, { headers: corsHeaders });
    }
    
    // 路由
    try {
      let response;
      
      if (path.startsWith('/api/')) {
        // 代理到后端
        const backendPath = path.replace('/api', '');
        response = await fetchBackend(backendPath);
      } else if (path === '/health' || path === '/signals/health') {
        response = {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ 
            status: 'healthy', 
            worker: 'signal-market',
            timestamp: new Date().toISOString()
          })
        };
      } else {
        // 静态文件 (由 Pages 处理)
        response = {
          status: 404,
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ error: 'Not found' })
        };
      }
      
      return new Response(response.body, {
        status: response.status,
        headers: { ...response.headers, ...corsHeaders }
      });
      
    } catch(e) {
      return new Response(JSON.stringify({ error: e.message }), {
        status: 500,
        headers: { 'Content-Type': 'application/json', ...corsHeaders }
      });
    }
  }
};
