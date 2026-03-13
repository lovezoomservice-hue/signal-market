#!/usr/bin/env python3
"""
One-time script to rewrite signals_history.jsonl with correct source_layer values.
Infers source_layer from source_tag or sources field.

Layer hierarchy (highest to lowest):
  L5 (Pro/VC) > L5b (Earnings) > L4 (Political) > L3b (Macro) > L3 (Polymarket) > L1 (Reuters) > L0 (HN)
"""
import json
import pathlib
from datetime import datetime

ROOT = pathlib.Path(__file__).parent.parent
JSONL = ROOT / "data" / "signals_history.jsonl"
JSONL_BACKUP = ROOT / "data" / "signals_history.jsonl.backup"

# Layer mappings from source_tag
L5_TAGS = {"greylock", "tc_venture", "tc_ai", "yc_blog", "mit_tr", "stratechery",
           "semianalysis", "benedict_evans", "not_boring", "dwarkesh", "professional_judgment"}
L5B_TAGS = {"earnings", "finance_news"}
L4_TAGS = {"thehill", "axios", "cnbc_tech", "political"}
L3B_TAGS = {"macro", "marketwatch", "cnbc"}
L3_TAGS = {"polymarket", "kalshi"}
L1_TAGS = {"reuters", "bbc", "techcrunch", "verge"}
L0_TAGS = {"hackernews", "hn"}

# Layer mappings from sources field (when source_tag missing)
L5_SOURCES = {"greylock", "a16z", "sequoia", "benchmark", "baseline", "foundation",
              "tc_ai", "stratechery", "semianalysis"}
L5B_SOURCES = {"earnings_call", "finance_news"}
L4_SOURCES = {"thehill", "axios", "politico", "washington_post"}
L3B_SOURCES = {"marketwatch", "cnbc", "yahoo_finance", "bloomberg"}
L3_SOURCES = {"polymarket", "kalshi", "predictit"}
L1_SOURCES = {"reuters", "bbc", "techcrunch", "the_verge", "associated_press"}
L0_SOURCES = {"hackernews", "news_ycombinator"}


def infer_source_layer(signal: dict) -> str:
    """
    Infer source_layer from source_tag or sources field.
    Returns highest layer that contributed to this signal.
    """
    source_tag = signal.get("source_tag", "")
    sources = signal.get("sources", [])

    # Normalize sources to lowercase strings
    source_list = []
    for s in sources:
        if isinstance(s, str):
            source_list.append(s.lower().split(":")[0])  # e.g., "arxiv:cs.AI" -> "arxiv"
        elif isinstance(s, dict):
            source_list.append(str(s.get("source", "")).lower())

    # Check source_tag first (most specific)
    if source_tag:
        tag = source_tag.lower()
        if tag in L5_TAGS:
            return "L5"
        if tag in L5B_TAGS:
            return "L5b"
        if tag in L4_TAGS:
            return "L4"
        if tag in L3B_TAGS:
            return "L3b"
        if tag in L3_TAGS:
            return "L3"
        if tag in L1_TAGS:
            return "L1"
        if tag in L0_TAGS:
            return "L0"

    # Fall back to sources field - find highest layer present
    has_l5 = any(s in L5_SOURCES for s in source_list)
    has_l5b = any(s in L5B_SOURCES for s in source_list)
    has_l4 = any(s in L4_SOURCES for s in source_list)
    has_l3b = any(s in L3B_SOURCES for s in source_list)
    has_l3 = any(s in L3_SOURCES for s in source_list)
    has_l1 = any(s in L1_SOURCES for s in source_list)
    has_l0 = any(s in L0_SOURCES for s in source_list)

    # Return highest layer present (L5 > L5b > L4 > L3b > L3 > L1 > L0)
    if has_l5:
        return "L5"
    if has_l5b:
        return "L5b"
    if has_l4:
        return "L4"
    if has_l3b:
        return "L3b"
    if has_l3:
        return "L3"
    if has_l1:
        return "L1"
    if has_l0:
        return "L0"

    # Default for research/arxiv/github signals (common in this dataset)
    # These are typically L0 (community signals) or can be inferred from category
    category = signal.get("category", "")
    if "research" in category.lower() or "arxiv" in str(sources):
        return "L0"  # Research community signals
    if "github" in str(sources):
        return "L0"

    return "L0"  # Default fallback


def rebuild_history():
    """Read signals_history.jsonl, add source_layer to each, write back."""
    if not JSONL.exists():
        print(f"ERROR: {JSONL} not found")
        return

    # Backup existing file
    import shutil
    shutil.copy(JSONL, JSONL_BACKUP)
    print(f"Backed up to {JSONL_BACKUP}")

    signals = []
    with open(JSONL, "r", encoding="utf-8") as f:
        for line in f:
            line = line.strip()
            if line:
                signals.append(json.loads(line))

    print(f"Loaded {len(signals)} signals")

    # Add source_layer to each signal
    updated = 0
    for signal in signals:
        if not signal.get("source_layer"):
            signal["source_layer"] = infer_source_layer(signal)
            updated += 1

    # Write back
    with open(JSONL, "w", encoding="utf-8") as f:
        for signal in signals:
            f.write(json.dumps(signal, ensure_ascii=False) + "\n")

    print(f"Updated {updated} signals with source_layer")

    # Show distribution
    distribution = {}
    for s in signals:
        layer = s.get("source_layer", "UNKNOWN")
        distribution[layer] = distribution.get(layer, 0) + 1

    print("\nSource layer distribution:")
    for layer in ["L5", "L5b", "L4", "L3b", "L3", "L1", "L0"]:
        count = distribution.get(layer, 0)
        if count > 0:
            print(f"  {layer}: {count}")


if __name__ == "__main__":
    print(f"Rebuilding signals_history.jsonl — {datetime.now().isoformat()}")
    rebuild_history()
    print("\nDone!")
