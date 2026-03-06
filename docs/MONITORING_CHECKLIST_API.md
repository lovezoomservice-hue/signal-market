# 监控建议清单（signal-market）

## 一、核心接口监控（必须）
1. `GET /api/health`
   - 期望：200
   - 周期：每 1 分钟
   - 连续 3 次失败告警

2. `GET /api/signals`
   - 期望：200
   - 周期：每 2~5 分钟
   - 连续 2 次 5xx 告警

3. `GET /api/events`
   - 期望：200
   - 周期：每 2~5 分钟
   - 连续 2 次 5xx 告警

## 二、建议监控维度
- 状态码分布（2xx/4xx/5xx）
- 响应延迟 P50/P95
- 错误体关键词：`NOT_FOUND` / `FUNCTION_INVOCATION_FAILED`
- deployment URL 与 public domain 结果差异

## 三、告警分级
- P1：`/api/health` 非 200 持续 >3 分钟
- P1：`/api/signals` 或 `/api/events` 持续 500
- P2：仅 public domain 异常、deployment URL 正常（疑似 alias/binding 问题）
- P3：单次抖动后自动恢复

## 四、发布后自动验收（建议写入 CI）
1. 检查 deployment URL：health/signals/events
2. 检查 public domain：health/signals/events
3. 两者对比：若 deployment 正常但 public 异常，自动标记 `PASS WITH RISK` 或 `FAIL`

## 五、排障优先级
1. 先看 public `/api/health`
2. 再看 `/api/signals`
3. 再看 `/api/events`
4. 最后回溯 workflow deploy/health/public-readiness 日志
