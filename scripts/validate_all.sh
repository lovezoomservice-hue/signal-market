#!/usr/bin/env bash
# ═══════════════════════════════════════════════════════════════════════════════
# validate_all.sh — Signal Market Reusable Validation Script (A-P0-04)
# ═══════════════════════════════════════════════════════════════════════════════
# Usage:
#   bash scripts/validate_all.sh [--local] [--prod] [--quick]
#
# Flags:
#   --local   Validate against localhost:3001 only (default)
#   --prod    Validate against production URLs
#   --quick   Skip slow checks (cross-source validation)
# ═══════════════════════════════════════════════════════════════════════════════

set -euo pipefail

LOCAL_BASE="${LOCAL_API:-http://localhost:3001}"
PROD_API="https://signal-market-z14d.vercel.app"
PROD_FE="https://signal-market.pages.dev"

MODE="local"
QUICK=false
FAIL=0
PASS=0

for arg in "$@"; do
  case $arg in
    --prod)   MODE="prod" ;;
    --local)  MODE="local" ;;
    --quick)  QUICK=true ;;
  esac
done

if [[ "$MODE" == "prod" ]]; then
  API="$PROD_API"
  FE="$PROD_FE"
else
  API="$LOCAL_BASE"
  FE="$LOCAL_BASE"
fi

RED='\033[0;31m'; GREEN='\033[0;32m'; YELLOW='\033[1;33m'; NC='\033[0m'; BOLD='\033[1m'

pass() { echo -e "  ${GREEN}✓${NC} $1"; PASS=$((PASS+1)); }
fail() { echo -e "  ${RED}✗${NC} $1"; FAIL=$((FAIL+1)); }
info() { echo -e "  ${YELLOW}→${NC} $1"; }
section() { echo -e "\n${BOLD}$1${NC}"; }

echo -e "${BOLD}Signal Market Validation Suite${NC} — mode=$MODE quick=$QUICK"
echo "  API: $API"
echo "  Time: $(date -u '+%Y-%m-%dT%H:%M:%SZ')"

