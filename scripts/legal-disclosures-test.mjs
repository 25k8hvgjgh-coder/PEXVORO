import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
const read=path=>readFile(new URL('../'+path,import.meta.url),'utf8');
const [app,home,beta,build,terms,privacy,copyright,community,market]=await Promise.all(['mobile/App.tsx','index.html','beta.html','scripts/build-web.mjs','terms.html','privacy.html','copyright.html','community-guidelines.html','marketplace-terms.html'].map(read));
for(const [n,html] of [['terms',terms],['privacy',privacy],['copyright',copyright],['community',community]]){assert.match(html,/<title>/,n+' title');assert.match(html,/reconfeed@reconfeed\.com/i,n+' contact');assert.match(html,/<a href="\/" class="brand">/,'return-home link');assert.match(build,new RegExp(n==='community'?'community-guidelines':n),n+' in production web export');}
for(const link of ['privacy.html','terms.html','copyright.html','community-guidelines.html']){assert.ok(home.includes('/'+link),'homepage must link '+link);assert.ok(beta.includes('/'+link),'beta must link '+link);assert.ok(market.includes('/'+link),'market must link '+link);}
assert.match(beta,/id="legal_acknowledgment" type="checkbox" required/,'beta applicant must acknowledge terms');
assert.match(beta,/legal_acknowledgment:document.getElementById\('legal_acknowledgment'\).checked/,'beta sends terms acknowledgment');
const api=await read('api/beta-signup.js');
assert.match(api,/body\.legal_acknowledgment !== true \|\| body\.legal_version !== '2026-10-10'/,'server enforces acknowledgment');
assert.match(api,/join_reconfeed_beta_legal/,'legal signup uses auditing RPC');
assert.match(api,/p_legal_accepted:true,p_legal_version:'2026-10-10'/,'legal consent record version is passed');
assert.match(app,/termsAccepted/,'account signup must require explicit terms');
assert.match(app,/terms_accepted_version:'2026-10-10'/,'account consent version audit metadata');
assert.match(app,/action==='privacy'.*Linking\.openURL\('https:\/\/reconfeed\.com\/privacy\.html'\)/,'working privacy link in app');
assert.match(app,/action==='terms'.*Linking\.openURL\('https:\/\/reconfeed\.com\/terms\.html'\)/,'working terms link in app');
assert.doesNotMatch(app,/RECONFEED ORIGINAL/,'never claim user posts are platform originals');
console.log('ReconFeed legal-disclosure links and signup acknowledgement pass static checks.');
