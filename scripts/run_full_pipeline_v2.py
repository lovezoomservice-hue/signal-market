#!/usr/bin/env python3
"""
run_full_pipeline_v2.py — Signal Market full ingestion pipeline v2

Sources:
  Tier 0 (live): arXiv, GitHub, HuggingFace, arXiv RSS, AlphaVantage
  Tier 1 (new):  CryptoPanic, SerpAPI
  
Steps:
  1. Run all fetchers
  2. Deduplicate by topic (keep highest confidence)
  3. Cross-validate: boost confidence for multi-source signals
  4. Write consolidated snapshot to signals_history.jsonl
  5. Output pipeline report
"""

import json, subprocess, sys, re, urllib.request
from datetime import datetime, timezone
from pathlib import Path
from collections import defaultdict

# ── Canonical evidence KB ─────────────────────────────────────────────────────
# For each topic: the best known primary evidence item (not today's random arXiv paper)
# Used as fallback when pipeline has no proof_id or the fetched title is irrelevant
CANONICAL_EVIDENCE = {
    'AI Agents': {
        'proof_id':   'arxiv-2309.07864',
        'source_url': 'https://arxiv.org/abs/2309.07864',
        'title':      'AgentBench: Evaluating LLMs as Agents',
    },
    'LLM Infrastructure': {
        'proof_id':   'arxiv-2309.06180',
        'source_url': 'https://arxiv.org/abs/2309.06180',
        'title':      'Efficient Memory Management for LLM Serving with PagedAttention (vLLM)',
    },
    'Diffusion Models': {
        'proof_id':   'arxiv-2112.10752',
        'source_url': 'https://arxiv.org/abs/2112.10752',
        'title':      'High-Resolution Image Synthesis with Latent Diffusion Models',
    },
    'AI Coding': {
        'proof_id':   'arxiv-2310.06770',
        'source_url': 'https://arxiv.org/abs/2310.06770',
        'title':      'SWE-bench: Can Language Models Resolve Real-World GitHub Issues?',
    },
    'Efficient AI': {
        'proof_id':   'arxiv-2404.14219',
        'source_url': 'https://arxiv.org/abs/2404.14219',
        'title':      'Phi-3 Technical Report: A Highly Capable Language Model Locally on Your Phone',
    },
    'Reinforcement Learning': {
        'proof_id':   'arxiv-2501.12599',
        'source_url': 'https://arxiv.org/abs/2501.12599',
        'title':      'DeepSeek-R1: Incentivizing Reasoning Capability in LLMs via RL',
    },
    'Transformer Architecture': {
        'proof_id':   'arxiv-2205.14135',
        'source_url': 'https://arxiv.org/abs/2205.14135',
        'title':      'FlashAttention: Fast and Memory-Efficient Exact Attention with IO-Awareness',
    },
    'Transformer Arch': {
        'proof_id':   'arxiv-2205.14135',
        'source_url': 'https://arxiv.org/abs/2205.14135',
        'title':      'FlashAttention: Fast and Memory-Efficient Exact Attention with IO-Awareness',
    },
    'AI Reasoning': {
        'proof_id':   'arxiv-2201.11903',
        'source_url': 'https://arxiv.org/abs/2201.11903',
        'title':      'Chain-of-Thought Prompting Elicits Reasoning in Large Language Models',
    },
    'Multimodal AI': {
        'proof_id':   'arxiv-2310.03744',
        'source_url': 'https://arxiv.org/abs/2310.03744',
        'title':      'LLaVA: Improved Baselines with Visual Instruction Tuning',
    },
    'AI Infrastructure': {
        'proof_id':   'github-vllm-project/vllm',
        'source_url': 'https://github.com/vllm-project/vllm',
        'title':      'vLLM: Easy, Fast, and Cheap LLM Serving for Everyone',
    },
}

