// Best-effort, per-instance sliding-window limiter. On Vercel this resets on
// cold start and is NOT shared across concurrent instances/regions, so it
// cannot be the real defense against sustained abuse or scraping — treat it
// as a secondary safety net. The primary defense should be a Vercel
// Firewall / WAF rate-limit rule configured at the project level (see
// README), since that blocks traffic before it reaches this function at all.
const WINDOW_MS = 15 * 60 * 1000;
const MAX_REQUESTS = 60;
const MAX_TRACKED_KEYS = 5000;

const hits = new Map();

export function isRateLimited(key) {
  const now = Date.now();
  const windowStart = now - WINDOW_MS;

  if (hits.size > MAX_TRACKED_KEYS) {
    hits.clear();
  }

  const timestamps = (hits.get(key) || []).filter((t) => t > windowStart);
  timestamps.push(now);
  hits.set(key, timestamps);

  return timestamps.length > MAX_REQUESTS;
}

export function getClientIp(req) {
  const forwarded = req.headers['x-forwarded-for'];
  if (typeof forwarded === 'string' && forwarded.length > 0) {
    return forwarded.split(',')[0].trim();
  }
  return req.socket?.remoteAddress || 'unknown';
}
