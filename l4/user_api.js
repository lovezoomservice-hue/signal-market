/**
 * L4: User API
 * 
 * 用户系统 REST API
 * Endpoints:
 * - POST /register - 用户注册
 * - POST /login - 用户登录
 * - GET /me - 获取用户信息
 * - POST /api-key - 签发 API Key
 * - DELETE /api-key/:key - 吊销 Key
 * - GET /usage - 使用统计
 */

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const http = require('http');

const CONFIG = {
  port: 3001,
  dataDir: path.join(__dirname, '..', 'data'),
  jwtSecret: process.env.JWT_SECRET || 'signal_market_secret_change_in_prod'
};

// 数据文件路径
const USERS_DB = path.join(CONFIG.dataDir, 'users.json');
const API_KEYS_DB = path.join(CONFIG.dataDir, 'api_keys.json');
const SESSIONS_DB = path.join(CONFIG.dataDir, 'sessions.json');
const PLANS_DB = path.join(CONFIG.dataDir, 'plans.json');

// 确保数据目录存在
if (!fs.existsSync(CONFIG.dataDir)) {
  fs.mkdirSync(CONFIG.dataDir, { recursive: true });
}

// 初始化默认数据
function initData() {
  // 默认订阅计划
  if (!fs.existsSync(PLANS_DB)) {
    const plans = {
      free: {
        name: 'Free',
        price: 0,
        requestsPerDay: 100,
        features: ['基础事件', '每日简报', 'Email支持']
      },
      basic: {
        name: 'Basic',
        price: 9.99,
        requestsPerDay: 1000,
        features: ['完整事件', '实时推送', '优先级支持']
      },
      pro: {
        name: 'Pro',
        price: 49.99,
        requestsPerDay: 10000,
        features: ['预测曲线', '自定义透镜', 'API访问', 'Slack集成']
      },
      enterprise: {
        name: 'Enterprise',
        price: 299.99,
        requestsPerDay: Infinity,
        features: ['无限量', '专属客服', 'SLA保证', '定制开发']
      }
    };
    fs.writeFileSync(PLANS_DB, JSON.stringify(plans, null, 2));
  }
}

// 加载/保存工具函数
function loadJSON(filePath, defaultVal = {}) {
  if (!fs.existsSync(filePath)) return defaultVal;
  try {
    return JSON.parse(fs.readFileSync(filePath, 'utf8'));
  } catch(e) {
    console.error('Error loading JSON:', filePath, e.message);
    return defaultVal;
  }
}

function saveJSON(filePath, data) {
  fs.writeFileSync(filePath, JSON.stringify(data, null, 2));
}

// 密码工具
function hashPassword(password, salt) {
  return crypto.pbkdf2Sync(password, salt, 100000, 64, 'sha512').toString('hex');
}

function generateToken() {
  return crypto.randomBytes(32).toString('hex');
}

// 用户系统类
class UserSystem {
  constructor() {
    this.users = loadJSON(USERS_DB, {});
    this.apiKeys = loadJSON(API_KEYS_DB, {});
    this.sessions = loadJSON(SESSIONS_DB, {});
    this.plans = loadJSON(PLANS_DB, {});
    initData();
  }
  
  // ========== 用户管理 ==========
  
  // 注册新用户
  register(email, password, name = '') {
    // 检查邮箱是否已存在
    const existingUser = Object.values(this.users).find(u => u.email === email);
    if (existingUser) {
      return { success: false, error: 'Email already registered' };
    }
    
    const userId = `user_${crypto.randomBytes(8).toString('hex')}`;
    const salt = crypto.randomBytes(16).toString('hex');
    const passwordHash = hashPassword(password, salt);
    
    const user = {
      userId,
      email,
      name,
      passwordHash,
      salt,
      plan: 'free',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      emailVerified: false,
      lastLogin: null
    };
    
    this.users[userId] = user;
    saveJSON(USERS_DB, this.users);
    
    // 自动生成免费 API Key
    const apiKey = this.generateAPIKey(userId, 'free');
    
    // 创建会话
    const sessionToken = this.createSession(userId);
    
    return {
      success: true,
      user: this.sanitizeUser(user),
      apiKey: apiKey.key,
      sessionToken
    };
  }
  
