/**
 * /api/v2/judgment/:topic — Professional Judgment Lookup
 * GET /api/v2/judgment/AI%20Agents
 * GET /api/v2/judgment/ai+agents
 *
 * Returns professional judgment data for a topic from the ACTION_LAYER knowledge base,
 * plus recent L5 signals from history.
 *
 * Response:
 * {
 *   "topic": "AI Agents",
 *   "professional_judgment": { consensus, summary, key_voices, ... },
 *   "recent_evidence": [ ... top 5 L5 signals ... ],
 *   "signal_count_l5": 4,
 *   "generated_at": "..."
 * }
 */

import { readFileSync, existsSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __dir = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dir, '..', '..');
const HISTORY_FILE = join(ROOT, 'data', 'signals_history.jsonl');

// ── ACTION_LAYER Professional Judgment Knowledge Base ───────────────────────
// Duplicated from causal.js for standalone endpoint access
const ACTION_LAYER = {
  'AI Agents': {
    monitoring_points: ['arXiv agent paper velocity (weekly)', 'GitHub star growth for top 5 agent frameworks', 'Enterprise AI adoption surveys', 'LLM provider API deprecations'],
    invalidation_conditions: ['Agent benchmark improvements stall for 2+ consecutive quarters', 'Major LLM providers deprecate function-calling / tool use'],
    agent_action: 'Evaluate agentic framework adoption. Track LangGraph, CrewAI, AutoGPT production deployments.',
    urgency: 'high', window: '3–12 months',
    next_best_action: 'Monitor top 5 agent framework GitHub stars weekly. Set alert for any LLM provider API deprecation announcement.',
    decision_question: 'Which agent frameworks will become the production standard in 12 months?',
    escalation_condition: 'Major enterprise announces production agent deployment replacing human workflow',
    downgrade_condition: 'Agent framework consolidation reduces active projects by >50%',
    reversal_condition: 'LLM reasoning capabilities plateau preventing tool-use reliability above 85% success rate',
    professional_judgment: {
      summary: 'VCs and analysts converge: agentic AI is the primary enterprise deployment vector for 2026. YC, Greylock, and a16z all active.',
      key_voices: ['Y Combinator', 'Greylock', 'MIT Technology Review'],
      consensus: 'bullish',
    },
  },
  'LLM Infrastructure': {
    monitoring_points: ['vLLM / TGI GitHub activity', 'Inference benchmark leaderboard updates', 'Cloud provider inference pricing trends', 'NVIDIA H100/H200 allocation & pricing'],
    invalidation_conditions: ['Major cloud providers commoditize all inference optimization', 'Alternative architectures require fundamentally different infrastructure'],
    agent_action: 'Monitor vLLM throughput benchmarks and inference provider pricing. Watch for consolidation.',
    urgency: 'high', window: '3–12 months',
    next_best_action: 'Track monthly cost-per-token from top 5 inference providers. Watch for vLLM vs TGI convergence.',
    decision_question: 'Which inference stack will dominate enterprise LLM serving in 2026?',
    escalation_condition: 'Top 3 hyperscalers announce custom inference chip production',
    downgrade_condition: 'Inference cost per token drops below $0.01 for all major providers',
    reversal_condition: 'Regulatory shutdown of commercial LLM APIs in US+EU simultaneously',
    professional_judgment: {
      summary: 'SemiAnalysis and Stratechery see infrastructure cost as the defining constraint. GB200 NVL72 benchmarks indicate continued NVIDIA dominance.',
      key_voices: ['SemiAnalysis', 'Stratechery', 'MIT Technology Review'],
      consensus: 'bullish',
    },
  },
  'Diffusion Models': {
    monitoring_points: ['Video generation quality benchmarks', 'Copyright litigation outcomes (US + EU)', 'Adobe/Getty integration announcements', 'Sora / Runway / Kling release cadence'],
    invalidation_conditions: ['Regulatory ban on training on copyrighted media', 'Video gen quality plateau without new architecture breakthrough'],
    agent_action: 'Track video generation velocity and copyright litigation outcomes.',
    urgency: 'medium', window: '6–18 months',
    next_best_action: 'Monitor Sora / Kling / Runway new release announcements. Track EU AI Act image generation provisions.',
    decision_question: 'Will video generation reach commercial viability before copyright law catches up?',
    escalation_condition: 'Major studio announces AI-generated film using diffusion pipeline',
    downgrade_condition: 'Copyright settlement restricts training on creative works',
    reversal_condition: 'Supreme Court ruling banning AI training on copyrighted data retroactively',
    professional_judgment: {
      summary: 'Benedict Evans notes creative tool adoption accelerating; legal clarity on IP still the main risk.',
      key_voices: ['Benedict Evans', 'MIT Technology Review'],
      consensus: 'divided',
    },
  },
  'AI Coding': {
    monitoring_points: ['SWE-bench leaderboard monthly', 'GitHub Copilot enterprise adoption rate', 'Job posting demand for AI coding tools', 'Agentic coding autonomous task completion %'],
    invalidation_conditions: ['SWE-bench scores plateau below 50% pass rate', 'Enterprise adoption stalls due to IP / security concerns'],
    agent_action: 'Monitor SWE-bench leaderboard. Track enterprise AI coding tool adoption in job postings.',
    urgency: 'high', window: '3–12 months',
    next_best_action: 'Track SWE-bench top 5 models monthly. Monitor GitHub Copilot enterprise seat count announcements.',
    decision_question: 'When will AI coding reach autonomous completion of real-world software tasks?',
    escalation_condition: 'Major tech company announces AI-authored code in production without human review',
    downgrade_condition: 'Enterprise security policies block AI coding tools across Fortune 500',
    reversal_condition: 'Academic proof that current transformer architecture cannot achieve autonomous software engineering',
    professional_judgment: {
      summary: 'Strong VC interest (TechCrunch Venture) with GitHub Copilot enterprise growth as primary signal. Consensus: coding is the fastest-monetizing AI use case.',
      key_voices: ['TechCrunch Venture', 'Y Combinator', 'Stratechery'],
      consensus: 'bullish',
    },
  },
  'Efficient AI': {
    monitoring_points: ['MMLU/HellaSwag scores for sub-7B models', 'On-device AI hardware announcements (Apple, Qualcomm)', 'Edge inference benchmark releases', 'Hugging Face small model download trends'],
    invalidation_conditions: ['Compute cost drops make efficiency irrelevant', 'Small model quality fails to close gap with large models'],
    agent_action: 'Track MMLU/HellaSwag performance of models <7B. Watch on-device AI hardware announcements.',
    urgency: 'medium', window: '6–18 months',
    next_best_action: 'Monitor Phi-3/Gemma monthly benchmark updates. Track Apple Silicon Neural Engine utilization announcements.',
    decision_question: 'Which small model will become the dominant on-device AI in 2026?',
    escalation_condition: 'Apple/Qualcomm announce on-device LLM runs at full phone battery for 8+ hours',
    downgrade_condition: 'Cloud inference costs drop 10x making edge optimization unnecessary',
    reversal_condition: 'Major hardware bottleneck (DRAM bandwidth limit) prevents sub-1B models from matching 7B capability',
    professional_judgment: {
      summary: 'On-device AI getting serious attention post-Apple Silicon M4. Edge inference as cost arbitrage.',
      key_voices: ['MIT Technology Review', 'Benedict Evans'],
      consensus: 'neutral',
    },
  },
  'AI Reasoning': {
    monitoring_points: ['MATH and GPQA benchmark leaderboard weekly', 'DeepSeek-R1 replication papers', 'o1/o3 API availability and pricing', 'Process reward model paper velocity'],
    invalidation_conditions: ['Reasoning gains fail to transfer to real-world tasks', 'Compute cost per reasoning token remains prohibitive'],
    agent_action: 'Track MATH and GPQA benchmark leaderboard. Monitor reasoning-specialized model releases.',
    urgency: 'high', window: '3–12 months',
    next_best_action: 'Monitor MATH benchmark top-5 monthly. Track o3 API pricing and availability.',
    decision_question: 'Will inference-time compute scaling unlock AGI-level reasoning or hit a ceiling?',
    escalation_condition: 'OpenAI/Anthropic announce o3-class model passes PhD-level reasoning benchmarks',
    downgrade_condition: 'Reasoning improvements fail to transfer beyond benchmark tasks',
    reversal_condition: 'Reproducibility crisis — benchmark contamination invalidates all reasoning claims',
    professional_judgment: {
      summary: 'Stratechery and Dwarkesh see reasoning improvements as the key unlock for autonomous workflows. o3/o4 series as evidence.',
      key_voices: ['Stratechery', 'Dwarkesh Podcast'],
      consensus: 'bullish',
    },
  },
  'Multimodal AI': {
    monitoring_points: ['Multimodal benchmark releases (MMBench, MMMU)', 'Enterprise adoption in medical imaging / design', 'Video understanding model releases', 'GPT-5 / Gemini Ultra multimodal capability announcements'],
    invalidation_conditions: ['Specialized models maintain quality advantage in key verticals', 'Data scarcity limits multimodal training progress'],
    agent_action: 'Monitor multimodal benchmark releases and enterprise adoption in design, medical imaging, and video.',
    urgency: 'medium', window: '6–18 months',
    next_best_action: 'Track MMBench top-5 monthly. Monitor Adobe / Figma AI multimodal integration announcements.',
    decision_question: 'Which multimodal model will dominate enterprise visual tasks in 2026?',
    escalation_condition: 'Fortune 500 design team announces full transition to AI multimodal workflow',
    downgrade_condition: 'Medical/regulatory approval blocks multimodal deployment in high-value verticals',
    reversal_condition: 'Privacy regulation banning multimodal data training (images + text combined)',
    professional_judgment: {
      summary: 'Benedict Evans: Vision Pro + GPT-4o show convergence. Still early for enterprise ROI.',
      key_voices: ['Benedict Evans', 'MIT Technology Review'],
      consensus: 'neutral',
    },
  },
  'Robotics & Embodied AI': {
    monitoring_points: ['Humanoid robot production unit announcements', 'RT-2/π0 model benchmark improvements', 'Manufacturing deployment contracts', 'Figure / 1X / Unitree monthly update releases'],
    invalidation_conditions: ['Physical world transfer learning plateaus without new data modalities', 'Cost per robot stays above $50k for 2+ years'],
    agent_action: 'Track monthly robot deployment announcements and arXiv manipulation paper velocity.',
    urgency: 'high', window: '12–36 months',
    next_best_action: 'Monitor Figure AI and 1X robot production announcements monthly. Track dexterous manipulation arXiv paper count.',
    decision_question: 'Which humanoid robot company will reach 1,000 production units first?',
    escalation_condition: 'Tesla Optimus or Figure 01 announces 10k+ unit production order',
    downgrade_condition: 'Key humanoid robot company shuts down or pivots away from general-purpose',
    reversal_condition: 'Hardware cost floor stays above $50K per unit for 5+ consecutive years',
    professional_judgment: {
      summary: 'TechCrunch Venture: $1.15B+ unicorn in humanoid robotics (Sunday). Greylock sees physical AI as 10-year thesis.',
      key_voices: ['TechCrunch Venture', 'Greylock'],
      consensus: 'bullish',
    },
  },
  'Brain-Computer Interface': {
    monitoring_points: ['Neuralink patient count milestones', 'Non-invasive EEG accuracy benchmarks', 'FDA approval pipeline for BCI devices', 'Synchron clinical trial results'],
    invalidation_conditions: ['Adverse events from implanted devices halt clinical trials', 'Wireless bandwidth limits block high-resolution decoding'],
    agent_action: 'Monitor Neuralink clinical trial updates and non-invasive BCI accuracy papers.',
    urgency: 'medium', window: '12–48 months',
    next_best_action: 'Track Neuralink patient count and Synchron FDA approval timeline quarterly.',
    decision_question: 'Will non-invasive BCI achieve commercial viability before implanted BCIs scale?',
    escalation_condition: 'Neuralink announces first commercial application with healthy consumer users',
    downgrade_condition: 'FDA places clinical hold on all implanted BCI trials',
    reversal_condition: 'FDA permanent ban on non-therapeutic neural implants',
    professional_judgment: {
      summary: 'Not Boring covers Neuralink progress. Long-horizon, high-conviction minority view.',
      key_voices: ['Not Boring'],
      consensus: 'neutral',
    },
  },
  'Commercial Space & AI': {
    monitoring_points: ['Starship launch cadence and reuse count', 'Satellite constellation AI processing announcements', 'Launch cost per kg trajectory', 'Competing launch vehicle milestones (Blue Origin, RocketLab)'],
    invalidation_conditions: ['Starship development halted by regulatory or technical failure', 'Alternative launch vehicles maintain cost competitiveness'],
    agent_action: 'Track Starship launch manifest and per-kg cost estimates quarterly.',
    urgency: 'medium', window: '24–60 months',
    next_best_action: 'Monitor SpaceX Starship launch cadence monthly. Track $/kg cost reduction trajectory.',
    decision_question: 'When will Starship achieve full reusability and collapse launch costs by 10x?',
    escalation_condition: 'Starship achieves full reusability with <48 hour turnaround',
    downgrade_condition: 'FAA grounding extends beyond 6 months or Starship suffers catastrophic failure',
    reversal_condition: 'Kessler syndrome cascade makes low-orbit deployment economically nonviable',
    professional_judgment: {
      summary: 'TechCrunch Venture active in satellite/launch. YC sees space as infrastructure play.',
      key_voices: ['TechCrunch Venture', 'Y Combinator'],
      consensus: 'neutral',
    },
  },
  'AI Chips & Custom Silicon': {
    monitoring_points: ['Groq/Cerebras inference $/token vs NVIDIA', 'Hyperscaler custom silicon production ramp', 'AMD MI300X deployment velocity', 'NVIDIA H200/Blackwell allocation & ASP'],
    invalidation_conditions: ['NVIDIA H100 supply normalizes and ASP drops >40%', 'Custom silicon yields remain low below 7nm process'],
    agent_action: 'Track inference cost benchmarks and hyperscaler ASIC deployment announcements.',
    urgency: 'high', window: '6–24 months',
    next_best_action: 'Track monthly $/token benchmarks for Groq vs Cerebras vs NVIDIA. Monitor AMD MI300X deployment announcements.',
    decision_question: 'Will alternative AI accelerators capture >20% market share from NVIDIA by 2027?',
    escalation_condition: 'Hyperscaler announces custom chip handles >50% of internal inference load',
    downgrade_condition: 'NVIDIA Blackwell pricing drops 40%+ eliminating alternative chip economics',
    reversal_condition: 'NVIDIA GPU price drops >70% making custom silicon ROI negative',
    professional_judgment: {
      summary: 'SemiAnalysis: H100 vs GB200 NVL72 benchmarks favor GB200 4x on training throughput. Custom silicon ROI debate ongoing.',
      key_voices: ['SemiAnalysis'],
      consensus: 'bullish',
    },
  },
  'Autonomous Vehicles': {
    monitoring_points: ['Waymo weekly ride volume quarterly', 'Tesla FSD miles per disengagement', 'Robotaxi expansion city announcements', 'Apollo / WeRide China fleet size'],
    invalidation_conditions: ['Major autonomous accident triggers federal regulatory freeze', 'LiDAR/sensor cost fails to reach sub-$500 threshold'],
    agent_action: 'Monitor Waymo weekly ride count, Tesla FSD v12 disengagement rate, and robotaxi expansion cities.',
    urgency: 'high', window: '12–36 months',
    next_best_action: 'Track Waymo weekly ride count quarterly reports. Monitor Tesla FSD release notes for disengagement improvements.',
    decision_question: 'Will Waymo or Tesla FSD reach commercial scale in 10+ cities by end of 2026?',
    escalation_condition: 'Waymo/Tesla announces robotaxi service in 5+ major cities simultaneously',
    downgrade_condition: 'Federal regulator imposes moratorium on autonomous vehicle expansion',
    reversal_condition: 'Federal legislation requiring human driver present at all times in perpetuity',
    professional_judgment: {
      summary: 'Mixed signals. Waymo expansion vs regulatory headwinds. Stratechery skeptical of timeline.',
      key_voices: ['Stratechery', 'TechCrunch Venture'],
      consensus: 'divided',
    },
  },
  'AI Policy & Governance': {
    monitoring_points: ['EU AI Act high-risk system compliance deadlines', 'US NIST AI RMF adoption by federal contractors', 'Frontier model reporting requirements', 'China AI governance new regulations'],
    invalidation_conditions: ['Regulatory deadlines extended under industry lobbying', 'Major AI safety incident accelerates restrictions beyond current scope'],
    agent_action: 'Track EU AI Act enforcement timeline and US NIST framework adoption milestones.',
    urgency: 'medium', window: '6–24 months',
    next_best_action: 'Monitor EU AI Act implementation dates monthly. Track US congressional AI legislation votes.',
    decision_question: 'Will EU AI Act enforcement reshape AI product development more than GDPR did?',
    escalation_condition: 'First major AI company fined under EU AI Act at GDPR-scale penalties',
    downgrade_condition: 'Key EU AI Act provisions delayed or weakened through industry pressure',
    reversal_condition: 'AI regulatory capture — policy permanently delayed, no binding rules enacted in 5 years',
    professional_judgment: {
      summary: 'The Hill + CNBC tracking congressional AI hearings. EU AI Act enforcement timeline 2026. Stratechery: governance will lag innovation by 5+ years.',
      key_voices: ['The Hill', 'Stratechery', 'MIT Technology Review'],
      consensus: 'divided',
    },
  },
  'AI Investment & Capital': {
    monitoring_points: ['Monthly AI funding announcements >$100M', 'Hyperscaler AI capex guidance', 'AI startup acquisition activity', 'AI company IPO pipeline'],
    invalidation_conditions: ['Interest rate shock dries up growth capital', 'AI revenue multiples compress below 10x ARR'],
    agent_action: 'Track monthly AI funding rounds and hyperscaler capex announcements.',
    urgency: 'high', window: '6–18 months',
    next_best_action: 'Monitor weekly AI funding rounds >$50M. Track MSFT/GOOG/META quarterly capex guidance.',
    decision_question: 'Is AI investment in a sustainable growth phase or approaching a peak valuation cycle?',
    escalation_condition: 'Hyperscaler AI capex guidance increases 50%+ quarter-over-quarter',
    downgrade_condition: 'Major AI startup down round or acquisition below 5x ARR',
    reversal_condition: 'Broad AI winter — VC funding drops >80% for 3+ consecutive quarters',
    professional_judgment: {
      summary: 'TechCrunch Venture: $30M+ rounds weekly in AI infra. YC W26 cohort 70%+ AI. Capital concentration at infra+agent layers.',
      key_voices: ['TechCrunch Venture', 'Y Combinator', 'Greylock'],
      consensus: 'bullish',
    },
  },
  'Reinforcement Learning': {
    monitoring_points: ['RLHF paper velocity', 'DPO/GRPO adoption rate', 'OpenAI o1/o3 RL usage', 'Process reward model benchmarks'],
    invalidation_conditions: ['RLHF replaced by simpler fine-tuning methods', 'Reward hacking proves unsolvable at scale'],
    agent_action: 'Track RLHF and DPO paper velocity. Monitor o1/o3 model updates.',
    urgency: 'high', window: '3–12 months',
    next_best_action: 'Monitor arXiv RL papers weekly. Track process reward model adoption.',
    decision_question: 'Will RL-driven reasoning unlock AGI or hit fundamental limits?',
    escalation_condition: 'OpenAI announces o4-class model with RL-driven reasoning breakthrough',
    downgrade_condition: 'RLHF paper velocity drops 50%+ as DPO becomes dominant',
    reversal_condition: 'Academic consensus that RL cannot improve reasoning beyond current plateau',
    professional_judgment: {
      summary: 'Dwarkesh and Stratechery see RL as critical path to AGI reasoning. o1 series as proof point.',
      key_voices: ['Dwarkesh Podcast', 'Stratechery'],
      consensus: 'bullish',
    },
  },
  'Transformer Architecture': {
    monitoring_points: ['FlashAttention adoption', 'Mamba/SSM paper velocity', 'Context length benchmarks', 'MoE model releases'],
    invalidation_conditions: ['SSM/Mamba achieves clear superiority over transformers', 'Transformer efficiency improvements plateau'],
    agent_action: 'Monitor architecture research papers and context length improvements.',
    urgency: 'medium', window: '6–24 months',
    next_best_action: 'Track FlashAttention v3 adoption. Monitor Mamba benchmark improvements.',
    decision_question: 'Will transformers remain dominant or will SSM/Mamba architectures take over?',
    escalation_condition: 'Major model provider announces SSM-based flagship model',
    downgrade_condition: 'Transformer paper velocity drops below SSM/alternative papers',
    reversal_condition: 'Fundamental proof that attention cannot scale beyond current context limits',
    professional_judgment: {
      summary: 'Architecture evolution ongoing. Transformers dominant but under pressure from SSM alternatives.',
      key_voices: ['MIT Technology Review', 'Benedict Evans'],
      consensus: 'neutral',
    },
  },
};

