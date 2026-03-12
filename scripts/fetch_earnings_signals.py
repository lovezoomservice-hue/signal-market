#!/usr/bin/env python3
"""
Earnings Signal Tracker — Signal Market Source Layer L5b
Fetches Yahoo Finance RSS feeds per ticker to detect AI-related news signals.
These represent market/investor attention signals — high quality L5b signals.

Usage:
  python3 scripts/fetch_earnings_signals.py
  python3 scripts/fetch_earnings_signals.py --dry-run
  python3 scripts/fetch_earnings_signals.py --tickers MSFT,NVDA,AAPL

Companies tracked: MSFT, NVDA, GOOG, META, AMZN, AAPL, TSM, TSLA, AMD, INTC, QCOM, CRM
Yahoo Finance RSS: https://finance.yahoo.com/rss/headline?s={TICKER}
"""
import sys
import json
import re
import ssl
import urllib.request
import datetime
import argparse
import random
import xml.etree.ElementTree as ET

_SSL_CTX = ssl.create_default_context()
_SSL_CTX.check_hostname = False
_SSL_CTX.verify_mode = ssl.CERT_NONE

# Tickers to track
TICKERS = [
    ("MSFT", "Microsoft", "AI Investment & Capital"),
    ("NVDA", "NVIDIA", "AI Chips & Hardware"),
    ("GOOG", "Alphabet", "AI Investment & Capital"),
    ("META", "Meta", "AI Investment & Capital"),
    ("AMZN", "Amazon", "AI Investment & Capital"),
    ("AAPL", "Apple", "AI Investment & Capital"),
    ("TSM", "TSMC", "AI Chips & Hardware"),
    ("TSLA", "Tesla", "AI Investment & Capital"),
    ("AMD", "AMD", "AI Chips & Hardware"),
    ("INTC", "Intel", "AI Chips & Hardware"),
    ("QCOM", "Qualcomm", "AI Chips & Hardware"),
    ("CRM", "Salesforce", "AI Investment & Capital"),
]

# AI keywords for scoring headlines
AI_KEYWORDS = [
    "ai", "artificial intelligence", "machine learning", "llm", "large language model",
    "generative", "gen ai", "copilot", "agentic", "neural", "gpu", "inference",
    "foundation model", "openai", "claude", "gemini", "chatgpt", "data center",
    "nvidia", "chips", "semiconductor", "compute"
]

# Minimum AI headlines to generate signal
MIN_AI_HEADLINES = 3


def fetch_url(url: str, timeout: int = 15) -> str:
    """Fetch URL content with user-agent rotation."""
    user_agents = [
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
        "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36",
        "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36",
    ]
    headers = {
        "User-Agent": random.choice(user_agents),
        "Accept": "application/rss+xml,application/xml,text/xml",
        "Accept-Language": "en-US,en;q=0.5",
    }
    req = urllib.request.Request(url, headers=headers)
    try:
        data = urllib.request.urlopen(req, context=_SSL_CTX, timeout=timeout).read()
        return data.decode("utf-8", errors="ignore")
    except Exception as e:
        print(f"  [fetch_earnings] URL fetch failed: {e}", file=sys.stderr)
        return ""


def count_ai_matches(text: str) -> int:
    """Count AI keyword matches in text."""
    text_lower = text.lower()
    count = 0
    for kw in AI_KEYWORDS:
        count += text_lower.count(kw.lower())
    return count


def fetch_yahoo_finance_headlines(ticker: str) -> list[dict]:
    """Fetch headlines from Yahoo Finance RSS for a ticker."""
    rss_url = f"https://finance.yahoo.com/rss/headline?s={ticker}"
    html = fetch_url(rss_url)

    if not html:
        return []

    headlines = []
    try:
        root = ET.fromstring(html)
        items = root.findall(".//item")[:20]  # Limit to 20 headlines

        for item in items:
            title = (item.findtext("title") or "").strip()
            link = (item.findtext("link") or "").strip()
            desc = (item.findtext("description") or "")[:500]
            pub_date = (item.findtext("pubDate") or "")

            if not title or len(title) < 5:
                continue

            headlines.append({
                "title": title,
                "link": link,
                "description": desc,
                "pub_date": pub_date,
            })
    except Exception as e:
        print(f"  [fetch_earnings] RSS parse failed for {ticker}: {e}", file=sys.stderr)

    return headlines


