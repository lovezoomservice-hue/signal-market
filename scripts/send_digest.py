#!/usr/bin/env python3
"""
send_digest.py — Signal Market Daily Digest Sender v2
─────────────────────────────────────────────────────
- Reads subscribers from data/subscribers.json
- Fetches live brief from /api/v2/brief (causal-enriched)
- Sends world-class HTML email to all active subscribers
- Vault-backed SMTP credentials (security/vault/store.json)
- Supports DRY_RUN=1 for safe testing without sending

Usage:
  DRY_RUN=1 python3 scripts/send_digest.py          # dry run, no send
  python3 scripts/send_digest.py                     # real send (needs vault)
  MAIL_TO=x@y.com python3 scripts/send_digest.py     # override recipient

Cron: 0 1 * * * cd /path/to/signal-market && python3 scripts/send_digest.py
(01:00 UTC = 09:00 GMT+8)
"""

import os, json, sys, smtplib, ssl, hashlib, base64, urllib.request
from email.mime.text import MIMEText
from email.mime.multipart import MIMEMultipart
from datetime import datetime, timezone
from pathlib import Path

ROOT     = Path(__file__).parent.parent
DRY_RUN  = os.environ.get("DRY_RUN", "").lower() in ("1", "true", "yes")
API_BASE = os.environ.get("API_BASE", "http://localhost:3001")

# ── Vault reader ──────────────────────────────────────────────────────────────
def vault_get(key, fallback=None):
    """Read a secret from security/vault/store.json (base64-encoded)."""
    vault_path = ROOT / 'security' / 'vault' / 'store.json'
    try:
        with open(vault_path) as f:
            store = json.load(f)
        item = store.get('items', {}).get(key)
        if not item:
            return fallback
        return base64.b64decode(item['ciphertext_b64']).decode('utf-8')
    except Exception as e:
        print(f'  [vault] could not read {key}: {e}')
        return fallback

# ── SMTP config (vault-first, env fallback) ───────────────────────────────────
MAIL_FROM  = os.environ.get("MAIL_FROM",  "aimusk@nstar-live.com")
SMTP_PASS  = os.environ.get("SMTP_PASS")  or vault_get("sec_smtp_pass") or ""
SMTP_HOST  = os.environ.get("SMTP_HOST",  "smtp.qiye.163.com")
SMTP_PORT  = int(os.environ.get("SMTP_PORT", "465"))
MAIL_TO_OVERRIDE = os.environ.get("MAIL_TO")   # override: send to one address only

if not SMTP_PASS and not DRY_RUN:
    print("❌  SMTP_PASS not found in vault or env.")
    print("    Run: node security/vault_adapter.js put sec_smtp_pass <授权码>")
    sys.exit(1)

# ── Fetch ─────────────────────────────────────────────────────────────────────
def fetch_json(path, fallback=None):
    try:
        with urllib.request.urlopen(f"{API_BASE}{path}", timeout=10) as r:
            return json.loads(r.read())
    except Exception as e:
        print(f"  [warn] fetch {path}: {e}")
        return fallback or {}

# ── Subscribers ───────────────────────────────────────────────────────────────
def load_subscribers():
    subs_path = ROOT / 'data' / 'subscribers.json'
    try:
        with open(subs_path) as f:
            store = json.load(f)
        return [s for s in store.get('subscribers', {}).values() if s.get('active')]
    except Exception:
        return []

def unsubscribe_token(email):
    """Deterministic one-way token for unsubscribe link."""
    secret = vault_get('sec_smtp_pass', 'fallback-secret')
    return hashlib.sha256(f"{email}:{secret}:unsubscribe".encode()).hexdigest()[:32]

