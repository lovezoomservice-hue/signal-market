#!/usr/bin/env python3
"""
fetch_reddit.py — Reddit discussion fetcher (Tier L2, FREE)

Fetches AI/tech discussions from relevant subreddits.
Gracefully degrades to 0 results if Reddit blocks requests.

Subreddits:
- r/MachineLearning, r/artificial, r/LocalLLaMA, r/singularity, r/programming, r/robotics
"""

import json
import sys
import urllib.request
from datetime import datetime
from pathlib import Path

ROOT = Path(__file__).parent.parent
OUTPUT = ROOT / "output"

# Subreddits to monitor
SUBREDDITS = [
    'MachineLearning',
    'artificial',
    'LocalLLaMA',
    'singularity',
    'programming',
    'robotics',
    'Futurology',
]

# Topic keyword mapping
TOPIC_KEYWORDS = {
    'AI Agents': ['ai agents', 'autonomous agents', 'langchain', 'langgraph', 'crewai', 'agentic'],
    'AI Coding': ['copilot', 'cursor', 'code generation', 'ai coding', 'github copilot', 'aider'],
    'AI Chips & Hardware': ['ai chip', 'nvidia', 'gpu', 'h100', 'a100', 'tpu', 'groq', 'llm inference'],
    'Autonomous Vehicles': ['autonomous vehicle', 'self-driving', 'waymo', 'fsd', 'robotaxi', 'tesla'],
    'AI Regulation': ['ai regulation', 'ai safety', 'ai policy', 'eu ai act', 'ai governance'],
    'LLM Infrastructure': ['llm', 'vllm', 'inference', 'quantization', 'fine-tuning', 'lora'],
    'AI Ethics': ['ai ethics', 'ai bias', 'ai alignment', 'ai safety', 'existential risk'],
    'Robotics & Embodied AI': ['robotics', 'embodied ai', 'humanoid', 'boston dynamics', 'figure'],
    'Brain-Computer Interface': ['brain computer', 'neuralink', 'bci', 'neural interface'],
    'Multimodal AI': ['multimodal', 'image generation', 'stable diffusion', 'midjourney', 'sora'],
    'AI Research': ['arxiv', 'paper', 'research', 'neurips', 'icml', 'iclr', 'acl'],
}

def fetch_subreddit(subreddit, sort='hot'):
    """Fetch posts from a subreddit."""
    try:
        # Use old.reddit.com which is more permissive
        url = f"https://old.reddit.com/r/{subreddit}/{sort}.json?limit=50"
        req = urllib.request.Request(url, headers={
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
        })
        with urllib.request.urlopen(req, timeout=15) as resp:
            data = json.loads(resp.read())

        posts = []
        for child in data.get('data', {}).get('children', []):
            post = child.get('data', {})
            posts.append({
                'title': post.get('title', ''),
                'selftext': post.get('selftext', ''),
                'url': post.get('url', ''),
                'score': post.get('score', 0),
                'num_comments': post.get('num_comments', 0),
                'subreddit': post.get('subreddit', ''),
                'created_utc': post.get('created_utc', 0),
                'permalink': post.get('permalink', ''),
            })
        return posts
    except Exception as e:
        print(f"  Reddit fetch failed for r/{subreddit}: {e}", file=sys.stderr)
        return []

def score_post(title, selftext, topic):
    """Score post relevance to topic."""
    text = (title + ' ' + selftext).lower()
    keywords = TOPIC_KEYWORDS.get(topic, [])

    score = 0
    for kw in keywords:
        if kw in text:
            score += 1

    return score

def run():
    OUTPUT.mkdir(exist_ok=True)

    all_posts = []

    for subreddit in SUBREDDITS:
        print(f"  Fetching r/{subreddit}...", file=sys.stderr)
        posts = fetch_subreddit(subreddit)
        print(f"  Found {len(posts)} posts in r/{subreddit}", file=sys.stderr)
        all_posts.extend(posts)

    signals = []
    seen_urls = set()

    for post in all_posts:
        post_url = f"https://reddit.com{post['permalink']}"
        if post_url in seen_urls:
            continue
        seen_urls.add(post_url)

        # Skip posts with low engagement
        if post['score'] < 10:
            continue

        # Find best matching topic
        best_topic = None
        best_score = 0

        for topic in TOPIC_KEYWORDS.keys():
            score = score_post(post['title'], post['selftext'], topic)
            if score > best_score:
                best_score = score
                best_topic = topic

        if best_score >= 1:
            # Calculate confidence based on engagement
            engagement_score = min(post['score'] / 500, 0.25)  # Cap at 0.25
            comment_score = min(post['num_comments'] / 100, 0.15)  # Cap at 0.15

            confidence = min(0.35 + engagement_score + comment_score, 0.75)

            # Stage based on confidence and engagement
            if confidence >= 0.65 and post['num_comments'] > 50:
                stage = 'forming'
            elif confidence >= 0.50:
                stage = 'emerging'
            else:
                stage = 'emerging'

            signals.append({
                'topic': best_topic,
                'confidence': confidence,
                'stage': stage,
                'sources': [f'reddit:{post["subreddit"]}'],
                'proof_id': f"reddit-{post['subreddit']}-{post['score']}",
                'source_url': post_url,
                'title': post['title'],
                'category': 'Discussion',
                'evidenceCount': 1,
                'engagement': {'score': post['score'], 'comments': post['num_comments']},
            })

    # Sort by score and take top signals
    signals.sort(key=lambda x: x['engagement']['score'], reverse=True)
    signals = signals[:50]  # Cap at 50 signals

    output_path = OUTPUT / f"reddit_{datetime.now().strftime('%Y%m%d_%H%M')}.json"
    with open(output_path, 'w') as f:
        json.dump({'count': len(signals), 'signals': signals, 'source': 'reddit'}, f, indent=2)

    print(json.dumps({'count': len(signals), 'source': 'reddit'}))

if __name__ == '__main__':
    run()

def get_signals() -> list[dict]:
    """Returns signals list for use by fetch_world_signals.py aggregator."""
    all_signals = []
    for sub in SUBREDDITS:
        posts = fetch_subreddit(sub)
        for post in posts:
            all_signals.append(post)
    return all_signals
