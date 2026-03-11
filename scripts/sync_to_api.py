#!/usr/bin/env python3
"""
P0-1: Pipeline → API Bridge
---------------------------
读取 pipeline 最新输出（output/research_intake_*.json + arXiv RSS）
→ 写入 api/_data.js
→ git commit + push
→ Vercel 自动部署（Pipeline → API 真正接通）

Usage:
  python3 scripts/sync_to_api.py [--dry-run]
"""

import json, re, sys, subprocess, datetime, urllib.request
from pathlib import Path

DRY_RUN  = "--dry-run" in sys.argv
REPO     = Path(__file__).parent.parent
OUTPUT   = REPO / "output"
DATA_JS  = REPO / "api" / "_data.js"
TODAY    = datetime.date.today().isoformat()

# ── Step 1: Load latest pipeline output ─────────────────────────────────────

def load_pipeline_signals():
    """Load signals from most recent research_intake_*.json"""
    files = sorted(OUTPUT.glob("research_intake_*.json"), reverse=True)
    if not files:
        print("[sync] No research_intake files found")
        return []
    latest = files[0]
    try:
        data = json.loads(latest.read_text())
        sigs = data if isinstance(data, list) else data.get("signals", [])
        print(f"[sync] Loaded {len(sigs)} signals from {latest.name}")
        return sigs
    except Exception as e:
        print(f"[sync] Failed to load {latest}: {e}")
        return []

# ── Step 2: arXiv RSS fetch (fallback, best-effort) ─────────────────────────

def fetch_arxiv_rss(categories=("cs.AI", "cs.LG", "cs.CL"), max_per_cat=10):
    """Fetch recent arXiv papers via RSS"""
    papers = []
    for cat in categories:
        url = f"https://rss.arxiv.org/rss/{cat}"
        try:
            with urllib.request.urlopen(url, timeout=10) as r:
                xml = r.read().decode(errors="replace")
            # Extract titles and arXiv IDs
            items = re.findall(r"<item>(.*?)</item>", xml, re.DOTALL)
            for item in items[:max_per_cat]:
                title_m = re.search(r"<title>(.*?)</title>", item, re.DOTALL)
                link_m  = re.search(r"<link>(.*?)</link>", item)
                arxiv_m = re.search(r"arxiv\.org/abs/([\d\.]+)", item)
                if title_m and arxiv_m:
                    papers.append({
                        "title":    title_m.group(1).strip(),
                        "arxiv_id": arxiv_m.group(1),
                        "link":     link_m.group(1).strip() if link_m else f"https://arxiv.org/abs/{arxiv_m.group(1)}",
                        "cat":      cat,
                    })
            print(f"[sync] arXiv {cat}: {len(items[:max_per_cat])} papers")
        except Exception as e:
            print(f"[sync] arXiv {cat} timeout/error: {e}")
    return papers

# ── Step 3: Classify arXiv papers into signals ───────────────────────────────

TOPIC_KEYWORDS = {
    "AI Agents":          ["agent", "multi-agent", "autonomous", "agentic", "llm agent"],
    "LLM Infrastructure": ["llm", "language model", "transformer", "attention", "pretraining"],
    "AI Coding":          ["code", "coding", "program", "synthesis", "software"],
    "AI Reasoning":       ["reasoning", "chain-of-thought", "cot", "logic", "math"],
    "Multimodal AI":      ["multimodal", "vision", "image", "audio", "video"],
    "Transformer Arch":   ["transformer", "architecture", "scaling", "efficiency"],
    "Efficient AI":       ["efficient", "distill", "compress", "quantiz", "pruning"],
    "Reinforcement Learning": ["reinforcement", "rl", "reward", "policy", "bandit"],
    "AI Safety":          ["safety", "alignment", "hallucin", "robust", "bias"],
    "Diffusion Models":   ["diffusion", "generative", "denoising", "stable diffusion"],
}

