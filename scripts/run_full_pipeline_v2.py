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

import json, subprocess, sys
from datetime import datetime, timezone
from pathlib import Path
from collections import defaultdict

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
    ("fetch_alphavantage.py",  "AlphaVantage",     "Tier1"),
    ("fetch_cryptopanic.py",   "CryptoPanic",      "Tier1"),
    ("fetch_serpapi.py",       "SerpAPI",          "Tier1"),
    ("fetch_fred.py",          "FRED",             "Tier1"),
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
        n_unique_sources = len(set(s.split(":")[0] for s in unique_sources))
        boost = (n_unique_sources - 1) * 0.04
        new_conf = round(min((best.get("confidence", 0.5) + boost), 0.97), 3)

        # Sum evidence
        total_ev = sum(g.get("evidenceCount", 0) or 0 for g in group)

        merged_signal = {**best}
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

def write_snapshot(signals):
    """Overwrite JSONL with fresh deduplicated snapshot (bulk write)"""
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

    # Step 4: Write
    print("\n[4/4] Writing consolidated snapshot...")
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