def generate_signal(ticker: str, company: str, topic: str, ai_headline_count: int) -> dict:
    """Generate a signal from AI headline analysis."""

    # Calculate confidence based on AI headline count
    confidence = min(0.50 + (ai_headline_count * 0.08), 0.90)

    # Determine stage based on count
    stage = "accelerating" if ai_headline_count >= 5 else "forming"

    return {
        "topic": topic,
        "signal_id": f"earn_{ticker}_{datetime.date.today().isoformat()}",
        "confidence": round(confidence, 2),
        "stage": stage,
        "evidence_count": ai_headline_count,
        "sources": ["yahoo_finance"],
        "source_url": f"https://finance.yahoo.com/quote/{ticker}",
        "category": "Financial Intelligence",
        "proof_id": f"earn-{ticker}-{datetime.date.today().isoformat()}",
        "title": f"{ticker}: {ai_headline_count} AI-related news items in current feed",
        "source_layer": "L5b",
        "source_tag": "finance_news",
        "company": ticker,
        "ai_headline_count": ai_headline_count,
    }


def fetch_earnings_signals(ticker_filter: list[str] | None = None) -> list[dict]:
    """
    Fetch and analyze Yahoo Finance headlines for AI mentions.
    Returns list of signals where AI headline count >= threshold.
    """
    all_signals = []

    tickers_to_process = TICKERS
    if ticker_filter:
        tickers_to_process = [(t, c, topic) for t, c, topic in TICKERS if t in ticker_filter]

    for ticker, company, topic in tickers_to_process:
        print(f"  Processing {company} ({ticker})...")

        try:
            headlines = fetch_yahoo_finance_headlines(ticker)

            if not headlines:
                print(f"    No headlines found for {ticker}")
                continue

            # Count AI-related headlines
            ai_headline_count = 0
            for headline in headlines:
                text = f"{headline['title']} {headline['description']}"
                if count_ai_matches(text) > 0:
                    ai_headline_count += 1

            print(f"    {ai_headline_count}/{len(headlines)} headlines are AI-related")

            # Generate signal if threshold met
            if ai_headline_count >= MIN_AI_HEADLINES:
                signal = generate_signal(ticker, company, topic, ai_headline_count)
                all_signals.append(signal)
                print(f"    ✓ Signal generated (confidence: {signal['confidence']}, stage: {signal['stage']})")

        except Exception as e:
            print(f"  [fetch_earnings] Error processing {ticker}: {e}", file=sys.stderr)
            continue

    return all_signals


def main():
    parser = argparse.ArgumentParser(description="Earnings Signal Tracker (Yahoo Finance)")
    parser.add_argument("--dry-run", action="store_true", help="Fetch but don't write files")
    parser.add_argument("--tickers", default="",
                        help="Comma-separated ticker symbols to filter (e.g., MSFT,NVDA)")
    args = parser.parse_args()

    # Parse ticker filter
    ticker_filter = None
    if args.tickers:
        ticker_filter = [t.strip().upper() for t in args.tickers.split(",")]

    print(f"Earnings Signals Fetcher (Yahoo Finance) — {datetime.date.today().isoformat()}")
    signals = fetch_earnings_signals(ticker_filter=ticker_filter)

    print(f"\n  Signals generated: {len(signals)}")

    for sig in signals:
        print(f"  [{sig['company']}] {sig['title'][:60]}...")

    if not args.dry_run and signals:
        import pathlib
        out = pathlib.Path(__file__).parent.parent / "output"
        out.mkdir(exist_ok=True)
        path = out / f"earnings_signals_{datetime.date.today().isoformat()}.json"
        path.write_text(json.dumps({
            "signals": signals,
            "fetched_at": datetime.datetime.utcnow().isoformat() + "Z",
            "tickers_tracked": [t[0] for t in ([(t, c, topic) for t, c, topic in TICKERS if ticker_filter is None or t in ticker_filter])],
        }, indent=2, ensure_ascii=False))
        print(f"  ✓ Saved: {path}")

    return signals


if __name__ == "__main__":
    main()