# ── arXiv title resolver ──────────────────────────────────────────────────────
def resolve_arxiv_title(proof_id):
    """Extract arXiv ID from proof_id string and fetch its real paper title."""
    m = re.search(r'(\d{4}\.\d{4,5})', str(proof_id))
    if not m:
        return None
    arxiv_id = m.group(1)
    try:
        url = f'http://export.arxiv.org/api/query?id_list={arxiv_id}&max_results=1'
        with urllib.request.urlopen(url, timeout=6) as r:
            xml = r.read().decode()
        parts = xml.split('<entry>')
        if len(parts) < 2:
            return None
        entry = parts[1]
        tm = re.search(r'<title>(.*?)</title>', entry, re.DOTALL)
        if tm:
            title = re.sub(r'\s+', ' ', tm.group(1)).strip()
            # Reject generic feed titles
            if title and len(title) > 10 and 'arxiv query' not in title.lower():
                return title
    except Exception:
        pass
    return None

# ── Signal enrichment ─────────────────────────────────────────────────────────
def enrich_signal(signal):
    """
    Ensure every signal has a valid proof_id, source_url, and title.

    Strategy:
      - title + source_url: CANONICAL_EVIDENCE wins (curated, high-quality)
        — the daily arXiv paper found by keyword-matching may not be the best
          representative of the trend; canonical KB ensures consistently good titles.
      - proof_id: keep daily-fetched ID if present (it's valid evidence);
        fall back to canonical proof_id if none.
      - daily_proof_id: retain original pipeline proof_id as secondary field
        so the actual fetched source is not lost.
    """
    topic = signal.get('topic', '')
    canonical = CANONICAL_EVIDENCE.get(topic)

    # Preserve original daily evidence ID
    if signal.get('proof_id') and not signal.get('daily_proof_id'):
        signal['daily_proof_id'] = signal['proof_id']

    if canonical:
        signal['title']      = canonical['title']
        signal['source_url'] = canonical['source_url']
        # Only override proof_id if none present
        if not signal.get('proof_id'):
            signal['proof_id'] = canonical['proof_id']
    else:
        # No canonical — try live arXiv resolve as last resort
        if not signal.get('title') and signal.get('proof_id'):
            live_title = resolve_arxiv_title(signal['proof_id'])
            if live_title:
                signal['title'] = live_title
        if not signal.get('title'):
            signal['title'] = f'{topic} — emerging signal'

    return signal

ROOT = Path(__file__).resolve().parent.parent
SCRIPTS = ROOT / "scripts"
HISTORY = ROOT / "data" / "signals_history.jsonl"
RUNTIME = ROOT / "data" / "runtime"
RUNTIME.mkdir(parents=True, exist_ok=True)

FETCHERS = [
    ("research_to_signal.py",  "arXiv+GitHub",     "Tier0"),
    ("fetch_huggingface.py",   "HuggingFace",      "Tier0"),
    ("fetch_hackernews.py",    "HackerNews",       "Tier0"),
    ("fetch_npm_pypi.py",      "npm+PyPI",         "Tier0"),
    ("fetch_producthunt.py",   "ProductHunt",      "Tier1"),
    ("fetch_alphavantage.py",  "AlphaVantage",     "Tier1"),
    ("fetch_cryptopanic.py",   "CryptoPanic",      "Tier1"),
    ("fetch_serpapi.py",       "SerpAPI",          "Tier1"),
    ("fetch_fred.py",          "FRED",             "Tier1"),
    # Tier L1-L3: New source expanders (TASK-CEO-001 Track B)
    ("fetch_twitter_trends.py", "Twitter/X",       "TierL1"),
    ("fetch_reuters.py",        "Techmeme RSS",    "TierL1"),
    ("fetch_polymarket.py",     "Polymarket",      "TierL3"),
    ("fetch_reddit.py",         "Reddit",          "TierL2"),
]

