# Signal Market — Source Universe Strategy
**Last updated:** 2026-03-13  
**Status:** Active execution — Phase 1 complete, Phase 2 in progress  
**North Star:** World #1 decision-signal infrastructure for humans and AI agents

---

## Strategic Framework

Signal Market processes signals across **4 judgment layers**:
- **Fact Layer** — What happened / what is being built
- **Judgment Layer** — How top institutions & experts interpret it
- **Prediction Layer** — What markets and models expect next
- **Action Layer** — What agents and humans should do now

Every source must serve at least one layer. Every new source addition must answer:
1. How does this improve **agent decision value**?
2. What layer does it serve (fact / judgment / prediction / action)?
3. Is it superior to existing coverage on this topic?

---

## L0 — AI / Research / Dev (Fact Layer)

| Source | Status | Method | Agent Value |
|--------|--------|--------|-------------|
| arXiv | ✅ ACTIVE | `research_to_signal.py` + arXiv RSS | Earliest signal on capability breakthroughs |
| GitHub Trending | ✅ ACTIVE | `gh_trending` scraper | Adoption velocity, developer sentiment |
| HuggingFace Trending | ✅ ACTIVE | HF API | Model adoption, research-to-production signal |
| **Hacker News** | ✅ NEW (2026-03-13) | `fetch_hackernews.py` (HN Algolia) | Developer community validation signal |
| npm Trending | 🔲 PLANNED | npm registry API (free) | JS/Node AI tooling adoption |
| PyPI Downloads | 🔲 PLANNED | PyPI stats API (free) | Python AI library adoption |
| AI Blog Aggregator | 🔲 PLANNED | RSS (OpenAI/Anthropic/Google blogs) | First-party announcements before press coverage |

**Agent decision value:** Earliest possible signal on what researchers and engineers are actually building and adopting. Fact layer — ground truth.

---

## L1 — News / Media / Macro / Policy (Fact + Judgment Layer)

| Source | Status | Method | Blocker | Agent Value |
|--------|--------|--------|---------|-------------|
| **BBC Tech (RSS)** | ✅ NEW (2026-03-13) | `fetch_reuters.py` (renamed L1 news fetcher) | None | Mainstream tech narrative signal |
| **NYT Technology** | ✅ NEW (2026-03-13) | RSS | None | Mainstream narrative + policy signal |
| **TechCrunch** | ✅ NEW (2026-03-13) | RSS | None | Startup / funding signal |
| **The Verge** | ✅ NEW (2026-03-13) | RSS | None | Consumer tech + company narrative |
| Reuters | 🔲 BLOCKED | Old RSS deprecated | SSL/feed death | Would add credibility; replace with AP |
| Bloomberg | 🔲 BLOCKED | Subscription required | Paywall | Critical for financial layer; long-term goal |
| Financial Times | 🔲 BLOCKED | Subscription required | Paywall | Capital markets judgment layer |
| AP Technology | 🔲 PLANNED | RSS (free) | None | Wire service + policy coverage |
| Truth Social (Trump) | 🔲 PLANNED | RSS: `https://truthsocial.com/@realDonaldTrump.rss` | Rate limits | Political narrative + tariff/geopolitics signals |
| Official Gov RSS | 🔲 PLANNED | whitehouse.gov/news RSS, SEC EDGAR | None | Regulatory / policy signals |

**Agent decision value:** Policy changes and major company announcements that move capital and alter competitive landscape. Judgment layer — "what do mainstream authorities think."

---

## L2 — Social / Sentiment / Narrative (Fact + Prediction Layer)

