#!/usr/bin/env python3
"""
Signal Market Full Source Pipeline
Runs all fetchers and produces a merged snapshot for _unified.js
"""
import json, sys
from pathlib import Path
from datetime import datetime, UTC

ROOT = Path(__file__).parent.parent
SIGNALS_FILE = ROOT / 'data' / 'signals_history.jsonl'

# Import fetchers
sys.path.insert(0, str(ROOT / 'scripts'))
import fetch_huggingface
import fetch_alphavantage

def load_static_base():
    """Load static base signals (always present)."""
    return [
        {"topic":"AI Agents","stage":"accelerating","confidence":0.97,"impact_score":0.92,"evidenceCount":1,"sources":["arxiv:cs.AI","arxiv_rss"],"proof_id":"research-2026-03-11-2603.08835","source_url":"https://arxiv.org/abs/2603.08835","category":"AI Research","first_seen":"2026-03-11"},
        {"topic":"LLM Infrastructure","stage":"accelerating","confidence":0.93,"impact_score":0.88,"evidenceCount":2,"sources":["arxiv:cs.AI","arxiv_rss"],"proof_id":"research-2026-03-11-2603.08933","source_url":"https://arxiv.org/abs/2603.08933","category":"AI Research","first_seen":"2026-03-11"},
        {"topic":"Diffusion Models","stage":"accelerating","confidence":0.77,"impact_score":0.81,"evidenceCount":2,"sources":["github:trending"],"proof_id":"research-2026-03-11-gh-AUTOMATIC1111-sta","source_url":"https://github.com/AUTOMATIC1111/stable-diffusion-webui","category":"AI Research","first_seen":"2026-03-11"},
        {"topic":"AI Coding","stage":"forming","confidence":0.73,"impact_score":0.68,"evidenceCount":2,"sources":["arxiv:cs.LG","arxiv_rss"],"category":"AI Research","first_seen":"2026-03-11"},
        {"topic":"Efficient AI","stage":"emerging","confidence":0.69,"impact_score":0.64,"evidenceCount":1,"sources":["arxiv:cs.LG","arxiv_rss"],"category":"AI Research","first_seen":"2026-03-11"},
        {"topic":"Reinforcement Learning","stage":"emerging","confidence":0.69,"impact_score":0.64,"evidenceCount":1,"sources":["arxiv:cs.LG","arxiv_rss"],"category":"AI Research","first_seen":"2026-03-11"},
        {"topic":"Transformer Arch","stage":"emerging","confidence":0.69,"impact_score":0.64,"evidenceCount":1,"sources":["arxiv:cs.LG","arxiv_rss"],"category":"AI Research","first_seen":"2026-03-11"},
        {"topic":"AI Reasoning","stage":"emerging","confidence":0.69,"impact_score":0.64,"evidenceCount":1,"sources":["arxiv:cs.CL","arxiv_rss"],"category":"AI Research","first_seen":"2026-03-11"},
    ]

def merge_signals(base, *source_lists):
    """Merge signals: base + additional sources. Dedup by topic, boost confidence if multi-source."""
    merged = {s['topic']: dict(s) for s in base}
    for source_signals in source_lists:
        for new_s in (source_signals or []):
            topic = new_s.get('topic')
            if not topic: continue
            if topic in merged:
                existing = merged[topic]
                # Cross-source confirmation: boost confidence
                ev_boost = min(0.15, new_s.get('evidenceCount',0) * 0.02)
                existing['confidence'] = round(min(0.99, existing['confidence'] + ev_boost), 3)
                existing['sources'] = list(set(existing.get('sources',[]) + new_s.get('sources',[])))
                existing['evidenceCount'] = existing.get('evidenceCount',0) + new_s.get('evidenceCount',0)
                existing['cross_validated'] = True
            else:
                # New topic from additional sources
                new_s_copy = dict(new_s)
                merged[topic] = new_s_copy
    return list(merged.values())

def write_snapshot(signals):
    """Write merged snapshot as new JSONL line."""
    SIGNALS_FILE.parent.mkdir(parents=True, exist_ok=True)
    snapshot = {
        "generated_at": datetime.now(UTC).isoformat(),
        "source": "full_pipeline",
        "signals": signals,
    }
    with open(SIGNALS_FILE, 'a') as f:
        f.write(json.dumps(snapshot) + '\n')
    print(f"Pipeline: wrote snapshot with {len(signals)} signals", file=sys.stderr)

def run():
    base = load_static_base()
    print(f"Pipeline: base signals={len(base)}", file=sys.stderr)

    hf_signals = fetch_huggingface.run()
    av_signals = fetch_alphavantage.run()

    merged = merge_signals(base, hf_signals, av_signals)
    print(f"Pipeline: merged={len(merged)} signals", file=sys.stderr)

    if '--dry-run' not in sys.argv:
        write_snapshot(merged)
    else:
        for s in merged:
            print(f"  {s['topic']}: stage={s['stage']} conf={s['confidence']} src={s.get('sources',[][:2])}")

    return merged

if __name__ == '__main__':
    run()