def run_fetcher(script, label, tier):
    script_path = SCRIPTS / script
    if not script_path.exists():
        print(f"  [skip] {label} — script not found")
        return {"label": label, "tier": tier, "status": "skip", "count": 0}
    try:
        r = subprocess.run(
            [sys.executable, str(script_path)],
            capture_output=True, text=True, timeout=60
        )
        lines = r.stdout.strip().split("\n") if r.stdout.strip() else []
        last = lines[-1] if lines else ""
        count = 0
        try:
            d = json.loads(last)
            count = d.get("count", 0)
        except Exception:
            pass
        print(f"  [{tier}] {label}: {count} signals")
        return {"label": label, "tier": tier, "status": "ok", "count": count, "stdout": r.stdout[-500:]}
    except subprocess.TimeoutExpired:
        print(f"  [{tier}] {label}: TIMEOUT")
        return {"label": label, "tier": tier, "status": "timeout", "count": 0}
    except Exception as e:
        print(f"  [{tier}] {label}: ERROR {e}")
        return {"label": label, "tier": tier, "status": "error", "count": 0, "error": str(e)}

def load_all_signals():
    if not HISTORY.exists():
        return []
    signals = []
    with open(HISTORY) as f:
        for line in f:
            line = line.strip()
            if not line:
                continue
            try:
                signals.append(json.loads(line))
            except Exception:
                pass
    return signals

def deduplicate_and_crossvalidate(signals):
    """
    Group by topic. For each topic:
    - Collect all sources across records
    - Take max confidence as base
    - Boost confidence by 0.04 per additional source (cross-validation bonus)
    - Keep all evidence counts summed
    """
    by_topic = defaultdict(list)
    for s in signals:
        topic = s.get("topic","")
        if topic:
            by_topic[topic].append(s)

    merged = []
    for topic, group in by_topic.items():
        # Collect all sources
        all_sources = []
        for g in group:
            all_sources.extend(g.get("sources", []))
        unique_sources = list(dict.fromkeys(all_sources))  # dedup preserving order

        # Best record as base
        best = max(group, key=lambda x: x.get("confidence", 0))

        # Cross-validation boost
        # Normalize provider aliases before counting — arxiv_rss == arxiv, etc.
        PROVIDER_ALIASES = {
            'arxiv_rss':     'arxiv',
            'arxiv_api':     'arxiv',
            'hf':            'huggingface',
            'hf_models':     'huggingface',
            'hf_trending':   'huggingface',
            'gh':            'github',
            'gh_trending':   'github',
        }
        raw_providers = set(s.split(":")[0] for s in unique_sources)
        norm_providers = set(PROVIDER_ALIASES.get(p, p) for p in raw_providers)
        n_unique_sources = len(norm_providers)
        boost = (n_unique_sources - 1) * 0.04
        new_conf = round(min((best.get("confidence", 0.5) + boost), 0.97), 3)

        # Sum evidence
        total_ev = sum(g.get("evidenceCount", 0) or 0 for g in group)

        # Prefer record with title/proof_id for metadata fields
        best_meta = next((g for g in group if g.get('title') and g.get('proof_id')), best)

        merged_signal = {**best}
        # Carry over title/proof_id/source_url from best_meta if best is missing them
        for field in ('title', 'proof_id', 'source_url'):
            if not merged_signal.get(field) and best_meta.get(field):
                merged_signal[field] = best_meta[field]

        merged_signal["confidence"] = new_conf
        merged_signal["sources"] = unique_sources[:8]  # cap to 8
        merged_signal["evidenceCount"] = max(total_ev, best.get("evidenceCount", 1))
        merged_signal["cross_validated"] = n_unique_sources >= 2
        merged_signal["source_count"] = n_unique_sources
        merged_signal["merged_at"] = datetime.now(timezone.utc).isoformat()

        # Re-assign stage based on final confidence
        conf = new_conf
        if conf >= 0.90: stage = "accelerating"
        elif conf >= 0.78: stage = "accelerating"
        elif conf >= 0.65: stage = "forming"
        elif conf >= 0.50: stage = "emerging"
        else: stage = "weak"
        merged_signal["stage"] = stage

        merged.append(merged_signal)

    # Sort by confidence descending
    merged.sort(key=lambda x: x.get("confidence", 0), reverse=True)
    return merged

