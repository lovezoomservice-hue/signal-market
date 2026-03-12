#!/usr/bin/env python3
"""
fetch_cryptopanic.py — CryptoPanic → Signal Market
Fetches high-importance crypto news and converts to candidate signals.
Token: sec_cryptopanic_token (vault)
"""

import json, sys, subprocess, time, hashlib
from datetime import datetime, timezone
from pathlib import Path
from urllib.request import urlopen, Request
from urllib.error import URLError

ROOT = Path(__file__).resolve().parent.parent
VAULT = ROOT / "security" / "vault_adapter.js"
HISTORY = ROOT / "data" / "signals_history.jsonl"
RUNTIME = ROOT / "data" / "runtime"
RUNTIME.mkdir(parents=True, exist_ok=True)

CRYPTO_TOPICS = {
    "bitcoin": "Bitcoin", "btc": "Bitcoin", "ethereum": "Ethereum", "eth": "Ethereum",
    "solana": "Solana", "sol": "Solana", "defi": "DeFi", "nft": "NFT",
    "layer2": "Layer 2", "l2": "Layer 2", "zk": "ZK Proofs", "stablecoin": "Stablecoins",
    "regulation": "Crypto Regulation", "sec": "Crypto Regulation", "etf": "Crypto ETF",
    "ai": "AI x Crypto", "agent": "AI x Crypto", "dao": "DAO Governance",
    "hack": "Security Risk", "exploit": "Security Risk", "bridge": "Bridge Protocol",
    "whale": "Whale Movement", "liquidation": "Market Liquidation",
}

def vault_get(key):
    try:
        r = subprocess.run(["node", str(VAULT), "get", key], capture_output=True, text=True, timeout=5)
        return r.stdout.strip() if r.returncode == 0 else None
    except Exception:
        return None

def detect_topic(title, body=""):
    text = (title + " " + body).lower()
    for kw, topic in CRYPTO_TOPICS.items():
        if kw in text:
            return topic
    return None

def importance_to_confidence(importance, votes=0):
    base = {"critical": 0.88, "high": 0.75, "medium": 0.62, "low": 0.45}.get(importance, 0.50)
    vote_boost = min(votes * 0.01, 0.1)
    return round(min(base + vote_boost, 0.95), 3)

def to_signal(item):
    topic = detect_topic(item.get("title",""), "")
    if not topic:
        return None
    importance = item.get("importance","medium")
    votes = len(item.get("votes",{}) or {})
    conf = importance_to_confidence(importance, votes)
    title = item.get("title","")
    pub = item.get("published_at","")
    slug = item.get("slug","")
    uid = hashlib.md5(f"{topic}-{slug}".encode()).hexdigest()[:8]
    return {
        "signal_id": f"crypto_{uid}",
        "topic": topic,
        "stage": "emerging" if conf < 0.65 else ("forming" if conf < 0.80 else "accelerating"),
        "confidence": conf,
        "impact_score": round(conf * 0.9, 3),
        "evidenceCount": 1,
        "sources": ["cryptopanic"],
        "category": "Crypto & Web3",
        "first_seen": pub[:10] if pub else datetime.now(timezone.utc).strftime("%Y-%m-%d"),
        "evidence_source": "runtime",
        "lifecycle_state": "pending_evidence",
        "title": title,
        "importance": importance,
    }

def main():
    token = vault_get("sec_cryptopanic_token")
    if not token or token.startswith("ERROR"):
        print("[cryptopanic] no token — using public feed (limited)")
        url = "https://cryptopanic.com/api/v1/posts/?auth_token=&public=true&filter=important"
    else:
        url = f"https://cryptopanic.com/api/v1/posts/?auth_token={token}&filter=important&kind=news"

    try:
        req = Request(url, headers={"User-Agent": "SignalMarket/1.0"})
        data = json.loads(urlopen(req, timeout=10).read())
        items = data.get("results", [])
        print(f"[cryptopanic] fetched {len(items)} items")
    except URLError as e:
        print(f"[cryptopanic] fetch error: {e}")
        items = []

    signals = []
    seen_topics = set()
    for item in items[:40]:
        s = to_signal(item)
        if s and s["topic"] not in seen_topics:
            signals.append(s)
            seen_topics.add(s["topic"])

    print(f"[cryptopanic] extracted {len(signals)} signals: {[s['topic'] for s in signals]}")

    if signals:
        with open(HISTORY, "a") as f:
            for s in signals:
                f.write(json.dumps(s) + "\n")
        print(f"[cryptopanic] wrote {len(signals)} signals to history")

    # Save to runtime cache
    cache = {"fetched_at": datetime.now(timezone.utc).isoformat(), "signals": signals}
    (RUNTIME / "cryptopanic_cache.json").write_text(json.dumps(cache, indent=2))
    return signals

if __name__ == "__main__":
    sigs = main()
    print(json.dumps({"status": "ok", "count": len(sigs)}, indent=2))