  // 用户登录
  login(email, password) {
    const user = Object.values(this.users).find(u => u.email === email);
    if (!user) {
      return { success: false, error: 'Invalid email or password' };
    }
    
    const passwordHash = hashPassword(password, user.salt);
    if (passwordHash !== user.passwordHash) {
      return { success: false, error: 'Invalid email or password' };
    }
    
    // 更新最后登录
    user.lastLogin = new Date().toISOString();
    this.users[user.userId] = user;
    saveJSON(USERS_DB, this.users);
    
    // 创建会话
    const sessionToken = this.createSession(user.userId);
    
    return {
      success: true,
      user: this.sanitizeUser(user),
      sessionToken
    };
  }
  
  // 获取用户信息
  getUser(userId) {
    const user = this.users[userId];
    if (!user) return null;
    return this.sanitizeUser(user);
  }
  
  // 通过会话获取用户
  getUserBySession(sessionToken) {
    const session = this.sessions[sessionToken];
    if (!session || session.expiresAt < Date.now()) {
      if (session) this.deleteSession(sessionToken);
      return null;
    }
    return this.getUser(session.userId);
  }
  
  // 更新用户信息
  updateUser(userId, updates) {
    const user = this.users[userId];
    if (!user) return { success: false, error: 'User not found' };
    
    // 允许更新的字段
    const allowedFields = ['name', 'plan'];
    for (const field of allowedFields) {
      if (updates[field] !== undefined) {
        user[field] = updates[field];
      }
    }
    user.updatedAt = new Date().toISOString();
    
    this.users[userId] = user;
    saveJSON(USERS_DB, this.users);
    
    return { success: true, user: this.sanitizeUser(user) };
  }
  
  // ========== API Key 管理 ==========
  
  // 生成 API Key
  generateAPIKey(userId, plan = 'free') {
    const key = `sm_${crypto.randomBytes(16).toString('hex')}`;
    const keyData = {
      key,
      userId,
      plan,
      name: `${plan} Key`,
      createdAt: new Date().toISOString(),
      lastUsedAt: null,
      requestsCount: 0,
      expiresAt: null // null = 永不过期
    };
    
    this.apiKeys[key] = keyData;
    saveJSON(API_KEYS_DB, this.apiKeys);
    
    return keyData;
  }
  
  // 获取用户的 API Keys
  getUserAPIKeys(userId) {
    return Object.values(this.apiKeys)
      .filter(k => k.userId === userId)
      .map(k => ({
        key: k.key.substring(0, 12) + '...' + k.key.substring(k.key.length - 4),
        fullKey: k.key,
        plan: k.plan,
        name: k.name,
        createdAt: k.createdAt,
        lastUsedAt: k.lastUsedAt,
        requestsCount: k.requestsCount
      }));
  }
  
  // 验证 API Key
  verifyAPIKey(key) {
    const keyData = this.apiKeys[key];
    if (!keyData) return null;
    
    // 检查是否过期
    if (keyData.expiresAt && new Date(keyData.expiresAt) < new Date()) {
      return { valid: false, error: 'API Key expired' };
    }
    
    return { valid: true, keyData };
  }
  
  // 使用 API Key (记录请求)
  useAPIKey(key) {
    const keyData = this.apiKeys[key];
    if (!keyData) return false;
    
    keyData.lastUsedAt = new Date().toISOString();
    keyData.requestsCount = (keyData.requestsCount || 0) + 1;
    saveJSON(API_KEYS_DB, this.apiKeys);
    
    return true;
  }
  
  // 吊销 API Key
  revokeAPIKey(key) {
    if (this.apiKeys[key]) {
      delete this.apiKeys[key];
      saveJSON(API_KEYS_DB, this.apiKeys);
      return true;
    }
    return false;
  }
  
