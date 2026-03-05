# Signal Market - 产品文档

## 产品定位

**Signal Market = AI智能体的世界认知层**

> 不是新闻App。是"事件→概率→影响→行动"的情报层。

---

## 4个核心输出

| 输出 | 描述 | 示例 |
|------|------|------|
| **Event** | 从噪声中识别主线事件 | "商业航天板块启动" |
| **Probability** | 可解释的概率曲线 | P(7天)=43%，较昨日+5% |
| **Impact** | 事件→资产/板块映射 | NVDA↑, TSMC↑ |
| **Action** | 个性化提醒 | "08:30 开盘前提醒" |

---

## 6个极简API

### 1. 获取事件列表
```bash
GET /events
```
响应:
```json
{
  "events": [
    {
      "event_id": "evt_xxx",
      "topic": "商业航天",
      "stage": "accelerating",
      "evidence_refs": ["fact_xxx", "fact_yyy"]
    }
  ],
  "count": 4,
  "timestamp": "2026-03-05T03:00:00Z"
}
```

### 2. 获取概率曲线
```bash
GET /events/{id}/probability
```
响应:
```json
{
  "event_id": "evt_xxx",
  "probabilities": {
    "P_24h": 0.15,
    "P_7d": 0.43,
    "P_30d": 0.71
  },
  "explanation": {
    "current_probability": 0.43,
    "previous_probability": 0.38,
    "change": "+0.05",
    "drivers": [
      {"factor": "政策利好", "impact": "+0.1"}
    ]
  }
}
```

### 3. 获取用户简报
```bash
GET /lenses/{user}/daily-brief
```
示例用户:
- `lens_a_stock` - A股板块玩家
- `lens_us_macro` - 美股宏观交易员
- `lens_crypto_event` - 币圈事件交易员

响应:
```json
{
  "lens_id": "lens_a_stock",
  "stage_summary": [
    {
      "topic": "商业航天",
      "current_stage": "主升",
      "probability": 0.71
    }
  ],
  "top_opportunities": [...],
  "risk_alerts": [...],
  "evidence_refs": ["fact_xxx"]
}
```

### 4. 创建监控
```bash
POST /watch
```
请求:
```json
{
  "topic": "商业航天",
  "market": "A-share",
  "delivery": "08:30",
  "objective": "机会"
}
```

### 5. 健康检查
```bash
GET /signals/health
```
响应:
```json
{
  "status": "healthy",
  "updates_today": 4,
  "checks": {
    "raw": true,
    "clean": true,
    "events": true,
    "probability": true
  }
}
```

### 6. 获取证据
```bash
GET /evidence/{event_id}
```

---

## 预测市场API

### 获取所有预测
```bash
GET /predictions
```

### 获取单事件概率曲线
```bash
GET /predictions/{event_id}
```

---

## 用户透镜

### lens_a_stock - A股板块玩家
- 关注: 商业航天、AI算力、机器人
- 输出: 板块阶段 + 概率 + 驱动因子
- 推送: 08:30 (开盘前)

### lens_us_macro - 美股宏观交易员
- 关注: 美联储利率、通胀、地缘政治
- 输出: 事件概率 + 风险预警
- 推送: 16:00 (收盘后)

### lens_crypto_event - 币圈事件交易员
- 关注: 政策监管、技术升级、社区情绪
- 输出: 事件概率 + 影响币种
- 推送: trigger (触发式)

---

## SDK使用

### Python
```python
from signal_market import create_client

client = create_client(api_key="your-key")

# 获取简报
brief = client.get_lens_brief("lens_a_stock")
print(brief)

# 获取预测
pred = client.get_prediction("evt_iran_conflict")
print(pred)

# 健康检查
health = client.health_check()
print(health)
```

### JavaScript
```javascript
const { SignalMarket } = require('signal-market');

const client = new SignalMarket({ apiKey: 'your-key' });

const brief = await client.getLensBrief('lens_a_stock');
console.log(brief);

const health = await client.healthCheck();
console.log(health);
```

---

## 阶段判定

| 阶段 | 描述 | 特征 |
|------|------|------|
| 启动 | 早期迹象出现 | 价格开始上涨，成交量放大 |
| 主升 | 趋势确认，加速 | 快速上涨，成交量显著放大 |
| 震荡 | 趋势放缓 | 波动加大，出现分歧 |
| 退潮 | 趋势结束 | 价格下跌，成交量萎缩 |

---

## 成功指标

| 指标 | 目标 |
|------|------|
| 接入时间 | < 5分钟 |
| AI Agents | 1000 |
| Brier Score | < 0.25 |
| 延迟 | < 2秒 |

---

## 禁止事项

- ❌ 新闻摘要
- ❌ 信息汇总
- ❌ 复杂仪表盘
