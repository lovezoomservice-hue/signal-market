#!/usr/bin/env python3
"""
Check Layers — Verify signals by layer in signals_history.jsonl
"""
import json
from pathlib import Path
from collections import defaultdict

JSONL = Path(__file__).parent.parent / "data" / "signals_history.jsonl"

def check_layers():
    if not JSONL.exists():
        print(f"ERROR: {JSONL} not found")
        return

    layers = defaultdict(list)

    with JSONL.open("r", encoding="utf-8") as f:
        for line in f:
            signal = json.loads(line.strip())
            layer = signal.get("source_layer", "Unknown")
            layers[layer].append(signal)

    print("=" * 60)
    print("SIGNAL LAYERS SUMMARY")
    print("=" * 60)

    LAYER_ORDER = ["L5", "L5b", "L4", "L3b", "L3", "L1", "L0"]

    total = 0
    for layer in LAYER_ORDER:
        signals = layers.get(layer, [])
        count = len(signals)
        total += count
        if count > 0:
            topics = [s.get("topic", "Unknown") for s in signals[:3]]
            print(f"{layer}: {count} signals")
            print(f"    Topics: {', '.join(topics)}{'...' if len(signals) > 3 else ''}")

    # Show any other layers
    for layer, signals in layers.items():
        if layer not in LAYER_ORDER:
            print(f"{layer}: {len(signals)} signals")
            total += len(signals)

    print("=" * 60)
    print(f"TOTAL: {total} signals in history")

    # Show layer distribution from last fetch
    print("\n" + "=" * 60)
    print("LATEST FETCH BREAKDOWN (from output/world_signals_*.json)")
    print("=" * 60)

    output_dir = Path(__file__).parent.parent / "output"
    latest = max(output_dir.glob("world_signals_*.json"), key=lambda p: p.stat().st_mtime, default=None)

    if latest:
        with latest.open("r", encoding="utf-8") as f:
            data = json.load(f)
        print(f"File: {latest.name}")
        print(f"Total raw: {data.get('total_raw', 0)}")
        print(f"Merged: {data.get('merged_count', 0)}")
        print("\nBy layer:")
        for layer, count in data.get("stats", {}).items():
            print(f"  {layer}: {count}")

if __name__ == "__main__":
    check_layers()
