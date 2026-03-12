#!/usr/bin/env python3
"""
Hacker News Fetcher — Signal Market Source Layer L0 (Tech Community)
Uses HN Algolia API (free, no key required).
Captures developer community signal + tech discourse.

Usage:
  python3 scripts/fetch_hackernews.py
  python3 scripts/fetch_hackernews.py --dry-run
"""
import sys, json, urllib.request, datetime, argparse

HN_FRONTPAGE = "https://hn.algolia.com/api/v1/search?tags=front_page&hitsPerPage=40"
HN_STORY     = "https://hn.algolia.com/api/v1/search?tags=story&hitsPerPage=40&query={q}"

QUERIES = [
    "LLM inference",
    "AI agents",
    "Neuralink robotics",
    "SpaceX launch",
    "autonomous driving",
    "AI chip hardware",
]

TOPIC_KEYWORDS = {
    "LLM Infrastructure":       ["llm","gpt","openai","anthropic","claude","gemini","mistral","llama","inference","vllm","training","transformer","tokenizer","context window"],
    "AI Agents":                 ["agent","agentic","autonomous","copilot","mcp","tool use","function call","multi-agent","workflow automation"],
    "AI Chips & Hardware":       ["nvidia","gpu","chip","accelerator","cuda","h100","b200","blackwell","tpu","cerebras","groq","tenstorrent"],
    "Robotics & Embodied AI":    ["robot","humanoid","boston dynamics","figure","unitree","manipulation","embodied","servo","bipedal"],
    "Commercial Space":          ["spacex","starship","rocket","satellite","launch","orbit","nasa","moon","mars","reusable"],
    "Brain-Computer Interface":  ["neuralink","bci","brain interface","neural","brain implant","synchron","electrode"],
    "Autonomous Vehicles":       ["waymo","self-driving","fsd","tesla","robotaxi","lidar","autonomous"],
    "AI Reasoning":              ["reasoning","o1","o3","chain of thought","math benchmark","arc","logic","deduction","prover"],
    "Diffusion Models":          ["stable diffusion","flux","sora","video generation","dall-e","image generation","midjourney"],
    "Multimodal AI":             ["multimodal","vision language","gpt-4v","gemini","image understanding","video understanding"],
    "AI Policy & Regulation":    ["ai safety","alignment","regulation","policy","ban","existential","agi risk","anthropic safety"],
    "AI Investment & Capital":   ["funding","valuation","series","ipo","billion","acquisition","raises","investors","openai deal"],
}

def score_text(text: str) -> tuple[str | None, float]:
    text = text.lower()
    best_topic, best_score = None, 0.0
    for topic, kws in TOPIC_KEYWORDS.items():
        matches = sum(1 for kw in kws if kw in text)
        score = min(0.92, 0.40 + matches * 0.12)
        if score > 0.52 and score > best_score:
            best_topic, best_score = topic, score
    return best_topic, best_score

def fetch_url(url: str) -> list[dict]:
    try:
        req = urllib.request.Request(url, headers={"User-Agent": "SignalMarket/1.0"})
        data = json.loads(urllib.request.urlopen(req, timeout=12).read())
        return data.get("hits", [])
    except Exception as e:
        print(f"  [hn] {url[:60]}: {e}", file=sys.stderr)
        return []

def fetch_hn_signals() -> list[dict]:
    seen: set[str] = set()
    all_hits = []

    # Frontpage
    hits = fetch_url(HN_FRONTPAGE)
    all_hits.extend(hits)

    # Query-based (frontier topics)
    for q in QUERIES:
        hits = fetch_url(HN_STORY.format(q=urllib.request.quote(q)))
        all_hits.extend(hits)

    signals = []
    for h in all_hits:
        oid  = h.get("objectID", "")
        if oid in seen: continue
        seen.add(oid)

        title = (h.get("title") or "").strip()
        url   = h.get("url") or f"https://news.ycombinator.com/item?id={oid}"
        pts   = int(h.get("points") or 0)
        cmts  = int(h.get("num_comments") or 0)

        if pts < 30: continue

        topic, conf = score_text(title + " " + (h.get("story_text") or "")[:200])
        if not topic: continue

        # Boost by points
        eng_boost = min(0.15, (pts / 3000) * 0.15)
        conf = round(min(0.93, conf + eng_boost), 2)
        stage = "forming" if conf < 0.6 else "emerging" if conf < 0.78 else "accelerating"

        signals.append({
            "topic":           topic,
            "signal_id":       f"hn_{oid}",
            "confidence":      conf,
            "stage":           stage,
            "evidence_count":  max(1, cmts // 5),
            "sources":         ["hackernews"],
            "source_url":      url,
            "category":        "Tech Community / Developer Discourse",
            "proof_id":        f"hn-{datetime.date.today().isoformat()}-{oid}",
            "title":           title[:120],
            "hn_points":       pts,
            "hn_comments":     cmts,
            "hn_id":           oid,
            "why_important":   f"HN: {pts} pts on \"{title[:70]}\"",
            "source_layer":    "L0",
            "source_tag":      "hackernews",
        })

    return signals

def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--dry-run", action="store_true")
    args = parser.parse_args()

    print(f"Hacker News Fetcher — {datetime.date.today().isoformat()}")
    signals = fetch_hn_signals()
    print(f"  Stories matched: {len(signals)}")

    for s in sorted(signals, key=lambda x: -x["hn_points"])[:10]:
        print(f"  [{s['topic']:<28}] pts={s['hn_points']:>4}  {s['title'][:55]}")

    if not args.dry_run and signals:
        import pathlib
        out = pathlib.Path(__file__).parent.parent / "output"
        out.mkdir(exist_ok=True)
        path = out / f"hn_signals_{datetime.date.today().isoformat()}.json"
        path.write_text(json.dumps({"signals": signals, "fetched_at": datetime.datetime.utcnow().isoformat()+"Z"}, indent=2, ensure_ascii=False))
        print(f"  ✓ Saved: {path}")

    return signals

if __name__ == "__main__":
    main()
