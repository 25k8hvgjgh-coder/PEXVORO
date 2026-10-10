import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
const app=await readFile(new URL('../mobile/App.tsx',import.meta.url),'utf8');
const checks=[
 ['one page per native swipe',/pagingEnabled snapToInterval=\{feedPageHeight\} snapToAlignment="start" disableIntervalMomentum/],
 ['web mandatory snap',/scrollSnapType:'y mandatory'/],
 ['stop at each video',/scrollSnapAlign:'start',scrollSnapStop:'always'/],
 ['web wheel and touch settle',/onScroll=\{event=>\{if\(Platform\.OS==='web'\)scheduleWebFeedSnap\(event\.nativeEvent\.contentOffset\.y\)\}\}/],
 ['momentum settle',/onMomentumScrollEnd=\{event=>\{if\(Platform\.OS==='web'\)scheduleWebFeedSnap\(event\.nativeEvent\.contentOffset\.y\)\}\}/],
 ['measured viewport',/const feedPageHeight=Math\.max\(1,feedViewportHeight\)/],
 ['exact-height video slide',/style=\{\[s\.videoPage,\{height:pageHeight\}/],
 ['active video playback',/p\.id===\(activePostId\|\|posts\[0\]\?\.id\)/],
 ['olive styling',/const feed=\(\)=> <View style=\{\{flex:1,backgroundColor:olive\.bg\}\}/]
];
for(const [label,pattern] of checks)assert.match(app,pattern,label);
assert.doesNotMatch(app,/pagingEnabled=\{Platform\.OS!=='web'\}/,'must not disable web paging');
assert.doesNotMatch(app,/snapToInterval=\{Platform\.OS==='web'\?undefined:/,'must not disable web snapping');
assert.doesNotMatch(app,/ListFooterComponent=\{loadingMore\?/,'loading must not create a partial slide');
console.log('Full-video vertical slideshow scrolling contracts passed. Real-device gesture testing still required.');
