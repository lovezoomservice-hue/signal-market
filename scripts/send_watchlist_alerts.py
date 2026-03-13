#!/usr/bin/env python3
"""
Watchlist Alert Sender — Signal Market v2
Scans active watchlist items against live JSONL signals, sends email on:
  1. Threshold breach (confidence >= threshold)
  2. Stage change (e.g., forming→accelerating, accelerating→peak)

Usage:
  python3 scripts/send_watchlist_alerts.py
  DRY_RUN=1 python3 scripts/send_watchlist_alerts.py
  python3 scripts/send_watchlist_alerts.py --dry-run
"""

import json
import os
import ssl
import smtplib
import datetime
import argparse
import base64
from email.mime.text import MIMEText
from email.mime.multipart import MIMEMultipart
from pathlib import Path
from datetime import timezone

ROOT          = Path(__file__).parent.parent
WL_FILE       = ROOT / "data" / "watchlist.json"
TRG_LOG       = ROOT / "data" / "watchlist_alert_history.jsonl"
STAGES_FILE   = ROOT / "data" / "watchlist_last_stages.json"
SIGNALS_FILE  = ROOT / "data" / "signals_history.jsonl"

# ── Vault reader ──────────────────────────────────────────────────────────────
def _vault_get(key):
    try:
        vault_path = ROOT.parent / "security" / "vault" / "store.json"
        store = json.loads(vault_path.read_text())
        item = store.get('items', {}).get(key)
        if not item:
            return None
        return base64.b64decode(item['ciphertext_b64']).decode('utf-8')
    except Exception:
        return None

# ── SMTP config ───────────────────────────────────────────────────────────────
DRY_RUN     = os.environ.get("DRY_RUN", "").lower() in ("1", "true", "yes")
SMTP_PASS   = os.environ.get("SMTP_PASS") or _vault_get("sec_smtp_pass") or ""
SMTP_HOST   = os.environ.get("SMTP_HOST", "smtp.qiye.163.com")
SMTP_PORT   = int(os.environ.get("SMTP_PORT", "465"))
MAIL_FROM   = os.environ.get("MAIL_FROM", "aimusk@nstar-live.com")
MAIL_TO_OVERRIDE = os.environ.get("MAIL_TO")

# ── Data loading ──────────────────────────────────────────────────────────────
def load_watchlist():
    if not WL_FILE.exists():
        return []
    raw = json.loads(WL_FILE.read_text())
    items = raw if isinstance(raw, list) else raw.get("watchlist", [])
    return [w for w in items if w.get("active", True)]

def load_signals():
    if not SIGNALS_FILE.exists():
        return []
    out = []
    for line in SIGNALS_FILE.read_text().splitlines():
        line = line.strip()
        if not line:
            continue
        try:
            s = json.loads(line)
            if s.get("topic") and s.get("signal_id"):
                out.append(s)
        except Exception:
            pass
    return out

def load_last_stages():
    """Load last known stages for each watchlist item."""
    if not STAGES_FILE.exists():
        return {}
    try:
        return json.loads(STAGES_FILE.read_text())
    except Exception:
        return {}

def save_last_stages(stages):
    """Save current stages for each watchlist item."""
    STAGES_FILE.write_text(json.dumps(stages, indent=2, ensure_ascii=False))

def load_triggered_today():
    """Get set of watch IDs that already triggered today."""
    if not TRG_LOG.exists():
        return set()
    today = datetime.date.today().isoformat()
    ids = set()
    for line in TRG_LOG.read_text().splitlines():
        try:
            e = json.loads(line)
            if (e.get("ts") or "").startswith(today):
                ids.add(e["watch_id"])
        except Exception:
            pass
    return ids

def log_trigger(entry):
    """Log a triggered alert to history."""
    with open(TRG_LOG, "a", encoding="utf-8") as f:
        f.write(json.dumps(entry, ensure_ascii=False) + "\n")

# ── Trigger detection ─────────────────────────────────────────────────────────
STAGE_ORDER = {'weak': 0, 'emerging': 1, 'forming': 2, 'accelerating': 3, 'peak': 4, 'fading': 5}

def get_urgency(stage):
    if stage in ('accelerating', 'peak'):
        return 'high'
    elif stage in ('forming',):
        return 'medium'
    else:
        return 'low'

