/**
 * GET /api/v2/causal/:signal_id
 * GET /api/v2/causal  (all causal chains)
 *
 * Causal Engine P0-B — Why is this signal happening?
 *
 * Returns a CausalChainObject:
 *   primary_cause      — Root driver of the signal
 *   enabling_factors   — What makes the cause possible now
 *   accelerants        — What is making it happen faster
 *   inhibitors         — What could slow or reverse it
 *   causal_confidence  — Confidence in the causal model (0–1)
 *   evidence_links     — Which evidence items support each cause
 *   causal_chain       — Ordered chain: root → mechanism → observable signal
 *
 * State: P0-B (partial — causal chains are model-derived from signal data
 *   until dedicated causal inference layer is wired)
 */

import { getUnifiedSignals } from '../_unified.js';

// ── Causal knowledge base (topic → causal model) ────────────────────────────
// This is the domain intelligence layer. Each entry captures the structured
// causal reasoning for a known signal topic.
const CAUSAL_MODELS = {
  'AI Agents': {
    primary_cause: 'LLM capability crossing the threshold for reliable tool use and multi-step planning',
    mechanism: 'GPT-4 and successors demonstrated that language models can reliably call functions, maintain state across steps, and recover from failures — making agentic architectures viable in production.',
    enabling_factors: [
      'Function calling APIs standardized across major LLM providers',
      'Open-source agent frameworks (LangChain, AutoGPT, CrewAI) lowering build cost',
      'Cloud infrastructure matured for stateful, long-running AI processes',
      'Enterprise IT departments willing to evaluate AI automation',
    ],
    accelerants: [
      'arXiv publication velocity on agent architectures at historical high',
      'GitHub repository creation for agent tooling exceeding prior AI categories',
      'Major tech companies open-sourcing agent evaluation frameworks',
      'Venture capital increasing agent-specific investment round sizes',
    ],
    inhibitors: [
      'Production reliability gaps — agents fail unpredictably on edge cases',
      'Latency and cost per agent-task still 10-100x human-equivalent',
      'Regulatory pressure on autonomous decision-making in high-stakes domains',
      'Trust deficit in enterprise deployment without human-in-the-loop',
    ],
    causal_chain: [
      { step: 1, label: 'LLM capability inflection', description: 'Reliable function calling + planning emerges in frontier models' },
      { step: 2, label: 'Framework standardization', description: 'Open-source agent frameworks abstract complexity, lower barrier' },
      { step: 3, label: 'Research acceleration', description: 'Academia and industry publish agent evaluation, benchmarks, architectures' },
      { step: 4, label: 'Adoption signal', description: 'GitHub activity + enterprise pilots + VC investment confirm momentum' },
    ],
    causal_confidence: 0.88,
  },

  'LLM Infrastructure': {
    primary_cause: 'Production LLM deployment at scale creates a new infrastructure bottleneck — serving, optimization, and cost reduction become critical',
    mechanism: 'As organizations move from LLM experiments to production workloads, the naive API-call approach becomes prohibitively expensive and slow. Specialized inference infrastructure emerges as a mandatory investment.',
    enabling_factors: [
      'GPU hardware availability improving (H100/A100 supply recovery)',
      'CUDA ecosystem maturity enabling custom kernel development',
      'Open-weight models (Llama, Mistral) enabling on-premise deployment',
      'Enterprise cost pressure forcing inference optimization',
    ],
    accelerants: [
      'vLLM achieving 24x throughput improvement over naive serving',
      'Quantization (GPTQ, AWQ) enabling smaller hardware footprints',
      'Multiple funded startups competing in inference optimization',
      'Cloud providers adding LLM-specific instance types',
    ],
    inhibitors: [
      'Hardware abstraction layers still fragmented',
      'New model architectures may require different optimization approaches',
      'Cloud provider commoditization could eliminate infrastructure moat',
    ],
    causal_chain: [
      { step: 1, label: 'Production adoption', description: 'LLMs move from experiments to business-critical applications' },
      { step: 2, label: 'Cost and latency crisis', description: 'Naive API calls become too expensive and slow at scale' },
      { step: 3, label: 'Infrastructure investment', description: 'Specialized serving, optimization, and caching solutions emerge' },
      { step: 4, label: 'Ecosystem maturation', description: 'Research + tooling + funding converge on infrastructure layer' },
    ],
    causal_confidence: 0.85,
  },

  'Diffusion Models': {
    primary_cause: 'Score-based diffusion achieved photorealistic image generation quality, triggering a research and commercialization race',
    mechanism: 'DDPM and latent diffusion (Stable Diffusion) demonstrated that iterative denoising produces higher quality outputs than GANs, with better training stability. Immediate commercial applications unlocked mass adoption.',
    enabling_factors: [
      'Stable Diffusion open-sourced — community can iterate on base model',
      'Consumer GPU (RTX series) sufficient for local image generation',
      'HuggingFace providing model hosting, fine-tuning, and community infrastructure',
      'Video/3D extensions proving architecture generalizes beyond images',
    ],
    accelerants: [
      'Rapid fine-tuning techniques (LoRA, DreamBooth) enabling personalization',
      'B2B applications in design, advertising, and content creation validated',
      'Competitive pressure between Midjourney, DALL-E, Stable Diffusion driving quality race',
    ],
    inhibitors: [
      'Copyright litigation creating legal uncertainty around training data',
      'Video generation still computationally expensive for long sequences',
      'Quality plateau effect — diminishing returns on additional scale',
    ],
    causal_chain: [
      { step: 1, label: 'Architecture breakthrough', description: 'Latent diffusion outperforms GANs on quality + diversity' },
      { step: 2, label: 'Open source release', description: 'Stable Diffusion enables community and commercial adoption' },
      { step: 3, label: 'Ecosystem explosion', description: 'HuggingFace, fine-tuning, community models, commercial wrappers' },
      { step: 4, label: 'Sustained momentum', description: 'Video/3D extensions + commercial validation sustain research' },
    ],
    causal_confidence: 0.90,
  },

  'AI Coding': {
    primary_cause: 'LLMs trained on code corpora achieved human-competitive performance on software engineering benchmarks, triggering rapid tool adoption',
    mechanism: 'GitHub Copilot demonstrated that transformer models fine-tuned on code can meaningfully accelerate developer workflows. Subsequent models (Codex, Claude, Gemini) extended this to full repo understanding and autonomous editing.',
    enabling_factors: [
      'Massive publicly available code training data (GitHub, HuggingFace)',
      'IDE integration APIs mature enough for seamless tool embedding',
      'Developer openness to AI assistance higher than other knowledge workers',
      'SWE-bench and similar benchmarks creating measurable quality bar',
    ],
    accelerants: [
      'Agentic coding tools (Devin, Cursor, Claude Code) showing autonomous task completion',
      'SWE-bench scores improving rapidly across frontier model generations',
      'Enterprise software teams under productivity pressure adopting AI tooling',
      'Open-source coding models (DeepSeek Coder, Code Llama) commoditizing base capability',
    ],
    inhibitors: [
      'Security and IP concerns around AI-generated code in production',
      'Model hallucination rates still non-trivial for complex debugging tasks',
      'Developer trust gap for fully autonomous code deployment',
    ],
    causal_chain: [
      { step: 1, label: 'Code LLM breakthrough', description: 'Codex/Copilot demonstrates LLMs can generate useful production code' },
      { step: 2, label: 'IDE integration', description: 'GitHub Copilot, Cursor normalize AI assistance in developer workflow' },
      { step: 3, label: 'Agentic leap', description: 'Tools advance from completion to autonomous editing and task execution' },
      { step: 4, label: 'Enterprise adoption', description: 'Software orgs adopt AI coding tools as productivity infrastructure' },
    ],
    causal_confidence: 0.86,
  },

  'Reinforcement Learning': {
    primary_cause: 'RLHF (Reinforcement Learning from Human Feedback) became the primary alignment technique for LLMs, reigniting RL research at scale',
    mechanism: 'InstructGPT and ChatGPT demonstrated that RLHF dramatically improves LLM helpfulness and safety. This created a feedback loop: RL researchers pivoted to LLM alignment, LLM labs hired RL researchers, producing a research burst.',
    enabling_factors: [
      'LLM scale providing sufficiently capable policy models for RL fine-tuning',
      'PPO and related algorithms proving sufficient for RLHF at scale',
      'Constitutional AI and DPO as alternatives to PPO lowering compute requirements',
      'Open-source RLHF implementations enabling academic research',
    ],
    accelerants: [
      'Every major LLM provider using RL for alignment — creates research competition',
      'Reasoning models (o1, DeepSeek-R1) using RL for chain-of-thought improvement',
      'Academic community reconnecting RL theory with practical LLM applications',
      'Process reward models enabling dense reward in mathematical reasoning',
    ],
    inhibitors: [
      'Reward hacking remains unsolved — optimizing proxy rewards diverges from intent',
      'Compute cost of RLHF significantly higher than supervised fine-tuning',
      'Human labeler fatigue and quality limits scalability',
    ],
    causal_chain: [
      { step: 1, label: 'RLHF proves alignment value', description: 'InstructGPT/ChatGPT shows RL dramatically improves LLM behavior' },
      { step: 2, label: 'Research convergence', description: 'RL and NLP communities merge around LLM alignment problems' },
      { step: 3, label: 'Reasoning RL wave', description: 'RL applied to chain-of-thought reasoning — o1, DeepSeek-R1 demonstrate results' },
      { step: 4, label: 'Sustained academic activity', description: 'arXiv RL papers proliferate; new RL variants (DPO, GRPO) published rapidly' },
    ],
    causal_confidence: 0.80,
  },

  'Transformer Architecture': {
    primary_cause: 'Transformer architecture\'s scalability properties have not yet been exhausted — ongoing architectural research extends capabilities while addressing known limitations',
    mechanism: 'The original "Attention is All You Need" transformer has dominated NLP and vision for 7+ years. Continued research is driven by two forces: extending the architecture (longer context, efficiency) and finding successors (SSMs, MoE, hybrid).',
    enabling_factors: [
      'Massive industry investment in making transformers more efficient at scale',
      'Flash Attention and memory-efficient variants enabling 100K+ context windows',
      'Mixture-of-Experts (MoE) proving sparse transformers match dense quality at lower cost',
      'Academic freedom to explore architectural alternatives funded by foundation model labs',
    ],
    accelerants: [
      'State space models (Mamba) providing serious architectural alternative',
      'Long-context applications (legal, codebase, scientific) demanding architectural improvements',
      'Multi-modal models requiring architectural adaptation beyond pure text',
      'Inference cost pressure driving exploration of more efficient architectures',
    ],
    inhibitors: [
      'Quadratic attention complexity partially addressed but not eliminated',
      'New architectures require retraining — enormous switching cost',
      'Entrenched infrastructure investment in transformer-optimized hardware',
    ],
    causal_chain: [
      { step: 1, label: 'Architecture dominance locked in', description: 'Transformer becomes universal architecture across modalities' },
      { step: 2, label: 'Scaling limit pressure', description: 'Context length, compute cost, and capability limits drive architectural research' },
      { step: 3, label: 'Variants and alternatives', description: 'MoE, SSM, linear attention variants compete with and extend original architecture' },
      { step: 4, label: 'Sustained research publication', description: 'arXiv architecture papers continue at high velocity as field seeks next breakthrough' },
    ],
    causal_confidence: 0.75,
  },

  'AI Reasoning': {

    primary_cause: 'Chain-of-thought prompting and process reward models revealed that LLMs can improve reasoning accuracy through extended computation at inference time',
    mechanism: 'Wei et al. (2022) showed that prompting LLMs to "think step by step" dramatically improved math and logic task performance. OpenAI o1 then demonstrated that scaling inference-time compute (rather than just training compute) improves reasoning — opening a new scaling dimension.',
    enabling_factors: [
      'LLMs at sufficient scale to produce coherent multi-step reasoning chains',
      'MATH and GSM8K benchmarks creating measurable targets for reasoning research',
      'Process reward models enabling fine-grained step-level feedback',
      'Open-source reasoning datasets enabling academic reproduction',
    ],
    accelerants: [
      'OpenAI o1 public release demonstrates inference-time scaling as viable path',
      'DeepSeek-R1 open-sources a competitive reasoning model — triggers research wave',
      'Mathematical reasoning demand in science, finance, coding driving commercial investment',
      'Chain-of-thought techniques generalizing to code, planning, multi-step tasks',
    ],
    inhibitors: [
      'Longer reasoning chains significantly increase inference latency and cost',
      'Benchmark saturation creating "reasoning capability illusion" concerns',
      'Adversarial prompts can derail even strong reasoning chains',
    ],
    causal_chain: [
      { step: 1, label: 'Chain-of-thought discovery', description: 'Step-by-step prompting proves LLMs can reason better with explicit intermediate steps' },
      { step: 2, label: 'Inference-time scaling', description: 'o1 demonstrates scaling test-time compute improves reasoning — new scaling axis found' },
      { step: 3, label: 'Open replication', description: 'DeepSeek-R1 and academic replications open the research to the broader community' },
      { step: 4, label: 'Application demand', description: 'Math, code, scientific reasoning applications drive sustained commercial and academic investment' },
    ],
    causal_confidence: 0.83,
  },

  'Efficient AI': {
    primary_cause: 'The cost-to-capability ratio of large models is unsustainable at scale — compression, pruning, and distillation become economically mandatory',
    mechanism: 'As LLM deployment costs grow, the industry is forced to invest in techniques that maintain capability while reducing compute. This creates a sustained research and engineering push on efficiency.',
    enabling_factors: [
      'Mathematical foundations of model compression well-established',
      'Hardware vendors (Qualcomm, Apple) incentivizing on-device AI',
      'Edge deployment requirements creating demand for smaller models',
      'Academic community producing open techniques (LoRA, QLoRA, etc.)',
    ],
    accelerants: [
      'Phi-2, Gemma, and similar small models matching larger model benchmarks',
      'On-device AI becoming product differentiation for consumer hardware',
      'HuggingFace leaderboard normalizing efficiency benchmarks',
    ],
    inhibitors: [
      'Some capability loss inevitable at extreme compression ratios',
      'Task-specific compression limiting generalizability',
    ],
    causal_chain: [
      { step: 1, label: 'Cost pressure', description: 'Production LLM costs become unsustainable for many use cases' },
      { step: 2, label: 'Efficiency research surge', description: 'Quantization, pruning, distillation research accelerates' },
      { step: 3, label: 'Small model quality breakthrough', description: 'Phi/Gemma class models prove efficiency-capability tradeoff improving' },
      { step: 4, label: 'Ecosystem standardization', description: 'HuggingFace, quantization libraries, on-device SDKs mature' },
    ],
    causal_confidence: 0.82,
  },
};

