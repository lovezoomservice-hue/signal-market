#!/usr/bin/env python3
"""
send_digest.py — Signal Market SMTP Digest Sender
Usage: MAIL_FROM=x SMTP_PASS=y MAIL_TO=z python3 scripts/send_digest.py

SMTP config:
  Host: mail.qiye.163.com
  Port: 465 (SSL) or 587 (TLS/STARTTLS)
  Auth: MAIL_FROM + SMTP_PASS (授权码, NOT login password)
"""

import os, json, sys, smtplib, ssl, urllib.request
from email.mime.text import MIMEText
from email.mime.multipart import MIMEMultipart
from datetime import datetime, timezone

# ── Config from env ──────────────────────────────────────────────────────────
MAIL_FROM  = os.environ.get("MAIL_FROM", "aimusk@nstar-live.com")
SMTP_PASS  = os.environ.get("SMTP_PASS", "")
MAIL_TO    = os.environ.get("MAIL_TO", MAIL_FROM)
SMTP_HOST  = os.environ.get("SMTP_HOST", "smtp.qiye.163.com")  # verified working host
SMTP_PORT  = int(os.environ.get("SMTP_PORT", "465"))
API_BASE   = os.environ.get("API_BASE", "http://localhost:3001")
DRY_RUN    = os.environ.get("DRY_RUN", "").lower() in ("1", "true", "yes")

if not SMTP_PASS and not DRY_RUN:
    print("❌ SMTP_PASS not set. Usage: SMTP_PASS=<授权码> python3 scripts/send_digest.py")
    sys.exit(1)

# ── Fetch data ───────────────────────────────────────────────────────────────
def fetch(path):
    try:
        with urllib.request.urlopen(f"{API_BASE}{path}", timeout=8) as r:
            return json.loads(r.read())
    except Exception as e:
        print(f"  [warn] fetch {path}: {e}")
        return {}

signals = fetch("/api/signals").get("signals", [])[:5]
trends  = fetch("/api/trends").get("trends", [])[:5]
meta    = fetch("/api/signals")

now     = datetime.now(timezone.utc).strftime("%Y-%m-%d %H:%M UTC")
sig_count = len(signals)

# ── Build HTML body ──────────────────────────────────────────────────────────
def sig_rows(items, topic_key="topic", score_key="confidence", extra=None):
    rows = []
    for s in items:
        ev = s.get("evidenceCount") or s.get("evidence_count", "—")
        src = s.get("evidence_source", "")
        stage = s.get("stage", "")
        score = s.get(score_key, s.get("trend_score", "—"))
        row = f"<tr><td>{s.get(topic_key,'—')}</td><td>{stage}</td><td>{score}</td><td>{ev} [{src}]</td></tr>"
        rows.append(row)
    return "\n".join(rows)

html = f"""
<html><body style="font-family:sans-serif;max-width:600px;margin:auto">
<h2 style="color:#1a1a2e">📡 Signal Market Digest</h2>
<p style="color:#666">{now} · {sig_count} active signals</p>

<h3>🔥 Top Signals</h3>
<table border="1" cellpadding="6" cellspacing="0" style="border-collapse:collapse;width:100%">
<tr style="background:#f0f0f0"><th>Topic</th><th>Stage</th><th>Confidence</th><th>Evidence</th></tr>
{sig_rows(signals, topic_key="topic", score_key="confidence")}
</table>

<h3>📈 Top Trends</h3>
<table border="1" cellpadding="6" cellspacing="0" style="border-collapse:collapse;width:100%">
<tr style="background:#f0f0f0"><th>Topic</th><th>Stage</th><th>Score</th><th>Evidence</th></tr>
{sig_rows(trends, topic_key="topic", score_key="trend_score")}
</table>

<hr>
<p style="color:#999;font-size:12px">
Signal Market · <a href="https://signal-market.pages.dev">Dashboard</a> ·
API: signal-market-z14d.vercel.app
</p>
</body></html>
"""

# ── Build message ────────────────────────────────────────────────────────────
msg = MIMEMultipart("alternative")
msg["Subject"] = f"Signal Market Digest — {datetime.now(timezone.utc).strftime('%Y-%m-%d')}"
msg["From"]    = MAIL_FROM
msg["To"]      = MAIL_TO
msg.attach(MIMEText(html, "html"))

# ── Send ─────────────────────────────────────────────────────────────────────
if DRY_RUN:
    print(f"[DRY_RUN] Would send to {MAIL_TO} via {SMTP_HOST}:{SMTP_PORT}")
    print(f"[DRY_RUN] Signals: {[s['topic'] for s in signals]}")
    print("[DRY_RUN] ✅ send_digest.py works (dry run)")
    sys.exit(0)

print(f"Sending digest to {MAIL_TO} via {SMTP_HOST}:{SMTP_PORT} ...")
try:
    ctx = ssl.create_default_context()
    if SMTP_PORT == 465:
        with smtplib.SMTP_SSL(SMTP_HOST, SMTP_PORT, context=ctx) as s:
            s.login(MAIL_FROM, SMTP_PASS)
            s.sendmail(MAIL_FROM, [MAIL_TO], msg.as_string())
    else:
        with smtplib.SMTP(SMTP_HOST, SMTP_PORT) as s:
            s.starttls(context=ctx)
            s.login(MAIL_FROM, SMTP_PASS)
            s.sendmail(MAIL_FROM, [MAIL_TO], msg.as_string())
    print(f"✅ Digest sent to {MAIL_TO}")
    print(f"   Subject: {msg['Subject']}")
    print(f"   Signals: {[s['topic'] for s in signals]}")
except smtplib.SMTPAuthenticationError as e:
    print(f"❌ SMTP Auth failed: {e}")
    print("   Check SMTP_PASS is 授权码 (not login password)")
    sys.exit(2)
except Exception as e:
    print(f"❌ Send failed: {e}")
    sys.exit(3)
