// Public browser configuration only. Never return a Supabase service-role key here.
// Prefer valid Vercel values, but ignore stale/placeholder values so the public
// website can still initialize with the project's known public Supabase settings.
const DEFAULT_URL = 'https://ojprsyvkzgyphpsvksgx.supabase.co';
const DEFAULT_ANON_KEY = 'sb_publishable_mhVX66Gl1F0x6WMgORilRw_QWjOrusW';
const isValidSupabaseUrl = (value) => typeof value === 'string' && /^https:\/\/[a-z0-9-]+\.supabase\.co$/i.test(value.trim());
module.exports = (req, res) => {
  res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate');
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  if (req.method !== 'GET') { res.setHeader('Allow', 'GET'); return res.status(405).json({ error: 'Method not allowed' }); }
  const url = isValidSupabaseUrl(process.env.SUPABASE_URL) ? process.env.SUPABASE_URL.trim() : DEFAULT_URL;
  const configuredKey = typeof process.env.SUPABASE_ANON_KEY === 'string' ? process.env.SUPABASE_ANON_KEY.trim() : '';
  const anonKey = configuredKey && !/^(your|replace|placeholder|changeme)/i.test(configuredKey) ? configuredKey : DEFAULT_ANON_KEY;
  return res.status(200).json({ configured: Boolean(url && anonKey), url, anonKey });
};
