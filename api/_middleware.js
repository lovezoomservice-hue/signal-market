/**
 * API Rate Limiting Middleware (Vercel Edge)
 * Simple in-memory rate limit: 60 req/min per IP
 * Note: resets on cold start — use Redis for production
 */

const WINDOW_MS = 60_000;  // 1 minute
const MAX_REQ   = 60;      // requests per window

const store = new Map();   // ip → { count, resetAt }

function getIP(req) {
  return req.headers['x-forwarded-for']?.split(',')[0].trim()
    || req.socket?.remoteAddress
    || 'unknown';
}

export default function middleware(req, res, next) {
  // Skip rate limit for OPTIONS and /api/health
  if (req.method === 'OPTIONS' || req.url?.includes('/health')) {
    return next();
  }

  const ip = getIP(req);
  const now = Date.now();
  let entry = store.get(ip);

  if (!entry || now > entry.resetAt) {
    entry = { count: 0, resetAt: now + WINDOW_MS };
    store.set(ip, entry);
  }

  entry.count++;
  res.setHeader('X-RateLimit-Limit',     String(MAX_REQ));
  res.setHeader('X-RateLimit-Remaining', String(Math.max(0, MAX_REQ - entry.count)));
  res.setHeader('X-RateLimit-Reset',     String(Math.ceil(entry.resetAt / 1000)));

  if (entry.count > MAX_REQ) {
    return res.status(429).json({
      error: 'Too Many Requests',
      message: `Rate limit: ${MAX_REQ} requests per minute`,
      retry_after: Math.ceil((entry.resetAt - now) / 1000),
    });
  }

  return next();
}

export const config = { matcher: '/api/:path*' };