  // ========== 会话管理 ==========
  
  createSession(userId) {
    const token = generateToken();
    const expiresAt = Date.now() + (7 * 24 * 60 * 60 * 1000); // 7 天
    
    this.sessions[token] = {
      userId,
      createdAt: new Date().toISOString(),
      expiresAt
    };
    saveJSON(SESSIONS_DB, this.sessions);
    
    return token;
  }
  
  deleteSession(token) {
    if (this.sessions[token]) {
      delete this.sessions[token];
      saveJSON(SESSIONS_DB, this.sessions);
      return true;
    }
    return false;
  }
  
  // ========== 使用统计 ==========
  
  getUsage(userId) {
    const keys = Object.values(this.apiKeys).filter(k => k.userId === userId);
    const totalRequests = keys.reduce((sum, k) => sum + (k.requestsCount || 0), 0);
    const planLimits = {
      free: 100,
      basic: 1000,
      pro: 10000,
      enterprise: Infinity
    };
    
    const user = this.users[userId];
    const plan = user?.plan || 'free';
    const limit = planLimits[plan] || 100;
    
    // 今天的请求数 (简化版，实际应按天统计)
    const todayRequests = totalRequests;
    
    return {
      plan,
      totalRequests,
      todayRequests,
      limit: limit === Infinity ? 'unlimited' : limit,
      remaining: limit === Infinity ? 'unlimited' : Math.max(0, limit - todayRequests),
      keysCount: keys.length,
      resetAt: this.getDailyResetTime()
    };
  }
  
  getDailyResetTime() {
    const now = new Date();
    const tomorrow = new Date(now);
    tomorrow.setDate(tomorrow.getDate() + 1);
    tomorrow.setHours(0, 0, 0, 0);
    return tomorrow.toISOString();
  }
  
  // ========== 工具方法 ==========
  
  sanitizeUser(user) {
    const { passwordHash, salt, ...sanitized } = user;
    return sanitized;
  }
}

// 创建用户系统实例
const userSystem = new UserSystem();

// ========== HTTP 请求处理 ==========

function parseBody(req) {
  return new Promise((resolve, reject) => {
    let body = '';
    req.on('data', chunk => body += chunk);
    req.on('end', () => {
      try {
        resolve(body ? JSON.parse(body) : {});
      } catch(e) {
        reject(e);
      }
    });
    req.on('error', reject);
  });
}

function sendJSON(res, statusCode, data) {
  res.statusCode = statusCode;
  res.setHeader('Content-Type', 'application/json');
  res.end(JSON.stringify(data));
}

function getSessionToken(req) {
  return req.headers['x-session-token'] || 
         req.headers['authorization']?.replace('Bearer ', '');
}

