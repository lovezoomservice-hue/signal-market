#!/usr/bin/env python3
"""Append today's signals to data/signals_history.jsonl"""
import json, datetime
from pathlib import Path

TODAY = datetime.date.today().isoformat()
intake_path = Path("output") / f"research_intake_{TODAY}.json"
if not intake_path.exists():
    print(f"No intake for {TODAY}")
    exit(0)

intake = json.loads(intake_path.read_text())
HISTORY = Path("data") / "signals_history.jsonl"
Path("data").mkdir(exist_ok=True)

existing_dates = set()
if HISTORY.exists():
    for line in HISTORY.read_text().splitlines():
        try: existing_dates.add(json.loads(line).get("date",""))
        except: pass

if TODAY not in existing_dates:
    with open(HISTORY, "a") as f:
        f.write(json.dumps({
            "date": TODAY, "signals": intake["signals"],
            "count": len(intake["signals"]), "collected": intake["collected"],
        }, ensure_ascii=False) + "\n")
    print(f"Appended {len(intake['signals'])} signals for {TODAY}")
else:
    print(f"Already have {TODAY}")
