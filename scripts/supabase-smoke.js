const base = (process.env.EXPO_PUBLIC_SUPABASE_URL || '').replace(/\/$/, '');
const key = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY || '';

if (!/^https:\/\/[a-z0-9-]+\.supabase\.co$/i.test(base) || !key.startsWith('sb_publishable_')) {
  console.error('Supabase smoke test is missing its public URL or publishable key.');
  process.exit(2);
}

async function check(path, label) {
  const response = await fetch(base + '/rest/v1/' + path, {
    headers: {
      apikey: key,
      Authorization: 'Bearer ' + key,
      Accept: 'application/json'
    },
    signal: AbortSignal.timeout(12000)
  });
  if (response.ok) {
    // Do not print response bodies; public rows may still contain user data.
    await response.body?.cancel();
    console.log('[PASS] ' + label + ' (HTTP ' + response.status + ')');
    return { ok: true, status: response.status };
  }
  let detail = '';
  try {
    const payload = await response.json();
    detail = String(payload.code || payload.message || payload.error || '').slice(0, 160);
  } catch {}
  console.error('[FAIL] ' + label + ' (HTTP ' + response.status + ')' + (detail ? ': ' + detail : ''));
  return { ok: false, status: response.status };
}

async function main() {
  let failed = false;
  const profiles = await check('profiles?select=id,username,display_name,bio,avatar_url,created_at&limit=1', 'public-safe profile fields');
  if (!profiles.ok) failed = true;

  const feed = await check(
    'posts?select=id,user_id,caption,media_url,media_type,format,created_at,profiles(username,display_name),likes(count),comments(count)&visibility=eq.public&order=created_at.desc&limit=1',
    'public feed query with profile/like/comment relations'
  );
  if (!feed.ok) failed = true;

  const privateColumns = await fetch(base + '/rest/v1/profiles?select=birth_date,gender&limit=1', {
    headers: { apikey: key, Authorization: 'Bearer ' + key, Accept: 'application/json' },
    signal: AbortSignal.timeout(12000)
  });
  if (privateColumns.ok) {
    await privateColumns.body?.cancel();
    console.warn('::warning::Anonymous client can still SELECT profiles.birth_date/gender. Apply supabase/migrations/20261010020000_profiles_column_privacy.sql in the live project.');
  } else {
    await privateColumns.body?.cancel();
    console.log('[PASS] Sensitive profile columns are not selectable by the anonymous client.');
  }

  // Probe the deployed web API without initiating a paid AI generation.
  try {
    const configResponse = await fetch('https://reconfeed.com/api/config', { signal: AbortSignal.timeout(12000) });
    if (!configResponse.ok) {
      await configResponse.body?.cancel();
      console.warn('::warning::Live website API config endpoint is unavailable (HTTP ' + configResponse.status + '). Verify the Vercel deployment and project access.');
    } else {
      const config = await configResponse.json();
      if (config.configured && config.url === base && typeof config.anonKey === 'string' && config.anonKey.length > 10) {
        console.log('[PASS] Deployed website API exposes the expected public Supabase configuration.');
      } else {
        console.warn('::warning::Deployed website API config does not match the mobile Supabase project.');
      }
    }
  } catch (error) {
    console.warn('::warning::Could not reach the deployed website API config endpoint: ' + String(error?.message || error));
  }

  try {
    const aiStatus = await fetch('https://reconfeed.com/api/generation-status', { signal: AbortSignal.timeout(12000) });
    await aiStatus.body?.cancel();
    if (aiStatus.status === 400) {
      console.log('[PASS] Server-side AI token is present (generation was not started); model compatibility remains unverified.');
    } else if (aiStatus.status === 503) {
      console.warn('::warning::AI generation is not configured: the server-side REPLICATE_API_TOKEN is missing.');
    } else {
      console.warn('::warning::AI status endpoint returned HTTP ' + aiStatus.status + '; verify server API deployment and configuration.');
    }
  } catch (error) {
    console.warn('::warning::Could not reach AI status endpoint: ' + String(error?.message || error));
  }

  if (failed) process.exit(1);
}

main().catch((error) => {
  console.error('[FAIL] Supabase smoke test could not reach the API:', String(error?.message || error));
  process.exit(1);
});
