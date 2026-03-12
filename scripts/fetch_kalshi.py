#!/usr/bin/env python3
"""
Kalshi Prediction Market Fetcher — Signal Market Source Layer L3
Free REST API, no authentication required for market listing.
US-regulated prediction market — higher institutional credibility than Polymarket.

Usage:
  python3 scripts/fetch_kalshi.py
  python3 scripts/fetch_kalshi.py --dry-run

Service: Signal Market prediction layer L3
Owner: Signal Market pipeline
Integration: fetch_world_signals.py + daily GHA step
Status: ACTIVE — wired to world signals pipeline
Fallback: Returns empty list on error (never blocks pipeline)
Recycle: If 0 matched markets for 14 consecutive days → evaluate
"""
import sys, json, urllib.request, ssl, datetime, argparse

KALSHI_API = "https://trading-api.kalshi.com/trade-api/v2/markets?limit=200&status=open"

_SSL_CTX = ssl.create_default_context()
_SSL_CTX.check_hostname = False
_SSL_CTX.verify_mode = ssl.CERT_NONE

TOPIC_KEYWORDS = {
    "LLM Infrastructure":        ["gpt","openai","claude","anthropic","chatgpt","llm","model release","ai model"],
    "AI Agents":                 ["ai agent","autonomous","copilot","ai assistant","ai system"],
    "AI Chips & Hardware":       ["nvidia","chip","gpu","semiconductor","h100"],
    "Robotics & Embodied AI":    ["robot","humanoid","autonomous robot"],
    "Commercial Space":          ["spacex","starship","launch","satellite","nasa","moon","mars"],
    "Autonomous Vehicles":       ["waymo","self-driving","tesla","autonomous vehicle","robotaxi"],
    "AI Policy & Governance":    ["ai regulation","ai ban","ai legislation","ai executive","congress ai","senate ai"],
    "AI Investment & Capital":   ["openai","anthropic valuation","ai funding","ai ipo","ai company","ai startup"],
    "Macro & Geopolitics":       ["fed rate","interest rate","recession","inflation","gdp","unemployment","tariff","trade war","sanction"],
    "US Politics":               ["trump","democrat","republican","senate","house","president","election","congress","administration"],
    "Crypto & Digital Assets":   ["bitcoin","ethereum","crypto","btc","eth","defi","stablecoin","sec crypto"],
    "Energy & Infrastructure":   ["oil","gas","nuclear","solar","grid","electricity","power","datacenter energy"],
}

def score_text(text: str, keywords: list[str]) -> float:
    text = text.lower()
    matches = sum(1 for kw in keywords if kw in text)
    return min(0.95, 0.42 + matches * 0.15)

def fetch_kalshi_signals() -> list[dict]:
    try:
        req = urllib.request.Request(
            KALSHI_API,
            headers={"User-Agent": "SignalMarket/1.0", "Accept": "application/json"}
        )
        data = json.loads(urllib.request.urlopen(req, context=_SSL_CTX, timeout=15).read())
    except Exception as e:
        print(f"  [kalshi] fetch error: {e}", file=sys.stderr)
        return []

    markets = data.get("markets", [])
    if not markets:
        print(f"  [kalshi] no markets in response", file=sys.stderr)
        return []

    signals = []
    for m in markets:
        title = (m.get("title") or "").strip()
        if not title:
            continue

        # Probability: yes_bid or last_price
        prob = None
        try:
            prob = float(m.get("yes_bid") or m.get("last_price") or 0.5)
            if prob > 1:  # Kalshi uses cents (0-100)
                prob = prob / 100
        except:
            prob = 0.5

        volume = float(m.get("volume") or m.get("dollar_volume") or 0)
        ticker = m.get("ticker", "")
        close_time = m.get("close_time", "")

        # Find best topic match
        best_topic, best_score = None, 0.0
        for topic, kws in TOPIC_KEYWORDS.items():
            s = score_text(title, kws)
            if s > 0.55 and s > best_score:
                best_topic, best_score = topic, s

        if not best_topic:
            continue

        stage = "accelerating" if (prob > 0.75 or prob < 0.25) else "emerging" if (prob > 0.6 or prob < 0.4) else "forming"

        signals.append({
            "topic":                best_topic,
            "signal_id":            f"kalshi_{ticker.lower().replace('-','_')[:20] if ticker else hash(title) & 0xFFFFFF:06x}",
            "confidence":           round(prob, 2),
            "stage":                stage,
            "evidence_count":       max(1, int(volume / 1000)),
            "sources":              ["kalshi"],
            "source_url":           f"https://kalshi.com/markets/{ticker}" if ticker else "https://kalshi.com",
            "category":             "Regulated Prediction Market",
            "proof_id":             f"kalshi-{datetime.date.today().isoformat()}-{ticker or hash(title) & 0xFFFF:04x}",
            "title":                title[:120],
            "kalshi_probability":   prob,
            "kalshi_volume_usd":    int(volume),
            "kalshi_ticker":        ticker,
            "kalshi_close_time":    close_time[:10] if close_time else "",
            "why_important":        f"Kalshi (regulated): {prob*100:.0f}% probability on \"{title[:70]}\" · ${int(volume):,} in volume",
            "next_to_watch":        f"Monitor probability change on Kalshi: {title[:60]}",
            "source_layer":         "L3",
            "source_tag":           "kalshi",
            "decision_type":        "regulated_prediction_market",
            "credibility_note":     "Kalshi is CFTC-regulated — higher institutional credibility than unregulated markets",
        })

    return signals

def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--dry-run", action="store_true")
    args = parser.parse_args()

    print(f"Kalshi Fetcher — {datetime.date.today().isoformat()}")
    signals = fetch_kalshi_signals()
    print(f"  Markets matched: {len(signals)}")

    for s in sorted(signals, key=lambda x: -x.get("kalshi_volume_usd", 0))[:10]:
        print(f"  [{s['topic']:<28}] p={s['confidence']:.2f} vol=${s.get('kalshi_volume_usd',0):>8,}  {s['title'][:55]}")

    if not args.dry_run and signals:
        import pathlib
        out = pathlib.Path(__file__).parent.parent / "output"
        out.mkdir(exist_ok=True)
        path = out / f"kalshi_signals_{datetime.date.today().isoformat()}.json"
        path.write_text(json.dumps({"signals": signals, "fetched_at": datetime.datetime.utcnow().isoformat()+"Z"}, indent=2, ensure_ascii=False))
        print(f"  ✓ Saved: {path}")

    return signals

if __name__ == "__main__":
    main()
