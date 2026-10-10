// ReconFeed private event delivery: batch watch signals instead of one database write per swipe.
// Persistent queue is keyed to the authenticated account, capped to protect device storage.
export type FeedQueueRow={
 user_id:string;post_id:string;event_type:'watch'|'share'|'not_interested';
 watched_ms:number;duration_ms:number;
};
export type QueueStorage={
 getItem(key:string):Promise<string|null>;
 setItem(key:string,value:string):Promise<unknown>;
 removeItem(key:string):Promise<unknown>;
};
export type FeedQueueDeps={
 userId:string;storage:QueueStorage;
 insert:(events:FeedQueueRow[])=>Promise<{error?:{message?:string}|null}>;
};
const limit=100;
const keyFor=(id:string)=>'reconfeed_feed_queue_v1_'+id;
const safe=(n:number)=>Math.max(0,Math.min(3600000,Math.round(Number.isFinite(n)?n:0)));
export function createFeedEventQueue({userId,storage,insert}:FeedQueueDeps){
 let pending:FeedQueueRow[]=[];
 let sending=false;
 let hydrated=false;
 let dirty=false;
 let disposed=false;
 let pendingWrite=Promise.resolve();
 const persist=()=>{
  const snapshot=JSON.stringify(pending.slice(-limit));
  pendingWrite=pendingWrite.catch(()=>{}).then(async()=>{
   if(snapshot==='[]')await storage.removeItem(keyFor(userId));
   else await storage.setItem(keyFor(userId),snapshot);
  });
  return pendingWrite;
 };
 const enqueue=(postId:string,eventType:FeedQueueRow['event_type'],watchedMs=0,durationMs=0)=>{
  if(disposed||!postId||!userId)return;
  pending.push({user_id:userId,post_id:postId,event_type:eventType,watched_ms:safe(watchedMs),duration_ms:safe(durationMs)});
  if(pending.length>limit)pending=pending.slice(-limit);
  dirty=true;
  void persist().catch(()=>{});
 };
 const hydrate=async()=>{
  if(hydrated||disposed)return;
  try{
   // Persisted events may have been left behind after an app restart.
   // Never mix records belonging to a different account.
   const value=await storage.getItem(keyFor(userId));
   const rows=JSON.parse(value||'[]');
   const restored=Array.isArray(rows)?rows.filter(r=>
    r&&r.user_id===userId&&typeof r.post_id==='string'&&['watch','share','not_interested'].includes(r.event_type)
   ).slice(-limit).map(r=>({
    user_id:userId,post_id:r.post_id,event_type:r.event_type,
    watched_ms:safe(Number(r.watched_ms)),duration_ms:safe(Number(r.duration_ms))
   })):[] as FeedQueueRow[];
   if(disposed)return;
   if(!dirty)pending=restored;
   else pending=[...restored,...pending].slice(-limit);
  }catch(_error){/* A corrupt local queue must not stop the feed. */}
  hydrated=true;
  if(dirty)void persist().catch(()=>{});
 };
 const flush=async()=>{
  if(disposed||sending)return false;
  if(!hydrated)await hydrate();
  if(disposed||sending||!pending.length)return true;
  sending=true;
  const batch=pending.slice(0,20);
  try{
   const result=await insert(batch);
   if(result.error)return false; // Keep batch to retry after network recovery.
   pending=pending.slice(batch.length);
   dirty=true;
   await persist().catch(()=>{});
   return true;
  }catch(_error){return false}
  finally{sending=false}
 };
 const clear=async()=>{
  pending=[];
  dirty=true;
  await persist().catch(()=>{});
 };
 const dispose=()=>{disposed=true;pending=[]};
 return {enqueue,hydrate,flush,clear,dispose,size:()=>pending.length};
}
