#!/usr/bin/env python3
"""
Polymarket Fetcher — Signal Market Source Layer L3 (Prediction Markets)
Free REST API, no key required.
Prediction market probabilities ARE the confidence signal.

Usage:
  python3 scripts/fetch_polymarket.py
  python3 scripts/fetch_polymarket.py --dry-run
"""
import sys, json, urllib.request, datetime, argparse

POLYMARKET_API = "https://gamma-api.polymarket.com/markets?closed=false&limit=100&order=volumeNum&ascending=false"

TOPIC_KEYWORDS = {
    "LLM Infrastructure":       ["gpt","claude","openai","anthropic","llm","language model","chatgpt","model release"],
    "AI Agents":                 ["ai agent","autonomous ai","copilot","ai assistant"],
    "AI Chips & Hardware":       ["nvidia","chip","gpu","semiconductor","h100","blackwell"],
    "Robotics & Embodied AI":    ["robot","humanoid","figure","boston dynamics","unitree"],
    "Commercial Space":          ["spacex","starship","rocket launch","nasa","iss","moon landing","mars"],
    "Autonomous Vehicles":       ["waymo","self-driving","tesla fsd","autonomous"],
    "AI Policy & Regulation":    ["ai regulation","ai ban","ai law","ai executive","ai legislation","openai lawsuit","anthropic"],
    "AI Investment & Capital":   ["openai valuation","ai funding","ai ipo","anthropic funding","series"],
    "Macro & Geopolitics":       ["fed rate","interest rate","recession","inflation","election","trump","china","tariff","war"],
    "Crypto & Digital Assets":   ["bitcoin","ethereum","crypto","btc","eth","defi","blockchain"],
    "US Politics":               ["trump","democrat","republican","senate","house","president","election","primary"],
}

def score_text(text: str, keywords: list[str]) -> float:
    text = text.lower()
    matches = sum(1 for kw in keywords if kw in text)
    return min(0.95, 0.4 + matches * 0.15)

def parse_probability(market: dict) -> float:
    """Extract best probability from market data."""
    # outcomePrices is array of string prices like ["0.73", "0.27"]
    prices = market.get("outcomePrices", [])
    if isinstance(prices, str):
        try: prices = json.loads(prices)
        except: prices = []
    if prices:
        try: return round(float(prices[0]), 3)
        except: pass
    # fallback: bestBid
    try: return round(float(market.get("bestBid", 0.5)), 3)
    except: return 0.5

def fetch_polymarket_signals() -> list[dict]:
    try:
        req = urllib.request.Request(POLYMARKET_API, headers={"User-Agent": "SignalMarket/1.0"})
        data = json.loads(urllib.request.urlopen(req, timeout=15).read())
    except Exception as e:
        print(f"  [polymarket] fetch error: {e}", file=sys.stderr)
        return []

    markets = data if isinstance(data, list) else data.get("markets", [])
    signals = []

    for m in markets:
        question = (m.get("question") or m.get("title") or "").strip()
        if not question: continue

        volume = float(m.get("volumeNum", 0) or m.get("volume", 0) or 0)
        if volume < 1000: continue  # Only markets with real liquidity

        prob = parse_probability(m)
        market_url = m.get("url") or f"https://polymarket.com/event/{m.get('conditionId','')}"
        condition_id = str(m.get("conditionId", ""))[:12]

        # Find best topic match
        best_topic, best_score = None, 0.0
        for topic, kws in TOPIC_KEYWORDS.items():
            s = score_text(question, kws)
            if s > 0.55 and s > best_score:
                best_topic, best_score = topic, s

        if not best_topic:
            continue  # Skip unrelated markets

        # Stage: prediction market confidence maps directly
        if prob < 0.2 or prob > 0.8:
            stage = "accelerating"    # High conviction
        elif prob < 0.35 or prob > 0.65:
            stage = "emerging"
        else:
            stage = "forming"         # Contested / uncertain

        signals.append({
            "topic":                  best_topic,
            "signal_id":              f"poly_{(condition_id or str(hash(question) & 0xFFFFFF)):06s}",
            "confidence":             round(prob, 2),
            "stage":                  stage,
            "evidence_count":         max(1, int(volume / 1000)),
            "sources":                ["polymarket"],
            "source_url":             market_url,
            "category":               "Prediction Market",
            "proof_id":               f"polymarket-{datetime.date.today().isoformat()}-{condition_id}",
            "title":                  question[:120],
            "polymarket_probability": prob,
            "polymarket_volume_usd":  int(volume),
            "why_important":          f"Prediction market: {prob*100:.0f}% probability on \"{question[:80]}\" — ${int(volume):,} in volume",
            "next_to_watch":          f"Monitor probability change on: {question[:60]}",
            "source_layer":           "L3",
            "source_tag":             "polymarket",
            "decision_type":          "prediction_market",
        })

    return signals

def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--dry-run", action="store_true")
    args = parser.parse_args()

    print(f"Polymarket Fetcher — {datetime.date.today().isoformat()}")
    signals = fetch_polymarket_signals()
    print(f"  Markets matched: {len(signals)}")

    for s in sorted(signals, key=lambda x: -x["polymarket_volume_usd"])[:10]:
        print(f"  [{s['topic']:<28}] p={s['confidence']} vol=${s['polymarket_volume_usd']:>8,}  {s['title'][:55]}")

    if not args.dry_run and signals:
        import pathlib
        out = pathlib.Path(__file__).parent.parent / "output"
        out.mkdir(exist_ok=True)
        path = out / f"polymarket_signals_{datetime.date.today().isoformat()}.json"
        path.write_text(json.dumps({"signals": signals, "fetched_at": datetime.datetime.utcnow().isoformat()+"Z"}, indent=2, ensure_ascii=False))
        print(f"  ✓ Saved: {path}")

    return signals

if __name__ == "__main__":
    main()