def get_action_fields(topic, stage):
    """Get action fields for a topic/stage combination."""
    ACTION_LAYER = {
        'AI Agents': {
            'decision_question': 'Which agent frameworks will become the production standard in 12 months?',
            'next_best_action': 'Monitor top 5 agent framework GitHub stars weekly.',
        },
        'LLM Infrastructure': {
            'decision_question': 'Which inference stack will dominate enterprise LLM serving in 2026?',
            'next_best_action': 'Track monthly cost-per-token from top 5 inference providers.',
        },
        'AI Coding': {
            'decision_question': 'When will AI coding reach autonomous completion of real-world software tasks?',
            'next_best_action': 'Track SWE-bench top 5 models monthly.',
        },
        'AI Reasoning': {
            'decision_question': 'Will inference-time compute scaling unlock AGI-level reasoning?',
            'next_best_action': 'Monitor MATH benchmark top-5 monthly.',
        },
        'AI Chips & Custom Silicon': {
            'decision_question': 'Will alternative AI accelerators capture >20% market share from NVIDIA by 2027?',
            'next_best_action': 'Track monthly $/token benchmarks for Groq vs Cerebras vs NVIDIA.',
        },
        'AI Investment & Capital': {
            'decision_question': 'Is AI investment in a sustainable growth phase or approaching a peak valuation cycle?',
            'next_best_action': 'Monitor weekly AI funding rounds >$50M.',
        },
        'Robotics & Embodied AI': {
            'decision_question': 'Which humanoid robot company will reach 1,000 production units first?',
            'next_best_action': 'Monitor Figure AI and 1X robot production announcements monthly.',
        },
        'Autonomous Vehicles': {
            'decision_question': 'Will Waymo or Tesla FSD reach commercial scale in 10+ cities by end of 2026?',
            'next_best_action': 'Track Waymo weekly ride count quarterly reports.',
        },
    }
    defaults = ACTION_LAYER.get(topic, {
        'decision_question': f'What will determine {topic} trajectory in the next 12 months?',
        'next_best_action': f'Monitor {topic} signals weekly.',
    })
    return {
        'urgency': get_urgency(stage),
        'decision_question': defaults['decision_question'],
        'next_best_action': defaults['next_best_action'],
    }

def check_stage_changes(watchlist, signals, last_stages, already_triggered):
    """Check for stage changes in watchlist items."""
    triggered = []
    for w in watchlist:
        wid = w.get("id", "")
        if wid in already_triggered:
            continue

        topic_query = (w.get("topic") or "").lower()
        match = next(
            (s for s in signals
             if topic_query in s["topic"].lower() or s["topic"].lower() in topic_query),
            None,
        )
        if not match:
            continue

        current_stage = match.get("stage", "unknown")
        last_stage = last_stages.get(wid, {}).get("stage")

        if last_stage and current_stage != last_stage:
            action_fields = get_action_fields(match["topic"], current_stage)
            triggered.append({
                "ts": datetime.datetime.now(timezone.utc).isoformat().replace("+00:00", "Z"),
                "watch_id": wid,
                "topic": match["topic"],
                "signal_id": match.get("signal_id"),
                "old_stage": last_stage,
                "new_stage": current_stage,
                "confidence": match["confidence"],
                "trigger": "STAGE_CHANGE",
                "urgency": action_fields["urgency"],
                "decision_question": action_fields["decision_question"],
                "next_best_action": action_fields["next_best_action"],
                "source_url": match.get("source_url"),
            })

    return triggered

def check_threshold_breaches(watchlist, signals, already_triggered):
    """Check for threshold breaches (legacy behavior)."""
    triggered = []
    for w in watchlist:
        wid = w.get("id", "")
        if wid in already_triggered:
            continue

        topic_query = (w.get("topic") or "").lower()
        match = next(
            (s for s in signals
             if topic_query in s["topic"].lower() or s["topic"].lower() in topic_query),
            None,
        )
        if not match:
            continue

        thresh = float(w.get("threshold", 0.7))
        stage_filter = w.get("stage")

        if match["confidence"] >= thresh and (not stage_filter or match["stage"] == stage_filter):
            action_fields = get_action_fields(match["topic"], match["stage"])
            triggered.append({
                "ts": datetime.datetime.now(timezone.utc).isoformat().replace("+00:00", "Z"),
                "watch_id": wid,
                "topic": match["topic"],
                "signal_id": match.get("signal_id"),
                "stage": match["stage"],
                "confidence": match["confidence"],
                "threshold": thresh,
                "trigger": "THRESHOLD_EXCEEDED",
                "urgency": action_fields["urgency"],
                "decision_question": action_fields["decision_question"],
                "next_best_action": action_fields["next_best_action"],
                "source_url": match.get("source_url"),
            })

    return triggered

