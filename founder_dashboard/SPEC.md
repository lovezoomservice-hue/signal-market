# Founder Dashboard Specification

**Version:** 1.0  
**Date:** 2026-03-06  
**Status:** READY FOR EXECUTION

---

## Product Definition

**Founder Dashboard = "公司控制塔 + 产品控制塔"**

- Company Control Tower: System health, deviations, budget/risk, task completion
- Product Control Tower: Signal Market as first customer, real data, user paths

---

## P0 Deliverables

### A) UI (Cloudflare Pages)
- Location: `/founder`
- Stack: Pure HTML/JS (no React)

### B) Founder API
- Base: `/founder/*`
- All endpoints require `requires_founder=true` permission

### C) Approval Flow
- Founder Approval Queue (max 3 items)
- Decision logging to company_memory/05_decisions

### D) Control Features
- Set daily unique Mission
- Freeze/Thaw changes
- Soft Kill Switch (pause queue, keep data)

---

## Page Structure (6 Pages)

### 1. Overview (/founder)
- Company Health Score
- Product Health Score  
- Today's Mission
- P0 Risks (max 3)
- Today's Deliveries (with proof links)

### 2. Product Control (/founder/product)
- Signal Market data source status (GitHub/HN/arXiv)
- Data freshness (<60min = green, else red alert)
- Signal quality metrics
- API endpoint status
- User funnel (if applicable)

### 3. Execution Control (/founder/execution)
- Task queue with status
- Each task: proof_pack_url, sandbox_status, trace_id
- Click to view details

### 4. Risk & Security (/founder/risk)
- Prompt Injection alerts
- Skill installation approvals
- External source trust scores

### 5. Approvals (/founder/approvals)
- Max 3 pending items
- Approve/Reject buttons
- Decision logged to memory

### 6. Financial/Compute (/founder/compute)
- Token budget usage
- Retry counts
- Failure rates
- Backoff status

---

## API Specification

### Endpoints

| Method | Path | Description |
|--------|------|-------------|
| GET | /founder/summary | Overview data |
| GET | /founder/product/signal-market | Product metrics |
| GET | /founder/execution/tasks | Task list |
| GET | /founder/approvals | Pending approvals |
| POST | /founder/approvals/{id}/approve | Approve item |
| POST | /founder/approvals/{id}/reject | Reject item |
| POST | /founder/mission | Set today's mission |
| POST | /founder/freeze | Freeze system |
| POST | /founder/kill-switch | Soft stop |

### Data Fields (Required)

All key objects must include:
- `id` or `proof_id`
- `updated_at` (ISO8601)
- `inputs_hash` (SHA256)
- `evidence_count` (if applicable)

---

## Acceptance Tests

| Test | Criteria |
|------|----------|
| T1 | Overview shows: Mission, P0 Risks, Deliveries with proof links |
| T2 | Product page shows real data sources (GitHub/HN/arXiv), freshness |
| T3 | Execution page shows proof_pack + sandbox + trace_id |
| T4 | Approvals page max 3 items; decision logged |
| T5 | Freeze blocks new module proposals |
| T6 | Kill-switch pauses queue, API still readable |
| T7 | No mock data; missing data shows reason + fix suggestion |

---

## Implementation Tasks

### Day 1
1. Create API endpoints (/founder/*)
2. Create Overview page with Summary API
3. Create Product Control page

### Day 2
4. Create Execution Control page
5. Create Approvals page with decision logging
6. Implement Freeze/Kill-switch
7. Complete E2E tests

---

## File Structure

```
founder_dashboard/
├── SPEC.md
├── api/
│   └── founder.js          # All /founder/* endpoints
├── ui/
│   ├── index.html          # Overview
│   ├── product.html         # Product Control
│   ├── execution.html       # Execution Control
│   ├── risk.html          # Risk & Security
│   ├── approvals.html     # Approvals
│   └── compute.html       # Financial/Compute
└── tests/
    └── e2e.spec.js        # Acceptance tests
```
