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
}
let failed = false;
for (let attempt = 1; attempt <= 4; attempt++) {
  try {
    await verify();
    console.log('ReconFeed production smoke passed.');
    failed = false;
    break;
  } catch (error) {
    failed = true;
    console.error('[FAIL] attempt ' + attempt + '/4: ' + error.message);
    if (attempt < 4) await pause(15000);
  }
}
if (failed) process.exitCode = 1;
