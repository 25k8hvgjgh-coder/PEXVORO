// Read-only public production checks. No private tokens, payments or AI credits.
const origin = String(process.env.RECONFEED_BASE_URL || 'https://reconfeed.com').replace(/\/+$/, '');
const pause = ms => new Promise(resolve => setTimeout(resolve, ms));
async function get(path, asJson = true) {
  const response = await fetch(origin + path, {
    headers: { Accept: asJson ? 'application/json' : 'text/html' },
    signal: AbortSignal.timeout(15000),
    redirect: 'follow'
  });
  if (!response.ok) throw Error(path + ' returned HTTP ' + response.status);
  return asJson ? response.json() : response.text();
}
async function verify() {
  const html = await get('/', false);
  if (!html.includes('ReconFeed') || !html.includes('android-eas-beta/ReconFeed-beta.apk'))
    throw Error('ReconFeed branding or the Android beta link is absent from the public page');
  console.log('[PASS] Landing page and Android APK link');
  // Ensure privacy and legal notices are publicly reachable, not just
  // committed to source; this matters for sign-up and rights-holder reports.
  for(const legalPage of [
    ['/privacy.html','Privacy Policy'],
    ['/terms.html','Terms of Service'],
    ['/copyright.html','Copyright and Trademark Complaints'],
    ['/community-guidelines.html','Community Guidelines']
  ]){
    const page=await get(legalPage[0],false);
    if(!page.includes(legalPage[1])||!page.includes('reconfeed@reconfeed.com'))
      throw Error('Published legal notice missing content: '+legalPage[0]);
    if(!html.includes('href="'+legalPage[0]+'"'))
      throw Error('Homepage missing published legal link: '+legalPage[0]);
  }
  console.log('[PASS] Published legal notices and landing page links');
  const beta=await get('/beta.html',false);
  if(!beta.includes('id="legal_acknowledgment"'))
    throw Error('Beta signup lacks mandatory legal acknowledgment');
  const noAgreement=await fetch(origin+'/api/beta-signup',{
    method:'POST',headers:{'Content-Type':'application/json'},
    body:JSON.stringify({
      email:'test-invalid-no-consent@example.invalid',platform:'web',
      political_party:'republican',interests:[],source:'smoke',
      confirm_adult:true,consent:true,accept_guidelines:true,
      legal_acknowledgment:false,legal_version:'2026-10-10'
    }),signal:AbortSignal.timeout(15000)
  });
  if(noAgreement.status!==400)throw Error('Beta endpoint did not reject signup without terms acknowledgment');
  console.log('[PASS] Consent check rejects nonconsenting beta submission without writing data');
  if (!html.includes('href="/app/"')) throw Error('Browser app link is missing');
  const app = await get('/app/', false);
  const bundle = app.match(/src="([^"]+\.js)"/);
  if (!bundle || !bundle[1].startsWith('/app/')) throw Error('Browser app bundle or subpath is missing');
  await get(bundle[1], false);
  console.log('[PASS] Browser app HTML and JavaScript bundle');

  const manifest = await get('/manifest.webmanifest');
  if (manifest.name !== 'ReconFeed' || manifest.display !== 'standalone')
    throw Error('Published PWA manifest does not identify ReconFeed');
  console.log('[PASS] PWA manifest');

  const config = await get('/api/config');
  if (config.configured !== true || !/^https:\/\/[a-z0-9-]+\.supabase\.co$/i.test(config.url || ''))
    throw Error('Missing public Supabase URL');
  if (!String(config.anonKey || '').startsWith('sb_publishable_'))
    throw Error('Missing valid public Supabase publishable key');
  console.log('[PASS] Browser Supabase configuration');

  const health = await get('/api/health');
  if (health.app !== 'ReconFeed' || !health.checks?.supabase?.profilesTableAccessible)
    throw Error('Live Supabase profiles query unavailable (HTTP ' + (health.checks?.supabase?.httpStatus ?? 'unknown') + ')');
  console.log('[PASS] Website API and database connectivity');
  console.log('[INFO] AI configured: ' + Boolean(health.checks?.aiConfigured));
  console.log('[INFO] Payments configured: ' + Boolean(health.checks?.paymentsConfigured));
  const auth = await fetch(origin + '/api/auth-status', { signal: AbortSignal.timeout(15000) });
  if (auth.status !== 401) throw Error('Authentication status route did not reject a signed-out request');
  console.log('[PASS] Auth status route rejects signed-out requests');
}
let failed = false;
for (let attempt = 1; attempt <= 8; attempt++) {
  try {
    await verify();
    console.log('ReconFeed production smoke passed.');
    failed = false;
    break;
  } catch (error) {
    failed = true;
    console.error('[FAIL] attempt ' + attempt + '/8: ' + error.message);
    if (attempt < 8) await pause(15000);
  }
}
if (failed) process.exitCode = 1;
