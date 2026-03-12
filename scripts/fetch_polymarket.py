#!/usr/bin/env python3
"""
fetch_polymarket.py — Polymarket prediction market fetcher (Tier L3, FREE)

Fetches AI/tech prediction markets from Polymarket.
No API key required — uses public REST API.

API: https://polymarket.com/api
"""

import json
import sys
import urllib.request
from datetime import datetime
from pathlib import Path

ROOT = Path(__file__).parent.parent
OUTPUT = ROOT / "output"

# Polymarket API endpoints
POLYMARKET_API = 'https://gamma-api.polymarket.com'

# Topic categories on Polymarket
CATEGORIES = [
    'Technology',
    'Science',
    'Crypto',
    'Business',
]

# Topic keyword mapping for market titles
TOPIC_KEYWORDS = {
    'Crypto & AI': ['crypto', 'blockchain', 'defi', 'token', 'ethereum', 'bitcoin'],
    'Tech Companies': ['openai', 'google', 'microsoft', 'meta', 'anthropic', 'apple', 'amazon', 'tesla'],
    'AI Regulation': ['regulation', 'policy', 'governance', 'sec', 'ftc', 'lawsuit', 'ban'],
    'AI Chips & Hardware': ['nvidia', 'amd', 'intel', 'semiconductor', 'chip', 'gpu'],
    'AI Coding': ['code', 'programming', 'software', 'developer', 'github'],
    'AI Agents': ['autonomous', 'agi', 'artificial intelligence', 'robot'],
    'LLM Infrastructure': ['llm', 'language model', 'transformer', 'ai model'],
    'AI Applications': ['ai', 'machine learning', 'neural', 'deep learning'],
}

def fetch_markets(category=None):
    """Fetch markets from Polymarket API."""
    try:
        url = f"{POLYMARKET_API}/markets?category={category}" if category else f"{POLYMARKET_API}/markets"
        req = urllib.request.Request(url, headers={'User-Agent': 'Mozilla/5.0'})
        with urllib.request.urlopen(req, timeout=15) as resp:
            data = json.loads(resp.read())

        # Handle both dict and list responses
        if isinstance(data, list):
            return data
        elif isinstance(data, dict):
            return data.get('markets', [])
        return []
    except Exception as e:
        print(f"  Polymarket API failed for {category}: {e}", file=sys.stderr)
        return []

def score_market(title, description, topic):
    """Score market relevance to topic."""
    text = (title + ' ' + (description or '')).lower()
    keywords = TOPIC_KEYWORDS.get(topic, [])

    score = 0
    for kw in keywords:
        if kw in text:
            score += 2  # Higher weight for Polymarket

    return score

def run():
    OUTPUT.mkdir(exist_ok=True)

    all_markets = []

    # Fetch from multiple categories
    print("  Fetching Polymarket markets...", file=sys.stderr)
    for category in CATEGORIES:
        markets = fetch_markets(category)
        all_markets.extend(markets)
        print(f"  Found {len(markets)} markets in {category}", file=sys.stderr)

    # Also fetch general markets
    general = fetch_markets()
    all_markets.extend(general)

    signals = []
    seen_titles = set()

    for market in all_markets:
        # Handle both dict and list items
        if isinstance(market, dict):
            # Polymarket uses 'question' field, not 'title'
            title = market.get('question') or market.get('title', '')
            subtitle = market.get('description') or market.get('subtitle', '')
        else:
            continue

        if not title or title in seen_titles:
            continue
        seen_titles.add(title)

        # Find best matching topic
        best_topic = None
        best_score = 0

        for topic in TOPIC_KEYWORDS.keys():
            score = score_market(title, subtitle, topic)
            if score > best_score:
                best_score = score
                best_topic = topic

        if best_score >= 1:
            # Calculate confidence based on market volume and interest
            volume = market.get('volume', 0)
            liquidity = market.get('liquidity', 0)

            # Convert to numeric if string
            try:
                volume = float(volume) if volume else 0
                liquidity = float(liquidity) if liquidity else 0
            except (ValueError, TypeError):
                volume = 0
                liquidity = 0

            # Higher volume = more confidence in the signal
            volume_factor = min(volume / 100000, 0.3)  # Cap at 0.3
            confidence = min(0.40 + volume_factor, 0.80)

            # Stage based on confidence
            if confidence >= 0.70:
                stage = 'forming'
            elif confidence >= 0.55:
                stage = 'emerging'
            else:
                stage = 'emerging'

            signals.append({
                'topic': best_topic,
                'confidence': confidence,
                'stage': stage,
                'sources': ['polymarket'],
                'proof_id': f"polymarket-{market.get('slug', 'unknown')}",
                'source_url': f"https://polymarket.com/event/{market.get('slug', '')}",
                'title': title,
                'category': 'Prediction Market',
                'evidenceCount': 1,
                'market_volume': volume,
                'market_liquidity': liquidity,
            })

    output_path = OUTPUT / f"polymarket_{datetime.now().strftime('%Y%m%d_%H%M')}.json"
    with open(output_path, 'w') as f:
        json.dump({'count': len(signals), 'signals': signals, 'source': 'polymarket'}, f, indent=2)

    print(json.dumps({'count': len(signals), 'source': 'polymarket'}))

if __name__ == '__main__':
    run()

def get_signals() -> list[dict]:
    """Returns signals list for use by fetch_world_signals.py aggregator."""
    from io import StringIO
    import sys
    import json
    from pathlib import Path
    
    # Collect all markets across categories
    from scripts.fetch_polymarket import CATEGORIES, fetch_markets, score_market, TOPIC_KEYWORDS
    all_markets = []
    for cat in CATEGORIES:
        all_markets.extend(fetch_markets(category=cat))
    
    signals = []
    seen = set()
    for m in all_markets:
        if not isinstance(m, dict): continue
        title = (m.get('question') or m.get('title') or '').strip()
        if not title or title in seen: continue
        seen.add(title)
        desc = m.get('description') or m.get('subtitle') or ''
        best_topic, best_score = None, 0
        for topic in TOPIC_KEYWORDS:
            s = score_market(title, desc, topic)
            if s > best_score: best_topic, best_score = topic, s
        if best_score < 1: continue
        vol = float(m.get('volume') or 0)
        conf = min(0.40 + min(vol/100000, 0.3), 0.80)
        signals.append({
            'topic': best_topic, 'confidence': conf, 'stage': 'forming' if conf >= 0.70 else 'emerging',
            'sources': ['polymarket'], 'proof_id': f"polymarket-{m.get('slug','')}",
            'source_url': f"https://polymarket.com/event/{m.get('slug','')}",
            'title': title[:120], 'category': 'Prediction Market', 'evidenceCount': 1,
            'signal_id': f"poly_{hash(title) & 0xFFFFFF:06x}",
        })
    return signals
