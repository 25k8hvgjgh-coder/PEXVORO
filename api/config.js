// Public browser configuration only. Never return a Supabase service-role key here.
module.exports = (req, res) => {
  res.setHeader('Cache-Control', 'no-store');
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  if (req.method !== 'GET') { res.setHeader('Allow', 'GET'); return res.status(405).json({ error: 'Method not allowed' }); }
  const url = process.env.SUPABASE_URL || '';
  const anonKey = process.env.SUPABASE_ANON_KEY || '';
  const validUrl = /^https:\/\/[a-z0-9-]+\.supabase\.co$/i.test(url);
  if (!validUrl || !anonKey) return res.status(503).json({ configured: false, message: 'Add SUPABASE_URL and SUPABASE_ANON_KEY in Vercel Project Settings → Environment Variables.' });
  return res.status(200).json({ configured: true, url, anonKey });
};