# ── Email HTML builder ────────────────────────────────────────────────────────
def build_stage_change_html(t):
    """Build HTML for stage change alert."""
    topic = t["topic"]
    old_stage = t.get("old_stage", "unknown")
    new_stage = t["new_stage"]
    urgency = t.get("urgency", "medium")
    confidence = round(t.get("confidence", 0) * 100)
    signal_id = t.get("signal_id", "")

    stage_colors = {
        'accelerating': '#22c55e', 'peak': '#ef4444', 'forming': '#60a5fa',
        'emerging': '#94a3b8', 'fading': '#f59e0b', 'weak': '#64748b',
    }
    old_color = stage_colors.get(old_stage, '#94a3b8')
    new_color = stage_colors.get(new_stage, '#94a3b8')

    urgency_colors = {'high': '#f59e0b', 'medium': '#60a5fa', 'low': '#94a3b8'}
    urgency_color = urgency_colors.get(urgency, '#94a3b8')

    detail_url = f"https://signal-market.pages.dev/signals"
    if signal_id:
        detail_url = f"https://signal-market.pages.dev/signal?id={signal_id}"

    return f"""<!DOCTYPE html>
<html lang="en">
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>Signal Alert: {topic}</title>
</head>
<body style="margin:0;padding:0;background:#0d1117;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif">
  <div style="max-width:520px;margin:0 auto;padding:24px 16px">
    <div style="border-bottom:1px solid #1e2329;padding-bottom:16px;margin-bottom:20px">
      <div style="font-family:monospace;font-size:10px;color:#2d7dd2;letter-spacing:0.1em;text-transform:uppercase;margin-bottom:8px">⚡ Stage Change Alert</div>
      <h1 style="font-size:22px;font-weight:700;color:#e6edf3;margin:0 0 12px">{topic}</h1>
      <div style="display:flex;align-items:center;gap:12px;margin-bottom:16px">
        <span style="background:{old_color};color:#0d1117;font-size:11px;font-weight:700;padding:4px 10px;border-radius:4px;text-transform:uppercase">{old_stage}</span>
        <span style="color:#484f58;font-size:14px">→</span>
        <span style="background:{new_color};color:#0d1117;font-size:11px;font-weight:700;padding:4px 10px;border-radius:4px;text-transform:uppercase">{new_stage}</span>
      </div>
      <div style="display:flex;gap:16px;margin-bottom:16px">
        <div style="font-family:monospace;font-size:28px;font-weight:700;color:#c8a8f0">{confidence}%</div>
        <div style="display:flex;flex-direction:column;justify-content:center">
          <div style="font-size:10px;color:#8b949e;text-transform:uppercase">Confidence</div>
          <div style="font-size:11px;color:{urgency_color};font-family:monospace;font-weight:700;text-transform:uppercase">{urgency} urgency</div>
        </div>
      </div>
    </div>
    <div style="background:#161b22;border:1px solid #1e2329;border-radius:8px;padding:16px;margin-bottom:20px">
      <div style="font-size:10px;color:#8b949e;text-transform:uppercase;margin-bottom:8px;font-family:monospace">Decision Question</div>
      <div style="color:#e6edf3;font-size:13px;line-height:1.6;margin-bottom:12px">{t.get('decision_question', '')}</div>
      <div style="font-size:10px;color:#8b949e;text-transform:uppercase;margin-bottom:8px;font-family:monospace">Next Best Action</div>
      <div style="color:#58a6ff;font-size:13px;line-height:1.6">{t.get('next_best_action', '')}</div>
    </div>
    <div style="text-align:center;margin-bottom:24px">
      <a href="{detail_url}" style="display:inline-block;padding:12px 24px;background:#2d7dd2;color:#fff;text-decoration:none;border-radius:6px;font-size:13px;font-weight:600">View Signal →</a>
    </div>
    <div style="border-top:1px solid #1e2329;padding-top:16px;text-align:center">
      <p style="margin:0;font-size:11px;color:#484f58;font-family:monospace">Signal Market · AI Intelligence Infrastructure</p>
      <p style="margin:8px 0 0;font-size:10px;color:#30363d">You're watching <strong>{topic}</strong>.</p>
    </div>
  </div>
</body>
</html>"""

