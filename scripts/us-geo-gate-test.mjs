import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';

// Evaluate the exact middleware source as a module, including its exported
// matcher. Exercise GET pages and API routes without relying on an IP lookup
// service that can be forged by the client or vary during CI.
const middlewareSource=await readFile(new URL('../middleware.js',import.meta.url),'utf8');
const {default:gate,config}=await import('data:text/javascript;base64,'+Buffer.from(middlewareSource).toString('base64'));
assert.ok(String(config?.matcher).includes('(.*)'),'country gate must match all site routes');
for(const path of ['/','/app/','/command-center.html','/beta.html','/api/command-center','/api/beta-signup','/assets/reconfeed-emblem.svg']){
 for(const country of ['CA','GB','AU','ZZ',null]){
  const headers=country?{'x-vercel-ip-country':country}:{};
  const resp=gate(new Request('https://reconfeed.com'+path,{headers}));
  assert.ok(resp instanceof Response,`Missing denial for ${path} in ${country||'unknown'}`);
  assert.equal(resp.status,403,`Outside-US should get HTTP 403 at ${path}`);
  assert.equal(resp.headers.get('Cache-Control'),'private, no-store');
  assert.equal(resp.headers.get('X-Content-Type-Options'),'nosniff');
  if(path.startsWith('/api/'))assert.match(resp.headers.get('Content-Type')||'',/application\/json/);
 }
 const allowed=gate(new Request('https://reconfeed.com'+path,{headers:{'x-vercel-ip-country':'US'}}));
 assert.equal(allowed,undefined,`U.S. request should proceed to ${path}`);
}
console.log('U.S.-only middleware unit checks passed for app, website, assets and API; production geo routing must still be verified with real requests.');