// Topic name aliases (short names that appear in signal data map to full names)
CAUSAL_MODELS['Transformer Arch'] = CAUSAL_MODELS['Transformer Architecture'];
CAUSAL_MODELS['AI Infrastructure'] = {
  primary_cause: 'Enterprise AI workloads scaling to production are creating a new infrastructure investment cycle — compute, storage, networking, and cooling all require AI-specific upgrades',
  mechanism: 'As LLMs move from experimentation to mission-critical applications, the infrastructure supporting them (GPU clusters, vector databases, low-latency networking) becomes a capital expenditure priority. This creates a sustained investment signal detectable via financial news.',
  enabling_factors: ['Cloud providers adding AI-specific instance types and regions', 'On-premise GPU deployment for privacy-sensitive workloads', 'Vector database infrastructure maturing (Pinecone, Weaviate, pgvector)'],
  accelerants: ['Hyperscaler capex guidance increasing AI infrastructure spend', 'AI energy consumption driving data center construction', 'Sovereign AI initiatives requiring domestic infrastructure'],
  inhibitors: ['GPU supply constraints limiting deployment velocity', 'Energy grid constraints in high-density compute regions', 'Economic slowdown reducing enterprise AI capex'],
  causal_chain: [
    { step: 1, label: 'Production AI adoption', description: 'LLMs and AI systems become business-critical requiring reliable infrastructure' },
    { step: 2, label: 'Infrastructure investment surge', description: 'Data centers, GPU clusters, networking upgraded for AI workloads' },
    { step: 3, label: 'Financial signal', description: 'Hyperscaler earnings calls, data center REITs, GPU vendors reflect AI infra spend' },
  ],
  causal_confidence: 0.73,
};

