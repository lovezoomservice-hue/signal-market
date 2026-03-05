/**
 * L4 Performance & Monitoring Middleware
 * 
 * 1. Caching Layer - 减少重复计算
 * 2. Performance Metrics - API响应时间、请求计数
 * 3. Error Tracking - 错误日志和统计
 * 4. Alert Rules - 异常检测和告警
 */

const fs = require('fs');
const path = require('path');
const { performance } = require('perf_hooks');

// ====== Configuration ======
const MONITORING_CONFIG = {
  cache: {
    enabled: true,
    ttl: 60 * 1000, // 1 minute default
    maxSize: 100,    // Max cached items
    routes: {
      '/events': 60 * 1000,          // Cache for 1 minute
      '/signals/health': 10 * 1000,   // Cache for 10 seconds
      '/predictions': 30 * 1000,      // Cache for 30 seconds
      '/evidence': 5 * 60 * 1000       // Cache for 5 minutes
    }
  },
  metrics: {
    enabled: true,
    retentionMs: 5 * 60 * 1000, // Keep metrics for 5 minutes
    slowRequestThreshold: 3000  // 3 seconds = slow request
  },
  alerts: {
    enabled: true,
    errorRateThreshold: 0.1,     // 10% error rate = alert
    latencyThreshold: 5000,      // 5 second latency = alert
    consecutiveErrors: 5        // 5 consecutive errors = alert
  }
};

// ====== In-Memory Cache ======
class ApiCache {
  constructor() {
    this.cache = new Map();
    this.hits = 0;
    this.misses = 0;
    
    // Cleanup expired entries every 30 seconds
    setInterval(() => this.cleanup(), 30 * 1000);
  }
  
  generateKey(req) {
    return `${req.method}:${req.url}`;
  }
  
  get(req) {
    if (!MONITORING_CONFIG.cache.enabled) return null;
    
    const key = this.generateKey(req);
    const entry = this.cache.get(key);
    
    if (!entry) {
      this.misses++;
      return null;
    }
    
    // Check expiration
    if (Date.now() > entry.expiresAt) {
      this.cache.delete(key);
      this.misses++;
      return null;
    }
    
    this.hits++;
    return entry.data;
  }
  
  set(req, data, customTtl) {
    if (!MONITORING_CONFIG.cache.enabled) return;
    
    const key = this.generateKey(req);
    const ttl = customTtl || MONITORING_CONFIG.cache.ttl;
    
    // Check cache size limit
    if (this.cache.size >= MONITORING_CONFIG.cache.maxSize) {
      // Remove oldest entry
      const firstKey = this.cache.keys().next().value;
      this.cache.delete(firstKey);
    }
    
    this.cache.set(key, {
      data,
      expiresAt: Date.now() + ttl,
      createdAt: Date.now()
    });
  }
  
  invalidate(pattern) {
    for (const key of this.cache.keys()) {
      if (key.includes(pattern)) {
        this.cache.delete(key);
      }
    }
  }
  
  cleanup() {
    const now = Date.now();
    for (const [key, entry] of this.cache) {
      if (now > entry.expiresAt) {
        this.cache.delete(key);
      }
    }
  }
  
  getStats() {
    const total = this.hits + this.misses;
    return {
      size: this.cache.size,
      hits: this.hits,
      misses: this.misses,
      hitRate: total > 0 ? (this.hits / total * 100).toFixed(2) + '%' : '0%'
    };
  }
}

// ====== Metrics Collector ======
class MetricsCollector {
  constructor() {
    this.requests = [];
    this.errors = [];
    this.startTime = Date.now();
    
    // Cleanup old metrics periodically
    setInterval(() => this.cleanup(), MONITORING_CONFIG.metrics.retentionMs);
  }
  
  recordRequest(req, res, duration, isError = false) {
    if (!MONITORING_CONFIG.metrics.enabled) return;
    
    const metric = {
      timestamp: Date.now(),
      method: req.method,
      url: req.url,
      statusCode: res.statusCode,
      duration,
      ip: req.headers['x-forwarded-for']?.split(',')[0]?.trim() || req.socket?.remoteAddress,
      isError,
      userAgent: req.headers['user-agent']
    };
    
    this.requests.push(metric);
    
    // Track errors separately
    if (isError || res.statusCode >= 400) {
      this.errors.push(metric);
    }
    
    // Log slow requests
    if (duration > MONITORING_CONFIG.metrics.slowRequestThreshold) {
      console.log(`🐢 Slow Request: ${req.method} ${req.url} took ${duration}ms`);
    }
  }
  
  cleanup() {
    const cutoff = Date.now() - MONITORING_CONFIG.metrics.retentionMs;
    this.requests = this.requests.filter(r => r.timestamp > cutoff);
    this.errors = this.errors.filter(e => e.timestamp > cutoff);
  }
  
