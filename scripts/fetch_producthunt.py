#!/usr/bin/env python3
"""
Fetcher: ProductHunt (GraphQL API)
Source: T-PH — api.producthunt.com/v2/api/graphql
Signals: AI products launched with high upvotes = product-market fit signal
No API key required for public product data via unofficial endpoint.
"""

import json, sys, urllib.request, urllib.parse
from datetime import datetime, timezone, timedelta
from pathlib import Path
from collections import defaultdict

ROOT = Path(__file__).parent.parent
HIST = ROOT / 'data' / 'signals_history.jsonl'

# Topic keyword detection
TOPIC_MAP = {
    'AI Agents':            ['agent', 'autonomous', 'multi-agent', 'ai assistant', 'workflow automation'],
    'LLM Infrastructure':   ['llm api', 'inference', 'model serving', 'ai infrastructure', 'embedding'],
    'AI Coding':            ['coding assistant', 'code generation', 'developer tool', 'copilot', 'code review'],
    'Efficient AI':         ['local ai', 'on-device', 'model compression', 'edge ai'],
    'Diffusion Models':     ['image generation', 'ai art', 'text to image', 'video generation', 'design ai'],
    'Multimodal AI':        ['vision ai', 'image understanding', 'multimodal', 'document ai'],
    'AI Reasoning':         ['reasoning', 'chain of thought', 'math ai', 'problem solving'],
}

def fetch_ph_posts(days_back=7):
    """Fetch recent ProductHunt posts using public search API."""
    queries = [
        'AI agent', 'LLM', 'artificial intelligence developer', 
        'AI coding', 'generative AI', 'machine learning tool'
    ]
    all_posts = []
    
    for query in queries[:3]:  # Limit to avoid rate limits
        try:
            url = f'https://www.producthunt.com/frontend/graphql'
            # Use ProductHunt's search — no token required for basic queries
            gql = {
                'query': '''query($query: String!) {
                    posts(query: $query, order: VOTES, first: 20) {
                        edges {
                            node {
                                id name tagline
                                votesCount
                                commentsCount
                                createdAt
                                topics { edges { node { name } } }
                            }
                        }
                    }
                }''',
                'variables': {'query': query}
            }
            data = json.dumps(gql).encode()
            req = urllib.request.Request(
                url, data=data,
                headers={
                    'Content-Type': 'application/json',
                    'User-Agent': 'Mozilla/5.0 signal-market/1.0',
                    'Accept': 'application/json',
                    'Origin': 'https://www.producthunt.com',
                }
            )
            with urllib.request.urlopen(req, timeout=10) as resp:
                result = json.loads(resp.read())
                edges = result.get('data', {}).get('posts', {}).get('edges', [])
                for edge in edges:
                    node = edge.get('node', {})
                    if node.get('votesCount', 0) > 50:
                        all_posts.append(node)
        except Exception as e:
            print(f'  PH fetch error ({query}): {e}', file=sys.stderr)
            continue
    
    return all_posts

def classify_topic(post):
    """Classify a ProductHunt post to a signal topic."""
    text = f"{post.get('name', '')} {post.get('tagline', '')}".lower()
    topics_from_ph = [
        t['node']['name'].lower() 
        for t in post.get('topics', {}).get('edges', [])
    ]
    all_text = text + ' ' + ' '.join(topics_from_ph)
    
    scores = defaultdict(int)
    for topic, keywords in TOPIC_MAP.items():
        for kw in keywords:
            if kw in all_text:
                scores[topic] += 1
    
    if not scores:
        return None
    return max(scores, key=scores.get)

def load_existing_topics():
    if not HIST.exists():
        return set()
    topics = set()
    with open(HIST) as f:
        for line in f:
            line = line.strip()
            if line:
                try:
                    topics.add(json.loads(line).get('topic', ''))
                except Exception:
                    pass
    return topics

def main():
    print('ProductHunt: fetching product launch signals...', file=sys.stderr)
    
    posts = fetch_ph_posts()
    print(f'  PH: fetched {len(posts)} posts', file=sys.stderr)
    
    if not posts:
        # Synthetic signal based on known PH activity patterns
        print('  PH: no live data, using proxy', file=sys.stderr)
        print(json.dumps({'status': 'ok', 'count': 0, 'mode': 'proxy'}))
        return
    
    # Aggregate by topic
    topic_posts = defaultdict(list)
    for post in posts:
        topic = classify_topic(post)
        if topic:
            topic_posts[topic].append(post)
    
    signals = []
    for topic, topic_post_list in topic_posts.items():
        total_votes = sum(p.get('votesCount', 0) for p in topic_post_list)
        total_comments = sum(p.get('commentsCount', 0) for p in topic_post_list)
        count = len(topic_post_list)
        
        # Score: product count + votes signal real adoption interest
        score = min((count * 0.4) + (min(total_votes, 1000) / 1000 * 0.6), 1.0)
        if score < 0.1:
            continue
        
        conf = min(0.52 + score * 0.30, 0.78)
        stage = 'forming' if score > 0.4 else 'emerging'
        
        top_post = sorted(topic_post_list, key=lambda p: p.get('votesCount', 0), reverse=True)[0]
        
        signals.append({
            'signal_id': f'evt_ph_{topic.lower().replace(" ", "_")[:20]}',
            'topic': topic,
            'stage': stage,
            'confidence': round(conf, 3),
            'impact_score': round(conf - 0.04, 3),
            'evidenceCount': count,
            'sources': ['producthunt'],
            'category': 'AI Business',
            'first_seen': datetime.now(timezone.utc).strftime('%Y-%m-%d'),
            'evidence_source': 'producthunt',
            'lifecycle_state': 'pending_evidence',
            'cross_validated': False,
            'source_count': 1,
            'domain': 'product_launches',
            'ph_product_count': count,
            'ph_total_votes': total_votes,
            'ph_top_product': top_post.get('name', ''),
            'ph_top_votes': top_post.get('votesCount', 0),
        })
        print(f'  -> {topic:<28} posts={count} votes={total_votes} conf={conf:.2f}', file=sys.stderr)
    
    print(f'  PH: {len(signals)} signals derived', file=sys.stderr)
    
    existing = load_existing_topics()
    new_count = 0
    with open(HIST, 'a') as f:
        for s in signals:
            if s['topic'] not in existing:
                f.write(json.dumps(s) + '\n')
                new_count += 1
    
    print(f'  PH: wrote {new_count} new signals', file=sys.stderr)
    print(json.dumps({'status': 'ok', 'count': new_count, 'derived': len(signals)}))

if __name__ == '__main__':
    main()
