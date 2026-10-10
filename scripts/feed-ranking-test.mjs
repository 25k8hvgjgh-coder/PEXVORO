import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { createRequire } from 'node:module';
import vm from 'node:vm';

const requireMobile=createRequire(new URL('../mobile/package.json',import.meta.url));
const ts=requireMobile('typescript');
const transpile=async path=>ts.transpileModule(await readFile(new URL(path,import.meta.url),'utf8'),{
 compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2020}
}).outputText;
const helper={exports:{}};
vm.runInNewContext(await transpile('../mobile/contentSignals.ts'),{
 module:helper,exports:helper.exports,Date,Math,Number,String,Object,Array,Set,Map,RegExp
});
const module={exports:{}};
vm.runInNewContext(await transpile('../mobile/feedRanking.ts'),{
 module,exports:module.exports,require:(id)=>{if(id==='./contentSignals')return helper.exports;throw new Error('Unexpected module: '+id)},Date,Math,Number,String,Object,Array,Set,Map,RegExp
});
const {rankFeedPosts,topicTokens}=module.exports;
const {allowedForFeed,normalizeBlockedKeywords,parseCreatorTags}=helper.exports;
const now=Date.parse('2026-10-10T12:00:00Z');
const post=(id,user_id,caption,minsAgo=10)=>({id,user_id,caption,created_at:new Date(now-minsAgo*60000).toISOString(),likes:[{count:0}],comments:[{count:0}]});
const history=(post_id,event_type,watched_ms,duration_ms)=>({post_id,event_type,watched_ms,duration_ms,created_at:new Date(now-120000).toISOString()});
const base={mode:'For You',followingIds:[],likedPostIds:[],savedPostIds:[],hiddenIds:[],history:[],historyPosts:[],now};
assert(topicTokens('My #DieselTruck build and welding day').includes('trucks'));
assert(topicTokens('My #DieselTruck build and welding day').includes('trades'));
const truck=post('truck','a','Diesel truck build');
const dance=post('dance','b','Dance moves');
assert.equal(rankFeedPosts([dance,truck],base).length,2);
assert.equal(rankFeedPosts([truck,dance],base)[0].id,'truck'); // deterministic tie
const withWatch={...base,history:[history('old','watch',19500,20000)],historyPosts:[post('old','a','Diesel trucks and towing')]};
assert.equal(rankFeedPosts([dance,truck],withWatch)[0].id,'truck','Complete watches improve a related creator/topic');
const withSkip={...base,history:[history('old','watch',600,20000)],historyPosts:[post('old','a','Diesel trucks and towing')]};
assert.equal(rankFeedPosts([dance,truck],withSkip)[0].id,'dance','Fast skips lower related topic scores');
const followed={...base,mode:'Following',followingIds:['a']};
assert.deepEqual(Array.from(rankFeedPosts([truck,dance],followed).map(p=>p.id)),['truck'],'Following must never include non-followed creators');
const hidden={...base,hiddenIds:['truck']};
assert.deepEqual(Array.from(rankFeedPosts([truck,dance],hidden).map(p=>p.id)),['dance']);
const hiddenByEvent={...base,history:[history('truck','not_interested',0,0)]};
assert.deepEqual(Array.from(rankFeedPosts([truck,dance],hiddenByEvent).map(p=>p.id)),['dance']);
const saved={...base,savedPostIds:['old'],historyPosts:[post('old','a','Diesel towing garage')]};
assert.equal(rankFeedPosts([dance,truck],saved)[0].id,'truck','Saved stories influence recommendations');
const followAffinity={...base,followingIds:['a'],historyPosts:[post('followed-old','a','Diesel mechanics truck projects')]};
assert.equal(rankFeedPosts([dance,truck],followAffinity)[0].id,'truck','Following a creator should help identify interests when enabled');
assert.deepEqual(Array.from(normalizeBlockedKeywords(' #Diesel, military, diesel, #country-life ')),['diesel','military','country-life']);
assert.deepEqual(Array.from(parseCreatorTags('#Military, trucks, trucks')),['military','trucks']);
assert.equal(allowedForFeed({caption:'My military truck'}, {blockedKeywords:['military'],hideMatureContent:false},'For You'),false);
assert.equal(allowedForFeed({caption:'My MILITARY#Truck'}, {blockedKeywords:['military'],hideMatureContent:false},'For You'),false);
assert.equal(allowedForFeed({caption:'Supertrucks'}, {blockedKeywords:['truck'],hideMatureContent:false},'For You'),true);
assert.equal(allowedForFeed({caption:'A video',topic_tags:['outdoors']}, {blockedKeywords:['outdoors'],hideMatureContent:false},'Following'),false);
assert.equal(allowedForFeed({caption:'A video',audio_label:'Country Roads'}, {blockedKeywords:['country'],hideMatureContent:false},'For You'),false);
assert.equal(allowedForFeed({caption:'Hi',content_rating:'mature'}, {blockedKeywords:[],hideMatureContent:true},'For You'),false);
assert.equal(allowedForFeed({caption:'Hi',recommendation_status:'review'}, {blockedKeywords:[],hideMatureContent:false},'For You'),false);
assert.equal(allowedForFeed({caption:'Hi',recommendation_status:'review'}, {blockedKeywords:[],hideMatureContent:false},'Following'),true);
assert.deepEqual(Array.from(rankFeedPosts([{...truck,topic_tags:['welding']}],{...base,blockedKeywords:['welding']}).map(p=>p.id)),[]);
const candidates=Array.from({length:100},(_,i)=>post('id'+i,'creator'+i,'Country trucks welding tools '+i,i));
const started=performance.now();
const ranked=rankFeedPosts(candidates,base);
assert.equal(ranked.length,100);
assert.equal(new Set(ranked.map(p=>p.id)).size,100);
assert(performance.now()-started<2000,'Ranking 100 candidates should stay lightweight');
console.log('ReconFeed ranking passed: watch completion, skip, follow-only, saved affinity, hide and 100-item performance.');
