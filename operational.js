'use strict';

const net = require('node:net');

function positiveInteger(value, fallback) {
  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : fallback;
}

function normalizeIp(value) {
  if (typeof value !== 'string') return null;
  const ip = value.trim();
  if (!ip || /[\s\r\n]/.test(ip)) return null;
  const normalized = ip.startsWith('::ffff:') ? ip.slice(7) : ip;
  return net.isIP(normalized) ? normalized : null;
}

function createClientIpResolver({ trustedProxyIps = process.env.TRUSTED_PROXY_IPS || '' } = {}) {
  const trusted = new Set(trustedProxyIps.split(',').map(normalizeIp).filter(Boolean));
  return function clientIp(req) {
    const remoteIp = normalizeIp(req.socket && req.socket.remoteAddress) || 'unknown';
    if (!trusted.has(remoteIp)) return remoteIp;
    const forwarded = req.headers['x-forwarded-for'];
    if (typeof forwarded !== 'string') return remoteIp;
    const chain = forwarded.split(',').map(normalizeIp).filter(Boolean);
    for (let index = chain.length - 1; index >= 0; index--) {
      if (!trusted.has(chain[index])) return chain[index];
    }
    return remoteIp;
  };
}

class FixedWindowRateLimiter {
  constructor({ windowMs, max }) {
    this.windowMs = windowMs;
    this.max = max;
    this.buckets = new Map();
  }

  check(key, now = Date.now()) {
    const existing = this.buckets.get(key);
    if (!existing || existing.resetAt <= now) {
      this.buckets.set(key, { count: 1, resetAt: now + this.windowMs });
      return { allowed: true, retryAfterSeconds: 0 };
    }
    existing.count++;
    if (existing.count <= this.max) return { allowed: true, retryAfterSeconds: 0 };
    return { allowed: false, retryAfterSeconds: Math.max(1, Math.ceil((existing.resetAt - now) / 1000)) };
  }

  prune(now = Date.now()) {
    for (const [key, bucket] of this.buckets) {
      if (bucket.resetAt <= now) this.buckets.delete(key);
    }
  }
}

function createRateLimiters(env = process.env) {
  const windowMs = positiveInteger(env.RATE_LIMIT_WINDOW_MS, 60_000);
  return {
    login: new FixedWindowRateLimiter({ windowMs, max: positiveInteger(env.STAFF_LOGIN_RATE_LIMIT_MAX, 20) }),
    action: new FixedWindowRateLimiter({ windowMs, max: positiveInteger(env.API_ACTION_RATE_LIMIT_MAX, 600) }),
  };
}

function logEvent(level, event, fields = {}) {
  const record = { timestamp: new Date().toISOString(), level, event, ...fields };
  console[level === 'error' ? 'error' : 'log'](JSON.stringify(record));
}

function errorFields(error) {
  return {
    errorName: error && error.name ? error.name : 'Error',
    errorCode: error && error.code ? String(error.code) : 'UNKNOWN',
  };
}

module.exports = {
  createClientIpResolver,
  createRateLimiters,
  errorFields,
  logEvent,
  positiveInteger,
};
