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
assert.match(app,/feedPageHeight=feedViewportHeight>0\?feedViewportHeight:Math\.max\(160/,'feed should use measured viewport when available and a safe fallback immediately');
assert.match(app,/onLayout=\{event=>\{const h=Math\.round\(event\.nativeEvent\.layout\.height\)/,'feed should measure real layout');
assert.match(app,/<FlatList key=\{tab\} ref=\{feedListRef\}/,'feed mounts immediately');
assert.doesNotMatch(app,/feedViewportHeight>0\?<FlatList/,'never gate video on layout measurement');
assert.match(app,/onCreate=\{startStory\}/,'profile plus must open stories rather than regular post');
assert.match(app,/pagingEnabled snapToInterval=\{feedPageHeight\}/,'native swipe must advance one full-height video');
assert.match(app,/disableIntervalMomentum/,'swipe momentum should not skip multiple posts');
assert.match(app,/scrollSnapType:'y mandatory'/,'web feed must snap to complete video boundaries');
assert.match(app,/scrollSnapAlign:'start',scrollSnapStop:'always'/,'web slides should stop at each post');
assert.match(app,/scheduleWebFeedSnap\(event\.nativeEvent\.contentOffset\.y\)/,'web should settle after touch and trackpad scrolling');
assert.match(app,/ListFooterComponent=\{null\}/,'infinite scrolling must not leave a partial loading-only slide');
assert.match(app,/feedNavRow:/,'feed category tabs should share a responsive row');
assert.match(app,/tab==='Following'\?<View[^>]+><StoryStrip/,'Only Friends / Following should reserve room for the Stories strip');
assert.match(app,/tab==='Following'\?<View[^>]+paddingTop:/,'Stories should be positioned below the immersive overlay navigation');
assert.match(app,/<StoryStrip client=\{supabase\} session=\{session\}/,'Stories must remain connected to real accounts');
assert.match(app,/pageHeight>=400\?<Pressable/,'short screens should collapse Save into More');
assert.match(app,/pageHeight>=460\?<Pressable/,'short screens should collapse Share into More');
assert.match(app,/accessibilityLabel="More post actions"/,'extra feed actions remain accessible');
assert.doesNotMatch(app,/<ScrollView style=\{\[s.videoActions/,'action rail must not be clipped within a scroller');
assert.match(app,/<FlatList key=\{tab\} ref=\{feedListRef\}/,'feed mounts immediately');
assert.doesNotMatch(app,/feedViewportHeight>0\?<FlatList/,'never gate video on layout measurement');
assert.match(inbox,/maxWidth:780,width:'100%'/,'message view should fit both tablets and phones');

assert.match(app,/const feed=\(\)=> <View style=\{\{flex:1,backgroundColor:olive\.bg\}\}/,'feed background must use ReconFeed olive');
assert.match(app,/feedTop:\{[^\n]*backgroundColor:olive\.bg/,'top navigation must remain olive');
assert.match(app,/navOuter:\{backgroundColor:olive\.bg/,'bottom navigation must remain olive');
assert.match(app,/videoPage:\{[^\n]*backgroundColor:olive\.deep/,'media letterboxing must stay dark olive');
assert.match(app,/feedTabActive:\{[^\n]*borderBottomColor:olive\.gold/,'selected category must use the gold accent');
assert.match(app,/backgroundColor:olive\.accent,borderLeftColor:olive\.border,borderRightColor:olive\.gold/,'Create button must use olive and gold');
assert.doesNotMatch(app,/\(tab==='For You'\|\|tab==='Following'\)\&\&\{backgroundColor:'#000'/,'feed overrides must not revert to black');
assert.match(app,/const \{width:screenWidth,height:screenHeight,fontScale\}=useWindowDimensions\(\)/,'respect Android logical width and font scaling');
assert.match(app,/adaptiveNavPad/,'bottom navigation should use responsive Android padding');
assert.match(app,/feedViewportHeight,screenWidth,screenHeight/,'viewport changes must re-align snapped videos');
assert.match(app,/keyboardShouldPersistTaps="always"/,'Discover categories must remain tappable when keyboard is open');
assert.match(app,/void runExploreSearch\(item\.query\)/,'tap category should request actual filtered results');
assert.match(app,/videoActions:\{[^\n]*zIndex:5/,'buttons must remain above the full-video gesture layer');
assert.match(app,/videoInfo:\{[^\n]*zIndex:5/,'creator profile links must remain tappable above the video');
const header=await read('mobile/CreatorProfileHeader.tsx');
assert.match(header,/smallPhone=width<380/,'creator header must shrink on narrower phones');
assert.match(header,/onPress=\{onCreate\}/,'profile Story plus must invoke its supplied callback');
assert.match(app,/onCreate=\{startStory\}/,'profile Story callback must open the story composer');
console.log('Responsive layout contracts verified (static checks; real-device testing still required).');
