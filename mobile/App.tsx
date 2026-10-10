import 'react-native-url-polyfill/auto';
import React,{useEffect,useRef,useState} from 'react';
import {ActivityIndicator,Alert,AppState,FlatList,Image,ImageBackground,Pressable,RefreshControl,SafeAreaView,ScrollView,Share,Linking,StatusBar,Platform,StyleSheet,Text,TextInput,View,useWindowDimensions} from 'react-native';
import {Video,ResizeMode} from 'expo-av';
import {Modal} from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import AsyncStorage from '@react-native-async-storage/async-storage';
import {createClient,Session} from '@supabase/supabase-js';
import * as Updates from 'expo-updates';
import MarketplaceInbox,{MarketThread} from './MarketplaceInbox';
import PostCollection from './PostCollection';
import {rankFeedPosts, type FeedEvent, type RankingContext} from './feedRanking';
import {createFeedEventQueue} from './feedEventQueue';
import {normalizeBlockedKeywords,parseCreatorTags,allowedForFeed} from './contentSignals';
const url=process.env.EXPO_PUBLIC_SUPABASE_URL||'';
const key=process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY||'';
const api=(process.env.EXPO_PUBLIC_API_BASE_URL||'').replace(/\/$/,'');
const supabase=url&&key?createClient(url,key,{auth:{storage:AsyncStorage,persistSession:true,autoRefreshToken:true,detectSessionInUrl:Platform.OS==='web'}}):null;
// American Tactical Cinematic — ReconFeed core color tokens; feed and profile structures unchanged.
const theme={bg:'#090C0B',panel:'#171d1b',line:'#596958',text:'#F0EEE5',muted:'#B7BDBB',purple:'#a9bf78',pink:'#C6AA72',accent:'#66784B'};
type Post={id:string;user_id:string;caption:string;media_url:string;media_type:string;format?:string;created_at:string;profiles:any;likes:{count:number}[];comments?:{count:number}[]};
type Tab='For You'|'Following'|'Discover'|'Market'|'Create'|'Profile';
const initialProfileQuery=Platform.OS==='web'?(()=>{try{return new URLSearchParams(String((globalThis as any).location?.search||'')).get('profile')?.slice(0,40)||''}catch{return ''}})():'';
const communityTerms=['veteran','military','outdoors','truck','country life','build','fitness','creator','freedom','service','community'];
function communityScore(caption:string,format?:string){const text=(String(caption||'')+' '+String(format||'')).toLowerCase();return communityTerms.reduce((score,term)=>score+(text.includes(term)?1:0),0)}
function showAlert(title:string,message?:string,buttons?:Array<{text?:string;style?:string;onPress?:()=>void}>){
 if(Platform.OS!=='web'){Alert.alert(title,message,buttons as any);return}
 const browser=globalThis as any;
 const action=buttons?.filter(b=>b.style!=='cancel').at(-1);
 if(buttons&&buttons.length>1){if(browser.confirm(title+'\n\n'+(message||'')))action?.onPress?.()}
 else{browser.alert(title+'\n\n'+(message||''));action?.onPress?.()}
}
function safeErrorMessage(error:any){return typeof error?.message==='string'&&error.message.trim()?error.message:'Something went wrong. Please try again.'}
export default function App(){
 const {width:screenWidth,height:screenHeight}=useWindowDimensions();
 const compact=screenWidth<380;
 const wide=screenWidth>=700;
 const contentMaxWidth=wide?860:screenWidth;
 const [researchFeatures,setResearchFeatures]=useState<string[]>([]),[researchPrice,setResearchPrice]=useState('free'),[researchIdentity,setResearchIdentity]=useState('both'),[researchNeed,setResearchNeed]=useState(''),[researchWilling,setResearchWilling]=useState(false),[researchLoaded,setResearchLoaded]=useState(false),[researchSaved,setResearchSaved]=useState(false); const researchOptions=[{id:'none_yet',label:'None of these yet'},{id:'avatar_cosmetics',label:'Avatar cosmetics & emotes'},{id:'creator_memberships',label:'Creator memberships'},{id:'live_tips_events',label:'Live tips & events'},{id:'ai_creator_tools',label:'AI creator tools'},{id:'creator_marketplace',label:'Creator marketplace'}];
 const [inboxOpen,setInboxOpen]=useState(false),[marketThread,setMarketThread]=useState<MarketThread|null>(null),[collection,setCollection]=useState<{userId?:string;saved:boolean;liked?:boolean}|null>(null);
 const feedRequest=useRef(0);
 const feedCursorRef=useRef<string|null>(null);
 const feedCanLoadMoreRef=useRef(false);
 const feedMorePendingRef=useRef(false);
 const feedRankingContextRef=useRef<RankingContext|null>(null);
 const [loadingMore,setLoadingMore]=useState(false);
 const watchRef=useRef<{postId:string;lastPositionMs:number;watchedMs:number;durationMs:number;startedAt:number;written:boolean}|null>(null);
 const feedQueueRef=useRef<ReturnType<typeof createFeedEventQueue>|null>(null);
 const marketRequest=useRef(0);
 const pendingInteractions=useRef(new Set<string>());
 const [activePostId,setActivePostId]=useState<string|null>(null); const [muted,setMuted]=useState(false); const [appActive,setAppActive]=useState(true); const viewabilityConfig=useRef({itemVisiblePercentThreshold:75}).current; const onViewableItemsChanged=useRef(({viewableItems}:any)=>{const next=viewableItems?.[0]?.item?.id;if(next)setActivePostId(next)}).current;
 const [session,setSession]=useState<Session|null>(null),[tab,setTab]=useState<Tab>(Platform.OS==='web'&&String((globalThis as any).location?.search||'').includes('beta=1')?'Profile':initialProfileQuery?'Discover':'For You'),[posts,setPosts]=useState<Post[]>([]),[marketListings,setMarketListings]=useState<any[]>([]),[marketTitle,setMarketTitle]=useState(''),[marketDescription,setMarketDescription]=useState(''),[marketPrice,setMarketPrice]=useState(''),[marketCategory,setMarketCategory]=useState('All'),[marketCondition,setMarketCondition]=useState('Good'),[marketLocation,setMarketLocation]=useState(''),[marketAck,setMarketAck]=useState(false),[marketMode,setMarketMode]=useState<'browse'|'sell'>('browse'),[marketSearch,setMarketSearch]=useState(''),[loading,setLoading]=useState(false),[search,setSearch]=useState(initialProfileQuery),[email,setEmail]=useState<string>(()=>{if(Platform.OS!=='web'||!String((globalThis as any).location?.search||'').includes('beta=1'))return '';try{return String((globalThis as any).sessionStorage?.getItem('reconfeed_beta_email')||'').trim().toLowerCase()}catch(_error){return ''}}),[password,setPassword]=useState(''),[name,setName]=useState(''),[gender,setGender]=useState(''),[caption,setCaption]=useState(''),[asset,setAsset]=useState<ImagePicker.ImagePickerAsset|null>(null),[prompt,setPrompt]=useState(''),[workflow,setWorkflow]=useState('text-video'),[aiUrl,setAiUrl]=useState(''),[aiStatus,setAiStatus]=useState(''),[busy,setBusy]=useState(false),[profile,setProfile]=useState<any>(null),[commentTarget,setCommentTarget]=useState<Post|null>(null),[commentText,setCommentText]=useState(''),[commentItems,setCommentItems]=useState<any[]>([]),[commentsBusy,setCommentsBusy]=useState(false),[notInterested,setNotInterested]=useState<string[]>([]),[savedPostIds,setSavedPostIds]=useState<string[]>([]);
 const [recovering,setRecovering]=useState(Platform.OS==='web'&&String((globalThis as any).location?.hash||'').includes('type=recovery')),[newPassword,setNewPassword]=useState('');
 const [captureMode,setCaptureMode]=useState<'photo'|'video'>('video'),[captureSeconds,setCaptureSeconds]=useState(15);
 const [profileStats,setProfileStats]=useState({following:0,followers:0,posts:0,likes:0});
 const [likedPostIds,setLikedPostIds]=useState<string[]>([]);
 const [profilePosts,setProfilePosts]=useState<Array<{id:string;media_url:string;media_type:string;caption:string;pinned_at?:string|null}>>([]);
 const [creatorAnalytics,setCreatorAnalytics]=useState({views:0,completedViews:0,watchSeconds:0,shares:0});
 const [creatorSettings,setCreatorSettings]=useState({
  account_type:'personal' as 'personal'|'business',
  is_private:false,
  allow_comments:'everyone' as 'everyone'|'followers'|'none',
  allow_messages:'followers' as 'everyone'|'followers'|'none',
  allow_mentions:'everyone' as 'everyone'|'followers'|'none',
  liked_videos_public:false,
  pronouns:'',website_url:'',instagram_handle:'',youtube_url:''
 });
 const [settingsBusy,setSettingsBusy]=useState(false);
 const [profileSettingsOpen,setProfileSettingsOpen]=useState(false);
 const [blockedAccounts,setBlockedAccounts]=useState<Array<{blocked_id:string;created_at:string}>>([]);
 const [profileGridTab,setProfileGridTab]=useState<'videos'|'photos'|'saved'|'liked'>('videos');
 const [profileLoading,setProfileLoading]=useState(false);
 const [profileEditOpen,setProfileEditOpen]=useState(false);
 const [researchPanelOpen,setResearchPanelOpen]=useState(false);
 const [profileSelected,setProfileSelected]=useState<{id:string;media_url:string;media_type:string;caption:string}|null>(null);
 const [profileGridLimit,setProfileGridLimit]=useState(18);
 const [profileViewCounts,setProfileViewCounts]=useState<Record<string,number>>({});
 const exploreSearchRequest=useRef(0);
 const profileDeepLinkOpened=useRef(false);
 const [exploreBusy,setExploreBusy]=useState(false);
 const [exploreResults,setExploreResults]=useState<any[]>([]);
 const [exploreCreators,setExploreCreators]=useState<any[]>([]);
 const [suggestedCreatorIds,setSuggestedCreatorIds]=useState<string[]>([]);
 const [exploreSearched,setExploreSearched]=useState(false);
 const [exploreSelected,setExploreSelected]=useState<any>(null);
 const [reportTarget,setReportTarget]=useState<Post|null>(null);
 const [reportBusy,setReportBusy]=useState(false);
 const [viewingCreator,setViewingCreator]=useState<any>(null);
 const [viewingCreatorPosts,setViewingCreatorPosts]=useState<any[]>([]);
 const [creatorProfileLoading,setCreatorProfileLoading]=useState(false);
 const [profileBioDraft,setProfileBioDraft]=useState('');
 const [profileUsernameDraft,setProfileUsernameDraft]=useState('');
 const [profileAvatarDraft,setProfileAvatarDraft]=useState<ImagePicker.ImagePickerAsset|null>(null);
 const [postPrivacy,setPostPrivacy]=useState<'public'|'followers'|'private'>('public');
 const [tagDraft,setTagDraft]=useState('');
 const [audioLabelDraft,setAudioLabelDraft]=useState('');
 const [overlayTextDraft,setOverlayTextDraft]=useState('');
 const [transcriptDraft,setTranscriptDraft]=useState('');
 const [creatorMature,setCreatorMature]=useState(false);
 const [blockedKeywords,setBlockedKeywords]=useState<string[]>([]);
 const [blockedKeywordsDraft,setBlockedKeywordsDraft]=useState('');
 const [hideMatureContent,setHideMatureContent]=useState(false);
 const [prefsLoaded,setPrefsLoaded]=useState(false);
 const [recommendationsResetAt,setRecommendationsResetAt]=useState<string|null>(null);
 const [prefsBusy,setPrefsBusy]=useState(false);
 useEffect(()=>{
  let active=true;
  setPrefsLoaded(false);
  if(!supabase||!session){setBlockedKeywords([]);setBlockedKeywordsDraft('');setHideMatureContent(false);setRecommendationsResetAt(null);setPrefsLoaded(true);return()=>{active=false}}
  void(async()=>{
   try{
    const result=await supabase.from('feed_preferences').select('blocked_keywords,hide_mature_content,recommendations_reset_at').eq('user_id',session.user.id).maybeSingle();
    if(result.error)throw result.error;
    if(!active)return;
    const normalized=normalizeBlockedKeywords((result.data?.blocked_keywords||[]) as string[]);
    setBlockedKeywords(normalized);
    setBlockedKeywordsDraft(normalized.join(', '));
    setHideMatureContent(!!result.data?.hide_mature_content);
    setRecommendationsResetAt(result.data?.recommendations_reset_at||null);
   }catch(error:any){console.warn('Field Preferences temporarily unavailable',safeErrorMessage(error))}
   finally{if(active)setPrefsLoaded(true)}
  })();
  return()=>{active=false};
 },[session?.user.id]);
 async function saveFieldPreferences(){
  if(!supabase||!session||prefsBusy)return;
  const entries=blockedKeywordsDraft.split(/[,\n]/g);
  if(entries.length>40||entries.some(x=>x.trim().length>40)){showAlert('Preferences limit','Use no more than 40 words or phrases, each up to 40 characters.');return}
  const normalized=normalizeBlockedKeywords(entries);
  setPrefsBusy(true);
  try{
   const result=await supabase.from('feed_preferences').upsert({
    user_id:session.user.id,blocked_keywords:normalized,hide_mature_content:hideMatureContent,updated_at:new Date().toISOString()
   },{onConflict:'user_id'});
   if(result.error)throw result.error;
   setBlockedKeywords(normalized);
   setBlockedKeywordsDraft(normalized.join(', '));
   showAlert('Field Preferences saved','Your keyword and mature-content filters now apply to your feed.');
  }catch(error:any){showAlert('Could not save preferences',safeErrorMessage(error))}
  finally{setPrefsBusy(false)}
 }

 const [isBetaTester,setIsBetaTester]=useState(false);
 const [personalizationEnabled,setPersonalizationEnabled]=useState(false);
 useEffect(()=>{
  let active=true;
  if(!session?.user.id){setPersonalizationEnabled(false);return()=>{active=false}}
  void AsyncStorage.getItem('reconfeed_personalization_'+session.user.id)
   .then(value=>{if(active)setPersonalizationEnabled(value!=='off')})
   .catch(()=>{if(active)setPersonalizationEnabled(false)});
  return()=>{active=false};
 },[session?.user.id]);
 function togglePersonalization(){
  if(!session)return;
  const value=!personalizationEnabled;
  if(!value)watchRef.current=null;
  setPersonalizationEnabled(value);
  void AsyncStorage.setItem('reconfeed_personalization_'+session.user.id,value?'on':'off').catch(()=>{});
 }
 function clearRecommendationHistory(){
  if(!supabase||!session)return;
  showAlert('Clear recommendation history?','This removes saved watch and Not Interested signals from your account. You will keep your posts, follows and saved videos.',[
   {text:'Cancel',style:'cancel'},
   {text:'Clear history',onPress:()=>{void(async()=>{
    try{
     watchRef.current=null;
     await feedQueueRef.current?.clear();
     const timestamp=new Date().toISOString();
     const [deleted,updated]=await Promise.all([
      supabase.from('feed_events').delete().eq('user_id',session.user.id),
      supabase.from('feed_preferences').upsert({user_id:session.user.id,blocked_keywords:blockedKeywords,hide_mature_content:hideMatureContent,recommendations_reset_at:timestamp,updated_at:timestamp},{onConflict:'user_id'})
     ]);
     if(deleted.error)throw deleted.error;
     if(updated.error)throw updated.error;
     setRecommendationsResetAt(timestamp);
     setNotInterested([]);
     showAlert('For You refreshed','Watch history was cleared and older likes, saves and follows will not shape your new For You recommendations. Your existing follows and saved posts are preserved.');
     if(tab==='For You'||tab==='Following')void loadFeed();
    }catch(error:any){showAlert('Could not clear history',safeErrorMessage(error))}
   })()}}
  ]);
 }

 useEffect(()=>{let active=true;
  async function verifyBetaTester(){
   if(!session?.access_token){if(active)setIsBetaTester(false);return}
   try{
    const response=await fetch((api||'https://reconfeed.com')+'/api/auth-status',{headers:{Authorization:'Bearer '+session.access_token}});
    if(!response.ok)throw new Error('Beta status unavailable');
    const result=await response.json();
    if(active)setIsBetaTester(result.authenticated===true&&result.isBetaTester===true&&result.userId===session.user.id);
   }catch(error){if(active)setIsBetaTester(false);console.warn('Beta tester badge verification unavailable')}
  }
  void verifyBetaTester();return()=>{active=false};
 },[session?.access_token,session?.user.id]);
 useEffect(()=>{let live=true;
  if(!supabase||!session){setProfileStats({following:0,followers:0,posts:0,likes:0});setProfilePosts([]);return}
  setProfileLoading(true);
  void(async()=>{try{const id=session.user.id;const [following,followers,posts,preview,analytics,viewCounts]=await Promise.all([
   supabase.from('follows').select('following_id',{head:true,count:'exact'}).eq('follower_id',id),
   supabase.from('follows').select('follower_id',{head:true,count:'exact'}).eq('following_id',id),
   supabase.from('posts').select('id',{head:true,count:'exact'}).eq('user_id',id),
   supabase.from('posts').select('id,media_url,media_type,caption,pinned_at').eq('user_id',id).order('pinned_at',{ascending:false,nullsFirst:false}).order('created_at',{ascending:false}).limit(90),
   supabase.rpc('reconfeed_my_creator_analytics'),
   supabase.rpc('reconfeed_my_post_view_counts')
  ]);if(live){
   const numbers=analytics.data||{};
   setCreatorAnalytics({views:Number(numbers.views||0),completedViews:Number(numbers.completedViews||0),watchSeconds:Number(numbers.watchSeconds||0),shares:Number(numbers.shares||0)});
   setProfileStats({following:following.count||0,followers:followers.count||0,posts:posts.count||0,likes:Number(numbers.totalLikes||0)});
   setProfilePosts((preview.data||[]) as any);
   if(!viewCounts.error)setProfileViewCounts(Object.fromEntries((viewCounts.data||[]).map((row:any)=>[row.post_id,Number(row.view_count||0)])));
  }
  }catch(e){console.warn('Profile gallery unavailable',e)}finally{if(live)setProfileLoading(false)}})();
  return()=>{live=false};
 },[session?.user.id]);

 const accountRef=useRef<string|undefined>(undefined);accountRef.current=session?.user.id;
 useEffect(()=>{if(!supabase)return;let active=true;supabase.auth.getSession().then(({data,error})=>{if(error)console.warn('Session restore failed',error.message);if(active)setSession(data.session)}).catch(()=>{if(active)showAlert('Connection unavailable','Could not restore your session. Check your connection.')});const {data}=supabase.auth.onAuthStateChange((event,s)=>{if(active){setSession(s);if(event==='PASSWORD_RECOVERY'){setRecovering(true);setTab('Profile')}}});return()=>{active=false;data.subscription.unsubscribe()}},[]);
 useEffect(()=>{let cancelled=false;const timer=setTimeout(()=>{void(async()=>{if(!Updates.isEnabled)return;try{const check=await Updates.checkForUpdateAsync();if(cancelled||!check.isAvailable)return;showAlert('ReconFeed update available','A new update is available. Download it now?',[{text:'Not now',style:'cancel'},{text:'Download update',onPress:()=>{void(async()=>{try{const downloaded=await Updates.fetchUpdateAsync();if(cancelled||!downloaded.isNew)return;showAlert('Update ready','The update is downloaded. Restart ReconFeed to apply it now?',[{text:'Later',style:'cancel'},{text:'Restart now',onPress:()=>{void Updates.reloadAsync().catch((error)=>console.warn('ReconFeed update restart failed',error))}}])}catch(error){console.warn('ReconFeed update download failed',error);showAlert('Update unavailable','ReconFeed could not download the update. Try again later.')}})()}}])}catch(error){console.warn('ReconFeed update check failed',error)}})()},1200);return()=>{cancelled=true;clearTimeout(timer)}},[]);
 useEffect(()=>{const sub=AppState.addEventListener('change',state=>{
  const active=state==='active';setAppActive(active);
  if(active){supabase?.auth.startAutoRefresh();void feedQueueRef.current?.flush()}
  else{supabase?.auth.stopAutoRefresh();void feedQueueRef.current?.flush()}
 });return()=>sub.remove()},[]);
 useEffect(()=>{
  if(!supabase||!session?.user.id){feedQueueRef.current?.dispose();feedQueueRef.current=null;return}
  const queue=createFeedEventQueue({
   userId:session.user.id,
   storage:AsyncStorage,
   insert:async events=>{const response=await supabase.from('feed_events').insert(events);return {error:response.error}}
  });
  feedQueueRef.current=queue;
  void queue.hydrate().then(()=>queue.flush());
  const flushInterval=setInterval(()=>{void queue.flush()},7000);
  return()=>{clearInterval(flushInterval);if(feedQueueRef.current===queue)feedQueueRef.current=null;queue.dispose()};
 },[session?.user.id]);

 useEffect(()=>{++feedRequest.current;++marketRequest.current;setActivePostId(null);if(tab==='Market')void loadMarketplace();else if(tab==='For You'||tab==='Following')void loadFeed();return()=>{++feedRequest.current;++marketRequest.current}},[tab,session?.user.id]);
 useEffect(()=>{setNotInterested([]);setSavedPostIds([]);setProfile(null);setName('');setPassword('');setCommentTarget(null);setCommentItems([]);setInboxOpen(false);setMarketThread(null);setCollection(null);setAiUrl('');setAiStatus('');setCaption('');setAsset(null);setMarketMode('browse');setMarketAck(false);setResearchLoaded(false);setResearchSaved(false);setResearchFeatures([]);setResearchPrice('free');setResearchIdentity('both');setResearchNeed('');setResearchWilling(false)},[session?.user.id]);
 useEffect(()=>{if(session){loadProfile();loadResearchResponse()}else{setResearchLoaded(false);setResearchSaved(false);setResearchFeatures([]);setResearchPrice('free');setResearchIdentity('both');setResearchNeed('');setResearchWilling(false)}},[session?.user.id]);
 async function loadResearchResponse(){if(!supabase||!session)return;try{const r=await supabase.from('reconfeed_research_responses').select('feature_interests,monthly_price,identity_mode,biggest_need,willing_to_test').eq('user_id',session.user.id).maybeSingle();if(r.error)throw r.error;if(accountRef.current!==session.user.id)return;if(r.data){setResearchFeatures(r.data.feature_interests||[]);setResearchPrice(r.data.monthly_price||'free');setResearchIdentity(r.data.identity_mode||'both');setResearchNeed(r.data.biggest_need||'');setResearchWilling(!!r.data.willing_to_test);setResearchSaved(true)}else setResearchSaved(false)}catch(e:any){console.warn('Research survey load failed:',e.message)}finally{if(accountRef.current===session.user.id)setResearchLoaded(true)}}
 async function saveResearchResponse(){if(!supabase||!session){showAlert('Sign in required','Sign in to submit tester research.');return}const features=researchFeatures.includes('none_yet')?['none_yet']:researchFeatures;setBusy(true);try{const r=await supabase.from('reconfeed_research_responses').upsert({user_id:session.user.id,feature_interests:features,monthly_price:researchPrice,identity_mode:researchIdentity,biggest_need:researchNeed.trim(),willing_to_test:researchWilling,updated_at:new Date().toISOString()},{onConflict:'user_id'});if(r.error)throw r.error;setResearchFeatures(features);setResearchSaved(true);showAlert('Response saved','Thanks. Your answer is stored as a real tester response and can be updated later.')}catch(e:any){showAlert('Survey unavailable',safeErrorMessage(e)+' If this is a new build, the research survey database migration must be applied first.')}finally{setBusy(false)}}
 useEffect(()=>{
  let alive=true;
  if(!supabase||!session){setLikedPostIds([]);return}
  void supabase.from('likes').select('post_id').eq('user_id',session.user.id).limit(500).then(({data,error})=>{
   if(alive&&!error)setLikedPostIds((data||[]).map(x=>x.post_id));
  });
  return()=>{alive=false};
 },[session?.user.id]);
 useEffect(()=>{let active=true;async function loadSavedPosts(){if(!supabase||!session){setSavedPostIds([]);return}const r=await supabase.from('saved_posts').select('post_id').eq('user_id',session.user.id);if(!r.error&&active)setSavedPostIds((r.data||[]).map((row:any)=>row.post_id))}loadSavedPosts();return()=>{active=false}},[session?.user.id]);
 useEffect(()=>{
  let live=true;
  if(!supabase||!session){setProfileSettingsOpen(false);setBlockedAccounts([]);return}
  void(async()=>{
   try{
    const [prefs,blocks]=await Promise.all([
     supabase.from('profile_settings').select('account_type,is_private,allow_comments,allow_messages,allow_mentions,liked_videos_public,pronouns,website_url,instagram_handle,youtube_url').eq('user_id',session.user.id).maybeSingle(),
     supabase.from('blocked_accounts').select('blocked_id,created_at').eq('blocker_id',session.user.id).order('created_at',{ascending:false}).limit(100)
    ]);
    if(live&&prefs.data)setCreatorSettings(old=>({...old,...prefs.data}));
    if(live&&!blocks.error)setBlockedAccounts(blocks.data||[]);
   }catch(e:any){console.warn('Account controls unavailable',safeErrorMessage(e))}
  })();
  return()=>{live=false};
 },[session?.user.id]);
 async function saveCreatorSettings(){
  if(!supabase||!session||settingsBusy)return;
  if(creatorSettings.website_url&&!/^https:\/\/[\w.-]+(?:\:[0-9]+)?(?:[/?#][^\s]*)?$/i.test(creatorSettings.website_url.trim())){showAlert('Website link','Use a valid https:// link.');return}
  if(creatorSettings.youtube_url&&!/^https:\/\/[\w.-]+(?:\:[0-9]+)?(?:[/?#][^\s]*)?$/i.test(creatorSettings.youtube_url.trim())){showAlert('YouTube link','Use a valid https:// link.');return}
  setSettingsBusy(true);
  try{
   const r=await supabase.from('profile_settings').upsert({...creatorSettings,user_id:session.user.id,updated_at:new Date().toISOString()},{onConflict:'user_id'});
   if(r.error)throw r.error;
   showAlert('Account controls saved',creatorSettings.is_private?'Profile posts are restricted in ReconFeed. Note that media URLs previously shared outside ReconFeed may still be accessible.':'Your profile settings are saved.');
  }catch(e:any){showAlert('Unable to save settings',safeErrorMessage(e))}
  finally{setSettingsBusy(false)}
 }
 async function togglePinPost(postId:string,pinned:boolean){
  if(!supabase||!session)return;
  try{
   const r=await supabase.from('posts').update({pinned_at:pinned?null:new Date().toISOString()}).eq('id',postId).eq('user_id',session.user.id);
   if(r.error)throw r.error;
   setProfilePosts(rows=>rows.map(x=>x.id===postId?{...x,pinned_at:pinned?null:new Date().toISOString()}:x).sort((a,b)=>Number(!!b.pinned_at)-Number(!!a.pinned_at)));
  }catch(e:any){showAlert('Cannot change pin',safeErrorMessage(e))}
 }
 async function blockCreator(creatorId:string){
  if(!supabase||!session||creatorId===session.user.id)return;
  showAlert('Block this account?','Blocking prevents either of you from viewing the other\'s posts and profiles inside ReconFeed.',[
   {text:'Cancel',style:'cancel'},
   {text:'Block',onPress:()=>{void(async()=>{
    const r=await supabase.from('blocked_accounts').upsert({blocker_id:session.user.id,blocked_id:creatorId},{onConflict:'blocker_id,blocked_id'});
    if(r.error)showAlert('Block failed',r.error.message);
    else{setBlockedAccounts(prev=>[{blocked_id:creatorId,created_at:new Date().toISOString()},...prev]);setViewingCreator(null);showAlert('Account blocked','You can unblock this user from Profile settings.')}
   })()}}
  ]);
 }
 async function unblockCreator(creatorId:string){
  if(!supabase||!session)return;
  const r=await supabase.from('blocked_accounts').delete().eq('blocker_id',session.user.id).eq('blocked_id',creatorId);
  if(r.error)showAlert('Unblock failed',r.error.message);
  else setBlockedAccounts(prev=>prev.filter(x=>x.blocked_id!==creatorId));
 }
 async function shareProfile(username:string){
  if(!username.trim())return;
  const link='https://reconfeed.com/app/?profile='+encodeURIComponent(username.trim().replace(/^@/,''));
  try{await Share.share({message:'Find me on ReconFeed: '+link,url:link})}catch(error){console.warn('Profile sharing unavailable')}
 }
 async function loadProfile(){if(!supabase||!session)return;const r=await supabase.from('profiles').select('id,username,display_name,bio,avatar_url,created_at').eq('id',session.user.id).maybeSingle();if(accountRef.current===session.user.id){setProfile(r.data);setName(r.data?.display_name||'');setProfileBioDraft(r.data?.bio||'');setProfileUsernameDraft(r.data?.username||'')}}
 async function runExploreSearch(term:string){
  if(!supabase){setExploreBusy(false);setExploreSearched(true);setExploreResults([]);setExploreCreators([]);return}
  const request=++exploreSearchRequest.current;
  setExploreBusy(true);setExploreSearched(true);
  // Usernames may be entered with @. Escape punctuation that could break PostgREST filter syntax.
  const safe=term.trim().replace(/^@/,'').replace(/[%,.()]/g,'').slice(0,75);
  try{
   const creatorsQuery=supabase.from('profiles').select('id,username,display_name,avatar_url,bio');
   const creatorReq=safe
    ?creatorsQuery.or('username.ilike.%'+safe+'%,display_name.ilike.%'+safe+'%').limit(35)
    :creatorsQuery.order('created_at',{ascending:false}).limit(35);
   const tag=safe.replace(/^#/,'').toLowerCase();
   const clauses=['caption.ilike.%'+safe+'%','audio_label.ilike.%'+safe+'%','overlay_text.ilike.%'+safe+'%','transcript.ilike.%'+safe+'%'];
   if(/^[a-z0-9_]{2,25}$/.test(tag))clauses.push('topic_tags.cs.{'+tag+'}');
   const postReq=safe
    ?supabase.from('posts').select('id,user_id,caption,media_url,media_type,topic_tags,audio_label,overlay_text,transcript,content_rating,recommendation_status,created_at,profiles(username,display_name)').eq('visibility','public').or(clauses.join(',')).order('created_at',{ascending:false}).limit(35)
    :Promise.resolve({data:[],error:null});
   const [creatorsFound,postsFound]=await Promise.all([creatorReq,postReq]);
   if(request!==exploreSearchRequest.current)return;
   // Creator discovery must still work even if video loading fails.
   if(creatorsFound.error)throw creatorsFound.error;
   const candidates=(creatorsFound.data||[]).filter((profile:any)=>profile.id!==session?.user.id);
   if(!safe&&session&&personalizationEnabled&&candidates.length){
    // Friends-of-followed-creators boost discovery without uploading private phone contacts.
    try{
     const direct=await supabase.from('follows').select('following_id').eq('follower_id',session.user.id).limit(100);
     const followedIds=(direct.data||[]).map((entry:any)=>entry.following_id as string);
     const suggestions=followedIds.length?await supabase.from('follows').select('following_id').in('follower_id',followedIds.slice(0,30)).limit(200):{data:[]};
     const scores=new Map<string,number>();
     for(const entry of suggestions.data||[])scores.set(entry.following_id,(scores.get(entry.following_id)||0)+1);
     candidates.sort((a:any,b:any)=>{
      const aScore=followedIds.includes(a.id)?-1:(scores.get(a.id)||0);
      const bScore=followedIds.includes(b.id)?-1:(scores.get(b.id)||0);
      return bScore-aScore;
     });
     setSuggestedCreatorIds(candidates.filter((p:any)=>(scores.get(p.id)||0)>0&&!followedIds.includes(p.id)).map((p:any)=>p.id));
    }catch(error){setSuggestedCreatorIds([]);console.warn('Suggested creators fallback in use')}
   }else setSuggestedCreatorIds([]);
   if(request!==exploreSearchRequest.current)return;
   setExploreCreators(candidates);
   if(postsFound.error){console.warn('Post search unavailable',postsFound.error.message);setExploreResults([])}
   else setExploreResults((postsFound.data||[]).filter((p:any)=>allowedForFeed(p,{blockedKeywords,hideMatureContent},'Following')));
  }catch(error:any){
   if(request!==exploreSearchRequest.current)return;
   console.warn('Creator discovery failed',safeErrorMessage(error));
   setExploreCreators([]);setExploreResults([]);
   showAlert('Search temporarily unavailable','Creator directory could not load. Try again or check your connection.');
  }finally{if(request===exploreSearchRequest.current)setExploreBusy(false)}
 }
 useEffect(()=>{
  if(tab!=='Discover')return;
  const task=setTimeout(()=>{void runExploreSearch(search)},search.trim()?280:0);
  return()=>{clearTimeout(task);++exploreSearchRequest.current};
 },[tab,search]);
 useEffect(()=>{
  if(!initialProfileQuery||profileDeepLinkOpened.current||tab!=='Discover'||exploreBusy||!exploreCreators.length)return;
  const exact=exploreCreators.find(creator=>String(creator.username||'').toLowerCase()===initialProfileQuery.toLowerCase());
  if(exact){profileDeepLinkOpened.current=true;void openCreatorProfile(exact)}
 },[tab,exploreBusy,exploreCreators]);
 async function openCreatorProfile(creator:any){
  if(!supabase)return;
  setViewingCreator(creator);setViewingCreatorPosts([]);setCreatorProfileLoading(true);
  try{
   const linkInfo=await supabase.from('profile_settings').select('pronouns,website_url').eq('user_id',creator.id).maybeSingle();
   if(!linkInfo.error&&linkInfo.data)setViewingCreator((prev:any)=>prev?.id===creator.id?{...prev,...linkInfo.data}:prev);
   const response=await supabase.from('posts')
    .select('id,caption,media_type,media_url,created_at,topic_tags,audio_label,overlay_text,transcript,content_rating,recommendation_status')
    .eq('user_id',creator.id).eq('visibility','public')
    .order('created_at',{ascending:false}).limit(24);
   if(response.error)throw response.error;
   setViewingCreatorPosts((response.data||[]).filter((p:any)=>allowedForFeed(p,{blockedKeywords,hideMatureContent},'Following')));
  }catch(error:any){console.warn('Creator posts unavailable',safeErrorMessage(error))}
  finally{setCreatorProfileLoading(false)}
 }
 async function deleteOwnPost(postId:string){
  if(!supabase||!session)return;
  showAlert('Delete this post?','This removes your post from ReconFeed permanently.',[
   {text:'Cancel',style:'cancel'},
   {text:'Delete',onPress:()=>{void(async()=>{
    try{
     const result=await supabase.from('posts').delete().eq('id',postId).eq('user_id',session.user.id).select('id');
     if(result.error)throw result.error;
     if(!result.data?.length)throw new Error('The post was not deleted; check your permissions.');
     setProfilePosts(items=>items.filter(p=>p.id!==postId));
     setProfileStats(v=>({...v,posts:Math.max(0,v.posts-1)}));
     setPosts(items=>items.filter(p=>p.id!==postId));
     showAlert('Post deleted','Your video or photo is no longer listed.');
    }catch(error:any){showAlert('Deletion failed',safeErrorMessage(error))}
   })()}}
  ]);
 }
 async function chooseProfilePhoto(){
  if(!session)return;
  try{const permission=await ImagePicker.requestMediaLibraryPermissionsAsync();if(!permission.granted){showAlert('Photo access','Allow photo library access to choose a profile photo.');return}
   const result=await ImagePicker.launchImageLibraryAsync({mediaTypes:['images'],allowsEditing:true,aspect:[1,1],quality:.7});
   if(!result.canceled&&result.assets?.[0])setProfileAvatarDraft(result.assets[0]);
  }catch(error:any){showAlert('Profile photo unavailable',safeErrorMessage(error))}
 }
 async function saveFullProfile(){
  if(!supabase||!session||busy)return;
  setBusy(true);
  try{
   const username=profileUsernameDraft.trim().toLowerCase();
   if(!/^[a-z0-9_.]{3,24}$/.test(username))throw new Error('Username must be 3–24 characters: lowercase letters, numbers, underscores or periods.');
   const update:any={username,display_name:name.trim().slice(0,80)||profile?.display_name,bio:profileBioDraft.trim().slice(0,80)};
   if(profileAvatarDraft){
    const asset=profileAvatarDraft;
    const result=await fetch(asset.uri);
    if(!result.ok)throw new Error('Could not read selected profile photo');
    const bytes=await result.arrayBuffer();
    if(bytes.byteLength>5*1024*1024)throw new Error('Profile photos must be smaller than 5 MB');
    const objectPath=session.user.id+'/avatar-'+Date.now()+'.jpg';
    const upload=await supabase.storage.from('post-media').upload(objectPath,bytes,{contentType:'image/jpeg'});
    if(upload.error)throw upload.error;
    update.avatar_url=supabase.storage.from('post-media').getPublicUrl(objectPath).data.publicUrl;
   }
   const result=await supabase.from('profiles').update(update).eq('id',session.user.id);
   if(result.error)throw result.error;
   setProfileAvatarDraft(null);
   await loadProfile();
   showAlert('Profile updated','Your photo, name and bio have been saved.');
  }catch(error:any){showAlert('Could not update profile',safeErrorMessage(error))}
  finally{setBusy(false)}
 }
 async function submitReport(reason:'spam'|'harassment'|'unsafe'|'privacy'|'adult'|'other'){
  if(!supabase||!session){setReportTarget(null);setTab('Profile');showAlert('Sign in required','Sign in to report content.');return}
  if(!reportTarget||reportBusy)return;
  const postId=reportTarget.id;
  setReportBusy(true);
  try{
   const result=await supabase.from('post_reports').insert({post_id:postId,user_id:session.user.id,reason});
   if(result.error&&result.error.code!=='23505')throw result.error;
   setReportTarget(null);
   showAlert('Report received','Thank you. This report is stored for moderation review. Reporting does not automatically remove a post.');
  }catch(error:any){showAlert('Report could not be sent',safeErrorMessage(error))}
  finally{setReportBusy(false)}
 }
 async function recordFeedAction(postId:string,eventType:'share'|'not_interested'){
  if(!supabase||!session||(eventType!=='not_interested'&&!personalizationEnabled))return;
  const queue=feedQueueRef.current;
  if(!queue)return;
  queue.enqueue(postId,eventType);
  // Explicit choices should be synced promptly; passive viewing signals are batched.
  void queue.flush();
 }
 function flushVideoWatch(){
  const view=watchRef.current;
  if(!view||view.written)return;
  view.written=true;
  watchRef.current=null;
  if(!session||!supabase||!personalizationEnabled||view.durationMs<100||view.watchedMs<200)return;
  const queue=feedQueueRef.current;
  if(queue){
   queue.enqueue(view.postId,'watch',view.watchedMs,view.durationMs);
   if(queue.size()>=10)void queue.flush();
  }
 }
 function trackPlayback(postId:string,status:any){
  if(!session||!personalizationEnabled||!status?.isLoaded||!appActive)return;
  if(postId!==activePostId)return;
  const currentPos=Math.max(0,Number(status.positionMillis)||0);
  let view=watchRef.current;
  if(view&&view.postId!==postId){flushVideoWatch();view=null}
  if(view&&currentPos<view.lastPositionMs-700){
   flushVideoWatch();view=null; // A loop or deliberate rewind creates a new rewatch signal.
  }
  if(!view){view={postId,lastPositionMs:currentPos,watchedMs:0,durationMs:Math.max(0,Number(status.durationMillis)||0),startedAt:Date.now(),written:false};watchRef.current=view}
  const delta=currentPos-view.lastPositionMs;
  if(status.isPlaying&&delta>0&&delta<5000)view.watchedMs+=delta;
  view.durationMs=Math.max(view.durationMs,Math.max(0,Number(status.durationMillis)||0));
  view.lastPositionMs=currentPos;
  if(status.didJustFinish)flushVideoWatch();
 }
 async function loadFeed(){
  if(!supabase){setPosts([]);return}
  if(session&&!prefsLoaded){setPosts([]);return}
  const request=++feedRequest.current;
  feedCanLoadMoreRef.current=false;
  feedCursorRef.current=null;
  feedRankingContextRef.current=null;
  setLoading(true);
  try{
   const userId=session?.user.id;
   const isFollowing=tab==='Following';
   const feedSelect='id,user_id,caption,media_url,media_type,format,topic_tags,audio_label,overlay_text,transcript,content_rating,recommendation_status,created_at,profiles(username,display_name),likes(count),comments(count)';
   // Begin the public For You request immediately; don't wait for preference queries.
   const publicFeedPromise=!isFollowing
    ?supabase.from('posts').select(feedSelect).eq('visibility','public').eq('recommendation_status','eligible').order('created_at',{ascending:false}).limit(100)
    :Promise.resolve(null);
   const [followRes,historyRes,likesRes,saveRes]=userId?await Promise.all([
    supabase.from('follows').select('following_id,created_at').eq('follower_id',userId).limit(300),
    personalizationEnabled?(recommendationsResetAt?supabase.from('feed_events').select('post_id,event_type,watched_ms,duration_ms,created_at').eq('user_id',userId).gte('created_at',recommendationsResetAt).order('created_at',{ascending:false}).limit(180):supabase.from('feed_events').select('post_id,event_type,watched_ms,duration_ms,created_at').eq('user_id',userId).order('created_at',{ascending:false}).limit(180)):(recommendationsResetAt?supabase.from('feed_events').select('post_id,event_type,watched_ms,duration_ms,created_at').eq('user_id',userId).eq('event_type','not_interested').gte('created_at',recommendationsResetAt).order('created_at',{ascending:false}).limit(180):supabase.from('feed_events').select('post_id,event_type,watched_ms,duration_ms,created_at').eq('user_id',userId).eq('event_type','not_interested').order('created_at',{ascending:false}).limit(180)),
    personalizationEnabled?(recommendationsResetAt?supabase.from('likes').select('post_id').eq('user_id',userId).gte('created_at',recommendationsResetAt).limit(160):supabase.from('likes').select('post_id').eq('user_id',userId).limit(160)):Promise.resolve({data:[]}),
    personalizationEnabled?(recommendationsResetAt?supabase.from('saved_posts').select('post_id').eq('user_id',userId).gte('created_at',recommendationsResetAt).limit(160):supabase.from('saved_posts').select('post_id').eq('user_id',userId).limit(160)):Promise.resolve({data:[]})
   ]):[{data:[]},{data:[]},{data:[]},{data:[]}];
   if(request!==feedRequest.current)return;
   // Recommendation features degrade gracefully if history collection is unavailable.
   for(const response of [followRes,historyRes,likesRes,saveRes]){
    if((response as any).error)console.warn('Feed signal unavailable',(response as any).error.message);
   }
   const followed=(followRes.data||[]).map((f:any)=>f.following_id as string);
   const personalFollows=(followRes.data||[]).filter((f:any)=>!recommendationsResetAt||new Date(f.created_at).getTime()>=new Date(recommendationsResetAt).getTime()).map((f:any)=>f.following_id as string);
   const history=(historyRes.data||[]) as FeedEvent[];
   const liked=(likesRes.data||[]).map((v:any)=>v.post_id as string);
   const saved=(saveRes.data||[]).map((v:any)=>v.post_id as string);
   if(isFollowing&&!userId){setPosts([]);return}
   if(isFollowing&&!followed.length){setPosts([]);return}
   const followingPromise=isFollowing
    ?supabase.from('posts').select(feedSelect).in('user_id',followed).order('created_at',{ascending:false}).limit(100)
    :Promise.resolve(null);
   const oldIds=personalizationEnabled?[...new Set([...history.map(h=>h.post_id),...saved,...liked])].slice(0,85):[];
   const olderPosts=oldIds.length
    ?supabase.from('posts').select('id,user_id,caption,format,topic_tags,audio_label,overlay_text,transcript').in('id',oldIds).limit(85)
    :Promise.resolve({data:[],error:null});
   const followedSamples=personalizationEnabled&&personalFollows.length
    ?supabase.from('posts').select('id,user_id,caption,format,topic_tags,audio_label,overlay_text,transcript').in('user_id',personalFollows.slice(0,50)).eq('visibility','public').order('created_at',{ascending:false}).limit(40)
    :Promise.resolve({data:[],error:null});
   const [fresh,prior,followedContent]=await Promise.all([isFollowing?followingPromise:publicFeedPromise,olderPosts,followedSamples]);
   if(!fresh||fresh.error)throw (fresh?.error||new Error('Could not load feed'));
   if((prior as any).error)console.warn('History topic enrichment unavailable',(prior as any).error.message);
   if((followedContent as any).error)console.warn('Followed creator topics unavailable',(followedContent as any).error.message);
   if(request!==feedRequest.current)return;
   const rankingContext:RankingContext={
    mode:isFollowing?'Following':'For You',
    followingIds:isFollowing?followed:(personalizationEnabled?personalFollows:[]),
    likedPostIds:personalizationEnabled?liked:[],
    savedPostIds:personalizationEnabled?saved:[],
    history:personalizationEnabled?history:[],
    historyPosts:[...(prior.data||[]),...(followedContent.data||[])],
    hiddenIds:[...notInterested,...history.filter(e=>e.event_type==='not_interested').map(e=>e.post_id)],
    blockedKeywords,
    hideMatureContent
   };
   const candidatePosts=(fresh.data||[]) as Post[];
   const ranked=rankFeedPosts(candidatePosts,rankingContext);
   feedRankingContextRef.current=rankingContext;
   feedCanLoadMoreRef.current=candidatePosts.length>=100;
   feedCursorRef.current=candidatePosts.length?candidatePosts[candidatePosts.length-1].created_at:null;
   setPosts(ranked);
   setActivePostId(id=>ranked.some(p=>p.id===id)?id:ranked[0]?.id||null);
  }catch(error:any){
   if(request===feedRequest.current){console.warn('Feed load failed',safeErrorMessage(error));showAlert('Feed temporarily unavailable',safeErrorMessage(error))}
  }finally{if(request===feedRequest.current)setLoading(false)}
 }
 async function loadMoreFeed(){
  if(!supabase||loading||feedMorePendingRef.current||!feedCanLoadMoreRef.current||!feedCursorRef.current)return;
  const context=feedRankingContextRef.current;
  if(!context)return;
  const following=tab==='Following';
  if(following!== (context.mode==='Following'))return;
  const request=feedRequest.current;
  const cursor=feedCursorRef.current;
  const followed=context.followingIds;
  if(following&&!followed.length)return;
  feedMorePendingRef.current=true;
  setLoadingMore(true);
  try{
   const fields='id,user_id,caption,media_url,media_type,format,topic_tags,audio_label,overlay_text,transcript,content_rating,recommendation_status,created_at,profiles(username,display_name),likes(count),comments(count)';
   let next=supabase.from('posts').select(fields).lt('created_at',cursor).order('created_at',{ascending:false}).limit(50);
   if(following)next=next.in('user_id',followed);
   else next=next.eq('visibility','public').eq('recommendation_status','eligible');
   const result=await next;
   if(result.error)throw result.error;
   if(request!==feedRequest.current)return;
   const candidates=(result.data||[]) as Post[];
   feedCanLoadMoreRef.current=candidates.length>=50;
   if(candidates.length)feedCursorRef.current=candidates[candidates.length-1].created_at;
   const nextRanked=rankFeedPosts(candidates,context);
   if(nextRanked.length)setPosts(current=>{
    const seen=new Set(current.map(p=>p.id));
    return [...current,...nextRanked.filter(p=>!seen.has(p.id))];
   });
  }catch(error:any){
   if(request===feedRequest.current){console.warn('Next feed page unavailable',safeErrorMessage(error));feedCanLoadMoreRef.current=false}
  }finally{
   feedMorePendingRef.current=false;
   if(request===feedRequest.current)setLoadingMore(false);
  }
 }
 useEffect(()=>{
  const view=watchRef.current;
  if(view&&(view.postId!==activePostId||(tab!=='For You'&&tab!=='Following')||!appActive||!personalizationEnabled))flushVideoWatch();
 },[activePostId,tab,appActive,personalizationEnabled]);
 useEffect(()=>{if(prefsLoaded&&(tab==='For You'||tab==='Following'))void loadFeed()},[personalizationEnabled,prefsLoaded,blockedKeywords,hideMatureContent,recommendationsResetAt]);
 async function requestAccountEmail(recovery:boolean){if(busy||!supabase)return;const address=email.trim();if(!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(address)){showAlert('Email required','Enter your email address first.');return}setBusy(true);try{const redirectTo=(api||'https://reconfeed.com')+'/app/';const r=recovery?await supabase.auth.resetPasswordForEmail(address,{redirectTo}):await supabase.auth.resend({type:'signup',email:address,options:{emailRedirectTo:redirectTo}});if(r.error)throw r.error;showAlert('Email requested',recovery?'If this account exists, a password reset email has been requested. Open its link to choose a new password.':'If this account needs confirmation, a new confirmation email has been requested. Already confirmed? Choose Sign in.')}catch(e:any){showAlert('Email unavailable',e.code==='over_email_send_rate_limit'?'Email sending is temporarily limited. Wait before trying again.':safeErrorMessage(e))}finally{setBusy(false)}}
 async function saveRecoveredPassword(){if(busy||!supabase)return;if(newPassword.length<12){showAlert('Stronger password required','Use at least 12 characters.');return}setBusy(true);try{const r=await supabase.auth.updateUser({password:newPassword});if(r.error)throw r.error;setNewPassword('');setRecovering(false);setTab('Profile');showAlert('Password updated','Your new password is saved.')}catch(e:any){showAlert('Password reset failed',safeErrorMessage(e))}finally{setBusy(false)}}
 async function auth(signup:boolean){if(busy)return;if(!supabase){showAlert('Setup required','Add the Supabase URL and public anon key to the mobile environment.');return}if(!email.trim()||password.length<6){showAlert('Check details','Enter an email and a password with at least 6 characters.');return}if(signup&&password.length<12){showAlert('Stronger password required','Use at least 12 characters for a new ReconFeed account. Existing accounts can still sign in with their current password.');return}if(signup&&!['MALE','FEMALE','Other'].includes(gender)){showAlert('Choose gender','Choose MALE, FEMALE, or Other to continue.');return}setBusy(true);try{const r=signup?await supabase.auth.signUp({email:email.trim(),password,options:{emailRedirectTo:(api||'https://reconfeed.com')+'/app/',data:{display_name:name||email.split('@')[0],gender}}}):await supabase.auth.signInWithPassword({email:email.trim(),password});if(r.error)throw r.error;if(signup&&!r.data.session)showAlert('Account request received','If this is a new account, check your email for confirmation. If you already confirmed this email, use Sign in with your original password or Forgot password.');else setTab('For You')}catch(e:any){showAlert('Account error',e.code==='invalid_credentials'?'Email or password did not match. Use your original account password, or choose Forgot password.':e.code==='over_email_send_rate_limit'?'Email sending is temporarily limited. Wait before requesting another email.':safeErrorMessage(e))}finally{setBusy(false)}}
 async function choose(){const p=await ImagePicker.requestMediaLibraryPermissionsAsync();if(!p.granted){showAlert('Permission needed','Allow media library access in settings.');return}const r=await ImagePicker.launchImageLibraryAsync({mediaTypes:['images','videos'],quality:.9,videoMaxDuration:90});if(!r.canceled)setAsset(r.assets[0])}
 async function capture(){try{
  const p=await ImagePicker.requestCameraPermissionsAsync();
  if(!p.granted){showAlert('Camera permission','Allow camera access to record a video or take a photo.');return}
  const result=await ImagePicker.launchCameraAsync({mediaTypes:captureMode==='video'?['videos']:['images'],quality:.9,videoMaxDuration:captureSeconds});
  if(!result.canceled&&result.assets?.[0])setAsset(result.assets[0]);
 }catch(e:any){showAlert('Camera unavailable',e?.message||'Try selecting media from your library instead.')}}

 async function publish(){if(!supabase||!session){showAlert('Sign in required','Sign in before publishing.');setTab('Profile');return}if(!asset){showAlert('Choose media','Select a photo or video first.');return}const maxBytes=24*1024*1024;if(asset.fileSize&&asset.fileSize>maxBytes){showAlert('File too large','This beta currently supports uploads up to 24 MB. Choose a smaller photo/video or compress the video, then try again.');return}setBusy(true);try{const connection=await supabase.from('profiles').select('id').eq('id',session.user.id).maybeSingle();if(connection.error){const msg=String(connection.error.message||'');if(/fetch|network|timeout|connection/i.test(msg))throw new Error('ReconFeed cannot reach the server. Check the phone’s Wi-Fi or mobile data, then try again.');throw connection.error}const response=await fetch(asset.uri);if(!response.ok)throw new Error('Could not read the selected media from this phone. Please choose it again.');const binary=await response.arrayBuffer();if(binary.byteLength>maxBytes){throw new Error('This file is over the 24 MB upload limit. Choose a smaller file or compress the video.')}const ext=(asset.fileName?.split('.').pop()||(asset.type==='video'?'mp4':'jpg')).toLowerCase().replace(/[^a-z0-9]/g,'');const path=session.user.id+'/'+Date.now()+'.'+ext;// Supabase currently caps the post-media bucket at 25 MB. Use a safe 24 MB application limit.
const mimeByExt:Record<string,string>={jpg:'image/jpeg',jpeg:'image/jpeg',png:'image/png',webp:'image/webp',gif:'image/gif',mp4:'video/mp4',mov:'video/quicktime',webm:'video/webm'};
const contentType=mimeByExt[ext]||asset.mimeType||(asset.type==='video'?'video/mp4':'image/jpeg');
const attemptUpload=()=>supabase.storage.from('post-media').upload(path,binary,{contentType,upsert:false});
let upload=await attemptUpload();
for(let retry=0;retry<2&&upload.error;retry++){
 const message=String(upload.error.message||'').toLowerCase();
 const status=String((upload.error as any).statusCode||(upload.error as any).status||'');
 // Retry only transient errors; policy, size and format errors must be shown to creators.
 if(!(/network|fetch|timeout|connection|temporarily|socket|reset/.test(message)||status==='429'||/^5\d\d$/.test(status)))break;
 await new Promise(resolve=>setTimeout(resolve,500*(retry+1)));
 upload=await attemptUpload();
}
if(upload.error){const raw=String(upload.error.message||'Storage upload failed');const status=String((upload.error as any).statusCode||(upload.error as any).status||'');console.error('ReconFeed media upload failed',{status,message:raw});if(/row-level security|policy|permission/i.test(raw))throw new Error('Supabase blocked this upload. Verify the signed-in user’s post-media Storage policy. '+raw);if(/bucket/i.test(raw))throw new Error('The Supabase post-media bucket is missing or misconfigured. '+raw);if(/network|fetch|timeout|connection/i.test(raw))throw new Error('Media upload request failed'+(status?' (HTTP '+status+')':'')+': '+raw+'. Keep the app open, check the connection, and retry.');throw new Error('Media upload failed'+(status?' (HTTP '+status+')':'')+': '+raw)}const media=supabase.storage.from('post-media').getPublicUrl(upload.data.path).data.publicUrl;const post=await supabase.from('posts').insert({user_id:session.user.id,caption:caption.trim(),media_url:media,media_type:asset.type==='video'?'video':'image',format:'Original',visibility:postPrivacy,
  topic_tags:parseCreatorTags(tagDraft),
  audio_label:audioLabelDraft.trim().slice(0,90),
  overlay_text:overlayTextDraft.trim().slice(0,500),
  transcript:transcriptDraft.trim().slice(0,2000),
  content_rating:creatorMature?'mature':'general'
 });if(post.error){await supabase.storage.from('post-media').remove([upload.data.path]);if(/network|fetch|timeout|connection/i.test(String(post.error.message||'')))throw new Error('Your media uploaded, but the post could not be saved because the connection failed. Reconnect and try again.');throw post.error}setCaption('');setAsset(null);setTagDraft('');setAudioLabelDraft('');setOverlayTextDraft('');setTranscriptDraft('');setCreatorMature(false);setPostPrivacy('public');setTab('For You');await loadFeed();showAlert('Published','Your post is live.')}catch(e:any){showAlert('Publish failed',safeErrorMessage(e))}finally{setBusy(false)}}
 async function openComments(p:Post){setCommentTarget(p);setCommentText('');setCommentItems([]);if(!supabase){showAlert('Setup required','Connect Supabase to load and publish comments.');return}setCommentsBusy(true);try{const r=await supabase.from('comments').select('id,post_id,user_id,body,created_at').eq('post_id',p.id).order('created_at',{ascending:true}).limit(100);if(r.error)throw r.error;const rows=r.data||[];const ids=[...new Set(rows.map((x:any)=>x.user_id))];const pr=ids.length?await supabase.from('profiles').select('id,username,display_name').in('id',ids):{data:[]};const byId:any={};(pr.data||[]).forEach((x:any)=>byId[x.id]=x);setCommentItems(rows.map((x:any)=>({...x,profiles:byId[x.user_id]})))}catch(e:any){showAlert('Comments unavailable',e.message)}finally{setCommentsBusy(false)}}
  async function submitComment(){if(!supabase||!session){showAlert('Sign in required','Sign in to comment.');setCommentTarget(null);setTab('Profile');return}if(!commentTarget||!commentText.trim())return;setCommentsBusy(true);try{const r=await supabase.from('comments').insert({post_id:commentTarget.id,user_id:session.user.id,body:commentText.trim()}).select('id,post_id,user_id,body,created_at').single();if(r.error)throw r.error;setCommentItems(items=>[...items,{...r.data,profiles:profile||{display_name:'You'}}]);setPosts(items=>items.map(p=>p.id===commentTarget.id?{...p,comments:[{count:Number(p.comments?.[0]?.count||0)+1}]}:p));setCommentText('')}catch(e:any){showAlert('Comment failed',e.message)}finally{setCommentsBusy(false)}}
  async function like(p:Post){if(!supabase||!session){showAlert('Sign in required','Sign in to like posts.');return}const userId=session.user.id;const operation='like:'+userId+':'+p.id;if(pendingInteractions.current.has(operation))return;pendingInteractions.current.add(operation);try{const ex=await supabase.from('likes').select('post_id').eq('post_id',p.id).eq('user_id',session.user.id).maybeSingle();if(ex.error)throw ex.error;const r=ex.data?await supabase.from('likes').delete().eq('post_id',p.id).eq('user_id',session.user.id):await supabase.from('likes').insert({post_id:p.id,user_id:session.user.id});if(r.error)throw r.error;if(accountRef.current!==userId)return;setPosts(items=>items.map(item=>item.id===p.id?{...item,likes:[{count:Math.max(0,Number(item.likes?.[0]?.count||0)+(ex.data?-1:1))}]}:item))}catch(e:any){showAlert('Like unavailable',safeErrorMessage(e))}finally{pendingInteractions.current.delete(operation)}}
 async function savePost(p:Post){if(!supabase||!session){showAlert('Sign in required','Sign in to save posts to your collection.');setTab('Profile');return}const userId=session.user.id;const operation='save:'+userId+':'+p.id;if(pendingInteractions.current.has(operation))return;pendingInteractions.current.add(operation);const already=savedPostIds.includes(p.id);try{if(already){const r=await supabase.from('saved_posts').delete().eq('user_id',session.user.id).eq('post_id',p.id);if(r.error)throw r.error;if(accountRef.current!==userId)return;setSavedPostIds(ids=>ids.filter(id=>id!==p.id))}else{const r=await supabase.from('saved_posts').insert({user_id:session.user.id,post_id:p.id});if(r.error)throw r.error;if(accountRef.current!==userId)return;setSavedPostIds(ids=>ids.includes(p.id)?ids:[...ids,p.id])}}catch(e:any){showAlert('Save unavailable',safeErrorMessage(e))}finally{pendingInteractions.current.delete(operation)}}
 async function follow(p:Post){if(!supabase||!session){showAlert('Sign in required','Sign in to follow creators.');return}if(p.user_id===session.user.id)return;const ex=await supabase.from('follows').select('following_id').eq('follower_id',session.user.id).eq('following_id',p.user_id).maybeSingle();if(ex.error){showAlert('Follow unavailable',ex.error.message);return}const r=ex.data?await supabase.from('follows').delete().eq('follower_id',session.user.id).eq('following_id',p.user_id):await supabase.from('follows').insert({follower_id:session.user.id,following_id:p.user_id});if(r.error)showAlert('Follow failed',r.error.message);else showAlert(ex.data?'Unfollowed':'Following',ex.data?'Creator unfollowed.':'You are following this creator.')}
 async function generate(){if(!session){showAlert('Sign in required','Sign in before using AI Studio.');setTab('Profile');return}if(!api){showAlert('AI setup required','Configure the deployed API URL and provider token before generating.');return}if(prompt.trim().length<8){showAlert('Add detail','Describe the creation in at least 8 characters.');return}setBusy(true);setAiStatus('Starting…');setAiUrl('');try{const r=await fetch(api+'/api/generate',{method:'POST',headers:{'Content-Type':'application/json','Authorization':'Bearer '+session.access_token},body:JSON.stringify({workflow,prompt,duration:5,aspectRatio:'9:16'})});const d=await r.json();if(!r.ok)throw new Error(d.error||'Generation could not start');if(d.output){setAiUrl(Array.isArray(d.output)?d.output[0]:d.output);setAiStatus('Ready')}else if(d.id){for(let i=0;i<60;i++){await new Promise(res=>setTimeout(res,4000));const rr=await fetch(api+'/api/generation-status?id='+encodeURIComponent(d.id),{headers:{'Authorization':'Bearer '+session.access_token}});const st=await rr.json();if(!rr.ok)throw new Error(st.error||'Could not check generation status');if(st.status==='succeeded'&&st.output){setAiUrl(Array.isArray(st.output)?st.output[0]:st.output);setAiStatus('Ready');return}if(['failed','canceled'].includes(st.status))throw new Error(st.error||'Generation failed');setAiStatus('Generating…')}setAiStatus('Still processing.')}else setAiStatus('Request accepted; no output returned yet.')}catch(e:any){setAiStatus('Unavailable');showAlert('AI Studio',e.message)}finally{setBusy(false)}}
 const media=(p:Post)=>{
  const focus=Math.max(0,posts.findIndex(item=>item.id===(activePostId||posts[0]?.id)));
  const position=posts.findIndex(item=>item.id===p.id);
  // Keep only the active player and its next two neighbors mounted; those can buffer ahead.
  // Distant videos stay unmounted to avoid too many decoders on a phone.
  const nearby=position>=0&&position>=focus-1&&position<=focus+2;
  if(p.media_type==='video'&&!nearby)return <View style={[s.fullMedia,{justifyContent:'center',alignItems:'center'}]}><Text style={{color:'#9caa96',fontSize:16}}>RECONFEED · VIDEO READY</Text></View>;
  return <>{p.media_type==='video'?<Video source={{uri:p.media_url}} onPlaybackStatusUpdate={status=>trackPlayback(p.id,status)} style={s.fullMedia} resizeMode={ResizeMode.COVER} shouldPlay={appActive&&!commentTarget&&!inboxOpen&&!collection&&(tab==='For You'||tab==='Following')&&p.id===(activePostId||posts[0]?.id)} isLooping isMuted={muted} progressUpdateIntervalMillis={500}/>:<Image source={{uri:p.media_url}} style={s.fullMedia} resizeMode="cover"/>}</>;
 };
 const feed=()=> <View style={{flex:1}}><View style={s.feedTop}><View style={s.feedOverline}><View style={s.liveDot}/><Text style={s.feedEyebrow}>{tab==='Following'?'YOUR COMMUNITY FEED':'PERSONALIZED FOR YOU'}</Text><Text style={s.feedEdition}>MORE THAN A SCROLL.</Text></View><View style={s.feedTabs}><Pressable onPress={()=>{setSearch('');setTab('For You')}}><Text style={[s.feedTab,tab==='For You'&&s.feedTabActive]}>For You</Text></Pressable><Pressable onPress={()=>{setSearch('');setTab('Following')}}><Text style={[s.feedTab,tab==='Following'&&s.feedTabActive]}>Following</Text></Pressable><Pressable onPress={()=>{setSearch('veteran');setTab('Discover')}}><Text style={s.feedTab}>Veterans</Text></Pressable><Pressable onPress={()=>{setSearch('outdoors');setTab('Discover')}}><Text style={s.feedTab}>Outdoors</Text></Pressable></View><TextInput value={search} onChangeText={setSearch} onSubmitEditing={()=>{setTab('Discover');void runExploreSearch(search)}} placeholder="⌕  Search people, @usernames or posts…" placeholderTextColor={theme.muted} returnKeyType="search" style={s.feedSearch}/><Pressable accessibilityRole="button" accessibilityLabel="Open people and creator search" style={[s.outline,{padding:10,marginTop:3}]} onPress={()=>setTab("Discover")}><Text style={s.link}>⌕ SEARCH PEOPLE ↗</Text></Pressable></View>{loading&&!posts.length?<View style={s.feedLoading}><ActivityIndicator color={theme.purple}/><Text style={s.muted}>Finding your next video…</Text></View>:posts.length?<FlatList data={posts} keyExtractor={p=>p.id} extraData={activePostId} windowSize={5} initialNumToRender={2} maxToRenderPerBatch={2} updateCellsBatchingPeriod={50} onEndReached={()=>{void loadMoreFeed()}} onEndReachedThreshold={0.65} ListFooterComponent={loadingMore?<ActivityIndicator color={theme.purple} style={{marginVertical:15}}/>:null} getItemLayout={(_,index)=>({length:Math.max(260,screenHeight-230)+10,offset:(Math.max(260,screenHeight-230)+10)*index,index})} pagingEnabled snapToInterval={Math.max(260,screenHeight-230)+10} decelerationRate="fast" showsVerticalScrollIndicator={false} onViewableItemsChanged={onViewableItemsChanged} viewabilityConfig={viewabilityConfig} refreshControl={<RefreshControl refreshing={loading} onRefresh={loadFeed} tintColor={theme.purple} colors={[theme.purple]}/>} renderItem={({item:p})=>{const pr=Array.isArray(p.profiles)?p.profiles[0]:p.profiles;const pageHeight=Math.max(260,screenHeight-230);return <View style={[s.videoPage,{height:pageHeight}]}><View style={s.videoCanvas}>{media(p)}</View><View pointerEvents="box-none" style={s.videoShade}/><View style={s.videoTopBadge}><Text style={s.videoBadgeText}>✦  RECONFEED ORIGINAL</Text></View><View style={s.videoInfo}><Pressable onPress={()=>setCollection({userId:p.user_id,saved:false})}><Text style={s.videoCreator}>@{pr?.username||pr?.display_name||'creator'}</Text></Pressable><Text style={s.videoCaption} numberOfLines={4}>{p.caption||'A new perspective from the ReconFeed community.'}</Text><Text style={s.videoMeta}>REAL PEOPLE  ·  REAL STORIES</Text></View><View style={s.videoActions}><Pressable style={s.actionButton} onPress={()=>like(p)}><Text style={s.actionIcon}>♥</Text><Text style={s.actionCount}>{p.likes?.[0]?.count||0}</Text></Pressable><Pressable style={s.actionButton} onPress={()=>openComments(p)}><Text style={s.actionIcon}>●</Text><Text style={s.actionCount}>{p.comments?.[0]?.count||0}</Text></Pressable><Pressable style={s.actionButton} onPress={()=>savePost(p)}><Text style={s.actionIcon}>{savedPostIds.includes(p.id)?'▣':'＋'}</Text><Text style={s.actionCount}>{savedPostIds.includes(p.id)?'Saved':'Save'}</Text></Pressable><Pressable style={s.actionButton} onPress={()=>follow(p)}><View style={s.followDisc}><Text style={s.followDiscText}>＋</Text></View><Text style={s.actionCount}>Follow</Text></Pressable><Pressable style={s.actionButton} onPress={()=>setMuted(value=>!value)}><Text style={s.actionIcon}>{muted?'◖×':'◖))'}</Text><Text style={s.actionCount}>{muted?'Unmute':'Mute'}</Text></Pressable><Pressable style={s.actionButton} onPress={async()=>{try{const result=await Share.share({message:'Check out this post on ReconFeed: '+p.caption+' '+p.media_url});if(result.action===Share.sharedAction)void recordFeedAction(p.id,'share')}catch(e){console.warn('Share cancelled or unavailable')}}}><Text style={s.actionIcon}>↗</Text><Text style={s.actionCount}>Share</Text></Pressable><Pressable style={s.actionButton} onPress={()=>showAlert('Not interested','Show fewer posts like this?', [{text:'Cancel',style:'cancel'},{text:'Not interested',onPress:()=>{setNotInterested(ids=>ids.includes(p.id)?ids:[...ids,p.id]);setPosts(items=>items.filter(x=>x.id!==p.id));void recordFeedAction(p.id,'not_interested')}}])}><Text style={s.actionIcon}>⊘</Text><Text style={s.actionCount}>Not interested</Text></Pressable><Pressable style={s.actionButton} onPress={()=>setReportTarget(p)}><Text style={s.actionIcon}>⚑</Text><Text style={s.actionCount}>Report</Text></Pressable></View></View>}}/>:<ImageBackground source={{uri:'https://images.pexels.com/photos/11389636/pexels-photo-11389636.jpeg?auto=compress&cs=tinysrgb&w=1000'}} style={s.emptyHero} imageStyle={s.emptyHeroImage}><View style={s.emptyHeroShade}><Text style={s.overlineGold}>VETERAN OWNED  /  RECONFEED</Text><Text style={s.heroTitle}>REAL PEOPLE.\nREAL STORIES.\n<Text style={{color:theme.purple}}>NO LIMITS.</Text></Text><Text style={s.heroBody}>{supabase?(tab==='Following'?'Follow creators from For You to see posts from your community.':'The feed is just getting started. Be the first to share a video or photo.'):'ReconFeed connects to the live community when Supabase is configured.'}</Text><Pressable style={s.button} onPress={()=>setTab('Create')}><Text style={s.buttonText}>✚ Open Creator Bay</Text></Pressable><Pressable style={s.outline} onPress={()=>{setSearch('');setTab('Discover')}}><Text style={s.link}>⌕ Find creators to follow</Text></Pressable><Pressable style={s.outline} onPress={loadFeed}><Text style={s.link}>↻ Refresh feed</Text></Pressable></View></ImageBackground>}</View>;
 async function loadMarketplace(categoryOverride=marketCategory,searchOverride=marketSearch){const request=++marketRequest.current;if(!supabase){setMarketListings([]);return}try{let q=supabase.from('marketplace_listings').select('id,seller_id,title,description,category,condition,price,location,image_urls,accepted_responsibility,seller_shipping_terms,created_at').eq('status','active').order('created_at',{ascending:false}).limit(60);if(categoryOverride!=='All')q=q.eq('category',categoryOverride);if(searchOverride.trim())q=q.ilike('title','%'+searchOverride.trim().replace(/[%_]/g,'')+'%');const r=await q;if(r.error)throw r.error;if(request===marketRequest.current)setMarketListings(r.data||[])}catch(e:any){if(request===marketRequest.current){console.warn('Marketplace:',e.message);showAlert('Marketplace unavailable',safeErrorMessage(e))}}}
 async function createListing(){if(!supabase||!session){showAlert('Sign in required','Sign in to list an item.');setTab('Profile');return}const enteredPrice=Number(marketPrice);if(marketTitle.trim().length<3||!marketPrice.trim()||!Number.isFinite(enteredPrice)||enteredPrice<=0||enteredPrice>1000000){showAlert('Listing details','Enter a title and a price greater than $0 and no more than $1,000,000.');return}if(!marketAck){showAlert('Seller responsibility required','Please accept the seller responsibility notice before publishing.');return}setBusy(true);try{const created=await supabase.from('marketplace_listings').insert({seller_id:session.user.id,title:marketTitle.trim(),description:marketDescription.trim(),category:marketCategory==='All'?'Other':marketCategory,condition:marketCondition,price:enteredPrice,location:marketLocation.trim(),accepted_responsibility:true,seller_shipping_terms:'Seller is responsible for determining shipping, delivery, payment, returns, and fulfillment terms directly with the buyer.',status:'draft'}).select('id').single();if(created.error)throw created.error;const published=await supabase.from('marketplace_listings').update({status:'active'}).eq('id',created.data.id).eq('seller_id',session.user.id).select('id').single();if(published.error)throw new Error('Your listing was saved as a draft but could not be published. '+published.error.message);setMarketTitle('');setMarketDescription('');setMarketPrice('');setMarketLocation('');setMarketAck(false);setMarketMode('browse');await loadMarketplace();showAlert('Listing published','Your listing is live. You are responsible for handling the sale, shipping, delivery, returns, and all transaction details.')}catch(e:any){showAlert('Could not publish listing',safeErrorMessage(e))}finally{setBusy(false)}}
 const marketplace=()=> <ScrollView keyboardShouldPersistTaps="handled"><ImageBackground source={{uri:'https://images.unsplash.com/photo-1500534623283-312aade485b7?auto=format&fit=crop&w=900&q=85'}} style={s.sectionHero} imageStyle={s.sectionHeroImage}><View style={s.sectionHeroInner}><Text style={s.overlineGold}>RECONFEED / COMMUNITY</Text><Text style={s.sectionHeroTitle}>FIELD EXCHANGE.</Text><Text style={s.sectionHeroSubtitle}>BUY. SELL. CONNECT.  •  Gear, vehicles, parts and more.</Text></View></ImageBackground><View style={s.row}><Pressable onPress={()=>setMarketMode('browse')} style={[s.chip,marketMode==='browse'&&s.selected]}><Text style={s.chipText}>Shop</Text></Pressable><Pressable onPress={()=>{if(!session){showAlert('Sign in required','Sign in to sell on ReconFeed.');setTab('Profile')}else{if(marketCategory==='All')setMarketCategory('Other');setMarketMode('sell')}}} style={[s.chip,marketMode==='sell'&&s.selected]}><Text style={s.chipText}>＋ Sell</Text></Pressable><Pressable onPress={()=>{void loadMarketplace()}} style={s.chip}><Text style={s.chipText}>↻ Refresh</Text></Pressable><Pressable onPress={()=>{if(!session){showAlert('Sign in required','Sign in to read your messages.');setTab('Profile');return}setMarketThread(null);setInboxOpen(true)}} style={s.chip}><Text style={s.chipText}>Messages</Text></Pressable></View>{marketMode==='sell'?<><Text style={s.subheading}>Create a listing</Text><TextInput value={marketTitle} onChangeText={setMarketTitle} maxLength={120} placeholder="Item title" placeholderTextColor={theme.muted} style={s.input}/><TextInput value={marketDescription} onChangeText={setMarketDescription} maxLength={5000} multiline placeholder="Description, features, condition, what’s included…" placeholderTextColor={theme.muted} style={[s.input,{height:95}]}/><TextInput value={marketPrice} onChangeText={setMarketPrice} keyboardType="decimal-pad" placeholder="Price in USD" placeholderTextColor={theme.muted} style={s.input}/><TextInput value={marketLocation} onChangeText={setMarketLocation} maxLength={160} placeholder="City / area (don’t post your street address)" placeholderTextColor={theme.muted} style={s.input}/><Text style={s.muted}>Category</Text><View style={s.row}>{['Vehicles','Parts & Accessories','Tools & Equipment','Outdoor & Lifestyle','Other'].map(x=><Pressable key={x} onPress={()=>setMarketCategory(x)} style={[s.chip,marketCategory===x&&s.selected]}><Text style={s.chipText}>{x}</Text></Pressable>)}</View><Text style={s.muted}>Condition</Text><View style={s.row}>{['New','Like new','Good','Fair','For parts','Used'].map(x=><Pressable key={x} onPress={()=>setMarketCondition(x)} style={[s.chip,marketCondition===x&&s.selected]}><Text style={s.chipText}>{x}</Text></Pressable>)}</View><View style={[s.card,{padding:14}]}><Text style={s.strong}>Seller responsibility — required</Text><Text style={s.muted}>You are responsible for your listing and transaction, including item accuracy and legality, pricing, buyer communication, payment arrangements, packaging, shipping, delivery, taxes, refunds, returns, warranties, and resolving disputes. ReconFeed does not sell, ship, store, inspect, or guarantee listed items and is not a party to the transaction. Your legal rights and obligations may vary; this notice does not waive liability where the law prohibits it.</Text><Pressable onPress={()=>setMarketAck(v=>!v)} style={[s.row,{marginTop:10}]}><Text style={{fontSize:24,color:marketAck?theme.purple:theme.muted}}>{marketAck?'☑':'☐'}</Text><Text style={[s.muted,{flex:1}]}>I understand and accept the seller responsibilities and marketplace terms.</Text></Pressable></View><Pressable style={s.button} disabled={busy||!marketAck} onPress={createListing}><Text style={s.buttonText}>{busy?'Publishing…':'▤ DEPLOY LISTING'}</Text></Pressable><Pressable style={s.outline} onPress={()=>setMarketMode('browse')}><Text style={s.link}>Cancel</Text></Pressable></>:<><TextInput value={marketSearch} onChangeText={setMarketSearch} onSubmitEditing={()=>{void loadMarketplace()}} placeholder="Search vehicles, parts, gear…" placeholderTextColor={theme.muted} style={s.input}/><ScrollView horizontal showsHorizontalScrollIndicator={false}>{['All','Vehicles','Parts & Accessories','Tools & Equipment','Outdoor & Lifestyle','Other'].map(x=><Pressable key={x} onPress={()=>{setMarketCategory(x);void loadMarketplace(x,marketSearch)}} style={[s.chip,marketCategory===x&&s.selected]}><Text style={s.chipText}>{x}</Text></Pressable>)}</ScrollView>{marketListings.length?marketListings.map((item:any)=><View key={item.id} style={s.card}><View style={s.row}><View style={{flex:1}}><Text style={s.strong}>{item.title}</Text><Text style={s.muted}>{item.category} · {item.condition}{item.location?' · '+item.location:''}</Text></View><Text style={[s.strong,{color:theme.purple,fontSize:18}]}>{Number(item.price||0).toLocaleString('en-US',{style:'currency',currency:'USD'})}</Text></View>{!!item.description&&<Text style={s.caption}>{item.description}</Text>}<Pressable style={s.outline} onPress={()=>{if(!session){showAlert('Sign in required','Sign in to contact the seller.');setTab('Profile');return}if(item.seller_id===session.user.id){setMarketThread(null);setInboxOpen(true);return}setMarketThread({listingId:item.id,peerId:item.seller_id,title:item.title});setInboxOpen(true)}}><Text style={s.link}>{item.seller_id===session?.user.id?'View messages':'Contact seller'}</Text></Pressable></View>):<View style={s.empty}><Text style={s.strong}>{supabase?'No listings yet':'Marketplace setup needed'}</Text><Text style={s.muted}>{supabase?'Be the first to list something for the community.':'Apply the marketplace database migration in Supabase to activate live listings.'}</Text><Pressable style={s.button} onPress={()=>{if(!session){showAlert('Sign in required','Sign in to sell on ReconFeed.');setTab('Profile')}else{if(marketCategory==='All')setMarketCategory('Other');setMarketMode('sell')}}}><Text style={s.buttonText}>＋ List an item</Text></Pressable></View>}<View style={[s.card,{padding:12}]}><Text style={s.strong}>Marketplace notice</Text><Text style={s.muted}>Buyers and sellers are responsible for their own transactions, payment, shipping, delivery, returns, and compliance with applicable laws. ReconFeed is a platform, not the seller or shipper. See the Marketplace Terms on reconfeed.com.</Text></View></>}</ScrollView>;

 const exploreCategories=[
  {label:'Trending',query:'',image:'https://images.unsplash.com/photo-1500534623283-312aade485b7?auto=format&fit=crop&w=640&q=83'},
  {label:'Veterans',query:'veteran',image:'https://images.pexels.com/photos/876345/pexels-photo-876345.jpeg?auto=compress&cs=tinysrgb&w=1000'},
  {label:'Trucks',query:'truck',image:'https://images.unsplash.com/photo-1533473359331-0135ef1b58bf?auto=format&fit=crop&w=640&q=83'},
  {label:'Outdoors',query:'outdoors',image:'https://images.unsplash.com/photo-1464822759023-fed622ff2c3b?auto=format&fit=crop&w=640&q=83'},
  {label:'Skilled Trades',query:'welding',image:'https://images.unsplash.com/photo-1504917595217-d4dc5ebe6122?auto=format&fit=crop&w=640&q=83'},
  {label:'Country Life',query:'country',image:'https://images.unsplash.com/photo-1500382017468-9049fed747ef?auto=format&fit=crop&w=640&q=83'},
  {label:'Builds & Mechanics',query:'build',image:'https://images.unsplash.com/photo-1486262715619-67b85e0b08d3?auto=format&fit=crop&w=640&q=83'},
  {label:'Tools',query:'tools',image:'https://images.unsplash.com/photo-1530122037265-a5f1f91d3b99?auto=format&fit=crop&w=640&q=83'},
  {label:'Fitness',query:'fitness',image:'https://images.unsplash.com/photo-1534438327276-14e5300c3a48?auto=format&fit=crop&w=640&q=83'}
 ];
 const exploreView=()=> <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={s.exploreContent}>
  <View style={s.exploreHeading}><Text style={s.screenDisplayTitle}>EXPLORE</Text><Text style={s.exploreSub}>MILITARY ROOTS  /  REAL WORK  /  REAL PEOPLE</Text></View>
  <View style={s.exploreSearchRow}><Text style={s.exploreSearchIcon}>⌕</Text><TextInput value={search} onChangeText={setSearch} onSubmitEditing={()=>{void runExploreSearch(search)}} returnKeyType="search" placeholder="Search creators, tags, or videos..." placeholderTextColor="#aab6a4" style={s.exploreSearch}/><Pressable accessibilityRole="button" accessibilityLabel="Search" onPress={()=>{void runExploreSearch(search)}} style={s.exploreSearchGo}><Text style={s.exploreSearchGoText}>↗</Text></Pressable></View>
  <View style={s.exploreGrid}>{exploreCategories.map(item=><Pressable accessibilityRole="button" accessibilityLabel={'Browse '+item.label} key={item.label} style={s.exploreTile} onPress={()=>{setSearch(item.query)}}><ImageBackground source={{uri:item.image}} style={s.exploreTileImage} imageStyle={{borderRadius:10}}><View style={s.exploreTileOverlay}><Text style={s.exploreTileLabel}>{item.label}</Text><Text style={s.exploreTileArrow}>↗</Text></View></ImageBackground></Pressable>)}</View>
  {exploreBusy&&<ActivityIndicator color={theme.purple} style={{marginVertical:18}}/>}
  {exploreSearched&&!exploreBusy&&<View style={{paddingVertical:16,gap:12}}>
   <Text style={s.heading}>SEARCH RESULTS {search.trim()?'· '+search.trim():''}</Text>
   <Text style={s.subheading}>{search.trim()?'MATCHING PEOPLE':'DISCOVER CREATORS & PEOPLE YOU MAY KNOW'} ({exploreCreators.length})</Text>
   {exploreCreators.map(creator=><Pressable key={creator.id} accessibilityRole="button" accessibilityLabel={'Open '+(creator.display_name||creator.username)+' profile'} onPress={()=>{void openCreatorProfile(creator)}} style={[s.card,{flexDirection:'row',alignItems:'center',gap:12}]}>
    {creator.avatar_url?<Image source={{uri:creator.avatar_url}} style={{width:48,height:48,borderRadius:24}}/>:<View style={[s.profileAvatar,{width:48,height:48,borderRadius:24}]}><Text style={s.profileAvatarText}>{(creator.display_name||creator.username||'?')[0].toUpperCase()}</Text></View>}
    <View style={{flex:1}}><Text style={s.strong}>{creator.display_name||creator.username}</Text><Text style={s.muted}>@{creator.username}</Text><Text style={s.muted} numberOfLines={2}>{creator.bio||''}</Text>{!search.trim()&&suggestedCreatorIds.includes(creator.id)&&<Text style={{fontSize:11,color:'#C6AA72',fontWeight:'800'}}>Suggested · shared connections</Text>}</View><Text style={s.link}>VIEW ↗</Text>
   </Pressable>)}
   {search.trim()?<Text style={s.subheading}>VIDEOS & POSTS ({exploreResults.length})</Text>:<Text style={s.muted}>Tap a creator to view their profile. Posts will appear here once the community starts sharing.</Text>}
   {exploreResults.map(post=><Pressable key={post.id} onPress={()=>setExploreSelected(post)} style={[s.card,{flexDirection:'row',gap:12,alignItems:'center'}]}>
    {post.media_type==='image'?<Image source={{uri:post.media_url}} style={{width:66,height:82,borderRadius:7,backgroundColor:theme.panel}}/>:<View style={{width:66,height:82,borderRadius:7,alignItems:'center',justifyContent:'center',backgroundColor:'#263F63'}}><Text style={{fontSize:24,color:'#F0EEE5'}}>▶</Text></View>}
    <View style={{flex:1}}><Text style={s.strong} numberOfLines={2}>{post.caption||'ReconFeed story'}</Text><Text style={s.muted}>Tap to {post.media_type==='video'?'play video':'view photo'} ↗</Text></View>
   </Pressable>)}
   {!exploreResults.length&&!exploreCreators.length&&<Text style={s.muted}>No matching creators or posts. Try part of a username such as AngelicSlick, or check your connection.</Text>}
  </View>}
  <Modal visible={!!viewingCreator} animationType="slide" onRequestClose={()=>setViewingCreator(null)}>
   <SafeAreaView style={s.safe}>
    <ScrollView contentContainerStyle={{padding:17,gap:13}}>
     <Pressable accessibilityRole="button" style={s.outline} onPress={()=>setViewingCreator(null)}><Text style={s.link}>← Back to search</Text></Pressable>
     {viewingCreator&&<View style={s.profileHero}>
      <View style={s.profileAvatar}>{viewingCreator.avatar_url?<Image source={{uri:viewingCreator.avatar_url}} style={{width:'100%',height:'100%',borderRadius:44}}/>:<Text style={s.profileAvatarText}>{(viewingCreator.display_name||viewingCreator.username||'?')[0].toUpperCase()}</Text>}</View>
      <Text style={s.profileName}>{viewingCreator.display_name||viewingCreator.username}</Text>
      <Text style={s.profileHandle}>@{viewingCreator.username} {viewingCreator.pronouns?'· '+viewingCreator.pronouns:''}</Text>
      <Text style={s.profileBio}>{viewingCreator.bio||'ReconFeed creator'}</Text>
      {session?.user.id!==viewingCreator.id&&<Pressable style={s.button} accessibilityRole="button" onPress={()=>{void follow({user_id:viewingCreator.id} as Post)}}><Text style={s.buttonText}>+ Follow creator</Text></Pressable>}
      <Pressable style={s.outline} onPress={()=>{void shareProfile(viewingCreator.username)}}><Text style={s.link}>↗ Share profile</Text></Pressable>
      {viewingCreator.website_url?<Pressable accessibilityRole="link" onPress={()=>{void Linking.openURL(viewingCreator.website_url)}}><Text style={s.link}>⌁ {viewingCreator.website_url}</Text></Pressable>:null}
      {session?.user.id!==viewingCreator.id&&session&&<Pressable style={s.outline} onPress={()=>{void blockCreator(viewingCreator.id)}}><Text style={[s.link,{color:'#B83235'}]}>⊘ Block creator</Text></Pressable>}
      {session?.user.id===viewingCreator.id&&<Text style={s.muted}>This is your profile.</Text>}
     </View>}
     <Text style={s.subheading}>PUBLIC POSTS ({viewingCreatorPosts.length})</Text>
     {creatorProfileLoading?<ActivityIndicator color={theme.purple}/>:viewingCreatorPosts.length
      ?viewingCreatorPosts.map(p=><Pressable key={p.id} onPress={()=>{setViewingCreator(null);setExploreSelected(p)}} style={[s.card,{flexDirection:'row',alignItems:'center',gap:13}]}>
       {p.media_type==='image'?<Image source={{uri:p.media_url}} style={{width:75,height:93,borderRadius:5}}/>:<View style={{width:75,height:93,backgroundColor:'#263F63',alignItems:'center',justifyContent:'center',borderRadius:5}}><Text style={{fontSize:25,color:'#F0EEE5'}}>▶</Text></View>}
       <Text numberOfLines={3} style={[s.muted,{flex:1}]}>{p.caption||'View post →'}</Text>
      </Pressable>)
      :<Text style={s.muted}>This creator hasn't published any public posts yet.</Text>}
    </ScrollView>
   </SafeAreaView>
  </Modal>
  <Modal visible={!!exploreSelected} animationType="slide" onRequestClose={()=>setExploreSelected(null)}>
   <SafeAreaView style={[s.safe,{padding:12}]}><Pressable onPress={()=>setExploreSelected(null)} style={s.outline}><Text style={s.link}>✕ Close search result</Text></Pressable>
   {exploreSelected?.media_type==='video'?<Video source={{uri:exploreSelected.media_url}} style={{flex:1,width:'100%'}} useNativeControls shouldPlay resizeMode={ResizeMode.CONTAIN}/>:exploreSelected?<Image source={{uri:exploreSelected.media_url}} style={{flex:1,width:'100%'}} resizeMode="contain"/>:null}
   <Text style={s.muted}>{exploreSelected?.caption||''}</Text></SafeAreaView>
  </Modal>
  <Pressable accessibilityRole="button" onPress={()=>setTab('Market')} style={s.exchangePromo}><Text style={s.exchangePromoBig}>▣  FIELD EXCHANGE</Text><Text style={s.exchangePromoSmall}>BUY · SELL · MESSAGE  /  EXPLORE THE MARKETPLACE  ↗</Text></Pressable>
 </ScrollView>;

 const create=()=> <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={s.createContent}>
 <View style={s.exploreHeading}><Text style={s.screenDisplayTitle}>CREATE</Text><Text style={s.exploreSub}>CAPTURE IT. SHARE IT. OWN YOUR STORY.</Text></View>
 <ImageBackground source={{uri:asset?.type==='image'?asset.uri:'https://images.pexels.com/photos/11389636/pexels-photo-11389636.jpeg?auto=compress&cs=tinysrgb&w=1000'}} style={s.cameraStage} imageStyle={s.cameraStageImage}>
  <View style={s.cameraTop}><Text style={s.cameraCancel}>✦  RECONFEED / CREATOR STUDIO</Text><Pressable onPress={()=>showAlert('Audio tools','Music and audio editing tools are planned for a future update. You can publish videos with their existing audio.')} style={s.addSound}><Text style={s.addSoundText}>♫  Add Sound</Text></Pressable></View>
  <View style={s.cameraMid}><Text style={s.cameraMessage}>{asset?(asset.fileName||'Media ready to publish'):'REAL PEOPLE. REAL STORIES.\nBUILT DIFFERENT.'}</Text><View style={s.cameraTools}><Pressable onPress={()=>showAlert('Camera controls','Your device camera provides its available front/back controls. Tap Record below to launch it.')}><Text style={s.cameraTool}>⟳</Text><Text style={s.cameraToolLabel}>Flip</Text></Pressable><Pressable onPress={()=>showAlert('Speed','Video speed controls are planned for a future update.')}><Text style={s.cameraTool}>◷</Text><Text style={s.cameraToolLabel}>Speed</Text></Pressable><Pressable onPress={()=>showAlert('Filters','Video filters are planned for a future update.')}><Text style={s.cameraTool}>✧</Text><Text style={s.cameraToolLabel}>Filters</Text></Pressable><Pressable onPress={()=>showAlert('Timer','Choose 15, 60, or 90 seconds below to set your maximum clip duration.')}><Text style={s.cameraTool}>◴</Text><Text style={s.cameraToolLabel}>Timer</Text></Pressable></View></View>
  <View style={s.cameraBottom}>
   <View style={s.captureModes}>{[15,60,90].map(seconds=><Pressable key={seconds} onPress={()=>{setCaptureMode('video');setCaptureSeconds(seconds)}}><Text style={[s.captureMode,captureMode==='video'&&captureSeconds===seconds&&s.captureModeActive]}>{seconds}s</Text></Pressable>)}<Pressable onPress={()=>setCaptureMode('photo')}><Text style={[s.captureMode,captureMode==='photo'&&s.captureModeActive]}>Photo</Text></Pressable></View>
   <View style={s.captureActions}><Pressable onPress={choose} accessibilityRole="button" accessibilityLabel="Select gallery media" style={s.galleryButton}><Text style={s.galleryIcon}>▧</Text><Text style={s.galleryLabel}>GALLERY</Text></Pressable><Pressable accessibilityRole="button" accessibilityLabel={captureMode==='photo'?'Take photo with grenade-shaped shutter':'Record video with grenade-shaped button'} accessibilityHint="Opens the device camera" onPress={capture} style={s.recordOuter}><View style={s.grenadePinRing}/><View style={s.grenadePinStem}/><View style={s.grenadeLever}/><View style={s.grenadeBody}><View style={s.grenadeSeamHorizontal}/><View style={s.grenadeSeamVertical}/><View style={s.recordInner}/></View><Text style={s.grenadeLabel}>{captureMode==='photo'?'SNAP':'REC'}</Text></Pressable><Pressable onPress={()=>setTab('Profile')} accessibilityRole="button" accessibilityLabel="Open profile" style={s.galleryButton}><Text style={s.galleryIcon}>◈</Text><Text style={s.galleryLabel}>PROFILE</Text></Pressable></View>
   <Text style={s.captureHint}>GRENADE RECORD CONTROL · Device camera · {captureMode==='photo'?'Photo':captureSeconds+'s max'}</Text>
  </View>
 </ImageBackground><Pressable style={s.picker} onPress={choose}><Text style={s.link}>▤ Load media</Text><Text style={s.muted}>{asset?.fileName|| (asset?'Media selected':'Up to 90 seconds')}</Text></Pressable>{asset?.type==='image'&&<Image source={{uri:asset.uri}} style={s.preview}/>}
 {asset?.type==='video'&&<View style={s.card}><Text style={s.subheading}>VIDEO PREVIEW · REVIEW BEFORE POSTING</Text><Video key={asset.uri} source={{uri:asset.uri}} style={{width:'100%',height:310,backgroundColor:'#000'}} useNativeControls resizeMode={ResizeMode.CONTAIN}/></View>}
 {!!asset&&<Pressable style={s.outline} accessibilityRole="button" onPress={()=>{setAsset(null);setCaption('')}}><Text style={s.link}>✕ Delete draft / Retake</Text></Pressable>}
 <Text style={s.subheading}>WHO CAN SEE THIS POST?</Text>
 <View style={s.row}>{[{key:'public',label:'Everyone'},{key:'followers',label:'Followers'},{key:'private',label:'Only me'}].map(option=><Pressable key={option.key} style={[s.chip,postPrivacy===option.key&&s.selected]} onPress={()=>setPostPrivacy(option.key as any)}><Text style={s.chipText}>{option.label}</Text></Pressable>)}</View>
 <TextInput value={caption} onChangeText={setCaption} multiline placeholder="Describe the video; include relevant keywords and hashtags…" placeholderTextColor={theme.muted} style={[s.input,{height:90}]}/>
 <Text style={s.subheading}>FIELD TAGS & AUDIO</Text>
 <TextInput value={tagDraft} onChangeText={setTagDraft} maxLength={300} placeholder="Tags: trucks, welding, outdoors (up to 12)" placeholderTextColor={theme.muted} style={s.input}/>
 <TextInput value={audioLabelDraft} onChangeText={setAudioLabelDraft} maxLength={90} placeholder="Audio or sound name (optional, descriptive)" placeholderTextColor={theme.muted} style={s.input}/>
 <TextInput value={overlayTextDraft} onChangeText={setOverlayTextDraft} maxLength={500} multiline placeholder="On-screen text (optional; enter manually)" placeholderTextColor={theme.muted} style={[s.input,{minHeight:65}]}/>
 <TextInput value={transcriptDraft} onChangeText={setTranscriptDraft} maxLength={2000} multiline placeholder="Spoken words / transcript (optional; enter manually)" placeholderTextColor={theme.muted} style={[s.input,{minHeight:72}]}/>
 <Pressable accessibilityRole="button" style={s.outline} onPress={()=>setCreatorMature(v=>!v)}>
  <Text style={s.link}>Content rating: {creatorMature?'Mature themes (18+)':'General audience'} ↕</Text>
 </Pressable>
 <Text style={s.muted}>Add accurate tags to help discovery. Repetitive spam and extreme hashtag stuffing can send posts for recommendation review. Automatic speech transcription and licensed sounds are not yet supported.</Text>
 <Pressable style={s.button} disabled={busy} onPress={publish}><Text style={s.buttonText}>{busy?'Deploying…':'⌖ DEPLOY POST'}</Text></Pressable><View style={s.rule}/><Text style={s.subheading}>AI CONCEPT LAB</Text><ScrollView horizontal showsHorizontalScrollIndicator={false}>{[{id:'text-video',label:'Text → video'},{id:'image',label:'Image from prompt'}].map(x=><Pressable key={x.id} onPress={()=>setWorkflow(x.id)} style={[s.chip,workflow===x.id&&s.selected]}><Text style={s.chipText}>{x.label}</Text></Pressable>)}</ScrollView><TextInput value={prompt} onChangeText={setPrompt} multiline placeholder="Describe your scene or edit…" placeholderTextColor={theme.muted} style={[s.input,{height:100}]}/><Pressable style={s.outline} onPress={generate} disabled={busy}><Text style={s.link}>{busy?'Working…':'⌖ Generate concept'}</Text></Pressable>{!!aiStatus&&<Text style={s.muted}>{aiStatus}</Text>}{!!aiUrl&&<View style={s.card}><Text style={s.strong}>Your output</Text>{workflow==='image'?<Image source={{uri:aiUrl}} style={s.preview}/>:<Video source={{uri:aiUrl}} style={s.media} useNativeControls/>}<Pressable onPress={()=>{setAsset({uri:aiUrl,type:workflow==='image'?'image':'video',width:0,height:0} as ImagePicker.ImagePickerAsset)}}><Text style={s.link}>Use output in post</Text></Pressable></View>}</ScrollView>;
 const profileView=()=> <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={s.profileScreenContent}>
{!session?<><Text style={s.sectionEyebrow}>JOIN THE RECONFEED COMMUNITY</Text><ImageBackground source={{uri:'https://images.pexels.com/photos/876345/pexels-photo-876345.jpeg?auto=compress&cs=tinysrgb&w=1000'}} style={s.loginHero} imageStyle={s.sectionHeroImage}><View style={s.loginHeroInner}><Image source={require('./assets/icon.png')} style={s.loginEmblem}/><Text style={s.loginMotto}>MORE THAN A SCROLL.\n<Text style={{color:theme.purple}}>IT'S A BROTHERHOOD.</Text></Text></View></ImageBackground></>:null}
{session?<>
 <View style={s.profileTopBar}>
  <Pressable style={s.profileTopIcon} accessibilityRole="button" accessibilityLabel="Edit your profile" onPress={()=>{setProfileEditOpen(v=>!v);setProfileSettingsOpen(false)}}>
   <Text style={s.profileTopIconText}>✎</Text>
  </Pressable>
  <View style={s.profileTopBrand}><Text style={s.profileTopBrandText}>RECON<Text style={{color:'#C6AA72'}}>FEED</Text></Text><Text style={s.profileTopBrandSub}>CREATOR PROFILE</Text></View>
  <View style={{flexDirection:'row',gap:5}}>
   <Pressable style={s.profileTopIcon} accessibilityRole="button" accessibilityLabel="Find other creators" onPress={()=>setTab('Discover')}><Text style={s.profileTopIconText}>♧</Text></Pressable>
   <Pressable style={s.profileTopIcon} accessibilityRole="button" accessibilityLabel="Share your profile" onPress={()=>{void shareProfile(profile?.username||'')}}><Text style={s.profileTopIconText}>↗</Text></Pressable>
   <Pressable style={s.profileTopIcon} accessibilityRole="button" accessibilityLabel="Open profile settings" onPress={()=>{setProfileSettingsOpen(v=>!v);setProfileEditOpen(false)}}><Text style={s.profileTopIconText}>☰</Text></Pressable>
  </View>
 </View>
 <View style={s.profileHeaderBlock}>
  <View style={s.profileIdentity}>
   <View style={s.profileIdentityText}>
    <Text style={s.profileIdentityName} numberOfLines={2}>{profile?.display_name||session.user.email?.split('@')[0]||'ReconFeed Creator'}</Text>
    <Text style={s.profileIdentityHandle}>@{profile?.username||'creator'}</Text>
    {isBetaTester&&<View style={s.profileBadge}><Text style={s.profileBadgeText}>✦ VERIFIED BETA TESTER</Text></View>}
   </View>
   <Pressable accessibilityRole="button" accessibilityLabel="Change profile picture" onPress={()=>{setProfileEditOpen(true);void chooseProfilePhoto()}} style={s.profileIdentityAvatar}>
    {profile?.avatar_url?<Image source={{uri:profile.avatar_url}} style={s.profileIdentityAvatarImage}/>:<Text style={s.profileIdentityAvatarInitial}>{(profile?.display_name||session.user.email||'R')[0].toUpperCase()}</Text>}
    <View style={s.profileAvatarAdd}><Text style={s.profileAvatarAddText}>+</Text></View>
   </Pressable>
  </View>
  <View style={s.profileNumbers}>
   <Pressable onPress={()=>setTab('Discover')} style={s.profileNumberBox} accessibilityRole="button" accessibilityLabel="Find accounts to follow"><Text style={s.profileNumberValue}>{profileStats.following.toLocaleString()}</Text><Text style={s.profileNumberLabel}>Following</Text></Pressable>
   <View style={s.profileNumberBox}><Text style={s.profileNumberValue}>{profileStats.followers.toLocaleString()}</Text><Text style={s.profileNumberLabel}>Followers</Text></View>
   <View style={s.profileNumberBox}><Text style={s.profileNumberValue}>{profileStats.likes.toLocaleString()}</Text><Text style={s.profileNumberLabel}>Likes</Text></View>
  </View>
  <Text style={s.profileMainBio}>{profile?.bio||'Real people. Real stories. Built different.'}</Text>
  {creatorSettings.pronouns?<Text style={s.profileMetaLine}>{creatorSettings.pronouns}</Text>:null}
  {creatorSettings.website_url?<Pressable accessibilityRole="link" onPress={()=>{void Linking.openURL(creatorSettings.website_url)}}><Text style={s.profileLink}>⌁ {creatorSettings.website_url} ↗</Text></Pressable>:null}
  <Text style={s.profileMetaLine}>{creatorSettings.account_type==='business'?'BUSINESS':'CREATOR'} ACCOUNT  ·  {creatorSettings.is_private?'PRIVATE POSTS':'PUBLIC POSTS'}  ·  VETERAN OWNED PLATFORM</Text>
  <View style={s.profileActionRow}>
   <Pressable style={s.profileActionPill} accessibilityRole="button" onPress={()=>{setProfileEditOpen(v=>!v);setProfileSettingsOpen(false)}}><Text style={s.profileActionLabel}>✎  EDIT PROFILE</Text></Pressable>
   <Pressable style={s.profileActionPill} accessibilityRole="button" onPress={()=>{setProfileSettingsOpen(v=>!v);setProfileEditOpen(false)}}><Text style={s.profileActionLabel}>⚙  CREATOR STUDIO</Text></Pressable>
  </View>
 </View>
 <View style={s.profileContentTabs}>
 {([{id:'videos',symbol:'▦',label:'Videos'},{id:'photos',symbol:'▧',label:'Photos'},{id:'saved',symbol:'☆',label:'Favorites'},{id:'liked',symbol:'♡',label:'Liked'}] as const).map(item=>
 <Pressable accessibilityRole="tab" accessibilityState={{selected:profileGridTab===item.id}} accessibilityLabel={item.label} key={item.id} onPress={()=>{
  setProfileGridTab(item.id);setProfileGridLimit(12);
  if(item.id==='saved')setCollection({saved:true});
  if(item.id==='liked')setCollection({saved:false,liked:true});
 }} style={[s.profileContentTab,profileGridTab===item.id&&s.profileContentTabActive]}><Text style={[s.profileContentTabIcon,profileGridTab===item.id&&s.profileContentTabIconActive]}>{item.symbol}</Text></Pressable>)}
 </View>
 <View style={s.profileTileGrid}>
 {profileGridTab==='saved'||profileGridTab==='liked'?<View style={s.profileTabEmpty}><Text style={s.profileEmptyTitle}>{profileGridTab==='saved'?'YOUR FAVORITES':'LIKED VIDEOS'}</Text><Text style={s.profileEmptyBody}>{profileGridTab==='saved'?'Saved posts are private to you.':'Liked videos are private by default.'}</Text><Pressable accessibilityRole="button" onPress={()=>setCollection(profileGridTab==='saved'?{saved:true}:{saved:false,liked:true})} style={s.profileTabButton}><Text style={s.profileActionLabel}>OPEN COLLECTION ↗</Text></Pressable></View>
 :profilePosts.filter(p=>profileGridTab==='photos'?p.media_type==='image':p.media_type==='video').length
 ? profilePosts.filter(p=>profileGridTab==='photos'?p.media_type==='image':p.media_type==='video').slice(0,profileGridLimit).map(p=>
  <Pressable key={p.id} accessibilityRole="button" accessibilityLabel={'View '+(p.caption||'post')} onPress={()=>setProfileSelected(p)} style={s.profileVideoTile}>
   {p.media_type==='image'?<Image source={{uri:p.media_url}} style={s.profileVideoThumbnail} resizeMode="cover"/>:<Video source={{uri:p.media_url}} style={s.profileVideoThumbnail} resizeMode={ResizeMode.COVER} shouldPlay={false} isMuted isLooping={false}/>}
   <View pointerEvents="none" style={s.profileTileShade}/>
   {p.pinned_at?<View pointerEvents="none" style={s.profilePinBadge}><Text style={s.profilePinText}>★ PINNED</Text></View>:null}
   <View pointerEvents="none" style={s.profileViewsBadge}><Text style={s.profileViewsText}>▶ {Number(profileViewCounts[p.id]||0).toLocaleString()}</Text></View>
   {profileEditOpen?<View style={s.profileTileEditTools}>
    <Pressable accessibilityRole="button" accessibilityLabel={p.pinned_at?'Unpin post':'Pin post'} onPress={()=>{void togglePinPost(p.id,!!p.pinned_at)}} style={s.profileTileTool}><Text style={s.profileTileToolText}>{p.pinned_at?'UNPIN':'☆ PIN'}</Text></Pressable>
    <Pressable accessibilityRole="button" accessibilityLabel="Delete post" onPress={()=>deleteOwnPost(p.id)} style={[s.profileTileTool,{backgroundColor:'#8c2c2c'}]}><Text style={s.profileTileToolText}>DELETE</Text></Pressable>
   </View>:null}
  </Pressable>
 )
 : <View style={s.profileTabEmpty}><Text style={s.profileEmptyTitle}>{profileLoading?'LOADING YOUR POSTS…':profileGridTab==='photos'?'YOUR PHOTOS WILL APPEAR HERE':'YOUR VIDEO GRID IS WAITING'}</Text><Text style={s.profileEmptyBody}>Record your first story to start building your ReconFeed profile.</Text><Pressable onPress={()=>setTab('Create')} style={s.profileTabButton}><Text style={s.profileActionLabel}>＋ CREATE A POST</Text></Pressable></View>}
 </View>
 {(['videos','photos'] as string[]).includes(profileGridTab)&&profilePosts.filter(p=>profileGridTab==='photos'?p.media_type==='image':p.media_type==='video').length>profileGridLimit?
 <Pressable accessibilityRole="button" style={s.profileLoadMore} onPress={()=>setProfileGridLimit(n=>n+12)}><Text style={s.profileActionLabel}>SHOW MORE POSTS ↓</Text></Pressable>:null}
 <Modal visible={!!profileSelected} animationType="slide" onRequestClose={()=>setProfileSelected(null)}>
  <SafeAreaView style={s.safe}><Pressable style={s.profileCloseVideo} onPress={()=>setProfileSelected(null)}><Text style={s.profileActionLabel}>← BACK TO PROFILE</Text></Pressable>
   {profileSelected?.media_type==='video'?<Video key={profileSelected.id} source={{uri:profileSelected.media_url}} shouldPlay isLooping useNativeControls resizeMode={ResizeMode.CONTAIN} style={{width:'100%',flex:1,backgroundColor:'#050806'}}/>:profileSelected?<Image source={{uri:profileSelected.media_url}} style={{flex:1,width:'100%'}} resizeMode="contain"/>:null}
   <Text style={[s.muted,{padding:14}]}>{profileSelected?.caption||''}</Text>
  </SafeAreaView>
 </Modal>
 <View style={s.profileBelowGrid}>
<View style={s.row}><Pressable style={s.chip} onPress={()=>setCollection({userId:session.user.id,saved:false})}><Text style={s.chipText}>My posts</Text></Pressable><Pressable style={s.chip} onPress={()=>setCollection({saved:true})}><Text style={s.chipText}>Saved posts ({savedPostIds.length})</Text></Pressable><Pressable style={s.chip} onPress={()=>{setMarketThread(null);setInboxOpen(true)}}><Text style={s.chipText}>Market messages</Text></Pressable></View>{profileEditOpen&&<View style={s.profileEditorSheet}><Text style={s.subheading}>EDIT YOUR PROFILE</Text><Text style={s.muted}>Your name, avatar, pronouns and bio help people find and recognize you. Other public links are under Settings.</Text><Pressable onPress={chooseProfilePhoto} style={s.outline}><Text style={s.link}>◉ Choose custom profile picture</Text></Pressable>{profileAvatarDraft&&<Image source={{uri:profileAvatarDraft.uri}} style={{width:100,height:100,borderRadius:50,alignSelf:'center',marginVertical:12}}/>}
 <TextInput value={profileUsernameDraft} onChangeText={setProfileUsernameDraft} maxLength={24} autoCapitalize="none" placeholder="@username" placeholderTextColor={theme.muted} style={s.input}/>
 <TextInput value={name} onChangeText={setName} maxLength={80} placeholder="Display name" placeholderTextColor={theme.muted} style={s.input}/>
 <TextInput value={profileBioDraft} onChangeText={setProfileBioDraft} maxLength={80} multiline placeholder="Your bio (80 characters max)" placeholderTextColor={theme.muted} style={[s.input,{height:90}]}/>
 <Pressable style={s.outline} disabled={busy} onPress={saveFullProfile}><Text style={s.link}>{busy?'Saving…':'Save profile changes'}</Text></Pressable><View style={s.rule}/>
</View>}
 {profileSettingsOpen&&<View style={[s.card,{gap:13,marginVertical:14,borderColor:'#C6AA72',borderWidth:1}]}>
  <Text style={s.heading}>≡ RECONFEED ACCOUNT CONTROL</Text>
  <Text style={s.muted}>These settings save to your account. Personal and Business are profile categories; paid rewards, commercial music rights, passkeys and DM features are not enabled here.</Text>
  <Text style={s.subheading}>ACCOUNT TYPE</Text>
  <View style={s.row}>
   {(['personal','business'] as const).map(type=><Pressable key={type} style={[s.chip,creatorSettings.account_type===type&&s.selected]} onPress={()=>setCreatorSettings(v=>({...v,account_type:type}))}><Text style={s.chipText}>{type==='business'?'Business':'Personal'}</Text></Pressable>)}
  </View>
  <Text style={s.subheading}>PUBLIC IDENTITY & LINKS</Text>
  <TextInput value={creatorSettings.pronouns} onChangeText={value=>setCreatorSettings(v=>({...v,pronouns:value}))} maxLength={30} placeholder="Pronouns (optional)" placeholderTextColor={theme.muted} style={s.input}/>
  <TextInput value={creatorSettings.website_url} onChangeText={value=>setCreatorSettings(v=>({...v,website_url:value}))} maxLength={200} autoCapitalize="none" placeholder="Website: https://…" placeholderTextColor={theme.muted} style={s.input}/>
  <TextInput value={creatorSettings.instagram_handle} onChangeText={value=>setCreatorSettings(v=>({...v,instagram_handle:value.replace(/^@/,'')}))} maxLength={40} autoCapitalize="none" placeholder="Instagram username" placeholderTextColor={theme.muted} style={s.input}/>
  <TextInput value={creatorSettings.youtube_url} onChangeText={value=>setCreatorSettings(v=>({...v,youtube_url:value}))} maxLength={200} autoCapitalize="none" placeholder="YouTube: https://…" placeholderTextColor={theme.muted} style={s.input}/>
  <Text style={s.subheading}>PRIVACY & COMMENT CONTROLS</Text>
  <Pressable accessibilityRole="switch" accessibilityState={{checked:creatorSettings.is_private}} style={s.outline} onPress={()=>setCreatorSettings(v=>({...v,is_private:!v.is_private}))}>
   <Text style={s.link}>Private post visibility: {creatorSettings.is_private?'ON ✓':'OFF ✕'}</Text>
  </Pressable>
  <Text style={s.muted}>Private mode hides your posts from other ReconFeed accounts until an approval system is available. Media is stored in a public bucket: anyone with a direct media URL may still access it. This setting controls in-app post visibility, not private file storage.</Text>
  <Text style={s.subheading}>WHO MAY COMMENT?</Text>
  <View style={s.row}>
   {([{id:'everyone',name:'Everyone'},{id:'followers',name:'Followers'},{id:'none',name:'Nobody'}] as const).map(option=><Pressable key={option.id} style={[s.chip,creatorSettings.allow_comments===option.id&&s.selected]} onPress={()=>setCreatorSettings(v=>({...v,allow_comments:option.id}))}><Text style={s.chipText}>{option.name}</Text></Pressable>)}
  </View>
  <Text style={s.muted}>Direct messages, mentions and liked-video publicity controls require additional enforcement before being offered as working settings.</Text>
  <Pressable disabled={settingsBusy} style={s.button} onPress={saveCreatorSettings}><Text style={s.buttonText}>{settingsBusy?'Saving…':'SAVE ACCOUNT SETTINGS'}</Text></Pressable>
  <Text style={s.subheading}>BLOCKED ACCOUNTS ({blockedAccounts.length})</Text>
  {blockedAccounts.length?blockedAccounts.map(row=><View key={row.blocked_id} style={[s.row,{justifyContent:'space-between'}]}>
   <Text style={s.muted}>Account •••{row.blocked_id.slice(-6)}</Text>
   <Pressable style={s.outline} onPress={()=>{void unblockCreator(row.blocked_id)}}><Text style={s.link}>Unblock</Text></Pressable>
  </View>):<Text style={s.muted}>No blocked accounts.</Text>}
  <Text style={s.subheading}>CREATOR STATS</Text>
  <Text style={s.strong}>{creatorAnalytics.views.toLocaleString()} tracked views · {creatorAnalytics.completedViews.toLocaleString()} completed views</Text>
  <Text style={s.strong}>{Math.round(creatorAnalytics.watchSeconds/60).toLocaleString()} watch minutes · {creatorAnalytics.shares.toLocaleString()} recorded shares</Text>
  <Text style={s.muted}>Totals reflect voluntarily tracked watch events, not all possible plays. Analytics will improve as the beta gathers genuine viewing data.</Text>
 </View>}
<View style={[s.card,{gap:12,marginVertical:14}]}>
  <Text style={s.subheading}>FEED PERSONALIZATION & PRIVACY</Text>
  <Text style={s.muted}>ReconFeed can learn from videos you watch, finish, replay, share or skip. Your watch activity stays private to your account and can be cleared.</Text>
  <Pressable accessibilityRole="button" onPress={togglePersonalization} style={s.outline}>
   <Text style={s.link}>Personalized For You: {personalizationEnabled?'ON ✓':'OFF ✕'}</Text>
  </Pressable>
  <Text style={s.subheading}>BLOCKED KEYWORDS & HASHTAGS</Text>
  <TextInput value={blockedKeywordsDraft} onChangeText={setBlockedKeywordsDraft} multiline maxLength={1600}
   placeholder="Keywords or hashtags, separated by commas or lines\ne.g. spoilers, #example"
   placeholderTextColor={theme.muted} style={[s.input,{minHeight:100}]}/>
  <Text style={s.muted}>Up to 40 words or short phrases. Matches captions, tags, audio labels and supplied on-screen text or transcripts.</Text>
  <Pressable accessibilityRole="button" onPress={()=>setHideMatureContent(v=>!v)} style={s.outline}>
   <Text style={s.link}>Hide mature-rated posts: {hideMatureContent?'ON ✓':'OFF ✕'}</Text>
  </Pressable>
  <Pressable accessibilityRole="button" disabled={prefsBusy} onPress={saveFieldPreferences} style={s.button}>
   <Text style={s.buttonText}>{prefsBusy?'Saving…':'Save Field Preferences'}</Text>
  </Pressable>
  <Pressable accessibilityRole="button" onPress={clearRecommendationHistory} style={s.outline}>
   <Text style={s.link}>↻ Fresh Start — reset my For You</Text>
  </Pressable>
 </View><Pressable accessibilityRole="button" onPress={()=>setResearchPanelOpen(v=>!v)} style={s.outline}><Text style={s.link}>{researchPanelOpen?'▾ CLOSE TESTER SURVEY':'▸ TESTER SURVEY & FEEDBACK'}</Text></Pressable>{researchPanelOpen&&<><Text style={s.heading}>Help shape ReconFeed</Text><Text style={s.muted}>A short research survey. These are hypothetical preferences, not a purchase or subscription.</Text>{!researchLoaded?<ActivityIndicator color={theme.purple}/>:<><Text style={s.subheading}>Which features would you actually use?</Text><View style={s.row}>{researchOptions.map(o=>{const selected=researchFeatures.includes(o.id);return <Pressable key={o.id} onPress={()=>setResearchFeatures(prev=>o.id==='none_yet'?(selected?[]:['none_yet']):selected?prev.filter(x=>x!==o.id&&x!=='none_yet'):[...prev.filter(x=>x!=='none_yet'),o.id])} style={[s.chip,selected&&s.selected]}><Text style={s.chipText}>{selected?'✓ ':''}{o.label}</Text></Pressable>})}</View><Text style={s.subheading}>What is the most you would pay monthly for optional premium features?</Text><View style={s.row}>{[{v:'free',l:'Free only'},{v:'2.99',l:'$2.99/mo'},{v:'5.99',l:'$5.99/mo'},{v:'9.99',l:'$9.99/mo'}].map(o=><Pressable key={o.v} onPress={()=>setResearchPrice(o.v)} style={[s.chip,researchPrice===o.v&&s.selected]}><Text style={s.chipText}>{o.l}</Text></Pressable>)}</View><Text style={s.subheading}>How would you prefer to show up?</Text><View style={s.row}>{[{v:'real',l:'Real identity / camera'},{v:'avatar',l:'Virtual avatar'},{v:'both',l:'Both — switch anytime'}].map(o=><Pressable key={o.v} onPress={()=>setResearchIdentity(o.v)} style={[s.chip,researchIdentity===o.v&&s.selected]}><Text style={s.chipText}>{researchIdentity===o.v?'✓ ':''}{o.l}</Text></Pressable>)}</View><Text style={s.subheading}>What is the biggest thing social apps are missing? (optional)</Text><TextInput value={researchNeed} onChangeText={setResearchNeed} maxLength={500} multiline placeholder="Tell us what would make ReconFeed worth opening every day…" placeholderTextColor={theme.muted} style={[s.input,{height:86}]}/><Pressable onPress={()=>setResearchWilling(v=>!v)} style={[s.row,{alignItems:'center',marginVertical:8}]}><Text style={{fontSize:23,color:researchWilling?theme.purple:theme.muted}}>{researchWilling?'☑':'☐'}</Text><Text style={[s.muted,{flex:1}]}>I am willing to test an early prototype and give feedback.</Text></Pressable><Pressable style={s.button} disabled={busy} onPress={saveResearchResponse}><Text style={s.buttonText}>{busy?'Saving…':researchSaved?'Update survey response':'Submit tester survey'}</Text></Pressable><Text style={s.muted}>One response per signed-in account. You can edit it later. Research answers are separate from your public profile.</Text></>}</>}<Pressable style={s.outline} onPress={async()=>{await feedQueueRef.current?.clear();await supabase?.auth.signOut()}}><Text style={[s.link,{color:theme.pink}]}>Sign out</Text></Pressable></View></>:<>{Platform.OS==='web'&&String((globalThis as any).location?.search||'').includes('beta=1')?<View style={{backgroundColor:'#1e2b20',borderColor:'#C6AA72',borderWidth:1,borderRadius:10,padding:15,marginVertical:14}}><Text style={{fontSize:15,fontWeight:'900',color:'#C6AA72',marginBottom:7}}>★ BETA TESTER — CREATE YOUR ACCOUNT</Text><Text style={{fontSize:13,color:'#F0EEE5',lineHeight:21}}>Your tester application is in. Create a ReconFeed account with the same email you used on the tester form, then confirm your email. Already have an account? Sign in below instead.</Text></View>:null}<Text style={s.muted}>Veteran owned. Open to anyone 18 and older. Built for mature-minded people who respect the military and those who serve.</Text><TextInput value={email} onChangeText={setEmail} autoCapitalize="none" keyboardType="email-address" placeholder="Email address" placeholderTextColor={theme.muted} style={s.input}/><TextInput value={password} onChangeText={setPassword} secureTextEntry placeholder="Password (12+ for new accounts)" placeholderTextColor={theme.muted} style={s.input}/><TextInput value={name} onChangeText={setName} placeholder="Display name" placeholderTextColor={theme.muted} style={s.input}/><Text style={s.muted}>Gender</Text><View style={s.row}>{['MALE','FEMALE','Other'].map(g=><Pressable key={g} onPress={()=>setGender(g)} style={[s.chip,gender===g&&s.selected]}><Text style={s.chipText}>{g}</Text></Pressable>)}</View><Pressable style={s.button} disabled={busy} onPress={()=>auth(false)}><Text style={s.buttonText}>Sign in</Text></Pressable><Pressable style={s.outline} disabled={busy} onPress={()=>auth(true)}><Text style={s.link}>Create account</Text></Pressable><Pressable style={s.outline} disabled={busy} onPress={()=>requestAccountEmail(true)}><Text style={s.link}>Forgot password</Text></Pressable><Pressable style={s.outline} disabled={busy} onPress={()=>requestAccountEmail(false)}><Text style={s.link}>Resend confirmation email</Text></Pressable></>}</ScrollView>;
 const commentsModal=<Modal visible={!!commentTarget} animationType="slide" transparent onRequestClose={()=>setCommentTarget(null)}><View style={{flex:1,backgroundColor:'#0009',justifyContent:'flex-end'}}><View style={{backgroundColor:theme.bg,borderTopLeftRadius:24,borderTopRightRadius:24,padding:18,height:'78%'}}><View style={[s.row,{justifyContent:'space-between'}]}><Text style={s.heading}>Comments</Text><Pressable onPress={()=>setCommentTarget(null)}><Text style={s.link}>Close ✕</Text></Pressable></View><Text style={s.muted} numberOfLines={2}>{commentTarget?.caption||'Join the conversation'}</Text>{commentsBusy?<ActivityIndicator color={theme.purple}/>:<FlatList data={commentItems} keyExtractor={x=>x.id} ListEmptyComponent={<Text style={s.muted}>No comments yet. Start the conversation.</Text>} renderItem={({item})=><View style={[s.card,{padding:12}]}><Text style={s.strong}>{item.profiles?.display_name||item.profiles?.username||'Creator'}</Text><Text style={s.caption}>{item.body}</Text><Text style={s.muted}>{new Date(item.created_at).toLocaleString()}</Text></View>}/>}<View style={s.row}><TextInput value={commentText} onChangeText={setCommentText} placeholder="Add a comment…" placeholderTextColor={theme.muted} style={[s.input,{flex:1}]} maxLength={1000}/><Pressable disabled={commentsBusy||!commentText.trim()} onPress={submitComment} style={s.button}><Text style={s.buttonText}>Post</Text></Pressable></View></View></View></Modal>;
  if(recovering)return <SafeAreaView style={s.safe}><ScrollView contentContainerStyle={{padding:24,maxWidth:600,width:'100%',alignSelf:'center'}}><Text style={s.heading}>Reset your password</Text><Text style={s.muted}>Choose a new password with at least 12 characters.</Text><TextInput value={newPassword} onChangeText={setNewPassword} secureTextEntry autoCapitalize="none" placeholder="New password" placeholderTextColor={theme.muted} style={s.input}/><Pressable disabled={busy||!session} style={s.button} onPress={saveRecoveredPassword}><Text style={s.buttonText}>{busy?'Saving…':'Save new password'}</Text></Pressable>{!session&&<Text style={s.muted}>Open the newest reset link from your email. If it has expired, request another.</Text>}<Pressable style={s.outline} onPress={()=>{setRecovering(false);setNewPassword('');setTab('Profile')}}><Text style={s.link}>Back to ReconFeed</Text></Pressable></ScrollView></SafeAreaView>;
  return <SafeAreaView style={s.safe}><StatusBar barStyle="light-content"/>{tab!=='Profile'&&<View style={[s.header,{paddingHorizontal:compact?12:20,maxWidth:contentMaxWidth,alignSelf:'center',width:'100%'}]}><View style={s.brandRow}><Image source={require('./assets/icon.png')} style={s.brandLogo} accessibilityLabel="ReconFeed veteran-owned military shield logo"/><View><Text style={s.logo}>Recon<Text style={s.logoAccent}>Feed</Text></Text><Text style={s.tagline}>VETERAN OWNED · 18+ · ALL WELCOME</Text></View></View><Pressable accessibilityRole="button" onPress={()=>setTab('Profile')} style={s.headerAction}><Text style={s.headerActionText}>{session?'PROFILE':'SIGN IN'} ↗</Text></Pressable></View>}<ImageBackground source={{uri:'https://images.pexels.com/photos/876345/pexels-photo-876345.jpeg?auto=compress&cs=tinysrgb&w=1000'}} imageStyle={s.appBackdropImage} style={[s.body,{maxWidth:contentMaxWidth,width:'100%',alignSelf:'center',paddingHorizontal:compact?10:16}]}>{tab==='Market'?marketplace():tab==='Create'?create():tab==='Profile'?profileView():tab==='Discover'?exploreView():feed()}</ImageBackground><View style={[s.navOuter,{maxWidth:contentMaxWidth,width:'100%',alignSelf:'center'}]}><View style={s.nav}>{([{key:'For You',label:'HOME',icon:'⌂'},{key:'Discover',label:'FRIENDS',icon:'♧'},{key:'Create',label:'CREATE',icon:'⊕'},{key:'Market',label:'INBOX',icon:'▢'},{key:'Profile',label:'PROFILE',icon:'♙'}] as Array<{key:Tab;label:string;icon:string}>).map(item=><Pressable accessibilityRole="button" accessibilityLabel={item.label} accessibilityState={{selected:item.key==='Market'?inboxOpen:(tab===item.key||(item.key==='For You'&&tab==='Following'))}} key={item.key} onPress={()=>{if(item.key==='Market'){if(!session){showAlert('Sign in required','Sign in to read marketplace messages.');setTab('Profile')}else{setMarketThread(null);setInboxOpen(true)}}else setTab(item.key)}} style={[s.navItem,item.key==='Create'&&s.navCreateItem,(tab===item.key||(item.key==='For You'&&tab==='Following'))&&s.navItemActive]}><Text style={[s.navIcon,item.key==='Create'&&s.navCreateGlyph,(tab===item.key||(item.key==='For You'&&tab==='Following'))&&s.navIconActive]}>{item.icon}</Text><Text style={[s.navLabel,(tab===item.key||(item.key==='For You'&&tab==='Following'))&&s.navLabelActive]}>{item.label}</Text></Pressable>)}</View></View>{commentsModal}
 <Modal visible={!!reportTarget} transparent animationType="fade" onRequestClose={()=>setReportTarget(null)}>
  <View style={{flex:1,justifyContent:'center',backgroundColor:'#000c',padding:24}}>
   <View style={{backgroundColor:theme.panel,borderRadius:13,borderWidth:1,borderColor:'#C6AA72',padding:20,gap:13}}>
    <Text style={s.heading}>REPORT CONTENT</Text>
    <Text style={s.muted}>Choose a reason. Reports are private and reviewed; they do not automatically remove content.</Text>
    {([{id:'spam',name:'Spam or deceptive content'},{id:'harassment',name:'Harassment or threats'},{id:'unsafe',name:'Dangerous acts or violence'},{id:'privacy',name:'Privacy or personal information'},{id:'adult',name:'Sexual content or nudity'},{id:'other',name:'Something else'}] as const).map(choice=><Pressable key={choice.id} accessibilityRole="button" disabled={reportBusy} onPress={()=>{void submitReport(choice.id)}} style={s.outline}><Text style={s.link}>{choice.name}</Text></Pressable>)}
    <Pressable style={s.outline} onPress={()=>setReportTarget(null)}><Text style={s.link}>Cancel</Text></Pressable>
   </View>
  </View>
 </Modal>{inboxOpen&&supabase&&session?<MarketplaceInbox key={session.user.id} client={supabase} session={session} initialThread={marketThread} onClose={()=>setInboxOpen(false)}/>:null}{collection&&supabase?<PostCollection client={supabase} userId={collection.userId} savedIds={collection.liked?likedPostIds:collection.saved?savedPostIds:undefined} onClose={()=>setCollection(null)}/>:null}</SafeAreaView>
}
const s=StyleSheet.create({
 profileScreenContent:{paddingBottom:30,backgroundColor:'#090C0B'},
 profileTopBar:{flexDirection:'row',alignItems:'center',justifyContent:'space-between',minHeight:62,borderBottomWidth:1,borderBottomColor:'#344436',paddingHorizontal:8},
 profileTopBrand:{flex:1,alignItems:'flex-start',paddingLeft:8},
 profileTopBrandText:{fontSize:15,color:'#F0EEE5',fontWeight:'900',fontStyle:'italic',letterSpacing:.8},
 profileTopBrandSub:{fontSize:8,color:'#C6AA72',fontWeight:'900',letterSpacing:1.8},
 profileTopIcon:{minWidth:39,minHeight:43,alignItems:'center',justifyContent:'center',borderRadius:8},
 profileTopIconText:{fontSize:26,color:'#F0EEE5',fontWeight:'800'},
 profileHeaderBlock:{paddingHorizontal:14,paddingTop:18,paddingBottom:18,backgroundColor:'#101612'},
 profileIdentity:{flexDirection:'row',justifyContent:'space-between',alignItems:'center',gap:11,minHeight:113},
 profileIdentityText:{flex:1,justifyContent:'center',gap:7},
 profileIdentityName:{fontSize:23,fontWeight:'900',color:'#F0EEE5',lineHeight:28,letterSpacing:-.6},
 profileIdentityHandle:{fontSize:13,color:'#B7BDBB',fontWeight:'600'},
 profileBadge:{alignSelf:'flex-start',backgroundColor:'#273626',borderColor:'#C6AA72',borderWidth:1,paddingHorizontal:8,paddingVertical:5,borderRadius:5},
 profileBadgeText:{fontSize:9,color:'#E4D5A9',fontWeight:'900',letterSpacing:.7},
 profileIdentityAvatar:{width:108,height:108,borderRadius:54,borderWidth:2,borderColor:'#C6AA72',backgroundColor:'#364836',alignItems:'center',justifyContent:'center',marginRight:8},
 profileIdentityAvatarImage:{width:'100%',height:'100%',borderRadius:54},
 profileIdentityAvatarInitial:{fontSize:43,fontWeight:'900',color:'#F0EEE5'},
 profileAvatarAdd:{position:'absolute',bottom:-5,right:-8,width:34,height:34,borderRadius:17,backgroundColor:'#C6AA72',borderWidth:2,borderColor:'#090C0B',alignItems:'center',justifyContent:'center'},
 profileAvatarAddText:{color:'#101510',fontSize:26,fontWeight:'900',lineHeight:28},
 profileNumbers:{flexDirection:'row',alignItems:'flex-start',justifyContent:'flex-start',gap:34,paddingTop:21,paddingBottom:15},
 profileNumberBox:{alignItems:'flex-start',minWidth:69},
 profileNumberValue:{fontSize:25,fontWeight:'900',color:'#F0EEE5',lineHeight:30},
 profileNumberLabel:{fontSize:12,color:'#B7BDBB'},
 profileMainBio:{color:'#F0EEE5',fontSize:14,lineHeight:21,fontWeight:'600',marginTop:6,marginBottom:7},
 profileMetaLine:{fontSize:10,color:'#BAC6AF',fontWeight:'700',marginTop:3,lineHeight:17,letterSpacing:.35},
 profileLink:{color:'#C6AA72',fontSize:12,fontWeight:'900',marginTop:5},
 profileActionRow:{flexDirection:'row',gap:9,marginTop:22,marginBottom:2},
 profileActionPill:{flex:1,minHeight:41,paddingHorizontal:8,justifyContent:'center',alignItems:'center',backgroundColor:'#232D26',borderWidth:1,borderColor:'#5C6D58',borderRadius:24},
 profileActionLabel:{color:'#F0EEE5',fontSize:11,fontWeight:'900',letterSpacing:.3,textAlign:'center'},
 profileContentTabs:{flexDirection:'row',backgroundColor:'#101612',borderBottomWidth:1,borderBottomColor:'#445342',paddingTop:5,minHeight:55},
 profileContentTab:{width:'25%',alignItems:'center',justifyContent:'center',borderBottomWidth:3,borderBottomColor:'transparent',paddingVertical:10},
 profileContentTabActive:{borderBottomColor:'#C6AA72'},
 profileContentTabIcon:{fontSize:24,color:'#88958A',fontWeight:'700'},
 profileContentTabIconActive:{color:'#F0EEE5'},
 profileTileGrid:{flexDirection:'row',flexWrap:'wrap',backgroundColor:'#070907',width:'100%'},
 profileVideoTile:{width:'33.3333%',aspectRatio:.75,backgroundColor:'#1C2420',overflow:'hidden',borderWidth:1,borderColor:'#090C0B',position:'relative'},
 profileVideoThumbnail:{width:'100%',height:'100%',backgroundColor:'#202820'},
 profileTileShade:{position:'absolute',left:0,right:0,bottom:0,height:53,backgroundColor:'rgba(0,0,0,.4)'},
 profileViewsBadge:{position:'absolute',bottom:9,left:7},
 profileViewsText:{color:'#fff',fontSize:12,fontWeight:'900',textShadowColor:'#000',textShadowRadius:3},
 profilePinBadge:{position:'absolute',top:7,left:5,backgroundColor:'#101610ce',borderRadius:4,paddingHorizontal:6,paddingVertical:3},
 profilePinText:{fontSize:9,fontWeight:'900',color:'#E4D5A9'},
 profileTileEditTools:{position:'absolute',top:5,right:4,gap:5,alignItems:'flex-end'},
 profileTileTool:{paddingHorizontal:6,paddingVertical:6,borderRadius:4,backgroundColor:'#30383D'},
 profileTileToolText:{fontSize:9,color:'#F0EEE5',fontWeight:'900'},
 profileTabEmpty:{width:'100%',minHeight:215,padding:22,alignItems:'center',justifyContent:'center',gap:10,backgroundColor:'#121B15'},
 profileEmptyTitle:{color:'#F0EEE5',fontWeight:'900',fontSize:16,textAlign:'center',letterSpacing:1},
 profileEmptyBody:{color:'#B7BDBB',fontSize:12,textAlign:'center',lineHeight:19},
 profileTabButton:{backgroundColor:'#344C35',padding:13,borderRadius:8,borderWidth:1,borderColor:'#C6AA72',marginTop:8},
 profileLoadMore:{alignSelf:'center',marginVertical:15,backgroundColor:'#263728',borderColor:'#C6AA72',borderWidth:1,borderRadius:10,paddingHorizontal:22,paddingVertical:13},
 profileCloseVideo:{minHeight:45,justifyContent:'center',paddingHorizontal:14,backgroundColor:'#1B261C'},
 profileBelowGrid:{paddingHorizontal:12,paddingTop:19,paddingBottom:16,backgroundColor:'#0A100D'},
 profileEditorSheet:{padding:16,backgroundColor:'#172219',borderColor:'#C6AA72',borderWidth:1,borderRadius:13,marginVertical:14},

 appBackdropImage:{opacity:0.10},

 screenDisplayTitle:{fontSize:34,fontWeight:'900',color:'#C6AA72',letterSpacing:1.8,textAlign:'center',textShadowColor:'#000',textShadowRadius:3,marginBottom:3},
 exploreContent:{paddingBottom:40},
 exploreHeading:{alignItems:'center',paddingTop:13,paddingBottom:10},
 exploreSub:{fontSize:9,color:'#d6dabf',fontWeight:'900',letterSpacing:1.15},
 exploreSearchRow:{flexDirection:'row',alignItems:'center',backgroundColor:'#1a1d18',borderWidth:1,borderColor:'#586b4d',borderRadius:23,paddingHorizontal:13,marginVertical:13},
 exploreSearchIcon:{fontSize:25,color:'#c9d2b8'},
 exploreSearch:{flex:1,color:'#f2f2e9',fontSize:12,paddingVertical:13,paddingHorizontal:9,minHeight:46},
 exploreSearchGo:{minWidth:38,minHeight:38,alignItems:'center',justifyContent:'center',backgroundColor:'#3c4b2f',borderRadius:18},
 exploreSearchGoText:{fontSize:22,color:'#e3ebd4'},
 exploreGrid:{flexDirection:'row',flexWrap:'wrap',justifyContent:'space-between',gap:9},
 exploreTile:{width:'48.6%',aspectRatio:1.07,borderRadius:12,borderWidth:1,borderColor:'#B7BDBB',overflow:'hidden',backgroundColor:'#232d20'},
 exploreTileImage:{width:'100%',height:'100%',justifyContent:'flex-end'},
 exploreTileOverlay:{backgroundColor:'rgba(5,9,5,.62)',padding:11,minHeight:43,flexDirection:'row',alignItems:'center',justifyContent:'space-between'},
 exploreTileLabel:{fontSize:14,fontWeight:'900',color:'#f3f5e9'},
 exploreTileArrow:{fontSize:18,color:'#c3d698'},
 exchangePromo:{backgroundColor:'#30383D',borderColor:'#C6AA72',borderWidth:1,borderRadius:12,padding:19,marginTop:15},
 exchangePromoBig:{fontSize:19,fontWeight:'900',color:'#e7eadc',letterSpacing:.5},
 exchangePromoSmall:{fontSize:9,fontWeight:'900',color:'#b5ca8e',marginTop:8,letterSpacing:.25},
 createContent:{paddingBottom:44},
 cameraStage:{height:550,borderRadius:14,overflow:'hidden',borderColor:'#B7BDBB',borderWidth:1,justifyContent:'space-between',backgroundColor:'#242d22'},
 cameraStageImage:{borderRadius:13},
 cameraTop:{flexDirection:'row',alignItems:'center',justifyContent:'space-between',padding:15,backgroundColor:'rgba(9,12,11,.76)'},
 cameraCancel:{color:'#eceddc',fontSize:11,fontWeight:'900',letterSpacing:1.2},
 addSound:{backgroundColor:'#1e241bcf',borderRadius:22,paddingVertical:9,paddingHorizontal:13,borderWidth:1,borderColor:'#a5ab83'},
 addSoundText:{fontSize:12,fontWeight:'900',color:'#f5f5ef'},
 cameraMid:{flexDirection:'row',justifyContent:'space-between',flex:1,alignItems:'center',paddingHorizontal:17},
 cameraMessage:{maxWidth:'64%',color:'#fff',fontSize:14,fontWeight:'900',textShadowColor:'#000',textShadowRadius:7,letterSpacing:.4},
 cameraTools:{gap:18,alignItems:'center'},
 cameraTool:{fontSize:23,textAlign:'center',fontWeight:'900',color:'#fff',textShadowColor:'#000',textShadowRadius:5},
 cameraToolLabel:{fontSize:9,fontWeight:'900',color:'#fff',textAlign:'center'},
 cameraBottom:{paddingBottom:22,paddingHorizontal:17,backgroundColor:'rgba(9,12,11,.82)'},
 captureModes:{flexDirection:'row',justifyContent:'center',gap:19,paddingVertical:14},
 captureMode:{fontSize:11,fontWeight:'800',color:'#c9cfc4',paddingBottom:6},
 captureModeActive:{fontWeight:'900',color:'#f9f9ee',borderBottomColor:'#b9d386',borderBottomWidth:2},
 captureActions:{flexDirection:'row',alignItems:'center',justifyContent:'space-around'},
 galleryButton:{minHeight:52,minWidth:70,justifyContent:'center',alignItems:'center',gap:4},
 galleryIcon:{fontSize:24,color:'#f4f5ec'},
 galleryLabel:{fontSize:8,color:'#e2e7d9',fontWeight:'900'},
 recordOuter:{width:96,height:100,alignItems:'center',justifyContent:'flex-end',paddingBottom:5,position:'relative'},
 grenadePinRing:{position:'absolute',width:22,height:22,borderRadius:12,borderWidth:4,borderColor:'#c6cbb9',top:0,right:10,backgroundColor:'transparent'},
 grenadePinStem:{position:'absolute',width:22,height:13,borderTopLeftRadius:4,borderTopRightRadius:4,backgroundColor:'#b6bea9',top:13,left:37,borderWidth:2,borderColor:'#d9dfcd'},
 grenadeLever:{position:'absolute',width:9,height:49,borderRadius:3,backgroundColor:'#8f9b82',top:12,right:10,transform:[{rotate:'-16deg'}],borderColor:'#d8dfcd',borderWidth:1},
 grenadeBody:{width:70,height:70,borderTopLeftRadius:21,borderTopRightRadius:21,borderBottomLeftRadius:28,borderBottomRightRadius:28,backgroundColor:'#344532',borderColor:'#b9c5a6',borderWidth:3,alignItems:'center',justifyContent:'center',overflow:'hidden',shadowColor:'#000',shadowOpacity:0.9,shadowRadius:13,elevation:10},
 grenadeSeamHorizontal:{position:'absolute',top:29,left:0,right:0,height:5,backgroundColor:'#151d13',borderTopColor:'#93a388',borderTopWidth:1},
 grenadeSeamVertical:{position:'absolute',left:29,top:0,bottom:0,width:5,backgroundColor:'#182517',borderLeftWidth:1,borderLeftColor:'#788b70'},
 recordInner:{width:42,height:42,borderRadius:22,backgroundColor:'#B83235',borderWidth:4,borderColor:'#f4ebe2',shadowColor:'#ea3f35',shadowOpacity:0.9,shadowRadius:11,elevation:6},
 grenadeLabel:{position:'absolute',bottom:-9,fontSize:9,fontWeight:'900',color:'#F0EEE5',backgroundColor:'#1c2a19',overflow:'hidden',paddingHorizontal:10,paddingVertical:4,borderRadius:3,letterSpacing:2,borderWidth:1,borderColor:'#90a37b'},
 captureHint:{fontSize:9,textAlign:'center',color:'#c2d1b7',marginTop:9},
 profileHero:{alignItems:'center',paddingHorizontal:15,paddingVertical:20,backgroundColor:'#060906',borderWidth:1,borderColor:'#596b4a',borderRadius:12,marginTop:12},
 profileAvatar:{width:88,height:88,borderRadius:44,borderColor:'#bdc88c',borderWidth:3,backgroundColor:'#435637',alignItems:'center',justifyContent:'center'},
 profileAvatarText:{fontSize:40,fontWeight:'900',color:'#f3eddb'},
 profileName:{fontSize:21,fontWeight:'900',color:'#f6f6eb',marginTop:9},
 profileHandle:{fontSize:11,color:'#b3c2a1',marginTop:3},
 profileStatRow:{flexDirection:'row',justifyContent:'space-around',width:'100%',marginTop:18,borderTopColor:'#55654d',borderTopWidth:1,paddingTop:17},
 profileStat:{alignItems:'center',flex:1},
 profileStatNumber:{color:'#f3f4e9',fontSize:18,fontWeight:'900'},
 profileStatLabel:{color:'#c1cabc',fontSize:10,marginTop:3},
 profileBio:{color:'#bacc91',fontWeight:'900',fontSize:10,marginTop:16,textAlign:'center',letterSpacing:.3},
 profileEditShortcut:{borderWidth:1,borderColor:'#8a9c78',backgroundColor:'#202820',borderRadius:11,minHeight:47,alignItems:'center',justifyContent:'center',marginTop:10},
 profileEditText:{color:'#f2f4e6',fontSize:12,fontWeight:'900'},
 profileGalleryHeader:{marginTop:18,flexDirection:'row',justifyContent:'space-between',alignItems:'center',paddingBottom:12,borderBottomWidth:1,borderBottomColor:'#50634c'},
 profileGalleryTitle:{fontWeight:'900',fontSize:13,color:'#ebf1df'},
 profileGallerySub:{fontSize:10,color:'#acb99b'},
 profileGallery:{flexDirection:'row',flexWrap:'wrap',gap:4,marginTop:5},
 galleryTile:{width:'32.5%',aspectRatio:.80,backgroundColor:'#1c251c',overflow:'hidden',borderRadius:3},
 galleryTileImage:{width:'100%',height:'100%'},
 galleryVideo:{flex:1,alignItems:'center',justifyContent:'center',padding:7,backgroundColor:'#18211a'},
 galleryPlay:{color:'#d5e4b5',fontSize:29},
 galleryVideoCaption:{color:'#e3e5de',fontSize:10,textAlign:'center',marginTop:6},
 noGallery:{width:'100%',alignItems:'center',padding:26,borderColor:'#47583d',borderWidth:1,borderRadius:10,backgroundColor:'#111711'},
 noGalleryText:{textAlign:'center',fontSize:12,color:'#c6d1ba',lineHeight:20},
 noGalleryAction:{color:'#c0d893',fontSize:12,fontWeight:'900',marginTop:12},

 brandLogo:{width:48,height:48,borderRadius:12,borderColor:'#9aaa75',borderWidth:1,backgroundColor:'#26301c'},
 overlineGold:{color:theme.pink,fontWeight:'900',letterSpacing:2,fontSize:9,textShadowColor:'#000',textShadowRadius:6,marginBottom:10},
 heroTitle:{color:'#f7f8ed',fontWeight:'900',fontSize:39,lineHeight:41,letterSpacing:.15,textShadowColor:'#000c',textShadowRadius:8,marginBottom:13},
 heroBody:{color:'#f4f4e9',fontWeight:'600',fontSize:12,lineHeight:18,textShadowColor:'#000',textShadowRadius:7,marginBottom:12,maxWidth:390},
 emptyHero:{borderRadius:16,overflow:'hidden',marginTop:13,minHeight:355,borderWidth:1,borderColor:'#a6b984aa',justifyContent:'flex-end',backgroundColor:'#171c14'},
 emptyHeroImage:{borderRadius:15},
 emptyHeroShade:{padding:24,paddingTop:125,backgroundColor:'rgba(4,8,4,.48)',alignItems:'flex-start'},
 sectionHero:{minHeight:158,borderRadius:13,overflow:'hidden',marginTop:9,marginBottom:14,borderWidth:1,borderColor:'#8d9f7160',justifyContent:'flex-end',backgroundColor:'#1c261e'},
 sectionHeroImage:{borderRadius:12},
 sectionHeroInner:{padding:19,paddingTop:32,backgroundColor:'rgba(4,9,5,.59)'},
 sectionHeroTitle:{fontWeight:'900',letterSpacing:.5,fontSize:30,color:'#f4f5e9',lineHeight:33,textShadowColor:'#000',textShadowRadius:8},
 sectionHeroSubtitle:{fontWeight:'800',fontSize:11,color:'#dde6ca',marginTop:6,letterSpacing:.2},
 loginHero:{minHeight:330,borderRadius:17,overflow:'hidden',marginVertical:14,borderWidth:1,borderColor:'#9daa7e',backgroundColor:'#1f2a21'},
 loginHeroInner:{padding:16,paddingVertical:20,alignItems:'center',justifyContent:'center',minHeight:330,backgroundColor:'rgba(3,8,4,.42)'},
 loginEmblem:{width:146,height:146,borderRadius:28,borderWidth:2,borderColor:'#c2c99b',marginBottom:17},
 loginMotto:{fontWeight:'900',fontSize:20,textAlign:'center',color:'#f6f5e8',letterSpacing:1,textShadowColor:'#000',textShadowRadius:8},
 
brandRow:{flexDirection:'row',alignItems:'center',gap:11},
brandMark:{width:48,height:48,borderWidth:1,borderColor:'#adb88c',backgroundColor:'#252d1e',borderRadius:12,alignItems:'center',justifyContent:'center'},
 brandGlyph:{color:theme.pink,fontSize:25,fontWeight:'900'},
logoAccent:{color:theme.purple},
headerAction:{borderRadius:9,borderWidth:1,borderColor:'#b1b68a',paddingVertical:11,paddingHorizontal:12,backgroundColor:'#415133'},
headerActionText:{fontSize:10,fontWeight:'900',color:'#f5f6ed',letterSpacing:.5},
sectionEyebrow:{fontSize:10,fontWeight:'900',letterSpacing:2,color:theme.purple,marginTop:17},
feedOverline:{flexDirection:'row',alignItems:'center',gap:7,marginVertical:4},
liveDot:{width:7,height:7,borderRadius:4,backgroundColor:theme.purple},
feedEyebrow:{fontSize:11,color:theme.purple,fontWeight:'900',letterSpacing:1.5},
feedEdition:{fontSize:9,color:theme.muted,fontWeight:'800',marginLeft:'auto'},
navOuter:{backgroundColor:'#070a07',paddingHorizontal:8,paddingTop:8,paddingBottom:6,borderTopWidth:1,borderTopColor:'#697656'},
navItemActive:{backgroundColor:'#3b4a2e'},
navIconActive:{color:'#bdd78b'},
navLabelActive:{color:'#f3f2e6'},
safe:{flex:1,backgroundColor:theme.bg},
header:{minHeight:76,paddingVertical:10,flexDirection:'row',alignItems:'center',justifyContent:'space-between',borderBottomWidth:1,borderBottomColor:'#86956880',backgroundColor:'#050705'},
logo:{fontSize:26,fontWeight:'900',fontStyle:'italic',letterSpacing:-.8,color:'#e8e9df',textShadowColor:'#57604ba0',textShadowOffset:{width:1,height:1},textShadowRadius:1},
tagline:{fontSize:8,fontWeight:'900',color:theme.purple,marginTop:1,letterSpacing:1.2},
body:{flex:1,paddingTop:6},
heading:{fontSize:30,fontWeight:'900',letterSpacing:.1,color:theme.text,marginTop:11,marginBottom:11},
subheading:{fontSize:21,fontWeight:'900',letterSpacing:.2,color:theme.text,marginTop:24,marginBottom:10},
muted:{fontSize:13,color:theme.muted,lineHeight:21},
input:{backgroundColor:'#1b241c',borderWidth:1,borderColor:'#68795b',borderRadius:11,paddingHorizontal:16,paddingVertical:14,color:theme.text,marginVertical:8,fontSize:14,minHeight:50},
card:{backgroundColor:'#151c15',borderColor:'#606c4c',borderWidth:1,borderRadius:15,overflow:'hidden',marginVertical:9,padding:17},
row:{flexDirection:'row',alignItems:'center',gap:10,marginBottom:10,flexWrap:'wrap'},
avatar:{width:38,height:38,borderRadius:19,backgroundColor:'#263321',borderWidth:1,borderColor:theme.purple,alignItems:'center',justifyContent:'center'},
avatarText:{fontWeight:'900',color:theme.pink,fontSize:16},
strong:{color:theme.text,fontWeight:'900',fontSize:14,letterSpacing:.1},
link:{color:theme.pink,fontWeight:'900',fontSize:12,letterSpacing:.25},
caption:{color:theme.text,fontSize:14,lineHeight:21,marginBottom:10},
media:{width:'100%',backgroundColor:'#0a0d09',borderRadius:6},
feedTop:{paddingTop:8,paddingBottom:8,gap:6},
feedTabs:{flexDirection:'row',alignItems:'center',justifyContent:'space-around',gap:10,paddingVertical:10,backgroundColor:'#121a12',borderRadius:9,borderWidth:1,borderColor:'#657852'},
feedTab:{fontSize:12,fontWeight:'900',color:theme.muted,letterSpacing:.3},
feedTabActive:{color:'#f0f6de',borderBottomWidth:3,borderBottomColor:theme.purple,paddingBottom:4},
feedDivider:{height:12,width:1,backgroundColor:theme.line},
feedSearch:{backgroundColor:'#1b241c',borderWidth:1,borderColor:'#596c51',borderRadius:10,paddingHorizontal:14,paddingVertical:11,color:theme.text,fontSize:13,marginVertical:3},
feedLoading:{flex:1,alignItems:'center',justifyContent:'center',gap:12},
videoPage:{width:'100%',backgroundColor:'#060a06',borderRadius:14,overflow:'hidden',marginBottom:10,position:'relative',borderWidth:1,borderColor:'#a7b27877'},
videoCanvas:{...StyleSheet.absoluteFillObject,backgroundColor:'#0a0d09'},
fullMedia:{width:'100%',height:'100%',backgroundColor:'#0a0d09'},
videoShade:{...StyleSheet.absoluteFillObject,backgroundColor:'rgba(0,0,0,0.10)'},
videoTopBadge:{position:'absolute',top:15,left:15,right:12,alignItems:'flex-start'},
videoBadgeText:{color:'#e7ebd7',fontSize:9,fontWeight:'900',letterSpacing:1.2,backgroundColor:'rgba(6,11,7,.85)',paddingHorizontal:12,paddingVertical:9,borderRadius:8,overflow:'hidden',borderWidth:1,borderColor:'#a8bc835c'},
videoInfo:{position:'absolute',left:17,right:78,bottom:22,gap:8},
videoCreator:{color:'#fff',fontSize:18,fontWeight:'900',textShadowColor:'#000',textShadowRadius:8},
videoCaption:{color:'#fff',fontSize:14,fontWeight:'600',lineHeight:21,textShadowColor:'#000',textShadowRadius:8},
videoMeta:{color:'#c0d88c',fontSize:10,fontWeight:'900',textShadowColor:'#000',textShadowRadius:6},
videoActions:{position:'absolute',right:10,bottom:20,alignItems:'center',gap:15},
actionButton:{alignItems:'center',justifyContent:'center',minWidth:44,gap:4,backgroundColor:'rgba(5,11,7,.38)',borderRadius:13,paddingVertical:4},
actionIcon:{fontSize:25,fontWeight:'900',color:'#fff',textShadowColor:'#000',textShadowRadius:6},
actionCount:{fontSize:10,fontWeight:'800',color:'#fff',textShadowColor:'#000',textShadowRadius:6},
followDisc:{width:29,height:29,borderRadius:9,backgroundColor:theme.purple,alignItems:'center',justifyContent:'center',borderWidth:2,borderColor:'#fff'},
followDiscText:{color:'#111510',fontSize:19,fontWeight:'900',marginTop:-2},
rowActions:{flexDirection:'row',justifyContent:'space-around',flexWrap:'wrap',gap:12,paddingTop:14,paddingBottom:3},
empty:{alignItems:'center',padding:25,backgroundColor:theme.panel,borderRadius:14,marginTop:18,gap:8,borderWidth:1,borderColor:theme.line},
button:{backgroundColor:theme.purple,paddingHorizontal:18,paddingVertical:15,borderRadius:9,alignItems:'center',justifyContent:'center',marginVertical:10,minHeight:50,borderWidth:1,borderColor:'#d0dca2'},
buttonText:{color:'#10180a',fontWeight:'900',letterSpacing:.55,fontSize:13},
outline:{borderWidth:1,borderColor:'#9aa587',backgroundColor:'#202921',paddingHorizontal:16,paddingVertical:14,borderRadius:9,alignItems:'center',justifyContent:'center',marginVertical:6,minHeight:49},
picker:{backgroundColor:'#1b251b',borderWidth:1,borderColor:'#99b181',borderStyle:'dashed',borderRadius:13,minHeight:112,alignItems:'center',justifyContent:'center',marginVertical:14,gap:8,padding:16},
preview:{width:'100%',aspectRatio:4/3,borderRadius:13,marginVertical:10},
rule:{height:1,backgroundColor:theme.line,marginVertical:22},
chip:{paddingHorizontal:14,paddingVertical:10,borderRadius:9,backgroundColor:'#243021',borderWidth:1,borderColor:'#5c704e',marginRight:8,marginVertical:6},
selected:{borderColor:theme.purple,backgroundColor:'#495e35'},
chipText:{color:theme.text,fontSize:12,fontWeight:'800',letterSpacing:.2},
profile:{alignItems:'center',padding:25,backgroundColor:'#1e281d',borderRadius:16,marginTop:12,gap:9,borderWidth:1,borderColor:'#8a9b70'},
nav:{flexDirection:'row',backgroundColor:'#070906',borderWidth:1,borderColor:'#687c56',borderRadius:15,paddingTop:5,paddingBottom:5,paddingHorizontal:4},
navItem:{flex:1,alignItems:'center',justifyContent:'center',gap:3,minHeight:54,paddingHorizontal:1,borderRadius:10},
navIcon:{fontSize:24,color:'#ccd4bf'},
navCreateItem:{backgroundColor:'#30472F',borderLeftColor:'#263F63',borderLeftWidth:4,borderRightColor:'#B83235',borderRightWidth:4,borderTopColor:'#C6AA72',borderTopWidth:1,borderBottomColor:'#C6AA72',borderBottomWidth:1},
navCreateGlyph:{fontSize:31,color:'#F0EEE5',fontWeight:'900'},
navLabel:{fontSize:9,color:'#b8c4b5',fontWeight:'900',letterSpacing:.1},
});
