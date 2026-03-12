#!/usr/bin/env python3
"""
fetch_reuters.py — Tech news RSS fetcher (Tier L1, FREE)

Parses technology RSS feeds for AI/tech news.
Uses Techmeme as primary source (aggregates Reuters, TechCrunch, etc.)
No API key required — uses public RSS feeds.

Feeds:
- Techmeme: https://www.techmeme.com/feed.xml (aggregates major tech news)
"""

import json
import sys
import urllib.request
from datetime import datetime
from pathlib import Path
import xml.etree.ElementTree as ET

ROOT = Path(__file__).parent.parent
OUTPUT = ROOT / "output"

# Tech news RSS feeds (Techmeme aggregates Reuters, TechCrunch, etc.)
TECH_FEEDS = {
    'techmeme': 'https://www.techmeme.com/feed.xml',
}

# Topic keyword mapping
TOPIC_KEYWORDS = {
    'AI Agents': ['ai agents', 'autonomous agents', 'intelligent agents', 'agentic'],
    'AI Coding': ['copilot', 'code generation', 'ai coding', 'github copilot', 'cursor', 'aider'],
    'AI Chips & Hardware': ['ai chip', 'nvidia', 'amd', 'intel', 'semiconductor', 'gpu', 'tpu', 'groq'],
    'Autonomous Vehicles': ['autonomous vehicle', 'self-driving', 'waymo', 'tesla fsd', 'robotaxi'],
    'AI Regulation': ['ai regulation', 'ai safety', 'ai policy', 'eu ai act', 'ai governance'],
    'LLM Infrastructure': ['llm', 'large language model', 'transformer', 'inference', 'vllm'],
    'AI Ethics': ['ai ethics', 'ai bias', 'ai fairness', 'algorithmic bias'],
    'Robotics & Embodied AI': ['robotics', 'embodied ai', 'humanoid robot', 'boston dynamics', 'figure'],
    'Brain-Computer Interface': ['brain computer', 'neuralink', 'bci', 'neural interface'],
    'Multimodal AI': ['multimodal', 'image generation', 'video generation', 'stable diffusion'],
}

def fetch_feed(url):
    """Fetch and parse RSS feed."""
    try:
        req = urllib.request.Request(url, headers={'User-Agent': 'Mozilla/5.0'})
        with urllib.request.urlopen(req, timeout=15) as resp:
            xml_data = resp.read()

        root = ET.fromstring(xml_data)
        items = []

        # Handle RSS 2.0 structure
        channel = root.find('channel')
        if channel is not None:
            for item in channel.findall('item'):
                title = item.find('title')
                link = item.find('link')
                pub_date = item.find('pubDate')
                description = item.find('description')
                category = item.find('category')

                if title is not None and link is not None:
                    items.append({
                        'title': title.text or '',
                        'link': link.text or '',
                        'pub_date': pub_date.text if pub_date is not None else '',
                        'description': description.text if description is not None else '',
                        'category': category.text if category is not None else '',
                    })
        return items
    except Exception as e:
        print(f"  Feed fetch failed: {e}", file=sys.stderr)
        return []

def score_article(title, description, topic):
    """Score article relevance to topic."""
    text = (title + ' ' + description).lower()
    keywords = TOPIC_KEYWORDS.get(topic, [])

    score = 0
    for kw in keywords:
        if kw in text:
            score += 1

    return score

def run():
    OUTPUT.mkdir(exist_ok=True)

    all_signals = []

    for feed_name, feed_url in TECH_FEEDS.items():
        print(f"  Fetching {feed_name} feed...", file=sys.stderr)
        items = fetch_feed(feed_url)
        print(f"  Found {len(items)} items from {feed_name}", file=sys.stderr)

        for item in items:
            # Find best matching topic
            best_topic = None
            best_score = 0

            for topic in TOPIC_KEYWORDS.keys():
                score = score_article(item['title'], item['description'], topic)
                if score > best_score:
                    best_score = score
                    best_topic = topic

            if best_score >= 1:
                # Calculate confidence based on keyword matches
                confidence = min(0.35 + (best_score * 0.10), 0.75)

                all_signals.append({
                    'topic': best_topic,
                    'confidence': confidence,
                    'stage': 'emerging' if confidence < 0.5 else 'forming',
                    'sources': [f'techmeme:{feed_name}'],
                    'proof_id': f'techmeme-{hash(item["link"]) % 10000:04d}',
                    'source_url': item['link'],
                    'title': item['title'],
                    'category': 'News',
                    'evidenceCount': 1,
                    'published_at': item['pub_date'],
                })

    # Deduplicate by URL
    seen_urls = set()
    unique_signals = []
    for sig in all_signals:
        if sig['source_url'] not in seen_urls:
            seen_urls.add(sig['source_url'])
            unique_signals.append(sig)

    output_path = OUTPUT / f"techmeme_{datetime.now().strftime('%Y%m%d_%H%M')}.json"
    with open(output_path, 'w') as f:
        json.dump({'count': len(unique_signals), 'signals': unique_signals, 'source': 'techmeme'}, f, indent=2)

    print(json.dumps({'count': len(unique_signals), 'source': 'techmeme'}))

if __name__ == '__main__':
    run()

def get_signals() -> list[dict]:
    """Returns signals list for use by fetch_world_signals.py aggregator."""
    all_signals = []
    for source, url in TECH_FEEDS.items():
        items = fetch_feed(url)
        for item in items:
            title = item.get('title','')
            desc  = item.get('description','')
            link  = item.get('link','')
            for topic in TOPIC_KEYWORDS:
                score = score_article(title, desc, topic)
                if score >= 1:
                    all_signals.append({
                        'topic': topic, 'confidence': min(0.5 + score*0.08, 0.88),
                        'stage': 'emerging', 'sources': [source],
                        'source_url': link, 'title': title[:120],
                        'category': 'News/Media', 'evidenceCount': 1,
                        'signal_id': f"news_{hash(title) & 0xFFFFFF:06x}",
                        'source_layer': 'L1',
                    })
    return all_signals
