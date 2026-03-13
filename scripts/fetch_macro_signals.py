#!/usr/bin/env python3
"""
Macro/Market Signal Layer (L3b) Fetcher — Signal Market
Tracks macroeconomic and financial market signals affecting AI investment decisions.

Sources:
  - Yahoo Finance RSS per ticker: MSFT, NVDA, GOOG, META, AMZN, AMD
  - MarketWatch top stories: https://feeds.marketwatch.com/marketwatch/topstories/
  - CNBC Technology: https://search.cnbc.com/rs/search/combinedcms/view.xml?partnerId=wrss01&id=19854910

Signal Topics:
  - "AI Investment & Capital": funding/M&A/IPO keywords
  - "AI Chips & Custom Silicon": NVDA/AMD/TSMC/chip/semiconductor headlines
  - "Macro & Geopolitics": fed/rate/inflation/tariff/china/trade keywords

Usage:
  python3 scripts/fetch_macro_signals.py
  python3 scripts/fetch_macro_signals.py --dry-run
  python3 scripts/fetch_macro_signals.py --sources yahoo,marketwatch,cnbc
"""

import sys
import json
import re
import ssl
import datetime
import argparse
import xml.etree.ElementTree as ET
import urllib.request
from pathlib import Path

ROOT = Path(__file__).parent.parent
OUTPUT = ROOT / "output"
HISTORY = ROOT / "data" / "signals_history.jsonl"

_SSL_CTX = ssl.create_default_context()
_SSL_CTX.check_hostname = False
_SSL_CTX.verify_mode = ssl.CERT_NONE

# ── RSS Feed Sources ──────────────────────────────────────────────────────────
YAHOO_TICKERS = ["MSFT", "NVDA", "GOOG", "META", "AMZN", "AMD"]
YAHOO_RSS_TEMPLATE = "https://finance.yahoo.com/rss/headline?s={ticker}"

MARKETWATCH_RSS = "https://feeds.marketwatch.com/marketwatch/topstories/"
CNBC_TECH_RSS = "https://search.cnbc.com/rs/search/combinedcms/view.xml?partnerId=wrss01&id=19854910"

# ── Topic keyword matching ────────────────────────────────────────────────────
TOPIC_KEYWORDS = {
    "AI Investment & Capital": [
        "funding", "investment", "capex", "capital", "raise", "round", "ipo",
        "acquisition", "m&a", "merger", "valuation", "venture", "private equity",
        "earnings beat", "revenue growth", "guidance raise", "outlook raise"
    ],
    "AI Chips & Custom Silicon": [
        "chip", "semiconductor", "nvidia", "nvda", "amd", "tsmc", "intel",
        "gpu", "accelerator", "asic", "custom silicon", "ai chip", "h100",
        "blackwell", "h200", "mi300", "inferencing", "data center chip"
    ],
    "Macro & Geopolitics": [
        "fed", "interest rate", "inflation", "cpi", "fomc", "powell",
        "tariff", "china", "trade war", "export control", "sanction",
        "geopolitical", "recession", "economic slowdown", "gdp", "treasury"
    ],
}

# Ticker to topic mapping
TICKER_TOPICS = {
    "NVDA": "AI Chips & Custom Silicon",
    "AMD": "AI Chips & Custom Silicon",
    "MSFT": "AI Investment & Capital",
    "GOOG": "AI Investment & Capital",
    "META": "AI Investment & Capital",
    "AMZN": "AI Investment & Capital",
}

def score_relevance(text: str, keywords: list[str]) -> float:
    """Score text relevance against keywords."""
    text = text.lower()
    matches = sum(1 for kw in keywords if kw in text)
    if matches == 0:
        return 0.0
    return min(0.95, 0.45 + matches * 0.15)

