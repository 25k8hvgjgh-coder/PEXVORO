import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
const read=path=>readFile(new URL('../'+path,import.meta.url),'utf8');
const [app,home,beta,build,terms,privacy,copyright,community,market,deletion]=await Promise.all(['mobile/App.tsx','index.html','beta.html','scripts/build-web.mjs','terms.html','privacy.html','copyright.html','community-guidelines.html','marketplace-terms.html','delete-account.html'].map(read));
for(const [n,html] of [['terms',terms],['privacy',privacy],['copyright',copyright],['community',community]]){assert.match(html,/<title>/,n+' title');assert.match(html,/reconfeed@reconfeed\.com/i,n+' contact');assert.match(html,/<a href="\/" class="brand">/,'return-home link');assert.match(build,new RegExp(n==='community'?'community-guidelines':n),n+' in production web export');}
for(const link of ['privacy.html','terms.html','copyright.html','community-guidelines.html','delete-account.html']){assert.ok(home.includes('/'+link),'homepage must link '+link);assert.ok(beta.includes('/'+link),'beta must link '+link);assert.ok(market.includes('/'+link),'market must link '+link);}
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
assert.match(deletion,/Delete your ReconFeed account/,'deletion page must clearly identify ReconFeed');
assert.match(deletion,/mailto:reconfeed@reconfeed\.com\?subject=ReconFeed%20permanent/,'web-only visitors can initiate account deletion by email');
assert.match(build,/delete-account\.html/,'deletion page included in Vercel export');
assert.match(app,/account_deletion_requests/,'signed-in in-app deletion request is persisted to a private queue');
assert.match(app,/confirmAccountDeletion/,'irreversible request requires user confirmation');
assert.match(app,/user_id:session\.user\.id/,'request tied to the signed-in account');
const settings=await read('mobile/SettingsPrivacyPage.tsx');
assert.match(settings,/id:'delete_account',name:'Delete account & associated data'/,'delete action visible inside Account menu');
console.log('ReconFeed legal-disclosure links, signup acknowledgement and account deletion request contracts passed.');
