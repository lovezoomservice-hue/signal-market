# signal-market 类项目部署故障标准排查流程

## 0. 适用范围
适用于 Vercel + GitHub Actions + API 路由型项目（含 `api/health`、`api/signals`、`api/events`）。

---

## 1. Deploy 检查
1. 查看最近 3 次 workflow run：
   - 是否卡在 `Deploy Production` 之前（lint/test/build）
   - 是否卡在 `Deploy Production` 本身
2. 定位失败步骤：
   - `vercel pull`
   - `vercel build`
   - `vercel deploy`
   - `Verify Deployment`
3. 记录 run id、job id、失败步骤日志。

---

## 2. Deployment URL 检查
1. 从 deploy 输出中提取 URL：
   - 只信任 `Production: https://...vercel.app`
   - 禁止使用 `vercel.link/...` 文档链接
2. 检查 deployment URL：
   - `/api/health`
   - `/api/signals`
   - `/api/events`
3. 判定规则：
   - 200：正常
   - 401：可达但受保护（需继续查 public）
   - 404/500：部署不完整或运行时异常

---

## 3. Public Domain 检查
1. 明确 production public domain（例如 `signal-market.vercel.app`）
2. 检查：
   - `public/api/health`
   - `public/api/signals`
   - `public/api/events`
3. 若 deployment URL 正常但 public 失败：
   - 优先排查 alias/domain/project binding
   - 排查 SSO/访问保护策略

---

## 4. health/signals/events 检查规范
- health：必须 200（基础可用）
- signals：应 200（核心接口）
- events：应 200（核心接口）

建议返回规则：
- `PASS`：三者均 200
- `PASS WITH RISK`：deployment 正常但 public 未完全验证
- `FAIL`：任一核心接口 404/500

---

## 5. Serverless Runtime 检查
1. 检查 API 文件导出方式是否一致（ESM/CJS 不混用）
2. 检查 serverless 环境可读路径是否存在（避免本地路径依赖）
3. 查 `FUNCTION_INVOCATION_FAILED` 的具体函数与堆栈
4. 优先做最小运行时修复，不改业务策略

---

## 6. 固化动作（每次发布）
1. workflow 必须包含 public readiness job
2. 通知摘要必须包含：
   - deploy 结果
   - deployment URL
   - public domain readiness 结果
3. 失败时自动输出：
   - 主因分类（权限/绑定/构建/运行时）
   - 下一步修复建议
