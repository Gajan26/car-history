// Module-scope cache. This survives only for the lifetime of a warm
// serverless instance — a cold start re-authenticates. That's expected on
// Vercel; it's a perf optimization, not something correctness depends on.
let cachedToken = null;
let tokenExpiry = null;

export async function getDvsaAccessToken() {
  const now = Date.now();
  if (cachedToken && tokenExpiry && now < tokenExpiry) {
    return cachedToken;
  }

  const params = new URLSearchParams();
  params.append('grant_type', 'client_credentials');
  params.append('client_id', process.env.CLIENT_ID);
  params.append('client_secret', process.env.CLIENT_SECRET);
  params.append('scope', process.env.SCOPE_URL || 'https://tapi.dvsa.gov.uk/.default');

  const response = await fetch(
    process.env.TOKEN_URL || 'https://login.microsoftonline.com/organizations/oauth2/v2.0/token',
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: params.toString()
    }
  );

  if (!response.ok) {
    const errorBody = await response.text().catch(() => '');
    console.error('DVSA auth failed', response.status, errorBody);
    throw new Error('Authentication failure on remote gateway layer.');
  }

  const data = await response.json();
  cachedToken = data.access_token;
  // Buffer expiry by 5 minutes to stay safe against network latency offsets.
  const expiresInSeconds = Math.max(data.expires_in - 300, 60);
  tokenExpiry = now + expiresInSeconds * 1000;

  return cachedToken;
}
