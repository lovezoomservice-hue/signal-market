/**
 * L4 Security Middleware
 * 
 * 1. Rate Limiting - 防止API滥用
 * 2. Input Validation - 验证和清理用户输入
 * 3. Security Headers - Helmet-like安全头
 * 4. XSS/CSRF Protection - 防止注入攻击
 */

const crypto = require('crypto');
const fs = require('fs');
const path = require('path');

// ====== Configuration ======
const SECURITY_CONFIG = {
  rateLimit: {
    windowMs: 60 * 1000, // 1 minute
    maxRequests: 100,    // 100 requests per minute per IP
    maxRequestsAuth: 200, // For authenticated users
    blockDuration: 60 * 1000 // Block for 1 minute after limit
  },
  inputValidation: {
    maxBodySize: 1024 * 100, // 100KB
    maxStringLength: 1000,
    allowedContentTypes: ['application/json'],
    sanitizeHtml: true
  },
  cors: {
    allowedOrigins: [
      'http://localhost:3000',
      'http://localhost:5173',
      'https://signal.market',
      'https://www.signal.market'
    ],
    allowedMethods: ['GET', 'POST', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization'],
    credentials: true,
    maxAge: 86400 // 24 hours
  }
};

// ====== Rate Limiting ======
class RateLimiter {
  constructor() {
    this.requests = new Map(); // ip -> [{timestamp, count}]
    this.blocked = new Map();  // ip -> blockedUntil
    
    // Cleanup old entries every 5 minutes
    setInterval(() => this.cleanup(), 5 * 60 * 1000);
  }
  
  cleanup() {
    const now = Date.now();
    for (const [ip, data] of this.requests) {
      data.recent = data.recent.filter(t => now - t < SECURITY_CONFIG.rateLimit.windowMs);
      if (data.recent.length === 0) {
        this.requests.delete(ip);
      }
    }
    // Unblock expired IPs
    for (const [ip, until] of this.blocked) {
      if (now > until) {
        this.blocked.delete(ip);
      }
    }
  }
  
  isBlocked(ip) {
    const until = this.blocked.get(ip);
    return until && Date.now() < until;
  }
  
  block(ip) {
    this.blocked.set(ip, Date.now() + SECURITY_CONFIG.rateLimit.blockDuration);
  }
  
  tryConsume(ip, isAuthenticated = false) {
    if (this.isBlocked(ip)) {
      return { allowed: false, remaining: 0, resetIn: this.blocked.get(ip) - Date.now() };
    }
    
    const now = Date.now();
    const limit = isAuthenticated ? SECURITY_CONFIG.rateLimit.maxRequestsAuth : SECURITY_CONFIG.rateLimit.maxRequests;
    
    let data = this.requests.get(ip);
    if (!data) {
      data = { recent: [] };
      this.requests.set(ip, data);
    }
    
    // Clean old requests
    data.recent = data.recent.filter(t => now - t < SECURITY_CONFIG.rateLimit.windowMs);
    
    // Check limit
    if (data.recent.length >= limit) {
      this.block(ip);
      return { allowed: false, remaining: 0, resetIn: SECURITY_CONFIG.rateLimit.windowMs };
    }
    
    // Consume request
    data.recent.push(now);
    return { allowed: true, remaining: limit - data.recent.length, resetIn: SECURITY_CONFIG.rateLimit.windowMs };
  }
  
  getClientIp(req) {
    return req.headers['x-forwarded-for']?.split(',')[0]?.trim() 
      || req.socket?.remoteAddress 
      || 'unknown';
  }
}

const rateLimiter = new RateLimiter();

// ====== Input Validation ======
function validateInput(input, schema) {
  const errors = [];
  
  for (const [field, rules] of Object.entries(schema)) {
    const value = input[field];
    
    if (rules.required && (value === undefined || value === null || value === '')) {
      errors.push(`Missing required field: ${field}`);
      continue;
    }
    
    if (value !== undefined && value !== null) {
      // Type validation
      if (rules.type === 'string') {
        if (typeof value !== 'string') {
          errors.push(`Field ${field} must be a string`);
        } else if (rules.maxLength && value.length > rules.maxLength) {
          errors.push(`Field ${field} exceeds max length of ${rules.maxLength}`);
        } else if (rules.pattern && !rules.pattern.test(value)) {
          errors.push(`Field ${field} has invalid format`);
        }
      } else if (rules.type === 'number') {
        if (typeof value !== 'number' || isNaN(value)) {
          errors.push(`Field ${field} must be a number`);
        } else if (rules.min !== undefined && value < rules.min) {
          errors.push(`Field ${field} must be >= ${rules.min}`);
        } else if (rules.max !== undefined && value > rules.max) {
          errors.push(`Field ${field} must be <= ${rules.max}`);
        }
      } else if (rules.type === 'array') {
        if (!Array.isArray(value)) {
          errors.push(`Field ${field} must be an array`);
        } else if (rules.maxItems && value.length > rules.maxItems) {
          errors.push(`Field ${field} exceeds max items of ${rules.maxItems}`);
        }
      }
      
      // Enum validation
      if (rules.enum && !rules.enum.includes(value)) {
        errors.push(`Field ${field} must be one of: ${rules.enum.join(', ')}`);
      }
    }
  }
  
  return errors;
}

// Sanitize potentially dangerous characters
function sanitizeString(str) {
  if (typeof str !== 'string') return str;
  
  return str
    .replace(/[<>]/g, '') // Remove < and >
    .replace(/javascript:/gi, '')
    .replace(/on\w+=/gi, '') // Remove event handlers
    .slice(0, SECURITY_CONFIG.inputValidation.maxStringLength);
}

function sanitizeObject(obj) {
  if (obj === null || obj === undefined) return obj;
  if (typeof obj === 'string') return sanitizeString(obj);
  if (Array.isArray(obj)) return obj.map(sanitizeObject);
  if (typeof obj === 'object') {
    const sanitized = {};
    for (const [key, value] of Object.entries(obj)) {
      sanitized[sanitizeString(key)] = sanitizeObject(value);
    }
    return sanitized;
  }
  return obj;
}

// ====== Security Headers ======
function getSecurityHeaders(req) {
  return {
    'X-Content-Type-Options': 'nosniff',
    'X-Frame-Options': 'DENY',
    'X-XSS-Protection': '1; mode=block',
    'Referrer-Policy': 'strict-origin-when-cross-origin',
    'Permissions-Policy': 'geolocation=(), microphone=(), camera=()',
    'Content-Security-Policy': "default-src 'self'; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline'; img-src 'self' data: https:; connect-src 'self' https://api.signal.market",
    'Strict-Transport-Security': 'max-age=31536000; includeSubDomains',
    'Cache-Control': 'no-store, no-cache, must-revalidate, proxy-revalidate',
    'Pragma': 'no-cache'
  };
}

// ====== CORS Headers ======
function getCorsHeaders(req) {
  const origin = req.headers.origin;
  const allowed = SECURITY_CONFIG.cors.allowedOrigins;
  
  // Allow if origin is in allowed list or if it's a same-origin request
  const isAllowed = allowed.includes('*') || allowed.includes(origin) || allowed.some(o => origin?.startsWith(o));
  
  if (!isAllowed || !origin) {
    return {};
  }
  
  return {
    'Access-Control-Allow-Origin': origin,
    'Access-Control-Allow-Methods': SECURITY_CONFIG.cors.allowedMethods.join(', '),
    'Access-Control-Allow-Headers': SECURITY_CONFIG.cors.allowedHeaders.join(', '),
    'Access-Control-Allow-Credentials': String(SECURITY_CONFIG.cors.credentials),
    'Access-Control-Max-Age': String(SECURITY_CONFIG.cors.maxAge)
  };
}

// ====== Request Body Parser ======
function parseBody(req) {
  return new Promise((resolve, reject) => {
    let body = '';
    
    req.on('data', chunk => {
      body += chunk;
      if (body.length > SECURITY_CONFIG.inputValidation.maxBodySize) {
        reject(new Error('Request body too large'));
      }
    });
    
    req.on('end', () => {
      if (!body) {
        resolve({});
        return;
      }
      
      try {
        const parsed = JSON.parse(body);
        resolve(sanitizeObject(parsed));
      } catch (e) {
        reject(new Error('Invalid JSON'));
      }
    });
    
    req.on('error', reject);
  });
}

// ====== Main Security Middleware ======
async function securityMiddleware(req, res) {
  const clientIp = rateLimiter.getClientIp(req);
  const isAuth = !!req.headers.authorization;
  
  // Rate Limiting
  const rateLimitResult = rateLimiter.tryConsume(clientIp, isAuth);
  res.setHeader('X-RateLimit-Limit', isAuth ? SECURITY_CONFIG.rateLimit.maxRequestsAuth : SECURITY_CONFIG.rateLimit.maxRequests);
  res.setHeader('X-RateLimit-Remaining', rateLimitResult.remaining);
  res.setHeader('X-RateLimit-Reset', Math.ceil((Date.now() + rateLimitResult.resetIn) / 1000));
  
  if (!rateLimitResult.allowed) {
    res.statusCode = 429;
    res.setHeader('Content-Type', 'application/json');
    res.setHeader('Retry-After', Math.ceil(rateLimitResult.resetIn / 1000));
    res.end(JSON.stringify({ 
      error: 'Too Many Requests',
      message: 'Rate limit exceeded. Please try again later.',
      retryAfter: Math.ceil(rateLimitResult.resetIn / 1000)
    }));
    return true; // Blocked
  }
  
  // Security Headers
  const securityHeaders = getSecurityHeaders(req);
  for (const [key, value] of Object.entries(securityHeaders)) {
    res.setHeader(key, value);
  }
  
  // CORS Headers
  const corsHeaders = getCorsHeaders(req);
  for (const [key, value] of Object.entries(corsHeaders)) {
    res.setHeader(key, value);
  }
  
  // Handle preflight
  if (req.method === 'OPTIONS') {
    res.statusCode = 204;
    res.end();
    return true;
  }
  
  // Validate Content-Type for POST/PUT
  if (['POST', 'PUT', 'PATCH'].includes(req.method)) {
    const contentType = req.headers['content-type'];
    if (!contentType || !SECURITY_CONFIG.inputValidation.allowedContentTypes.some(ct => contentType.includes(ct))) {
      res.statusCode = 415;
      res.setHeader('Content-Type', 'application/json');
      res.end(JSON.stringify({ error: 'Unsupported Media Type' }));
      return true;
    }
  }
  
  return false; // Not blocked
}

// ====== Validation Schemas ======
const VALIDATION_SCHEMAS = {
  '/watch': {
    fields: {
      event_id: { type: 'string', maxLength: 100, pattern: /^[a-zA-Z0-9_-]+$/ },
      notify_on: { type: 'array', maxItems: 10 },
      user_id: { type: 'string', maxLength: 50 }
    }
  },
  '/signals/health': {
    fields: {}
  }
};

function validateRoute(route, data) {
  const schema = VALIDATION_SCHEMAS[route];
  if (!schema) return [];
  return validateInput(data, schema.fields);
}

// ====== Error Handler ======
function securityErrorHandler(err, req, res) {
  console.error('🔒 Security Error:', err.message);
  
  // Don't leak error details
  const statusCode = err.message.includes('too large') ? 413 
    : err.message.includes('JSON') ? 400
    : 500;
  
  res.statusCode = statusCode;
  res.setHeader('Content-Type', 'application/json');
  res.end(JSON.stringify({ 
    error: statusCode === 500 ? 'Internal Server Error' : err.message 
  }));
}

module.exports = {
  securityMiddleware,
  validateRoute,
  securityErrorHandler,
  rateLimiter,
  sanitizeString,
  sanitizeObject,
  getSecurityHeaders,
  getCorsHeaders,
  parseBody,
  SECURITY_CONFIG
};
