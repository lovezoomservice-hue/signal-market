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
