#!/usr/bin/env python3
"""
Political Narrative Signal Tracker — Signal Market Source Layer L4
Tracks political narrative signals that affect tech/AI markets (tariffs, AI policy, funding).
Truth Social does not have a public RSS, so we use alternative public sources.

Usage:
  python3 scripts/fetch_political_signals.py
  python3 scripts/fetch_political_signals.py --dry-run
  python3 scripts/fetch_political_signals.py --sources whitehouse,reuters

Sources:
  - White House news RSS: https://www.whitehouse.gov/feed/
  - Congress.gov recent bills: https://www.congress.gov/rss/legislation.xml
  - Reuters Politics RSS: https://feeds.reuters.com/reuters/politicsNews
  - AP Politics (via RSSHub): https://rsshub.app/apnews/topics/politics
"""
import sys
import json
import re
import ssl
import urllib.request
import datetime
import argparse
import time
import xml.etree.ElementTree as ET

_SSL_CTX = ssl.create_default_context()
_SSL_CTX.check_hostname = False
_SSL_CTX.verify_mode = ssl.CERT_NONE

# ── Political RSS Feeds ───────────────────────────────────────────────────────
POLITICAL_FEEDS = [
    ("https://thehill.com/policy/technology/feed/",         "thehill_tech",  "The Hill Tech Policy"),
    ("https://search.cnbc.com/rs/search/combinedcms/view.xml?partnerId=wrss01&id=19854910", "cnbc_tech", "CNBC Technology"),
    ("https://api.axios.com/feed/",                         "axios",         "Axios"),
    ("https://feeds.marketwatch.com/marketwatch/topstories/", "marketwatch", "MarketWatch"),
]

# ── Topic keyword matching for political signals ──────────────────────────────
POLITICAL_TOPIC_KEYWORDS = {
    "AI Policy & Governance": [
        "ai", "artificial intelligence", "openai", "anthropic", "chip", "semiconductor",
        "export control", "regulation", "legislation", "executive order", "microsoft",
        "google", "nvidia", "tech", "technology", "tariff"
    ],
    "Macro & Geopolitics": [
        "tariff", "trade", "china", "fed", "federal reserve", "rate", "inflation",
        "gdp", "recession", "deficit", "debt", "sanction", "war", "geopolitical",
        "oil", "energy"
    ],
    "AI Investment & Capital": [
        "ipo", "funding", "raise", "acquisition", "merger", "deal", "billion",
        "million", "venture", "nasdaq", "stock", "market", "earnings"
    ],
    "Commercial Space": [
        "space", "faa", "spacex", "satellite", "launch", "nasa", "rocket",
        "space force", "orbital", "space economy"
    ],
}


def score_relevance(text: str, keywords: list[str]) -> float:
    """Score text relevance based on keyword matches."""
    text_lower = text.lower()
    matches = sum(1 for kw in keywords if kw.lower() in text_lower)
    # Base score 0.3, add 0.15 per match, cap at 0.92
    return min(0.92, 0.30 + matches * 0.15)


