# Signal Market 产品技术完整项目说明文档 v1.0
**状态:** PRODUCT_CONSTITUTION — 最高权威产品基线  
**冻结时间:** 2026-03-11  
**地位:** 高于所有历史 PRD、草案、sprint计划、工程自定义清单

---

## 一、产品本质（不允许再模糊定义）

**Signal Market = 全球 AI 决策系统的信号基础设施**

不是：
- ❌ 普通资讯产品
- ❌ 简单 API 聚合器
- ❌ 交易系统
- ❌ 研究 digest 产品（research digest 是输入源，不是产品本体）

是：
- ✅ 世界事件的信号化处理管道
- ✅ 证据驱动的信号质量保证系统
- ✅ 灰度发布 + 回滚 + 审计的信号生命周期管理平台
- ✅ 面向 AI Agent 决策的信号基础设施层

---

## 二、唯一允许推进的核心闭环

```
世界事件
  → 标准化（Normalization）
  → Signal Object（信号对象创建）
  → Evidence Gate（证据门）
  → Feedback Refinery（反馈精炼）
  → Evaluation（质量评测）
  → Release / Gray（发布 / 灰度）
  → Rollback（回滚）
  → Audit Trace（审计追踪）
  → 更优 Signal
```

**任何业务智能体如果不服务这条闭环，就是偏航。**

---

## 三、数据输入层（不是产品本体）

以下是 Signal Market 的**上游输入源**，不是产品主线：

| 输入源 | 类型 | 说明 |
|--------|------|------|
| arXiv RSS | 学术论文 | AI研究方向的 signal candidate |
| GitHub Trending | 开源项目 | 技术热度的 signal candidate |
| HackerNews | 讨论热度 | 社区共识信号 |
| 金融市场数据 | 价格/成交量 | 市场事件 signal candidate |
| Twitter/X 大牛 | 观点传播 | 信息扩散信号 |
| 行业新闻 | 外部事件 | 广义世界事件 |

**这些输入产生 signal candidate，候选信号经过 Evidence Gate 后才成为正式 Signal。**

---

## 四、核心数据模型

### Signal Object（信号对象）

```json
{
  "signal_id": "sig_xxx",
  "topic": "AI Agents",
  "stage": "accelerating",
  "confidence": 0.97,
  "evidence_count": 9,
  "evidence_refs": ["ev_001", "ev_002"],
  "proof_id": "research-2026-03-11-2603.08835",
  "source_url": "https://arxiv.org/abs/2603.08835",
  "lifecycle_state": "active",
  "created_at": "2026-03-11",
  "updated_at": "2026-03-11",
  "inputs_hash": "abc123",
  "approved_by": "eval_gate_v1",
  "gray_ratio": 0.1
}
```

### Evidence Object（证据对象）

```json
{
  "evidence_id": "ev_001",
  "signal_id": "sig_xxx",
  "source": "arxiv:2603.08835",
  "source_url": "https://arxiv.org/abs/2603.08835",
  "credibility": 0.87,
  "collected_at": "2026-03-11",
  "evidence_type": "academic_paper"
}
```

---

## 五、信号生命周期

```
new → pending_evidence → evidence_sufficient
  → evaluation_pending → evaluation_passed
  → gray_release → active
  → (feedback) → refinement_pending
  → updated → active
  → fading → dead
```

每个状态转换必须有：
- evidence_count 变化记录
- transition_reason
- approved_by（人工或自动门）

---

## 六、核心 API（v1 正式定义）

### 信号层
```
GET  /api/signals                 — 信号列表
GET  /api/signals/:id             — 信号详情
POST /api/signals/:id/evidence    — evidence_append
GET  /api/signals/:id/lifecycle   — 生命周期状态
```

### 事件层
```
GET  /api/events                  — 事件列表
GET  /api/events?topic=           — 按主题过滤
GET  /api/events/:id              — 事件详情（含 evidence_refs）
```

### 评测层
```
POST /api/evaluation/run          — 触发评测
GET  /api/evaluation/:signal_id   — 评测结果
```

### 候选池
```
GET  /api/candidates              — 待审批 signal candidate
POST /api/candidates/:id/approve  — 批准进入信号池
POST /api/candidates/:id/reject   — 拒绝
```

### 发布层
```
POST /api/release/gray            — 开始灰度发布
POST /api/release/promote         — 灰度晋升 → 全量
POST /api/rollback/:signal_id     — 回滚信号
```

### 审计层
```
GET  /api/audit/:signal_id        — 信号审计链
GET  /api/audit/full              — 全链审计
```

### 已有端点（保留）
```
GET  /api/topics/:id/stage        — 主题 stage
GET  /api/watchlist               — 监控列表
POST /api/watchlist               — 创建监控
GET  /api/alerts                  — 触发告警
GET  /api/health                  — 健康检查
```

---

## 七、Signal Market 不负责的边界

**不负责：**
- 交易执行
- 钱包
- 结算
- 预测市场撮合
- Agent runtime 执行
- 通用 AI digest 产品本体
- 与产品闭环无关的泛研究展示

---

## 八、v1 上线标准（20节精简版）

| # | 功能 | 验收标准 |
|---|------|---------|
| 1 | evidence_append | POST /signals/:id/evidence 生效 |
| 2 | signal lifecycle new→active | 状态流转真实成立 |
| 3 | feedback_submit | POST /feedback 写入 |
| 4 | candidate_pool | GET /candidates 返回候选 |
| 5 | approval gate | POST /candidates/:id/approve 生效 |
| 6 | evaluation_run.pass_gate | 评测通过后 signal 晋升 |
| 7 | gray release | 10% gray ratio 可执行 |
| 8 | rollback | /rollback/:id 可回滚 |
| 9 | audit trace | /audit/:id 全链可查 |
| 10 | 数据一致性 | 4端点 inputs_hash 一致 |
| 11 | pages.dev 同步 | 前端含正确 API URL |
| 12 | alerts 全绿 | 无 500 |
| 13 | auth 可持久化 | 非 /tmp |
| 14 | proof_id 全覆盖 | signals/trends/topics 均有 |
| 15 | source_url 真实 | 可点击的 arXiv/GitHub 链接 |
| 16 | pipeline→API 接通 | pipeline 输出进入 API |
| 17 | 信号历史积累 | signals_history.jsonl 增量 |
| 18 | daily digest 送达 | Email SMTP 可发送 |
| 19 | signal graph v1 | related_signals 可查 |
| 20 | SDK v1 | Python 或 JS SDK 可安装 |

**v1 上线 = 以上 20 项全部 VERIFIED**

---

## 九、阶段定义

| 阶段 | 条件 |
|------|------|
| FEATURE_INTEGRATION_STAGE | 当前状态 |
| INTERNAL_ALPHA_CANDIDATE | Top-3 fixes 通过 |
| INTERNAL_ALPHA_READY | v1标准中第1-9项全通 + auth持久化 |
| MVP_READY | v1标准 1-15项全通 |
| EXTERNAL_BETA | v1标准全部20项通过 |

---

*文档地位: PRODUCT_CONSTITUTION | 版本: v1.0 | 冻结: 2026-03-11*