def classify_papers(papers):
    """Group arXiv papers into topic signals with evidence"""
    topic_evidence = {}
    for p in papers:
        text = p["title"].lower()
        for topic, kws in TOPIC_KEYWORDS.items():
            if any(kw in text for kw in kws):
                if topic not in topic_evidence:
                    topic_evidence[topic] = []
                topic_evidence[topic].append(p)
                break

    signals = []
    for topic, evidences in topic_evidence.items():
        count = len(evidences)
        best  = evidences[0]
        conf  = min(0.98, 0.65 + count * 0.04)
        stage = "accelerating" if conf > 0.85 else ("forming" if conf > 0.72 else "emerging")
        signals.append({
            "topic":         topic,
            "stage":         stage,
            "confidence":    round(conf, 2),
            "impact_score":  round(conf - 0.05, 2),
            "evidenceCount": count,
            "sources":       [f"arxiv:{best['cat']}", "arxiv_rss"],
            "proof_id":      f"research-{TODAY}-{best['arxiv_id']}",
            "source_url":    best["link"],
            "category":      "AI Research",
            "first_seen":    TODAY,
        })
    signals.sort(key=lambda x: x["confidence"], reverse=True)
    return signals

# ── Step 4: Merge pipeline + arXiv signals ──────────────────────────────────

def merge_signals(pipeline_sigs, arxiv_sigs):
    """Merge, deduplicate by topic, prefer higher confidence"""
    merged = {s["topic"]: s for s in pipeline_sigs}
    for s in arxiv_sigs:
        topic = s["topic"]
        if topic not in merged or s["confidence"] > merged[topic]["confidence"]:
            merged[topic] = s
    result = sorted(merged.values(), key=lambda x: x["confidence"], reverse=True)
    return result[:15]  # cap at 15 signals

# ── Step 5: Write api/_data.js ───────────────────────────────────────────────

def signals_to_js(signals):
    """Format signals as JS module"""
    ts = datetime.datetime.utcnow().isoformat()[:19] + "Z"
    lines = [
        f"// AUTO-GENERATED by scripts/sync_to_api.py — {ts}",
        f"// DO NOT EDIT MANUALLY — run: python3 scripts/sync_to_api.py",
        "",
        "export const REAL_SIGNALS = [",
    ]
    for s in signals:
        srcs = json.dumps(s.get("sources", []))
        lines.append(
            f'  {{ topic: {json.dumps(s["topic"])}, stage: {json.dumps(s["stage"])}, '
            f'confidence: {s["confidence"]}, impact_score: {s.get("impact_score", round(s["confidence"]-0.05,2))}, '
            f'evidenceCount: {s.get("evidenceCount", s.get("evidence_count", 1))}, sources: {srcs}, '
            f'proof_id: {json.dumps(s["proof_id"])}, source_url: {json.dumps(s["source_url"])}, '
            f'category: {json.dumps(s.get("category","AI Research"))}, first_seen: {json.dumps(s["first_seen"])} }},'
        )
    lines.append("];")
    lines.append("")
    lines.append("export const DATA_META = {")
    lines.append(f'  updated_at:       {json.dumps(TODAY)},')
    lines.append(f'  synced_at:        {json.dumps(ts)},')
    lines.append(f'  signal_count:     {len(signals)},')
    lines.append(f'  inputs_hash:      REAL_SIGNALS.map(s => s.proof_id).join("|").split("").reduce((a,c)=>((a<<5)-a+c.charCodeAt(0))|0,0).toString(16).replace("-",""),')
    lines.append(f'  source:           "arxiv_rss + github_trending + pipeline",')
    lines.append(f'  pipeline_version: "v1.1.0",')
    lines.append("};")
    lines.append("")
    # Add view functions (copy from current _data.js)
    lines.append("""export function getSignals({ stage, limit } = {}) {
  let s = [...REAL_SIGNALS];
  if (stage) s = s.filter(x => x.stage === stage);
  s.sort((a,b) => b.confidence - a.confidence);
  if (limit) s = s.slice(0, parseInt(limit));
  return s;
}

export function getTopics() {
  return REAL_SIGNALS.map(s => ({
    id:         s.topic.toLowerCase().replace(/\\s+/g, '-'),
    name:       s.topic,
    stage:      s.stage,
    confidence: s.confidence,
    proof_id:   s.proof_id,
    source_url: s.source_url,
    updated_at: DATA_META.updated_at,
  }));
}

export function getTrends({ limit } = {}) {
  const stageScore = { accelerating:1.0, peak:0.9, forming:0.7, emerging:0.5, fading:0.3, weak:0.1 };
  return REAL_SIGNALS.map(s => ({
    topic:       s.topic,
    stage:       s.stage,
    trend_score: parseFloat((s.confidence * (stageScore[s.stage] || 0.5)).toFixed(3)),
    velocity:    parseFloat((s.evidenceCount / 10).toFixed(2)),
    confidence:  s.confidence,
    proof_id:    s.proof_id,
    source_url:  s.source_url,
    updated_at:  DATA_META.updated_at,
  })).sort((a,b) => b.trend_score - a.trend_score).slice(0, limit ? parseInt(limit) : 20);
}

export function getEvents({ topic, limit } = {}) {
  let s = [...REAL_SIGNALS];
  if (topic) s = s.filter(x => x.topic.toLowerCase().includes(topic.toLowerCase()));
  if (limit) s = s.slice(0, parseInt(limit));
  return s.map((x, i) => ({
    event_id:      `evt_${String(i+1).padStart(3,'0')}`,
    topic:          x.topic,
    stage:          x.stage,
    probability:    x.confidence,
    evidence_count: x.evidenceCount,
    evidence_refs:  [x.proof_id],
    proof_id:       x.proof_id,
    source_url:     x.source_url,
    updated_at:     DATA_META.updated_at,
    timestamp:      new Date().toISOString(),
  }));
}

export function getEvent(id) {
  const idx = parseInt((id || '').replace('evt_',''), 10) - 1;
  if (idx >= 0 && idx < REAL_SIGNALS.length) {
    const x = REAL_SIGNALS[idx];
    return {
      event_id:       id,
      topic:           x.topic,
      stage:           x.stage,
      probability:     x.confidence,
      evidence_count:  x.evidenceCount,
      evidence_refs:   [x.proof_id],
      proof_id:        x.proof_id,
      source_url:      x.source_url,
      snapshot_url:    x.source_url,
      updated_at:      DATA_META.updated_at,
    };
  }
  return null;
}
""")
    return "\n".join(lines)