  getStats() {
    const now = Date.now();
    const recent = this.requests.filter(r => now - r.timestamp < MONITORING_CONFIG.metrics.retentionMs);
    const recentErrors = this.errors.filter(e => now - e.timestamp < MONITORING_CONFIG.metrics.retentionMs);
    
    if (recent.length === 0) {
      return {
        totalRequests: 0,
        errorRate: 0,
        avgResponseTime: 0,
        p95ResponseTime: 0,
        requestsPerMinute: 0
      };
    }
    
    // Calculate statistics
    const durations = recent.map(r => r.duration).sort((a, b) => a - b);
    const p95Index = Math.floor(durations.length * 0.95);
    
    // Calculate requests per minute
    const oneMinAgo = now - 60000;
    const recent1min = recent.filter(r => r.timestamp > oneMinAgo);
    
    return {
      totalRequests: recent.length,
      errorCount: recentErrors.length,
      errorRate: (recentErrors.length / recent.length * 100).toFixed(2) + '%',
      avgResponseTime: (durations.reduce((a, b) => a + b, 0) / durations.length).toFixed(0) + 'ms',
      p95ResponseTime: durations[p95Index] || 0,
      p99ResponseTime: durations[Math.floor(durations.length * 0.99)] || 0,
      minResponseTime: durations[0] || 0,
      maxResponseTime: durations[durations.length - 1] || 0,
      requestsPerMinute: recent1min.length,
      uptime: Math.floor((now - this.startTime) / 1000) + 's',
      statusCodes: this.getStatusCodeDistribution(recent)
    };
  }
  
  getStatusCodeDistribution(requests) {
    const distribution = {};
    for (const req of requests) {
      const code = String(req.statusCode);
      distribution[code] = (distribution[code] || 0) + 1;
    }
    return distribution;
  }
}

// ====== Alert System ======
class AlertSystem {
  constructor() {
    this.alerts = [];
    this.consecutiveErrors = 0;
    this.lastAlertTime = 0;
  }
  
  check(metrics, cache) {
    if (!MONITORING_CONFIG.alerts.enabled) return;
    
    const now = Date.now();
    const alerts = [];
    
    // Check error rate
    const errorRate = metrics.errorCount / metrics.totalRequests;
    if (metrics.totalRequests > 0 && errorRate > MONITORING_CONFIG.alerts.errorRateThreshold) {
      alerts.push({
        type: 'HIGH_ERROR_RATE',
        severity: 'warning',
        message: `Error rate is ${(errorRate * 100).toFixed(1)}% (threshold: ${MONITORING_CONFIG.alerts.errorRateThreshold * 100}%)`,
        timestamp: now
      });
    }
    
    // Check latency
    const avgLatency = parseInt(metrics.avgResponseTime);
    if (avgLatency > MONITORING_CONFIG.alerts.latencyThreshold) {
      alerts.push({
        type: 'HIGH_LATENCY',
        severity: 'warning',
        message: `Average response time is ${avgLatency}ms (threshold: ${MONITORING_CONFIG.alerts.latencyThreshold}ms)`,
        timestamp: now
      });
    }
    
    // Check consecutive errors
    if (metrics.errorCount > 0) {
      this.consecutiveErrors += metrics.errorCount;
    } else {
      this.consecutiveErrors = 0;
    }
    
    if (this.consecutiveErrors >= MONITORING_CONFIG.alerts.consecutiveErrors) {
      alerts.push({
        type: 'CONSECUTIVE_ERRORS',
        severity: 'critical',
        message: `${this.consecutiveErrors} consecutive errors detected`,
        timestamp: now
      });
    }
    
    // Check cache hit rate
    const cacheStats = cache.getStats();
    const hitRate = parseFloat(cacheStats.hitRate);
    if (hitRate < 50 && cacheStats.hits + cacheStats.misses > 100) {
      alerts.push({
        type: 'LOW_CACHE_HIT_RATE',
        severity: 'info',
        message: `Cache hit rate is ${hitRate}% (may need tuning)`,
        timestamp: now
      });
    }
    
    // Store alerts (limit to last 100)
    this.alerts = [...alerts, ...this.alerts].slice(0, 100);
    
    // Send alerts (in production, this would send to PagerDuty, Slack, etc.)
    for (const alert of alerts) {
      if (now - this.lastAlertTime > 60000) { // At most 1 alert per minute
        this.sendAlert(alert);
        this.lastAlertTime = now;
      }
    }
  }
  
  sendAlert(alert) {
    // Console output for now - in production, integrate with notification services
    console.log(`🚨 ALERT [${alert.severity.toUpperCase()}]: ${alert.type} - ${alert.message}`);
    
    // Could integrate with:
    // - console.error for logging
    // - fs.appendFile for file logging
    // - HTTP webhook to Slack/PagerDuty
    // - Email notifications
  }
  