| Source | Status | Method | Blocker | Agent Value |
|--------|--------|--------|---------|-------------|
| **Reddit** | ✅ NEW (2026-03-13) | `fetch_reddit.py` (RSS) | 403 on JSON; RSS works | Community sentiment, narrative adoption velocity |
| X / Twitter | 🔲 BLOCKED | API v2: $100/mo Basic tier | Cost | Highest-value real-time narrative signal; top KOLs |
| Facebook | 🔲 BLOCKED | Graph API restricted | Meta policy | Lower priority vs X |
| TikTok | 🔲 BLOCKED | API very limited | TikTok policy | Consumer narrative; lower priority for current users |
| LinkedIn | 🔲 BLOCKED | API restricted | LinkedIn policy | Professional sentiment; job postings as signal |
| Top KOL Tracker | 🔲 PLANNED | RSS of key people's blogs/substacks | None | Sam Altman, Ilya, Yann LeCun, Elon Musk, etc. |
| Substack RSS | 🔲 PLANNED | Public substack RSS | None | Ben Evans, Not Boring, Stratechery, etc. |

**Priority unlock:** X API Basic ($100/mo) would add massive value — narrative diffusion, KOL signals, real-time price-moving commentary. Recommend unlock when revenue > $500/mo.

**Agent decision value:** Narrative diffusion signals. When an idea spreads from arXiv → HN → Reddit → X, that's the adoption S-curve. Prediction layer — "how fast is this spreading."

---

## L3 — Markets / Prediction / Trading Signal (Prediction Layer)

| Source | Status | Method | Blocker | Agent Value |
|--------|--------|--------|---------|-------------|
| **Polymarket** | ✅ NEW (2026-03-13) | `fetch_polymarket.py` (free API) | None | Crowd-aggregated probability on events |
| Kalshi | 🔲 PLANNED | `https://trading-api.kalshi.com/trade-api/v2/markets` (free) | None | US-regulated prediction market; higher credibility |
| Yahoo Finance | 🔲 PLANNED | `yfinance` library (free) | None | NVDA, MSFT, GOOG, META stock as AI proxy |
| CoinGecko | 🔲 PLANNED | Free API | None | Crypto as speculative tech sentiment |
| Fed/ECB Data | 🔲 PLANNED | FRED API (free with key) | Need API key | Macro rate environment signal |
| Seeking Alpha RSS | 🔲 PLANNED | RSS (free) | None | Analyst sentiment, earnings signal |

**Agent decision value:** Prediction markets ARE the confidence signal. Polymarket probability on "Will OpenAI release GPT-5 by Q2 2026?" is more actionable than any news article. Prediction layer — "what is the market-implied probability."

---

## L4 — Frontier Technology Verticals (Fact + Prediction Layer)

| Vertical | Status | Sources | Agent Value |
|----------|--------|---------|-------------|
| **Robotics & Embodied AI** | ✅ NEW (2026-03-13) | arXiv + HN + BBC/NYT keywords | Physical AI is the next platform; humanoid robot deployment velocity |
| **Brain-Computer Interface** | ✅ NEW (2026-03-13) | arXiv + BBC keywords | Neuralink clinical progress; human-computer merge timeline |
| **Commercial Space & AI** | ✅ NEW (2026-03-13) | arXiv + HN + BBC keywords | Starship $/kg signal; satellite AI inference market |
| **AI Chips & Custom Silicon** | ✅ NEW (2026-03-13) | arXiv + HN + TechCrunch | NVIDIA moat signal; alternative accelerator race |
| **Autonomous Vehicles** | ✅ NEW (2026-03-13) | arXiv + HN + The Verge keywords | Waymo/Tesla FSD deployment velocity |
| Biotech × AI | 🔲 PLANNED | bioRxiv RSS + NIH data | AlphaFold successor; drug discovery AI signals |
| Nuclear / Energy | 🔲 PLANNED | NRC RSS + energy news | AI datacenter power constraint signal |
| Quantum Computing | 🔲 PLANNED | arXiv quant-ph + IBM/Google blogs | Post-NISQ era signal |

---

## L5 — Professional Judgment Layer (Judgment Layer) — PLANNED

This is the layer that makes Signal Market truly differentiated:

| Source Type | Candidates | Method | Blocker |
|-------------|-----------|--------|---------|
| Wall Street Research | Goldman Sachs, Morgan Stanley, JPM AI research PDFs | PDF scraping from public reports | Mostly paywalled; some public PDFs |
| Consulting Reports | McKinsey, BCG, Bain AI reports (free PDFs) | PDF parsing + LLM extraction | Public PDFs available |
| Think Tank Reports | Brookings, CSET, Georgetown AI reports | PDF + RSS | Free |
| VC Firm Blog Posts | a16z, Sequoia, Benchmark essays | RSS / scraping | Free |
| Founder Public Statements | Public blog posts, conference talks | RSS + YouTube transcript | Free |
| Earnings Call AI Mentions | MSFT, GOOG, META, NVDA, AMZN | Public transcripts (Motley Fool, Seeking Alpha) | Free (with scraping) |

**Implementation plan:**
1. Phase 1 (current): Capture institutional signals via news RSS
2. Phase 2: Add VC firm blog RSS + consulting public reports
3. Phase 3: Earnings call AI-mention tracker
4. Phase 4: Bloomberg/FT integration (when revenue justifies)

---

## Signal Factor Pool (Financial System Value)

The following signal factors must be tracked and scored:

| Factor | Current Coverage | Target |
|--------|-----------------|--------|
| Technology velocity (papers/repos/month) | ✅ arXiv + GitHub | ACTIVE |
| Market probability (prediction markets) | ✅ Polymarket | ACTIVE |
| Community sentiment | ✅ Reddit + HN | ACTIVE |
| News narrative | ✅ BBC/NYT/TC/Verge | ACTIVE |
| Capital flows (funding rounds) | 🔲 Partial (TechCrunch) | PLANNED |
| Stock price as AI proxy | 🔲 PLANNED | Yahoo Finance |
| Talent signal (job postings) | 🔲 PLANNED | LinkedIn/Indeed RSS |
| GPU/compute availability | 🔲 PLANNED | Lambda Labs pricing API |
| Patent filings | 🔲 PLANNED | USPTO RSS |
| Supply chain | 🔲 PLANNED | TSMC/Samsung news |
| Regulatory velocity | 🔲 PARTIAL | Policy RSS planned |
| Expert consensus divergence | 🔲 PLANNED | Requires judgment layer |

---

## Competitive Intelligence: What Signal Market Must Beat

| Product | Their Strength | Our Response |
|---------|---------------|--------------|
| Bloomberg Terminal | Depth of financial data, real-time markets | We need prediction markets (Polymarket/Kalshi) + macro signals |
| Feedly / Perplexity | Fast news aggregation | We add causal analysis, agent-native API, confidence scoring |
| Exploding Topics | Trend discovery from search data | We add causal WHY + prediction layer + agent API |
| CB Insights | Startup intelligence | We cover broader signal universe + agent access |
| Stratechery | Expert judgment | We aggregate expert views programmatically |
| Elicit/Semantic Scholar | Research paper discovery | We cross-validate with market + social signals |

**Our moat:** The ONLY product that combines research signals + prediction markets + social sentiment + news + causal analysis into a single agent-native API with cross-validation confidence scoring.

---

## Execution Priority (Next 30 Days)

| Priority | Item | Value | Effort | Status |
|----------|------|-------|--------|--------|
| P0 | Add Kalshi prediction market | High | Low | NEXT |
| P0 | Fix Reddit → full engagement data | High | Low | Done (RSS workaround) |
| P0 | Add Truth Social RSS for political signals | High | Low | PLANNED |
| P1 | Add Yahoo Finance (NVDA as AI proxy) | High | Low | PLANNED |
| P1 | Add AP wire RSS | Medium | Low | PLANNED |
| P1 | Add VC firm blog RSS (a16z, Sequoia) | High | Low | PLANNED |
| P1 | Earnings call AI-mention tracker | High | Medium | PLANNED |
| P2 | X API ($100/mo) | Very High | Low cost | REQUIRES DECISION |
| P2 | Bloomberg/FT | Critical long-term | High cost | REQUIRES REVENUE |

---

*This document is auto-maintained by the Signal Market engineering team.*  
*Review: 2026-04-13*
