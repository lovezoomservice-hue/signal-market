# Signal Object Schema

**Version:** v2
**Last Updated:** 2026-03-13
**Applies to:** All `/api/v2/*` endpoints

---

## Canonical Signal Object

All v2 endpoints MUST return signals with (at minimum) the following fields:

| Field | Type | Description | Example |
|-------|------|-------------|---------|
| `signal_id` | string | Unique identifier for the signal | `"evt_001"` |
| `topic` | string | Technology topic/category | `"AI Agents"` |
| `stage` | string | Lifecycle stage | `"accelerating"` |
| `confidence` | float | Confidence score (0-1) | `0.92` |
| `urgency` | string | Urgency level (derived from stage if not set) | `"high"` |
| `impact_score` | float | Estimated impact (0-1) | `0.85` |
| `sources` | string[] | Data source identifiers | `["arxiv", "github"]` |
| `source_url` | string | Primary source URL | `"https://arxiv.org/..."` |
| `evidence_count` | int | Number of evidence items | `5` |
| `updated_at` | string | ISO timestamp of last update | `"2026-03-13T00:00:00Z"` |

---

## Field Specifications

### `signal_id`
- **Format:** `evt_XXX` where XXX is a zero-padded number
- **Uniqueness:** Guaranteed unique within the signal corpus
- **Example:** `"evt_001"`, `"evt_042"`

### `topic`
- **Description:** The technology domain or trend the signal represents
- **Known values:** `"AI Agents"`, `"LLM Infrastructure"`, `"Diffusion Models"`, `"AI Coding"`, `"AI Reasoning"`, `"Efficient AI"`, `"Reinforcement Learning"`, `"Multimodal AI"`, `"Robotics & Embodied AI"`, `"Brain-Computer Interface"`, `"Commercial Space & AI"`, `"AI Chips & Custom Silicon"`, `"Autonomous Vehicles"`, `"AI Policy & Governance"`, `"AI Investment & Capital"`

### `stage`
- **Description:** Lifecycle stage of the technology signal
- **Allowed values:**
  - `"accelerating"` — Multiple sources confirming rapid momentum
  - `"forming"` — Early evidence accumulating
  - `"emerging"` — Initial signals detected, low confidence
  - `"fading"` — Momentum slowing
  - `"peak"` — Plateau reached
  - `"weak"` — Low confidence/strength
  - `"dead"` — Signal no longer active

### `urgency`
- **Description:** Action urgency derived from stage
- **Mapping:**
  - `accelerating` → `"high"`
  - `peak` → `"high"`
  - `forming` → `"medium"`
  - `emerging` → `"low"`
  - `fading` → `"low"`
  - `weak` → `"low"`
- **Default:** `"medium"` if stage is unknown

### `confidence`
- **Type:** Float between 0 and 1
- **Meaning:** Statistical confidence in the signal detection
- **Thresholds:**
  - `≥0.90` — High confidence, strong evidence convergence
  - `≥0.70` — Moderate confidence, actionable
  - `<0.70` — Low confidence, monitor for escalation

### `impact_score`
- **Type:** Float between 0 and 1
- **Meaning:** Estimated potential impact if signal confirms

### `sources`
- **Type:** Array of source identifiers
- **Known sources:** `"arxiv"`, `"github"`, `"huggingface"`, `"techcrunch"`, `"bloomberg"`, `"sec_filings"`, `"patents"`
- **Cross-validation:** Signals with ≥2 unique sources have higher confidence

### `source_url`
- **Description:** Canonical URL to primary evidence
- **Format:** Valid HTTP(S) URL

### `evidence_count`
- **Type:** Integer
- **Meaning:** Number of distinct evidence items supporting the signal

### `updated_at`
- **Format:** ISO 8601 timestamp
- **Example:** `"2026-03-13T00:00:00Z"`
- **Requirement:** MUST be present in all v2 endpoint responses

---

## Optional/Extended Fields

These fields may appear in specific endpoint responses:

| Field | Endpoint | Description |
|-------|----------|-------------|
| `rank` | `/api/v2/rank`, `/api/v2/agent-brief` | Position in ranked list (1-based) |
| `agent_score` | `/api/v2/rank`, `/api/v2/agent-brief` | Computed actionability score |
| `agent_action` | `/api/v2/rank`, `/api/v2/agent-brief` | Recommended agent action |
| `next_best_action` | `/api/v2/*` | Single most important next action |
| `decision_question` | `/api/v2/*` | Key decision question for this signal |
| `window` | `/api/v2/*` | Decision window (e.g., "3-12 months") |
| `monitoring_points` | `/api/v2/causal/*` | What to monitor |
| `invalidation_conditions` | `/api/v2/causal/*` | What would invalidate the thesis |
| `primary_cause` | `/api/v2/causal/*` | Root cause analysis |
| `connected_topics` | `/api/v2/brief` | Related signals via graph edges |
| `cross_validated` | `/api/v2/*` | Boolean: ≥2 independent sources |

---

## Endpoint Compliance Checklist

All v2 endpoints must include these fields in their signal objects:

- [ ] `/api/v2/rank` — ✅ Includes `updated_at`, derives `urgency` from stage
- [ ] `/api/v2/compare` — ✅ Includes `updated_at`, derives `urgency` from stage
- [ ] `/api/v2/filter` — ✅ Includes `updated_at`, derives `urgency` from stage
- [ ] `/api/v2/agent-brief` — ✅ Includes `updated_at`, derives `urgency` from stage
- [ ] `/api/v2/brief` — ✅ Includes enriched signals with all required fields
- [ ] `/api/v2/causal/:id` — ✅ Returns causal chain with signal metadata
- [ ] `/api/v2/subscribe` — ✅ Returns subscription objects (different schema)

---

## Example Response (v2 compliant)

```json
{
  "signal_id": "evt_001",
  "topic": "AI Agents",
  "stage": "accelerating",
  "confidence": 0.92,
  "urgency": "high",
  "impact_score": 0.88,
  "sources": ["arxiv", "github", "techcrunch"],
  "source_url": "https://arxiv.org/abs/2401.xxxxx",
  "evidence_count": 7,
  "updated_at": "2026-03-13T00:00:00Z",
  "cross_validated": true,
  "agent_action": "Evaluate agentic framework adoption.",
  "next_best_action": "Monitor top 5 agent framework GitHub stars weekly.",
  "decision_question": "Which agent frameworks will become the production standard?",
  "window": "3-12 months"
}
```

---

## Schema Evolution

| Version | Date | Changes |
|---------|------|---------|
| v2 | 2026-03-13 | Added `updated_at` requirement, standardized `urgency` derivation |
| v1 | 2026-02-01 | Initial schema definition |
