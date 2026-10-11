import React,{useCallback,useEffect,useRef,useState} from 'react';
import {ActivityIndicator,Image,Modal,Pressable,SafeAreaView,ScrollView,Text,View} from 'react-native';
import type {SupabaseClient} from '@supabase/supabase-js';
import {olive} from './oliveTheme';

type Summary={
 issues_total:number;issues_open:number;issues_in_progress:number;issues_fixed:number;
 issues_with_screenshot:number;latest_issue_at?:string|null;tester_signups:number;
 latest_signup_at?:string|null;surveys_total:number;registered_accounts:number;
 public_posts:number;active_stories:number;
 recent_signups?:{email:string;platform:string;status:string;created_at:string}[];
 recent_feedback?:{biggest_need:string;feature_interests?:string[];willing_to_test:boolean;created_at:string}[];
};
type Issue={id:string;category:string;title:string;description:string;steps_to_reproduce?:string;
 platform:string;status:string;created_at:string;updated_at:string;screenshot_path?:string|null};
type Props={client:SupabaseClient;visible:boolean;onClose:()=>void;onReport:()=>void};
const statuses=['open','triaged','in_progress','fixed','closed'];
const formatTime=(v?:string|null)=>v?new Date(v).toLocaleString():'None yet';
const cap=(n?:number)=>Number(n||0).toLocaleString();
const chip={paddingHorizontal:13,paddingVertical:9,borderRadius:16,borderWidth:1,borderColor:olive.border,backgroundColor:olive.surface};
export default function CommandCenter({client,visible,onClose,onReport}:Props){
 const [authorized,setAuthorized]=useState(false);
 const [overview,setOverview]=useState<Summary|null>(null);
 const [issues,setIssues]=useState<Issue[]>([]);
 const [busy,setBusy]=useState(false),[saving,setSaving]=useState(''),[error,setError]=useState('');
 const [filter,setFilter]=useState('active');
 const [screenshot,setScreenshot]=useState<Record<string,string>>({});
 const requests=useRef(0);
 const load=useCallback(async()=>{
  const id=++requests.current;
  setBusy(true);setError('');
  try{
   const auth=await client.auth.getUser();
   if(auth.error)throw auth.error;
   if(auth.data.user?.id!=='8287fc6f-dd23-48d8-988e-388a8c93fe7b'||auth.data.user?.app_metadata?.tester_report_reviewer!==true){
    throw new Error('This dashboard is reserved for approved ReconFeed administrators.');
   }
   const refresh=await client.auth.refreshSession();
   if(refresh.error)throw refresh.error;
   const [summary,reports]=await Promise.all([
    client.rpc('reconfeed_command_center_summary'),
    client.from('tester_issues').select('id,category,title,description,steps_to_reproduce,platform,status,created_at,updated_at,screenshot_path').order('created_at',{ascending:false}).limit(150)
   ]);
   if(summary.error)throw summary.error;
   if(reports.error)throw reports.error;
   if(id===requests.current){
    setAuthorized(true);setOverview(summary.data as Summary);setIssues((reports.data||[]) as Issue[]);
   }
  }catch(e:any){if(id===requests.current){setAuthorized(false);setError(e?.message||'Unable to load the command center.');}}
  finally{if(id===requests.current)setBusy(false)}
 },[client]);
 useEffect(()=>{if(visible)void load();return()=>{requests.current++;setOverview(null);setIssues([]);setScreenshot({});setAuthorized(false);}},[visible,load]);
 async function changeStatus(id:string,status:string){
  if(!authorized||saving)return;setSaving(id);setError('');
  try{
   const result=await client.from('tester_issues').update({status,updated_at:new Date().toISOString()}).eq('id',id).select('id,status,updated_at').single();
   if(result.error)throw result.error;
   setIssues(rows=>rows.map(x=>x.id===id?{...x,status,updated_at:result.data.updated_at}:x));
   const summary=await client.rpc('reconfeed_command_center_summary');
   if(!summary.error)setOverview(summary.data as Summary);
  }catch(e:any){setError(e?.message||'Could not change report status.');}
  finally{setSaving('')}
 }
 async function showScreenshot(issue:Issue){
  if(!issue.screenshot_path||!authorized)return;
  if(screenshot[issue.id]){setScreenshot(s=>({...s,[issue.id]:''}));return}
  const r=await client.storage.from('tester-screenshots').createSignedUrl(issue.screenshot_path,300);
  if(r.error){setError('Screenshot unavailable: '+r.error.message);return;}
  setScreenshot(s=>({...s,[issue.id]:r.data.signedUrl}));
 }
 const shown=issues.filter(x=>filter==='all'||(filter==='active'?!['fixed','closed'].includes(x.status):x.status===filter));
 const metric=(label:string,n:number|string)=> <View style={{width:'47%',minWidth:125,flexGrow:1,backgroundColor:olive.surface,borderWidth:1,borderColor:olive.border,borderRadius:16,padding:15,gap:5}}>
  <Text style={{fontSize:25,fontWeight:'900',color:olive.text}}>{typeof n==='number'?cap(n):n}</Text><Text style={{fontSize:12,color:olive.muted,fontWeight:'600'}}>{label}</Text>
 </View>;
 const heading=(s:string)=> <Text style={{fontSize:20,fontWeight:'800',color:olive.text,marginTop:22,marginBottom:10}}>{s}</Text>;
 return <Modal visible={visible} animationType="slide" onRequestClose={onClose}>
 <SafeAreaView style={{flex:1,backgroundColor:olive.bg}}>
  <View style={{flexDirection:'row',alignItems:'center',justifyContent:'space-between',paddingHorizontal:16,paddingVertical:12,borderBottomWidth:1,borderBottomColor:olive.border}}>
   <View style={{flex:1}}><Text style={{fontSize:22,fontWeight:'900',color:olive.text}}>ReconFeed Command Center</Text><Text style={{fontSize:12,color:olive.muted,marginTop:3}}>Private operations · Live community data</Text></View>
   <Pressable accessibilityLabel="Close command center" accessibilityRole="button" onPress={onClose} style={[chip,{marginLeft:8}]}><Text style={{color:olive.text,fontWeight:'800'}}>Close ×</Text></Pressable>
  </View>
  <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={{paddingHorizontal:17,paddingBottom:80}}>
   <View style={{flexDirection:'row',gap:10,marginTop:14,alignItems:'center'}}>
    <Pressable accessibilityRole="button" onPress={()=>void load()} disabled={busy} style={[chip,{backgroundColor:olive.accent}]}><Text style={{fontWeight:'800',color:olive.deep}}>↻ Refresh live data</Text></Pressable>
    {busy?<ActivityIndicator color={olive.accent}/>:null}
   </View>
   {error?<Text accessibilityRole="alert" style={{color:'#ffc1b8',fontWeight:'600',marginTop:13}}>{error}</Text>:null}
   {!authorized||!overview?<Text style={{color:olive.muted,marginTop:16}}>{busy?'Verifying administrator access and loading live data…':'Sign in with the account authorized to review ReconFeed reports.'}</Text>:<>
    {heading('Overview')}
    <View style={{flexDirection:'row',flexWrap:'wrap',gap:10}}>
     {metric('Tester reports',overview.issues_total)}
     {metric('Reports needing attention',overview.issues_open+overview.issues_in_progress+issues.filter(x=>x.status==='triaged').length)}
     {metric('Beta applicants',overview.tester_signups)}
     {metric('Feedback surveys',overview.surveys_total)}
     {metric('Registered accounts',overview.registered_accounts)}
     {metric('Public posts',overview.public_posts)}
     {metric('Active stories',overview.active_stories)}
     {metric('Reports with screenshots',overview.issues_with_screenshot)}
    </View>
    <Text style={{color:olive.muted,fontSize:12,marginTop:10}}>Newest report: {formatTime(overview.latest_issue_at)} · Newest tester application: {formatTime(overview.latest_signup_at)}</Text>
    {heading('Tester reports & fixes')}
    <Text style={{color:olive.muted,lineHeight:19,marginBottom:10}}>Real issues from testers. Review screenshots, reproduction steps and update statuses here. Status changes save to the same database used by testers.</Text>
    <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{gap:8,paddingBottom:12}}>
     {['active','all','open','in_progress','fixed','closed'].map(name=><Pressable key={name} onPress={()=>setFilter(name)} style={[chip,filter===name&&{backgroundColor:olive.accent,borderColor:olive.accent}]}><Text style={{color:filter===name?olive.deep:olive.text,fontWeight:'700'}}>{name.replace(/_/g,' ')}</Text></Pressable>)}
    </ScrollView>
    {shown.length===0?<Text style={{color:olive.muted,marginTop:8}}>No reports in this view.</Text>:shown.map(issue=><View key={issue.id} style={{backgroundColor:olive.surface,borderWidth:1,borderColor:olive.border,borderRadius:16,padding:15,gap:9,marginBottom:12}}>
     <Text style={{color:olive.accent,fontSize:11,fontWeight:'800'}}>{issue.category||'Issue'} · {issue.platform} · {issue.status.replace(/_/g,' ').toUpperCase()}</Text>
     <Text style={{fontSize:17,fontWeight:'800',color:olive.text}}>{issue.title}</Text>
     <Text selectable style={{color:olive.text,fontSize:13,lineHeight:20}}>{issue.description}</Text>
     {issue.steps_to_reproduce?<Text selectable style={{color:olive.muted,fontSize:12,lineHeight:18}}>Steps: {issue.steps_to_reproduce}</Text>:null}
     <Text style={{color:olive.muted,fontSize:11}}>Reported {formatTime(issue.created_at)} · ID {issue.id.slice(0,8)}</Text>
     {issue.screenshot_path?<Pressable accessibilityRole="button" onPress={()=>void showScreenshot(issue)} style={[chip,{alignSelf:'flex-start'}]}><Text style={{color:olive.text,fontWeight:'700'}}>{screenshot[issue.id]?'Hide screenshot':'View private screenshot'}</Text></Pressable>:null}
     {screenshot[issue.id]?<Image source={{uri:screenshot[issue.id]}} style={{width:'100%',height:320,backgroundColor:olive.deep,borderRadius:10}} resizeMode="contain"/>:null}
     <View style={{flexDirection:'row',flexWrap:'wrap',gap:7}}>
      {statuses.map(status=><Pressable key={status} accessibilityRole="button" accessibilityLabel={'Mark '+issue.title+' '+status} disabled={!!saving} onPress={()=>void changeStatus(issue.id,status)} style={[chip,{paddingHorizontal:10,paddingVertical:7},issue.status===status&&{backgroundColor:olive.accent,borderColor:olive.accent}]}><Text style={{fontSize:11,fontWeight:'800',color:issue.status===status?olive.deep:olive.text}}>{status.replace(/_/g,' ')}</Text></Pressable>)}
     </View>
    </View>)}
    {heading('Beta applications')}
    <Text style={{color:olive.muted,fontSize:12,lineHeight:19,marginBottom:11}}>Applicant emails are private. Use only for consented ReconFeed beta communications.</Text>
    {(overview.recent_signups||[]).length===0?<Text style={{color:olive.muted}}>No applications yet.</Text>:(overview.recent_signups||[]).map((person,i)=><View key={i} style={{paddingVertical:12,paddingHorizontal:13,borderBottomWidth:1,borderBottomColor:olive.border,backgroundColor:i%2?olive.surface:olive.bg}}>
     <Text selectable style={{color:olive.text,fontWeight:'700',fontSize:14}}>{person.email}</Text>
     <Text style={{color:olive.muted,fontSize:11,marginTop:3}}>{person.platform} · {person.status} · {formatTime(person.created_at)}</Text>
    </View>)}
    {heading('Survey feedback')}
    {(overview.recent_feedback||[]).length===0?<Text style={{color:olive.muted}}>No survey responses submitted yet. The app's tester survey will populate this section automatically.</Text>:(overview.recent_feedback||[]).map((item,i)=><View key={i} style={{padding:14,backgroundColor:olive.surface,borderRadius:14,marginBottom:9}}>
     <Text style={{color:olive.text,fontWeight:'700'}}>{item.biggest_need||'No written feedback'}</Text>
     <Text style={{color:olive.muted,fontSize:12,marginTop:6}}>{(item.feature_interests||[]).join(', ')||'No feature preference'} · {item.willing_to_test?'Available to test':'Not currently available'} · {formatTime(item.created_at)}</Text>
    </View>)}
    {heading('Privacy & operations')}
    <View style={{backgroundColor:olive.surface,borderColor:olive.border,borderWidth:1,borderRadius:15,padding:14,gap:8}}>
     <Text style={{color:olive.text}}>✓ Reviewer role verified on the server before analytics are returned.</Text>
     <Text style={{color:olive.text}}>✓ Private tester screenshots use time-limited access links.</Text>
     <Text style={{color:olive.text}}>✓ Report status updates rely on database row-level permissions.</Text>
     <Text style={{color:olive.muted,fontSize:12}}>Location restrictions and device safety require independent server, hosting and mobile configuration. They are not guaranteed by this dashboard.</Text>
    </View>
    <Pressable accessibilityRole="button" onPress={onReport} style={[chip,{backgroundColor:olive.accent,alignSelf:'flex-start',marginTop:18}]}><Text style={{color:olive.deep,fontWeight:'800'}}>Submit a test report +</Text></Pressable>
   </>}
  </ScrollView>
 </SafeAreaView>
 </Modal>;
}
