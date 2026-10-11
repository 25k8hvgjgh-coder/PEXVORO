import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
const read=path=>readFile(new URL('../'+path,import.meta.url),'utf8');
const [app,home,beta,build,terms,privacy,copyright,community,market,deletion,legal]=await Promise.all(['mobile/App.tsx','index.html','beta.html','scripts/build-web.mjs','terms.html','privacy.html','copyright.html','community-guidelines.html','marketplace-terms.html','delete-account.html','legal.html'].map(read));
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
const stories=await read('mobile/Stories.tsx');
assert.match(app,/mediaRightsConfirmed/,'post publish must include rights acknowledgment');
assert.match(app,/disabled=\{busy\|\|!mediaRightsConfirmed\}/,'post upload requires rights confirmation');
assert.match(stories,/rightsConfirmed/,'Story must include rights acknowledgment');
assert.match(stories,/disabled=\{!asset\|\|busy\|\|!rightsConfirmed\}/,'Story upload requires rights confirmation');
assert.match(home,/not endorsements by the people or brands shown/,'stock imagery must not imply endorsement');
assert.match(app,/is_promotional:isPromotional/,'post sponsorship label must be persisted');
assert.match(app,/p\.is_promotional\?<Text accessibilityLabel="Paid promotion or gifted product"/,'paid promotion must be visible on playback');
assert.match(stories,/is_promotional:isPromotional/,'Story sponsorship label must be persisted');
assert.match(stories,/active\?\.is_promotional\?<Text accessibilityLabel="Paid promotion or gifted product"/,'Story viewers must see promotional label');
assert.match(terms,/Advertising, sponsorship and gifts/,'terms must govern material connection');
assert.match(community,/Advertising and brand relationships/,'community must require disclosure');
// Promotional imagery is now first-party CSS illustration: no third-party
// photograph or recognizable-model rights uncertainty in public marketing.
for(const [name,html] of [['homepage',home],['beta signup',beta]]){
 assert.doesNotMatch(html,/https:\/\/images\.(unsplash|pexels)\.com/,'public '+name+' must not depend on unverified stock photography');
 assert.match(html,/radial-gradient\(ellipse at/,'public '+name+' keeps olive-and-gold designed visuals');
}
console.log('ReconFeed legal disclosure, deletion and upload-rights checks passed.');

for(const p of ['/privacy.html','/terms.html','/copyright.html','/community-guidelines.html','/delete-account.html'])assert.ok(legal.includes(p),'legal center links '+p);
for(const [n,page] of [['home',home],['beta',beta],['marketplace',market]])assert.ok(page.includes('/legal.html'),n+' must link legal center');
assert.match(legal,/not a trademark or patent clearance certificate/i,'hub must not claim worldwide clearance');
assert.match(build,/legal\.html/,'legal center copied into built site');
const legalSettings=await read('mobile/SettingsPrivacyPage.tsx');
assert.match(legalSettings,/id:'legal_center'/,'mobile Settings legal link');
assert.match(app,/action==='legal_center'.*reconfeed\.com\/legal\.html/,'mobile legal link opens correct page');
assert.match(app,/Followers \(in app\)/,'followers label must be honest about scope');
assert.match(app,/publicly reachable link/,'restricted post storage warning');
const serverConfig=JSON.parse(await read('vercel.json'));
const defaultHeaders=serverConfig.headers?.find(x=>x.source==='/(.*)')?.headers||[];
for(const key of ['X-Content-Type-Options','Referrer-Policy','X-Frame-Options','Strict-Transport-Security']){
 assert.ok(defaultHeaders.some(h=>h.key===key),'production site must set '+key);
}
const policyHeaders=serverConfig.headers?.find(x=>x.source.includes('privacy')&&x.source.includes('delete-account'))?.headers||[];
assert.ok(policyHeaders.some(h=>h.key==='Cache-Control'&&h.value.includes('must-revalidate')),'public policies must refresh when updated');
console.log('IP hub, non-affiliation, and post visibility disclosures passed.');


// Prevent reintroduction of unlicensed placeholder imagery or sensitive
// political-affiliation persistence into new account Auth metadata.
assert.doesNotMatch(app,/https:\/\/images\.(unsplash|pexels)\.com/,'app stock-photo placeholders must be replaced with first-party designs');
assert.doesNotMatch(app,/political_party:politicalParty/,'do not write political opinions into new Auth account metadata');
assert.match(privacy,/New account registrations no longer save that choice in account metadata/,'sensitive-data notice must describe current behavior');
console.log('App media provenance and minimal political-affiliation retention checks passed.');