// 路由处理
async function handleRequest(req, res) {
  // CORS 头
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, X-Session-Token, X-API-Key');
  
  if (req.method === 'OPTIONS') {
    res.statusCode = 204;
    return res.end();
  }
  
  const url = new URL(req.url, `http://localhost:${CONFIG.port}`);
  const path = url.pathname;
  const method = req.method;
  
  console.log(`${method} ${path}`);
  
  try {
    // 公开端点
    if (path === '/register' && method === 'POST') {
      const body = await parseBody(req);
      const { email, password, name } = body;
      
      if (!email || !password) {
        return sendJSON(res, 400, { error: 'Email and password required' });
      }
      
      const result = userSystem.register(email, password, name);
      if (!result.success) {
        return sendJSON(res, 400, result);
      }
      
      return sendJSON(res, 201, result);
    }
    
    if (path === '/login' && method === 'POST') {
      const body = await parseBody(req);
      const { email, password } = body;
      
      if (!email || !password) {
        return sendJSON(res, 400, { error: 'Email and password required' });
      }
      
      const result = userSystem.login(email, password);
      if (!result.success) {
        return sendJSON(res, 401, result);
      }
      
      return sendJSON(res, 200, result);
    }
    
    if (path === '/plans' && method === 'GET') {
      const plans = loadJSON(PLANS_DB, {});
      return sendJSON(res, 200, { plans });
    }
    
    // 需要认证的端点
    const sessionToken = getSessionToken(req);
    const user = sessionToken ? userSystem.getUserBySession(sessionToken) : null;
    
    if (!user) {
      return sendJSON(res, 401, { error: 'Authentication required' });
    }
    
    // 获取当前用户信息
    if (path === '/me' && method === 'GET') {
      const apiKeys = userSystem.getUserAPIKeys(user.userId);
      const usage = userSystem.getUsage(user.userId);
      return sendJSON(res, 200, { user, apiKeys, usage });
    }
    
    // 更新用户信息
    if (path === '/me' && method === 'PUT') {
      const body = await parseBody(req);
      const result = userSystem.updateUser(user.userId, body);
      if (!result.success) {
        return sendJSON(res, 400, result);
      }
      return sendJSON(res, 200, result);
    }
    
    // 签发新的 API Key
    if (path === '/api-key' && method === 'POST') {
      const body = await parseBody(req);
      const plan = body.plan || user.plan || 'free';
      const name = body.name || `${plan} Key`;
      
      // 限制免费用户只能有一个 key
      if (plan === 'free') {
        const existingKeys = userSystem.getUserAPIKeys(user.userId);
        if (existingKeys.length > 0) {
          return sendJSON(res, 400, { 
            error: 'Free plan allows only one API key. Upgrade to create more.' 
          });
        }
      }
      
      const keyData = userSystem.generateAPIKey(user.userId, plan);
      keyData.name = name;
      
      return sendJSON(res, 201, { 
        success: true, 
        apiKey: keyData.key,
        plan: keyData.plan,
        name: keyData.name
      });
    }
    
    // 获取用户的 API Keys
    if (path === '/api-keys' && method === 'GET') {
      const keys = userSystem.getUserAPIKeys(user.userId);
      return sendJSON(res, 200, { apiKeys: keys });
    }
    
    // 吊销 API Key
    if (path.match(/^\/api-key\/[\w-]+$/) && method === 'DELETE') {
      const key = path.split('/').pop();
      const success = userSystem.revokeAPIKey(key);
      if (success) {
        return sendJSON(res, 200, { success: true, message: 'API Key revoked' });
      }
      return sendJSON(res, 404, { error: 'API Key not found' });
    }
    
    // 使用统计
    if (path === '/usage' && method === 'GET') {
      const usage = userSystem.getUsage(user.userId);
      return sendJSON(res, 200, usage);
    }
    
    // 登出
    if (path === '/logout' && method === 'POST') {
      if (sessionToken) {
        userSystem.deleteSession(sessionToken);
      }
      return sendJSON(res, 200, { success: true, message: 'Logged out' });
    }
    
    // 404
    sendJSON(res, 404, { error: 'Not found' });
    
  } catch(e) {
    console.error('Error:', e);
    sendJSON(res, 500, { error: 'Internal server error' });
  }
}

// 启动服务器
const server = http.createServer(handleRequest);

server.listen(CONFIG.port, () => {
  console.log(`🔐 Signal Market User API`);
  console.log(`   Port: ${CONFIG.port}`);
  console.log(`   Endpoints:`);
  console.log(`   Public:`);
  console.log(`   - POST /register`);
  console.log(`   - POST /login`);
  console.log(`   - GET /plans`);
  console.log(`   Auth Required:`);
  console.log(`   - GET /me`);
  console.log(`   - PUT /me`);
  console.log(`   - POST /api-key`);
  console.log(`   - GET /api-keys`);
  console.log(`   - DELETE /api-key/:key`);
  console.log(`   - GET /usage`);
  console.log(`   - POST /logout`);
});

module.exports = { server, userSystem, CONFIG };
