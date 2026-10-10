import React,{useEffect,useState} from 'react';
import {ActivityIndicator,FlatList,Image,Modal,Pressable,SafeAreaView,StyleSheet,Text,View} from 'react-native';
import type {SupabaseClient} from '@supabase/supabase-js';
type Props={client:SupabaseClient;userId:string;kind:'following'|'followers';onClose:()=>void;onCreator:(creator:any)=>void};
export default function ProfileConnections({client,userId,kind,onClose,onCreator}:Props){
 const [people,setPeople]=useState<any[]>([]),[loading,setLoading]=useState(true),[error,setError]=useState(''),[refresh,setRefresh]=useState(0);
 useEffect(()=>{let active=true;setLoading(true);setError('');void(async()=>{try{
  const outgoing=kind==='following';const result=await client.from('follows').select(outgoing?'following_id':'follower_id').eq(outgoing?'follower_id':'following_id',userId).order('created_at',{ascending:false}).limit(200);
  if(result.error)throw result.error;
  const ids=(result.data||[]).map((r:any)=>outgoing?r.following_id:r.follower_id);
  const profiles=ids.length?await client.from('profiles').select('id,username,display_name,bio,avatar_url').in('id',ids):{data:[],error:null};
  if(profiles.error)throw profiles.error;
  if(active)setPeople(ids.flatMap(id=>(profiles.data||[]).filter(p=>p.id===id)));
 }catch(e:any){if(active)setError(e.message||'Could not load accounts.')}finally{if(active)setLoading(false)}})();return()=>{active=false}},[client,userId,kind,refresh]);
 return <Modal visible animationType="slide" onRequestClose={onClose}><SafeAreaView style={s.screen}><View style={s.header}><Pressable accessibilityRole="button" style={s.control} onPress={onClose}><Text style={s.link}>Back</Text></Pressable><Text style={s.title}>{kind==='following'?'Following':'Followers'}</Text><Pressable accessibilityRole="button" style={s.control} onPress={()=>setRefresh(n=>n+1)}><Text style={s.link}>Refresh</Text></Pressable></View>{error?<Text accessibilityRole="alert" style={s.note}>{error}</Text>:null}{loading?<ActivityIndicator color="#C6AA72"/>:<FlatList data={people} keyExtractor={p=>p.id} ListEmptyComponent={<Text style={s.note}>No {kind} to show yet.</Text>} ListFooterComponent={people.length>=200?<Text style={s.note}>Showing the most recent 200 accounts.</Text>:null} renderItem={({item:p})=><Pressable accessibilityRole="button" accessibilityLabel={'Open @'+p.username} style={s.person} onPress={()=>onCreator(p)}>{p.avatar_url?<Image source={{uri:p.avatar_url}} style={s.avatar}/>:<View style={[s.avatar,{justifyContent:'center',alignItems:'center'}]}><Text style={s.title}>{(p.display_name||p.username||'?')[0]}</Text></View>}<View style={{flex:1}}><Text style={s.title}>{p.display_name||p.username}</Text><Text style={s.note}>@{p.username}</Text></View><Text style={s.link}>›</Text></Pressable>}/>}</SafeAreaView></Modal>
}
const s=StyleSheet.create({screen:{flex:1,backgroundColor:'#101612'},header:{flexDirection:'row',alignItems:'center',borderBottomWidth:1,borderBottomColor:'#344436'},control:{padding:16,minHeight:48},title:{flex:1,color:'#F0EEE5',fontSize:18,fontWeight:'700'},link:{color:'#C6AA72',fontSize:16},note:{color:'#B7BDBB',padding:10},person:{padding:14,flexDirection:'row',gap:12,alignItems:'center'},avatar:{width:50,height:50,borderRadius:25,backgroundColor:'#344436'}});
