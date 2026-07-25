// Comma-separated list of origins allowed to call this API, e.g.
// "https://carqualitycheck.com,https://www.carqualitycheck.com".
// Frontend and API are deployed as one Vercel project (same origin), so this
// is a defense-in-depth check against direct/off-site calls, not the
// project's CORS boundary — there isn't one, because there's no cross-origin
// request in the intended flow.
const ALLOWED_ORIGINS = (process.env.ALLOWED_ORIGINS || '')
  .split(',')
  .map((o) => o.trim())
  .filter(Boolean);

export function isAllowedOrigin(req) {
  // Not configured yet (e.g. first deploy before the env var is set) — skip
  // rather than lock everyone out.
  if (ALLOWED_ORIGINS.length === 0) return true;

  const source = req.headers.origin || req.headers.referer;
  if (!source) return false;

  return ALLOWED_ORIGINS.some((allowed) => source.startsWith(allowed));
}

export function setSecurityHeaders(res) {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'DENY');
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
  res.setHeader('Cache-Control', 'no-store');
}
