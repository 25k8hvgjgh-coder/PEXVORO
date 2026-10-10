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

  // Probe marketplace columns; schema changes must be applied to the live database too.
  const marketplace = await check(
    'marketplace_listings?select=id,seller_id,title,description,category,condition,price,location,image_urls,accepted_responsibility,seller_shipping_terms,status,created_at&limit=1',
    'marketplace listing schema'
  );
  if (!marketplace.ok) {
    console.warn('::warning::Marketplace schema may be behind the mobile app: verify price, condition, location, image_urls, seller_shipping_terms, and seller responsibility columns in Supabase.');
  }

  // Probe the configured public media bucket without uploading or exposing user files.
  try {
    const storageProbe = await fetch(base + '/storage/v1/object/public/post-media/__reconfeed_smoke_probe_not_a_real_file__', {
      headers: { apikey: key, Authorization: 'Bearer ' + key },
      signal: AbortSignal.timeout(12000)
    });
    const storageText = await storageProbe.text();
    let storageDetail = storageText;
    try {
      const parsed = JSON.parse(storageText);
      storageDetail = String(parsed.message || parsed.error || parsed.statusCode || storageText);
    } catch {}
    storageDetail = storageDetail.slice(0, 180);
    if ((storageProbe.status === 404 || storageProbe.status === 400) && /object not found/i.test(storageDetail) && !/bucket not found/i.test(storageDetail)) {
      console.log('[PASS] Supabase post-media public bucket is reachable (probe object intentionally does not exist).');
    } else if (/bucket not found|bucket does not exist/i.test(storageDetail)) {
      console.warn('::warning::Supabase public Storage bucket post-media does not exist in the live project.');
    } else {
      console.warn('::warning::Could not conclusively verify public post-media bucket (HTTP ' + storageProbe.status + '): ' + storageDetail + '. Check Storage bucket and public-read settings.');
    }
  } catch (error) {
    console.warn('::warning::Could not reach the post-media Storage endpoint: ' + String(error?.message || error));
  }

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

  // AI generation job rows must not be accessible to anonymous visitors.
  try {
    const aiJobs = await fetch(base + '/rest/v1/ai_generation_jobs?select=id&limit=1', {
      headers: { apikey: key, Authorization: 'Bearer ' + key, Accept: 'application/json' },
      signal: AbortSignal.timeout(12000)
    });
    await aiJobs.body?.cancel();
    if (aiJobs.ok) {
      console.warn('::warning::Anonymous client can read AI generation job records. Verify ai_generation_jobs grants and row-level security.');
    } else {
      console.log('[PASS] Anonymous client cannot read AI generation job records.');
    }
  } catch (error) {
    console.warn('::warning::Could not verify anonymous AI job access: ' + String(error?.message || error));
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
    const unauthenticatedGenerate = await fetch('https://reconfeed.com/api/generate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ workflow: 'text-video', prompt: 'ReconFeed security smoke test' }),
      signal: AbortSignal.timeout(12000)
    });
    await unauthenticatedGenerate.body?.cancel();
    if (unauthenticatedGenerate.status === 401) {
      console.log('[PASS] AI generation endpoint rejects unauthenticated requests.');
    } else {
      console.warn('::warning::Unauthenticated AI generation returned HTTP ' + unauthenticatedGenerate.status + '; verify that the latest secured API deployment is live.');
    }

    const aiStatus = await fetch('https://reconfeed.com/api/generation-status?id=smoke_test_0001', { signal: AbortSignal.timeout(12000) });
    await aiStatus.body?.cancel();
    if (aiStatus.status === 401) {
      console.log('[PASS] AI status endpoint rejects unauthenticated requests.');
    } else {
      console.warn('::warning::Unauthenticated AI status check returned HTTP ' + aiStatus.status + '; verify that the latest secured API deployment is live.');
    }
  } catch (error) {
    console.warn('::warning::Could not complete AI authentication smoke checks: ' + String(error?.message || error));
  }

  // Verify the public site has the deployment changes; these checks never log page contents.
  try {
    const homeResponse = await fetch('https://reconfeed.com/', { signal: AbortSignal.timeout(12000) });
    if (!homeResponse.ok) {
      await homeResponse.body?.cancel();
      console.warn('::warning::Public ReconFeed homepage returned HTTP ' + homeResponse.status + '.');
    } else {
      const html = await homeResponse.text();
      const hasStableApk = html.includes('https://github.com/25k8hvgjgh-coder/PEXVORO/releases/download/android-eas-beta/ReconFeed-beta.apk');
      const hasManifestLink = html.includes('/manifest.webmanifest');
      const hasServiceWorker = html.includes("navigator.serviceWorker.register('/sw.js')");
      const hasSafeIosCopy = html.includes('iPhone beta coming soon') &&
        !html.includes('https://expo.dev/accounts/azzholejr06/projects/reconfeed/builds');
      if (hasStableApk && hasManifestLink && hasServiceWorker && hasSafeIosCopy) {
        console.log('[PASS] Public homepage is serving the stable APK link, home-screen support, and accurate iPhone beta status.');
      } else {
        console.warn('::warning::Public homepage is reachable, but its HTML does not yet contain all current install-link/PWA/iOS-status changes. Vercel deployment may be stale.');
      }
    }

    const manifestResponse = await fetch('https://reconfeed.com/manifest.webmanifest', { signal: AbortSignal.timeout(12000) });
    if (manifestResponse.ok) {
      const liveManifest = await manifestResponse.json();
      if (liveManifest.name === 'ReconFeed' && liveManifest.display === 'standalone') {
        console.log('[PASS] Public PWA manifest is live.');
      } else {
        console.warn('::warning::Public PWA manifest is reachable but does not match the expected ReconFeed install manifest.');
      }
    } else {
      await manifestResponse.body?.cancel();
      console.warn('::warning::Public PWA manifest returned HTTP ' + manifestResponse.status + '.');
    }

    const swResponse = await fetch('https://reconfeed.com/sw.js', { signal: AbortSignal.timeout(12000) });
    if (!swResponse.ok) {
      await swResponse.body?.cancel();
      console.warn('::warning::Public home-screen service worker returned HTTP ' + swResponse.status + '.');
    } else {
      const worker = await swResponse.text();
      if (worker.includes("addEventListener('fetch'") && worker.includes('reconfeed-shell-v2')) {
        console.log('[PASS] Public home-screen service worker is live.');
      } else {
        console.warn('::warning::Public service worker response does not match the expected install shell.');
      }
    }
  } catch (error) {
    console.warn('::warning::Could not complete the public website deployment checks: ' + String(error?.message || error));
  }

  if (failed) process.exit(1);
}

main().catch((error) => {
  console.error('[FAIL] Supabase smoke test could not reach the API:', String(error?.message || error));
  process.exit(1);
});