def fetch_rss_feed(url: str, source_id: str, source_name: str, timeout: int = 8) -> list[dict]:
    """Fetch and parse RSS feed."""
    try:
        req = urllib.request.Request(url, headers={"User-Agent": "Mozilla/5.0 SignalMarket/1.0"})
        data = urllib.request.urlopen(req, context=_SSL_CTX, timeout=timeout).read()
        root = ET.fromstring(data)

        # Try Atom first, then RSS
        ns_atom = {"atom": "http://www.w3.org/2005/Atom"}
        entries = root.findall("atom:entry", ns_atom)
        is_atom = len(entries) > 0

        signals = []
        items = entries[:15] if is_atom else root.findall(".//item")[:15]

        for item in items:
            if is_atom:
                title_el = item.find("atom:title", ns_atom)
                link_el = item.find("atom:link", ns_atom)
                desc_el = item.find("atom:summary", ns_atom) or item.find("atom:content", ns_atom)
                title = (title_el.text if title_el is not None else "").strip()
                link = (link_el.get("href") if link_el is not None else "") or ""
                desc = (desc_el.text if desc_el is not None else "")[:300] if desc_el is not None else ""
            else:
                title = (item.findtext("title") or "").strip()
                link = (item.findtext("link") or "").strip()
                desc = (item.findtext("description") or "")[:300]

            if not title or len(title) < 5:
                continue

            text = f"{title} {desc}".lower()
            text = re.sub(r'<[^>]+>', ' ', text)

            # Find best matching topic
            best_topic, best_score = None, 0.0
            for topic, kws in TOPIC_KEYWORDS.items():
                s = score_relevance(text, kws)
                if s > 0.50 and s > best_score:
                    best_topic, best_score = topic, s

            if not best_topic:
                continue

            conf = round(min(0.85, best_score + 0.10), 2)
            stage = "emerging" if conf < 0.65 else "forming" if conf < 0.75 else "accelerating"

            signals.append({
                "topic": best_topic,
                "signal_id": f"macro_{source_id}_{hash(title) & 0xFFFFFF:06x}",
                "confidence": conf,
                "stage": stage,
                "evidence_count": 1,
                "sources": [source_id],
                "source_url": link or "https://signal-market-z14d.vercel.app",
                "category": "Macro Intelligence",
                "proof_id": f"macro-{source_id}-{datetime.date.today().isoformat()}-{hash(title) & 0xFFFF:04x}",
                "title": title[:140],
                "source_name": source_name,
                "source_layer": "L3b",
                "source_tag": "macro",
                "published_at": datetime.datetime.now(datetime.timezone.utc).isoformat().replace("+00:00", "Z"),
            })

        return signals

    except Exception as e:
        print(f"  [macro] {source_id}: {e}", file=sys.stderr)
        return []

def fetch_yahoo_finance_signals() -> list[dict]:
    """Fetch signals from Yahoo Finance RSS feeds."""
    all_signals = []
    bullish_by_topic = {}
    total_by_topic = {}

    for ticker in YAHOO_TICKERS:
        url = YAHOO_RSS_TEMPLATE.format(ticker=ticker)
        signals = fetch_rss_feed(url, f"yahoo_{ticker.lower()}", f"Yahoo Finance ({ticker})")

        for s in signals:
            topic = s["topic"]
            if topic not in total_by_topic:
                total_by_topic[topic] = 0
                bullish_by_topic[topic] = 0
            total_by_topic[topic] += 1
            # Consider positive sentiment as bullish
            if any(w in s["title"].lower() for w in ["beat", "surge", "growth", "raise", "gain", "up", "bullish"]):
                bullish_by_topic[topic] += 1

        all_signals.extend(signals)

    # Aggregate by topic with headline counts
    aggregated = {}
    for topic in total_by_topic.keys():
        topic_signals = [s for s in all_signals if s["topic"] == topic]
        if not topic_signals:
            continue

        top_signal = max(topic_signals, key=lambda x: x["confidence"])
        headline_count = total_by_topic[topic]
        bullish_count = bullish_by_topic.get(topic, 0)

        aggregated[topic] = {
            "topic": topic,
            "signal_id": f"macro_yahoo_{topic.lower().replace(' ', '_')}_{datetime.date.today().isoformat()}",
            "confidence": top_signal["confidence"],
            "stage": top_signal["stage"],
            "evidence_count": headline_count,
            "sources": list(set(s["sources"][0] for s in topic_signals)),
            "source_url": top_signal["source_url"],
            "category": "Macro Intelligence",
            "source_layer": "L3b",
            "source_tag": "macro",
            "title": f"{topic}: {headline_count} market signals in last 24h ({', '.join(YAHOO_TICKERS[:3])})",
            "headline_count": headline_count,
            "bullish_count": bullish_count,
            "bearish_count": headline_count - bullish_count,
            "published_at": datetime.datetime.now(datetime.timezone.utc).isoformat().replace("+00:00", "Z"),
        }

    return list(aggregated.values())

def fetch_marketwatch_signals() -> list[dict]:
    """Fetch signals from MarketWatch top stories."""
    signals = fetch_rss_feed(MARKETWATCH_RSS, "marketwatch", "MarketWatch")

    # Aggregate by topic
    by_topic = {}
    for s in signals:
        topic = s["topic"]
        if topic not in by_topic:
            by_topic[topic] = []
        by_topic[topic].append(s)

    result = []
    for topic, topic_signals in by_topic.items():
        top = max(topic_signals, key=lambda x: x["confidence"])
        result.append({
            "topic": topic,
            "signal_id": f"macro_marketwatch_{topic.lower().replace(' ', '_')}_{datetime.date.today().isoformat()}",
            "confidence": top["confidence"],
            "stage": top["stage"],
            "evidence_count": len(topic_signals),
            "sources": ["marketwatch"],
            "source_url": top["source_url"],
            "category": "Macro Intelligence",
            "source_layer": "L3b",
            "source_tag": "macro",
            "title": f"{topic}: MarketWatch tracking {len(topic_signals)} relevant headlines",
            "headline_count": len(topic_signals),
            "published_at": datetime.datetime.now(datetime.timezone.utc).isoformat().replace("+00:00", "Z"),
        })

    return result

