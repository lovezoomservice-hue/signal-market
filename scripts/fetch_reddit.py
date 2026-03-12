#!/usr/bin/env python3
"""
Reddit Fetcher — Signal Market Source Layer L2 (Social / Sentiment / Narrative)
Uses Reddit public JSON API — no key required.
Captures community sentiment and narrative diffusion.

Usage:
  python3 scripts/fetch_reddit.py
  python3 scripts/fetch_reddit.py --dry-run
"""
import sys, json, re, ssl, urllib.request, datetime, argparse, time
import xml.etree.ElementTree as ET

_SSL_CTX = ssl.create_default_context()
_SSL_CTX.check_hostname = False
_SSL_CTX.verify_mode = ssl.CERT_NONE

SUBREDDITS = [
    ("MachineLearning",  ["LLM Infrastructure", "AI Reasoning", "AI Agents"]),
    ("LocalLLaMA",       ["LLM Infrastructure", "AI Agents"]),
    ("artificial",       ["AI Agents", "Multimodal AI", "AI Reasoning"]),
    ("singularity",      ["AI Agents", "Robotics & Embodied AI", "Brain-Computer Interface", "Commercial Space"]),
    ("technology",       ["AI Policy & Regulation", "AI Chips & Hardware", "Autonomous Vehicles"]),
    ("robotics",         ["Robotics & Embodied AI"]),
    ("space",            ["Commercial Space"]),
    ("Futurology",       ["Brain-Computer Interface", "Robotics & Embodied AI", "Commercial Space"]),
    ("hardware",         ["AI Chips & Hardware"]),
    ("dataisbeautiful",  ["AI Investment & Capital"]),
]

TOPIC_KEYWORDS = {
    "LLM Infrastructure":        ["llm","gpt","claude","inference","training","vllm","transformer","mistral","llama","gemini"],
    "AI Agents":                  ["agent","agentic","autonomous","copilot","multi-agent","tool use","function calling"],
    "AI Chips & Hardware":        ["nvidia","gpu","chip","accelerator","h100","b200","blackwell","cuda","tpu"],
    "Robotics & Embodied AI":     ["robot","humanoid","figure","boston dynamics","embodied","servo","manipulation"],
    "Commercial Space":           ["spacex","starship","launch","orbit","satellite","nasa","moon","mars","reentry"],
    "Brain-Computer Interface":   ["neuralink","bci","brain implant","neural","brain computer","synchron"],
    "Autonomous Vehicles":        ["waymo","fsd","self-driving","autopilot","lidar","robotaxi","tesla"],
    "AI Reasoning":               ["reasoning","o1","o3","chain of thought","math","logic","benchmark","arc"],
    "Diffusion Models":           ["stable diffusion","sora","flux","midjourney","dall-e","video generation"],
    "Multimodal AI":              ["multimodal","vision","gpt-4v","gemini","omni","image understanding"],
    "AI Policy & Regulation":     ["regulation","policy","ban","law","safety","alignment","existential","risk"],
    "AI Investment & Capital":    ["funding","valuation","ipo","acquisition","billion","investment","startup"],
}

def score_text(text: str, candidate_topics: list[str]) -> tuple[str | None, float]:
    text = text.lower()
    best_topic, best_score = None, 0.0
    for topic in candidate_topics:
        kws = TOPIC_KEYWORDS.get(topic, [])
        matches = sum(1 for kw in kws if kw in text)
        score = min(0.88, 0.38 + matches * 0.10)
        if score > 0.48 and score > best_score:
            best_topic, best_score = topic, score
    return best_topic, best_score

def fetch_subreddit(sub: str, candidate_topics: list[str]) -> list[dict]:
    # Use RSS feed (more reliable than JSON API which is often blocked)
    url = f"https://www.reddit.com/r/{sub}/hot/.rss?limit=25"
    try:
        req = urllib.request.Request(url, headers={"User-Agent": "SignalMarket/1.0 RSS"})
        data = urllib.request.urlopen(req, context=_SSL_CTX, timeout=12).read()
        root = ET.fromstring(data)
        ns = {"atom": "http://www.w3.org/2005/Atom"}
        entries = root.findall("atom:entry", ns)
        signals = []
        for entry in entries:
            title_el = entry.find("atom:title", ns)
            link_el  = entry.find("atom:link", ns)
            content_el = entry.find("atom:content", ns)
            title   = (title_el.text if title_el is not None else "").strip()
            url_p   = (link_el.get("href") if link_el is not None else "") or ""
            content = (content_el.text if content_el is not None else "")[:300]
            # Extract score from content HTML (heuristic)
            score_m = re.search(r"(\d+) points?", content or "")
            score   = int(score_m.group(1)) if score_m else 50
            comm_m  = re.search(r"(\d+) comments?", content or "")
            n_comm  = int(comm_m.group(1)) if comm_m else 0

            if score < 30: continue

            text = f"{title} {content[:200]}".lower()
            topic, conf = score_text(text, candidate_topics)
            if not topic: continue

            # Boost confidence by engagement
            eng_boost = min(0.15, (score / 5000) * 0.15 + (n_comm / 500) * 0.05)
            conf = round(min(0.92, conf + eng_boost), 2)

            stage = "forming" if conf < 0.6 else "emerging" if conf < 0.75 else "accelerating"
            signals.append({
                "topic":           topic,
                "signal_id":       f"reddit_{hash(title) & 0xFFFFFF:06x}",
                "confidence":      conf,
                "stage":           stage,
                "evidence_count":  max(1, n_comm // 10),
                "sources":         ["reddit"],
                "source_url":      url_p,
                "category":        "Social / Community Sentiment",
                "proof_id":        f"reddit-{sub}-{datetime.date.today().isoformat()}-{hash(title) & 0xFFFF:04x}",
                "title":           title[:120],
                "reddit_score":    score,
                "reddit_comments": n_comm,
                "subreddit":       sub,
                "why_important":   f"r/{sub}: {score} upvotes on \"{title[:70]}\"",
                "source_layer":    "L2",
                "source_tag":      "reddit",
            })
        return signals
    except Exception as e:
        print(f"  [reddit] r/{sub}: {e}", file=sys.stderr)
        return []

def fetch_reddit_signals() -> list[dict]:
    all_signals = []
    for sub, topics in SUBREDDITS:
        items = fetch_subreddit(sub, topics)
        all_signals.extend(items)
        time.sleep(0.5)  # Be polite to Reddit API
    return all_signals

def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--dry-run", action="store_true")
    args = parser.parse_args()

    print(f"Reddit Fetcher — {datetime.date.today().isoformat()}")
    signals = fetch_reddit_signals()
    print(f"  Posts matched: {len(signals)}")

    by_topic: dict[str, int] = {}
    for s in signals:
        by_topic[s["topic"]] = by_topic.get(s["topic"], 0) + 1

    for topic, count in sorted(by_topic.items(), key=lambda x: -x[1]):
        top = max((s for s in signals if s["topic"] == topic), key=lambda x: x["reddit_score"])
        print(f"  [{topic:<28}] {count} posts, top_score={top['reddit_score']}: {top['title'][:50]}")

    if not args.dry_run and signals:
        import pathlib
        out = pathlib.Path(__file__).parent.parent / "output"
        out.mkdir(exist_ok=True)
        path = out / f"reddit_signals_{datetime.date.today().isoformat()}.json"
        path.write_text(json.dumps({"signals": signals, "fetched_at": datetime.datetime.utcnow().isoformat()+"Z"}, indent=2, ensure_ascii=False))
        print(f"  ✓ Saved: {path}")

    return signals

if __name__ == "__main__":
    main()
