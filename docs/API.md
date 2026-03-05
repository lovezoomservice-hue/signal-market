# Signal Market API Documentation

## 概述

Signal Market API 提供事件检测、预测概率、用户透镜简报等功能。

**Base URL:** `http://localhost:3000`

**认证:** 部分端点需要 API Key，在请求头中传递:
```
x-api-key: your_api_key
```

---

## 端点列表

### 1. 健康检查

**GET** `/signals/health`

系统健康状态检查。

**响应示例:**
```json
{
  "status": "healthy",
  "timestamp": "2024-01-15T08:30:00.000Z",
  "checks": {
    "raw": true,
    "clean": true,
    "events": true,
    "probability": true
  },
  "updates_today": 4,
  "system_health": "healthy"
}
```

---

### 2. 事件列表

**GET** `/events`

获取当前事件列表，支持分页、过滤和排序。

**查询参数:**

| 参数 | 类型 | 默认值 | 描述 |
|------|------|--------|------|
| `limit` | integer | 20 | 返回数量限制 |
| `offset` | integer | 0 | 偏移量 |
| `stage` | string | - | 按阶段过滤 (emerging, accelerating, peak, fading) |
| `topic` | string | - | 按主题过滤 (多个用逗号分隔) |
| `sortBy` | string | timestamp | 排序字段 (timestamp, probability, title) |
| `sortOrder` | string | desc | 排序方向 (asc, desc) |

**响应示例:**
```json
{
  "events": [
    {
      "event_id": "evt_001",
      "topic": "AI算力",
      "title": "AI算力需求激增",
      "stage": "accelerating",
      "probability": 0.75,
      "evidence_refs": ["ev_001", "ev_002"],
      "timestamp": "2024-01-15T08:00:00.000Z"
    }
  ],
  "pagination": {
    "limit": 20,
    "offset": 0,
    "total": 45,
    "hasMore": true
  },
  "timestamp": "2024-01-15T08:30:00.000Z"
}
```

---

### 3. 事件概率

**GET** `/events/{event_id}/probability`

获取特定事件的概率详情。

**路径参数:**
- `event_id` - 事件ID

**响应示例:**
```json
{
  "event_id": "evt_001",
  "topic": "AI算力",
  "current": 0.75,
  "P_7d": 0.65,
  "P_30d": 0.45,
  "trend": "rising",
  "timestamp": "2024-01-15T08:30:00.000Z"
}
```

---

### 4. 用户透镜简报

**GET** `/lenses/{lens_id}/daily-brief`

获取用户透镜的每日简报。

**路径参数:**
- `lens_id` - 透镜ID (如 `lens_a_stock`, `lens_us_macro`, `lens_crypto_event`)

**响应示例:**
```json
{
  "lens_id": "lens_a_stock",
  "user_id": "lens_a_stock",
  "date": "2024-01-15",
  "topics_watched": ["商业航天", "AI算力", "机器人"],
  "stage_summary": [
    {
      "topic": "AI算力",
      "current_stage": "accelerating",
      "probability": 0.75,
      "probability_7d": 0.65
    }
  ],
  "top_opportunities": [
    {
      "topic": "AI算力",
      "stage": "accelerating",
      "action": "关注"
    }
  ],
  "risk_alerts": [],
  "evidence_refs": ["ev_001", "ev_002"],
  "generated_at": "2024-01-15T08:30:00.000Z"
}
```

---

### 5. 证据详情

**GET** `/evidence/{event_id}`

获取事件的相关证据。

**路径参数:**
- `event_id` - 事件ID

**响应示例:**
```json
{
  "event_id": "evt_001",
  "evidence_id": "ev_001",
  "type": "news",
  "title": "GPU需求持续增长",
  "source": "TechNews",
  "url": "https://example.com/article",
  "timestamp": "2024-01-15T07:00:00.000Z",
  "sentiment": "positive"
}
```

---

### 6. 预测市场列表

**GET** `/predictions`

获取预测市场事件列表，支持分页和过滤。

**查询参数:**

| 参数 | 类型 | 默认值 | 描述 |
|------|------|--------|------|
| `limit` | integer | 20 | 返回数量限制 |
| `offset` | integer | 0 | 偏移量 |
| `topic` | string | - | 按主题过滤 |
| `sortBy` | string | timestamp | 排序字段 |
| `sortOrder` | string | desc | 排序方向 |

**响应示例:**
```json
{
  "predictions": [
    {
      "event_id": "evt_iran_conflict",
      "topic": "Iran-Israel Conflict",
      "description": "伊以冲突升级",
      "horizon": "7d",
      "probability": 0.35,
      "probability_pct": "35%",
      "timestamp": "2024-01-15T08:30:00.000Z"
    }
  ],
  "pagination": {
    "limit": 20,
    "offset": 0,
    "total": 5,
    "hasMore": false
  },
  "timestamp": "2024-01-15T08:30:00.000Z"
}
```

---

### 7. 预测概率曲线

**GET** `/predictions/{event_id}`

获取特定预测事件的历史概率曲线。

**路径参数:**
- `event_id` - 预测事件ID

**响应示例:**
```json
{
  "event_id": "evt_iran_conflict",
  "topic": "Iran-Israel Conflict",
  "horizon": "7d",
  "curve": [
    {
      "date": "2024-01-08",
      "probability": 0.30,
      "probability_pct": "30%"
    },
    {
      "date": "2024-01-09",
      "probability": 0.32,
      "probability_pct": "32%"
    }
  ],
  "current": 0.35,
  "change_7d": 0.05,
  "timestamp": "2024-01-15T08:30:00.000Z"
}
```

---

### 8. 创建监控

**POST** `/watch`

创建新的事件监控。

**请求体:** (可选)
```json
{
  "event_ids": ["evt_001", "evt_002"],
  "notify_email": "user@example.com"
}
```

**响应示例:**
```json
{
  "watch_id": "watch_1705312200000",
  "status": "created",
  "next_output": "2024-01-16T08:30:00.000Z"
}
```

---

## 错误响应

所有错误响应遵循以下格式:

```json
{
  "error": "Error message description",
  "code": "ERROR_CODE",
  "timestamp": "2024-01-15T08:30:00.000Z"
}
```

**常见 HTTP 状态码:**

| 状态码 | 描述 |
|--------|------|
| 200 | 成功 |
| 400 | 请求参数错误 |
| 401 | 认证失败 |
| 404 | 资源不存在 |
| 500 | 服务器内部错误 |

---

## 使用示例

### cURL

```bash
# 健康检查
curl http://localhost:3000/signals/health

# 获取事件 (分页)
curl "http://localhost:3000/events?limit=10&offset=0"

# 按阶段过滤
curl "http://localhost:3000/events?stage=accelerating,peak"

# 排序
curl "http://localhost:3000/events?sortBy=probability&sortOrder=desc"

# 获取预测市场
curl "http://localhost:3000/predictions?topic=AI"
```

### JavaScript

```javascript
const API_URL = 'http://localhost:3000';

async function getEvents(options = {}) {
  const params = new URLSearchParams(options);
  const res = await fetch(`${API_URL}/events?${params}`);
  return res.json();
}

// 使用
const data = await getEvents({
  limit: 10,
  stage: 'accelerating',
  sortBy: 'probability',
  sortOrder: 'desc'
});
```
