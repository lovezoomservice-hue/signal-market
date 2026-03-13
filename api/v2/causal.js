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

    // ── Action Layer ────────────────────────────────────────────────────────
    // Merged from ACTION_LAYER knowledge base — completes signal into actionable intelligence
    ...(ACTION_LAYER[signal.topic] || {
      monitoring_points: [`Monitor ${signal.topic} velocity over next 30 days`],
      invalidation_conditions: [`${signal.topic} confidence drops below 0.5 for 2 consecutive weeks`],
      agent_action: `Track ${signal.topic} signals weekly. Escalate if stage changes.`,
      urgency: signal.stage === 'accelerating' ? 'high' : 'medium',
      window: signal.stage === 'accelerating' ? '3–12 months' : '6–18 months',
      next_best_action: `Set a weekly monitoring cadence for ${signal.topic}.`,
      decision_question: `What will determine the trajectory of ${signal.topic} in the next 12 months?`,
      escalation_condition: `${signal.topic} reaches mainstream enterprise adoption`,
      downgrade_condition: `${signal.topic} momentum stalls for 3+ consecutive months`,
      reversal_condition: `Fundamental technological or regulatory shift invalidates the core ${signal.topic} thesis`,
      professional_judgment: {
        summary: `Professional coverage of ${signal.topic} is emerging across analyst and VC channels.`,
        key_voices: ['MIT Technology Review'],
        consensus: 'neutral',
      },
    }),

    meta: {
      state_version: 'v2-causal',
      generated_at: new Date().toISOString(),
      causal_engine: 'P0-B',
      action_layer: 'v1',
    },
  };
}

// ── Action Layer — derived from brief.js CAUSAL_CONTEXT ─────────────────────
// These fields complete the signal from "what is happening" to "what to do next"
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
};

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
