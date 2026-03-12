#!/usr/bin/env python3
"""
Alpha Vantage News Sentiment Intelligence Fetcher
Maps tech/AI news sentiment to Signal Market signal factors.
Requires: sec_alphavantage_api_key in vault
"""
import json, urllib.request, urllib.parse, sys, os, subprocess
from datetime import datetime, UTC
from pathlib import Path

ROOT = Path(__file__).parent.parent
SIGNALS_FILE = ROOT / 'data' / 'signals_history.jsonl'
VAULT_ADAPTER = Path('/home/nice005/.openclaw/workspace/security/vault_adapter.js')

TOPIC_KEYWORD_MAP = {
    'AI Agents':           ['agent', 'autonomous', 'agentic', 'multi-agent'],
    'LLM Infrastructure':  ['llm', 'large language model', 'gpt', 'claude', 'gemini', 'inference', 'foundation model'],
    'AI Coding':           ['copilot', 'code generation', 'coding ai', 'developer ai', 'cursor', 'devin'],
    'Diffusion Models':    ['diffusion', 'image generation', 'stable diffusion', 'midjourney', 'sora', 'video generation'],
    'Efficient AI':        ['model compression', 'quantization', 'efficient', 'edge ai', 'on-device'],
    'AI Infrastructure':   ['nvidia', 'ai chip', 'gpu', 'tpu', 'inference infrastructure', 'cloud ai'],
    'AI Safety':           ['alignment', 'safety', 'red team', 'responsible ai', 'ai governance'],
}

RELEVANCE_THRESHOLD = 0.5
SENTIMENT_TO_STAGE = {
    (0.35, 1.0):  ('accelerating', 0.88),
    (0.15, 0.35): ('forming',      0.72),
    (0.0,  0.15): ('emerging',     0.60),
    (-0.15, 0.0): ('emerging',     0.55),
    (-1.0, -0.15):('fading',       0.50),
}

def get_vault_secret(key):
    try:
        result = subprocess.run(
            ['node', str(VAULT_ADAPTER), 'get', key],
            capture_output=True, text=True, timeout=5,
            cwd='/home/nice005/.openclaw/workspace'
        )
        return result.stdout.strip()
    except Exception:
        return os.environ.get(key, '')

def fetch_news(api_key, topics='technology,finance,earnings'):
    url = f"https://www.alphavantage.co/query?function=NEWS_SENTIMENT&topics={urllib.parse.quote(topics)}&apikey={api_key}&limit=50&sort=RELEVANCE"
    req = urllib.request.Request(url, headers={'User-Agent': 'SignalMarket/1.0'})
    with urllib.request.urlopen(req, timeout=20) as r:
        return json.loads(r.read())

def classify_articles(articles):
    """Map articles to Signal Market topics via keyword matching."""
    topic_scores = {}

    for article in articles:
        text = (article.get('title','') + ' ' + article.get('summary','')).lower()
        overall_sentiment = float(article.get('overall_sentiment_score', 0))
        overall_relevance = 1.0  # AV articles are pre-filtered

        for topic, keywords in TOPIC_KEYWORD_MAP.items():
            kw_matches = sum(1 for kw in keywords if kw in text)
            if kw_matches == 0:
                continue
            kw_relevance = min(1.0, kw_matches * 0.4)

            # Check ticker_sentiment for tech companies
            ticker_boost = 0
            for ts in article.get('ticker_sentiment', []):
                ticker = ts.get('ticker','')
                if ticker in ['NVDA','MSFT','GOOGL','META','AMZN','TSLA','AAPL']:
                    ticker_boost = float(ts.get('relevance_score', 0)) * 0.3

            if topic not in topic_scores:
                topic_scores[topic] = {'sentiment_sum': 0, 'relevance_sum': 0, 'count': 0, 'articles': []}
            topic_scores[topic]['sentiment_sum'] += overall_sentiment * kw_relevance
            topic_scores[topic]['relevance_sum'] += kw_relevance + ticker_boost
            topic_scores[topic]['count'] += 1
            topic_scores[topic]['articles'].append(article.get('title','')[:80])

    return topic_scores

def sentiment_to_stage(avg_sentiment):
    for (lo, hi), (stage, conf) in SENTIMENT_TO_STAGE.items():
        if lo <= avg_sentiment < hi:
            return stage, conf
    return 'emerging', 0.60

def build_signals(topic_scores):
    signals = []
    today = datetime.now(UTC).strftime('%Y-%m-%d')

    for topic, data in topic_scores.items():
        if data['count'] < 2:
            continue  # need at least 2 articles to form a signal
        avg_sentiment = data['sentiment_sum'] / data['count']
        stage, base_conf = sentiment_to_stage(avg_sentiment)

        # Confidence boosted by article count
        count_boost = min(0.15, data['count'] * 0.03)
        confidence = round(min(0.95, base_conf + count_boost), 3)

        signal = {
            'signal_id':       f'av_{topic.lower().replace(" ","_")}_{today}',
            'topic':           topic,
            'stage':           stage,
            'confidence':      confidence,
            'impact_score':    round(confidence * 0.9, 3),
            'evidenceCount':   data['count'],
            'sources':         ['alphavantage:news_sentiment'],
            'category':        'AI Research' if 'AI' in topic else 'Technology',
            'first_seen':      today,
            'evidence_source': 'alphavantage',
            'lifecycle_state': None,
            'av_avg_sentiment': round(avg_sentiment, 4),
            'av_article_count': data['count'],
            'av_sample_titles': data['articles'][:3],
        }
        signals.append(signal)
    return signals

def run():
    api_key = get_vault_secret('sec_alphavantage_api_key')
    if not api_key:
        print("ERROR: sec_alphavantage_api_key not found in vault", file=sys.stderr)
        return []

    print(f"  AV: fetching news sentiment...", file=sys.stderr)
    try:
        data = fetch_news(api_key)
        articles = data.get('feed', [])
        print(f"  AV: {len(articles)} articles fetched", file=sys.stderr)
    except Exception as e:
        print(f"  AV: fetch error: {e}", file=sys.stderr)
        return []

    topic_scores = classify_articles(articles)
    signals = build_signals(topic_scores)
    print(f"  AV: {len(signals)} signals derived", file=sys.stderr)

    if '--dry-run' in sys.argv:
        print(json.dumps(signals, indent=2))
        return signals

    # Write to signals_history.jsonl
    SIGNALS_FILE.parent.mkdir(parents=True, exist_ok=True)
    existing_ids = set()
    if SIGNALS_FILE.exists():
        for line in SIGNALS_FILE.read_text().splitlines():
            try: existing_ids.add(json.loads(line).get('signal_id',''))
            except: pass

    written = 0
    with open(SIGNALS_FILE, 'a') as f:
        for s in signals:
            if s['signal_id'] not in existing_ids:
                f.write(json.dumps(s) + '\n')
                written += 1
    print(f"  AV: wrote {written} new signals", file=sys.stderr)
    return signals

if __name__ == '__main__':
    run()