def fetch_cnbc_signals() -> list[dict]:
    """Fetch signals from CNBC Technology RSS."""
    signals = fetch_rss_feed(CNBC_TECH_RSS, "cnbc", "CNBC Technology")

    # Aggregate by topic
    by_topic = {}
    for s in signals:
        topic = s["topic"]
        if topic not in by_topic:
            by_topic[topic] = []
        by_topic[topic].append(s)

    result = []
    for topic, topic_signals in by_topic.items():
        top = max(topic_signals, key=lambda x: x["confidence"])
        result.append({
            "topic": topic,
            "signal_id": f"macro_cnbc_{topic.lower().replace(' ', '_')}_{datetime.date.today().isoformat()}",
            "confidence": top["confidence"],
            "stage": top["stage"],
            "evidence_count": len(topic_signals),
            "sources": ["cnbc"],
            "source_url": top["source_url"],
            "category": "Macro Intelligence",
            "source_layer": "L3b",
            "source_tag": "macro",
            "title": f"{topic}: CNBC tracking {len(topic_signals)} tech market developments",
            "headline_count": len(topic_signals),
            "published_at": datetime.datetime.now(datetime.timezone.utc).isoformat().replace("+00:00", "Z"),
        })

    return result

def fetch_macro_signals(source_filter: list[str] | None = None) -> list[dict]:
    """Fetch all macro signals from enabled sources."""
    all_signals = []

    # Yahoo Finance (tickers)
    if not source_filter or "yahoo" in source_filter:
        try:
            sigs = fetch_yahoo_finance_signals()
            all_signals.extend(sigs)
            print(f"  Yahoo Finance:  {len(sigs)} signals")
        except Exception as e:
            print(f"  Yahoo Finance ERROR: {e}", file=sys.stderr)

    # MarketWatch
    if not source_filter or "marketwatch" in source_filter:
        try:
            sigs = fetch_marketwatch_signals()
            all_signals.extend(sigs)
            print(f"  MarketWatch:    {len(sigs)} signals")
        except Exception as e:
            print(f"  MarketWatch ERROR: {e}", file=sys.stderr)

    # CNBC
    if not source_filter or "cnbc" in source_filter:
        try:
            sigs = fetch_cnbc_signals()
            all_signals.extend(sigs)
            print(f"  CNBC:           {len(sigs)} signals")
        except Exception as e:
            print(f"  CNBC ERROR: {e}", file=sys.stderr)

    return all_signals

def merge_signals(signals: list[dict]) -> list[dict]:
    """Merge signals by topic, combining sources."""
    merged = {}
    for s in signals:
        topic = s["topic"]
        if topic not in merged:
            merged[topic] = s.copy()
            merged[topic]["_sources_list"] = list(s["sources"])
        else:
            existing = merged[topic]
            for src in s["sources"]:
                if src not in existing["_sources_list"]:
                    existing["_sources_list"].append(src)
            existing["evidence_count"] = existing.get("evidence_count", 0) + s.get("evidence_count", 1)
            if s["confidence"] > existing["confidence"]:
                existing["confidence"] = s["confidence"]
                existing["source_url"] = s["source_url"]

    for s in merged.values():
        s["sources"] = s.pop("_sources_list")
        s["source_count"] = len(s["sources"])

    return list(merged.values())

def main():
    parser = argparse.ArgumentParser(description="Macro/Market Signal Layer (L3b) Fetcher")
    parser.add_argument("--dry-run", action="store_true", help="Fetch but don't write files")
    parser.add_argument("--sources", default="", help="Comma-separated sources: yahoo,marketwatch,cnbc")
    args = parser.parse_args()

    source_filter = [s.strip() for s in args.sources.split(",") if s.strip()] or None

    today = datetime.date.today().isoformat()
    now = datetime.datetime.utcnow().isoformat() + "Z"

    print(f"Macro Signal Fetcher (L3b) — {today}")

    signals = fetch_macro_signals(source_filter=source_filter)
    merged = merge_signals(signals)

    print(f"\n  Total raw: {len(signals)} → merged: {len(merged)} unique topics")

    for s in merged:
        print(f"  [{s['topic']:<30}] conf={s['confidence']:.2f} stage={s['stage']} sources={','.join(s['sources'])}")

    if not args.dry_run and merged:
        OUTPUT.mkdir(exist_ok=True)

        # Save daily macro signals file
        daily_path = OUTPUT / f"macro_signals_{today}.json"
        daily_path.write_text(json.dumps({
            "fetched_at": now,
            "layer": "L3b",
            "sources": source_filter or ["yahoo", "marketwatch", "cnbc"],
            "total_raw": len(signals),
            "merged_count": len(merged),
            "signals": merged,
        }, indent=2, ensure_ascii=False))
        print(f"  ✓ Saved: {daily_path}")

        # Append to JSONL history
        HISTORY.parent.mkdir(exist_ok=True)
        with HISTORY.open("a", encoding="utf-8") as f:
            for s in merged:
                f.write(json.dumps(s, ensure_ascii=False) + "\n")
        print(f"  ✓ Appended {len(merged)} records to signals_history.jsonl")

    print(f"\n{'[DRY_RUN] ' if args.dry_run else ''}✅ Macro signals complete: {len(merged)} topics")
    return merged

if __name__ == "__main__":
    main()
