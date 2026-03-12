#!/usr/bin/env python3
"""
autonomous_research.py — Multi-hop autonomous research fetcher
Inspired by karpathy/autoresearch: self-directed query expansion + signal extraction.

Flow:
  seed topics → arXiv search → extract keyphrases → expand queries → re-search
  → score & deduplicate → write to signals_history.jsonl

Usage:
  python3 scripts/autonomous_research.py [--dry-run] [--topics "AI Agents,LLM Infrastructure"]
"""

import json, sys, re, hashlib, datetime, urllib.request, urllib.parse, time, argparse
from pathlib import Path
from collections import defaultdict

ROOT     = Path(__file__).parent.parent
JSONL    = ROOT / "data" / "signals_history.jsonl"
OUTPUT   = ROOT / "output"

# Seed topics → initial queries
SEED_QUERIES = {
    # ── L0: AI / Research / Dev (core) ──────────────────────────────────────
    "AI Agents":                 ["autonomous AI agents LLM", "multi-agent systems tool use 2026"],
    "LLM Infrastructure":        ["large language model inference optimization", "LLM serving vLLM scalability"],
    "AI Reasoning":              ["chain-of-thought reasoning LLM", "inference time compute scaling o1 o3"],
    "Efficient AI":              ["efficient neural network training", "model compression quantization 2026"],
    "Reinforcement Learning":    ["reinforcement learning from human feedback RLHF", "reward model preference optimization"],
    "Diffusion Models":          ["diffusion model image video generation 2026", "stable diffusion flux architecture"],
    "AI Coding":                 ["code generation LLM benchmark", "AI programming assistant SWE-bench"],
    "Transformer Architecture":  ["transformer alternatives SSM Mamba", "mixture of experts MoE LLM scaling"],
    "Multimodal AI":             ["multimodal large language model vision language", "GPT-4V Gemini omni 2026"],
    "AI Infrastructure":         ["AI compute infrastructure GPU cluster", "ML platform orchestration Kubernetes"],

    # ── L4: Frontier Technology Verticals (new) ───────────────────────────
    "Robotics & Embodied AI":    ["embodied AI robot foundation model manipulation", "humanoid robot learning 2026"],
    "Brain-Computer Interface":  ["brain computer interface neural decoding 2026", "Neuralink non-invasive BCI"],
    "Commercial Space & AI":     ["AI edge inference satellite constellation 2026", "SpaceX reusable rocket launch"],
    "AI Chips & Custom Silicon": ["custom AI accelerator inference chip 2026", "Cerebras Groq Tenstorrent performance"],
    "Autonomous Vehicles":       ["end-to-end neural autonomous driving 2026", "Waymo Tesla FSD robotaxi fleet"],

    # ── L2: Social / Sentiment (research angle) ───────────────────────────
    "AI Policy & Governance":    ["AI safety alignment regulation 2026", "AGI risk governance policy"],
    "AI Investment & Capital":   ["AI startup funding valuation 2026", "LLM company acquisition IPO"],
}

def arxiv_search(query: str, max_results: int = 5) -> list[dict]:
    """Search arXiv and return list of {title, abstract, authors, published, url}."""
    q = urllib.parse.quote(query)
    url = f"https://export.arxiv.org/api/query?search_query=all:{q}&sortBy=relevance&sortOrder=descending&max_results={max_results}"
    try:
        raw = urllib.request.urlopen(url, timeout=10).read().decode()
    except Exception as e:
        print(f"  arXiv error: {e}", file=sys.stderr)
        return []

    entries = []
    for block in re.findall(r'<entry>(.*?)</entry>', raw, re.DOTALL):
        title    = re.search(r'<title>(.*?)</title>', block, re.DOTALL)
        abstract = re.search(r'<summary>(.*?)</summary>', block, re.DOTALL)
        pub      = re.search(r'<published>(.*?)</published>', block)
        link     = re.search(r'<id>(.*?)</id>', block)
        if title:
            entries.append({
                "title":    title.group(1).strip().replace('\n', ' '),
                "abstract": (abstract.group(1).strip()[:200] if abstract else ""),
                "published": (pub.group(1)[:10] if pub else ""),
                "url":      (link.group(1).strip() if link else ""),
            })
    return entries

def extract_keyphrases(papers: list[dict]) -> list[str]:
    """Extract likely important keyphrases from paper titles/abstracts for hop-2 queries."""
    text = " ".join(p["title"] + " " + p["abstract"] for p in papers)
    # Simple: extract capitalized noun phrases and technical terms
    phrases = re.findall(r'\b(?:[A-Z][a-z]+(?:\s+[A-Z][a-z]+)+|[A-Z]{2,}(?:-[A-Z0-9]+)*)\b', text)
    freq = defaultdict(int)
    for p in phrases:
        if len(p) > 3:
            freq[p] += 1
    top = sorted(freq.items(), key=lambda x: -x[1])[:5]
    return [p for p, _ in top]

