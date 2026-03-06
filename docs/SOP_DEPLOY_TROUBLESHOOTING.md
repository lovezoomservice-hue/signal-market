# signal-market 类项目部署故障标准排查 SOP

## 一、排查入口

当出现以下任一现象时，启动本 SOP：

- workflow failure
- workflow success 但 public API 不可用
- deployment URL 可达但 public domain 404/500
- 某个 API 在 serverless 环境下报错

---

## 二、标准排查顺序

### 第一步：检查 GitHub Actions
检查项：
- 最近 3 次 run
- failure job / step
- deploy job 是否成功
- verify / health / public-readiness 是否失败

输出：
- run id 列表
- 失败步骤定位
- 失败日志片段

### 第二步：检查 deployment URL
验证：
- `/api/health`
- `/api/signals`
- `/api/events`

结论规则：
- 200/401 仅代表 deployment 生成或受保护可达
- 不能直接代表 public 已上线

### 第三步：检查 production public domain
验证：
- public domain `/api/health`
- public domain `/api/signals`
- public domain `/api/events`

结论规则：
- 只有 public domain 正常，才代表对外上线成功

### 第四步：检查 Vercel 项目链路
检查项：
- `.vercel/project.json`
- `projectId` / `orgId`
- 是否 production deploy
- alias 是否正确
- 是否指向当前项目
- 是否存在 SSO Protection 阻塞

### 第五步：检查 vercel.json
检查项：
- `builds`
- `routes`
- function 暴露方式
- public domain 与 deployment URL 行为是否一致

### 第六步：检查 serverless runtime
若单个 API 返回 500：
- 读函数日志
- 查文件路径
- 查 env
- 查模块依赖
- 查 ESM/CJS 混用
- 查 JSON/file read 错误

---

## 三、故障分类

- A. 认证/权限类
- B. alias/domain 类
- C. routes/config 类
- D. build 类
- E. serverless runtime 类

---

## 四、修复优先级

1. 先修 deployment / public domain 分层验证
2. 再修 alias / project binding
3. 再修 routes / vercel config
4. 最后修单接口 runtime

---

## 五、通过标准

只有同时满足以下条件才算 PASS：

- workflow success
- deployment URL 核心 API 正常
- public production domain 核心 API 正常
- `/api/health = 200`
- `/api/signals = 200`
- `/api/events = 200`

否则不得宣布上线成功。