# ── 1. JSONL Data Integrity ───────────────────────────────────────────────────
section "[1/5] JSONL Data Integrity"
JSONL="data/signals_history.jsonl"
if [[ -f "$JSONL" ]]; then
  COUNT=$(grep -c . "$JSONL" || echo 0)
  RESIDUALS=$(python3 -c "
import json
r=0
for l in open('$JSONL'):
    d=json.loads(l)
    if 'original_signal_id' in d or 'original_topic' in d: r+=1
print(r)
")
  [[ "$COUNT" -ge 10 ]] && pass "JSONL signals count=$COUNT (≥10)" || fail "JSONL count=$COUNT < 10"
  [[ "$RESIDUALS" -eq 0 ]] && pass "JSONL no residual fields" || fail "JSONL residuals=$RESIDUALS"
else
  fail "JSONL file not found: $JSONL"
fi

# ── 2. API Health ─────────────────────────────────────────────────────────────
section "[2/5] API Endpoints (Core)"
ENDPOINTS_CORE=(
  "/api/health"
  "/api/signals"
  "/api/trends"
  "/api/topics"
  "/api/stats"
  "/api/pipeline/status"
  "/api/v2/brief"
  "/api/watchlist"
  "/api/auth/me"
  "/api/docs"
)
for ep in "${ENDPOINTS_CORE[@]}"; do
  CODE=$(curl -s -o /dev/null -w "%{http_code}" --max-time 10 "${API}${ep}" 2>/dev/null || echo "000")
  if [[ "$CODE" == "200" || "$CODE" == "401" || "$CODE" == "403" ]]; then
    pass "GET ${ep} → $CODE"
  else
    fail "GET ${ep} → $CODE"
  fi
done

# ── 2b. New v2 Endpoints ──────────────────────────────────────────────────────
section "[2b/5] API Endpoints (v2 — New)"
ENDPOINTS_V2=(
  "/api/v2/rank"
  "/api/v2/rank?urgency=high&limit=3"
  "/api/v2/compare?topics=AI%20Agents,LLM%20Infrastructure"
  "/api/v2/filter?urgency=high"
  "/api/v2/agent-brief"
  "/api/v2/agent-brief?format=minimal"
  "/api/v2/causal/evt_001"
)
for ep in "${ENDPOINTS_V2[@]}"; do
  CODE=$(curl -s -o /dev/null -w "%{http_code}" --max-time 10 "${API}${ep}" 2>/dev/null || echo "000")
  if [[ "$CODE" == "200" || "$CODE" == "400" || "$CODE" == "404" ]]; then
    pass "GET ${ep} → $CODE"
  else
    fail "GET ${ep} → $CODE"
  fi
done

# ── 2c. Subscribe Endpoint (special case — expect 400/404 without params) ────
section "[2c/5] API Endpoints (Subscribe)"
CODE=$(curl -s -o /dev/null -w "%{http_code}" --max-time 10 "${API}/api/v2/subscribe" 2>/dev/null || echo "000")
if [[ "$CODE" == "200" || "$CODE" == "400" || "$CODE" == "404" ]]; then
  pass "GET /api/v2/subscribe (no params) → $CODE"
else
  fail "GET /api/v2/subscribe (no params) → $CODE"
fi

# ── 3. Causal Coverage ────────────────────────────────────────────────────────
section "[3/5] Brief Causal Coverage"
CAUSAL=$(curl -s --max-time 10 "${API}/api/v2/brief" | python3 -c "
import json,sys
d=json.load(sys.stdin)
print(d.get('meta',{}).get('causal_coverage','?'))
" 2>/dev/null || echo "ERR")
[[ "$CAUSAL" == "10" ]] && pass "causal_coverage=10/10" || fail "causal_coverage=$CAUSAL (expected 10)"

# ── 4. Cross-Source Validation ────────────────────────────────────────────────
if [[ "$QUICK" == "false" ]]; then
  section "[4/5] Cross-Source Validation"
  python3 - << 'PYEOF'
import json
NORM={'arxiv_rss':'arxiv','arxiv_api':'arxiv','hf':'huggingface','hf_models':'huggingface',
      'hf_trending':'huggingface','gh':'github','gh_trending':'github'}
sigs=[json.loads(l) for l in open('data/signals_history.jsonl') if l.strip()]
ok=all(
    len(list(dict.fromkeys(NORM.get(p.split(':')[0],p.split(':')[0]) for p in s.get('sources',[]))))>=2
    for s in sigs
)
total=len(sigs)
cv=sum(1 for s in sigs if len(list(dict.fromkeys(NORM.get(p.split(':')[0],p.split(':')[0]) for p in s.get('sources',[]))))>=2)
print(f"  cross_validated={cv}/{total}")
import sys; sys.exit(0 if ok else 1)
PYEOF
  [[ $? -eq 0 ]] && pass "10/10 genuinely cross-validated" || fail "cross-validation not 10/10"
else
  section "[4/5] Cross-Source Validation — SKIPPED (--quick)"
  info "run without --quick to validate"
fi

# ── 5. GHA Workflows ─────────────────────────────────────────────────────────
section "[5/5] GHA Workflows"
if command -v gh &>/dev/null; then
  ACTIVE=$(gh workflow list --json name,state --jq '[.[]|select(.state=="active")]|length' 2>/dev/null || echo "?")
  [[ "$ACTIVE" -ge 6 ]] && pass "GHA active workflows=$ACTIVE (≥6)" || fail "GHA active workflows=$ACTIVE < 6"
else
  info "gh CLI not available — skipping GHA check"
fi

# ── Summary ───────────────────────────────────────────────────────────────────
echo ""
TOTAL=$((PASS+FAIL))
if [[ $FAIL -eq 0 ]]; then
  echo -e "${GREEN}${BOLD}ALL PASS: $PASS/$TOTAL${NC}"
  exit 0
else
  echo -e "${RED}${BOLD}FAIL: $FAIL/$TOTAL checks failed${NC}"
  exit 1
fi
