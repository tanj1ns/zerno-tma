'use strict';

const { URL } = require('node:url');

function getClientIp(req) {
  const fwd = req.headers['x-forwarded-for'];
  if (typeof fwd === 'string' && fwd.trim()) {
    return fwd.split(',')[0].trim().slice(0, 64);
  }
  return String(req.socket?.remoteAddress || 'unknown').slice(0, 64);
}

function createRateLimiter({ windowMs, max, maxKeys = 5000 }) {
  const hits = new Map();

  function pruneExpired(now) {
    for (const [k, entry] of hits.entries()) {
      if (entry.resetAt <= now) hits.delete(k);
    }
    while (hits.size >= maxKeys) {
      const oldestKey = hits.keys().next().value;
      if (oldestKey === undefined) break;
      hits.delete(oldestKey);
    }
  }

  return function check(req) {
    const now = Date.now();
    const key = getClientIp(req);
    let entry = hits.get(key);

    if (!entry || entry.resetAt <= now) {
      if (hits.size >= maxKeys) pruneExpired(now);
      entry = { count: 1, resetAt: now + windowMs };
      hits.set(key, entry);
      return { allowed: true, retryAfterSec: 0 };
    }

    if (entry.count >= max) {
      const retryAfterSec = Math.max(1, Math.ceil((entry.resetAt - now) / 1000));
      return { allowed: false, retryAfterSec };
    }

    entry.count += 1;
    return { allowed: true, retryAfterSec: 0 };
  };
}

const apiLimiter = createRateLimiter({ windowMs: 60_000, max: 140 });
const loginLimiter = createRateLimiter({ windowMs: 600_000, max: 5 });
const orderLimiter = createRateLimiter({ windowMs: 900_000, max: 12 });

function applySecurityHeaders(res) {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'DENY');
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
  res.setHeader('Permissions-Policy', 'camera=(), microphone=(), geolocation=()');
  res.setHeader('Cross-Origin-Opener-Policy', 'same-origin');
  res.setHeader(
    'Content-Security-Policy',
    "default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; font-src 'self' https://fonts.gstatic.com data:; img-src 'self' data: blob: https:; connect-src 'self'; object-src 'none'; base-uri 'self'; form-action 'self'; frame-ancestors 'none'"
  );
}

function verifySameOrigin(req) {
  const method = String(req.method || 'GET').toUpperCase();
  if (!['POST', 'PUT', 'PATCH', 'DELETE'].includes(method)) return true;

  const origin = req.headers.origin;
  if (!origin) return true;
  const host = req.headers.host;
  if (!host) return false;

  try {
    return new URL(origin).host === host;
  } catch {
    return false;
  }
}

function hardenHttpServer(server) {
  server.requestTimeout = 15000;
  server.headersTimeout = 10000;
  server.keepAliveTimeout = 5000;
  server.maxRequestsPerSocket = 100;
}

module.exports = {
  apiLimiter,
  loginLimiter,
  orderLimiter,
  applySecurityHeaders,
  verifySameOrigin,
  hardenHttpServer
};