def build_threshold_html(t):
    """Build HTML for threshold breach alert."""
    topic = t["topic"]
    stage = t.get("stage", "unknown")
    confidence = round(t.get("confidence", 0) * 100)
    threshold = round(t.get("threshold", 0) * 100)
    signal_id = t.get("signal_id", "")
    urgency = t.get("urgency", "medium")

    stage_colors = {
        'accelerating': '#22c55e', 'peak': '#ef4444', 'forming': '#60a5fa',
        'emerging': '#94a3b8', 'fading': '#f59e0b', 'weak': '#64748b',
    }
    stage_color = stage_colors.get(stage, '#94a3b8')
    urgency_colors = {'high': '#f59e0b', 'medium': '#60a5fa', 'low': '#94a3b8'}
    urgency_color = urgency_colors.get(urgency, '#94a3b8')

    detail_url = f"https://signal-market.pages.dev/signals"
    if signal_id:
        detail_url = f"https://signal-market.pages.dev/signal?id={signal_id}"

    return f"""<!DOCTYPE html>
<html lang="en">
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>Signal Alert: {topic}</title>
</head>
<body style="margin:0;padding:0;background:#0d1117;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif">
  <div style="max-width:520px;margin:0 auto;padding:24px 16px">
    <div style="border-bottom:1px solid #1e2329;padding-bottom:16px;margin-bottom:20px">
      <div style="font-family:monospace;font-size:10px;color:#2d7dd2;letter-spacing:0.1em;text-transform:uppercase;margin-bottom:8px">🚨 Threshold Alert</div>
      <h1 style="font-size:22px;font-weight:700;color:#e6edf3;margin:0 0 12px">{topic}</h1>
      <div style="display:flex;align-items:center;gap:12px;margin-bottom:16px">
        <span style="background:{stage_color};color:#0d1117;font-size:11px;font-weight:700;padding:4px 10px;border-radius:4px;text-transform:uppercase">{stage}</span>
        <div style="font-family:monospace;font-size:28px;font-weight:700;color:#c8a8f0">{confidence}%</div>
        <div style="font-size:11px;color:#8b949e">threshold: {threshold}%</div>
      </div>
      <div style="font-size:11px;color:{urgency_color};font-family:monospace;font-weight:700;text-transform:uppercase">{urgency} urgency</div>
    </div>
    <div style="background:#161b22;border:1px solid #1e2329;border-radius:8px;padding:16px;margin-bottom:20px">
      <div style="font-size:10px;color:#8b949e;text-transform:uppercase;margin-bottom:8px;font-family:monospace">Decision Question</div>
      <div style="color:#e6edf3;font-size:13px;line-height:1.6;margin-bottom:12px">{t.get('decision_question', '')}</div>
      <div style="font-size:10px;color:#8b949e;text-transform:uppercase;margin-bottom:8px;font-family:monospace">Next Best Action</div>
      <div style="color:#58a6ff;font-size:13px;line-height:1.6">{t.get('next_best_action', '')}</div>
    </div>
    <div style="text-align:center;margin-bottom:24px">
      <a href="{detail_url}" style="display:inline-block;padding:12px 24px;background:#2d7dd2;color:#fff;text-decoration:none;border-radius:6px;font-size:13px;font-weight:600">View Signal →</a>
    </div>
    <div style="border-top:1px solid #1e2329;padding-top:16px;text-align:center">
      <p style="margin:0;font-size:11px;color:#484f58;font-family:monospace">Signal Market · AI Intelligence Infrastructure</p>
      <p style="margin:8px 0 0;font-size:10px;color:#30363d">You're watching <strong>{topic}</strong>.</p>
    </div>
  </div>
</body>
</html>"""

