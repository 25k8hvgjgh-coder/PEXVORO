import React,{useCallback,useEffect,useRef,useState} from 'react';
import {ActivityIndicator,AppState,FlatList,Image,KeyboardAvoidingView,Modal,Platform,Pressable,SafeAreaView,ScrollView,StyleSheet,Text,TextInput,View} from 'react-native';
import type {Session,SupabaseClient} from '@supabase/supabase-js';

export type DirectPeer={id:string;username?:string|null;display_name?:string|null;avatar_url?:string|null};
type DirectMessage={id:string;sender_id:string;recipient_id:string;body:string;reply_to_id:string|null;created_at:string};
type Contact=DirectPeer & {followsYou:boolean;youFollow:boolean;last?:DirectMessage};
type Props={client:SupabaseClient;session:Session;initialPeer?:DirectPeer|null;onClose:()=>void;onProfile?:(peer:DirectPeer)=>void};

export default function SocialInbox({client,session,initialPeer,onClose,onProfile}:Props){
 const userId=session.user.id;
 const [peer,setPeer]=useState<DirectPeer|null>(initialPeer||null);
 const [contacts,setContacts]=useState<Contact[]>([]);
 const [messages,setMessages]=useState<DirectMessage[]>([]);
 const [replyTo,setReplyTo]=useState<DirectMessage|null>(null);
 const [body,setBody]=useState('');
 const [busy,setBusy]=useState(false);
 const [loading,setLoading]=useState(true);
 const [allowed,setAllowed]=useState(false);
 const [error,setError]=useState('');
 const loaded=useRef(0);
 const mounted=useRef(true);
 const sendPending=useRef(false);

 const load=useCallback(async()=>{
  const version=++loaded.current;
  try{
   // Scope an open conversation at the database, before LIMIT. A busy inbox
   // must not push an older one-to-one reply out of the latest 120 messages.
   let messageQuery=client.from('direct_messages').select('id,sender_id,recipient_id,body,reply_to_id,created_at');
   if(peer)messageQuery=messageQuery.or(
    `and(sender_id.eq.${userId},recipient_id.eq.${peer.id}),and(sender_id.eq.${peer.id},recipient_id.eq.${userId})`
   );
   const [fromMe,toMe,allMessages]=await Promise.all([
    client.from('follows').select('following_id').eq('follower_id',userId).limit(500),
    client.from('follows').select('follower_id').eq('following_id',userId).limit(500),
    messageQuery.order('created_at',{ascending:false}).limit(peer?120:250)
   ]);
   if(fromMe.error||toMe.error||allMessages.error)throw fromMe.error||toMe.error||allMessages.error;
   if(!mounted.current||version!==loaded.current)return;
   const outgoing=new Set((fromMe.data||[]).map(r=>r.following_id));
   const incoming=new Set((toMe.data||[]).map(r=>r.follower_id));
   const rows=(allMessages.data||[]) as DirectMessage[];
   const peerMessages=peer?rows.filter(m=>(m.sender_id===userId&&m.recipient_id===peer.id)||(m.sender_id===peer.id&&m.recipient_id===userId)):[];
   setMessages(peerMessages);
   const latest=new Map<string,DirectMessage>();
   for(const row of rows){
    const other=row.sender_id===userId?row.recipient_id:row.sender_id;
    if(!latest.has(other))latest.set(other,row);
   }
   const ids=[...new Set([...outgoing,...incoming,...latest.keys(),...(peer?[peer.id]:[])])].filter(id=>id!==userId);
   const profiles=ids.length?await client.from('profiles').select('id,username,display_name,avatar_url').in('id',ids):{data:[],error:null};
   if(profiles.error)throw profiles.error;
   if(!mounted.current||version!==loaded.current)return;
   const byId=new Map((profiles.data||[]).map(p=>[p.id,p]));
   setContacts(ids.filter(id=>byId.has(id)).map(id=>({
    ...byId.get(id),id,youFollow:outgoing.has(id),followsYou:incoming.has(id),last:latest.get(id)
   } as Contact)).sort((a,b)=>(b.last?.created_at||'').localeCompare(a.last?.created_at||'')||Number(b.youFollow&&b.followsYou)-Number(a.youFollow&&a.followsYou)));
   if(peer){
    const permission=await client.rpc('reconfeed_can_send_direct_message',{p_sender:userId,p_recipient:peer.id,p_reply_id:null});
    if(permission.error)throw permission.error;
    if(mounted.current&&version===loaded.current)setAllowed(permission.data===true);
   }
   if(mounted.current&&version===loaded.current)setError('');
  }catch(e:any){if(mounted.current&&version===loaded.current)setError(e.message||'Could not load your messages. Try refreshing.')}
  finally{if(mounted.current&&version===loaded.current)setLoading(false)}
 },[client,userId,peer?.id]);

 useEffect(()=>{mounted.current=true;return()=>{mounted.current=false;++loaded.current}},[]);
 useEffect(()=>{
  setLoading(true);setMessages([]);setReplyTo(null);setAllowed(false);setError('');
  void load();
  const interval=setInterval(()=>{if(AppState.currentState==='active'&&!sendPending.current)void load()},7000);
  return()=>{clearInterval(interval);++loaded.current};
 },[load]);

 async function send(){
  const text=body.trim();
  if(!peer||!text||!allowed||sendPending.current)return;
  sendPending.current=true;setBusy(true);setError('');
  try{
   const result=await client.from('direct_messages').insert({
    sender_id:userId,recipient_id:peer.id,body:text,reply_to_id:replyTo?.id||null
   }).select('id,sender_id,recipient_id,body,reply_to_id,created_at').single();
   if(result.error)throw result.error;
   if(!mounted.current)return;
   setBody('');setReplyTo(null);
   setMessages(prior=>[result.data as DirectMessage,...prior.filter(m=>m.id!==result.data.id)]);
   await load();
  }catch(e:any){if(mounted.current)setError(e.message||'Message could not be sent. Try again.')}
  finally{sendPending.current=false;if(mounted.current)setBusy(false)}
 }

 const replyMap=new Map(messages.map(m=>[m.id,m]));
 function openContact(item:Contact|DirectPeer){setPeer(item);setBody('');setReplyTo(null)}
 function avatar(item:DirectPeer){return item.avatar_url?<Image source={{uri:item.avatar_url}} style={s.avatar}/>:<View style={[s.avatar,s.avatarEmpty]}><Text style={s.avatarText}>{(item.display_name||item.username||'?')[0].toUpperCase()}</Text></View>}
 return <Modal visible animationType="slide" onRequestClose={onClose}>
  <SafeAreaView style={s.screen}>
   <KeyboardAvoidingView style={[s.screen,{maxWidth:780,width:'100%',alignSelf:'center'}]} behavior={Platform.OS==='ios'?'padding':undefined}>
    <View style={s.header}>
     <Pressable accessibilityRole="button" accessibilityLabel={peer?'Back to messages':'Close messages'} onPress={()=>peer?setPeer(null):onClose()} style={s.control}><Text style={s.link}>{peer?'← Inbox':'Close'}</Text></Pressable>
     <Text style={[s.title,{minWidth:0,flexShrink:1}]} numberOfLines={1}>{peer?(peer.display_name||peer.username||'Message'):'ReconFeed Inbox'}</Text>
     <Pressable accessibilityRole="button" accessibilityLabel="Refresh messages" onPress={()=>void load()} style={s.control}><Text style={s.link}>Refresh</Text></Pressable>
    </View>
    {error?<Text accessibilityRole="alert" style={s.error}>{error}</Text>:null}
    {loading?<ActivityIndicator color="#C6AA72" style={{marginTop:18}}/>:null}
    {peer?<View style={{flex:1}}>
     <Pressable accessibilityRole="button" onPress={()=>onProfile?.(peer)} style={s.peerBar}>
      {avatar(peer)}<View style={{flex:1}}><Text style={s.label}>{peer.display_name||peer.username||'Creator'}</Text><Text style={s.note}>@{peer.username||'creator'} · Private conversation</Text></View>
     </Pressable>
     <FlatList inverted data={messages} keyExtractor={m=>m.id} keyboardShouldPersistTaps="handled"
      contentContainerStyle={{paddingVertical:8}}
      ListEmptyComponent={<Text style={s.note}>No messages yet. Both accounts must follow each other to message by default.</Text>}
      renderItem={({item:m})=>{
       const original=m.reply_to_id?replyMap.get(m.reply_to_id):null;
       return <Pressable accessibilityRole="button" accessibilityLabel={'Reply to '+(m.sender_id===userId?'your':'their')+' message'} onPress={()=>setReplyTo(m)} style={[s.bubble,m.sender_id===userId&&s.own]}>
        <Text style={s.author}>{m.sender_id===userId?'You':peer.display_name||peer.username||'Creator'}</Text>
        {!!m.reply_to_id&&<Text style={s.quote}>↪ {original?original.body:'Earlier message'}</Text>}
        <Text style={s.message}>{m.body}</Text>
        <Text style={s.timestamp}>{new Date(m.created_at).toLocaleString()}  · Tap to reply</Text>
       </Pressable>;
      }}/>
     {!allowed?<Text style={s.notice}>Messaging is currently unavailable. By default, both people must follow each other. Message permissions or an account block may also restrict sending.</Text>:null}
     {replyTo?<View style={s.replyBar}><Text style={s.note} numberOfLines={1}>↪ Replying: {replyTo.body}</Text><Pressable onPress={()=>setReplyTo(null)}><Text style={s.link}>✕</Text></Pressable></View>:null}
     <View style={s.composer}>
      <TextInput accessibilityLabel="Message text" placeholder={allowed?'Write a message…':'Follow each other to unlock chat'} placeholderTextColor="#B7BDBB" style={s.input} multiline maxLength={2000} editable={allowed&&!busy} value={body} onChangeText={setBody}/>
      <Pressable accessibilityRole="button" accessibilityLabel="Send direct message" onPress={()=>void send()} disabled={!allowed||busy||!body.trim()} style={[s.send,(!allowed||busy||!body.trim())&&{opacity:.45}]}><Text style={s.sendLabel}>{busy?'Sending…':'Send'}</Text></Pressable>
     </View>
    </View>:<ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={{paddingBottom:30}}>
     <Text style={s.section}>Conversations and connections</Text>
     <Text style={s.note}>Tap an account to open a private conversation. When two users follow each other, they can message and reply. You can also find people in Friends or Followers.</Text>
     {contacts.length===0&&!loading?<Text style={s.note}>No connections yet. Visit Friends, follow another creator, and have them follow you back.</Text>:null}
     {contacts.map(item=><Pressable key={item.id} accessibilityRole="button" accessibilityLabel={'Message @'+item.username} onPress={()=>openContact(item)} style={s.contact}>
      {avatar(item)}<View style={{flex:1,gap:4}}><Text style={s.label} numberOfLines={1}>{item.display_name||item.username}</Text><Text style={s.note}>@{item.username||'creator'} · {item.youFollow&&item.followsYou?'✓ Mutual follow':item.followsYou?'Follows you':'Following'}</Text>
       {item.last?<Text numberOfLines={1} style={s.preview}>{item.last.sender_id===userId?'You: ':''}{item.last.body}</Text>:null}
      </View><Text style={s.link}>›</Text>
     </Pressable>)}
    </ScrollView>}
   </KeyboardAvoidingView>
  </SafeAreaView>
 </Modal>;
}
const s=StyleSheet.create({
 screen:{flex:1,backgroundColor:'#101612'},
 header:{flexDirection:'row',alignItems:'center',justifyContent:'space-between',padding:5,borderBottomWidth:1,borderBottomColor:'#596958'},
 control:{minHeight:44,paddingHorizontal:12,justifyContent:'center'},
 title:{flex:1,textAlign:'center',fontSize:17,fontWeight:'900',color:'#F0EEE5'},
 link:{fontSize:14,fontWeight:'800',color:'#C6AA72'},
 section:{fontSize:19,fontWeight:'900',color:'#F0EEE5',paddingHorizontal:16,paddingTop:15},
 note:{fontSize:12,color:'#B7BDBB',lineHeight:19},
 contact:{flexDirection:'row',gap:12,alignItems:'center',padding:14,borderBottomWidth:1,borderBottomColor:'#344436'},
 avatar:{width:48,height:48,borderRadius:24,backgroundColor:'#344436'},
 avatarEmpty:{alignItems:'center',justifyContent:'center'},
 avatarText:{fontSize:20,color:'#F0EEE5',fontWeight:'800'},
 label:{color:'#F0EEE5',fontSize:14,fontWeight:'800'},
 preview:{fontSize:12,color:'#d6dfc9'},
 peerBar:{padding:12,flexDirection:'row',gap:12,alignItems:'center',borderBottomWidth:1,borderBottomColor:'#344436'},
 bubble:{backgroundColor:'#202a22',marginHorizontal:12,marginVertical:5,marginRight:38,padding:13,borderRadius:13,borderWidth:1,borderColor:'#66784B'},
 own:{backgroundColor:'#344633',marginRight:12,marginLeft:38},
 author:{color:'#C6AA72',fontWeight:'800',fontSize:12,marginBottom:4},
 quote:{color:'#B7BDBB',borderLeftWidth:2,borderColor:'#C6AA72',paddingLeft:8,marginBottom:7,fontSize:12},
 message:{fontSize:15,color:'#F0EEE5',lineHeight:21},
 timestamp:{fontSize:10,color:'#B7BDBB',marginTop:8},
 notice:{fontSize:12,color:'#edcda8',padding:12,backgroundColor:'#322921'},
 error:{color:'#ffb4b4',padding:12,fontSize:12},
 replyBar:{paddingHorizontal:10,paddingVertical:6,flexDirection:'row',gap:12,justifyContent:'space-between',alignItems:'center',borderTopWidth:1,borderColor:'#66784B'},
 composer:{flexDirection:'row',gap:8,padding:8,alignItems:'center',borderTopWidth:1,borderColor:'#344436'},
 input:{flex:1,backgroundColor:'#202a22',color:'#F0EEE5',borderWidth:1,borderColor:'#66784B',minHeight:45,maxHeight:130,borderRadius:10,padding:10},
 send:{backgroundColor:'#C6AA72',borderRadius:10,minHeight:45,paddingHorizontal:15,justifyContent:'center'},
 sendLabel:{fontWeight:'900',color:'#111611'}
});
