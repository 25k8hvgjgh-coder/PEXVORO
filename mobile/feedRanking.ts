// ReconFeed adaptive ranking v2. Stateless, deterministic and device-friendly.
import {allowedForFeed,contentSearchText,type DiscoverablePost} from './contentSignals';
// Signals originate from the authenticated user's own watch events, follows and saved/liked posts.
export type FeedEvent = {
 post_id:string;
 event_type:'watch'|'share'|'not_interested';
 watched_ms:number;
 duration_ms:number;
 created_at:string;
};
export type RankablePost = DiscoverablePost & {
 id:string;user_id:string;caption:string;created_at:string;format?:string;
 likes?:Array<{count:number}>;comments?:Array<{count:number}>;
};
type HistoricalPost=DiscoverablePost & {id:string;user_id:string;caption:string;format?:string};
export type RankingContext={
 mode:'For You'|'Following';
 followingIds:string[];
 likedPostIds:string[];
 savedPostIds:string[];
 hiddenIds:string[];
 blockedKeywords?:string[];
 hideMatureContent?:boolean;
 history:FeedEvent[];
 historyPosts:HistoricalPost[];
 now?:number;
};
const topicAliases:Record<string,string[]>={
 military:['veteran','military','army','navy','marine','soldier','airforce','service','uniform','deployment'],
 trucks:['truck','diesel','pickup','lifted','towing','4x4','offroad','ram1500'],
 trades:['weld','fabricat','mechanic','construction','carpent','electrician','tool','repair','build','garage'],
 country:['country','ranch','farm','rodeo','rural','barn','homestead'],
 outdoor:['outdoor','camp','fish','hunt','hiking','trail','mountain','adventure'],
 motors:['engine','motor','car','auto','projectcar','restoration','racing'],
 fitness:['fitness','gym','workout','lifting','exercise'],
 creators:['creator','camera','editing','film','video','tutorial','howto'],
};
const stopWords=new Set(['this','that','with','from','have','there','about','would','should','some','more','they','then','their','what','when','just','these','those','your','been','were','will','into','here','than','hello']);
export function topicTokens(input:string):string[]{
 const text=String(input||'').toLowerCase();
 const raw=text.match(/[a-z0-9#]+/g)||[];
 const found=new Set<string>();
 for(const [topic,aliases] of Object.entries(topicAliases))if(aliases.some(a=>raw.some(w=>w.replace(/^#/,'').startsWith(a))))found.add(topic);
 for(const w of raw){if(w.startsWith('#')&&w.length>=4)found.add(w.slice(1));else if(w.length>=5&&!stopWords.has(w))found.add(w)}
 return [...found].slice(0,20);
}
const bounded=(value:number,min:number,max:number)=>Math.max(min,Math.min(max,Number.isFinite(value)?value:0));
export function rankFeedPosts<T extends RankablePost>(candidates:T[],ctx:RankingContext):T[]{
 const now=ctx.now??Date.now();
 const following=new Set(ctx.followingIds);
 const liked=new Set(ctx.likedPostIds);
 const saved=new Set(ctx.savedPostIds);
 const hidden=new Set(ctx.hiddenIds);
 const meta=new Map(ctx.historyPosts.map(p=>[p.id,p]));
 for(const p of candidates)meta.set(p.id,p);
 const topical=new Map<string,number>();
 const creators=new Map<string,number>();
 const views=new Map<string,number>();
 const bump=(m:Map<string,number>,k:string,v:number)=>m.set(k,bounded((m.get(k)||0)+v,-16,24));
 for(const e of ctx.history.slice(0,180)){
  if(e.event_type==='not_interested'){hidden.add(e.post_id)}
  const p=meta.get(e.post_id);
  const days=bounded((now-new Date(e.created_at).getTime())/86400000,0,365);
  const freshness=Math.max(.18,Math.pow(.5,days/24));
  let value=0;
  if(e.event_type==='share')value=5;
  else if(e.event_type==='not_interested')value=-7;
  else {
   const ratio=e.duration_ms>0?bounded(e.watched_ms/e.duration_ms,0,2):0;
   // Watch duration and completion drive the strongest preference signal.
   value=ratio>=.9?4.8:ratio>=.6?2.2:ratio>=.3?.65:ratio>0? -1.8:0;
   bump(views,e.post_id,1);
  }
  if(!p)continue;
  bump(creators,p.user_id,value*freshness);
  for(const topic of topicTokens(contentSearchText(p)))bump(topical,topic,value*freshness);
 }
 for(const p of meta.values()){
  // Following somebody is a weak topic-interest signal, even if their videos have not yet been watched.
  // Avoid directly training on candidate posts solely because they're shown in the current feed.
  if(following.has(p.user_id)&&ctx.historyPosts.some(h=>h.id===p.id)){
   bump(creators,p.user_id,.4);
   for(const topic of topicTokens(contentSearchText(p)))bump(topical,topic,.24);
  }
  const extra=(liked.has(p.id)?3.5:0)+(saved.has(p.id)?4.5:0);
  if(extra){bump(creators,p.user_id,extra);for(const topic of topicTokens(contentSearchText(p)))bump(topical,topic,extra)}
 }
 const scored=candidates.filter(p=>!hidden.has(p.id)&&(ctx.mode!=='Following'||following.has(p.user_id))&&allowedForFeed(p,{blockedKeywords:ctx.blockedKeywords||[],hideMatureContent:!!ctx.hideMatureContent},ctx.mode)).map(post=>{
  const hours=bounded((now-new Date(post.created_at).getTime())/3600000,0,100000);
  const freshness=3.5/(1+hours/36);
  const likes=bounded(Number(post.likes?.[0]?.count||0),0,100000000);
  const comments=bounded(Number(post.comments?.[0]?.count||0),0,100000000);
  const engagement=Math.log1p(likes+comments*2)*.65;
  const topicalMatch=topicTokens(contentSearchText(post)).reduce((sum,t)=>sum+bounded(topical.get(t)||0,-9,13),0);
  const interests=bounded(topicalMatch,-12,14)*.8;
  const creatorAffinity=bounded(creators.get(post.user_id)||0,-12,18)*.7;
  const watchCount=views.get(post.id)||0;
  const alreadySeen=watchCount>0?Math.min(2.5,watchCount*1.1):0;
  const follows=following.has(post.user_id);
  const followsBonus=follows? (ctx.mode==='Following'?3:2):0;
  const directActions=(liked.has(post.id)?0.2:0)+(saved.has(post.id)?0.4:0);
  return {post,score:freshness+engagement+interests+creatorAffinity+followsBonus+directActions-alreadySeen};
 }).sort((a,b)=>b.score-a.score||(b.post.created_at.localeCompare(a.post.created_at)));
 // Diversify the For You feed: every seventh video can be a fresh creator/topic discovery.
 if(ctx.mode==='For You'&&scored.length>=8){
  const explored:typeof scored=[];
  const remaining=[...scored];
  const creatorCounts=new Map<string,number>();
  while(remaining.length){
   let take=0;
   if(explored.length%7===6){
    const candidate=remaining.findIndex(x=>!following.has(x.post.user_id)&&!views.has(x.post.id)&&(creatorCounts.get(x.post.user_id)||0)<2);
    if(candidate>=0)take=candidate;
   }else if((creatorCounts.get(remaining[0].post.user_id)||0)>=2){
    const diverse=remaining.findIndex(x=>(creatorCounts.get(x.post.user_id)||0)<2);
    if(diverse>=0)take=diverse;
   }
   const [item]=remaining.splice(take,1);
   explored.push(item);
   creatorCounts.set(item.post.user_id,(creatorCounts.get(item.post.user_id)||0)+1);
  }
  return explored.map(x=>x.post);
 }
 return scored.map(x=>x.post);
}
