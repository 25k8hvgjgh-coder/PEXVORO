import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
const app=await readFile(new URL('../mobile/App.tsx',import.meta.url),'utf8');
const checks=[
 ['one page per native swipe',/pagingEnabled snapToInterval=\{feedPageHeight\} snapToAlignment="start" disableIntervalMomentum/],
 ['web mandatory snap',/scrollSnapType:'y mandatory'/],
 ['stop at each video',/scrollSnapAlign:'start',scrollSnapStop:'always'/],
 ['web wheel and touch settle',/onScroll=\{event=>\{if\(Platform\.OS==='web'\)scheduleWebFeedSnap\(event\.nativeEvent\.contentOffset\.y\)\}\}/],
 ['momentum settle',/onMomentumScrollEnd=\{event=>\{if\(Platform\.OS==='web'\)scheduleWebFeedSnap\(event\.nativeEvent\.contentOffset\.y\)\}\}/],
 ['measured viewport with instant fallback',/const feedPageHeight=feedViewportHeight>0\?feedViewportHeight:Math\.max\(160/],
 ['exact-height video slide',/style=\{\[s\.videoPage,\{height:pageHeight\}/],
 ['active video playback',/p\.id===\(activePostId\|\|posts\[0\]\?\.id\)/],
 ['olive styling',/const feed=\(\)=> <View style=\{\{flex:1,backgroundColor:olive\.bg\}\}/]
];
for(const [label,pattern] of checks)assert.match(app,pattern,label);
assert.doesNotMatch(app,/pagingEnabled=\{Platform\.OS!=='web'\}/,'must not disable web paging');
assert.doesNotMatch(app,/snapToInterval=\{Platform\.OS==='web'\?undefined:/,'must not disable web snapping');
assert.doesNotMatch(app,/ListFooterComponent=\{loadingMore\?/,'loading must not create a partial slide');
assert.match(app,/onPress=\{\(\)=>onFeedVideoTap\(p\)\}/,'video area should register touches and double-tap likes');
assert.match(app,/void like\(p,true\)/,'double taps must add a real persistent like');
assert.match(app,/setHeartBurstPostId\(p\.id\)/,'double taps should show visible heart feedback');
assert.match(app,/videoActions:\{[^\n]*zIndex:5/,'like and comment controls should not be blocked by gesture overlay');
console.log('Full-video vertical slideshow scrolling contracts passed. Real-device gesture testing still required.');
