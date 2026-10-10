import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';

const app=await readFile(new URL('../mobile/App.tsx',import.meta.url),'utf8');
const load=app.slice(app.indexOf('async function loadFeed(){'),app.indexOf('async function loadMoreFeed(){'));
assert.ok(load.length>1000,'feed loader must exist');
assert.match(app,/const startupFallback=setTimeout\(\(\)=>\{if\(active\)setAuthReady\(true\)\},1800\)/,'startup must not block forever on a slow Auth request');
assert.match(app,/\[tab,session\?\.user\.id,prefsLoaded\]/,'preference completion must reload feeds');
assert.match(load,/const initialFeedPageSize=32/,'fetch a smaller first page');
assert.match(load,/const preview=await publicFeedPromise/,'fetch immediate preview');
assert.match(load,/setPosts\(starterPosts\);\s*setActivePostId\(starterPosts\[0\]\?\.id\|\|null\);\s*setLoading\(false\)/,'show preview without waiting for personalization');
assert.ok(load.indexOf('setPosts(starterPosts)')<load.indexOf('const [followRes,historyRes,likesRes,saveRes]'),'post preview must render before recommendation-history awaits');
assert.match(load,/if\(previewShown\)\{\s*\/\/ Do not jump/,'background ranking cannot replace currently visible video');
assert.match(load,/candidatePosts\.length>=initialFeedPageSize/,'pagination size matches initial query');
assert.match(app,/syncReconFeedUpdate\(\)\},10000\)/,'update checks must not compete with first video');
assert.match(app,/tab==='For You'\|\|tab==='Following'\)\?require\('\.\/assets\/icon\.png'\)/,'feed must avoid extra remote background image download');
assert.match(app,/pagingEnabled snapToInterval=\{feedPageHeight\}/,'TikTok-style one-video swipe preserved');
assert.match(app,/const feed=\(\)=> <View style=\{\{flex:1,backgroundColor:olive\.bg\}\}/,'olive theme preserved');
console.log('Startup speed regression checks passed.');
