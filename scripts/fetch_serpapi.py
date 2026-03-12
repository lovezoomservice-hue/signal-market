#!/usr/bin/env python3
"""
fetch_serpapi.py — SerpAPI Google News → Signal Market
Fetches AI/tech/crypto trending news, extracts candidate signals.
Token: sec_serpapi_token (vault)
"""

import json, sys, subprocess, hashlib
from datetime import datetime, timezone
from pathlib import Path
from urllib.request import urlopen, Request
from urllib.parse import urlencode
from urllib.error import URLError

ROOT = Path(__file__).resolve().parent.parent
VAULT = ROOT / "security" / "vault_adapter.js"
HISTORY = ROOT / "data" / "signals_history.jsonl"
RUNTIME = ROOT / "data" / "runtime"
RUNTIME.mkdir(parents=True, exist_ok=True)

SEARCH_QUERIES = [
    ("AI agents technology 2026", "AI Agents", "AI Research", 0.82),
    ("large language model infrastructure", "LLM Infrastructure", "AI Research", 0.78),
    ("AI startup funding raise", "AI Investment", "AI Business", 0.72),
    ("quantum computing breakthrough", "Quantum Computing", "Deep Tech", 0.70),
    ("open source AI model release", "Open Source AI", "AI Research", 0.75),
    ("AI regulation policy", "AI Regulation", "Policy & Governance", 0.68),
    ("autonomous AI agent deployment", "Autonomous AI", "AI Research", 0.80),
    ("multimodal AI model", "Multimodal AI", "AI Research", 0.76),
]

def vault_get(key):
    try:
        r = subprocess.run(["node", str(VAULT), "get", key], capture_output=True, text=True, timeout=5)
        return r.stdout.strip() if r.returncode == 0 else None
    except Exception:
        return None

def fetch_news(token, query, num=5):
    params = {"engine": "google_news", "q": query, "api_key": token, "num": num}
    url = "https://serpapi.com/search?" + urlencode(params)
    try:
        req = Request(url, headers={"User-Agent": "SignalMarket/1.0"})
        data = json.loads(urlopen(req, timeout=12).read())
        return data.get("news_results", [])
    except Exception as e:
        print(f"[serpapi] query '{query}' error: {e}")
        return []

def results_to_signal(results, topic, category, base_conf):
    if not results:
        return None
    uid = hashlib.md5(topic.encode()).hexdigest()[:8]
    sources_found = len(results)
    conf = round(min(base_conf + sources_found * 0.01, 0.92), 3)
    return {
        "signal_id": f"news_{uid}",
        "topic": topic,
        "stage": "forming" if conf < 0.78 else "accelerating",
        "confidence": conf,
        "impact_score": round(conf * 0.88, 3),
        "evidenceCount": sources_found,
        "sources": ["serpapi:google_news"],
        "category": category,
        "first_seen": datetime.now(timezone.utc).strftime("%Y-%m-%d"),
        "evidence_source": "runtime",
        "lifecycle_state": "pending_evidence",
        "news_titles": [r.get("title","") for r in results[:3]],
    }

def main():
    token = vault_get("sec_serpapi_token")
    if not token or token.startswith("ERROR") or not token.strip():
        print("[serpapi] no token — skipping")
        return []

    signals = []
    seen_topics = set()
    for query, topic, category, base_conf in SEARCH_QUERIES:
        if topic in seen_topics:
            continue
        results = fetch_news(token, query)
        s = results_to_signal(results, topic, category, base_conf)
        if s:
            signals.append(s)
            seen_topics.add(topic)
            print(f"[serpapi] {topic}: conf={s['confidence']}, ev={s['evidenceCount']}")

    print(f"[serpapi] total signals: {len(signals)}")

    if signals:
        with open(HISTORY, "a") as f:
            for s in signals:
                f.write(json.dumps(s) + "\n")

    cache = {"fetched_at": datetime.now(timezone.utc).isoformat(), "signals": signals}
    (RUNTIME / "serpapi_cache.json").write_text(json.dumps(cache, indent=2))
    return signals

if __name__ == "__main__":
    sigs = main()
    print(json.dumps({"status": "ok", "count": len(sigs)}, indent=2))
