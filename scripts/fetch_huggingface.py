#!/usr/bin/env python3
"""
HuggingFace Model Intelligence Fetcher
Fetches trending/popular models and maps them to Signal Market signals.
Source: Public HuggingFace API (no auth required)
"""
import json, urllib.request, re, sys, os
from datetime import datetime, UTC
from pathlib import Path

ROOT = Path(__file__).parent.parent
SIGNALS_FILE = ROOT / 'data' / 'signals_history.jsonl'

HF_ENDPOINTS = [
    ("https://huggingface.co/api/models?sort=downloads&limit=50&full=false", "download_trending"),
    ("https://huggingface.co/api/models?sort=likes&limit=50&full=false",     "likes_trending"),
    # Per-tag targeted endpoints — ensures coverage for topics underrepresented in global top-50
    ("https://huggingface.co/api/models?pipeline_tag=reinforcement-learning&sort=downloads&limit=20&full=false",  "rl_targeted"),
    ("https://huggingface.co/api/models?pipeline_tag=code-generation&sort=downloads&limit=20&full=false",         "code_targeted"),
    ("https://huggingface.co/api/models?pipeline_tag=text-generation&sort=downloads&limit=20&full=false&filter=reasoning", "reasoning_targeted"),
    ("https://huggingface.co/api/models?pipeline_tag=question-answering&sort=downloads&limit=20&full=false",      "qa_targeted"),
]

PIPELINE_TAG_TO_SIGNAL = {
    'text-generation':           ('LLM Infrastructure',   'AI Research', 0.88),
    'text2text-generation':      ('LLM Infrastructure',   'AI Research', 0.85),
    'conversational':            ('AI Agents',             'AI Research', 0.82),
    'text-classification':       ('Efficient AI',          'AI Research', 0.70),
    'token-classification':      ('AI Reasoning',          'AI Research', 0.68),
    'question-answering':        ('AI Reasoning',          'AI Research', 0.72),
    'image-generation':          ('Diffusion Models',      'AI Research', 0.85),
    'text-to-image':             ('Diffusion Models',      'AI Research', 0.88),
    'image-to-image':            ('Diffusion Models',      'AI Research', 0.78),
    'image-segmentation':        ('Efficient AI',          'AI Research', 0.65),
    'object-detection':          ('Efficient AI',          'AI Research', 0.65),
    'feature-extraction':        ('Transformer Arch',      'AI Research', 0.72),
    'fill-mask':                 ('Transformer Arch',      'AI Research', 0.70),
    'automatic-speech-recognition': ('Efficient AI',      'AI Research', 0.73),
    'text-to-speech':            ('Efficient AI',          'AI Research', 0.70),
    'reinforcement-learning':    ('Reinforcement Learning','AI Research', 0.80),
    'code-generation':           ('AI Coding',             'AI Research', 0.85),
    'text-to-code':              ('AI Coding',             'AI Research', 0.82),
}

def fetch_hf_models(url, source_type):
    req = urllib.request.Request(url, headers={'User-Agent': 'SignalMarket/1.0'})
    with urllib.request.urlopen(req, timeout=15) as r:
        return json.loads(r.read())

def downloads_to_stage(downloads):
    if downloads >= 10_000_000: return 'accelerating', 0.92
    if downloads >= 1_000_000:  return 'accelerating', 0.85
    if downloads >= 100_000:    return 'forming',       0.75
    if downloads >= 10_000:     return 'emerging',      0.65
    return 'weak', 0.50

def aggregate_signals(all_models):
    """Aggregate HF models into topic-level signals."""
    topic_counts = {}  # topic -> {downloads, likes, models, pipeline_tags}

    for m in all_models:
        tag = m.get('pipeline_tag') or ''
        if tag not in PIPELINE_TAG_TO_SIGNAL:
            continue
        topic, category, base_conf = PIPELINE_TAG_TO_SIGNAL[tag]
        if topic not in topic_counts:
            topic_counts[topic] = {'downloads': 0, 'likes': 0, 'models': [], 'category': category, 'base_conf': base_conf}
        topic_counts[topic]['downloads'] += m.get('downloads', 0)
        topic_counts[topic]['likes']     += m.get('likes', 0)
        topic_counts[topic]['models'].append(m.get('modelId', ''))

    signals = []
    today = datetime.now(UTC).strftime('%Y-%m-%d')
    for i, (topic, data) in enumerate(topic_counts.items()):
        stage, conf_boost = downloads_to_stage(data['downloads'])
        conf = min(0.98, data['base_conf'] * 0.7 + conf_boost * 0.3)
        ev_count = len(data['models'])
        signal = {
            'signal_id':      f'hf_{topic.lower().replace(" ","_")}_{today}',
            'topic':          topic,
            'stage':          stage,
            'confidence':     round(conf, 3),
            'impact_score':   round(min(0.99, conf * 0.95), 3),
            'evidenceCount':  min(ev_count, 10),
            'sources':        ['huggingface:trending', 'huggingface:downloads'],
            'category':       data['category'],
            'first_seen':     today,
            'evidence_source':'huggingface',
            'lifecycle_state': None,
            'hf_total_downloads': data['downloads'],
            'hf_total_likes':     data['likes'],
            'hf_model_count':     ev_count,
            'top_models':         data['models'][:3],
        }
        signals.append(signal)
    return signals

def run():
    all_models = []
    seen_ids = set()
    for url, src in HF_ENDPOINTS:
        try:
            models = fetch_hf_models(url, src)
            for m in models:
                mid = m.get('modelId','')
                if mid and mid not in seen_ids:
                    seen_ids.add(mid)
                    all_models.append(m)
            print(f"  HF {src}: {len(models)} models", file=sys.stderr)
        except Exception as e:
            print(f"  HF {src}: ERROR {e}", file=sys.stderr)

    signals = aggregate_signals(all_models)
    print(f"  HF signals aggregated: {len(signals)}", file=sys.stderr)
    for s in signals:
        print(f"  -> {s['topic']}: stage={s['stage']} conf={s['confidence']} models={s['hf_model_count']}", file=sys.stderr)

    if '--dry-run' in sys.argv:
        print(json.dumps(signals, indent=2))
        return

    # Write to signals_history.jsonl (append, dedup by signal_id)
    SIGNALS_FILE.parent.mkdir(parents=True, exist_ok=True)
    existing_ids = set()
    if SIGNALS_FILE.exists():
        for line in SIGNALS_FILE.read_text().splitlines():
            try:
                existing_ids.add(json.loads(line).get('signal_id',''))
            except: pass

    written = 0
    with open(SIGNALS_FILE, 'a') as f:
        for s in signals:
            # Always write — pipeline deduplicate_and_crossvalidate merges by topic
            f.write(json.dumps(s) + '\n')
            written += 1
    print(f"  HF: wrote {written} signals", file=sys.stderr)
    return signals

if __name__ == '__main__':
    run()
