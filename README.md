# Car History

Official vehicle MOT analysis and history check for UK registrations, powered by the DVSA MOT History API. This is a single Vercel project: a Vite/React frontend plus one serverless API function (`/api/mot`). No cross-origin requests, no CORS misconfiguration, environment-aware automatically.

## What changed from v1

- **Secrets are no longer at risk of being committed.** `.gitignore` excludes `.env*`; `.env.example` is the only file with the variable names, left blank. **The DVSA `CLIENT_SECRET` and `X_API_KEY` from the old `backend/.env` were exposed in an unprotected file and must be rotated in the DVSA/Azure portal before this goes live** — that's a manual step only you can do, this rebuild can't do it for you.
- **No more hardcoded `http://localhost:3001`.** The frontend calls a relative `/api/mot`, which works identically in local dev (`vercel dev`) and production because frontend and API are one deployment.
- **CORS is gone, not reconfigured** — there's no cross-origin request in this design, so there's nothing to misconfigure.
- **Rate limiting + origin check** on `/api/mot` (see `api/_lib/rateLimit.js`, `api/_lib/security.js`) as a secondary safety net. The primary defense against scraping/abuse should be the **Vercel Firewall** (see below) — an in-memory limiter inside a serverless function is not reliable at scale.
- **No more silent mock-data fallback.** A failed real lookup now shows an explicit error with a "View a sample report instead" link, rather than quietly substituting fake data as if it were live.
- **Basic security headers** on both the API responses and static pages (`vercel.json`).
- **Input validation** on the registration parameter server-side (format check), not just whitespace-stripping.
- Dropped unused Vite-template leftovers (`App.css`, `src/assets/`, `public/icons.svg`) that weren't referenced anywhere.

## Local development

```bash
npm install
npm i -g vercel   # if you don't already have the CLI
cp .env.example .env.local   # fill in real values, never commit this file
vercel dev
```

`vercel dev` serves the React app and runs `/api/mot` as a real serverless function on one port, so behavior matches production. `npm run dev:vite-only` is available for UI-only work but proxies `/api` to `localhost:3000`, so it needs `vercel dev` running separately if you want live API calls.

## Deploying

1. Push to GitHub and import the repo in the [Vercel dashboard](https://vercel.com).
2. In **Settings → Environment Variables** (Production), add:
   - `CLIENT_ID` — DVSA OAuth client ID
   - `CLIENT_SECRET` — DVSA OAuth client secret (rotate before deploying)
   - `X_API_KEY` — DVSA API key
   - `TOKEN_URL` — `https://login.microsoftonline.com/organizations/oauth2/v2.0/token`
   - `SCOPE_URL` — `https://tapi.dvsa.gov.uk/.default`
   - `ALLOWED_ORIGINS` — your domain (e.g., `carqualitycheck.com, www.carqualitycheck.com`)
3. Connect your domain in **Settings → Domains** and add Vercel's DNS records to your registrar.
4. Vercel auto-deploys on every git push.

### Recommended: turn on Vercel Firewall / rate-limit rules

The in-code rate limiter (`api/_lib/rateLimit.js`) is best-effort only — it resets on cold start and isn't shared across concurrent function instances, so it won't reliably stop sustained scraping. For real protection:

- Vercel Pro+ projects: **Settings → Firewall** — add a rate-limit rule on `/api/mot` (e.g. N requests per IP per minute) and enable Attack Challenge Mode / bot protection.
- Alternative: put Cloudflare in front with its bot-management / rate-limiting rules.

This is deliberately not something this codebase can set up for you — it's platform configuration on your Vercel account, not application code.

## Before adding ads / affiliate links

Check the DVSA MOT History API terms of use for any restriction on commercial/monetized use of the data, and plan for a cookie-consent banner — UK/EU visitors, and most ad/affiliate scripts set cookies, which brings GDPR/PECR consent requirements into play.
