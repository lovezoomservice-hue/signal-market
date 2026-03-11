#!/usr/bin/env python3
"""Auto-inject today's research signals into api/signals.js"""
import json, re, datetime
from pathlib import Path

TODAY = datetime.date.today().isoformat()
intake_path = Path("output") / f"research_intake_{TODAY}.json"
if not intake_path.exists():
    print(f"No intake file for {TODAY}, running research_to_signal.py...")
    import subprocess
    subprocess.run(["python3", "scripts/research_to_signal.py"])

data = json.loads(intake_path.read_text())
signals = data["signals"]

with open("api/signals.js") as f:
    content = f.read()

lines = ["const REAL_SIGNALS = ["]
for s in signals:
    lines.append(
        f"  {{ topic: {json.dumps(s['topic'])}, stage: {json.dumps(s['stage'])}, "
        f"confidence: {s['confidence']}, impact_score: {s['impact_score']}, "
        f"evidenceCount: {s['evidence_count']}, sources: {json.dumps(s['sources'])}, "
        f"proof_id: {json.dumps(s['proof_id'])}, source_url: {json.dumps(s['source_url'])}, "
        f"category: {json.dumps(s['category'])}, first_seen: {json.dumps(s['first_seen'])} }},"
    )
lines.append("];")
new_block = "\n".join(lines)

new_content = re.sub(r"const REAL_SIGNALS = \[.*?\];", new_block, content, flags=re.DOTALL)
with open("api/signals.js", "w") as f:
    f.write(new_content)

print(f"Injected {len(signals)} signals from {TODAY} into api/signals.js")
