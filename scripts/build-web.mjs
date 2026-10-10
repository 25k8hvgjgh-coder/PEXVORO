import { mkdir, rm, copyFile, cp, readFile, writeFile } from 'node:fs/promises';
import { createRequire } from 'node:module';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const root = fileURLToPath(new URL('../', import.meta.url));
const mobile = path.join(root, 'mobile');
const requireMobile = createRequire(path.join(mobile, 'package.json'));
const sharp = requireMobile('sharp');
await sharp(path.join(mobile, 'assets/reconfeed-emblem.svg')).resize(1024, 1024).png().toFile(path.join(mobile, 'assets/icon.png'));
await rm(path.join(root, 'dist'), { recursive: true, force: true });
await mkdir(path.join(root, 'dist'), { recursive: true });
const result = spawnSync(process.execPath, [requireMobile.resolve('expo/bin/cli'), 'export', '--platform', 'web', '--output-dir', '../dist/app'], {
  cwd: mobile, stdio: 'inherit', env: {
    ...process.env, CI: '1', RECONFEED_WEB_BUILD: '1',
    EXPO_PUBLIC_SUPABASE_URL: 'https://ojprsyvkzgyphpsvksgx.supabase.co',
    EXPO_PUBLIC_SUPABASE_ANON_KEY: 'sb_publishable_mhVX66Gl1F0x6WMgORilRw_QWjOrusW',
    EXPO_PUBLIC_API_BASE_URL: 'https://reconfeed.com'
  }
});
if (result.status !== 0) process.exit(result.status || 1);
for (const filename of ['index.html', 'beta.html', 'marketplace-terms.html', 'manifest.webmanifest', 'sw.js', 'app-link.json']) {
  await copyFile(path.join(root, filename), path.join(root, 'dist', filename));
}
await cp(path.join(root, 'assets'), path.join(root, 'dist/assets'), { recursive: true });
const appIndex = path.join(root, 'dist/app/index.html');
let html = await readFile(appIndex, 'utf8');
html = html.replace('</head>', '<meta name="theme-color" content="#0a0d0c"><link rel="manifest" href="/manifest.webmanifest"><link rel="apple-touch-icon" href="/assets/reconfeed-apple-touch-icon.png"></head>');
await writeFile(appIndex, html);
console.log('ReconFeed website and browser app exported to dist/.');
