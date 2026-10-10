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
    let isBetaTester=false;
    // Only an authenticated, email-confirmed user matching a real application qualifies.
    const serviceKey=process.env.SUPABASE_SERVICE_ROLE_KEY;
    if (serviceKey && user.id && user.email && user.email_confirmed_at) {
      try {
        const email=String(user.email).trim().toLowerCase();
        const check=await fetch(url.replace(/\/$/,'')+'/rest/v1/reconfeed_beta_testers?select=status,adult_18_plus,contact_consent&email=eq.'+encodeURIComponent(email)+'&limit=1', {
          headers:{apikey:serviceKey,Authorization:'Bearer '+serviceKey},signal:AbortSignal.timeout(8000)
        });
        if(check.ok) {
          const rows=await check.json();
          const entry=Array.isArray(rows)?rows[0]:null;
          isBetaTester=Boolean(entry?.adult_18_plus===true && entry?.contact_consent===true && ['pending','invited','active'].includes(entry.status));
        } else {console.warn('ReconFeed beta lookup failed',check.status)}
      }catch(err){console.warn('ReconFeed beta lookup unavailable')}
    }
    return res.status(200).json({ authenticated: true, userId: user.id, isBetaTester });
  } catch {
    return res.status(503).json({ error: 'Account service is temporarily unavailable.' });
  }
}
