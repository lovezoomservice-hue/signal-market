# Signal Market - Cloudflare 部署指南

## 📋 部署概述

本项目使用 **Cloudflare Pages** 托管前端静态资源，配合 **Cloudflare Workers** 提供无服务器 API。

## 🚀 快速开始

### 前置要求

1. **Cloudflare 账号** - [注册](https://dash.cloudflare.com/)
2. **wrangler CLI** - 已安装 (v4.70.0)

### 登录 Cloudflare

```bash
wrangler login
```

浏览器将打开并要求授权。

---

## 📦 部署步骤

### 方式一: 使用部署脚本 (推荐)

```bash
cd signal-market

# 预览环境部署
./deploy.sh preview

# 生产环境部署
./deploy.sh production

# 部署 Worker
./deploy.sh worker

# 部署全部 (Pages + Worker)
./deploy.sh all
```

### 方式二: 手动部署

```bash
# 1. 创建 Pages 项目
wrangler pages project create signal-market

# 2. 部署前端
wrangler pages deploy ./ui --project-name=signal-market --branch=main

# 3. 部署 Worker (可选)
wrangler deploy worker.js --env production
```

---

## 🔧 配置说明

### wrangler.toml

Workers 配置文件:
- `name` - 项目名称
- `kv_namespaces` - KV 键值存储绑定
- `d1_databases` - D1 数据库绑定

### cloudflare_pages.toml

Pages 配置文件:
- `compatibility_date` - 兼容性日期
- `pages_build_output_dir` - 构建输出目录

### _redirects

SPA 路由配置 - 确保所有路由正确回退到 `index.html`。

---

## 🏗️ 创建必要资源

### KV 命名空间 (事件存储)

```bash
wrangler kv:namespace create "EVENTS"
```

将返回的 `id` 添加到 `wrangler.toml`。

### D1 数据库 (可选 - 用户系统)

```bash
wrangler d1 create signal-market
```

---

## 🌐 域名绑定

部署完成后，在 Cloudflare Dashboard:

1. 进入 **Workers & Pages** → **signal-market**
2. 点击 **自定义域**
3. 添加你的域名

---

## 🔒 环境变量

生产环境需要设置:

```bash
# API Key
wrangler secret put API_KEY

# Auth 开关
wrangler secret put AUTH_ENABLED
```

---

## 📊 验证部署

```bash
# 检查 Worker 状态
curl https://signal-market.<your-account>.workers.dev/health

# 或直接访问
https://signal-market.pages.dev
```

---

## 🐛 常见问题

### 部署失败

1. 检查 `wrangler login` 状态
2. 确认 `wrangler whoami` 显示正确的账号
3. 查看错误信息并重试

### 静态资源 404

确保 `_redirects` 文件在 `ui/` 目录中。

### CORS 错误

Worker 已配置 CORS 头，如需调整请修改 `worker.js`。

---

## 📝 相关文件

- `wrangler.toml` - Workers 配置
- `cloudflare_pages.toml` - Pages 配置
- `worker.js` - Workers 入口文件
- `ui/` - 前端静态资源
- `deploy.sh` - 部署脚本
