import React,{useEffect,useRef,useState} from 'react';
import {Platform,View} from 'react-native';
import {ResizeMode,Video} from 'expo-av';

// Safari permits automatic inline playback when muted. Native HTML video gives
// us direct play()/pause() control rather than relying on Expo's web wrapper.
// Never promise audible autoplay: iOS requires a user gesture for sound.
export type WebVideoElement=HTMLVideoElement;
type FeedProps={
 uri:string; active:boolean; muted:boolean; paused:boolean; wide:boolean;
 onElement?:(element:WebVideoElement|null)=>void;
 onLoad?:(size:{width:number;height:number})=>void;
 onError?:()=>void;
 onProgress?:(data:{isLoaded:boolean;isPlaying:boolean;positionMillis:number;durationMillis:number;didJustFinish:boolean})=>void;
};

export function FeedVideo({uri,active,muted,paused,wide,onElement,onLoad,onError,onProgress}:FeedProps){
 const webRef=useRef<HTMLVideoElement|null>(null);
 const playWanted=active&&!paused;
 useEffect(()=>{
  if(Platform.OS!=='web')return;
  const video=webRef.current;
  if(!video)return;
  video.defaultMuted=muted;
  video.muted=muted;
  video.playsInline=true;
  video.setAttribute('playsinline','');
  video.setAttribute('webkit-playsinline','');
  if(playWanted){
   const pending=video.play();
   if(pending&&typeof pending.catch==='function')void pending.catch(()=>{
    // Safari may reject an audible play. Try again silently; a user can tap
    // the sound control to enable audio under a trusted user gesture.
    if(!video.muted){video.muted=true;void video.play().catch(()=>{});}
   });
  }else video.pause();
 },[uri,playWanted,muted]);
 useEffect(()=>{
  if(Platform.OS!=='web')return;
  const video=webRef.current;
  if(!video)return;
  const resume=()=>{if(playWanted&&typeof document!=='undefined'&&document.visibilityState==='visible')void video.play().catch(()=>{});};
  if(typeof document!=='undefined')document.addEventListener('visibilitychange',resume);
  if(typeof window!=='undefined')window.addEventListener('pageshow',resume);
  return()=>{
   if(typeof document!=='undefined')document.removeEventListener('visibilitychange',resume);
   if(typeof window!=='undefined')window.removeEventListener('pageshow',resume);
  };
 },[uri,playWanted]);
 useEffect(()=>()=>{onElement?.(null)},[onElement]);
 if(Platform.OS!=='web')return <Video source={{uri}} shouldPlay={playWanted} isMuted={muted} isLooping resizeMode={wide?ResizeMode.CONTAIN:ResizeMode.COVER}
  style={{width:'100%',height:'100%'}} progressUpdateIntervalMillis={500}
  onLoad={info=>{const size=(info as any)?.naturalSize;onLoad?.({width:size?.width||0,height:size?.height||0})}}
  onError={()=>onError?.()}
  onPlaybackStatusUpdate={status=>{if(status.isLoaded)onProgress?.({isLoaded:true,isPlaying:status.isPlaying,positionMillis:status.positionMillis,durationMillis:status.durationMillis||0,didJustFinish:status.didJustFinish})}}/>;
 const videoStyle:React.CSSProperties={
  width:'100%',height:'100%',position:'absolute',inset:0,backgroundColor:'#0b120d',
  objectFit:wide?'contain':'cover'
 };
 const props={
  ref:(node:HTMLVideoElement|null)=>{webRef.current=node;onElement?.(node)},
  src:uri,autoPlay:active,muted,loop:true,playsInline:true,preload:active?'auto':'metadata',controls:false,
  disablePictureInPicture:true,
  'webkit-playsinline':'true',
  style:videoStyle,
  onLoadedMetadata:(event:React.SyntheticEvent<HTMLVideoElement>)=>{const v=event.currentTarget;onLoad?.({width:v.videoWidth,height:v.videoHeight});},
  onCanPlay:(event:React.SyntheticEvent<HTMLVideoElement>)=>{
   const v=event.currentTarget;
   if(playWanted){v.muted=muted;void v.play().catch(()=>{if(!v.muted){v.muted=true;void v.play().catch(()=>{})}});}
  },
  onError:()=>onError?.(),
  onTimeUpdate:(event:React.SyntheticEvent<HTMLVideoElement>)=>{
   const v=event.currentTarget;
   onProgress?.({isLoaded:true,isPlaying:!v.paused,positionMillis:v.currentTime*1000,durationMillis:Number.isFinite(v.duration)?v.duration*1000:0,didJustFinish:false});
  }
 } as any;
 return <View style={{height:'100%',width:'100%',overflow:'hidden'}}>{React.createElement('video',props)}</View>;
}