def fetch_rss_feed(url: str, source_id: str, source_name: str) -> list[dict]:
    """Fetch and parse RSS feed, returning items that match political topics."""
    try:
        req = urllib.request.Request(
            url,
            headers={
                "User-Agent": "Mozilla/5.0 SignalMarket/1.0 Political Tracker",
                "Accept": "application/rss+xml,application/xml,text/xml",
            }
        )
        data = urllib.request.urlopen(req, context=_SSL_CTX, timeout=15).read()
        root = ET.fromstring(data)

        # Try Atom first, then RSS
        ns_atom = {"atom": "http://www.w3.org/2005/Atom"}
        entries = root.findall("atom:entry", ns_atom)
        is_atom = len(entries) > 0

        signals = []
        items = entries if is_atom else root.findall(".//item")[:30]

        for item in items[:30]:
            if is_atom:
                title_el = item.find("atom:title", ns_atom)
                link_el = item.find("atom:link", ns_atom)
                desc_el = item.find("atom:summary", ns_atom) or item.find("atom:content", ns_atom)
                pub_el = item.find("atom:published", ns_atom) or item.find("atom:updated", ns_atom)
                title = (title_el.text if title_el is not None else "").strip()
                link = (link_el.get("href") if link_el is not None else "") or ""
                desc = (desc_el.text if desc_el is not None else "")[:500]
                pub_date = (pub_el.text if pub_el is not None else "") if pub_el is not None else ""
            else:
                title = (item.findtext("title") or "").strip()
                link = (item.findtext("link") or "").strip()
                desc = (item.findtext("description") or "")[:500]
                pub_date = (item.findtext("pubDate") or "")

            if not title or len(title) < 5:
                continue

            # Combine title and description for matching
            text = f"{title} {desc}"
            # Strip HTML tags
            text = re.sub(r'<[^>]+>', ' ', text)

            # Find best matching topic
            best_topic, best_score = None, 0.0
            for topic, kws in POLITICAL_TOPIC_KEYWORDS.items():
                score = score_relevance(text, kws)
                if score > 0.45 and score > best_score:
                    best_topic, best_score = topic, score

            if not best_topic:
                continue

            # Calculate confidence based on score and source credibility
            source_credibility = {
                "whitehouse": 0.95,
                "congress": 0.90,
                "reuters_pol": 0.85,
                "ap_politics": 0.85,
            }.get(source_id, 0.75)

            confidence = round(min(best_score * 0.8 + source_credibility * 0.2, 0.92), 2)

            # Determine stage based on confidence
            stage = "accelerating" if confidence >= 0.75 else "forming" if confidence >= 0.60 else "emerging"

            # Determine urgency based on topic
            urgency_map = {
                "AI Policy & Governance": "high",
                "Macro & Geopolitics": "medium",
                "AI Investment & Capital": "high",
                "Commercial Space": "medium",
            }
            urgency = urgency_map.get(best_topic, "medium")

            signals.append({
                "topic": best_topic,
                "signal_id": f"pol_{source_id}_{hash(title) & 0xFFFFFF:06x}",
                "confidence": confidence,
                "stage": stage,
                "evidence_count": 1,
                "sources": [source_id],
                "source_url": link or f"https://signal-market-z14d.vercel.app",
                "category": "Political Narrative",
                "proof_id": f"pol-{source_id}-{datetime.date.today().isoformat()}-{hash(title) & 0xFFFF:04x}",
                "title": title[:150],
                "source_name": source_name,
                "why_important": f"[{source_name}] {title[:100]} — political/policy signal affecting tech markets",
                "source_layer": "L4",
                "source_tag": "political",
                "urgency": urgency,
                "published_date": pub_date,
            })

        return signals

    except Exception as e:
        print(f"  [political] {source_id}: {e}", file=sys.stderr)
        return []


def fetch_political_signals(source_filter: list[str] | None = None) -> list[dict]:
    """Fetch political narrative signals from all configured sources."""
    all_signals = []

    for url, source_id, name in POLITICAL_FEEDS:
        if source_filter and source_id not in source_filter:
            continue

        print(f"  Fetching {name}...")
        sigs = fetch_rss_feed(url, source_id, name)
        all_signals.extend(sigs)

        if sigs:
            print(f"    {len(sigs)} signals matched")
            time.sleep(0.3)  # Rate limiting
        else:
            print(f"    No signals matched")

    return all_signals


def main():
    parser = argparse.ArgumentParser(description="Political Narrative Signal Tracker")
    parser.add_argument("--dry-run", action="store_true", help="Fetch but don't write files")
    parser.add_argument("--sources", default="",
                        help="Comma-separated source IDs to filter (e.g., whitehouse,reuters)")
    args = parser.parse_args()

    source_filter = [s.strip() for s in args.sources.split(",") if s.strip()] or None

    print(f"Political Signals Fetcher — {datetime.date.today().isoformat()}")
    signals = fetch_political_signals(source_filter=source_filter)

    print(f"\n  Total signals: {len(signals)}")

    # Group by topic
    by_topic: dict[str, list] = {}
    for s in signals:
        by_topic.setdefault(s["topic"], []).append(s)

    for topic, items in sorted(by_topic.items(), key=lambda x: -len(x[1])):
        top = max(items, key=lambda x: x["confidence"])
        print(f"  [{topic:<25}] {len(items):>2} signals  [{top['source_name']}] {top['title'][:50]}")

    if not args.dry_run and signals:
        import pathlib
        out = pathlib.Path(__file__).parent.parent / "output"
        out.mkdir(exist_ok=True)
        path = out / f"political_signals_{datetime.date.today().isoformat()}.json"
        path.write_text(json.dumps({
            "signals": signals,
            "fetched_at": datetime.datetime.utcnow().isoformat() + "Z",
            "sources": source_filter or [s[1] for s in POLITICAL_FEEDS],
        }, indent=2, ensure_ascii=False))
        print(f"  ✓ Saved: {path}")

    return signals


if __name__ == "__main__":
    main()
