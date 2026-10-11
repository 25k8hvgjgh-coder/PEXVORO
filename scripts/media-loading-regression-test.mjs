import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';

const app=await readFile(new URL('../mobile/App.tsx',import.meta.url),'utf8');
assert.doesNotMatch(app,/images\.(?:pexels|unsplash)\.com/,'all built-in illustrations should load offline and avoid untracked photo licensing');
assert.match(app,/const exploreCategories=\[/,'retain Explore category navigation');
assert.match(app,/source=\{require\('\.\/assets\/icon\.png'\)\}/,'use bundled olive-branded media instead of remote decorative images');
assert.match(app,/<Text style=\{\{fontSize:35,color:olive\.gold,textAlign:'center'\}\}>\{item\.glyph\}<\/Text>/,'keep distinctive local Explore category artwork');
assert.doesNotMatch(app,/<Video source=\{\{uri:p\.media_url\}\} style=\{s\.profileVideoThumbnail\}/,'profile gallery must not mount many idle video decoders');
assert.match(app,/setProfileSelected\(p\)/,'gallery tiles must still open the selected playable post');
assert.match(app,/upload\(path,binary,\{contentType,cacheControl:'3600',upsert:false\}\)/,'new public media uploads should advertise cacheable stable content');
assert.match(app,/p\.id===\(activePostId\|\|posts\[0\]\?\.id\)/,'autoplay must only use current video');
assert.match(app,/const feed=\(\)=> <View style=\{\{flex:1,backgroundColor:olive\.bg\}\}/,'retain olive-green primary feed');
console.log('Offline decorative assets, lightweight gallery thumbnails, media cache and feed playback checks passed.');
