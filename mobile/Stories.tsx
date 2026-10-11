import React,{useCallback,useEffect,useState} from 'react';
import {ActivityIndicator,AppState,Image,Modal,Pressable,SafeAreaView,ScrollView,StyleSheet,Text,TextInput,View} from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import {Audio,ResizeMode,Video} from 'expo-av';
import type {Session,SupabaseClient} from '@supabase/supabase-js';
import {imageFormat} from './profilePhoto';

type Story={
 id:string;user_id:string;media_path:string;media_type:'video'|'image';
 caption:string;is_promotional?:boolean;created_at:string;expires_at:string;
 profile?:{username?:string;display_name?:string;avatar_url?:string}|null;
};
type FeedProps={
 client:SupabaseClient|null;session:Session|null;refreshToken:number;
 onCreate:()=>void;
};
const LIMIT=24*1024*1024;
const textColor='#F0EEE5',gold='#C6AA72',muted='#B7BDBB';
const isTemporary=(error:any)=>/network|fetch|timeout|temporarily|connection|socket|reset|503|502|429/i.test(String(error?.message||error||''));

export function StoryStrip({client,session,refreshToken,onCreate}:FeedProps){
 const [stories,setStories]=useState<Story[]>([]);
 const [active,setActive]=useState<Story|null>(null);
 const [assetUrl,setAssetUrl]=useState('');
 const [error,setError]=useState('');
 const [loading,setLoading]=useState(false);
 const [deleting,setDeleting]=useState(false);
 const [confirmDelete,setConfirmDelete]=useState(false);
 const refresh=useCallback(async()=>{
  if(!client||!session)return;
  try{
   const response=await client.from('stories')
    .select('id,user_id,media_path,media_type,caption,is_promotional,created_at,expires_at')
    .gt('expires_at',new Date().toISOString())
    .order('created_at',{ascending:false}).limit(50);
   if(response.error)throw response.error;
   const rows=(response.data||[]) as Story[];
   const ids=[...new Set(rows.map(s=>s.user_id))];
   const people=ids.length?await client.from('profiles').select('id,username,display_name,avatar_url').in('id',ids):{data:[],error:null};
   if(people.error)throw people.error;
   const names=new Map((people.data||[]).map((p:any)=>[p.id,p]));
   setStories(rows.map(story=>({...story,profile:names.get(story.user_id)})));
   setError('');
  }catch(e:any){setError(e?.message||'Stories could not load.');}
 },[client,session?.user.id]);
 useEffect(()=>{
  let current=true;
  if(!client||!session){setStories([]);return}
  void refresh();
  const timer=setInterval(()=>{if(current&&AppState.currentState==='active')void refresh()},90000);
  const foreground=AppState.addEventListener('change',state=>{if(current&&state==='active')void refresh()});
  return()=>{current=false;clearInterval(timer);foreground.remove()};
 },[refresh,refreshToken]);
 async function view(story:Story){
  if(!client)return;
  setActive(story);setAssetUrl('');setError('');setConfirmDelete(false);setLoading(true);
  try{
   if(Date.parse(story.expires_at)<=Date.now())throw new Error('This story has expired.');
   const result=await client.storage.from('story-media').createSignedUrl(story.media_path,300);
   if(result.error)throw result.error;
   setAssetUrl(result.data.signedUrl);
  }catch(e:any){setError(e.message||'Story could not open.');}
  finally{setLoading(false)}
 }
 async function deleteOwnStory(){
  if(!client||!session||!active||active.user_id!==session.user.id||deleting)return;
  setDeleting(true);setError('');
  try{
   const record=await client.from('stories').delete().eq('id',active.id)
    .eq('user_id',session.user.id).select('id').single();
   if(record.error)throw record.error;
   // Remove the actual object too: a deleted story should not continue to
   // consume a beta user's storage allowance.
   const file=await client.storage.from('story-media').remove([active.media_path]);
   if(file.error)console.warn('Deleted story media needs cleanup',file.error.message);
   setActive(null);setAssetUrl('');setConfirmDelete(false);
   setStories(previous=>previous.filter(s=>s.id!==record.data.id));
   void refresh();
  }catch(e:any){setError(e.message||'Could not delete this story. Try again.');}
  finally{setDeleting(false)}
 }
 if(!session)return null;
 return <View style={s.strip} accessibilityLabel="Stories from people you follow">
  <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={s.row}>
   <Pressable accessibilityRole="button" accessibilityLabel="Add your story" onPress={onCreate} style={s.storyCard}>
    <View style={[s.storyAvatar,{borderColor:gold,justifyContent:'center',alignItems:'center'}]}><Text style={{color:gold,fontWeight:'900',fontSize:24}}>+</Text></View>
    <Text style={s.storyLabel} numberOfLines={1}>Your Story</Text>
   </Pressable>
   {stories.map(story=><Pressable key={story.id} accessibilityRole="button" accessibilityLabel={'View story by '+(story.profile?.username||'creator')} style={s.storyCard} onPress={()=>void view(story)}>
    <View style={s.storyAvatar}>{story.profile?.avatar_url?<Image source={{uri:story.profile.avatar_url}} style={s.cover}/>:<Text style={{fontSize:24,fontWeight:'900',color:gold}}>{(story.profile?.display_name||story.profile?.username||'R')[0].toUpperCase()}</Text>}</View>
    <Text style={s.storyLabel} numberOfLines={1}>{story.user_id===session.user.id?'You':story.profile?.username||'Creator'}</Text>
   </Pressable>)}
   {stories.length===0?<Text style={s.empty}>New stories from the accounts you follow will appear here.</Text>:null}
  </ScrollView>
  <Modal visible={!!active} animationType="fade" onRequestClose={()=>{setActive(null);setAssetUrl('')}}>
   <SafeAreaView style={s.viewer}>
    <View style={s.viewerHead}><Text style={s.heading} numberOfLines={1}>@{active?.profile?.username||'creator'} · Story</Text><Pressable accessibilityRole="button" onPress={()=>{setActive(null);setAssetUrl('')}} style={s.close}><Text style={s.closeText}>✕ Close</Text></Pressable></View>
    {loading?<ActivityIndicator color={gold} style={{flex:1}}/>:assetUrl&&active?.media_type==='video'?<Video source={{uri:assetUrl}} shouldPlay isLooping resizeMode={ResizeMode.CONTAIN} useNativeControls style={s.viewerMedia}/>:assetUrl?<Image source={{uri:assetUrl}} resizeMode="contain" style={s.viewerMedia}/>:<Text style={s.warning}>{error||'Story unavailable'}</Text>}
    {active?.is_promotional?<Text accessibilityLabel="Paid promotion or gifted product" style={{color:gold,fontWeight:'900',fontSize:13,textAlign:'center',padding:8}}>PAID PROMOTION / GIFTED PRODUCT</Text>:null}
{!!active?.caption&&<Text style={s.viewerCaption}>{active.caption}</Text>}
    {active?.user_id===session.user.id?<View style={{padding:12,gap:8}}>
     {confirmDelete?<View style={s.buttons}>
      <Pressable accessibilityRole="button" onPress={()=>setConfirmDelete(false)} style={s.button}><Text style={s.buttonLabel}>Cancel</Text></Pressable>
      <Pressable accessibilityRole="button" disabled={deleting} onPress={()=>void deleteOwnStory()} style={[s.button,{borderColor:'#C65A5A'}]}><Text style={s.buttonLabel}>{deleting?'Removing…':'Delete this Story'}</Text></Pressable>
     </View>:<Pressable accessibilityRole="button" onPress={()=>setConfirmDelete(true)} style={[s.button,{maxHeight:46}]}><Text style={s.buttonLabel}>Remove my Story</Text></Pressable>}
    </View>:null}
    {!!error&&<Text accessibilityRole="alert" style={s.warning}>{error}</Text>}
    <Text style={s.note}>Stories disappear from followers' feeds 24 hours after posting.</Text>
   </SafeAreaView>
  </Modal>
 </View>;
}

