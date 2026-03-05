# Signal Market 用户系统设计

## 概述

Signal Market 是一个事件驱动型预测市场信号平台。用户系统负责身份认证、API Key 管理、订阅计划和用量追踪。

## 1. 用户数据模型

### users.json

```json
{
  "user_abc123...": {
    "userId": "user_abc123...",
    "email": "user@example.com",
    "name": "张三",
    "passwordHash": "<pbkdf2_sha512_hash>",
    "salt": "<random_salt>",
    "plan": "free",
    "createdAt": "2024-01-01T00:00:00.000Z",
    "updatedAt": "2024-01-15T12:30:00.000Z",
    "emailVerified": false,
    "lastLogin": "2024-01-15T12:30:00.000Z"
  }
}
```

### api_keys.json

```json
{
  "sm_abc123...": {
    "key": "sm_abc123...",
    "userId": "user_abc123...",
    "plan": "free",
    "name": "My API Key",
    "createdAt": "2024-01-01T00:00:00.000Z",
    "lastUsedAt": "2024-01-15T12:30:00.000Z",
    "requestsCount": 150,
    "expiresAt": null
  }
}
```

### sessions.json

```json
{
  "<session_token>": {
    "userId": "user_abc123...",
    "createdAt": "2024-01-15T12:30:00.000Z",
    "expiresAt": 1705334400000
  }
}
```

### plans.json

```json
{
  "free": {
    "name": "Free",
    "price": 0,
    "requestsPerDay": 100,
    "features": ["基础事件", "每日简报", "Email支持"]
  },
  "basic": {
    "name": "Basic",
    "price": 9.99,
    "requestsPerDay": 1000,
    "features": ["完整事件", "实时推送", "优先级支持"]
  },
  "pro": {
    "name": "Pro",
    "price": 49.99,
    "requestsPerDay": 10000,
    "features": ["预测曲线", "自定义透镜", "API访问", "Slack集成"]
  },
  "enterprise": {
    "name": "Enterprise",
    "price": 299.99,
    "requestsPerDay": Infinity,
    "features": ["无限量", "专属客服", "SLA保证", "定制开发"]
  }
}
```

## 2. API Key 签发流程

### 注册时自动签发

```
用户 POST /register
  → 验证邮箱格式
  → 检查邮箱是否已注册
  → 生成 userId
  → 生成 salt + 密码哈希
  → 创建用户记录
  → 自动签发 free 套餐 API Key
  → 创建 7 天有效期会话 Token
  → 返回 { user, apiKey, sessionToken }
```

### 手动签发新 Key

```
用户 POST /api-key (需认证)
  → 检查用户套餐限制
    - free: 最多 1 个 key
    - basic/pro/enterprise: 最多 5 个 key
  → 生成随机 Key: sm_<32_hex>
  → 记录到 api_keys.json
  → 返回 { apiKey, plan, name }
```

### Key 吊销

```
用户 DELETE /api-key/:key (需认证)
  → 验证 Key 属于当前用户
  → 从 api_keys.json 删除
  → 返回 { success: true }
```

## 3. 订阅计划

| 计划 | 价格 | 每日请求 | API Keys | 特性 |
|------|------|----------|----------|------|
| Free | $0 | 100 | 1 | 基础事件、每日简报 |
| Basic | $9.99/月 | 1,000 | 3 | 完整事件、实时推送 |
| Pro | $49.99/月 | 10,000 | 5 | 预测曲线、自定义透镜、Slack |
| Enterprise | $299.99/月 | 无限制 | 无限 | 专属客服、SLA、定制开发 |

## 4. REST API 端点

### 公开端点

| 方法 | 路径 | 描述 |
|------|------|------|
| POST | /register | 用户注册 |
| POST | /login | 用户登录 |
| GET | /plans | 获取订阅计划列表 |

### 认证端点 (需要 X-Session-Token)

| 方法 | 路径 | 描述 |
|------|------|------|
| GET | /me | 获取当前用户信息 |
| PUT | /me | 更新用户信息 |
| POST | /api-key | 签发新 API Key |
| GET | /api-keys | 获取用户所有 API Keys |
| DELETE | /api-key/:key | 吊销 API Key |
| GET | /usage | 获取使用统计 |
| POST | /logout | 退出登录 |

## 5. 认证机制

### 会话认证

- 登录/注册成功后返回 `sessionToken`
- 客户端存储在 localStorage
- 请求头传递: `X-Session-Token: <token>`
- 会话有效期: 7 天

### API Key 认证

- 用于程序化访问 API
- 请求头传递: `X-API-Key: <key>` 或 `Authorization: Bearer <key>`
- 支持速率限制检查

## 6. 速率限制

基于用户套餐，每日限制:

```javascript
const LIMITS = {
  free: 100,
  basic: 1000,
  pro: 10000,
  enterprise: Infinity
};
```

响应头:
- `X-RateLimit-Limit`: 限制次数
- `X-RateLimit-Remaining`: 剩余次数
- `X-RateLimit-Reset`: 重置时间

## 7. 用户 Portal

位置: `ui/portal.html`

功能:
- 登录/注册表单
- 个人账户信息展示
- API Key 管理 (创建/复制/吊销)
- 使用统计仪表盘
- 套餐升级入口

## 8. 文件结构

```
signal-market/
├── data/
│   ├── users.json      # 用户数据库
│   ├── api_keys.json   # API Key 存储
│   ├── sessions.json  # 会话存储
│   └── plans.json     # 订阅计划配置
├── l4/
│   ├── auth.js         # 简化版认证 (向后兼容)
│   ├── user_api.js     # 完整用户 REST API
│   └── api_server_auth.js  # 带认证的 API Server
└── ui/
    ├── portal.html     # 用户 Portal
    ├── dashboard_live.html # 实时仪表盘
    └── index.html     # 主页面
```

## 9. 启动方式

```bash
# 启动用户 API 服务器 (端口 3001)
node l4/user_api.js

# 启动主 API 服务器 (端口 3000)
node l4/api_server_auth.js
```

## 10. 安全注意事项

1. **密码存储**: 使用 PBKDF2 + SHA512，100,000 次迭代
2. **会话安全**: Token 随机 32 字节，7 天过期
3. **速率限制**: 基于 API Key，防止滥用
4. **CORS**: 允许跨域请求，生产环境应限制来源
5. **JWT Secret**: 生产环境应通过环境变量设置
