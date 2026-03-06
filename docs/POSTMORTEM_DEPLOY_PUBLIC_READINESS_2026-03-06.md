# signal-market 部署与 public readiness 故障复盘

## 1. 事故现象
- GitHub Actions 中 `Deploy Production` 一度显示成功，但 public 域名 `https://signal-market.vercel.app` 的 API 返回异常。
- 典型表现：
  - 早期：`/api/health`、`/api/signals`、`/api/events` 在 public 域名均返回 `404 NOT_FOUND`
  - 中期：deployment URL 可访问但返回 `401`（受保护）
  - 后期：public `/api/health` 恢复 200，但 `/api/signals` 返回 `500 FUNCTION_INVOCATION_FAILED`

## 2. 根因
### 主因
1. **Vercel 项目 SSO 保护策略与 public 验证目标冲突**
   - 项目存在 `ssoProtection.deploymentType=all_except_custom_domains`。
   - 在无自定义域名前提下，`vercel.app` 访问表现与对外可用性目标冲突。

2. **`vercel.json` 缺少显式 API routes，public 域名路由命中不稳定**
   - 仅配置 `builds`，未显式声明 `/api/*` 路由映射。

### 次因
3. **`/api/signals` 运行时兼容性问题**
   - `api/signals.js` 使用 ESM 导出同时混入 CJS `require`，导致 serverless 运行异常（500）。

## 3. 证据
- 失败 run：
  - `22767511263`：健康检查命中错误 URL（`vercel.link/...`），返回 301。
  - `22767697502`：`Verify Deployment` 命中 public alias，返回 404。
  - `22769187533`：public readiness 显示 `/api/health=200` 但 `/api/signals=500`。
- 成功 run：
  - `22770579716`：Deploy、Health、Public Readiness 全部通过。
- Vercel Project 信息（排障期）：
  - 检测到 `ssoProtection` 配置项。
  - 别名与 deployment 绑定显示正常，但 public 行为与 readiness 目标不一致。

## 4. 修改内容
1. Workflow 修复（验证分层）
   - 增加 `public-readiness` 阶段。
   - 强制 public 域名检查：`/api/health`、`/api/signals`、`/api/events`。
   - 避免“deployment URL 可达 = 上线成功”的误判。

2. Vercel 路由修复
   - 在 `vercel.json` 中补充：
     - `/api/(.*) -> /api/$1.js`
     - fallback 到 `index.html`

3. Signals runtime 修复
   - 删除 `api/signals.js` 中不兼容的 CJS `require`。

4. Vercel 项目访问策略调整
   - 调整/解除与 public readiness 目标冲突的 SSO 保护设置。

## 5. 涉及文件
- `.github/workflows/ci.yml`
- `vercel.json`
- `api/signals.js`
- （平台配置）Vercel Project `ssoProtection`

## 6. 关键 run id
- 失败：`22767511263`, `22767697502`, `22769187533`
- 成功：`22770579716`

## 7. 最终验证结果
### public production domain
- `https://signal-market.vercel.app/api/health` -> `200`
- `https://signal-market.vercel.app/api/signals` -> `200`
- `https://signal-market.vercel.app/api/events` -> `200`

### deployment URL（成功 run）
- `https://signal-market-miqlu7l9d-xiaheng2026-7609s-projects.vercel.app/api/health` -> `200`
- `.../api/signals` -> `200`
- `.../api/events` -> `200`

## 8. 经验总结
1. deployment 成功不等于 public 上线成功。
2. 必须分层验证：
   - 层 1：deployment URL（发布生成）
   - 层 2：public domain（真实可用）
3. public readiness 需要覆盖关键业务接口，而不是只测 health。
4. 运行时兼容性（ESM/CJS）问题在 serverless 环境更容易暴露。

## 9. 防再发措施
1. workflow 固化 `public-readiness` 为必过门禁。
2. public readiness 最低检查集：`health/signals/events`。
3. deploy URL 解析仅允许 `Production: https://...vercel.app`，禁止抓取文档提示链接。
4. 新增 runtime 兼容检查（ESM/CJS lint 规则）。
5. 每次部署自动落地“部署摘要 + public 结果 +失败证据链接”。
