# signal-market 部署与 public readiness 故障复盘

> 状态：deprecated
> 过时原因：知识库已采用统一目录/命名/状态流转规范，此文档保留历史参考。
> 替代文档：/home/nice005/.openclaw/workspace/knowledge-base/03_postmortems/2026-03-06_signal-market_public-readiness_postmortem.md


## 一、事故概述

### 1. 事故名称
**signal-market public production domain 404 / 500 故障**

### 2. 事故时间（Asia/Shanghai）
- 首次发现时间：**2026-03-06 22:16**（CI 显示 success/部分 success，但线上域名不可用）
- 首次确认时间：**2026-03-06 22:56**（明确 `signal-market.vercel.app` 为生产对外域名，且 API 返回 404）
- 修复完成时间：**2026-03-06 23:47**（run `22770579716` 全链路通过，public 核心 API 全 200）

### 3. 影响范围
- deployment URL：阶段性可达（先 401，后 200）
- public production domain：阶段性不可用（先全 404，后 `signals` 500，最终全 200）
- 受影响接口：
  - `/api/health`
  - `/api/signals`
  - `/api/events`

### 4. 用户影响
- 外部用户在关键阶段**无法通过 public 域名稳定访问 API**。
- 属于典型的 **“workflow success 但用户不可用”**。
- 业务影响：自动化部署显示绿灯，但生产对外能力不达标，存在错误放行风险。

---

## 二、事故现象

### 1. GitHub Actions 表现
- 失败 run：`22767511263`, `22767697502`, `22769187533`
- 成功 run（阶段性）：`22767788887`
- 最终成功 run：`22770579716`

典型失败位置：
- `Health Check` 使用错误 URL（301）
- `Deploy Production -> Verify Deployment` 命中 public alias 返回 404
- `Public Readiness` 暴露 `/api/signals` 500

### 2. deployment URL 表现（阶段性）
- 早期：`/api/health|signals|events` 返回 401（受保护）
- 后期（最终）：`/api/health|signals|events` 返回 200

### 3. public production domain 表现（`https://signal-market.vercel.app`）
- 初期：
  - `/api/health` -> 404
  - `/api/signals` -> 404
  - `/api/events` -> 404
- 中期：
  - `/api/health` -> 200
  - `/api/signals` -> 500
  - `/api/events` -> 200
- 最终：
  - `/api/health` -> 200
  - `/api/signals` -> 200
  - `/api/events` -> 200

### 4. 关键矛盾
- workflow success 过，但 public domain 仍不可用。
- deployment URL 可达（401/200）不等于 public 对外可用。

---

## 三、根因分析

### 1. 主因
#### 主因 A：Vercel 访问策略与 public readiness 目标冲突（权限/认证 + domain）
- 项目存在 `ssoProtection.deploymentType=all_except_custom_domains`。
- 在无自定义域名时，`vercel.app` 访问行为与“public 对外可用”目标冲突，导致阶段性 401/404 现象。
- 分类：**权限/认证 + alias/domain**。

#### 主因 B：`vercel.json` 缺少显式 API routes（routes/config）
- 仅 `builds` 配置不足以稳定保障 public `/api/*` 命中。
- 增加 `/api/(.*) -> /api/$1.js` 后，public `/api/health` 恢复 200。
- 分类：**routes/config**。

#### 主因 C：`/api/signals` 运行时兼容问题（serverless runtime）
- `api/signals.js` 为 ESM 导出，但混入 CJS `require`。
- 导致线上 `FUNCTION_INVOCATION_FAILED`，`/api/signals` 返回 500。
- 分类：**serverless runtime**。

### 2. 次因
- 旧验证逻辑把 deployment URL 可达（甚至 401）当作“可上线”依据。
- deploy 输出 URL 抽取曾误抓 `vercel.link` 文档链接，造成健康检查误判。
- 缺少 public readiness 门禁，导致 CI 绿灯但对外不可用。

### 3. 非主因（已排除）
- `VERCEL_TOKEN` 缺失/无效（排除：`vercel pull`、deploy 多次成功）
- project 未 link（排除：`.vercel/project.json` 存在，project inspect 正常）
- build 失败（排除：build 阶段连续成功）
- workflow 未触发（排除：run 持续触发）

### 4. 证据链
- run id：`22767511263`, `22767697502`, `22769187533`, `22770579716`
- 日志证据：
  - 301：health 使用了 `vercel.link/...`
  - 404：public alias `/api/*` not found
  - 500：`/api/signals` -> `FUNCTION_INVOCATION_FAILED`
- 配置证据：
  - `vercel.json`（修复前无 routes，修复后补 routes）
  - Vercel Project 配置中 `ssoProtection` 信息
- 接口证据：阶段性状态码变化（404/401/500 -> 200）

---

## 四、排查过程（时间顺序）

### 阶段 1：基础审计
- 检查目录：`signal-market`、`.github/workflows/ci.yml`、`vercel.json`、`.vercel/project.json`
- 结论：部署链路为 `push -> GitHub Actions -> vercel deploy --prod`。

### 阶段 2：CI/CD 审计
- 读取最近失败 run 的 job 日志。
- 发现模式：
  1) URL 抽取误命中 `vercel.link`
  2) public alias 404
  3) 后续暴露 `signals` 500

