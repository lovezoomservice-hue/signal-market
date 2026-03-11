# Signal Market — AI Frontier Intelligence Platform

> **产品定位（2026-03-11 重基线版）**  
> 不是新闻 App，不是 GitHub Stars 排行榜。  
> 是 AI 创始人、研究者和投资人的**早期信号雷达**。

---

## 产品定义（v1.1 — 正式 Pivot 后）

### 核心用户

| 用户类型 | 核心需求 |
|---------|---------|
| AI 创业公司创始人 | 了解哪些 AI 方向正在加速，避免押错赛道 |
| AI 领域投资人 | 早期发现高置信度技术趋势 |
| 技术架构师 | 追踪 AI 技术栈演进方向 |
| AI 研究团队 | 论文方向跟踪，avoid duplication |

### 核心输出（4 类）

| 输出 | 来源 | 说明 |
|------|------|------|
| **Research Signal** | arXiv RSS + GitHub Trending | 技术方向信号，含 proof_id/source_url |
| **Daily Brief** | Research Intake pipeline | 每日 AI 前沿摘要 email，含原文链接 |
| **Trend Graph** | L0→L3 pipeline | 技术趋势演变（stage lifecycle） |
| **Watchlist Alert** | Watchlist engine | 订阅主题状态变化时告警 |

---

## API 文档（6 个核心端点）

**Base URL:** `https://signal-market-z14d.vercel.app`

### 1. AI 研究信号列表

```bash
GET /api/signals
```

参数: `?stage=accelerating` / `?limit=5`

响应:
```json
{
  "signals": [
    {
      "topic": "AI Agents",
      "stage": "accelerating",
      "confidence": 0.97,
      "evidenceCount": 9,
      "proof_id": "research-2026-03-11-2603.08835",
      "source_url": "https://arxiv.org/abs/2603.08835"
    }
  ],
  "count": 7,
  "updated_at": "2026-03-11",
  "inputs_hash": "abc123"
}
```

### 2. 技术趋势评分

```bash
GET /api/trends
```

响应:
```json
{
  "trends": [
    {
      "topic": "AI Agents",
      "stage": "accelerating",
      "trend_score": 0.97,
      "velocity": 0.9,
      "proof_id": "research-2026-03-11-2603.08835",
      "source_url": "https://arxiv.org/abs/2603.08835"
    }
  ],
  "count": 7
}
```

### 3. 技术主题列表

```bash
GET /api/topics
GET /api/topics/:id/stage
```

响应 `/stage`:
```json
{
  "id": "ai-agents",
  "topic": "AI Agents",
  "stage": "accelerating",
  "confidence": 0.97,
  "proof_id": "research-2026-03-11-2603.08835",
  "source_url": "https://arxiv.org/abs/2603.08835"
}
```

### 4. 事件流

```bash
GET /api/events
GET /api/events/:id
GET /api/events?topic=AI+Agents
```

### 5. 监控订阅

```bash
POST /api/watchlist
{
  "topic": "AI Agents",
  "threshold": 0.8
}
```

### 6. 健康检查

```bash
GET /api/health
```

---

## 数据来源

| 来源 | 类型 | 采集频率 |
|------|------|---------|
| arXiv RSS (cs.AI/cs.LG/cs.CL) | 学术论文 | 每日 17:50 |
| GitHub Trending | 开源项目 | 每日 17:50 |
| HackerNews | 讨论热度 | 每日 08:30 |
| Research Intake pipeline | 汇总 | 每日 17:50 + 18:00 |

---

## 部署

| 组件 | URL |
|------|-----|
| 前端 Dashboard | https://signal-market.pages.dev |
| API | https://signal-market-z14d.vercel.app |
| GitHub | https://github.com/lovezoomservice-hue/signal-market |

---

## 历史文档

> **原始金融市场 PRD（v0）已存档**  
> 原始版本定义了金融市场情报产品（A股/美股/crypto/probability curve/lens），  
> 已降级为 `docs/ARCHIVED_v0_financial_market_prd.md` 保存。  
> 未来如有金融市场情报需求可重启该方向。

---

*Last updated: 2026-03-11 | Version: 1.1 | Pivot: Financial Market → AI Frontier Intelligence*