def score_topic(topic: str, papers: list[dict], hop: int) -> float:
    """Score confidence from paper count, recency, relevance."""
    if not papers:
        return 0.0
    recent = sum(1 for p in papers if p.get("published", "") >= "2026-01")
    base   = min(0.95, 0.60 + len(papers) * 0.05 + recent * 0.03)
    hop_bonus = 0.04 if hop >= 2 else 0.0
    return round(min(0.97, base + hop_bonus), 3)

def load_existing() -> dict:
    if not JSONL.exists():
        return {}
    existing = {}
    for line in JSONL.read_text().splitlines():
        try:
            s = json.loads(line)
            if s.get("topic"):
                existing[s["topic"]] = s
        except Exception:
            pass
    return existing

def run(dry_run=False, topics_filter=None):
    print(f"Autonomous Research Fetcher {'[DRY_RUN]' if dry_run else ''}")
    existing = load_existing()
    today    = datetime.date.today().isoformat()

    seeds    = SEED_QUERIES
    if topics_filter:
        seeds = {t: q for t, q in SEED_QUERIES.items() if t in topics_filter}

    results = {}

    for topic, queries in seeds.items():
        print(f"\n  → {topic}", file=sys.stderr)

        # Hop 1: seed queries
        all_papers = []
        for q in queries:
            papers = arxiv_search(q, max_results=4)
            all_papers.extend(papers)
            time.sleep(0.3)

        # Hop 2: expand from extracted keyphrases
        keyphrases = extract_keyphrases(all_papers)
        if keyphrases:
            print(f"    keyphrases: {keyphrases[:3]}", file=sys.stderr)
            for kp in keyphrases[:2]:
                expanded = arxiv_search(f"{kp} 2026", max_results=3)
                all_papers.extend(expanded)
                time.sleep(0.3)

        # Deduplicate by URL
        seen_urls = set()
        unique_papers = []
        for p in all_papers:
            if p["url"] not in seen_urls:
                seen_urls.add(p["url"])
                unique_papers.append(p)

        conf  = score_topic(topic, unique_papers, hop=2 if keyphrases else 1)
        recent_count = sum(1 for p in unique_papers if p.get("published", "") >= "2026-01")

        results[topic] = {
            "topic":      topic,
            "confidence": conf,
            "paper_count": len(unique_papers),
            "recent_2026": recent_count,
            "top_papers": [p["title"] for p in unique_papers[:3]],
            "source":     "autonomous_research",
        }
        print(f"    papers={len(unique_papers)} recent={recent_count} conf={conf}", file=sys.stderr)

    # Enrich existing JSONL signals with autonomous research evidence
    OUTPUT.mkdir(exist_ok=True)
    report_path = OUTPUT / f"autonomous_research_{today}.json"

    updated = 0
    for topic, res in results.items():
        if topic in existing:
            sig = existing[topic]
            # Add source if not present
            sources = sig.get("sources", [])
            ar_source = f"autonomous_research:{topic.lower().replace(' ','_')}"
            if ar_source not in sources:
                sources.append(ar_source)
                sig["sources"] = sources
                sig["autonomous_research"] = {
                    "paper_count": res["paper_count"],
                    "recent_2026": res["recent_2026"],
                    "top_papers":  res["top_papers"],
                    "run_date":    today,
                }
                existing[topic] = sig
                updated += 1

    if not dry_run and updated > 0:
        # Rewrite JSONL with enriched data
        with open(JSONL, "w") as f:
            for sig in existing.values():
                f.write(json.dumps(sig, ensure_ascii=False) + "\n")
        print(f"\n  ✓ Updated {updated} signals with autonomous research evidence")

    # Save report
    report = {
        "run_date":    today,
        "dry_run":     dry_run,
        "topics":      len(results),
        "updated_signals": updated,
        "results":     results,
    }
    if not dry_run:
        report_path.write_text(json.dumps(report, indent=2, ensure_ascii=False))
        print(f"  ✓ Report: {report_path}")

    print(f"\n{'[DRY_RUN] ' if dry_run else ''}✅ Autonomous research complete: {len(results)} topics enriched")
    return report

if __name__ == "__main__":
    parser = argparse.ArgumentParser()
    parser.add_argument("--dry-run", action="store_true")
    parser.add_argument("--topics", help="Comma-separated topic filter")
    args = parser.parse_args()
    topics = [t.strip() for t in args.topics.split(",")] if args.topics else None
    run(dry_run=args.dry_run, topics_filter=topics)
