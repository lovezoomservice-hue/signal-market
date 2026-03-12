#!/usr/bin/env python3
"""
Fetcher: npm + PyPI package activity
Source: T-NPM (registry.npmjs.org) + T-PYPI (pypi.org/stats)
No auth required. Ecosystem adoption signal — packages being installed = real usage.
"""

import json, sys, urllib.request
from datetime import datetime, timezone
from pathlib import Path

ROOT = Path(__file__).parent.parent
HIST = ROOT / 'data' / 'signals_history.jsonl'

# Packages that are leading indicators of their signal topic
NPM_PACKAGES = {
    'AI Agents':          ['@langchain/core', 'langchain', '@langchain/langgraph', 'crewai'],
    'LLM Infrastructure': ['ollama', '@huggingface/inference', 'openai', '@anthropic-ai/sdk'],
    'AI Coding':          ['@modelcontextprotocol/sdk', 'continue', 'codeium'],
    'Multimodal AI':      ['@xenova/transformers', 'transformers.js'],
}

PYPI_PACKAGES = {
    'AI Agents':            ['langgraph', 'crewai', 'autogen', 'agentops'],
    'LLM Infrastructure':   ['vllm', 'llama-cpp-python', 'transformers', 'accelerate'],
    'Efficient AI':         ['bitsandbytes', 'peft', 'trl', 'optimum'],
    'AI Coding':            ['litellm', 'guidance', 'instructor'],
    'AI Reasoning':         ['dspy-ai', 'outlines', 'guidance'],
    'Reinforcement Learning': ['trl', 'stable-baselines3', 'cleanrl'],
}

def fetch_npm_downloads(pkg):
    """Fetch last-week download count from npm."""
    try:
        url = f'https://api.npmjs.org/downloads/point/last-week/{urllib.request.quote(pkg, safe="@/")}'
        req = urllib.request.Request(url, headers={'User-Agent': 'signal-market/1.0'})
        with urllib.request.urlopen(req, timeout=8) as resp:
            d = json.loads(resp.read())
            return d.get('downloads', 0)
    except Exception as e:
        return 0

def fetch_pypi_downloads(pkg):
    """Fetch PyPI stats (monthly) via pypistats."""
    try:
        url = f'https://pypistats.org/api/packages/{pkg}/recent'
        req = urllib.request.Request(url, headers={'User-Agent': 'signal-market/1.0'})
        with urllib.request.urlopen(req, timeout=8) as resp:
            d = json.loads(resp.read())
            return d.get('data', {}).get('last_week', 0)
    except Exception:
        return 0

def load_existing_topics():
    if not HIST.exists():
        return set()
    topics = set()
    with open(HIST) as f:
        for line in f:
            line = line.strip()
            if line:
                try:
                    topics.add(json.loads(line).get('topic',''))
                except Exception:
                    pass
    return topics

def score_downloads(downloads, thresholds=(5000, 50000, 200000)):
    """Convert weekly downloads to a 0-1 score."""
    if downloads >= thresholds[2]: return 1.0
    if downloads >= thresholds[1]: return 0.80
    if downloads >= thresholds[0]: return 0.60
    return max(0.0, downloads / thresholds[0] * 0.55)

def main():
    print('npm/PyPI: fetching package adoption signals...', file=sys.stderr)

    topic_data = {}

    # npm fetch
    for topic, pkgs in NPM_PACKAGES.items():
        pkg = pkgs[0]  # Lead package
        downloads = fetch_npm_downloads(pkg)
        score = score_downloads(downloads)
        if score > 0.1:
            topic_data[topic] = topic_data.get(topic, {})
            topic_data[topic]['npm_pkg'] = pkg
            topic_data[topic]['npm_downloads'] = downloads
            topic_data[topic]['npm_score'] = score
            print(f'  npm {pkg:<35} {downloads:>8} d/wk  score={score:.2f}', file=sys.stderr)

    # PyPI fetch
    for topic, pkgs in PYPI_PACKAGES.items():
        pkg = pkgs[0]
        downloads = fetch_pypi_downloads(pkg)
        score = score_downloads(downloads, thresholds=(1000, 20000, 100000))
        if score > 0.1:
            topic_data[topic] = topic_data.get(topic, {})
            topic_data[topic]['pypi_pkg'] = pkg
            topic_data[topic]['pypi_downloads'] = downloads
            topic_data[topic]['pypi_score'] = score
            print(f'  pypi {pkg:<34} {downloads:>8} d/wk  score={score:.2f}', file=sys.stderr)

    # Build signals
    signals = []
    for topic, data in topic_data.items():
        npm_s = data.get('npm_score', 0)
        pypi_s = data.get('pypi_score', 0)
        combined = max(npm_s, pypi_s)
        if combined < 0.2:
            continue

        sources = []
        if data.get('npm_score', 0) > 0.1: sources.append('npm')
        if data.get('pypi_score', 0) > 0.1: sources.append('pypi')

        conf = min(0.55 + combined * 0.35, 0.88)
        stage = 'accelerating' if combined > 0.7 else 'forming' if combined > 0.4 else 'emerging'

        signals.append({
            'signal_id': f'evt_pkg_{topic.lower().replace(" ","_")[:20]}',
            'topic': topic,
            'stage': stage,
            'confidence': round(conf, 3),
            'impact_score': round(conf - 0.04, 3),
            'evidenceCount': len(sources),
            'sources': sources,
            'category': 'AI Research',
            'first_seen': datetime.now(timezone.utc).strftime('%Y-%m-%d'),
            'evidence_source': 'package_registry',
            'lifecycle_state': 'pending_evidence',
            'cross_validated': len(sources) >= 2,
            'source_count': len(sources),
            'domain': 'ecosystem_adoption',
            'npm_downloads_weekly': data.get('npm_downloads'),
            'pypi_downloads_weekly': data.get('pypi_downloads'),
            'lead_packages': [data.get('npm_pkg'), data.get('pypi_pkg')],
        })

    print(f'  npm/PyPI: {len(signals)} signals derived', file=sys.stderr)

    existing = load_existing_topics()
    new_count = 0
    with open(HIST, 'a') as f:
        for s in signals:
            f.write(json.dumps(s) + '\n')

            new_count += 1

    print(f'  npm/PyPI: wrote {new_count} new signals', file=sys.stderr)
    print(json.dumps({'status': 'ok', 'count': new_count}))

if __name__ == '__main__':
    main()