type ComposeProps={client:SupabaseClient;session:Session;visible:boolean;onClose:()=>void;onPublished:()=>void};
export function StoryComposer({client,session,visible,onClose,onPublished}:ComposeProps){
 const [mode,setMode]=useState<'image'|'video'>('image');
 const [asset,setAsset]=useState<ImagePicker.ImagePickerAsset|null>(null);
 const [caption,setCaption]=useState('');
 const [rightsConfirmed,setRightsConfirmed]=useState(false);
 const [isPromotional,setIsPromotional]=useState(false);
 const [busy,setBusy]=useState(false);
 const [error,setError]=useState('');
 const close=()=>{if(busy)return;setAsset(null);setCaption('');setError('');setRightsConfirmed(false);setIsPromotional(false);onClose()};
 async function gallery(){
  try{
   const result=await ImagePicker.launchImageLibraryAsync({mediaTypes:['images','videos'],quality:.85,exif:false,base64:false});
   if(!result.canceled&&result.assets?.[0]){
    setAsset(result.assets[0]);setRightsConfirmed(false);setMode(result.assets[0].type==='video'?'video':'image');setError('');
   }
  }catch(e:any){setError(e.message||'Could not open your gallery.')}
 }
 async function camera(){
  try{
   const cameraPermission=await ImagePicker.requestCameraPermissionsAsync();
   if(cameraPermission.status!=='granted')throw new Error('Camera permission is required. You can use Gallery instead.');
   if(mode==='video'){
    const mic=await Audio.requestPermissionsAsync();
    if(mic.status!=='granted')throw new Error('Microphone permission is required for recorded videos.');
   }
   const result=await ImagePicker.launchCameraAsync({mediaTypes:mode==='video'?['videos']:['images'],videoMaxDuration:60,quality:.85,exif:false,base64:false});
   if(!result.canceled&&result.assets?.[0]){setAsset(result.assets[0]);setRightsConfirmed(false);setError('')}
  }catch(e:any){setError(e.message||'Could not open the camera.')}
 }
 async function publish(){
  if(busy||!asset)return;
  if(!rightsConfirmed){setError('Confirm you have permission to share this Story and its audio.');return}
  setBusy(true);setError('');
  let uploadedPath='';
  try{
   if(asset.fileSize&&asset.fileSize>LIMIT)throw new Error('Stories must be under 24 MB. Choose a smaller photo or shorter clip.');
   const response=await fetch(asset.uri);
   if(!response.ok)throw new Error('Could not read this file. Choose it again.');
   const fileBuffer=await response.arrayBuffer();
   const bytes=new Uint8Array(fileBuffer);
   if(!bytes.byteLength||bytes.byteLength>LIMIT)throw new Error('This story is empty or over the 24 MB limit.');
   const kind: 'image'|'video'=asset.type==='video'?'video':'image';
   const guessed=(asset.fileName?.split('.').pop()||(kind==='video'?'mp4':'jpg')).toLowerCase().replace(/[^a-z0-9]/g,'');
   const allowed=kind==='video'?['mp4','mov','webm']:['jpg','jpeg','png','webp','gif'];
   // Verify photo magic bytes instead of trusting a misleading .HEIC/.JPG
   // filename. Don't store unreadable photos with a false JPEG MIME type.
   const detected=kind==='image'?imageFormat(fileBuffer):null;
   const ext=detected?.extension||(allowed.includes(guessed)?guessed:'mp4');
   const types:Record<string,string>={jpg:'image/jpeg',jpeg:'image/jpeg',png:'image/png',webp:'image/webp',gif:'image/gif',mp4:'video/mp4',mov:'video/quicktime',webm:'video/webm'};
   const fileType=detected?.type||types[ext];
   const path=session.user.id+'/'+Date.now()+'-'+Math.random().toString(36).slice(2,9)+'.'+ext;
   let upload=await client.storage.from('story-media').upload(path,bytes,{upsert:false,contentType:fileType});
   if(upload.error&&isTemporary(upload.error)){
    await new Promise(done=>setTimeout(done,500));
    upload=await client.storage.from('story-media').upload(path,bytes,{upsert:false,contentType:fileType});
   }
   if(upload.error)throw upload.error;
   if(!upload.data?.path)throw new Error('Story upload could not be confirmed. Please retry.');
   uploadedPath=upload.data.path;
   const record=await client.from('stories').insert({user_id:session.user.id,media_path:uploadedPath,media_type:kind,caption:caption.trim().slice(0,300),is_promotional:isPromotional});
   if(record.error)throw record.error;
   uploadedPath='';setAsset(null);setCaption('');setRightsConfirmed(false);setIsPromotional(false);onPublished();onClose();
  }catch(e:any){
   if(uploadedPath)void client.storage.from('story-media').remove([uploadedPath]);
   setError(e.message||'Story could not be posted. Try again.');
  }finally{setBusy(false)}
 }
 return <Modal visible={visible} animationType="slide" onRequestClose={close}>
  <SafeAreaView style={s.composer}>
   <View style={s.viewerHead}><Text style={s.heading}>ADD TO YOUR STORY</Text><Pressable accessibilityRole="button" onPress={close} style={s.close}><Text style={s.closeText}>✕ Close</Text></Pressable></View>
   <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={{padding:16,gap:14}}>
    <Text style={s.note}>Share a picture or video with people who follow you. Each story is shown for 24 hours.</Text>
    <View style={s.buttons}>
     <Pressable accessibilityRole="button" onPress={()=>setMode('image')} style={[s.button,mode==='image'&&s.selected]}><Text style={s.buttonLabel}>Photo</Text></Pressable>
     <Pressable accessibilityRole="button" onPress={()=>setMode('video')} style={[s.button,mode==='video'&&s.selected]}><Text style={s.buttonLabel}>Video</Text></Pressable>
    </View>
    <View style={s.buttons}>
     <Pressable accessibilityRole="button" onPress={()=>void gallery()} style={s.button}><Text style={s.buttonLabel}>▧ Gallery</Text></Pressable>
     <Pressable accessibilityRole="button" onPress={()=>void camera()} style={s.button}><Text style={s.buttonLabel}>◉ Camera / Record</Text></Pressable>
    </View>
    {asset?.type==='video'?<Video source={{uri:asset.uri}} resizeMode={ResizeMode.CONTAIN} useNativeControls style={s.preview}/>:asset?<Image source={{uri:asset.uri}} resizeMode="contain" style={s.preview}/>:<View style={[s.preview,{justifyContent:'center',alignItems:'center'}]}><Text style={s.note}>Choose a photo or video above</Text></View>}
    <TextInput placeholder="Add a caption (optional)" placeholderTextColor={muted} value={caption} onChangeText={setCaption} maxLength={300} multiline style={s.input}/>
    <Pressable accessibilityRole="checkbox" accessibilityState={{checked:isPromotional}} onPress={()=>setIsPromotional(v=>!v)} style={[s.button,{backgroundColor:'#223126',justifyContent:'flex-start'}]}><Text style={s.buttonLabel}>{isPromotional?'☑':'☐'} Paid or gifted promotion — clearly label this Story.</Text></Pressable>
<Text style={s.note}>Disclose money, gifts, affiliate commissions and other material brand connections in the Story.</Text>
<Pressable accessibilityRole="checkbox" accessibilityState={{checked:rightsConfirmed}} onPress={()=>setRightsConfirmed(v=>!v)} style={[s.button,{backgroundColor:'#223126',justifyContent:'flex-start'}]}><Text style={s.buttonLabel}>{rightsConfirmed?'☑':'☐'} I own this Story and its audio or have permission from the rights holders and depicted people.</Text></Pressable>
    {!!error&&<Text accessibilityRole="alert" style={s.warning}>{error}</Text>}
    <Pressable accessibilityRole="button" disabled={!asset||busy||!rightsConfirmed} onPress={()=>void publish()} style={[s.button,s.selected,(!asset||busy||!rightsConfirmed)&&{opacity:.5}]}><Text style={s.buttonLabel}>{busy?'Publishing…':'Publish Story'}</Text></Pressable>
    <Text style={s.note}>Story media is stored privately. Followers can view active stories; old stories leave their feeds after 24 hours. Only you can delete your own stories.</Text>
   </ScrollView>
  </SafeAreaView>
 </Modal>;
}
const s=StyleSheet.create({
 strip:{height:86,minHeight:86,maxHeight:86,backgroundColor:'#101612',borderBottomWidth:1,borderColor:'#344436',width:'100%'},
 row:{alignItems:'center',gap:12,paddingHorizontal:12,paddingVertical:6},
 storyCard:{width:62,alignItems:'center',gap:4},
 storyAvatar:{width:51,height:51,borderRadius:26,borderWidth:2,borderColor:'#8e9d6e',backgroundColor:'#253629',alignItems:'center',justifyContent:'center',overflow:'hidden'},
 cover:{width:'100%',height:'100%',borderRadius:26},
 storyLabel:{fontSize:10,color:textColor,fontWeight:'700',maxWidth:62},
 empty:{fontSize:11,color:muted,maxWidth:180,lineHeight:17},
 viewer:{flex:1,backgroundColor:'#050705'},
 viewerHead:{minHeight:56,paddingHorizontal:14,flexDirection:'row',alignItems:'center',gap:8,justifyContent:'space-between'},
 heading:{fontWeight:'900',fontSize:16,color:gold,flexShrink:1},
 close:{minHeight:44,padding:10,justifyContent:'center'},
 closeText:{fontSize:13,color:textColor,fontWeight:'800'},
 viewerMedia:{flex:1,width:'100%',backgroundColor:'#050705'},
 viewerCaption:{color:textColor,fontSize:15,padding:16,fontWeight:'700',textAlign:'center'},
 warning:{color:'#FFB6B6',fontSize:13,padding:15},
 note:{color:muted,fontSize:13,lineHeight:19,paddingHorizontal:4,paddingBottom:5},
 composer:{flex:1,backgroundColor:'#101612'},
 buttons:{flexDirection:'row',gap:10,flexWrap:'wrap'},
 button:{minHeight:50,borderRadius:11,borderWidth:1,borderColor:'#8e9d6e',backgroundColor:'#273929',alignItems:'center',justifyContent:'center',paddingHorizontal:18,paddingVertical:10,flex:1},
 selected:{borderColor:gold,backgroundColor:'#3d5335'},
 buttonLabel:{fontWeight:'900',color:textColor,fontSize:14,textAlign:'center'},
 preview:{width:'100%',height:250,backgroundColor:'#050705',borderRadius:8},
 input:{backgroundColor:'#253329',color:textColor,padding:14,minHeight:64,borderRadius:10,borderColor:'#8e9d6e',borderWidth:1,fontSize:16}
});
