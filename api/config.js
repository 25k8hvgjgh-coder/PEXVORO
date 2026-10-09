// Public browser configuration only. Never return a Supabase service-role key here.
// The URL and publishable/anon key are intended for client-side use. Environment
// variables override these public defaults when configured in Vercel.
module.exports = (req, res) => {
  res.setHeader('Cache-Control', 'no-store');
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  if (req.method !== 'GET') { res.setHeader('Allow', 'GET'); return res.status(405).json({ error: 'Method not allowed' }); }
  const url = process.env.SUPABASE_URL || 'https://ojprsyvkzgyphpsvksgx.supabase.co';
  const anonKey = process.env.SUPABASE_ANON_KEY || 'sb_publishable_mhVX66Gl1F0x6WMgORilRw_QWjOrusW';
  const validUrl = /^https:\/\/[a-z0-9-]+\.supabase\.co$/i.test(url);
  if (!validUrl || !anonKey) return res.status(503).json({ configured: false, message: 'Add SUPABASE_URL and SUPABASE_ANON_KEY in Vercel Project Settings → Environment Variables.' });
  return res.status(200).json({ configured: true, url, anonKey });
};
