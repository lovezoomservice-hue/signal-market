# signal-market 生产 API 监控建议清单

> 状态：deprecated
> 过时原因：知识库已采用统一目录/命名/状态流转规范，此文档保留历史参考。
> 替代文档：/home/nice005/.openclaw/workspace/knowledge-base/08_monitoring/2026-03-06_signal-market_core-api_monitoring.md


## 目标
确保 future run 中，public production domain 的核心 API 故障能被第一时间发现。

---

## 必须监控

### 1) Health
- URL: `https://signal-market.vercel.app/api/health`
- 预期状态: `200`
- 监控周期: `5 分钟`

### 2) Signals
- URL: `https://signal-market.vercel.app/api/signals`
- 预期状态: `200`
- 监控周期: `5 分钟`

### 3) Events
- URL: `https://signal-market.vercel.app/api/events`
- 预期状态: `200`
- 监控周期: `5 分钟`

---

## 建议告警策略

1. 连续 2 次失败告警（触发告警）
2. 单次 500 记录 warning（不立即升级）
3. 连续 404 / 500 升级 critical

---

## 建议监控维度

- HTTP 状态码
- 响应耗时（建议记录 p50/p95）
- 最近一次 deploy run id
- `public-readiness` job 是否通过

---

## 附加建议

1. 每次 deploy 后自动跑一次 public readiness
2. 监控结果写入统一 dashboard
3. 失败时自动附带最近一次 workflow run 链接
