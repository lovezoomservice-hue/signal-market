/**
 * Signal Feed Ranking Engine
 * 
 * Ranking Formula:
 * feed_score = 0.30 impact + 0.25 confidence + 0.20 velocity + 0.15 recency + 0.10 stability
 */

class SignalRankingEngine {
  constructor() {
    this.decayConstant = 48 * 60 * 60 * 1000; // 48 hours in ms
    this.maxSignals = 50;
    this.diversityLimit = 5;
    
    this.categories = ['AI', 'Crypto', 'Robotics', 'Biotech', 'Climate', 'Hardware', 'Startup'];
  }

  // Calculate recency score (exponential decay)
  calculateRecency(updatedAt) {
    if (!updatedAt) return 0;
    const timeSinceUpdate = Date.now() - new Date(updatedAt).getTime();
    return Math.exp(-timeSinceUpdate / this.decayConstant);
  }

  // Calculate velocity (7d vs 30d evidence ratio)
  calculateVelocity(evidence7d, evidence30d) {
    if (!evidence30d || evidence30d === 0) return 1;
    return evidence7d / evidence30d;
  }

  // Get velocity state
  getVelocityState(velocity) {
    if (velocity > 1.2) return 'accelerating';
    if (velocity < 0.8) return 'declining';
    return 'stable';
  }

  // Calculate stability (evidence days / 30)
  calculateStability(evidenceDays) {
    if (!evidenceDays) return 0;
    return Math.min(evidenceDays, 30) / 30;
  }

  // Categorize topic
  categorizeTopic(topic) {
    if (!topic) return 'AI';
    const t = topic.toLowerCase();
    
    if (t.includes('crypto') || t.includes('bitcoin') || t.includes('eth')) return 'Crypto';
    if (t.includes('robot') || t.includes('drone')) return 'Robotics';
    if (t.includes('bio') || t.includes('gene') || t.includes('drug')) return 'Biotech';
    if (t.includes('climate') || t.includes('carbon') || t.includes('energy')) return 'Climate';
    if (t.includes('chip') || t.includes('gpu') || t.includes('hardware')) return 'Hardware';
    if (t.includes('startup') || t.includes('funding') || t.includes('vc')) return 'Startup';
    return 'AI';
  }

  // Calculate feed score for a signal
  calculateFeedScore(signal) {
    const impact = signal.impact_score || signal.impact || 0.5;
    const confidence = signal.confidence || 0.5;
    
    // Velocity from evidence counts
    const evidence7d = signal.evidence_7d || signal.evidenceCount || 1;
    const evidence30d = signal.evidence_30d || signal.evidenceCount * 3 || 3;
    const velocity = this.calculateVelocity(evidence7d, evidence30d);
    
    // Recency
    const recency = this.calculateRecency(signal.updated_at || signal.updatedAt);
    
    // Stability
    const stability = this.calculateStability(signal.evidence_days || 30);
    
    // Weighted score
    const feedScore = 
      0.30 * impact +
      0.25 * confidence +
      0.20 * velocity +
      0.15 * recency +
      0.10 * stability;
    
    return {
      feed_score: feedScore,
      velocity: velocity,
      velocity_state: this.getVelocityState(velocity),
      recency: recency,
      stability: stability
    };
  }

  // Apply diversity filter
  applyDiversityFilter(signals) {
    const categoryCount = {};
    const filtered = [];
    
    for (const signal of signals) {
      const category = this.categorizeTopic(signal.topic);
      categoryCount[category] = (categoryCount[category] || 0) + 1;
      
      if (categoryCount[category] <= this.diversityLimit) {
        filtered.push(signal);
      }
    }
    
    return filtered;
  }

  // Main ranking function
  rankSignals(signals) {
    // Calculate scores
    const scored = signals.map(signal => {
      const scores = this.calculateFeedScore(signal);
      return {
        ...signal,
        feed_score: scores.feed_score,
        velocity: scores.velocity,
        velocity_state: scores.velocity_state,
        recency: scores.recency,
        stability: scores.stability,
        category: this.categorizeTopic(signal.topic)
      };
    });
    
    // Sort by feed score (descending)
    scored.sort((a, b) => b.feed_score - a.feed_score);
    
    // Apply diversity filter
    const ranked = this.applyDiversityFilter(scored);
    
    // Limit to max signals
    return ranked.slice(0, this.maxSignals);
  }
}

module.exports = { SignalRankingEngine };

  // Anti-Hype: Penalize high-buzz low-activity signals
  calculateAntiHypeScore(baseScore, signal) {
    const developerActivity = (signal.developer_contributions || signal.forks || 0) / 100;
    const evidenceStrength = Math.min(1, (signal.evidence_count || 1) / 50);
    
    // If high buzz (mentions) but low dev activity = likely hype
    const buzzFactor = signal.mentions ? signal.mentions / 1000 : 0.5;
    const penaltyFactor = 1 - Math.min(0.4, (1 - developerActivity) * (1 - evidenceStrength) * buzzFactor * 0.5);
    
    return baseScore * penaltyFactor;
  }
