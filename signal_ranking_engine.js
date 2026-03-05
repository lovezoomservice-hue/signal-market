/**
 * Signal Feed Ranking Engine
 * 
 * Ranking Formula:
 * feed_score = 0.30 impact + 0.25 confidence + 0.20 velocity + 0.15 recency + 0.10 stability
 */

class SignalRankingEngine {
  constructor() {
    this.decayConstant = 48 * 60 * 60 * 1000;
    this.maxSignals = 50;
    this.diversityLimit = 5;
    this.categories = ['AI', 'Crypto', 'Robotics', 'Biotech', 'Climate', 'Hardware', 'Startup'];
  }

  calculateRecency(updatedAt) {
    if (!updatedAt) return 0;
    const timeSinceUpdate = Date.now() - new Date(updatedAt).getTime();
    return Math.exp(-timeSinceUpdate / this.decayConstant);
  }

  calculateVelocity(evidence7d, evidence30d) {
    if (!evidence30d || evidence30d === 0) return 1;
    return evidence7d / evidence30d;
  }

  getVelocityState(velocity) {
    if (velocity > 1.5) return 'accelerating';
    if (velocity > 1.0) return 'growing';
    if (velocity > 0.5) return 'stable';
    return 'declining';
  }

  applyDiversityFilter(signals) {
    const categorized = {};
    const result = [];
    
    for (const signal of signals) {
      const category = signal.category || 'Other';
      if (!categorized[category]) categorized[category] = 0;
      if (categorized[category] < this.diversityLimit) {
        result.push(signal);
        categorized[category]++;
      }
    }
    return result;
  }

  rankSignals(signals) {
    const scored = signals.map(s => {
      const impact = s.impact_score || 0.5;
      const confidence = s.confidence || 0.5;
      const velocity = this.calculateVelocity(s.evidence_7d, s.evidence_30d);
      const recency = this.calculateRecency(s.updated_at);
      const stability = 0.5;
      
      const feed_score = 0.30 * impact + 0.25 * confidence + 0.20 * velocity + 0.15 * recency + 0.10 * stability;
      
      return {
        ...s,
        feed_score,
        velocity,
        velocity_state: this.getVelocityState(velocity)
      };
    });
    
    scored.sort((a, b) => b.feed_score - a.feed_score);
    return scored.slice(0, this.maxSignals);
  }
}

module.exports = { SignalRankingEngine };
