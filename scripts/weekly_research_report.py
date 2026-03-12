#!/usr/bin/env python3
"""
Weekly Research Report — Signal Market (Tool-Only Mode)
Scheduled research operator: calls Signal Market tools directly (no LLM agent),
produces structured weekly report saved to output/.

Usage:
  python3 scripts/weekly_research_report.py
  python3 scripts/weekly_research_report.py --dry-run

Service: AI Company OS L2 Research Dept (WF-012)
Owner: CEO / SignalResearchAgent capability
"""

import json, sys, argparse, datetime, urllib.request, urllib.parse, re
from pathlib import Path

ROOT     = Path(__file__).parent.parent
JSONL    = ROOT / "data" / "signals_history.jsonl"
OUTPUT   = ROOT / "output"
API_BASE = "http://localhost:3001"

# ── Tools (direct calls, no LLM) ─────────────────────────────────────────────

def tool_get_signals() -> list:
    try:
        data = json.loads(urllib.request.urlopen(f"{API_BASE}/api/signals", timeout=10).read())
        return data.get("signals", [])
    except Exception as e:
        print(f"  [tool_get_signals] error: {e}", file=sys.stderr)
        return []

def tool_get_brief() -> dict:
    try:
        return json.loads(urllib.request.urlopen(f"{API_BASE}/api/v2/brief", timeout=10).read())
    except Exception as e:
        print(f"  [tool_get_brief] error: {e}", file=sys.stderr)
        return {}

def tool_get_stats() -> dict:
    try:
        return json.loads(urllib.request.urlopen(f"{API_BASE}/api/stats", timeout=10).read())
    except Exception as e:
        return {}

def tool_search_arxiv(query: str, n: int = 3) -> list:
    q = urllib.parse.quote(query)
    url = f"https://export.arxiv.org/api/query?search_query=all:{q}&sortBy=submittedDate&sortOrder=descending&max_results={n}"
    try:
        raw = urllib.request.urlopen(url, timeout=10).read().decode()
        titles = re.findall(r'<title>(.*?)</title>', raw, re.DOTALL)[1:]
        dates  = re.findall(r'<published>(.*?)</published>', raw)
        return [{"title": t.strip().replace('\n', ' ')[:100], "date": d[:10]}
                for t, d in zip(titles[:n], dates[:n])]
    except Exception as e:
        return [{"error": str(e)}]

# ── Report generation ─────────────────────────────────────────────────────────

def generate_report(dry_run: bool = False) -> dict:
    today = datetime.date.today().isoformat()
    week  = datetime.date.today().isocalendar()[1]
    print(f"Weekly Research Report — {today} (Week {week})")

    # 1. Signals overview
    signals = tool_get_signals()
    print(f"  Signals loaded: {len(signals)}")

    ranked = sorted(signals, key=lambda s: s.get("confidence", 0), reverse=True)
    top3   = ranked[:3]

    # 2. Brief / causal summary
    brief  = tool_get_brief()
    stats  = tool_get_stats()
    causal_coverage = brief.get("meta", {}).get("causal_coverage", 0)
    headline        = brief.get("headline", "")
    macro_lead      = brief.get("macro_lead", "")

    # 3. arXiv: search for top 3 signals
    arxiv_results = {}
    for sig in top3:
        topic   = sig.get("topic", "")
        papers  = tool_search_arxiv(f"{topic} AI 2026", n=3)
        arxiv_results[topic] = papers
        print(f"  arXiv [{topic}]: {len(papers)} papers")

    # 4. Source diversity analysis
    provider_map = {}
    for s in signals:
        topic = s.get("topic", "")
        raw   = [p.split(":")[0] for p in s.get("sources", [])]
        norm  = {"arxiv_rss": "arxiv", "hf_trending": "huggingface", "gh_trending": "github"}
        providers = list(dict.fromkeys(norm.get(p, p) for p in raw))
        provider_map[topic] = providers

    most_diverse = max(provider_map, key=lambda t: len(provider_map[t])) if provider_map else ""

    # 5. Compile report
    report = {
        "report_type":      "weekly_research_report",
        "generated_at":     datetime.datetime.utcnow().isoformat() + "Z",
        "week":             week,
        "date":             today,
        "mode":             "tool-only",
        "service":          "AI Company OS L2 / WF-012 Causal chain extraction",
        "summary": {
            "total_signals":     len(signals),
            "causal_coverage":   causal_coverage,
            "cross_validated":   stats.get("cross_validated", 0) if isinstance(stats, dict) else 0,
            "headline":          headline,
            "macro_lead":        macro_lead,
        },
        "top_signals": [
            {
                "rank":       i + 1,
                "topic":      s.get("topic"),
                "confidence": s.get("confidence"),
                "stage":      s.get("stage"),
                "providers":  provider_map.get(s.get("topic", ""), []),
                "top_papers": arxiv_results.get(s.get("topic", ""), []),
            }
            for i, s in enumerate(top3)
        ],
        "source_diversity": {
            "most_diverse_topic":    most_diverse,
            "most_diverse_providers": provider_map.get(most_diverse, []),
            "all_topics":            {t: len(p) for t, p in provider_map.items()},
        },
        "insights": _derive_insights(signals, brief, arxiv_results),
        "dry_run": dry_run,
    }

    # Save
    if not dry_run:
        OUTPUT.mkdir(exist_ok=True)
        out_path = OUTPUT / f"weekly_research_report_{today}.json"
        out_path.write_text(json.dumps(report, indent=2, ensure_ascii=False))
        print(f"  ✓ Report saved: {out_path}")

    return report

def _derive_insights(signals, brief, arxiv_results) -> list:
    insights = []
    ranked  = sorted(signals, key=lambda s: s.get("confidence", 0), reverse=True)
    if ranked:
        top     = ranked[0]
        insights.append(f"Top signal: {top['topic']} at {round(top.get('confidence',0)*100)}% confidence ({top.get('stage','?')} stage)")

    accel = [s["topic"] for s in signals if s.get("stage") == "accelerating"]
    if accel:
        insights.append(f"{len(accel)} topics in accelerating stage: {', '.join(accel[:5])}")

    macro = brief.get("macro_lead", "")
    if macro:
        insights.append(f"Macro: {macro[:120]}")

    for topic, papers in list(arxiv_results.items())[:2]:
        valid = [p for p in papers if not p.get("error")]
        if valid:
            insights.append(f"Latest arXiv [{topic}]: \"{valid[0]['title'][:80]}\" ({valid[0].get('date','')})")

    return insights

# ── Main ──────────────────────────────────────────────────────────────────────

def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--dry-run", action="store_true")
    args = parser.parse_args()

    report = generate_report(dry_run=args.dry_run)

    print(f"\n{'[DRY_RUN] ' if args.dry_run else ''}✅ Weekly Research Report complete")
    print(f"  Signals: {report['summary']['total_signals']}")
    print(f"  Causal coverage: {report['summary']['causal_coverage']}/10")
    print(f"  Top signal: {report['top_signals'][0]['topic'] if report['top_signals'] else 'N/A'}")
    print(f"\nInsights:")
    for ins in report["insights"]:
        print(f"  • {ins}")

if __name__ == "__main__":
    main()
