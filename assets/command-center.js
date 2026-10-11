'use strict';
// Tokens stay in this browser tab's memory. Private records are fetched only
// through server-side authorization. Render untrusted text with textContent.
(()=>{
 const el=id=>document.getElementById(id),make=(tag,cls='',txt)=>{const n=document.createElement(tag);n.className=cls;if(txt!==undefined)n.textContent=String(txt);return n;};
 const add=(parent,...kids)=>{for(const child of kids)if(child)parent.appendChild(child);return parent;};
 const statuses=['open','triaged','in_progress','fixed','closed'];
 const labels={open:'Open',triaged:'Triaged',in_progress:'In progress',fixed:'Fixed',closed:'Closed'};
 const pages={overview:['Your operation.','One clear view.','Real reports, real testers and the information you need to build a stronger ReconFeed.'],reports:['Tester reports.','Every issue counts.','Review screenshots and track progress toward working fixes.'],testers:['Your beta community.','Growing together.','Real tester applications from the ReconFeed website.'],feedback:['Community feedback.','Build what matters.','Actual research responses and feature ideas from verified app users.'],moderation:['Community reports.','Make it safer.','Handle content flags without exposing anyone’s private conversations.'],systems:['Systems & security.','Stay in control.','Check service health and see the security safeguards that need attention.']};
 const state={config:null,session:null,data:null,page:'overview',busy:false,lastTouch:Date.now()};
 const fmtDate=v=>{const d=new Date(v);return Number.isNaN(d.valueOf())?'Unknown time':new Intl.DateTimeFormat(undefined,{dateStyle:'medium',timeStyle:'short'}).format(d);};
 const num=v=>Math.max(0,Number(v)||0).toLocaleString();
 const pill=value=>make('span','pill '+(statuses.includes(value)?value:''),labels[value]||String(value||'Unknown'));
 const error=(id,message)=>{const x=el(id);x.textContent=message||'';x.hidden=!message};
 const empty=message=>make('p','empty',message);
 function signOut(reason=''){
  if(state.session){state.session.access_token='';state.session.refresh_token='';}
  state.session=null;state.data=null;
  el('login-panel').hidden=false;el('owner-dashboard').hidden=true;el('sign-out').hidden=true;
  el('report-modal').hidden=true;el('refresh').disabled=true;el('owner-password').value='';
  el('last-sync').textContent='Not connected';error('dashboard-error','');error('login-error',reason);
 }
 async function config(){
  if(state.config)return state.config;
  const response=await fetch('/api/config',{cache:'no-store'});
  if(!response.ok)throw Error('ReconFeed account configuration is unavailable.');
  const v=await response.json(),url=new URL(v.url);
  if(url.protocol!=='https:'||!url.hostname.endsWith('.supabase.co')||!v.anonKey)throw Error('Account configuration is invalid.');
  return state.config={url:url.origin,key:v.anonKey};
 }
 async function refreshAccess(){
  const c=await config(),session=state.session;
  if(!session?.refresh_token)throw Error('Your owner session has expired.');
  const response=await fetch(c.url+'/auth/v1/token?grant_type=refresh_token',{method:'POST',headers:{apikey:c.key,'Content-Type':'application/json'},body:JSON.stringify({refresh_token:session.refresh_token}),cache:'no-store'});
  if(!response.ok)throw Error('Your session expired. Please sign in again.');
  const body=await response.json();
  if(!body.access_token||!body.refresh_token)throw Error('Could not renew the session.');
  state.session={access_token:body.access_token,refresh_token:body.refresh_token,expires:Date.now()+(Number(body.expires_in)||3600)*1000};
 }
 async function api(path='',options={}){
  if(!state.session)throw Error('Please sign in.');
  if(Date.now()>state.session.expires-60000)await refreshAccess();
  const r=await fetch('/api/command-center'+path,{...options,cache:'no-store',headers:{Authorization:'Bearer '+state.session.access_token,...(options.body?{'Content-Type':'application/json'}:{}),...(options.headers||{})}});
  let data={};try{data=await r.json()}catch{}
  if(r.status===401||r.status===403)throw Error('Only the verified ReconFeed owner account can access this command center.');
  if(!r.ok)throw Error(data.error||'Private data service is unavailable.');
  return data;
 }
 async function login(event){
  event.preventDefault();if(state.busy)return;
  state.busy=true;const button=el('login-button');button.disabled=true;button.textContent='Verifying owner access…';error('login-error','');
  try{
   const c=await config();
   const response=await fetch(c.url+'/auth/v1/token?grant_type=password',{method:'POST',headers:{apikey:c.key,'Content-Type':'application/json'},body:JSON.stringify({email:el('owner-email').value.trim(),password:el('owner-password').value}),cache:'no-store'});
   el('owner-password').value='';
   if(!response.ok)throw Error('Sign in failed. Check your credentials.');
   const body=await response.json();
   if(!body.access_token||!body.refresh_token)throw Error('The session was not established.');
   state.session={access_token:body.access_token,refresh_token:body.refresh_token,expires:Date.now()+(Number(body.expires_in)||3600)*1000};
   state.data=await api('?action=overview');
   el('login-panel').hidden=true;el('owner-dashboard').hidden=false;el('sign-out').hidden=false;el('refresh').disabled=false;
   state.lastTouch=Date.now();render();page('overview');void health();
  }catch(e){signOut(e.message||'Sign in is temporarily unavailable.')}
  finally{state.busy=false;button.disabled=false;button.textContent='Sign in securely ↗';el('owner-password').value='';}
 }
 async function reload(){
  if(state.busy||!state.session)return;
  state.busy=true;const button=el('refresh');button.disabled=true;button.textContent='Refreshing…';
  try{state.data=await api('?action=overview');error('dashboard-error','');render();}
  catch(e){error('dashboard-error',e.message);if(/owner|session|sign in/i.test(e.message))signOut(e.message);}
  finally{state.busy=false;button.disabled=false;button.textContent='↻ Refresh';}
 }
 function page(name){
  if(!pages[name]||el('owner-dashboard').hidden)return;
  state.page=name;
  for(const node of document.querySelectorAll('.screen'))node.hidden=node.id!=='screen-'+name;
  for(const nav of document.querySelectorAll('.nav-link')){nav.classList.toggle('is-active',nav.dataset.screen===name);nav.setAttribute('aria-current',nav.dataset.screen===name?'page':'false');}
  const [heading,accent,description]=pages[name];
  el('screen-title').replaceChildren(document.createTextNode(heading),' ',make('em','',accent));
  el('screen-description').textContent=description;
  el('current-location').textContent=({overview:'Overview',reports:'Tester reports',testers:'Beta testers',feedback:'Feedback & research',moderation:'Moderation',systems:'Systems & security'})[name];
  el('sidebar').classList.remove('is-open');
  if(name==='systems')void health();
 }
 function render(){
  const d=state.data;if(!d)return;
  const metrics=el('metrics');metrics.replaceChildren();
  const stats=[['profiles','Creator accounts'],['posts','Public posts'],['stories','Active Stories'],['issues','Tester reports'],['testers','Beta signups'],['messages','Private messages'],['postReports','Post flags'],['listingReports','Listing flags']];
  stats.forEach(([key,label])=>{
   const card=make('div','metric');
   add(card,make('span','metric-title',label),make('strong','metric-value',num(d.counts[key])),make('span','metric-foot',key==='messages'?'Count only · contents private':'Live database total'));
   metrics.appendChild(card);
  });
  el('report-counter').textContent=num(d.counts.issues);
  el('last-sync').textContent='Updated '+fmtDate(d.generatedAt);
  el('data-status').textContent='Live snapshot · '+fmtDate(d.generatedAt);
  overview();reports();testers();feedback();moderation();
 }
 function overview(){
  const issues=state.data.issues||[];
  const summary=el('issue-summary');summary.replaceChildren();
  for(const s of statuses)summary.appendChild(make('span','pill '+s,labels[s]+' · '+num(issues.filter(i=>i.status===s).length)));
  const recent=el('recent-issues');recent.replaceChildren();
  if(!issues.length)recent.appendChild(empty('No tester reports yet.'));
  for(const issue of issues.slice(0,5)){
   const button=make('button','issue-mini');button.type='button';
   const label=make('span');
   add(label,make('strong','',issue.title||'Untitled issue'),make('small','',(issue.platform||'Other device')+' · '+fmtDate(issue.updated_at||issue.created_at)));
   add(button,label,pill(issue.status),make('span','chevron','›'));
   button.addEventListener('click',()=>openReport(issue));recent.appendChild(button);
  }
  const activity=el('live-activity');activity.replaceChildren();
  for(const [label,key] of [['Registered creator profiles','profiles'],['Published public posts','posts'],['Active Stories','stories'],['Direct messages (count only)','messages'],['Research responses','research'],['Beta applications','testers']])
   add(activity,add(make('div','activity-row'),make('span','',label),make('strong','',num(state.data.counts[key]))));
 }
 function reports(){
  const list=el('report-list');list.replaceChildren();const filter=el('issue-filter').value,query=el('issue-search').value.trim().toLowerCase();
  const found=(state.data.issues||[]).filter(issue=>(filter==='all'||issue.status===filter)&&(!query||[issue.title,issue.description,issue.steps_to_reproduce,issue.platform,issue.category].join(' ').toLowerCase().includes(query)));
  if(!found.length){list.appendChild(empty('No issues match your selection.'));return;}
  for(const issue of found){
   const row=make('button','report-row');row.type='button';
   const details=add(make('div','report-left'),make('h3','',issue.title||'Untitled report'),make('p','',(issue.platform||'Unknown platform')+' · '+(issue.category||'Feedback')+(issue.hasScreenshot?' · Screenshot attached':'')));
   const meta=add(make('div','right-column'),pill(issue.status),make('small','',fmtDate(issue.updated_at||issue.created_at)));
   add(row,details,meta);row.addEventListener('click',()=>openReport(issue));list.appendChild(row);
  }
 }
 function testers(){
  const list=el('tester-list');list.replaceChildren();
  if(!state.data.applications?.length){list.appendChild(empty('No consented applications yet.'));return;}
  for(const person of state.data.applications){
   const info=add(make('div'),make('span','label','BETA APPLICATION'),make('h3','',person.email||'Email unavailable'),make('p','',(person.platform||'Unspecified platform')+' · '+fmtDate(person.created_at)));
   if(person.interests)add(info,make('p','',Array.isArray(person.interests)?person.interests.join(', '):person.interests));
   add(list,add(make('div','data-row'),info,make('span','pill',person.status||'pending')));
  }
 }
 function feedback(){
  const list=el('survey-feedback');list.replaceChildren();
  const records=state.data?.feedback||[];
  el('feedback-count').textContent=num(records.length)+' most recent';
  if(!records.length){list.appendChild(empty('No completed research surveys yet. Testers can answer the in-app survey to share their ideas.'));return;}
  records.forEach(item=>{
   const row=make('div','data-row'),info=make('div');
   add(info,make('span','label','COMMUNITY FEEDBACK · '+fmtDate(item.created_at)),
    make('h3','',item.biggest_need||'No written feature request'),
    make('p','',Array.isArray(item.feature_interests)?'Interested in: '+item.feature_interests.join(', '):'No feature interests selected'),
    make('p','',('Price: '+(item.monthly_price||'Not given'))+' · '+('Creator preference: '+(item.identity_mode||'Not selected'))));
   add(row,info,make('span','pill',item.willing_to_test?'Available to test':'Not currently testing'));list.appendChild(row);
  });
 }
 function moderation(){
  for(const [id,key,field] of [['post-flags','posts','post_id'],['listing-flags','listings','listing_id']]){
   const list=el(id);list.replaceChildren();
   if(!state.data.moderation?.[key]?.length){list.appendChild(empty('No submitted reports.'));continue;}
   for(const item of state.data.moderation[key]){
    const detail=add(make('div'),make('span','label',key==='posts'?'REPORTED POST':'REPORTED LISTING'),make('h3','',item.reason||'Report'),make('p','',fmtDate(item.created_at)+' · '+String(item[field]||'').slice(0,8)));
    add(list,add(make('div','data-row'),detail));
   }
  }
 }
 function closeReport(){el('report-modal').hidden=true;el('modal-body').replaceChildren();}
 function openReport(issue){
  const body=el('modal-body');body.replaceChildren();el('modal-title').textContent=issue.title||'Report details';
  const group=add(make('div','report-meta'),pill(issue.status),make('span','pill',issue.platform||'Unknown device'),make('span','pill',issue.category||'Feedback'));
  add(body,group,make('div','detail-label','DESCRIPTION'),make('div','detail-text',issue.description||'No description provided.'));
  if(issue.steps_to_reproduce)add(body,make('div','detail-label','STEPS TO REPRODUCE'),make('div','detail-text',issue.steps_to_reproduce));
  add(body,make('div','detail-label','REPORTED'),make('div','detail-text',fmtDate(issue.created_at)),make('div','detail-label','REPORT ID'),make('div','detail-text',issue.id));
  if(issue.hasScreenshot){
   const button=make('button','screenshot-button','View private screenshot');button.type='button';
   button.addEventListener('click',async()=>{
    button.disabled=true;button.textContent='Loading…';
    try{
     const data=await api('?action=screenshot&id='+encodeURIComponent(issue.id));
     const url=new URL(data.url);
     if(url.protocol!=='https:'||!url.hostname.endsWith('.supabase.co'))throw Error('Screenshot URL is invalid.');
     const image=make('img','attachment');image.alt='Screenshot attached to '+(issue.title||'report');image.src=url.href;
     image.addEventListener('error',()=>{button.disabled=false;button.textContent='Screenshot unavailable. Retry';image.remove();});
     add(body,image);button.remove();
    }catch(e){button.disabled=false;button.textContent='Unable to open screenshot. Retry';error('dashboard-error',e.message);}
   });
   add(body,button);
  }
  add(body,make('hr','divider'),make('div','detail-label','UPDATE REPORT STATUS'));
  const controls=make('div','status-controls');add(body,controls);
  for(const status of statuses){
   const button=make('button','status-button'+(issue.status===status?' selected':''),labels[status]);button.type='button';button.disabled=issue.status===status;
   button.addEventListener('click',async()=>{
    controls.querySelectorAll('button').forEach(b=>b.disabled=true);
    try{
     await api('',{method:'POST',body:JSON.stringify({action:'set_report_status',id:issue.id,status})});
     closeReport();await reload();
    }catch(e){error('dashboard-error',e.message);controls.querySelectorAll('button').forEach(b=>b.disabled=false);}
   });
   controls.appendChild(button);
  }
  el('report-modal').hidden=false;el('modal-close').focus();
 }
 async function health(){
  const list=el('service-health');if(!list)return;
  list.replaceChildren(make('p','muted','Checking service availability…'));
  try{
   const response=await fetch('/api/health',{cache:'no-store'});
   if(!response.ok)throw Error('Health endpoint unreachable');
   const data=await response.json(),checks=data.checks||{};list.replaceChildren();
   for(const [label,value] of [['Public website service',data.status==='online'],['Supabase database',checks.supabase?.profilesTableAccessible],['AI integration configured',checks.aiConfigured],['Payments configured',checks.paymentsConfigured]]){
    add(list,add(make('div','activity-row'),make('span','',label),make('strong','',value?'Reported ready':'Needs attention')));
   }
   if(checks.aiMissingConfiguration?.length)add(list,make('p','muted','Missing server configuration names: '+checks.aiMissingConfiguration.join(', ')));
  }catch{list.replaceChildren(empty('Could not check service status. Try again.'));}
 }
 el('login-form').addEventListener('submit',login);el('refresh').addEventListener('click',reload);
 el('sign-out').addEventListener('click',()=>signOut());
 el('navigation').addEventListener('click',e=>{const button=e.target.closest('[data-screen]');if(button)page(button.dataset.screen);});
 document.querySelectorAll('[data-screen]:not(.nav-link)').forEach(button=>button.addEventListener('click',()=>page(button.dataset.screen)));
 el('issue-filter').addEventListener('change',()=>{if(state.data)reports()});
 el('issue-search').addEventListener('input',()=>{if(state.data)reports()});
 el('menu-toggle').addEventListener('click',()=>el('sidebar').classList.toggle('is-open'));
 el('health-refresh').addEventListener('click',health);
 el('modal-close').addEventListener('click',closeReport);el('modal-backdrop').addEventListener('click',closeReport);
 document.addEventListener('keydown',e=>{if(e.key==='Escape')closeReport()});
 document.addEventListener('pointerdown',()=>{state.lastTouch=Date.now()},true);
 document.addEventListener('keydown',()=>{state.lastTouch=Date.now()},true);
 // Short-lived private session in this tab. No persistent token storage.
 document.addEventListener('visibilitychange',()=>{if(!document.hidden&&state.session&&Date.now()-state.lastTouch>25*60*1000)signOut('Your command center was locked after being inactive.')});
 window.setInterval(()=>{if(state.session&&Date.now()-state.lastTouch>25*60*1000)signOut('Signed out due to inactivity.')},60000);
})();
