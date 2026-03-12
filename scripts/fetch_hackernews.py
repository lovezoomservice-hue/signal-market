#!/usr/bin/env python3
"""
Fetcher: HackerNews (Algolia API)
Source: T-HN — hn.algolia.com/api
No auth required. Developer/tech community signal.
Signals derived: topics with high HN story+comment velocity = community adoption signal
"""

import json, sys, urllib.request, urllib.parse
from datetime import datetime, timezone, timedelta
from pathlib import Path
from collections import defaultdict

ROOT = Path(__file__).parent.parent
HIST = ROOT / 'data' / 'signals_history.jsonl'

# Topic keyword mapping — detect which signals HN confirms
TOPIC_KEYWORDS = {
    'AI Agents':            ['ai agent', 'autonomous agent', 'llm agent', 'multi-agent', 'agentic', 'crew ai', 'autogpt', 'langchain agent'],
    'LLM Infrastructure':   ['vllm', 'llm inference', 'llm serving', 'text generation inference', 'triton', 'tensorrt-llm', 'llm optimization'],
    'AI Coding':            ['cursor', 'claude code', 'github copilot', 'ai coding', 'devin', 'code llm', 'swe-bench', 'ai programmer'],
    'Efficient AI':         ['quantization', 'qlora', 'lora fine-tuning', 'model compression', 'phi-', 'gemma', 'small model'],
    'AI Reasoning':         ['chain of thought', 'reasoning model', 'deepseek r1', 'openai o1', 'o3', 'inference time scaling', 'process reward'],
    'Diffusion Models':     ['stable diffusion', 'flux model', 'midjourney', 'sora', 'video diffusion', 'image generation'],
    'Reinforcement Learning': ['rlhf', 'reinforcement learning', 'reward model', 'policy gradient', 'grpo', 'dpo alignment'],
    'Transformer Architecture': ['mixture of experts', 'moe model', 'mamba model', 'state space model', 'flash attention', 'long context'],
    'Multimodal AI':        ['multimodal', 'vision language', 'gpt-4v', 'gemini vision', 'image text model', 'vlm'],
    'AI Infrastructure':    ['gpu cluster', 'ai datacenter', 'h100', 'nvidia', 'ai infrastructure', 'llm cloud'],
}

def fetch_hn_stories(query, days_back=3, min_points=10):
    """Fetch HN stories via Algolia API."""
    since = int((datetime.now(timezone.utc) - timedelta(days=days_back)).timestamp())
    params = urllib.parse.urlencode({
        'query': query, 'tags': 'story',
        'numericFilters': f'created_at_i>{since},points>{min_points}',
        'hitsPerPage': 20,
    })
    url = f'https://hn.algolia.com/api/v1/search?{params}'
    try:
        req = urllib.request.Request(url, headers={'User-Agent': 'signal-market/1.0'})
        with urllib.request.urlopen(req, timeout=8) as resp:
            return json.loads(resp.read())
    except Exception as e:
        print(f'  HN fetch error ({query[:30]}): {e}', file=sys.stderr)
        return {'hits': []}

def score_topic(hits):
    """Score signal strength from HN hits."""
    if not hits:
        return 0, []
    total_points = sum(h.get('points', 0) for h in hits)
    total_comments = sum(h.get('num_comments', 0) for h in hits)
    story_count = len(hits)
    # Weighted score: stories matter, points matter, comments signal engagement
    score = (story_count * 0.3) + (min(total_points, 500) / 500 * 0.4) + (min(total_comments, 1000) / 1000 * 0.3)
    evidence = [{'title': h.get('title',''), 'points': h.get('points',0), 'url': f'https://news.ycombinator.com/item?id={h.get("objectID","")}'}
                for h in sorted(hits, key=lambda x: x.get('points',0), reverse=True)[:3]]
    return score, evidence

def load_existing():
    if not HIST.exists():
        return {}
    existing = {}
    with open(HIST) as f:
        for line in f:
            line = line.strip()
            if line:
                try:
                    s = json.loads(line)
                    existing[s.get('topic','')] = s
                except Exception:
                    pass
    return existing

def main():
    print('HN: fetching developer community signals...', file=sys.stderr)

    topic_scores = defaultdict(lambda: {'score': 0, 'hits': [], 'evidence': []})

    # Sample queries — one per topic (avoid rate limit)
    sampled = list(TOPIC_KEYWORDS.items())[:8]

    for topic, keywords in sampled:
        # Use the first 2 keywords for this topic
        for kw in keywords[:2]:
            data = fetch_hn_stories(kw, days_back=7, min_points=5)
            hits = data.get('hits', [])
            score, evidence = score_topic(hits)
            if score > topic_scores[topic]['score']:
                topic_scores[topic] = {'score': score, 'hits': hits, 'evidence': evidence}

    print(f'  HN: scored {len(topic_scores)} topics', file=sys.stderr)

    # Convert scores to signals
    signals = []
    for topic, data in topic_scores.items():
        score = data['score']
        if score < 0.05:
            continue  # Not enough HN activity
        conf = min(0.55 + score * 0.4, 0.85)
        stage = 'accelerating' if score > 0.6 else 'forming' if score > 0.3 else 'emerging'
        signals.append({
            'signal_id': f'evt_hn_{topic.lower().replace(" ","_")[:20]}',
            'topic': topic,
            'stage': stage,
            'confidence': round(conf, 3),
            'impact_score': round(conf - 0.05, 3),
            'evidenceCount': len(data['hits']),
            'sources': ['hackernews'],
            'category': 'AI Research',
            'first_seen': datetime.now(timezone.utc).strftime('%Y-%m-%d'),
            'evidence_source': 'hackernews',
            'lifecycle_state': 'pending_evidence',
            'cross_validated': False,
            'source_count': 1,
            'domain': 'developer_community',
            'hn_score': round(score, 3),
            'hn_evidence': data['evidence'],
        })
        print(f'  -> {topic:<28} hn_score={score:.2f} conf={conf:.2f}', file=sys.stderr)

    print(f'  HN: {len(signals)} topic signals derived', file=sys.stderr)

    existing = load_existing()
    new_count = 0
    with open(HIST, 'a') as f:
        for s in signals:
            if s['topic'] not in existing:
                f.write(json.dumps(s) + '\n')
                new_count += 1

    print(f'  HN: wrote {new_count} new signals', file=sys.stderr)
    print(json.dumps({'status': 'ok', 'count': new_count, 'scored': len(signals)}))

if __name__ == '__main__':
    main()
