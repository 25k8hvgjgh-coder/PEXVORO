import { mkdir, rm, copyFile, cp, readFile, writeFile } from 'node:fs/promises';
import { createRequire } from 'node:module';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const root = fileURLToPath(new URL('../', import.meta.url));
const mobile = path.join(root, 'mobile');
const requireMobile = createRequire(path.join(mobile, 'package.json'));
// Prevent a broken native settings screen from being published as a successful web build.
const typecheck = spawnSync('npm', ['run','typecheck'], { cwd:mobile, stdio:'inherit', env:process.env });
if(typecheck.status!==0){ console.error('ReconFeed mobile TypeScript validation failed.');process.exit(typecheck.status||1); }
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
for (const filename of ['index.html', 'beta.html', 'marketplace-terms.html', 'privacy.html', 'terms.html', 'copyright.html', 'community-guidelines.html', 'delete-account.html', 'manifest.webmanifest', 'sw.js', 'app-link.json']) {
  await copyFile(path.join(root, filename), path.join(root, 'dist', filename));
}
await cp(path.join(root, 'assets'), path.join(root, 'dist/assets'), { recursive: true });
const appIndex = path.join(root, 'dist/app/index.html');
let html = await readFile(appIndex, 'utf8');
html = html.replace(/<meta[^>]*name=["']viewport["'][^>]*>/i, '<meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover">');
if (!html.includes('viewport-fit=cover')) html = html.replace('</head>', '<meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover"></head>');
html = html.replace('</head>', "<meta name=\"theme-color\" content=\"#0a0d0c\"><link rel=\"manifest\" href=\"/manifest.webmanifest\"><link rel=\"apple-touch-icon\" href=\"/assets/reconfeed-apple-touch-icon.png\">\n<style>\nhtml,body{width:100%;height:100%;max-width:100%;margin:0;overflow:hidden;overscroll-behavior-x:none}\n#root{width:100%;height:100vh;max-width:100%;min-height:0;overflow:hidden}\n@supports(height:100dvh){#root{height:100dvh}}\n@media(max-width:600px){input,textarea,select{font-size:16px!important}}\n</style>" + '</head>');
await writeFile(appIndex, html);
console.log('ReconFeed website and browser app exported to dist/.');
