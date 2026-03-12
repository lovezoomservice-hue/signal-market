#!/usr/bin/env python3
"""
World Signals Master Fetcher — Signal Market Multi-Layer Source Aggregator
Combines L0 (HN), L1 (Reuters), L2 (Reddit), L3 (Polymarket) into merged signals.

Usage:
  python3 scripts/fetch_world_signals.py
  python3 scripts/fetch_world_signals.py --dry-run
  python3 scripts/fetch_world_signals.py --layers l0,l1,l2,l3

Layers:
  L0 = Hacker News (dev community)
  L1 = Reuters (news/media)
  L2 = Reddit (social/sentiment)
  L3 = Polymarket (prediction market)
"""
import sys, json, datetime, argparse, pathlib

ROOT   = pathlib.Path(__file__).parent.parent
OUTPUT = ROOT / "output"
JSONL  = ROOT / "data" / "signals_history.jsonl"

def run_world_signals_fetch(layers: list[str] | None = None, dry_run: bool = False) -> dict:
    today = datetime.date.today().isoformat()
    now   = datetime.datetime.utcnow().isoformat() + "Z"
    if layers is None:
        layers = ["l0", "l1", "l2", "l3"]

    all_new: list[dict] = []
    stats: dict[str, int] = {}

    # ── L0: Hacker News ──────────────────────────────────────────────────────
    if "l0" in layers:
        try:
            from scripts.fetch_hackernews import fetch_hn_signals
        except ImportError:
            sys.path.insert(0, str(ROOT))
            from scripts.fetch_hackernews import fetch_hn_signals
        try:
            sigs = fetch_hn_signals()
            all_new.extend(sigs)
            stats["l0_hackernews"] = len(sigs)
            print(f"  L0 HN:        {len(sigs)} signals")
        except Exception as e:
            print(f"  L0 HN ERROR:  {e}", file=sys.stderr)
            stats["l0_hackernews"] = 0

    # ── L1: Reuters ──────────────────────────────────────────────────────────
    if "l1" in layers:
        try:
            from scripts.fetch_reuters import fetch_reuters_signals
        except ImportError:
            from scripts.fetch_reuters import fetch_reuters_signals
        try:
            sigs = fetch_reuters_signals()
            all_new.extend(sigs)
            stats["l1_reuters"] = len(sigs)
            print(f"  L1 Reuters:   {len(sigs)} signals")
        except Exception as e:
            print(f"  L1 Reuters ERROR: {e}", file=sys.stderr)
            stats["l1_reuters"] = 0

    # ── L2: Reddit ───────────────────────────────────────────────────────────
    if "l2" in layers:
        try:
            from scripts.fetch_reddit import fetch_reddit_signals
        except ImportError:
            from scripts.fetch_reddit import fetch_reddit_signals
        try:
            sigs = fetch_reddit_signals()
            all_new.extend(sigs)
            stats["l2_reddit"] = len(sigs)
            print(f"  L2 Reddit:    {len(sigs)} signals")
        except Exception as e:
            print(f"  L2 Reddit ERROR: {e}", file=sys.stderr)
            stats["l2_reddit"] = 0

    # ── L3: Polymarket ───────────────────────────────────────────────────────
    if "l3" in layers:
        try:
            from scripts.fetch_polymarket import fetch_polymarket_signals
        except ImportError:
            from scripts.fetch_polymarket import fetch_polymarket_signals
        try:
            sigs = fetch_polymarket_signals()
            all_new.extend(sigs)
            stats["l3_polymarket"] = len(sigs)
            print(f"  L3 Polymarket:{len(sigs)} signals")
        except Exception as e:
            print(f"  L3 Polymarket ERROR: {e}", file=sys.stderr)
            stats["l3_polymarket"] = 0

    total_raw = len(all_new)

    # ── Merge: group by topic, aggregate sources ──────────────────────────────
    merged: dict[str, dict] = {}
    for s in all_new:
        topic = s.get("topic", "Unknown")
        if topic not in merged:
            merged[topic] = s.copy()
            merged[topic]["_evidence_items"] = [s]
        else:
            existing = merged[topic]
            # Merge sources
            existing_srcs = existing.get("sources", [])
            new_srcs = s.get("sources", [])
            for src in new_srcs:
                if src not in existing_srcs:
                    existing_srcs.append(src)
            existing["sources"] = existing_srcs
            existing["source_count"] = len(existing_srcs)
            # Take highest confidence
            if s.get("confidence", 0) > existing.get("confidence", 0):
                existing["confidence"] = s["confidence"]
                existing["source_url"] = s.get("source_url", existing.get("source_url"))
            # Accumulate evidence
            existing["evidence_count"] = existing.get("evidence_count", 0) + s.get("evidence_count", 0)
            # Cross-validate if 2+ different layers
            layers_seen = set(existing.get("source_layer","")) | {s.get("source_layer","")}
            existing["cross_validated"] = len(layers_seen) >= 2
            existing["_evidence_items"].append(s)

    merged_list = list(merged.values())

    # Clean up internal fields
    for s in merged_list:
        s.pop("_evidence_items", None)
        s["merged_at"] = now
        s["world_fetch_date"] = today

    print(f"\n  Total raw: {total_raw} → merged: {len(merged_list)} unique topics")

    if not dry_run:
        OUTPUT.mkdir(exist_ok=True)

        # Save daily world signals file
        daily_path = OUTPUT / f"world_signals_{today}.json"
        daily_path.write_text(json.dumps({
            "fetched_at": now,
            "layers": layers,
            "stats": stats,
            "total_raw": total_raw,
            "merged_count": len(merged_list),
            "signals": merged_list,
        }, indent=2, ensure_ascii=False))
        print(f"  ✓ Saved: {daily_path}")

        # Append to JSONL history
        JSONL.parent.mkdir(exist_ok=True)
        with JSONL.open("a", encoding="utf-8") as f:
            for s in merged_list:
                f.write(json.dumps(s, ensure_ascii=False) + "\n")
        print(f"  ✓ Appended {len(merged_list)} records to {JSONL.name}")

    return {
        "date": today,
        "layers": layers,
        "stats": stats,
        "total_raw": total_raw,
        "merged_count": len(merged_list),
        "signals": merged_list,
    }


def main():
    parser = argparse.ArgumentParser(description="World Signals Master Fetcher")
    parser.add_argument("--dry-run", action="store_true", help="Fetch but don't write files")
    parser.add_argument("--layers", default="l0,l1,l2,l3", help="Comma-separated layers: l0,l1,l2,l3")
    args = parser.parse_args()

    layers = [l.strip().lower() for l in args.layers.split(",")]
    print(f"World Signals Fetch — {datetime.date.today().isoformat()} layers={layers}")
    result = run_world_signals_fetch(layers=layers, dry_run=args.dry_run)
    print(f"\n{'[DRY_RUN] ' if args.dry_run else ''}✅ World signals complete: {result['merged_count']} merged topics")
    for k, v in result["stats"].items():
        print(f"  {k}: {v}")

if __name__ == "__main__":
    main()
