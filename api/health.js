// Public health diagnostics: never return credentials or database rows.
const DEFAULT_URL = 'https://ojprsyvkzgyphpsvksgx.supabase.co';
const DEFAULT_KEY = 'sb_publishable_mhVX66Gl1F0x6WMgORilRw_QWjOrusW';

export default async function handler(req, res) {
  res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate');
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  if (req.method !== 'GET') {
    res.setHeader('Allow', 'GET');
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const configuredUrl = process.env.SUPABASE_URL;
  const url = typeof configuredUrl === 'string' && /^https:\/\/[a-z0-9-]+\.supabase\.co$/i.test(configuredUrl.trim())
    ? configuredUrl.trim()
    : DEFAULT_URL;
  const candidateKey = typeof process.env.SUPABASE_ANON_KEY === 'string' ? process.env.SUPABASE_ANON_KEY.trim() : '';
  const key = candidateKey && !/^(your|replace|placeholder|changeme)/i.test(candidateKey) ? candidateKey : DEFAULT_KEY;

  let supabase = { reachable: false, profilesTableAccessible: false, httpStatus: null };
  try {
    const response = await fetch(url + '/rest/v1/profiles?select=id&limit=1', {
      method: 'GET',
      headers: { apikey: key, Authorization: 'Bearer ' + key }
    });
    supabase = {
      reachable: response.status !== 502 && response.status !== 503 && response.status !== 504,
      profilesTableAccessible: response.ok,
      httpStatus: response.status
    };
  } catch (_) {
    supabase = { reachable: false, profilesTableAccessible: false, httpStatus: null };
  }

  return res.status(200).json({
    app: 'ReconFeed',
    status: 'online',
    checks: {
      supabase,
      aiConfigured: Boolean(process.env.REPLICATE_API_TOKEN && (process.env.REPLICATE_VIDEO_MODEL || process.env.REPLICATE_IMAGE_MODEL)),
      paymentsConfigured: Boolean(process.env.STRIPE_SECRET_KEY && process.env.STRIPE_WEBHOOK_SECRET)
    },
    note: 'Supabase is tested with a read-only profiles query. AI and payments are configuration checks only; no generation or charge is attempted.'
  });
}