# ── Email HTML builder ────────────────────────────────────────────────────────
def build_html(brief_data, subscriber_email):
    now_str  = datetime.now(timezone.utc).strftime("%B %d, %Y")
    headline = brief_data.get('headline', 'AI Intelligence Brief')
    macro    = brief_data.get('macro_lead', '')
    sections = brief_data.get('sections', [])
    agent_s  = brief_data.get('agent_summary', {})
    meta     = brief_data.get('meta', {})

    unsub_token = unsubscribe_token(subscriber_email)
    unsub_url   = f"https://signal-market.pages.dev/unsubscribe?email={subscriber_email}&token={unsub_token}"

    # Build signal rows
    signal_rows = ""
    for sec in sections[:3]:
        sec_sigs = sec.get('signals', [])[:4]
        if not sec_sigs:
            continue
        sec_color = {'Accelerating': '#22c55e', 'Forming': '#60a5fa', 'Emerging': '#94a3b8'}.get(sec.get('title',''), '#94a3b8')
        signal_rows += f"""
        <tr><td colspan="4" style="padding:12px 16px 4px;background:#0d1117;font-size:10px;text-transform:uppercase;letter-spacing:0.12em;color:{sec_color};font-family:monospace">{sec.get('title','')}</td></tr>"""
        for s in sec_sigs:
            conf_pct = round((s.get('confidence', 0)) * 100)
            cause    = (s.get('primary_cause') or '')[:90]
            urgency  = s.get('urgency', '')
            window   = s.get('decision_window', '')
            urg_color = '#f59e0b' if urgency == 'high' else '#60a5fa' if urgency == 'medium' else '#94a3b8'
            signal_rows += f"""
        <tr style="border-bottom:1px solid #1e2329">
          <td style="padding:10px 16px;font-weight:600;color:#e6edf3;font-size:13px">{s.get('topic','')}</td>
          <td style="padding:10px 8px;font-family:monospace;font-size:12px;color:{sec_color}">{conf_pct}%</td>
          <td style="padding:10px 8px;font-size:11px;color:#8b949e;line-height:1.5">{cause}{'…' if len(s.get('primary_cause','')) > 90 else ''}</td>
          <td style="padding:10px 8px;font-family:monospace;font-size:10px;color:{urg_color}">{urgency} · {window}</td>
        </tr>"""

    # Priority actions
    priority_items = ""
    for p in agent_s.get('highest_priority', [])[:3]:
        action = p.get('agent_action', '')[:100]
        if action:
            priority_items += f'<li style="margin-bottom:8px;color:#e6edf3;line-height:1.5">{action}</li>'

    # Signal count
    sig_count = meta.get('signal_count', '—')
    causal_cov = meta.get('causal_coverage', '—')

    return f"""<!DOCTYPE html>
<html lang="en">
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>{headline}</title></head>
<body style="margin:0;padding:0;background:#0d1117;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif">
  <div style="max-width:620px;margin:0 auto;padding:24px 16px">

    <!-- Header -->
    <div style="border-bottom:1px solid #1e2329;padding-bottom:20px;margin-bottom:24px">
      <div style="display:flex;align-items:center;justify-content:space-between">
        <div>
          <div style="font-family:monospace;font-size:11px;color:#2d7dd2;letter-spacing:0.1em;text-transform:uppercase;margin-bottom:4px">SIGNAL MARKET</div>
          <div style="font-size:22px;font-weight:700;color:#e6edf3;letter-spacing:-0.02em">{headline}</div>
        </div>
        <div style="text-align:right">
          <div style="font-family:monospace;font-size:11px;color:#8b949e">{now_str}</div>
          <div style="font-family:monospace;font-size:10px;color:#484f58">{sig_count} signals · causal {causal_cov}/8</div>
        </div>
      </div>
    </div>

    <!-- Macro lead -->
    {f'<div style="background:rgba(45,125,210,0.08);border-left:3px solid #2d7dd2;padding:12px 16px;border-radius:0 6px 6px 0;margin-bottom:24px"><p style="margin:0;color:#e6edf3;font-size:13px;line-height:1.65">{macro}</p></div>' if macro else ''}

    <!-- Signal table -->
    <div style="margin-bottom:24px">
      <div style="font-size:11px;text-transform:uppercase;letter-spacing:0.1em;color:#484f58;font-family:monospace;margin-bottom:8px">Active signals</div>
      <table style="width:100%;border-collapse:collapse;background:#161b22;border:1px solid #1e2329;border-radius:8px;overflow:hidden">
        <thead>
          <tr style="background:#0d1117">
            <th style="padding:10px 16px;text-align:left;font-size:10px;text-transform:uppercase;letter-spacing:0.08em;color:#484f58;font-weight:500">Signal</th>
            <th style="padding:10px 8px;text-align:left;font-size:10px;text-transform:uppercase;letter-spacing:0.08em;color:#484f58;font-weight:500">Conf</th>
            <th style="padding:10px 8px;text-align:left;font-size:10px;text-transform:uppercase;letter-spacing:0.08em;color:#484f58;font-weight:500">Primary cause</th>
            <th style="padding:10px 8px;text-align:left;font-size:10px;text-transform:uppercase;letter-spacing:0.08em;color:#484f58;font-weight:500">Urgency</th>
          </tr>
        </thead>
        <tbody>{signal_rows}</tbody>
      </table>
    </div>

    <!-- Priority actions -->
    {f'''<div style="margin-bottom:24px">
      <div style="font-size:11px;text-transform:uppercase;letter-spacing:0.1em;color:#484f58;font-family:monospace;margin-bottom:8px">Agent action items</div>
      <div style="background:#161b22;border:1px solid #1e2329;border-radius:8px;padding:16px">
        <ul style="margin:0;padding-left:20px">{priority_items}</ul>
      </div>
    </div>''' if priority_items else ''}

    <!-- CTA -->
    <div style="text-align:center;margin-bottom:32px">
      <a href="https://signal-market.pages.dev/brief" style="display:inline-block;padding:12px 28px;background:#2d7dd2;color:#fff;text-decoration:none;border-radius:6px;font-size:13px;font-weight:600">View full brief →</a>
      <span style="margin:0 12px;color:#484f58">·</span>
      <a href="https://signal-market.pages.dev/signals" style="display:inline-block;padding:12px 28px;background:transparent;border:1px solid #1e2329;color:#8b949e;text-decoration:none;border-radius:6px;font-size:13px">All signals</a>
    </div>

    <!-- Footer -->
    <div style="border-top:1px solid #1e2329;padding-top:16px;text-align:center">
      <p style="margin:0 0 8px;font-size:11px;color:#484f58;font-family:monospace">
        Signal Market · AI Intelligence Infrastructure
      </p>
      <p style="margin:0;font-size:10px;color:#30363d">
        Sent to {subscriber_email} ·
        <a href="{unsub_url}" style="color:#484f58;text-decoration:underline">Unsubscribe</a>
      </p>
    </div>

  </div>
</body>
</html>"""