# ── Send email ────────────────────────────────────────────────────────────────
def send_alert(t, smtp_conn=None):
    to_email = t.get("email") or MAIL_TO_OVERRIDE or MAIL_FROM
    trigger_type = t.get("trigger", "STAGE_CHANGE")

    if trigger_type == "STAGE_CHANGE":
        subject = f"⚡ Signal Alert: {t['topic']} stage changed to {t['new_stage']}"
        html = build_stage_change_html(t)
    else:
        conf = round(t["confidence"] * 100)
        subject = f"🚨 Signal Alert: {t['topic']} at {conf}% confidence"
        html = build_threshold_html(t)

    msg = MIMEMultipart("alternative")
    msg["Subject"] = subject
    msg["From"] = MAIL_FROM
    msg["To"] = to_email
    msg.attach(MIMEText(html, "html", "utf-8"))

    if DRY_RUN:
        print(f"  [DRY_RUN] → {to_email}  ({t['topic']} - {trigger_type})")
        return True

    try:
        if smtp_conn:
            smtp_conn.sendmail(MAIL_FROM, [to_email], msg.as_string())
        else:
            ctx = ssl.create_default_context()
            with smtplib.SMTP_SSL(SMTP_HOST, SMTP_PORT, context=ctx) as smtp:
                smtp.login(MAIL_FROM, SMTP_PASS)
                smtp.send_message(msg)
        print(f"  ✓ → {to_email}  ({t['topic']} - {trigger_type})")
        return True
    except Exception as e:
        print(f"  ✗ → {to_email}  ERROR: {e}")
        return False

# ── Main ──────────────────────────────────────────────────────────────────────
def main():
    parser = argparse.ArgumentParser(description="Watchlist Alert Sender")
    parser.add_argument("--dry-run", action="store_true", help="Dry run mode")
    args = parser.parse_args()

    global DRY_RUN
    if args.dry_run:
        DRY_RUN = True

    mode = "[DRY_RUN] " if DRY_RUN else ""
    print(f"{mode}Watchlist Alert Sender v2")
    print(f"  SMTP: {SMTP_HOST}:{SMTP_PORT}")
    print(f"  FROM: {MAIL_FROM}")

    watchlist = load_watchlist()
    signals = load_signals()
    last_stages = load_last_stages()
    already_triggered = load_triggered_today()

    print(f"  Watches: {len(watchlist)}  Signals: {len(signals)}")

    if not SMTP_PASS and not DRY_RUN:
        print("  ❌ SMTP_PASS not set — cannot send. Set SMTP_PASS env var or vault sec_smtp_pass.")
        return

    if not watchlist:
        print("  ℹ No active watches — done.")
        return

    # Check for stage changes (priority) and threshold breaches
    stage_changes = check_stage_changes(watchlist, signals, last_stages, already_triggered)
    threshold_breaches = check_threshold_breaches(watchlist, signals, already_triggered)

    # Combine, dedupe by watch_id (stage change takes priority)
    all_triggered = []
    seen_ids = set()
    for t in stage_changes + threshold_breaches:
        if t["watch_id"] not in seen_ids:
            all_triggered.append(t)
            seen_ids.add(t["watch_id"])

    print(f"  Triggered: {len(all_triggered)} ({len(stage_changes)} stage changes, {len(threshold_breaches)} threshold)")

    if not all_triggered:
        print("  ℹ Nothing to send today.")
        # Still update last_stages for current signals
        for w in watchlist:
            wid = w.get("id", "")
            topic_query = (w.get("topic") or "").lower()
            match = next(
                (s for s in signals if topic_query in s["topic"].lower() or s["topic"].lower() in topic_query),
                None,
            )
            if match:
                last_stages[wid] = {"stage": match.get("stage"), "confidence": match.get("confidence"), "updated_at": datetime.datetime.now(timezone.utc).isoformat()}
        save_last_stages(last_stages)
        return

    # Send alerts
    sent = 0
    ctx = ssl.create_default_context()
    smtp = None

    if not DRY_RUN and SMTP_PASS:
        try:
            smtp = smtplib.SMTP_SSL(SMTP_HOST, SMTP_PORT, context=ctx)
            smtp.login(MAIL_FROM, SMTP_PASS)
            print(f"  SMTP connected ✓")
        except Exception as e:
            print(f"  ❌ SMTP connection failed: {e}")
            smtp = None

    for t in all_triggered:
        if send_alert(t, smtp):
            log_trigger(t)
            sent += 1
            # Update last_stages for this watch item
            wid = t["watch_id"]
            last_stages[wid] = {
                "stage": t.get("new_stage") or t.get("stage"),
                "confidence": t.get("confidence"),
                "updated_at": t.get("ts"),
            }

    if smtp:
        try:
            smtp.quit()
        except Exception:
            pass

    # Save updated last_stages
    save_last_stages(last_stages)

    summary = f"Would send {len(all_triggered)} alerts." if DRY_RUN else f"Alerts sent: {sent}/{len(all_triggered)}"
    print(f"\n{mode}✅ {summary}")

if __name__ == "__main__":
    main()
