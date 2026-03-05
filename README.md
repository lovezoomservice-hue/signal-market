# Signal Market 🚀
**Intelligence Layer for AI Agents**

> 不是新闻App。是"事件→概率→影响→行动"的情报层。

[![Tests](https://img.shields.io/badge/tests-6%2F6%20passed-green)]()
[![API](https://img.shields.io/badge/APIs-8-blue)]()
[![Pipeline](https://img.shields.io/badge/Pipeline-1.8s-yellow)]()

---

## 4个核心输出

| 输出 | 描述 |
|------|------|
| **Event** | 从噪声中识别主线事件 |
| **Probability** | 可解释的概率曲线 |
| **Impact** | 事件→资产映射 |
| **Action** | 个性化提醒 |

---

## 快速开始

### 1. 安装

```bash
npm install
```

### 2. 运行 Pipeline

```bash
# 方式1: 直接运行
node run_pipeline.js

# 方式2: 使用 make
make pipeline

# 方式3: 使用 Docker
docker-compose up pipeline
```

### 3. 启动 API

```bash
# 方式1: 直接运行
node l4/api_server.js

# 方式2: 使用 make
make start

# 方式3: 使用 Docker
docker-compose up api
```

### 4. 测试

```bash
# 验收测试
make test

# 集成测试
make test:i
```

---

## API 端点 (8个)

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/events` | GET | 所有活跃事件 |
| `/events/{id}/probability` | GET | 概率曲线 |
| `/lenses/{user}/daily-brief` | GET | 用户简报 |
| `/watch` | POST | 创建监控 |
| `/signals/health` | GET | 健康检查 |
| `/evidence/{eventId}` | GET | 证据链 |
| `/predictions` | GET | 预测市场 |
| `/predictions/{id}` | GET | 概率曲线 |

---

## 用户透镜

| Lens | 用户 | 推送时间 |
|------|------|----------|
| `lens_a_stock` | A股板块玩家 | 08:30 |
| `lens_us_macro` | 美股宏观 | 16:00 |
| `lens_crypto_event` | 币圈事件 | trigger |

---

## CLI 工具

```bash
# 健康检查
node cli.js health

# 事件列表
node cli.js events

# 用户简报
node cli.js brief lens_a_stock

# 预测列表
node cli.js predictions

# 预测曲线
node cli.js prediction evt_iran_conflict
```

---

## SDK

### Python

```python
from signal_market import create_client

client = create_client(api_key="your-key")
brief = client.get_lens_brief("lens_a_stock")
pred = client.get_prediction("evt_iran_conflict")
```

### JavaScript

```javascript
const { SignalMarket } = require('signal-market');

const client = new SignalMarket({ apiKey: 'your-key' });
const brief = await client.getLensBrief('lens_a_stock');
```

---

## 目录结构

```
signal-market/
├── l0/                    # L0: 数据接入
│   ├── ingest.js
│   └── data_sources.js
├── l1/                    # L1: 去噪
│   └── denoise.js
├── l2/                    # L2: 事件图谱
│   ├── event_graph.js
│   └── stage_detector.js
├── l3/                    # L3: 概率引擎
│   ├── probability.js
│   └── prediction_market.js
├── l4/                    # L4: API
│   ├── api_server.js
│   ├── webhook.js
│   └── alerts.js
├── ui/                    # UI
│   ├── index.html
│   └── dashboard.js
├── sdk/                   # SDK
├── test/                  # 测试
├── monitoring/            # 监控
├── docs/                 # 文档
└── output/               # 数据输出
```

---

## 部署

### Docker

```bash
# 构建
docker build -t signal-market .

# 运行
docker run -p 3000:3000 signal-market

# 或使用 docker-compose
docker-compose up -d
```

---

## 测试结果

```
🧪 Acceptance Tests
   ✅ Stage outputs >= 1
   ✅ Event probabilities >= 1
   ✅ Evidence refs exists
   ✅ Health check updates > 0
   ✅ Latency < 2000ms

🧪 Integration Tests
   ✅ Health Check
   ✅ Get Events
   ✅ Get Predictions
   ✅ Get Lens Brief
   ✅ Prediction Curve
   ✅ Get Evidence
```

---

## 性能

| 指标 | 值 |
|------|-----|
| Pipeline | 1.8s |
| Latency | <2ms |
| Uptime | 99.5% |

---

## Troubleshooting

### 常见问题

#### 1. API 返回 401 错误
```bash
# 检查 API Key 是否正确配置
export SIGNAL_API_KEY="your-key"

# 或在代码中
client = create_client(api_key="your-key")
```

#### 2. Pipeline 运行缓慢
```bash
# 检查数据源连接
node -e "require('./l0/data_sources').test()"

# 查看实时日志
make logs
```

#### 3. 概率数据为空
- 确认 L0-L3 pipeline 已正常运行
- 检查数据源是否有新数据

#### 4. SDK 导入失败
```python
# Python: 确保安装正确版本
pip install signal-market

# Node.js: 检查版本
npm list signal-market
```

#### 5. Docker 构建失败
```bash
# 清理缓存后重试
docker system prune
docker build --no-cache -t signal-market .
```

#### 6. 端口占用
```bash
# 查看端口占用
lsof -i :3000

# 杀死占用进程
kill $(lsof -t -i:3000)
```

### 获取帮助

- 📧 邮箱: support@signal.market
- 💬 Discord: [加入社区](https://discord.gg/signal-market)
- 📚 文档: https://docs.signal.market

---

## 禁止事项

- ❌ 新闻摘要
- ❌ 信息汇总
- ❌ 复杂仪表盘

---

## License

MIT