### 阶段 3：success/failure 对比
- success run 并不总是代表 public 可用。
- 核心差异在于：验证目标是 deployment URL 还是 public domain。

### 阶段 4：public domain 确认
- 最终确认生产对外域名：`https://signal-market.vercel.app`。
- 区分：deployment URL（发布产物）与 public 域名（用户入口）。

### 阶段 5：运行时定位
- 在 public readiness 中定位 `/api/signals` 500。
- 定位到 `api/signals.js` ESM/CJS 混用导致 serverless 运行失败。

---

## 五、修复动作

### A. workflow 修复
1. 修改对象
- `.github/workflows/ci.yml`

2. 修改目的
- 防止“deployment 成功 = public 可用”的误判。

3. 修改内容摘要
- 增加 `public-readiness` 阶段，强制检查 public domain：
  - `/api/health`
  - `/api/signals`
  - `/api/events`
- 分层验证：deployment health 与 public readiness 分开判定。

4. 风险说明
- 可能提高失败率（从“假成功”转为真实失败暴露）；
- 可回滚（单文件变更）。

### B. vercel.json 修复
1. 修改对象
- `vercel.json`

2. 修改目的
- 保证 public `/api/*` 路由稳定命中 serverless 函数。

3. 修改内容摘要
- 新增 routes：
  - `/api/(.*) -> /api/$1.js`
  - fallback `/(.*) -> /index.html`

4. 风险说明
- 路由优先级变化可能影响前端 fallback；
- 可回滚（配置文件变更）。

### C. Vercel 项目配置修复
1. 修改对象
- Vercel Project `ssoProtection`

2. 修改目的
- 去除与 public vercel.app 对外可用性冲突的保护策略。

3. 修改内容摘要
- 将 `ssoProtection` 调整为 `null`（按项目目标开放 public 可访问）。

4. 风险说明
- 安全暴露面变化（需由组织安全策略确认）；
- 可回退（平台配置可恢复）。

### D. api/signals.js 运行时兼容修复
1. 修改对象
- `api/signals.js`

2. 修改目的
- 修复 serverless 500。

3. 修改内容摘要
- 删除 ESM 文件中的 CJS `require` 语句。

4. 风险说明
- 不涉及业务逻辑，仅运行时兼容；
- 可回滚（单文件小改动）。

---

## 六、最终结果

1. 最终成功 run id
- `22770579716`

2. deploy job 状态
- `Deploy Production`：success

3. public-readiness 状态
- success

4. deployment URL 验证
- `https://signal-market-miqlu7l9d-xiaheng2026-7609s-projects.vercel.app`
  - `/api/health` -> 200
  - `/api/signals` -> 200
  - `/api/events` -> 200

5. public production domain 验证
- `https://signal-market.vercel.app`
  - `/api/health` -> 200
  - `/api/signals` -> 200
  - `/api/events` -> 200

### 最终判定
**PASS**

---

## 七、经验总结

1. 不能把 deployment URL 可达当成 public 上线成功。
2. public readiness 必须成为 deploy 标准流程。
3. Vercel SSO / public domain / routes 配置会直接影响线上可用性。
4. serverless runtime 下 ESM/CJS 混用会触发线上 500。
5. workflow success != 用户可用。

---

## 八、防再发措施

1. workflow 固化
- 保留 `public-readiness`，作为上线门禁。
- 保持 deployment URL 与 public domain 分层验证。

2. 配置检查
- 新项目上线前检查 Vercel `ssoProtection`。
- 新项目上线前检查 `vercel.json routes`。

3. 运行时检查
- API 入口禁止 ESM/CJS 混用。
- 部署前增加最小 serverless 兼容检查（至少 import/load）。

4. 持续监控
- `/api/health`
- `/api/signals`
- `/api/events`

5. 文档化
- 本复盘纳入知识库。
- 同类项目直接复用 SOP：`docs/SOP_DEPLOY_TROUBLESHOOTING.md`。

---

## 九、附录（事实索引）

1. 仓库路径
- `/home/nice005/.openclaw/workspace/signal-market`

2. 涉及文件路径
- `.github/workflows/ci.yml`
- `vercel.json`
- `api/signals.js`
- `docs/POSTMORTEM_DEPLOY_PUBLIC_READINESS_2026-03-06.md`
- `docs/SOP_DEPLOY_TROUBLESHOOTING.md`
- `docs/MONITORING_CHECKLIST_API.md`

3. run id 列表
- 失败：`22767511263`, `22767697502`, `22769187533`
- 成功：`22770579716`

4. production public domain
- `https://signal-market.vercel.app`

5. deployment URL 样例
- `https://signal-market-miqlu7l9d-xiaheng2026-7609s-projects.vercel.app`

6. 关键命令（排障中使用）
- `gh run list --repo lovezoomservice-hue/signal-market --limit 3`
- `gh run view <run_id> --job <job_id> --log`
- `vercel inspect https://signal-market.vercel.app`
- `curl -i https://signal-market.vercel.app/api/health`

7. 关键验证结果（最终）
- public `/api/health` = 200
- public `/api/signals` = 200
- public `/api/events` = 200