# ── Send one email ────────────────────────────────────────────────────────────
def send_one(to_email, html, subject, ctx, smtp_conn=None):
    msg = MIMEMultipart("alternative")
    msg["Subject"] = subject
    msg["From"]    = MAIL_FROM
    msg["To"]      = to_email
    msg.attach(MIMEText(html, "html", "utf-8"))

    if DRY_RUN:
        print(f"  [DRY_RUN] → {to_email}")
        return True

    try:
        smtp_conn.sendmail(MAIL_FROM, [to_email], msg.as_string())
        return True
    except Exception as e:
        print(f"  ❌ send failed for {to_email}: {e}")
        return False

# ── Main ──────────────────────────────────────────────────────────────────────
def main():
    print(f"{'[DRY_RUN] ' if DRY_RUN else ''}Signal Market Digest Sender v2")
    print(f"  SMTP: {SMTP_HOST}:{SMTP_PORT}")
    print(f"  FROM: {MAIL_FROM}")

    # Fetch brief
    print("  Fetching /api/v2/brief ...")
    brief = fetch_json("/api/v2/brief")
    if not brief.get('headline'):
        print("  ❌ Brief API returned no data. Is the server running?")
        sys.exit(1)
    print(f"  Brief: {brief.get('headline')}")
    print(f"  Causal coverage: {brief.get('meta',{}).get('causal_coverage','?')}/8")

    # Determine recipients
    if MAIL_TO_OVERRIDE:
        recipients = [{'email': MAIL_TO_OVERRIDE, 'id': 'manual'}]
        print(f"  Recipient override: {MAIL_TO_OVERRIDE}")
    else:
        recipients = load_subscribers()
        print(f"  Subscribers: {len(recipients)} active")

    if not recipients:
        print("  ℹ No subscribers. Add via POST /api/auth/subscribe")
        sys.exit(0)

    # Build subject
    now_str = datetime.now(timezone.utc).strftime('%Y-%m-%d')
    subject = f"Signal Market · {brief.get('headline', 'Daily Brief')} · {now_str}"

    # Send
    sent = failed = 0
    if DRY_RUN:
        for r in recipients:
            html = build_html(brief, r['email'])
            send_one(r['email'], html, subject, None)
            sent += 1
        print(f"\n[DRY_RUN] Would send {sent} emails. Subject: {subject}")
        print("[DRY_RUN] ✅ send_digest.py v2 validated")
        return

    # Real send — single SMTP connection for all recipients
    ctx = ssl.create_default_context()
    try:
        if SMTP_PORT == 465:
            smtp = smtplib.SMTP_SSL(SMTP_HOST, SMTP_PORT, context=ctx)
        else:
            smtp = smtplib.SMTP(SMTP_HOST, SMTP_PORT)
            smtp.starttls(context=ctx)
        smtp.login(MAIL_FROM, SMTP_PASS)
        print(f"  SMTP connected ✓")

        for r in recipients:
            html = build_html(brief, r['email'])
            ok = send_one(r['email'], html, subject, ctx, smtp)
            if ok:
                sent += 1
                print(f"  ✓ → {r['email']}")
            else:
                failed += 1

        smtp.quit()
    except smtplib.SMTPAuthenticationError as e:
        print(f"❌ SMTP Auth failed: {e}")
        print("   Check vault: node security/vault_adapter.js put sec_smtp_pass <授权码>")
        sys.exit(2)
    except Exception as e:
        print(f"❌ SMTP connection failed: {e}")
        sys.exit(3)

    print(f"\n✅ Digest sent: {sent} delivered, {failed} failed")
    print(f"   Subject: {subject}")

if __name__ == '__main__':
    main()
