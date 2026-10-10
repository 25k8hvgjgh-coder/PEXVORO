import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';
const root=fileURLToPath(new URL('../',import.meta.url));
const read=async path=>readFile(new URL('../'+path,import.meta.url),'utf8');
const [home,beta,builder,app,inbox]=await Promise.all([
 read('index.html'),read('beta.html'),read('scripts/build-web.mjs'),read('mobile/App.tsx'),read('mobile/SocialInbox.tsx')
]);
for(const [label,page] of [['home',home],['beta',beta]]){
 assert.match(page,/name="viewport"[^>]*viewport-fit=cover/,label+' missing iOS safe-area viewport');
 assert.match(page,/@media\(max-width:540px\)/,label+' missing small-phone breakpoint');
 assert.match(page,/overflow-x:clip/,label+' must prevent narrow-screen horizontal overflow');
}
assert.match(builder,/#root\{height:100dvh\}/,'browser app must use dynamic viewport height on Safari');
assert.match(builder,/font-size:16px!important/,'form inputs should not trigger automatic iPhone zoom');
assert.match(app,/feedPageHeight=Math\.max\(1,feedViewportHeight/,'feed should measure usable viewport');
assert.match(app,/onLayout=\{event=>\{const h=Math\.round\(event\.nativeEvent\.layout\.height\)/,'feed should measure real layout');
assert.match(app,/feedViewportHeight>0\?<FlatList/,'feed should wait for a measured viewport');
assert.match(app,/onCreate=\{startStory\}/,'profile plus must open stories rather than regular post');
assert.match(app,/maxHeight:Math\.max\(90,Math\.min\(360/,'action rail should fit short screens');
assert.match(inbox,/maxWidth:780,width:'100%'/,'message view should fit both tablets and phones');
console.log('Responsive layout contracts verified (static checks; real-device testing still required).');