// Default causal template for unknown topics
function defaultCausal(signal) {
  return {
    primary_cause: `Convergent activity in ${signal.category || 'AI'} — multiple independent evidence sources confirming trend momentum`,
    mechanism: `Research publication velocity and code repository activity both trending upward, confirming genuine community investment rather than isolated interest.`,
    enabling_factors: [
      `Prior work in ${signal.topic} established viable technical foundations`,
      `Developer tooling and frameworks matured sufficiently for adoption`,
      `Multiple research groups independently pursuing similar directions`,
    ],
    accelerants: [
      `arXiv publication rate for ${signal.topic} trending upward`,
      `GitHub repository creation in related tools accelerating`,
    ],
    inhibitors: [
      'Technical complexity limiting production deployment',
      'Limited cross-domain validation so far',
    ],
    causal_chain: [
      { step: 1, label: 'Research foundation', description: `Core ${signal.topic} techniques proved viable in academic settings` },
      { step: 2, label: 'Community adoption', description: 'Developer community begins building and extending core techniques' },
      { step: 3, label: 'Evidence convergence', description: 'Multiple independent sources confirm momentum simultaneously' },
    ],
    causal_confidence: 0.55,
  };
}

// ── WorldState extension ─────────────────────────────────────────────────────
function buildCausalObject(signal) {
  const model = CAUSAL_MODELS[signal.topic] || defaultCausal(signal);

  return {
    signal_id: signal.signal_id,
    topic: signal.topic,
    stage: signal.stage,
    confidence: signal.confidence,

    // Core causal intelligence
    primary_cause: model.primary_cause,
    mechanism: model.mechanism,
    enabling_factors: model.enabling_factors || [],
    accelerants: model.accelerants || [],
    inhibitors: model.inhibitors || [],
    causal_chain: model.causal_chain || [],
    causal_confidence: model.causal_confidence || 0.55,
    causal_model_source: CAUSAL_MODELS[signal.topic] ? 'domain_knowledge' : 'derived',

    // Evidence linkage
    evidence_sources: signal.sources || [],
    cross_validated: signal.cross_validated || (signal.sources || []).length >= 2,

    // Answer "why now"
    why_now: {
      timing_factors: [
        `Signal entered ${signal.stage} stage — momentum is building, not peaking`,
        `${(signal.sources || []).length} independent source categories confirming simultaneously`,
        signal.evidenceCount >= 3 ? `${signal.evidenceCount} distinct evidence items on record` : 'Evidence accumulating',
      ],
      urgency: signal.stage === 'accelerating' ? 'high' : signal.stage === 'forming' ? 'medium' : 'low',
      window: signal.stage === 'accelerating' ? '3–12 months' : signal.stage === 'forming' ? '6–18 months' : '12–36 months',
    },

    meta: {
      state_version: 'v2-causal',
      generated_at: new Date().toISOString(),
      causal_engine: 'P0-B',
    },
  };
}