// A viewer opens after a deliberate tap, so native Safari controls can offer
// sound. Start muted to satisfy inline autoplay restrictions, then let the
// viewer unmute and scrub with the regular platform media controls.
export function ViewerVideo({uri}:{uri:string}){
 const ref=useRef<HTMLVideoElement|null>(null);
 useEffect(()=>{
  if(Platform.OS!=='web')return;
  const video=ref.current;
  if(!video)return;
  video.muted=true;
  video.playsInline=true;
  void video.play().catch(()=>{});
  return()=>video.pause();
 },[uri]);
 if(Platform.OS!=='web')return <Video source={{uri}} shouldPlay isLooping useNativeControls resizeMode={ResizeMode.CONTAIN}
  style={{width:'100%',flex:1,backgroundColor:'#050806'}}/>;
 return <View style={{width:'100%',flex:1,backgroundColor:'#050806',position:'relative',overflow:'hidden'}}>
  {React.createElement('video',{
   ref:(node:HTMLVideoElement|null)=>{ref.current=node},
   src:uri,controls:true,autoPlay:true,muted:true,playsInline:true,loop:true,preload:'auto',
   'webkit-playsinline':'true',
   style:{position:'absolute',inset:0,width:'100%',height:'100%',objectFit:'contain',backgroundColor:'#050806'},
   onCanPlay:(event:React.SyntheticEvent<HTMLVideoElement>)=>void event.currentTarget.play().catch(()=>{})
  } as any)}
 </View>;
}

// Real moving previews for the first visible profile tiles. All others avoid
// mounting additional decoders until the creator actually opens the post.
export function VideoTilePreview({uri,playing=false}: {uri:string;playing?:boolean}){
 const ref=useRef<HTMLVideoElement|null>(null);
 const [failed,setFailed]=useState(false);
 useEffect(()=>{setFailed(false)},[uri]);
 useEffect(()=>{
  if(Platform.OS!=='web')return;
  const v=ref.current;
  if(!v)return;
  v.muted=true;v.playsInline=true;
  if(playing)void v.play().catch(()=>{});
  else v.pause();
  return()=>v.pause();
 },[playing,uri]);
 if(failed)return <View style={{flex:1,backgroundColor:'#243729',alignItems:'center',justifyContent:'center'}}/>;
 if(Platform.OS!=='web')return <Video source={{uri}} shouldPlay={playing} isMuted isLooping resizeMode={ResizeMode.COVER}
  style={{width:'100%',height:'100%',backgroundColor:'#1c2b20'}} onError={()=>setFailed(true)}/>;
 return <View style={{flex:1,overflow:'hidden',backgroundColor:'#1c2b20'}}>
  {React.createElement('video',{
   ref:(node:HTMLVideoElement|null)=>{ref.current=node},
   src:uri,muted:true,autoPlay:playing,playsInline:true,loop:true,preload:playing?'metadata':'none',
   'webkit-playsinline':'true',
   style:{width:'100%',height:'100%',objectFit:'cover',position:'absolute',inset:0},
   onLoadedData:(event:React.SyntheticEvent<HTMLVideoElement>)=>{if(playing)void event.currentTarget.play().catch(()=>{})},
   onError:()=>setFailed(true)
  } as any)}
 </View>;
}
