#!/usr/bin/env python3
"""
Earnings Transcript AI Keyword Tracker — Signal Market Source Layer L5b
Scrapes public earnings call summaries/transcripts from Motley Fool to extract AI-mention signals.
These represent institutional capital deployment decisions — highest quality L5 signals.

Usage:
  python3 scripts/fetch_earnings_signals.py
  python3 scripts/fetch_earnings_signals.py --dry-run
  python3 scripts/fetch_earnings_signals.py --companies MSFT,NVDA,AAPL

Companies tracked: MSFT, NVDA, GOOG, META, AMZN, AAPL, TSM, TSLA

Motley Fool earnings pages (public, no auth):
- Main listing: https://www.fool.com/earnings-call-transcripts/
- Company search: https://www.fool.com/search#q={TICKER}+earnings+transcript
"""
import sys
import json
import re
import ssl
import urllib.request
import datetime
import argparse
import random
import time
from html import unescape

_SSL_CTX = ssl.create_default_context()
_SSL_CTX.check_hostname = False
_SSL_CTX.verify_mode = ssl.CERT_NONE

# Companies to track
COMPANIES = [
    ("MSFT", "Microsoft"),
    ("NVDA", "NVIDIA"),
    ("GOOG", "Alphabet"),
    ("META", "Meta"),
    ("AMZN", "Amazon"),
    ("AAPL", "Apple"),
    ("TSM", "TSMC"),
    ("TSLA", "Tesla"),
]

# AI keywords to scan for
AI_KEYWORDS = [
    "artificial intelligence", "ai ", " ai,", " ai.", " ai!",
    "machine learning", "llm", "large language model",
    "generative ai", "gen ai", "copilot", "agentic", "ai agent",
    "neural network", "gpu", "inference", "foundation model",
    "openai", "claude", "gemini",
]

# AI keyword density threshold (mentions per 1000 words)
DENSITY_THRESHOLD = 0.5  # 5+ mentions per 1000 words


def strip_html(html: str) -> str:
    """Remove HTML tags from text."""
    text = re.sub(r'<[^>]+>', ' ', html)
    text = unescape(text)
    text = re.sub(r'\s+', ' ', text)
    return text.strip()


def fetch_url(url: str, timeout: int = 15) -> str:
    """Fetch URL content with user-agent rotation."""
    user_agents = [
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
        "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36",
        "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36",
    ]
    headers = {
        "User-Agent": random.choice(user_agents),
        "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
        "Accept-Language": "en-US,en;q=0.5",
    }
    req = urllib.request.Request(url, headers=headers)
    try:
        data = urllib.request.urlopen(req, context=_SSL_CTX, timeout=timeout).read()
        return data.decode("utf-8", errors="ignore")
    except Exception as e:
        print(f"  [fetch_earnings] URL fetch failed: {e}", file=sys.stderr)
        return ""


def count_word_matches(text: str, keywords: list[str]) -> tuple[int, float]:
    """Count keyword mentions and calculate density per 1000 words."""
    text_lower = text.lower()
    words = text_lower.split()
    word_count = len(words)

    if word_count == 0:
        return 0, 0.0

    mention_count = 0
    for kw in keywords:
        mention_count += text_lower.count(kw.lower())

    density = (mention_count / word_count) * 1000
    return mention_count, round(density, 2)


def fetch_motley_fool_transcripts(company_ticker: str) -> list[dict]:
    """
    Fetch earnings transcripts from Motley Fool for a given company.
    Returns list of transcript data dicts.
    """
    transcripts = []

    # Try main earnings transcripts listing page
    main_url = "https://www.fool.com/earnings-call-transcripts/"
    html = fetch_url(main_url)

    if not html:
        # Try company-specific search page
        search_url = f"https://www.fool.com/search/#q={company_ticker}+earnings+call+transcript"
        html = fetch_url(search_url)

    if not html:
        return transcripts

    # Extract transcript links from HTML
    # Pattern: look for links containing earnings/transcript keywords
    pattern = r'href=["\'](https://www\.fool\.com/earnings-call-transcripts/[^"\']+)[\"\']'
    matches = re.findall(pattern, html, re.IGNORECASE)

    # Also try to find company-specific transcripts
    company_pattern = rf'href=["\'](https://www\.fool\.com/[^"\']*{company_ticker.lower()}[^"\']*transcript[^"\']*)[\"\']'
    company_matches = re.findall(company_pattern, html, re.IGNORECASE)

    all_urls = list(set(matches + company_matches))[:10]  # Limit to 10

    for url in all_urls:
        # Check if this transcript is for our company
        if company_ticker.lower() not in url.lower():
            continue

        transcript_html = fetch_url(url)
        if not transcript_html:
            continue

        # Extract title
        title_match = re.search(r'<title>([^<]+)</title>', transcript_html)
        title = title_match.group(1) if title_match else f"{company_ticker} Earnings Transcript"

        # Extract content (main article body)
        content_match = re.search(r'<article[^>]*>(.*?)</article>', transcript_html, re.DOTALL)
        if content_match:
            content = strip_html(content_match.group(1))
        else:
            # Try fallback: extract from main content div
            content_match = re.search(r'<div[^>]*class="[^"]*content[^"]*"[^>]*>(.*?)</div>', transcript_html, re.DOTALL)
            content = strip_html(content_match.group(1)) if content_match else strip_html(transcript_html)

        if len(content) < 200:  # Skip very short content
            continue

        transcripts.append({
            "url": url,
            "title": title[:200],
            "content": content[:10000],  # Limit content length
        })

    return transcripts