// Topic aliases
ACTION_LAYER['Transformer Arch'] = ACTION_LAYER['Transformer Architecture'];
ACTION_LAYER['AI Infrastructure'] = ACTION_LAYER['LLM Infrastructure'];

// L5 source tags for filtering recent evidence
const L5_SOURCE_TAGS = ['vc_blog', 'analyst', 'judgment', 'greylock', 'tc_venture', 'tc_ai', 'yc_blog', 'mit_tr', 'stratechery', 'semianalysis', 'benedict_evans', 'not_boring', 'dwarkesh'];

// ── Helper: load signals history ─────────────────────────────────────────────
function loadSignalsHistory() {
  if (!existsSync(HISTORY_FILE)) return [];
  try {
    const content = readFileSync(HISTORY_FILE, 'utf-8');
    const signals = [];
    for (const line of content.split('\n').filter(Boolean)) {
      try {
        signals.push(JSON.parse(line));
      } catch {
        // skip malformed lines
      }
    }
    return signals;
  } catch {
    return [];
  }
}

// ── Helper: normalize topic for comparison ───────────────────────────────────
function normalizeTopic(topic) {
  return (topic || '').toLowerCase().replace(/[\s_+]/g, ' ').trim();
}

// ── Handler ──────────────────────────────────────────────────────────────────
export default function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, x-api-key');
  res.setHeader('Cache-Control', 'public, s-maxage=60, stale-while-revalidate=120');

  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'GET') return res.status(405).json({ error: 'GET only' });

  try {
    // Get topic from URL path or query param
    const urlPath = (req.url || '').split('?')[0];
    const parts = urlPath.split('/').filter(Boolean);
    const topicParam = req.query?.topic || parts[parts.length - 1];

    if (!topicParam || topicParam === 'judgment') {
      return res.status(400).json({
        error: 'Topic required',
        usage: 'GET /api/v2/judgment/:topic or GET /api/v2/judgment?topic=AI+Agents'
      });
    }

    const normalizedQuery = normalizeTopic(topicParam);

    // Find matching topic in ACTION_LAYER
    let matchedTopic = null;
    let matchedJudgment = null;
    for (const [topic, data] of Object.entries(ACTION_LAYER)) {
      if (normalizeTopic(topic) === normalizedQuery) {
        matchedTopic = topic;
        matchedJudgment = data;
        break;
      }
    }

    if (!matchedJudgment) {
      // Return 404 with available topics
      const availableTopics = Object.keys(ACTION_LAYER).filter(
        k => !k.includes(' ') || !ACTION_LAYER[k] // exclude aliases
      ).filter(
        (topic, idx, arr) => arr.indexOf(topic) === idx // unique
      );
      return res.status(404).json({
        error: 'Topic not found',
        requested: topicParam,
        available_topics: availableTopics.sort(),
      });
    }

    // Load recent L5 evidence from history
    const history = loadSignalsHistory();
    const l5Signals = history.filter(s => {
      const topicMatch = normalizeTopic(s.topic) === normalizedQuery;
      const isL5 = s.source_layer === 'L5';
      const hasL5Tag = (s.source_tag && L5_SOURCE_TAGS.includes(s.source_tag));
      return topicMatch && (isL5 || hasL5Tag);
    });

    // Sort by date (newest first) and take top 5
    l5Signals.sort((a, b) => {
      const aDate = a.published_at || a.first_seen || a.merged_at || '';
      const bDate = b.published_at || b.first_seen || b.merged_at || '';
      return bDate.localeCompare(aDate);
    });

    const recentEvidence = l5Signals.slice(0, 5).map(s => ({
      title: s.title || s.topic,
      source_tag: s.source_tag || s.source_layer || 'unknown',
      source_url: s.source_url || null,
      published_at: s.published_at || s.first_seen || s.merged_at || null,
      signal_id: s.signal_id,
    }));

    return res.status(200).json({
      topic: matchedTopic,
      professional_judgment: matchedJudgment.professional_judgment || {},
      recent_evidence: recentEvidence,
      signal_count_l5: l5Signals.length,
      generated_at: new Date().toISOString(),
    });

  } catch (err) {
    console.error('judgment error:', err);
    return res.status(500).json({ error: 'Internal error', detail: err.message });
  }
}
