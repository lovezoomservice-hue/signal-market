/**
 * Signal Market - API Authentication
 * 
 * 简单的 API Key 认证
 */

const crypto = require('crypto');
const fs = require('fs');
const path = require('path');

// 模拟用户数据库
const USERS_DB_PATH = path.join(__dirname, '..', 'data', 'users.json');
const API_KEYS_PATH = path.join(__dirname, '..', 'data', 'api_keys.json');

// 初始化数据目录
const dataDir = path.join(__dirname, '..', 'data');
if (!fs.existsSync(dataDir)) {
  fs.mkdirSync(dataDir, { recursive: true });
}

// 加载/保存数据
function loadJSON(filePath, defaultVal = {}) {
  if (!fs.existsSync(filePath)) return defaultVal;
  try {
    return JSON.parse(fs.readFileSync(filePath, 'utf8'));
  } catch(e) {
    return defaultVal;
  }
}

function saveJSON(filePath, data) {
  fs.writeFileSync(filePath, JSON.stringify(data, null, 2));
}

// API Key 管理
class AuthSystem {
  constructor() {
    this.users = loadJSON(USERS_DB_PATH, {});
    this.apiKeys = loadJSON(API_KEYS_PATH, {});
  }
  
  // 生成 API Key
  generateKey(userId, plan = 'free') {
    const key = `sm_${crypto.randomBytes(16).toString('hex')}`;
    const keyData = {
      key,
      userId,
      plan,
      created: new Date().toISOString(),
      lastUsed: null,
      requests: 0
    };
    
    this.apiKeys[key] = keyData;
    saveJSON(API_KEYS_PATH, this.apiKeys);
    
    return keyData;
  }
  
  // 验证 API Key
  verifyKey(key) {
    const keyData = this.apiKeys[key];
    if (!keyData) return null;
    
    // 更新使用统计
    keyData.lastUsed = new Date().toISOString();
    keyData.requests = (keyData.requests || 0) + 1;
    saveJSON(API_KEYS_PATH, this.apiKeys);
    
    return keyData;
  }
  
  // 检查速率限制
  checkRateLimit(key) {
    const keyData = this.apiKeys[key];
    if (!keyData) return { allowed: false, reason: 'invalid_key' };
    
    const limits = {
      free: 100,      // 100 req/day
      basic: 1000,    // 1000 req/day
      pro: 10000,     // 10000 req/day
      enterprise: Infinity
    };
    
    const limit = limits[keyData.plan] || limits.free;
    const used = keyData.requests || 0;
    
    return {
      allowed: used < limit,
      remaining: Math.max(0, limit - used),
      limit,
      resetAt: this.getResetTime()
    };
  }
  
  getResetTime() {
    const now = new Date();
    const tomorrow = new Date(now);
    tomorrow.setDate(tomorrow.getDate() + 1);
    tomorrow.setHours(0, 0, 0, 0);
    return tomorrow.toISOString();
  }
  
  // 吊销 API Key
  revokeKey(key) {
    if (this.apiKeys[key]) {
      delete this.apiKeys[key];
      saveJSON(API_KEYS_PATH, this.apiKeys);
      return true;
    }
    return false;
  }
  
  // 用户注册 (简化版)
  register(email, name = '') {
    const userId = `user_${crypto.randomBytes(8).toString('hex')}`;
    this.users[userId] = {
      userId,
      email,
      name,
      created: new Date().toISOString(),
      plan: 'free'
    };
    saveJSON(USERS_DB_PATH, this.users);
    
    // 生成默认 API Key
    const keyData = this.generateKey(userId, 'free');
    
    return { user: this.users[userId], apiKey: keyData.key };
  }
  
  // 获取用户信息
  getUser(key) {
    const keyData = this.verifyKey(key);
    if (!keyData) return null;
    return this.users[keyData.userId];
  }
  
  // 中间件: 验证请求
  middleware() {
    return (req, res, next) => {
      // 跳过无需认证的路径
      const publicPaths = ['/health', '/signals/health', '/docs', '/'];
      if (publicPaths.some(p => req.path.startsWith(p))) {
        return next();
      }
      
      // 从 Header 获取 API Key
      const apiKey = req.headers['x-api-key'] || req.headers['authorization']?.replace('Bearer ', '');
      
      if (!apiKey) {
        return res.status(401).json({ error: 'Missing API Key', hint: 'Add x-api-key header' });
      }
      
      const keyData = this.verifyKey(apiKey);
      if (!keyData) {
        return res.status(401).json({ error: 'Invalid API Key' });
      }
      
      // 速率限制检查
      const rateLimit = this.checkRateLimit(apiKey);
      if (!rateLimit.allowed) {
        return res.status(429).json({ 
          error: 'Rate limit exceeded',
          limit: rateLimit.limit,
          resetAt: rateLimit.resetAt
        });
      }
      
      // 附加用户信息到请求
      req.user = this.users[keyData.userId];
      req.apiKey = keyData;
      req.rateLimit = rateLimit;
      
      next();
    };
  }
}

// 导出单例
const auth = new AuthSystem();

module.exports = { AuthSystem, auth };

// CLI 模式
if (require.main === module) {
  const args = process.argv.slice(2);
  const command = args[0];
  
  if (command === 'create-key') {
    const email = args[1] || 'demo@example.com';
    const result = auth.register(email);
    console.log(`✅ API Key created:`);
    console.log(`   Email: ${email}`);
    console.log(`   Key: ${result.apiKey}`);
    console.log(`   Plan: ${result.user.plan}`);
  } else if (command === 'verify') {
    const key = args[1];
    const result = auth.verifyKey(key);
    if (result) {
      console.log(`✅ Valid key`);
      console.log(`   User: ${result.userId}`);
      console.log(`   Plan: ${result.plan}`);
    } else {
      console.log(`❌ Invalid key`);
    }
  } else {
    console.log(`Usage:`);
    console.log(`  node auth.js create-key [email]`);
    console.log(`  node auth.js verify <key>`);
  }
}