def generate_signal(company_ticker: str, company_name: str, transcript: dict,
                    mention_count: int, density: float) -> dict:
    """Generate a signal from earnings transcript analysis."""

    # Extract quarter/year from title if possible
    quarter_match = re.search(r'Q(\d+)\s+(\d{4})', transcript["title"])
    quarter = quarter_match.group(1) if quarter_match else "Unknown"
    year = quarter_match.group(2) if quarter_match else "2026"

    # Determine stage based on density
    stage = "accelerating" if density > 2.0 else "forming"

    # Calculate confidence based on density
    confidence = min(0.5 + density * 0.3, 0.92)

    return {
        "topic": "AI Investment & Capital",
        "signal_id": f"earn_{company_ticker}_{hash(transcript['url']) & 0xFFFFFF:06x}",
        "confidence": round(confidence, 2),
        "stage": stage,
        "evidence_count": 1,
        "sources": ["earnings_transcript"],
        "source_url": transcript["url"],
        "category": "Earnings Intelligence",
        "proof_id": f"earn-{company_ticker}-{quarter}-{year}",
        "title": f"{company_name} Q{quarter} {year} earnings: {mention_count} AI mentions ({density:.1f}/1000 words)",
        "source_layer": "L5b",
        "source_tag": "earnings",
        "company": company_ticker,
        "company_name": company_name,
        "ai_mention_count": mention_count,
        "ai_density": density,
        "quarter": quarter,
        "year": year,
        "impact_score": round(min(0.5 + density * 0.15, 0.95), 2),
    }


def fetch_earnings_signals(companies: list[tuple] | None = None) -> list[dict]:
    """
    Fetch and analyze earnings transcripts for AI mentions.
    Returns list of signals where AI density exceeds threshold.
    """
    if companies is None:
        companies = COMPANIES

    all_signals = []

    for ticker, name in companies:
        print(f"  Processing {name} ({ticker})...")

        try:
            transcripts = fetch_motley_fool_transcripts(ticker)

            if not transcripts:
                print(f"    No transcripts found for {ticker}")
                continue

            for transcript in transcripts:
                mention_count, density = count_word_matches(transcript["content"], AI_KEYWORDS)

                if density >= DENSITY_THRESHOLD:
                    signal = generate_signal(ticker, name, transcript, mention_count, density)
                    all_signals.append(signal)
                    print(f"    Signal: {mention_count} mentions, density {density:.1f}/1000 words")

            # Rate limiting between companies
            time.sleep(0.5)

        except Exception as e:
            print(f"  [fetch_earnings] Error processing {ticker}: {e}", file=sys.stderr)
            continue

    return all_signals


def main():
    parser = argparse.ArgumentParser(description="Earnings Transcript AI Keyword Tracker")
    parser.add_argument("--dry-run", action="store_true", help="Fetch but don't write files")
    parser.add_argument("--companies", default="",
                        help="Comma-separated company tickers to filter (e.g., MSFT,NVDA)")
    args = parser.parse_args()

    # Parse company filter
    company_filter = None
    if args.companies:
        tickers = [t.strip().upper() for t in args.companies.split(",")]
        company_filter = [(t, n) for t, n in COMPANIES if t in tickers]

    print(f"Earnings Signals Fetcher — {datetime.date.today().isoformat()}")
    signals = fetch_earnings_signals(companies=company_filter)

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
            "companies_tracked": [c[0] for c in (company_filter or COMPANIES)],
        }, indent=2, ensure_ascii=False))
        print(f"  ✓ Saved: {path}")

    return signals


if __name__ == "__main__":
    main()
