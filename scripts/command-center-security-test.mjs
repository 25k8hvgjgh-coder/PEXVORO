import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
const read=file=>readFile(new URL('../'+file,import.meta.url),'utf8');
const [api,html,js,css,build,vercel,app,menu]=await Promise.all([
 'api/command-center.js','command-center.html','assets/command-center.js',
 'assets/command-center.css','scripts/build-web.mjs','vercel.json',
 'mobile/App.tsx','mobile/CommandCenter.tsx'
].map(read));
assert.match(api,/const OWNER_ID='8287fc6f-dd23-48d8-988e-388a8c93fe7b'/,'owner ID is pinned on server');
assert.match(api,/person\.id!==OWNER_ID/,'the server refuses any other identity');
assert.match(api,/app_metadata\?\.reconfeed_command_center_admin!==true/,'only trusted app metadata authorizes requests');
assert.match(api,/person\.email_confirmed_at/,'only verified accounts may administer');
assert.match(api,/auth\/v1\/user/,'permissions are checked against the authenticated identity');
assert.match(api,/SUPABASE_SERVICE_ROLE_KEY/,'service access stays on server');
assert.match(api,/if\(!admin\)return send\(res,403/,'private API denies non-owner');
assert.match(api,/if\(req\.method==='GET'\)/,'read requests are authorized');
assert.match(api,/target\.protocol!=='https:'\|\|target\.host!==host/,'write requests must be same-origin HTTPS');
assert.match(api,/STATUSES\.has\(body\.status\)/,'issues cannot be assigned unrecognized statuses');
assert.match(api,/UUID\.test\(String\(body\.id\|\|''\)\)/,'write targets must use validated UUIDs');
assert.match(api,/signScreenshot/,'screenshot links are generated on demand');
assert.match(api,/expiresIn:120/,'screenshot signed URLs expire quickly');
assert.doesNotMatch(api,/res\.status\(200\)\.json\(\{[^}]*service/,'service keys must never be sent to clients');
assert.doesNotMatch(js,/(?:localStorage|sessionStorage)\s*\./,'browser dashboard stores no session tokens persistently');
assert.match(js,/textContent=String\(txt\)/,'tester content must be rendered as text, not HTML');
assert.match(js,/function signOut/,'logout clears in-memory credentials');
assert.match(js,/25\*60\*1000/,'short idle timeout');
assert.match(js,/api\('\?action=screenshot&id='/,'private screenshots require authorized API call');
assert.match(js,/action:'set_report_status'/,'real issue status updates use protected backend');
assert.match(html,/meta name="robots" content="noindex,nofollow,noarchive"/,'dashboard is excluded from search engines');
assert.match(html,/id="screen-reports"/,'dashboard includes live tester feedback');
assert.match(html,/id="screen-testers"/,'dashboard includes beta signups');
assert.match(html,/id="screen-systems"/,'dashboard includes security controls');
assert.match(css,/@media\(max-width:760px\)/,'dashboard fits phones');
assert.match(build,/'command-center\.html'/,'command center is deployed');
assert.match(app,/reconfeed_command_center_admin===true/,'owner menu hides dashboard from non-admin users');
assert.match(menu,/reconfeed_command_center_admin!==true/,'native dashboard also verifies trusted owner role');
const v=JSON.parse(vercel);
const security=v.headers.find(rule=>rule.source==='/command-center.html');
assert.ok(security,'private dashboard requires security-specific response headers');
const csp=security.headers.find(entry=>entry.key==='Content-Security-Policy')?.value||'';
for(const term of ["default-src 'none'","script-src 'self'","connect-src 'self'","frame-ancestors 'none'","object-src 'none'"])
 assert.ok(csp.includes(term),'missing command center content security policy: '+term);
assert.ok(security.headers.some(x=>x.key==='Cache-Control'&&x.value.includes('no-store')),'private dashboard must not be cached');
console.log('Sole-owner authorization, private screenshots, browser isolation, dashboard routing and CSP contracts passed.');
