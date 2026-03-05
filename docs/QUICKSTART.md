# Signal Market - 5分钟快速入门

> 5分钟内完成接入，开始获取智能信号

---

## 前置要求

- Node.js 18+ 或 Python 3.8+
- API Key (可从 [signal.market](https://signal.market) 获取)

---

## 快速开始

### 方式一：使用 CLI (推荐)

```bash
# 1. 全局安装 CLI
npm install -g signal-market-cli

# 2. 配置 API Key
signal-market config set-api-key YOUR_API_KEY

# 3. 获取简报
signal-market brief lens_a_stock
```

### 方式二：使用 SDK

#### Python

```bash
# 1. 安装 SDK
pip install signal-market

# 2. 创建客户端
python
from signal_market import create_client

client = create_client(api_key="YOUR_API_KEY")

# 3. 获取简报
brief = client.get_lens_brief("lens_a_stock")
print(brief)
/Node.js

```

#### JavaScript```bash
# 1. 安装 SDK
npm install signal-market

# 2. 创建客户端
const { SignalMarket } = require('signal-market');

const client = new SignalMarket({ apiKey: 'YOUR_API_KEY' });

# 3. 获取简报
const brief = await client.getLensBrief('lens_a_stock');
console.log(brief);
```

### 方式三：直接调用 API

```bash
# 获取事件列表
curl -H "Authorization: Bearer YOUR_API_KEY" \
  https://api.signal.market/v1/events

# 获取用户简报
curl -H "Authorization: Bearer YOUR_API_KEY" \
  https://api.signal.market/v1/lenses/lens_a_stock/daily-brief

# 获取预测概率
curl -H "Authorization: Bearer YOUR_API_KEY" \
  https://api.signal.market/v1/predictions/evt_iran_conflict
```

---

## 5分钟实战

### 第1分钟：获取今日机会

```python
from signal_market import create_client

client = create_client(api_key="YOUR_KEY")
brief = client.get_lens_brief("lens_a_stock")

# 打印今日Top机会
for opp in brief["top_opportunities"][:3]:
    print(f"- {opp['topic']}: P(7天)={opp['probability']}")
```

### 第2分钟：查看概率曲线

```python
# 获取事件概率走势
prediction = client.get_prediction("evt_iran_conflict")

print(f"当前概率: {prediction['probabilities']['P_7d']:.0%}")
print(f"较昨日: {prediction['explanation']['change']}")
```

### 第3分钟：创建监控

```python
# 创建自定义监控
watch = client.create_watch(
    topic="商业航天",
    market="A-share",
    delivery="08:30",
    objective="机会"
)
print(f"监控ID: {watch['watch_id']}")
```

### 第4分钟：集成到你的Agent

```python
# 在你的AI Agent中调用
async def on_new_event(agent_context):
    events = client.get_events(stage="accelerating")
    
    for event in events:
        # 检查是否符合投资策略
        if event["probability"] > 0.5:
            await agent_context.notify(
                f"发现机会: {event['topic']} (概率{event['probability']:.0%})"
            )
```

### 第5分钟：设置Webhook

```bash
# 注册Webhook接收实时推送
curl -X POST https://api.signal.market/v1/webhooks \
  -H "Authorization: Bearer YOUR_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "url": "https://your-agent.com/webhook",
    "events": ["new_event", "probability_change"]
  }'
```

---

## 常见场景

### 场景1：A股开盘前提醒

```python
# 每天 08:25 自动获取
brief = client.get_lens_brief("lens_a_stock")
```

### 场景2：币圈事件监控

```python
# 实时监控币圈机会
brief = client.get_lens_brief("lens_crypto_event")
```

### 场景3：宏观事件交易

```python
# 美股交易员视角
brief = client.get_lens_brief("lens_us_macro")
```

---

## 下一步

- 📖 阅读 [完整API文档](./README.md)
- 💰 了解 [定价](./pricing.md)
- 🔧 查看 [支付系统](./PAYMENT.md)
- 🐛 遇到问题？查看 [Troubleshooting](../README.md#troubleshooting)

---

## 获取帮助

- 📧 邮箱: support@signal.market
- 💬 Discord: [加入社区](https://discord.gg/signal-market)
- 📚 文档: https://docs.signal.market