# Canonical topic normalization map — near-duplicate topic names → canonical name
TOPIC_ALIASES = {
    "Transformer Arch": "Transformer Architecture",
    "LLM Infra":        "LLM Infrastructure",
    "AI Infra":         "AI Infrastructure",
    "Diffusion":        "Diffusion Models",
    "Efficient AI Training": "Efficient AI",
}

def normalize_topics(signals):
    """Merge near-duplicate topics (e.g. 'Transformer Arch' → 'Transformer Architecture').
    After normalization, re-run dedup so merged records combine properly."""
    changed = False
    normalized = []
    for s in signals:
        topic = s.get("topic", "")
        canonical = TOPIC_ALIASES.get(topic)
        if canonical:
            s = {**s, "topic": canonical, "original_topic": topic}
            changed = True
        normalized.append(s)
    if changed:
        normalized = deduplicate_and_crossvalidate(normalized)
    return normalized

def write_snapshot(signals):
    """Overwrite JSONL with fresh deduplicated snapshot (bulk write)"""
    signals = normalize_topics(signals)
    with open(HISTORY, "w") as f:
        for s in signals:
            f.write(json.dumps(s) + "\n")
    print(f"[pipeline] wrote {len(signals)} signals to {HISTORY.name}")

def main():
    print(f"\n{'='*60}")
    print(f"Signal Market Pipeline v2  |  {datetime.now(timezone.utc).strftime('%Y-%m-%d %H:%M UTC')}")
    print(f"{'='*60}\n")

    # Step 1: Run all fetchers
    print("[1/4] Running fetchers...")
    results = []
    for script, label, tier in FETCHERS:
        r = run_fetcher(script, label, tier)
        results.append(r)

    # Step 2: Load all signals (appended by fetchers)
    print("\n[2/4] Loading signals from history...")
    raw_signals = load_all_signals()
    print(f"  raw: {len(raw_signals)} records")

    # Step 3: Deduplicate + cross-validate
    print("\n[3/4] Deduplicating and cross-validating...")
    final_signals = deduplicate_and_crossvalidate(raw_signals)
    cross_validated = sum(1 for s in final_signals if s.get("cross_validated"))
    print(f"  merged: {len(final_signals)} unique topics")
    print(f"  cross-validated: {cross_validated}/{len(final_signals)}")

    # Step 4: Enrich — ensure every signal has title, proof_id, source_url
    print("\n[4/5] Enriching signal metadata (title/proof_id/source_url)...")
    enriched = 0
    for s in final_signals:
        before = s.get('title', '')
        enrich_signal(s)
        if not before and s.get('title'):
            enriched += 1
    print(f"  enriched: {enriched} signals got title/proof_id from canonical KB or arXiv API")

    # Step 5: Write
    print("\n[5/5] Writing consolidated snapshot...")
    write_snapshot(final_signals)

    # Report
    report = {
        "pipeline_version": "2.0",
        "run_at": datetime.now(timezone.utc).isoformat(),
        "fetcher_results": results,
        "raw_records": len(raw_signals),
        "unique_signals": len(final_signals),
        "cross_validated": cross_validated,
        "top_signals": [
            {"topic": s["topic"], "confidence": s["confidence"], "sources": s.get("source_count",1)}
            for s in final_signals[:10]
        ],
    }

    (RUNTIME / "pipeline_v2_last_run.json").write_text(json.dumps(report, indent=2))

    print(f"\n{'='*60}")
    print(f"PIPELINE COMPLETE: {len(final_signals)} signals, {cross_validated} cross-validated")
    print(f"Top 5:")
    for s in final_signals[:5]:
        cv = "✓" if s.get("cross_validated") else "○"
        print(f"  {cv} {s['topic']:<30} conf={s['confidence']} stage={s['stage']}")
    print(f"{'='*60}\n")

    return report

if __name__ == "__main__":
    r = main()
    print(json.dumps({"status": "ok", "unique_signals": r["unique_signals"], "cross_validated": r["cross_validated"]}))
