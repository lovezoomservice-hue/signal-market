#!/usr/bin/env python3
"""
Fetcher: FRED (Federal Reserve Economic Data)
Source: T11 — api.stlouisfed.org
Signals derived: AI Infrastructure investment, tech labor market, R&D spending proxies
"""

import json
import os
import sys
import urllib.request
from datetime import datetime, timezone, timedelta
from pathlib import Path

ROOT = Path(__file__).parent.parent
HIST = ROOT / 'data' / 'signals_history.jsonl'

# ── Vault / secrets ─────────────────────────────────────────────────────────
def get_secret(key):
    vault_path = ROOT / 'security' / 'vault' / 'store.json'
    try:
        vault = json.loads(vault_path.read_text())
        return vault.get(key)
    except Exception:
        return os.environ.get(key)

FRED_KEY = get_secret('sec_fred_api_key') or os.environ.get('FRED_API_KEY')

# ── Signal mapping: FRED series → signal topics ─────────────────────────────
SERIES_MAP = [
    {
        'series_id': 'BOGMBASE',          # Monetary base — proxy for liquidity
        'signal_topic': 'AI Infrastructure',
        'signal_type': 'macro_proxy',
        'rationale': 'Monetary base expansion correlates with tech investment capacity',
        'threshold_pct': 0.5,
    },
    {
        'series_id': 'GDPCA',             # Real GDP
        'signal_topic': 'AI Business',
        'signal_type': 'macro_proxy',
        'rationale': 'GDP growth creates budget for AI investment',
        'threshold_pct': 0.3,
    },
    {
        'series_id': 'UNRATE',            # Unemployment rate
        'signal_topic': 'AI Coding',
        'signal_type': 'labor_market',
        'rationale': 'Low unemployment → tech talent competition → AI automation pressure',
        'threshold_pct': -0.5,            # falling unemployment = signal
    },
]

def fetch_series(series_id):
    """Fetch last 2 observations from FRED series."""
    if not FRED_KEY:
        return None
    url = (
        f'https://api.stlouisfed.org/fred/series/observations'
        f'?series_id={series_id}&api_key={FRED_KEY}&file_type=json'
        f'&sort_order=desc&limit=2'
    )
    try:
        req = urllib.request.Request(url, headers={'Accept': 'application/json'})
        with urllib.request.urlopen(req, timeout=10) as resp:
            return json.loads(resp.read())
    except Exception as e:
        print(f'  FRED fetch error ({series_id}): {e}', file=sys.stderr)
        return None

def compute_pct_change(data):
    """Compute % change between two most recent non-null observations."""
    obs = [o for o in data.get('observations', []) if o.get('value') not in ('.', None, '')]
    if len(obs) < 2:
        return None
    try:
        v1, v2 = float(obs[0]['value']), float(obs[1]['value'])
        return ((v1 - v2) / abs(v2)) * 100 if v2 != 0 else None
    except Exception:
        return None

def load_existing_topics():
    if not HIST.exists():
        return set()
    topics = set()
    with open(HIST) as f:
        for line in f:
            line = line.strip()
            if line:
                try:
                    topics.add(json.loads(line).get('topic', ''))
                except Exception:
                    pass
    return topics

def main():
    print('FRED: fetching macro signals...', file=sys.stderr)

    if not FRED_KEY:
        print('  FRED: no API key — using synthetic macro proxy signals', file=sys.stderr)
        # Emit proxy signals without live FRED data (based on known macro conditions)
        proxy_signals = [
            {
                'signal_id': 'evt_fred_001',
                'topic': 'AI Infrastructure',
                'stage': 'forming',
                'confidence': 0.62,
                'impact_score': 0.68,
                'evidenceCount': 1,
                'sources': ['fred:proxy'],
                'category': 'AI Business',
                'first_seen': datetime.now(timezone.utc).strftime('%Y-%m-%d'),
                'evidence_source': 'macro_proxy',
                'lifecycle_state': 'pending_evidence',
                'cross_validated': False,
                'source_count': 1,
                'signal_type': 'macro_proxy',
                'domain': 'macro',
                'note': 'Proxy signal — full FRED data requires API key',
            }
        ]
        existing = load_existing_topics()
        new_count = 0
        with open(HIST, 'a') as f:
            for s in proxy_signals:
                if s['topic'] not in existing:
                    f.write(json.dumps(s) + '\n')
                    new_count += 1
        result = {'status': 'ok', 'count': new_count, 'mode': 'proxy'}
        print(json.dumps(result))
        return

    # Live FRED fetch
    signals = []
    for mapping in SERIES_MAP:
        data = fetch_series(mapping['series_id'])
        if not data:
            continue
        pct = compute_pct_change(data)
        if pct is None:
            continue
        threshold = mapping.get('threshold_pct', 0.5)
        if abs(pct) < abs(threshold):
            continue  # Not significant enough

        direction = 'positive' if pct > 0 else 'negative'
        obs = data.get('observations', [{}])[0]
        conf = min(0.60 + abs(pct) * 0.03, 0.82)

        signals.append({
            'signal_id': f'evt_fred_{mapping["series_id"].lower()}',
            'topic': mapping['signal_topic'],
            'stage': 'forming',
            'confidence': round(conf, 3),
            'impact_score': round(conf - 0.05, 3),
            'evidenceCount': 1,
            'sources': [f'fred:{mapping["series_id"]}'],
            'category': 'AI Business',
            'first_seen': obs.get('date', datetime.now(timezone.utc).strftime('%Y-%m-%d')),
            'evidence_source': 'fred',
            'lifecycle_state': 'pending_evidence',
            'cross_validated': False,
            'source_count': 1,
            'signal_type': mapping['signal_type'],
            'domain': 'macro',
            'fred_series': mapping['series_id'],
            'fred_pct_change': round(pct, 3),
            'fred_direction': direction,
            'rationale': mapping['rationale'],
        })

    print(f'  FRED: derived {len(signals)} signals', file=sys.stderr)

    existing = load_existing_topics()
    new_count = 0
    with open(HIST, 'a') as f:
        for s in signals:
            if s['topic'] not in existing:
                f.write(json.dumps(s) + '\n')
                new_count += 1
                print(f'  -> {s["topic"]}: conf={s["confidence"]} series={s["fred_series"]}', file=sys.stderr)

    print(f'  FRED: wrote {new_count} new signals', file=sys.stderr)
    print(json.dumps({'status': 'ok', 'count': new_count}))

if __name__ == '__main__':
    main()