# ── Step 6: Git commit + push ────────────────────────────────────────────────

def git_push(signal_count):
    cmds = [
        ["git", "add", "api/_data.js"],
        ["git", "commit", "-m",
         f"data: pipeline sync {TODAY} — {signal_count} signals [auto]"],
        ["git", "push"],
    ]
    for cmd in cmds:
        r = subprocess.run(cmd, cwd=REPO, capture_output=True, text=True)
        if r.returncode != 0:
            if "nothing to commit" in r.stdout + r.stderr:
                print("[sync] Nothing to commit (data unchanged)")
                return True
            print(f"[sync] git error: {r.stderr}")
            return False
    print(f"[sync] Pushed to GitHub — Vercel will auto-deploy")
    return True

# ── Main ──────────────────────────────────────────────────────────────────────

def main():
    print(f"[sync] === Pipeline → API sync {TODAY} ===")

    # 1. Load existing pipeline output
    pipeline_sigs = load_pipeline_signals()

    # 2. Fetch fresh arXiv signals
    papers = fetch_arxiv_rss()
    arxiv_sigs = classify_papers(papers)
    print(f"[sync] arXiv signals classified: {len(arxiv_sigs)}")

    # 3. Merge
    signals = merge_signals(pipeline_sigs, arxiv_sigs)
    print(f"[sync] Final signal count: {len(signals)}")
    for s in signals:
        print(f"  [{s['stage'][:4]}] {s['topic']:25s} conf={s['confidence']} ev={s.get('evidenceCount', s.get('evidence_count', '?'))}")

    if not signals:
        print("[sync] ERROR: No signals produced. Aborting.")
        sys.exit(1)

    # 4. Write _data.js
    js_content = signals_to_js(signals)
    if DRY_RUN:
        print("[sync] DRY-RUN: would write api/_data.js:")
        print(js_content[:500] + "...")
        return

    DATA_JS.write_text(js_content)
    print(f"[sync] Wrote api/_data.js ({len(js_content)} bytes, {len(signals)} signals)")

    # 5. Git push → Vercel deploys
    ok = git_push(len(signals))
    if ok:
        print(f"[sync] P0-1 COMPLETE: pipeline output → api/_data.js → GitHub → Vercel")
    else:
        print(f"[sync] P0-1 PARTIAL: file written but git push failed")

if __name__ == "__main__":
    main()
