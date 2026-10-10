export default async function handler(req, res) {
  res.setHeader('Cache-Control', 'no-store');
  if (req.method !== 'GET') {
    res.setHeader('Allow', 'GET');
    return res.status(405).json({ error: 'Method not allowed' });
  }
  const authorization = req.headers.authorization;
  if (typeof authorization !== 'string' || !/^Bearer\s+\S+$/i.test(authorization)) {
    return res.status(401).json({ authenticated: false });
  }
  const url = process.env.SUPABASE_URL || 'https://ojprsyvkzgyphpsvksgx.supabase.co';
  const key = process.env.SUPABASE_ANON_KEY || 'sb_publishable_mhVX66Gl1F0x6WMgORilRw_QWjOrusW';
  try {
    const response = await fetch(url.replace(/\/$/, '') + '/auth/v1/user', {
      headers: { apikey: key, Authorization: authorization },
      signal: AbortSignal.timeout(8000)
    });
    if (!response.ok) return res.status(response.status >= 500 ? 503 : 401).json({ authenticated: false });
    const user = await response.json();
    return res.status(200).json({ authenticated: true, userId: user.id });
  } catch {
    return res.status(503).json({ error: 'Account service is temporarily unavailable.' });
  }
}
