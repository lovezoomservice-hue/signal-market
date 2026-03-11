#!/bin/bash
# pipeline_with_rollback.sh — D5: Minimal rollback protection
# Runs L0→L1→L2→L3, rolls back to last known good on failure

set -e
BASE="/home/nice005/.openclaw/workspace/signal-market"
OUTPUT="$BASE/output"
BACKUP="$OUTPUT/backup"
LOG="$OUTPUT/pipeline_rollback.log"
DATE=$(date +%Y%m%d_%H%M%S)

log() { echo "[$(date '+%Y-%m-%d %H:%M:%S')] $*" | tee -a "$LOG"; }

mkdir -p "$BACKUP"

# Snapshot current good state
if [ -f "$OUTPUT/signals_$(date +%Y%m%d).json" ] || ls "$OUTPUT"/signals_*.json 1>/dev/null 2>&1; then
  LATEST=$(ls -t "$OUTPUT"/signals_*.json 2>/dev/null | head -1)
  if [ -n "$LATEST" ]; then
    cp "$LATEST" "$BACKUP/signals_rollback_${DATE}.json"
    log "SNAPSHOT: backed up $LATEST"
  fi
fi

run_step() {
  local name=$1; local script=$2
  log "RUN: $name"
  if ! node "$BASE/$script" >> "$LOG" 2>&1; then
    log "FAILED: $name — triggering rollback"
    rollback
    exit 1
  fi
  log "OK: $name"
}

rollback() {
  log "ROLLBACK: restoring last known good state..."
  LATEST_BACKUP=$(ls -t "$BACKUP"/signals_rollback_*.json 2>/dev/null | head -1)
  if [ -n "$LATEST_BACKUP" ]; then
    RESTORE_NAME="$OUTPUT/signals_$(date +%Y%m%d).json"
    cp "$LATEST_BACKUP" "$RESTORE_NAME"
    log "ROLLBACK: restored $LATEST_BACKUP → $RESTORE_NAME"
  else
    log "ROLLBACK: no backup found, keeping current state"
  fi
}

log "PIPELINE START — $DATE"
cd "$BASE"
run_step "L0:Ingest"   "l0/ingest.js"
run_step "L1:Denoise"  "l1/denoise.js"
run_step "L2:Events"   "l2/event_graph.js"
run_step "L3:Probability" "l3/probability.js"
log "PIPELINE COMPLETE — all 4 steps OK"
