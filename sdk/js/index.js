/**
 * Signal Market JavaScript SDK
 * 
 * Usage:
 *   const { SignalMarket } = require('signal-market');
 *   
 *   const client = new SignalMarket({ apiKey: 'your-key' });
 *   
 *   // Get events
 *   const events = await client.getEvents();
 *   
 *   // Get daily brief
 *   const brief = await client.getLensBrief('lens_a_stock');
 *   
 *   // Health check
 *   const health = await client.healthCheck();
 */

class SignalMarket {
  constructor(options = {}) {
    this.apiKey = options.apiKey || '';
    this.baseUrl = options.baseUrl || 'http://localhost:3000';
  }
  
  _headers() {
    const headers = { 'Content-Type': 'application/json' };
    if (this.apiKey) {
      headers['Authorization'] = `Bearer ${this.apiKey}`;
    }
    return headers;
  }
  
  async _request(method, path, body = null) {
    const url = `${this.baseUrl}${path}`;
    const options = {
      method,
      headers: this._headers()
    };
    
    if (body) {
      options.body = JSON.stringify(body);
    }
    
    const res = await fetch(url, options);
    if (!res.ok) {
      throw new Error(`API error: ${res.status} ${res.statusText}`);
    }
    
    return res.json();
  }
  
  // Get all active events
  async getEvents() {
    return this._request('GET', '/events');
  }
  
  // Get probability curve for an event
  async getEventProbability(eventId) {
    return this._request('GET', `/events/${eventId}/probability`);
  }
  
  // Get daily brief for a user lens
  async getLensBrief(userId) {
    return this._request('GET', `/lenses/${userId}/daily-brief`);
  }
  
  // Create a new watch
  async createWatch(config) {
    return this._request('POST', '/watch', config);
  }
  
  // Check system health
  async healthCheck() {
    return this._request('GET', '/signals/health');
  }
  
  // Get evidence for an event
  async getEvidence(eventId) {
    return this._request('GET', `/evidence/${eventId}`);
  }
}

module.exports = { SignalMarket };

// CLI usage
if (require.main === module) {
  const client = new SignalMarket();
  
  console.log('=== Health Check ===');
  client.healthCheck().then(console.log).catch(console.error);
}
