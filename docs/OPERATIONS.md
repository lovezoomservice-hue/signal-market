# Signal Market 运维手册

## 目录

- [部署步骤](#部署步骤)
- [监控说明](#监控说明)
- [故障处理](#故障处理)
- [日常维护](#日常维护)

---

## 部署步骤

### 1. 环境要求

- Node.js >= 18.0.0
- npm >= 8.0.0
- 磁盘空间 >= 1GB
- 内存 >= 512MB

### 2. 部署流程

```bash
# 1. 进入项目目录
cd /home/nice005/.openclaw/workspace/signal-market

# 2. 安装依赖
npm install

# 3. 配置环境变量
cp .env.example .env
# 编辑 .env 填入必要配置

# 4. 启动服务
# 开发模式
npm run dev

# 生产模式
npm start
# 或使用 PM2
pm2 start worker.js --name signal-market
```

### 3. Docker 部署

```bash
# 构建镜像
docker build -t signal-market:latest .

# 运行容器
docker run -d -p 3000:3000 --name signal-market signal-market:latest

# 或使用 docker-compose
docker-compose up -d
```

### 4. Cloudflare Pages 部署

```bash
# 使用 wrangler 部署
wrangler pages deploy output --project-name signal-market
```

---

## 监控说明

### 1. 监控端点

| 端点 | 说明 |
|------|------|
| `/l4/health.js?type=quick` | 快速健康检查 |
| `/l4/health.js?type=full` | 完整健康检查 |
| `/ui/admin.html` | 运维 Dashboard |

### 2. 监控指标

#### 系统指标
- **CPU 负载**: 1分钟/5分钟/15分钟平均值
- **内存使用**: 已用/可用/百分比
- **磁盘空间**: 已用/可用/使用率

#### 应用指标
- **API 延迟**: p50/p95/p99 百分位
- **请求计数**: 按端点/状态码分类
- **错误计数**: 按严重程度分类

### 3. 运维 Dashboard

访问 `/ui/admin.html` 可以查看：

- 系统资源状态 (CPU/内存/磁盘)
- API 调用统计
- 实时错误日志
- 自动刷新 (30秒)

---

## 故障处理

### 1. 服务无法启动

**症状**: `npm start` 或 `node worker.js` 报错

**排查步骤**:

```bash
# 1. 检查 Node.js 版本
node --version

# 2. 检查依赖是否安装完整
npm install

# 3. 检查端口占用
lsof -i :3000
# 或
netstat -tlnp | grep 3000

# 4. 查看错误日志
tail -f output/logs/error.log
```

**常见错误**:

| 错误 | 解决方案 |
|------|----------|
| `EADDRINUSE` | 端口被占用，修改端口或 kill 占用进程 |
| `MODULE_NOT_FOUND` | 重新 `npm install` |
| `permission denied` | 检查文件权限 `chmod +x` |

### 2. 内存溢出

**症状**: 进程被 OOM killer 终止，或提示 `JavaScript heap out of memory`

**解决方案**:

```bash
# 增加 Node.js 内存限制
NODE_OPTIONS="--max-old-space-size=4096" node worker.js

# 或在 package.json 中配置
"scripts": {
  "start": "node --max-old-space-size=4096 worker.js"
}
```

### 3. 磁盘空间不足

**症状**: 写入文件失败，`ENOSPC` 错误

**解决方案**:

```bash
# 1. 清理旧日志
rm -rf output/logs/*.log

# 2. 清理旧指标 (超过7天)
node monitoring/performance.js
# 或手动删除
rm -f output/metrics/*.jsonl

# 3. 清理输出文件
rm -rf output/packs/*
rm -rf output/signals/*
```

### 4. API 响应慢

**排查步骤**:

```bash
# 1. 检查系统负载
top
# 或
htop

# 2. 检查内存使用
free -h

# 3. 检查磁盘 I/O
iostat -x 1

# 4. 查看慢请求日志
tail -f output/logs/slow.log
```

**优化建议**:

- 增加缓存 (Redis)
- 优化数据库查询
- 增加 worker 数量
- 使用 CDN 分发静态资源

### 5. 数据库连接失败

**症状**: `ECONNREFUSED` 或连接超时

**排查**:

```bash
# 1. 检查数据库服务状态
systemctl status postgresql
# 或
systemctl status mysql

# 2. 测试连接
psql -h localhost -U username -d database
```

---

## 日常维护

### 1. 定期任务

| 任务 | 频率 | 命令 |
|------|------|------|
| 清理旧日志 | 每天 | `find output/logs -mtime +7 -delete` |
| 清理旧指标 | 每周 | `node monitoring/performance.js` (运行 cleanup) |
| 备份数据 | 每天 | `tar -czf backup_$(date +%Y%m%d).tar.gz data/` |
| 检查磁盘 | 每天 | `df -h` |

### 2. 日志管理

```bash
# 实时查看日志
tail -f output/logs/combined.log

# 查看错误日志
grep ERROR output/logs/combined.log

# 日志轮转 (使用 logrotate)
# /etc/logrotate.d/signal-market
```

### 3. 性能调优

```javascript
// 在 .env 中配置
NODE_ENV=production
MAX_WORKERS=4
CACHE_TTL=3600
REQUEST_TIMEOUT=30000
```

### 4. 监控告警

配置告警规则 (在 alerts.js 中):

```javascript
const ALERT_RULES = [
  { metric: 'cpu', threshold: 80, duration: 300 },  // CPU > 80% 持续 5 分钟
  { metric: 'memory', threshold: 90, duration: 60 }, // 内存 > 90% 持续 1 分钟
  { metric: 'disk', threshold: 90, duration: 0 },    // 磁盘 > 90% 立即告警
  { metric: 'error', threshold: 10, duration: 60 }  // 1 分钟内 10 个错误
];
```

### 5. 备份与恢复

```bash
# 备份
tar -czvf signal-market-backup-$(date +%Y%m%d).tar.gz \
  data/ \
  output/metrics/ \
  .env

# 恢复
tar -xzvf signal-market-backup-20240101.tar.gz
```

---

## 快速命令参考

```bash
# 启动服务
npm start

# 停止服务
pkill -f worker.js

# 重启服务
pkill -f worker.js && npm start

# 查看状态
pm2 status

# 查看日志
pm2 logs

# 健康检查
curl http://localhost:3000/l4/health.js

# 运维 Dashboard
# 浏览器打开 http://localhost:3000/ui/admin.html
```

---

## 联系支持

- 问题反馈: 创建 GitHub Issue
- 紧急联系: 查看项目 README 中的联系方式
