#!/usr/bin/env python3
"""
Watchlist Alert Sender — Signal Market
Scans active watchlist items against live JSONL signals, sends email on threshold breach.

Usage:
  python3 scripts/send_watchlist_alerts.py
  DRY_RUN=1 python3 scripts/send_watchlist_alerts.py
"""

import json, os, ssl, smtplib, datetime
from email.mime.text import MIMEText
from email.mime.multipart import MIMEMultipart
from pathlib import Path

ROOT    = Path(__file__).parent.parent
WL_FILE = ROOT / "data" / "watchlist.json"
TRG_LOG = ROOT / "data" / "watchlist_triggers.jsonl"
SIGNALS = ROOT / "data" / "signals_history.jsonl"

def _vault_get(key):
    try:
        store = json.loads((ROOT.parent / "security" / "vault" / "store.json").read_text())
        return store.get(key, {}).get("value")
    except Exception:
        return None

DRY_RUN   = os.environ.get("DRY_RUN", "").lower() in ("1", "true", "yes")
SMTP_PASS = os.environ.get("SMTP_PASS") or _vault_get("sec_smtp_pass") or ""
SMTP_HOST = os.environ.get("SMTP_HOST", "smtp.qiye.163.com")
SMTP_PORT = int(os.environ.get("SMTP_PORT", "465"))
MAIL_FROM = os.environ.get("MAIL_FROM", "aimusk@nstar-live.com")

# ── Data loading ─────────────────────────────────────────────────────────────

def load_watchlist():
    if not WL_FILE.exists():
        return []
    raw = json.loads(WL_FILE.read_text())
    items = raw if isinstance(raw, list) else raw.get("watchlist", [])
    return [w for w in items if w.get("active", True)]

def load_signals():
    if not SIGNALS.exists():
        return []
    out = []
    for line in SIGNALS.read_text().splitlines():
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

def load_triggers_today():
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
    with open(TRG_LOG, "a") as f:
        f.write(json.dumps(entry, ensure_ascii=False) + "\n")

# ── Trigger detection ────────────────────────────────────────────────────────

def check_triggers(watchlist, signals):
    already = load_triggers_today()
    triggered = []
    for w in watchlist:
        wid = w.get("id", "")
        if wid in already:
            continue
        q = (w.get("topic") or "").lower()
        match = next(
            (s for s in signals
             if q in s["topic"].lower() or s["topic"].lower() in q),
            None,
        )
        if not match:
            continue
        thresh    = float(w.get("threshold", 0.7))
        stage_f   = w.get("stage")
        if match["confidence"] >= thresh and (not stage_f or match["stage"] == stage_f):
            triggered.append({
                "ts":         datetime.datetime.now(datetime.timezone.utc).isoformat().replace("+00:00","Z"),
                "watch_id":   wid,
                "topic":      match["topic"],
                "signal_id":  match.get("signal_id"),
                "stage":      match["stage"],
                "confidence": match["confidence"],
                "threshold":  thresh,
                "email":      w.get("email"),
                "trigger":    "THRESHOLD_EXCEEDED",
            })
    return triggered

# ── Email ────────────────────────────────────────────────────────────────────

def build_html(t):
    conf   = round(t["confidence"] * 100)
    thresh = round(t["threshold"] * 100)
    sid    = t.get("signal_id") or ""
    # Deep link: signal.html?id=evt_xxx if signal_id available, else signals list
    detail_url = (
        f"https://signal-market.pages.dev/signal?id={sid}"
        if sid else
        "https://signal-market.pages.dev/signals"
    )
    return f"""<!DOCTYPE html><html><head><meta charset="UTF-8">
<style>body{{font-family:-apple-system,sans-serif;background:#07060f;color:#e2e8f0;margin:0;padding:0}}
.w{{max-width:520px;margin:0 auto;padding:32px 24px}}
.badge{{background:#c8a8f0;color:#07060f;font-size:11px;font-weight:700;
  letter-spacing:.08em;padding:4px 10px;border-radius:4px;text-transform:uppercase}}
h2{{font-size:20px;font-weight:700;margin:16px 0 6px}}
.conf{{font-size:38px;font-weight:800;color:#c8a8f0;margin:0 0 6px}}
.meta{{font-size:13px;color:#94a3b8;margin-bottom:24px}}
.cta{{background:#c8a8f0;color:#07060f;font-weight:700;text-decoration:none;
  padding:12px 24px;border-radius:8px;font-size:14px;display:inline-block}}
.sid{{font-family:monospace;font-size:11px;color:#475569;margin-top:8px}}
.foot{{margin-top:32px;font-size:11px;color:#475569}}
</style></head><body><div class="w">
<span class="badge">Watchlist Alert</span>
<h2>📡 {t['topic']}</h2>
<div class="conf">{conf}%</div>
<div class="meta">confidence · threshold {thresh}% · stage: {t['stage']}</div>
<a class="cta" href="{detail_url}">View Signal →</a>
{f'<div class="sid">signal_id: {sid}</div>' if sid else ''}
<div class="foot">Signal Market · You're watching <strong>{t['topic']}</strong>. ·
<a href="https://signal-market.pages.dev/signals" style="color:#94a3b8">All signals</a>
</div>
</div></body></html>"""

def send_alert(t):
    to    = t.get("email") or MAIL_FROM
    conf  = round(t["confidence"] * 100)
    msg   = MIMEMultipart("alternative")
    msg["Subject"] = f"🚨 Signal Alert: {t['topic']} at {conf}% confidence"
    msg["From"]    = MAIL_FROM
    msg["To"]      = to
    msg.attach(MIMEText(build_html(t), "html", "utf-8"))

    if DRY_RUN:
        print(f"  [DRY_RUN] → {to}  ({t['topic']} {conf}%)")
        return True
    try:
        ctx = ssl.create_default_context()
        with smtplib.SMTP_SSL(SMTP_HOST, SMTP_PORT, context=ctx) as smtp:
            smtp.login(MAIL_FROM, SMTP_PASS)
            smtp.send_message(msg)
        print(f"  ✓ → {to}  ({t['topic']} {conf}%)")
        return True
    except Exception as e:
        print(f"  ✗ → {to}  ERROR: {e}")
        return False

# ── Main ─────────────────────────────────────────────────────────────────────

def main():
    mode = "[DRY_RUN]" if DRY_RUN else ""
    print(f"Watchlist Alert Scanner {mode}")
    watchlist = load_watchlist()
    signals   = load_signals()
    print(f"  Watches: {len(watchlist)}  Signals: {len(signals)}")

    if not SMTP_PASS and not DRY_RUN:
        print("  ❌ SMTP_PASS not set — cannot send. Set SMTP_PASS env var or vault sec_smtp_pass.")
        return

    if not watchlist:
        print("  No active watches — done.")
        return

    triggered = check_triggers(watchlist, signals)
    print(f"  Triggered: {len(triggered)}")
    if not triggered:
        print("  Nothing to send today.")
        return

    sent = 0
    for t in triggered:
        if send_alert(t):
            log_trigger(t)
            sent += 1

    summary = f"Would send {len(triggered)} alerts." if DRY_RUN else f"Alerts sent: {sent}/{len(triggered)}"
    print(f"\n{'[DRY_RUN] ' if DRY_RUN else ''}✅ {summary}")

if __name__ == "__main__":
    main()