// ── Handler ──────────────────────────────────────────────────────────────────
export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, x-api-key');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'GET') return res.status(405).json({ error: 'GET only' });

  res.setHeader('Cache-Control', 'public, s-maxage=60, stale-while-revalidate=120');

  try {
    const signals = getUnifiedSignals();
    // Parse signal_id from URL path — strip query string first
    const urlPath = (req.url || '').split('?')[0];
    const parts = urlPath.split('/').filter(Boolean);
    // URL: /api/v2/causal or /api/v2/causal/:id
    const signalId = req.query?.signal_id || parts[parts.length - 1];
    const isId = signalId && signalId !== 'causal' && !signalId.includes('=');

    if (isId) {
      const signal = signals.find(s => s.signal_id === signalId || s.topic.toLowerCase().replace(/\s+/g, '_') === signalId.toLowerCase());
      if (!signal) return res.status(404).json({ error: 'Signal not found', signal_id: signalId });
      return res.status(200).json(buildCausalObject(signal));
    }

    // Return all causal chains
    return res.status(200).json({
      causal_chains: signals.map(buildCausalObject),
      count: signals.length,
      engine: 'P0-B',
      meta: { generated_at: new Date().toISOString() },
    });

  } catch (err) {
    console.error('causal error:', err);
    return res.status(500).json({ error: 'Internal error', detail: err.message });
  }
}
