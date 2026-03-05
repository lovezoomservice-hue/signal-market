/**
 * Weak Signal Discovery Engine
 * 
 * Weak Signal Score:
 * weak_signal_score = 0.40 novelty + 0.25 expert_source + 0.20 cross_domain + 0.15 early_adopter
 */

class WeakSignalDiscoveryEngine {
  constructor() {
    this.maxSignals = 30;
    this.refreshInterval = 30 * 60 * 1000; // 30 minutes
    
    // Expert sources with higher trust scores
    this.expertSources = ['arxiv', 'github', 'techcrunch', 'mit'];
    this.communitySources = ['hackernews', 'reddit', 'lobsters'];
  }

  // Calculate novelty (inverse frequency)
  calculateNovelty(topic, existingTopics) {
    const frequency = existingTopics.filter(t => 
      t.toLowerCase() === topic.toLowerCase()
    ).length;
    return frequency === 0 ? 1.0 : 1 / (frequency + 1);
  }

  // Calculate expert source weight
  calculateExpertSourceWeight(sources) {
    if (!sources || sources.length === 0) return 0;
    
    const expertCount = sources.filter(s => 
      this.expertSources.includes(s.toLowerCase())
    ).length;
    
    return expertCount / sources.length;
  }

  // Calculate cross-domain presence
  calculateCrossDomain(sources) {
    if (!sources || sources.length === 0) return 0;
    
    // Count unique domains
    const domains = new Set(sources.map(s => {
      if (s.includes('github')) return 'code';
      if (s.includes('arxiv') || s.includes('paper')) return 'research';
      if (s.includes('news') || s.includes('tech')) return 'media';
      if (s.includes('reddit') || s.includes('hn')) return 'community';
      return 'other';
    }));
    
    return Math.min(domains.size / 4, 1.0); // Normalize to 0-1
  }

  // Calculate early adopter activity
  calculateEarlyAdopterActivity(activityMetrics) {
    if (!activityMetrics) return 0.5;
    
    // Factors: new contributors, recent commits, early adoption indicators
    const newContributors = activityMetrics.new_contributors || 0;
    const recentGrowth = activityMetrics.recent_growth || 0;
    const earlySignals = activityMetrics.early_signals || 0;
    
    return Math.min(
      (newContributors * 0.4 + recentGrowth * 0.4 + earlySignals * 0.2) / 100,
      1.0
    );
  }

  // Calculate velocity (growth trend)
  calculateVelocity(signals7d, signals30d) {
    if (!signals30d || signals30d === 0) return 1;
    return signals7d / signals30d;
  }

  // Get velocity state
  getVelocityState(velocity) {
    if (velocity > 1.5) return 'early_growth';
    if (velocity > 1.0) return 'stable';
    return 'new';
  }

  // Main scoring function
  calculateWeakSignalScore(signal, existingTopics = []) {
    const novelty = this.calculateNovelty(signal.topic, existingTopics);
    const expertSource = this.calculateExpertSourceWeight(signal.sources);
    const crossDomain = this.calculateCrossDomain(signal.sources);
    const earlyAdopter = this.calculateEarlyAdopterActivity(signal.activity);
    
    // Velocity calculation
    const velocity = this.calculateVelocity(
      signal.signals_7d || 1,
      signal.signals_30d || 10
    );
    
    const weakScore = 
      0.40 * novelty +
      0.25 * expertSource +
      0.20 * crossDomain +
      0.15 * earlyAdopter;
    
    return {
      weak_signal_score: weakScore,
      novelty: novelty,
      expert_source_weight: expertSource,
      cross_domain_score: crossDomain,
      early_adopter_score: earlyAdopter,
      velocity: velocity,
      velocity_state: this.getVelocityState(velocity),
      source_count: signal.sources?.length || 1
    };
  }

  // Discover weak signals from raw data
  discoverWeakSignals(rawSignals) {
    // Get existing topics for novelty calculation
    const existingTopics = rawSignals.map(s => s.topic);
    
    // Score each potential weak signal
    const scored = rawSignals.map(signal => {
      const scores = this.calculateWeakSignalScore(signal, existingTopics);
      
      return {
        topic: signal.topic,
        stage: 'weak',
        confidence: scores.weak_signal_score,
        weak_signal_score: scores.weak_signal_score,
        novelty: scores.novelty,
        velocity: scores.velocity,
        velocity_state: scores.velocity_state,
        source_count: scores.source_count,
        sources: signal.sources || ['system'],
        evidence_count: signal.evidence_count || 1,
        updated_at: signal.updated_at || new Date().toISOString()
      };
    });
    
    // Sort by weak signal score
    scored.sort((a, b) => b.weak_signal_score - a.weak_signal_score);
    
    // Return top 30
    return scored.slice(0, this.maxSignals);
  }
}

module.exports = { WeakSignalDiscoveryEngine };
