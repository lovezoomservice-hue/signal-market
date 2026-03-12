# Persistence Layer Upgrade Guide

**Document Version:** 1.0
**Last Updated:** 2026-03-13
**Applies to:** Signal Market on Vercel

---

## Overview

Signal Market now includes a KV persistence abstraction layer that provides:
- **Production:** Vercel KV storage (persistent across cold starts)
- **Development/Demo:** In-memory Map (graceful degradation)

The system **auto-detects** which mode to use — no code changes required.

---

## Current State (Default)

Without any configuration, Signal Market runs in **in-memory mode**:

```
persistence_mode: "in_memory"
```

**Characteristics:**
- Watchlist items, subscriptions, and auth users stored in RAM
- Data survives requests within the same function instance
- Data **resets on cold start** (when Vercel spins up a new instance)
- **Acceptable for:** Demos, development, testing

**What persists in memory:**
- Watchlist items (`wl:default`)
- Watchlist trigger log (`wl:triggers`, max 500 entries)
- Subscriptions (`sub:*`)
- Auth users (`auth:users`)
- Auth API keys (`auth:keys`)
- Email subscribers (`auth:subscribers`)

---

## Upgrade to Vercel KV (Production Persistence)

Enabling persistent storage requires **2 steps** in the Vercel dashboard:

### Step 1: Create and Connect KV Store

1. Go to your project in the [Vercel Dashboard](https://vercel.com/dashboard)
2. Navigate to **Storage** tab
3. Click **Create Database** → Select **KV**
4. Choose a region (same as your deployment for lowest latency)
5. Click **Connect** to link the KV store to your project

### Step 2: Verify Environment Variables

After connecting, Vercel automatically injects these environment variables:
- `KV_REST_API_URL`
- `KV_REST_API_TOKEN`

**No manual configuration needed.** The persistence layer detects these variables and switches to KV mode automatically.

---

## Verification

After enabling KV, verify the upgrade worked:

### 1. Check Persistence Mode via API

```bash
curl https://signal-market-z14d.vercel.app/api/watchlist
```

Expected response includes:
```json
{
  "watchlist": [],
  "count": 0,
  "persistence_mode": "vercel_kv"
}
```

### 2. Test Subscription Persistence

```bash
# Create a subscription
curl -X POST https://signal-market-z14d.vercel.app/api/v2/subscribe \
  -H "Content-Type: application/json" \
  -d '{"topic": "AI Agents", "urgency_threshold": "high"}'

# Response includes persistence_mode
{
  "subscription_id": "sub_xxxxx",
  "topic": "AI Agents",
  "persistence_mode": "vercel_kv"
}
```

### 3. Test Auth Registration

```bash
curl -X POST https://signal-market-z14d.vercel.app/api/auth/register \
  -H "Content-Type: application/json" \
  -d '{"email": "test@example.com", "plan": "free"}'

# Response includes persistence_mode
{
  "message": "Account created",
  "api_key": "sm_xxxxx",
  "persistence_mode": "vercel_kv"
}
```

---

## What Gets Persisted

Once KV is enabled, the following data becomes **durable**:

| Data Type | Key Pattern | Description |
|-----------|-------------|-------------|
| Watchlist | `wl:default` | JSON array of watchlist items |
| Trigger Log | `wl:triggers` | JSON array of trigger events (max 500) |
| Subscriptions | `sub:{id}` | Individual subscription objects |
| Subscription Index | `sub_topic:{topic}` | Topic → subscription ID mapping |
| Auth Users | `auth:users` (hash) | Email → user object mapping |
| Auth Keys | `auth:keys` (hash) | API key → key metadata mapping |
| Email Subscribers | `auth:subscribers` | Newsletter subscriber list |

---

## KV Costs and Limits

Vercel KV pricing (as of 2026-03-13):

| Tier | Cost | Operations/Month | Storage |
|------|------|------------------|---------|
| Hobby | Free | 1M | 10 MB |
| Pro | $15/mo | 100M | 1 GB |
| Enterprise | Custom | Custom | Custom |

**Signal Market typical usage:**
- Watchlist: ~100 items × 500 bytes = ~50 KB
- Subscriptions: ~1000 subs × 200 bytes = ~200 KB
- Auth users: ~500 users × 300 bytes = ~150 KB
- **Total estimated:** < 1 MB for moderate usage

---

## Troubleshooting

### KV Not Detected

If `persistence_mode` still shows `in_memory` after connecting KV:

1. **Check environment variables** in Vercel dashboard:
   - Settings → Environment Variables
   - Verify `KV_REST_API_URL` and `KV_REST_API_TOKEN` exist

2. **Redeploy** your application:
   - Go to Deployments → Click existing deployment → Redeploy
   - Or push a new commit to trigger redeployment

3. **Check KV store status:**
   - Storage → Select your KV store
   - Verify it shows "Connected" status

### Data Not Persisting

If data disappears after cold start:

1. Verify `persistence_mode` is `vercel_kv` in API responses
2. Check KV store browser in Vercel dashboard for keys
3. Ensure no deployment errors in Vercel Functions logs

---

## Migration Notes

### From In-Memory to KV

- **No migration script needed** — the system handles both modes
- Existing in-memory data is lost on cold start (expected behavior)
- New data after KV enablement is persisted automatically

### From KV to In-Memory (Downgrade)

- Disconnect KV store in Vercel dashboard
- Remove `KV_REST_API_URL` and `KV_REST_API_TOKEN` env vars
- System automatically falls back to in-memory mode

---

## API Reference

### Persistence Layer Methods

The `persistence` object (from `api/lib/kv.js`) provides:

```javascript
import persistence from './lib/kv.js';

// Get value
const data = await persistence.get('key');

// Set value (with optional TTL in seconds)
await persistence.set('key', 'value', { ex: 3600 });

// Delete key
await persistence.delete('key');

// List keys by pattern
const keys = await persistence.keys('sub:*');

// Hash operations
await persistence.hset('auth:users', 'email@example.com', JSON.stringify(user));
await persistence.hget('auth:users', 'email@example.com');
await persistence.hgetall('auth:users');
await persistence.hdel('auth:users', 'email@example.com');

// Check mode
console.log(persistence.mode); // "vercel_kv" or "in_memory"
```

---

## Security Considerations

- KV data is encrypted at rest by Vercel
- API tokens are stored in KV — ensure proper access controls
- Auth endpoints still use JWT for session management
- Never expose `KV_REST_API_TOKEN` in client-side code

---

## Support

For issues with Vercel KV:
- [Vercel KV Documentation](https://vercel.com/docs/storage/vercel-kv)
- [Vercel Support](https://vercel.com/support)

For Signal Market issues:
- [GitHub Issues](https://github.com/signal-market/issues)
