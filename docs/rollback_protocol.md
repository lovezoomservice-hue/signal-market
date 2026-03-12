# Signal Market Rollback Protocol (A-P0-05)

**版本：** v1.0  
**生效时间：** 2026-03-12  
**适用范围：** Signal Market 所有生产环境变更

---

## 1. 快速索引

| 场景 | 跳转 |
|------|------|
| API 端点失败 | [§3.1](#31-api-rollback) |
| JSONL 数据损坏 | [§3.2](#32-data-rollback) |
| 前端部署失败 | [§3.3](#33-frontend-rollback) |
| GHA Workflow 失败 | [§3.4](#34-gha-rollback) |
| SMTP / digest 中断 | [§3.5](#35-smtp-rollback) |

---

## 2. 触发条件

以下任一情况立即启动回滚评估：

- `/api/health` 连续 2 次返回非 200
- JSONL signals 数量 < 10
- causal_coverage < 8
- GHA daily pipeline 连续 2 次失败
- Digest 连续 2 天 0 封送出

---

## 3. 回滚步骤

### 3.1 API Rollback

```bash
# 定位出错的 commit
cd signal-market
git log --oneline -10

# 回滚到上一个已知良好 commit
git revert HEAD --no-edit
git push origin main

# 或 hard reset（需 force push，需 Founder 确认）
git reset --hard <known-good-commit>
git push --force-with-lease origin main
```

**验证：**
```bash
bash scripts/validate_all.sh --prod
```

---

### 3.2 Data Rollback (JSONL)

Pipeline 每次运行前自动创建备份：

```bash
# 查看备份
ls output/signals_history_backup_*.jsonl

# 恢复最近备份
cp output/signals_history_backup_YYYYMMDD.jsonl data/signals_history.jsonl

# 提交恢复
git add data/signals_history.jsonl
git commit -m "fix: rollback JSONL to backup YYYYMMDD [skip ci]"
git push
```

---

### 3.3 Frontend Rollback (Cloudflare Pages)

CF Pages 保留历史部署，可在 Dashboard 一键回滚：

> Cloudflare Dashboard → Pages → signal-market → Deployments → 找到上一个成功部署 → Rollback

或本地手动部署：

```bash
git checkout <known-good-commit> -- *.html *.css *.js assets/
wrangler pages deploy . --project-name=signal-market --branch=main
```

---

### 3.4 GHA Workflow Rollback

```bash
# 查看失败 run
gh run list --workflow=daily_research.yml --limit=5

# 查看失败日志
gh run view <run-id> --log-failed

# 修复后手动触发
gh workflow run daily_research.yml --ref main

# 临时禁用 workflow（避免连续失败）
gh workflow disable daily_research.yml
# 修复后重新启用
gh workflow enable daily_research.yml
```

---

### 3.5 SMTP / Digest Rollback

```bash
# 本地测试 SMTP 连通性
DRY_RUN=1 python3 scripts/send_digest.py

# 检查 vault 中 SMTP 密码
node -e "const v=require('./security/vault_adapter.js'); v.get('sec_smtp_pass').then(r=>console.log(r?'EXISTS':'NOT_FOUND'))"

# 如密码失效，重置
node security/vault_adapter.js put sec_smtp_pass <新授权码>

# 重置 GH Secret
echo "<新密码>" | gh secret set SMTP_PASS
```

---

## 4. 事后处理

每次回滚执行完成后：

1. **记录到 memory/** — 在 `memory/YYYY-MM-DD.md` 记录：触发原因、回滚步骤、根本原因、预防措施
2. **更新 MEMORY.md** — 如果是新型故障模式，写入长期记忆
3. **Founder 通报** — 生产回滚必须告知（Telegram 即时消息）
4. **写 postmortem** — 如影响 digest 送达或 API 可用性 > 1h，补写 `agent_registry/incident_*.md`

---

## 5. 已知良好 Commits（参考基线）

| Date | Commit | 状态 |
|------|--------|------|
| 2026-03-12 | `995966e` | HEAD，全功能验证通过 |
| 2026-03-12 | `00c1b76` | E-07 cross-validation 10/10 |
| 2026-03-12 | `b2f45d8` | F-2 actors enrichment |
| 2026-03-12 | `70926b4` | GHA-DAILY-001 修复后基线 |

---

*本文档由 CEO 维护。每次重大回滚后更新"已知良好 Commits"表。*
