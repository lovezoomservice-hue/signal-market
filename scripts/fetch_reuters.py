#!/usr/bin/env python3
"""
News RSS Fetcher (L1 Media Layer) — Signal Market Source Layer L1
Free, no API key required. Sources: BBC Tech, NYT Tech, TechCrunch, The Verge.
(Reuters RSS feeds deprecated; replaced with equivalent free news RSS sources.)

Usage:
  python3 scripts/fetch_reuters.py
  python3 scripts/fetch_reuters.py --dry-run
"""
import sys, re, urllib.request, ssl, datetime, argparse
import xml.etree.ElementTree as ET

# Free RSS feeds — all verified working 2026-03-13
FEEDS = [
    ("https://feeds.bbci.co.uk/news/technology/rss.xml",              "bbc_tech"),
    ("https://feeds.bbci.co.uk/news/science_and_environment/rss.xml", "bbc_science"),
    ("https://rss.nytimes.com/services/xml/rss/nyt/Technology.xml",   "nyt_tech"),
    ("https://techcrunch.com/feed/",                                   "techcrunch"),
    ("https://www.theverge.com/rss/index.xml",                        "theverge"),
]

_SSL_CTX = ssl.create_default_context()
_SSL_CTX.check_hostname = False
_SSL_CTX.verify_mode = ssl.CERT_NONE

TOPIC_KEYWORDS = {
    "LLM Infrastructure":      ["llm","language model","gpt","claude","gemini","inference","training","openai","anthropic","vllm","transformer"],
    "AI Agents":               ["ai agent","autonomous agent","agentic","ai assistant","copilot","multi-agent"],
    "AI Chips & Hardware":     ["chip","semiconductor","nvidia","gpu","tpu","accelerator","cerebras","groq","tenstorrent","intel ai","amd ai"],
    "Robotics & Embodied AI":  ["robot","humanoid","boston dynamics","figure","unitree","1x","embodied","automation","mechanical"],
    "Commercial Space":        ["spacex","starship","rocket","satellite","launch","orbit","nasa","esa","moon","mars","reentry"],
    "Brain-Computer Interface":["neuralink","bci","brain computer","neural interface","brain implant","synchron","neuropace"],
    "Autonomous Vehicles":     ["waymo","self-driving","autonomous vehicle","tesla fsd","cruise","robotaxi","lidar","autopilot"],
    "AI Reasoning":            ["reasoning","chain of thought","o1","o3","problem solving","logic","deduction","inference model"],
    "Diffusion Models":        ["diffusion","stable diffusion","sora","dall-e","midjourney","image generation","video generation","flux"],
    "Multimodal AI":           ["multimodal","vision language","gpt-4v","gemini vision","image understanding","video understanding"],
    "AI Policy & Regulation":  ["ai regulation","ai policy","ai law","ai safety","executive order","ai act","senate ai","congress ai"],
    "AI Investment & Capital":  ["ai funding","ai investment","ai valuation","ai ipo","ai startup","ai acquisition","series","venture capital ai"],
}

def score_relevance(text: str, keywords: list[str]) -> float:
    text = text.lower()
    matches = sum(1 for kw in keywords if kw in text)
    return min(0.92, 0.45 + matches * 0.12)

def fetch_feed(url: str, source_tag: str) -> list[dict]:
    try:
        req = urllib.request.Request(url, headers={"User-Agent": "Mozilla/5.0 SignalMarket/1.0"})
        data = urllib.request.urlopen(req, context=_SSL_CTX, timeout=12).read()
        root = ET.fromstring(data)
        items = root.findall(".//item")
        results = []
        for item in items[:30]:
            title = (item.findtext("title") or "").strip()
            link  = (item.findtext("link") or "").strip()
            desc  = (item.findtext("description") or "").strip()
            pub_date = (item.findtext("pubDate") or "").strip()
            text = f"{title} {desc}".lower()

            # Find best matching topic
            best_topic, best_score = None, 0.0
            for topic, kws in TOPIC_KEYWORDS.items():
                score = score_relevance(text, kws)
                if score > 0.55 and score > best_score:
                    best_topic, best_score = topic, score

            if best_topic:
                results.append({
                    "topic":          best_topic,
                    "signal_id":      f"reuters_{hash(title) & 0xFFFFFF:06x}",
                    "confidence":     round(best_score, 2),
                    "stage":          "forming" if best_score < 0.65 else "emerging" if best_score < 0.8 else "accelerating",
                    "evidence_count": 1,
                    "sources":        ["reuters"],
                    "source_url":     link or "https://reuters.com",
                    "category":       f"News / Media ({source_tag})",
                    "proof_id":       f"reuters-{datetime.date.today().isoformat()}-{hash(title) & 0xFFFF:04x}",
                    "title":          title[:120],
                    "published_at":   pub_date,
                    "why_important":  f"Reuters: {title[:100]}",
                    "source_layer":   "L1",
                    "source_tag":     source_tag,
                })
        return results
    except Exception as e:
        print(f"  [reuters] feed {url}: {e}", file=sys.stderr)
        return []

def fetch_reuters_signals() -> list[dict]:
    all_signals = []
    seen_titles: set[str] = set()
    for url, tag in FEEDS:
        items = fetch_feed(url, tag)
        for s in items:
            t = s["title"]
            if t not in seen_titles:
                seen_titles.add(t)
                all_signals.append(s)
    return all_signals

def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--dry-run", action="store_true")
    args = parser.parse_args()

    print(f"Reuters Fetcher — {datetime.date.today().isoformat()}")
    signals = fetch_reuters_signals()
    print(f"  Raw signals: {len(signals)}")

    # Group by topic
    by_topic: dict[str, list] = {}
    for s in signals:
        by_topic.setdefault(s["topic"], []).append(s)

    for topic, items in sorted(by_topic.items(), key=lambda x: -len(x[1])):
        top = max(items, key=lambda x: x["confidence"])
        print(f"  [{topic:<30}] {len(items)} items, best_conf={top['confidence']}: {top['title'][:60]}")

    if not args.dry_run:
        import json, pathlib
        out = pathlib.Path(__file__).parent.parent / "output"
        out.mkdir(exist_ok=True)
        path = out / f"reuters_signals_{datetime.date.today().isoformat()}.json"
        path.write_text(json.dumps({"signals": signals, "fetched_at": datetime.datetime.utcnow().isoformat()+"Z"}, indent=2, ensure_ascii=False))
        print(f"  ✓ Saved: {path}")

    return signals

if __name__ == "__main__":
    main()
