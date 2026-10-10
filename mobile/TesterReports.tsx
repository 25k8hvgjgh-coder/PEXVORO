import React,{useEffect,useRef,useState} from 'react';
import {ActivityIndicator,Image,Modal,Pressable,SafeAreaView,ScrollView,Text,View} from 'react-native';
import type {SupabaseClient} from '@supabase/supabase-js';
type Issue={id:string;title:string;description:string;steps_to_reproduce:string;status:string;platform:string;created_at:string;screenshot_path:string|null;screenshotUrl?:string;screenshotError?:string};
export default function TesterReports({client,userId,visible,onClose,onReport}:{client:SupabaseClient;userId:string;visible:boolean;onClose:()=>void;onReport:()=>void}){
 const [issues,setIssues]=useState<Issue[]>([]),[loading,setLoading]=useState(false),[error,setError]=useState(''),[reviewer,setReviewer]=useState(false),[saving,setSaving]=useState(false);
 const request=useRef(0);
 async function load(){
  const ticket=++request.current;setLoading(true);setError('');setIssues([]);
  try{
   const refreshed=await client.auth.refreshSession();if(refreshed.error)throw refreshed.error;
   const user=await client.auth.getUser();if(user.error)throw user.error;
   const canReview=user.data.user?.app_metadata?.tester_report_reviewer===true;
   let query=client.from('tester_issues').select('*').order('created_at',{ascending:false}).limit(100);
   if(!canReview)query=query.eq('reporter_id',userId);
   const result=await query;if(result.error)throw result.error;
   const rows=await Promise.all((result.data||[]).map(async(issue:Issue)=>{
    if(!issue.screenshot_path)return issue;
    const image=await client.storage.from('tester-screenshots').createSignedUrl(issue.screenshot_path,3600);
    return {...issue,screenshotUrl:image.data?.signedUrl,screenshotError:image.error?'Screenshot unavailable. Refresh to retry.':undefined};
   }));
   if(ticket===request.current){setIssues(rows);setReviewer(canReview)}
  }catch(e:any){if(ticket===request.current)setError(e.message||'Reports could not be loaded.')}
  finally{if(ticket===request.current)setLoading(false)}
 }
 useEffect(()=>{if(visible)void load();return()=>{request.current++;setIssues([]);setReviewer(false)}},[visible,userId]);
 async function updateStatus(id:string,status:string){
  if(saving)return;setSaving(true);setError('');
  try{const result=await client.from('tester_issues').update({status,updated_at:new Date().toISOString()}).eq('id',id).select('id').single();if(result.error)throw result.error;await load()}
  catch(e:any){setError(e.message||'Status was not saved.')}
  finally{setSaving(false)}
 }
 const button={padding:12,borderRadius:8,backgroundColor:'#293228'};
 return <Modal visible={visible} animationType="slide" onRequestClose={onClose}><SafeAreaView style={{flex:1,backgroundColor:'#101410'}}><ScrollView contentContainerStyle={{padding:20,gap:16}}><Pressable onPress={onClose} style={button}><Text style={{color:'#fff'}}>← Back to profile</Text></Pressable><Text style={{color:'#fff',fontSize:24,fontWeight:'800'}}>{reviewer?'All tester reports':'My tester reports'}</Text><Text style={{color:'#bfc8b0'}}>Read the issue, check its status and view attached screenshots. Reports and screenshots stay private.</Text><View style={{flexDirection:'row',gap:12}}><Pressable disabled={loading} onPress={()=>void load()} style={button}><Text style={{color:'#fff'}}>Refresh</Text></Pressable><Pressable onPress={onReport} style={button}><Text style={{color:'#fff'}}>Report an issue</Text></Pressable></View>{loading?<ActivityIndicator color="#b1bd8a"/>:null}{error?<Text accessibilityRole="alert" style={{color:'#ffaaaa'}}>{error}</Text>:null}{!loading&&!error&&!issues.length?<Text style={{color:'#fff'}}>No reports yet. Submit an issue to see it here.</Text>:null}{issues.map(issue=><View key={issue.id} style={{padding:16,gap:12,borderWidth:1,borderColor:'#596958',borderRadius:12}}><Text style={{color:'#c6aa72',fontWeight:'800'}}>{issue.status.replace(/_/g,' ').toUpperCase()} · {issue.platform} · {new Date(issue.created_at).toLocaleString()}</Text><Text style={{color:'#fff',fontSize:20,fontWeight:'800'}}>{issue.title}</Text><Text selectable style={{color:'#fff',lineHeight:23}}>{issue.description}</Text>{issue.steps_to_reproduce?<Text selectable style={{color:'#bfc8b0'}}>Steps: {issue.steps_to_reproduce}</Text>:null}<Text style={{color:'#bfc8b0'}}>Reference: {issue.id.slice(0,8)}</Text>{issue.screenshotUrl?<Image accessibilityLabel={'Screenshot for '+issue.title} source={{uri:issue.screenshotUrl}} resizeMode="contain" style={{width:'100%',height:420}}/>:<Text style={{color:'#bfc8b0'}}>{issue.screenshotError||'No screenshot attached'}</Text>}{reviewer?<View style={{flexDirection:'row',flexWrap:'wrap',gap:8}}>{['open','triaged','in_progress','fixed','closed'].map(status=><Pressable disabled={saving} key={status} onPress={()=>void updateStatus(issue.id,status)} style={[button,{backgroundColor:issue.status===status?'#66784B':'#293228'}]}><Text style={{color:'#fff'}}>{status.replace(/_/g,' ')}</Text></Pressable>)}</View>:null}</View>)}</ScrollView></SafeAreaView></Modal>;
}
