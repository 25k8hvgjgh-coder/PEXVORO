// ReconFeed private command center API.
// No user-management data is returned until Supabase verifies the requester's
// signed-in identity AND the owner-only app_metadata permission.
const DEFAULT_URL='https://ojprsyvkzgyphpsvksgx.supabase.co';
const DEFAULT_ANON='sb_publishable_mhVX66Gl1F0x6WMgORilRw_QWjOrusW';
const UUID=/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const STATUSES=new Set(['open','triaged','in_progress','fixed','closed']);
const trim=text=>String(text||'').trim();
function send(res,status,body){
 res.status(status).json(body);
}
async function request(url,options={}){
 return fetch(url,{...options,signal:AbortSignal.timeout(9000)});
}
const getConfig=()=>({
 url:/^https:\/\/[a-z0-9-]+\.supabase\.co$/i.test(trim(process.env.SUPABASE_URL))?trim(process.env.SUPABASE_URL):DEFAULT_URL,
 anon:trim(process.env.SUPABASE_ANON_KEY)||DEFAULT_ANON,
 service:trim(process.env.SUPABASE_SERVICE_ROLE_KEY)
});
async function rest(cfg,path,init={}){
 const response=await request(cfg.url+'/rest/v1/'+path,{
  ...init,
  headers:{
   apikey:cfg.service,
   Authorization:'Bearer '+cfg.service,
   Accept:'application/json',
   ...(init.headers||{})
  }
 });
 if(!response.ok)throw new Error('Database request failed: '+response.status);
 return response;
}
async function rows(cfg,path){
 const response=await rest(cfg,path);
 return response.json();
}
async function count(cfg,table,filter=''){
 const response=await rest(cfg,table+'?select=id&limit=1'+filter,{headers:{Prefer:'count=exact'}});
 const range=response.headers.get('content-range')||'';
 const last=range.split('/')[1]||'0';
 const result=Number(last);
 return Number.isFinite(result)?result:0;
}
async function authenticate(req,cfg){
 const header=trim(req.headers.authorization);
 if(!/^Bearer\s+[A-Za-z0-9._~-]+$/i.test(header))return null;
 const token=header.replace(/^Bearer\s+/i,'');
 const response=await request(cfg.url+'/auth/v1/user',{headers:{
  apikey:cfg.anon,Authorization:'Bearer '+token
 }});
 if(!response.ok)return null;
 const person=await response.json();
 if(!person||!UUID.test(person.id)||!person.email_confirmed_at||
    person.app_metadata?.reconfeed_command_center_admin!==true)return null;
 return {id:person.id};
}
async function signScreenshot(cfg,recordId){
 const found=await rows(cfg,'tester_issues?select=id,screenshot_path&id=eq.'+recordId+'&limit=1');
 const item=found?.[0];
 if(!item?.screenshot_path)return null;
 // Reject invalid storage paths even though they came from the database.
 const parts=String(item.screenshot_path).split('/');
 if(!parts.length||parts.some(s=>!s||s==='.'||s==='..'))throw new Error('Invalid image path');
 const key=parts.map(encodeURIComponent).join('/');
 const res=await request(cfg.url+'/storage/v1/object/sign/tester-screenshots/'+key,{
  method:'POST',
  headers:{apikey:cfg.service,Authorization:'Bearer '+cfg.service,'Content-Type':'application/json'},
  body:JSON.stringify({expiresIn:120})
 });
 if(!res.ok)throw new Error('Screenshot could not be signed');
 const response=await res.json();
 const signed=response?.signedURL||response?.signedUrl;
 if(typeof signed!=='string'||!signed.startsWith('/'))throw new Error('Invalid screenshot response');
 return cfg.url+'/storage/v1'+signed;
}
async function overview(cfg){
 const now=encodeURIComponent(new Date().toISOString());
 const tasks=[
  count(cfg,'profiles'),count(cfg,'posts','&visibility=eq.public'),
  count(cfg,'stories','&expires_at=gt.'+now),
  count(cfg,'direct_messages'),count(cfg,'tester_issues'),
  count(cfg,'reconfeed_beta_testers'),
  count(cfg,'reconfeed_research_responses'),
  count(cfg,'post_reports'),count(cfg,'marketplace_listing_reports'),
  rows(cfg,'tester_issues?select=id,title,category,description,steps_to_reproduce,platform,status,created_at,updated_at,screenshot_path&order=updated_at.desc&limit=75'),
  rows(cfg,'reconfeed_beta_testers?select=id,email,platform,status,interests,contact_consent,created_at&order=created_at.desc&limit=50'),
  rows(cfg,'post_reports?select=id,post_id,reason,created_at&order=created_at.desc&limit=35'),
  rows(cfg,'marketplace_listing_reports?select=id,listing_id,reason,created_at&order=created_at.desc&limit=35')
 ];
 const results=await Promise.all(tasks);
 const [profiles,posts,stories,messages,issuesCount,testers,research,postReports,listingReports,issues,applications,moderationPosts,moderationListings]=results;
 return {
  generatedAt:new Date().toISOString(),
  counts:{profiles,posts,stories,messages,issues:issuesCount,testers,research,postReports,listingReports},
  issues:issues.map(({screenshot_path,...issue})=>({...issue,hasScreenshot:Boolean(screenshot_path)})),
  applications:applications.filter(item=>item.contact_consent===true).map(({contact_consent,...row})=>row),
  moderation:{posts:moderationPosts,listings:moderationListings},
  notice:'Counts are real database records, not online users. Messages are counted only: message contents and private account information are never included.'
 };
}
export default async function handler(req,res){
 res.setHeader('Content-Type','application/json; charset=utf-8');
 res.setHeader('Cache-Control','private, no-store, max-age=0');
 res.setHeader('Pragma','no-cache');
 res.setHeader('Vary','Authorization');
 res.setHeader('X-Content-Type-Options','nosniff');
 res.setHeader('X-Robots-Tag','noindex, nofollow, noarchive');
 if(!['GET','POST'].includes(req.method)){
  res.setHeader('Allow','GET, POST');
  return send(res,405,{error:'Method not allowed'});
 }
 const cfg=getConfig();
 if(!cfg.service)return send(res,503,{error:'The command center data connection is not configured.'});
 let admin;
 try{admin=await authenticate(req,cfg)}catch{return send(res,503,{error:'Could not verify your session. Try again.'})}
 // Deny both ordinary accounts and unauthenticated clients. A browser UI,
 // a profile nickname, or user_metadata can never grant administrative access.
 if(!admin)return send(res,403,{error:'A verified ReconFeed command-center account is required.'});
 try{
  if(req.method==='GET'){
   if(req.query?.action==='screenshot'){
    const id=String(req.query.id||'');
    if(!UUID.test(id))return send(res,400,{error:'Invalid report identifier'});
    const url=await signScreenshot(cfg,id);
    return url?send(res,200,{url,expiresIn:120}):send(res,404,{error:'No screenshot on this report'});
   }
   if(req.query?.action&&req.query.action!=='overview')return send(res,400,{error:'Unknown action'});
   return send(res,200,await overview(cfg));
  }
  // Writes only originate from the same host as the dashboard, in addition to
  // requiring an owner's verified bearer session.
  const origin=trim(req.headers.origin),host=trim(req.headers.host);
  if(!origin||!host){
   return send(res,403,{error:'This action must be performed from ReconFeed.'});
  }
  let target;
  try{target=new URL(origin)}catch{return send(res,403,{error:'Invalid origin'})}
  if(target.protocol!=='https:'||target.host!==host)return send(res,403,{error:'Origin not allowed'});
  if(Number(req.headers['content-length']||0)>4096)return send(res,413,{error:'Request too large'});
  const body=typeof req.body==='string'?JSON.parse(req.body):req.body||{};
  if(body?.action!=='set_report_status'||!UUID.test(String(body.id||''))||!STATUSES.has(body.status))
   return send(res,400,{error:'Invalid report update'});
  const id=String(body.id),status=body.status;
  const updated=await rest(cfg,'tester_issues?id=eq.'+id,{
   method:'PATCH',
   headers:{'Content-Type':'application/json',Prefer:'return=representation'},
   body:JSON.stringify({status,updated_at:new Date().toISOString()})
  });
  const changed=await updated.json();
  if(!Array.isArray(changed)||changed.length!==1)return send(res,404,{error:'Report not found'});
  // Don't return the private reporter's identity or attached screenshot path.
  return send(res,200,{updated:true,id,status,updatedAt:changed[0].updated_at});
 }catch(e){
  console.warn('Command center request unavailable',String(e?.message||e).slice(0,130));
  return send(res,503,{error:'Command center data is temporarily unavailable. Please retry.'});
 }
}
