# Signal Market - Product Fix SPEC

**Version:** 1.0  
**Date:** 2026-03-06  
**Priority:** P0 - Critical Fixes

---

## SPEC: Fix Missing APIs and Connect Real Data

### MUST

1. **Fix /trends endpoint**
   - Connect to l1/topic_discovery.js processTrendGraph()
   - Return trends array with id, topic, stage, trend_score
   - Deploy to Vercel

2. **Fix Topic Detail Page**
   - Update event_detail.html to fetch real signal data by topic
   - Use /signals API filtered by topic
   - Remove hardcoded demo data

3. **Fix Watchlist Persistence**
   - Add JSON file storage for watchlist
   - Persist across restarts
   - File: ./data/watchlist.json

4. **Fix /future-trends endpoint**
   - Connect to l1/prediction_engine.js predictTrends()
   - Return predictions array
   - Deploy to Vercel

### MUST NOT

- Add new data sources
- Change existing working APIs
- Remove any UI pages
- Add user authentication (P2)

### Acceptance Tests

| Test | Criteria |
|------|----------|
| /trends returns 200 | curl /trends → 200 + trends array |
| Topic detail shows real data | API call returns signal data |
| Watchlist persists | Add item → restart → item exists |
| /future-trends returns 200 | curl /future-trends → 200 |

### Task Atoms (<30 min each)

1. **Atom 1:** Fix /trends API endpoint (20 min)
   - Update api/index.js
   - Add /trends route
   - Test locally

2. **Atom 2:** Fix topic detail page (20 min)
   - Update event_detail.html fetch logic
   - Test with real topic

3. **Atom 3:** Fix watchlist persistence (20 min)
   - Add JSON file storage
   - Test persistence

4. **Atom 4:** Fix /future-trends endpoint (20 min)
   - Add route to api/index.js
   - Test locally

5. **Atom 5:** Deploy to Vercel (10 min)
   - Push to GitHub
   - Verify endpoints

---

## Execution Plan

**Total Time:** ~90 minutes  
**Parallel:** Atoms 1, 2, 3 can run in parallel  
**Sequential:** Atom 5 (deploy) after 1-4

---

**Ready for Execution:** Yes
