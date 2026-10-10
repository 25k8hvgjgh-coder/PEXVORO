// ReconFeed beta interest form. Only contact information for consenting adults is collected.
// Submissions use the public Supabase RPC, which never exposes stored addresses.
const VALID_PLATFORMS = new Set(['iphone','android','both','web']);
const VALID_INTERESTS = new Set(['veterans','trades','trucks','outdoors','creators','marketplace']);
const SUPABASE_URL = 'https://ojprsyvkzgyphpsvksgx.supabase.co';
const PUBLIC_KEY = 'sb_publishable_mhVX66Gl1F0x6WMgORilRw_QWjOrusW';

export default async function handler(req,res) {
  res.setHeader('Cache-Control','no-store');
  res.setHeader('Content-Type','application/json; charset=utf-8');
  if(req.method !== 'POST'){res.setHeader('Allow','POST');return res.status(405).json({error:'Method not allowed'});}
  const length = Number(req.headers['content-length'] || 0);
  if(length > 4096) return res.status(413).json({error:'Request too large'});
  const origin = String(req.headers.origin || '');
  const host = String(req.headers['x-forwarded-host'] || req.headers.host || '').toLowerCase();
  if(origin) {
    try { const u = new URL(origin); if(u.protocol !== 'https:' || u.host.toLowerCase() !== host) return res.status(403).json({error:'Please use the ReconFeed beta signup page.'}); }
    catch { return res.status(403).json({error:'Invalid origin'}); }
  }
  try {
    const body = typeof req.body === 'string' ? JSON.parse(req.body) : req.body || {};
    const email = String(body.email || '').trim().toLowerCase();
    const platform = String(body.platform || '');
    const interests = Array.isArray(body.interests) ? [...new Set(body.interests.map(String))] : [];
    const source = String(body.source || 'website').replace(/[^a-z0-9_\-]/gi,'').slice(0,48) || 'website';
    const trap = String(body.company_website || '').slice(0,255);
    if(trap) return res.status(200).json({ok:true});
    if(!/^[^\s@]+@[^\s@]+\.[a-z]{2,}$/i.test(email) || email.length > 254 || email.length < 6)
      return res.status(400).json({error:'Enter a valid email address.'});
    if(!VALID_PLATFORMS.has(platform)) return res.status(400).json({error:'Choose the device you want to test.'});
    if(interests.length > 6 || interests.some(x => !VALID_INTERESTS.has(x))) return res.status(400).json({error:'Select up to six valid interests.'});
    if(body.confirm_adult !== true || body.consent !== true || body.accept_guidelines !== true)
      return res.status(400).json({error:'Confirm you are 18+, consent to beta email contact, and accept the tester guidelines.'});
    const response = await fetch(SUPABASE_URL + '/rest/v1/rpc/join_reconfeed_beta',{
      method:'POST',headers:{'apikey':PUBLIC_KEY,'Content-Type':'application/json','Accept':'application/json'},
      body:JSON.stringify({p_email:email,p_platform:platform,p_interests:interests,p_source:source,p_confirm_adult:true,p_consent:true,p_trap:''})
    });
    if(!response.ok) {
      // Do not leak responses with database details or private user data.
      console.error('ReconFeed beta signup persistence failed',response.status);
      return res.status(503).json({error:'Beta signup is temporarily unavailable. Please try again shortly.'});
    }
    return res.status(200).json({ok:true,message:'You are on the beta interest list. Watch your inbox for future testing updates.'});
  } catch(error) {
    console.error('ReconFeed beta signup error',String(error?.message || error).slice(0,120));
    return res.status(500).json({error:'Could not process your signup. Please try again.'});
  }
}
