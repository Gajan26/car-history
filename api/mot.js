import { getDvsaAccessToken } from './_lib/dvsaToken.js';
import { isRateLimited, getClientIp } from './_lib/rateLimit.js';
import { isAllowedOrigin, setSecurityHeaders } from './_lib/security.js';

const REGISTRATION_PATTERN = /^[A-Z0-9]{2,10}$/;

export default async function handler(req, res) {
  setSecurityHeaders(res);

  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed.' });
  }

  if (!isAllowedOrigin(req)) {
    return res.status(403).json({ error: 'Requests must originate from the Car History app.' });
  }

  if (isRateLimited(getClientIp(req))) {
    return res.status(429).json({ error: 'Too many requests from this IP. Please try again later.' });
  }

  const { registration } = req.query;
  if (!registration || typeof registration !== 'string') {
    return res.status(400).json({ error: 'Registration query parameter is explicitly required.' });
  }

  const cleanRegistration = registration.toUpperCase().replace(/\s+/g, '');
  if (!REGISTRATION_PATTERN.test(cleanRegistration)) {
    return res.status(400).json({ error: 'Registration format is invalid.' });
  }

  try {
    const accessToken = await getDvsaAccessToken();

    const dvsaResponse = await fetch(
      `https://history.mot.api.gov.uk/v1/trade/vehicles/registration/${encodeURIComponent(cleanRegistration)}`,
      {
        headers: {
          Authorization: `Bearer ${accessToken}`,
          'X-API-Key': process.env.X_API_KEY,
          Accept: 'application/json'
        }
      }
    );

    const data = await dvsaResponse.json().catch(() => null);

    if (!dvsaResponse.ok) {
      console.error('DVSA API error', dvsaResponse.status, data);
      if (dvsaResponse.status === 404) {
        return res.status(404).json({ error: 'Vehicle registration profile not found in UK MOT registry.' });
      }
      return res.status(dvsaResponse.status).json({ error: data?.message || 'Remote database error.' });
    }

    return res.status(200).json(data);
  } catch (error) {
    console.error('MOT lookup failed', error);
    return res.status(503).json({ error: 'DVSA remote servers are currently unreachable.' });
  }
}
