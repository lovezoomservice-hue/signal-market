#!/usr/bin/env python3
"""
D3: Research → Signal Minimal Pipeline
arXiv cs.AI/cs.LG/cs.CL top papers + GitHub Trending AI repos
→ intake_decision.json → inject into api/signals.js

Usage: python3 scripts/research_to_signal.py
"""

import json, re, datetime, urllib.request, urllib.parse
from pathlib import Path

WORKSPACE = Path(__file__).parent.parent
OUTPUT    = WORKSPACE / "output"
OUTPUT.mkdir(exist_ok=True)

TODAY = datetime.date.today().isoformat()

# ── arXiv fetch ──────────────────────────────────────────────────────────────
def fetch_arxiv(cat="cs.AI", max_results=10):
    url = (
        f"https://export.arxiv.org/api/query"
        f"?search_query=cat:{cat}&sortBy=submittedDate&sortOrder=descending&max_results={max_results}"
    )
    try:
        with urllib.request.urlopen(url, timeout=15) as r:
            xml = r.read().decode()
        entries = re.findall(r"<entry>(.*?)</entry>", xml, re.DOTALL)
        papers = []
        for e in entries:
            title = re.search(r"<title>(.*?)</title>", e, re.DOTALL)
            arxiv_id = re.search(r"<id>https://arxiv.org/abs/([^<]+)</id>", e)
            summary  = re.search(r"<summary>(.*?)</summary>", e, re.DOTALL)
            published= re.search(r"<published>(.*?)</published>", e)
            if title and arxiv_id:
                papers.append({
                    "id":        arxiv_id.group(1).strip(),
                    "title":     re.sub(r"\s+", " ", title.group(1)).strip(),
                    "summary":   re.sub(r"\s+", " ", summary.group(1)).strip()[:300] if summary else "",
                    "published": published.group(1).strip() if published else "",
                    "url":       f"https://arxiv.org/abs/{arxiv_id.group(1).strip()}",
                    "source":    f"arxiv:{cat}",
                })
        return papers
    except Exception as e:
        print(f"arXiv {cat} fetch error: {e}")
        return []

# ── GitHub Trending ──────────────────────────────────────────────────────────
def fetch_github_trending():
    url = "https://api.github.com/search/repositories?q=AI+language:Python&sort=stars&order=desc&per_page=10"
    try:
        req = urllib.request.Request(url, headers={"User-Agent": "signal-market/1.0"})
        with urllib.request.urlopen(req, timeout=15) as r:
            data = json.loads(r.read())
        repos = []
        for item in data.get("items", [])[:10]:
            repos.append({
                "id":          f"gh-{item['full_name'].replace('/','-')}",
                "title":       item["full_name"],
                "summary":     (item.get("description") or "")[:200],
                "stars":       item["stargazers_count"],
                "url":         item["html_url"],
                "source":      "github:trending",
            })
        return repos
    except Exception as e:
        print(f"GitHub fetch error: {e}")
        return []

# ── Signal scoring ────────────────────────────────────────────────────────────
SIGNAL_KEYWORDS = {
    "agent":       ("AI Agents",          "accelerating", 0.85),
    "memory":      ("AI Memory Systems",  "emerging",     0.78),
    "multimodal":  ("Multimodal AI",      "forming",      0.72),
    "reasoning":   ("AI Reasoning",       "forming",      0.75),
    "rlhf":        ("RLHF / Alignment",   "emerging",     0.80),
    "fine-tun":    ("LLM Fine-tuning",    "accelerating", 0.77),
    "transformer": ("Transformer Arch",   "peak",         0.70),
    "diffusion":   ("Diffusion Models",   "accelerating", 0.76),
    "robot":       ("AI Robotics",        "forming",      0.82),
    "code":        ("AI Coding",          "accelerating", 0.88),
    "llm":         ("LLM Infrastructure", "accelerating", 0.83),
}

def classify_item(item):
    text = (item["title"] + " " + item["summary"]).lower()
    for kw, (topic, stage, base_score) in SIGNAL_KEYWORDS.items():
        if kw in text:
            return topic, stage, base_score
    return None, None, None

def make_signal(item, topic, stage, base_score, rank):
    return {
        "topic":         topic,
        "stage":         stage,
        "confidence":    round(base_score - rank * 0.02, 2),
        "impact_score":  round(base_score + 0.05, 2),
        "evidence_count": 1,
        "sources":       [item["source"]],
        "proof_id":      f"research-{TODAY}-{item['id'][:20]}",
        "source_url":    item.get("url", ""),
        "title":         item["title"],
        "category":      "AI Research",
        "first_seen":    TODAY,
    }

# ── Main ───────────────────────────────────────────────────────────────────────
def main():
    print(f"[D3] Research → Signal pipeline — {TODAY}")

    # Collect
    papers_ai  = fetch_arxiv("cs.AI", 10)
    papers_lg  = fetch_arxiv("cs.LG", 5)
    papers_cl  = fetch_arxiv("cs.CL", 5)
    gh_repos   = fetch_github_trending()
    all_items  = papers_ai + papers_lg + papers_cl + gh_repos

    print(f"  Collected: {len(papers_ai)} cs.AI, {len(papers_lg)} cs.LG, "
          f"{len(papers_cl)} cs.CL, {len(gh_repos)} GitHub repos")

    # Classify
    signals = []
    seen_topics = {}
    for rank, item in enumerate(all_items):
        topic, stage, score = classify_item(item)
        if not topic:
            continue
        if topic in seen_topics:
            # aggregate evidence
            existing = seen_topics[topic]
            existing["evidence_count"] += 1
            existing["confidence"] = min(0.99, existing["confidence"] + 0.03)
            continue
        sig = make_signal(item, topic, stage, score, rank)
        signals.append(sig)
        seen_topics[topic] = sig

    # Write intake decision
    decision = {
        "date":        TODAY,
        "collected":   len(all_items),
        "classified":  len(signals),
        "signals":     signals,
    }
    out_path = OUTPUT / f"research_intake_{TODAY}.json"
    out_path.write_text(json.dumps(decision, indent=2, ensure_ascii=False))
    print(f"  intake_decision → {out_path}")
    print(f"  Signals generated: {len(signals)}")
    for s in signals[:5]:
        print(f"    - {s['topic']} [{s['stage']}] proof={s['proof_id'][:30]} url={s['source_url'][:50]}")

    return signals

if __name__ == "__main__":
    signals = main()
    print(json.dumps(signals[:3], indent=2, ensure_ascii=False))