  getAlerts() {
    return this.alerts.slice(0, 50);
  }
}

// ====== Initialize Modules ======
const apiCache = new ApiCache();
const metricsCollector = new MetricsCollector();
const alertSystem = new AlertSystem();

// ====== Monitoring Middleware ======
function monitoringMiddleware(req, res) {
  const startTime = performance.now();
  
  // Wrap res.end to capture response
  const originalEnd = res.end;
  res.end = function(...args) {
    const duration = Math.round(performance.now() - startTime);
    
    // Record metrics
    const isError = res.statusCode >= 400 || res.statusCode >= 500;
    metricsCollector.recordRequest(req, res, duration, isError);
    
    // Check alerts periodically (every 10 requests)
    if (metricsCollector.requests.length % 10 === 0) {
      const stats = metricsCollector.getStats();
      alertSystem.check(stats, apiCache);
    }
    
    return originalEnd.apply(this, args);
  };
}

// ====== Cache Middleware ======
function cacheMiddleware(req, res) {
  // Only cache GET requests
  if (req.method !== 'GET') {
    return false;
  }
  
  // Check route-specific cache TTL
  let customTtl = null;
  for (const [route, ttl] of Object.entries(MONITORING_CONFIG.cache.routes)) {
    if (req.url.startsWith(route)) {
      customTtl = ttl;
      break;
    }
  }
  
  // Try to get from cache
  const cached = apiCache.get(req);
  if (cached) {
    res.setHeader('X-Cache', 'HIT');
    res.setHeader('Content-Type', 'application/json');
    res.statusCode = 200;
    res.end(JSON.stringify(cached));
    return true; // Cache hit
  }
  
  // Cache miss - will be set by response handler
  res.setHeader('X-Cache', 'MISS');
  
  // Override res.end to cache successful responses
  const originalEnd = res.end;
  res.end = function(...args) {
    if (res.statusCode === 200) {
      try {
        // Try to parse and cache the response
        const body = args[0];
        if (body) {
          const parsed = typeof body === 'string' ? JSON.parse(body) : body;
          apiCache.set(req, parsed, customTtl);
        }
      } catch (e) {
        // Non-JSON response, don't cache
      }
    }
    return originalEnd.apply(this, args);
  };
  
  return false;
}

// ====== Metrics Endpoints ======
function handleGetMetrics(req, res) {
  const stats = metricsCollector.getStats();
  const cacheStats = apiCache.getStats();
  const alerts = alertSystem.getAlerts();
  
  res.setHeader('Content-Type', 'application/json');
  res.end(JSON.stringify({
    metrics: stats,
    cache: cacheStats,
    alerts: alerts,
    timestamp: new Date().toISOString()
  }));
}

function handleGetCacheStats(req, res) {
  const stats = apiCache.getStats();
  
  res.setHeader('Content-Type', 'application/json');
  res.end(JSON.stringify({
    cache: stats,
    config: {
      enabled: MONITORING_CONFIG.cache.enabled,
      maxSize: MONITORING_CONFIG.cache.maxSize,
      routes: Object.keys(MONITORING_CONFIG.cache.routes)
    },
    timestamp: new Date().toISOString()
  }));
}

// ====== Health Check with Metrics ======
function getEnhancedHealth() {
  const stats = metricsCollector.getStats();
  const cacheStats = apiCache.getStats();
  
  return {
    status: stats.errorRate > '10%' ? 'degraded' : 'healthy',
    timestamp: new Date().toISOString(),
    metrics: {
      totalRequests: stats.totalRequests,
      errorRate: stats.errorRate,
      avgResponseTime: stats.avgResponseTime,
      uptime: stats.uptime
    },
    cache: {
      hitRate: cacheStats.hitRate,
      size: cacheStats.size
    }
  };
}

// ====== Error Tracking ======
function errorTracker(err, req, res) {
  const errorEvent = {
    timestamp: Date.now(),
    error: {
      message: err.message,
      stack: err.stack
    },
    request: {
      method: req.method,
      url: req.url,
      headers: req.headers,
      ip: req.headers['x-forwarded-for']?.split(',')[0]?.trim() || req.socket?.remoteAddress
    }
  };
  
  // Log to console
  console.error('❌ Error tracked:', JSON.stringify(errorEvent, null, 2));
  
  // In production, could send to:
  // - Sentry
  // - DataDog
  // - Custom error aggregation service
  
  metricsCollector.errors.push({
    ...errorEvent,
    duration: 0,
    statusCode: 500
  });
}

module.exports = {
  monitoringMiddleware,
  cacheMiddleware,
  handleGetMetrics,
  handleGetCacheStats,
  getEnhancedHealth,
  errorTracker,
  alertSystem,
  metricsCollector,
  apiCache,
  MONITORING_CONFIG
};
