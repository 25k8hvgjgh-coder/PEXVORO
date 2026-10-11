import 'react-native-url-polyfill/auto';
import React,{useCallback,useEffect,useRef,useState} from 'react';
import {ActivityIndicator,Alert,AppState,FlatList,Image,ImageBackground,Animated,KeyboardAvoidingView,Pressable,RefreshControl,SafeAreaView,ScrollView,Share,Linking,StatusBar,Platform,StyleSheet,Text,TextInput,View,useWindowDimensions,PixelRatio} from 'react-native';
import {Audio,Video,ResizeMode} from 'expo-av';
import {capturePermission} from './capturePermissions';
import {uploadProfilePhoto} from './profilePhoto';
import {Modal} from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import AsyncStorage from '@react-native-async-storage/async-storage';
import {createClient,Session} from '@supabase/supabase-js';
import * as Updates from 'expo-updates';
import MarketplaceInbox,{MarketThread} from './MarketplaceInbox';
import SocialInbox,{type DirectPeer} from './SocialInbox';
import PostCollection from './PostCollection';
import TesterReports from './TesterReports';
import ProfileConnections from './ProfileConnections';
import ProfileIcon,{type ProfileIconName} from './ProfileIcon';
import CreatorProfileHeader from './CreatorProfileHeader';
import {StoryStrip,StoryComposer} from './Stories';
import ProfileMenuOverview from './ProfileMenuOverview';
import SettingsPrivacyPage,{type SettingsAction} from './SettingsPrivacyPage';
import PublicCreatorHeader from './PublicCreatorHeader';
import BalancePage from './BalancePage';
import {olive} from './oliveTheme';
import {FeedVideo,VideoTilePreview,ViewerVideo,type WebVideoElement} from './PlayableVideo';
import {rankFeedPosts, type FeedEvent, type RankingContext} from './feedRanking';
import {createFeedEventQueue} from './feedEventQueue';
import {normalizeBlockedKeywords,parseCreatorTags,allowedForFeed} from './contentSignals';
const url=process.env.EXPO_PUBLIC_SUPABASE_URL||'';
const key=process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY||'';
const api=(process.env.EXPO_PUBLIC_API_BASE_URL||'').replace(/\/$/,'');
const supabase=url&&key?createClient(url,key,{auth:{storage:AsyncStorage,persistSession:true,autoRefreshToken:true,detectSessionInUrl:Platform.OS==='web'}}):null;
// ReconFeed shared visual language — restrained matte olive with warm heritage accents.
const theme={bg:olive.bg,panel:olive.surface,line:olive.border,text:olive.text,muted:olive.muted,purple:olive.accent,pink:olive.gold,accent:olive.raised};
type Post={id:string;user_id:string;caption:string;is_promotional?:boolean;media_url:string;media_type:string;format?:string;audio_label?:string;created_at:string;profiles:any;likes:{count:number}[];comments?:{count:number}[]};
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
 const [feedViewportHeight,setFeedViewportHeight]=useState(0);
 const feedCacheKey=(id?:string)=>'reconfeed.public.feed.v1.'+(id||'guest');
 const feedListRef=useRef<FlatList<Post>>(null);
 const webPlayerElements=useRef(new Map<string,WebVideoElement>());
 const feedWebSnapTimer=useRef<ReturnType<typeof setTimeout>|null>(null);
 const feedWebScrollOffset=useRef(0);
 // A video page is exactly the available feed viewport. Never display half
 // of the next post after a swipe, including on Safari and desktop web.
 function settleFeedSlide(y:number,animated=true){
  if(Platform.OS!=='web'||feedViewportHeight<2||!posts.length)return;
  const nearest=Math.min(posts.length-1,Math.max(0,Math.round(Math.max(0,y)/feedViewportHeight)));
  const offset=nearest*feedViewportHeight;
  if(Math.abs(y-offset)>1){
   feedListRef.current?.scrollToOffset({offset,animated});
  }
  if(posts[nearest]?.id)setActivePostId(posts[nearest].id);
 }
 function scheduleWebFeedSnap(y:number){
  if(Platform.OS!=='web')return;
  feedWebScrollOffset.current=Math.max(0,y);
  if(feedWebSnapTimer.current)clearTimeout(feedWebSnapTimer.current);
  feedWebSnapTimer.current=setTimeout(()=>{
   feedWebSnapTimer.current=null;
   settleFeedSlide(feedWebScrollOffset.current);
  },150);
 }
 useEffect(()=>()=>{if(feedWebSnapTimer.current)clearTimeout(feedWebSnapTimer.current)},[]);
 const [storyComposerOpen,setStoryComposerOpen]=useState(false);
 const [storyRefreshToken,setStoryRefreshToken]=useState(0);
 useEffect(()=>{if(feedWebSnapTimer.current)clearTimeout(feedWebSnapTimer.current)},[screenWidth]);
 const lastVideoTap=useRef<{id:string;at:number}>({id:'',at:0});
 const burstTimer=useRef<ReturnType<typeof setTimeout>|null>(null);
 const [heartBurstPostId,setHeartBurstPostId]=useState<string|null>(null);
 const [pausedPostId,setPausedPostId]=useState<string|null>(null);
 const [wideVideoIds,setWideVideoIds]=useState<string[]>([]);
 const progressValue=useRef(new Animated.Value(0));
 const pauseTapTimer=useRef<ReturnType<typeof setTimeout>|null>(null);
 const visiblePostRef=useRef('');
 const [authReady,setAuthReady]=useState(!supabase);
 const exploreScrollRef=useRef<ScrollView>(null);
 const exploreResultsOffset=useRef(0);
 const pendingExploreJump=useRef(false);
 const [activeExploreCategory,setActiveExploreCategory]=useState('Trending');
 const compact=screenWidth<400;
 const micro=screenWidth<345;
 // Feed pages use the measured FlatList viewport, not the device's full screen.
 const feedPageHeight=feedViewportHeight>0?feedViewportHeight:Math.max(160,Math.round(screenHeight*.73));
 const wide=screenWidth>=700;
 const contentMaxWidth=wide?860:screenWidth;
 const feedMaxWidth=wide?520:screenWidth;
 const [researchFeatures,setResearchFeatures]=useState<string[]>([]),[researchPrice,setResearchPrice]=useState('free'),[researchIdentity,setResearchIdentity]=useState('both'),[researchNeed,setResearchNeed]=useState(''),[researchWilling,setResearchWilling]=useState(false),[researchLoaded,setResearchLoaded]=useState(false),[researchSaved,setResearchSaved]=useState(false); const researchOptions=[{id:'none_yet',label:'None of these yet'},{id:'avatar_cosmetics',label:'Avatar cosmetics & emotes'},{id:'creator_memberships',label:'Creator memberships'},{id:'live_tips_events',label:'Live tips & events'},{id:'ai_creator_tools',label:'AI creator tools'},{id:'creator_marketplace',label:'Creator marketplace'}];
 const [inboxOpen,setInboxOpen]=useState(false),[socialInboxOpen,setSocialInboxOpen]=useState(false),[socialPeer,setSocialPeer]=useState<DirectPeer|null>(null),[marketThread,setMarketThread]=useState<MarketThread|null>(null),[collection,setCollection]=useState<{userId?:string;saved:boolean;liked?:boolean}|null>(null);
 const [unreadMessages,setUnreadMessages]=useState(0);
 const unreadRefreshRef=useRef<()=>void>(()=>{});
 const refreshUnreadMessages=useCallback(()=>unreadRefreshRef.current(),[]);
 const feedRequest=useRef(0);
 const feedCursorRef=useRef<string|null>(null);
 const feedCanLoadMoreRef=useRef(false);
 const feedMorePendingRef=useRef(false);
 const feedRankingContextRef=useRef<RankingContext|null>(null);
 const [loadingMore,setLoadingMore]=useState(false);
 const [readyVideoIds,setReadyVideoIds]=useState<string[]>([]);
  const [failedVideoIds,setFailedVideoIds]=useState<string[]>([]);
  const [videoRetryVersions,setVideoRetryVersions]=useState<Record<string,number>>({});
 const watchRef=useRef<{postId:string;lastPositionMs:number;watchedMs:number;durationMs:number;startedAt:number;written:boolean}|null>(null);
 const feedQueueRef=useRef<ReturnType<typeof createFeedEventQueue>|null>(null);
 const marketRequest=useRef(0);
 const pendingInteractions=useRef(new Set<string>());
 const [activePostId,setActivePostId]=useState<string|null>(null); const [muted,setMuted]=useState(Platform.OS==='web'); const [appActive,setAppActive]=useState(true); const viewabilityConfig=useRef({itemVisiblePercentThreshold:75}).current; const onViewableItemsChanged=useRef(({viewableItems}:any)=>{
  const next=viewableItems?.[0]?.item?.id;
  if(!next)return;
  if(next!==visiblePostRef.current){
   visiblePostRef.current=next;
   progressValue.current.setValue(0);
   setPausedPostId(null);
   if(pauseTapTimer.current)clearTimeout(pauseTapTimer.current);
   pauseTapTimer.current=null;
  }
  setActivePostId(next);
 }).current;
 const [session,setSession]=useState<Session|null>(null),[tab,setTab]=useState<Tab>(Platform.OS==='web'&&String((globalThis as any).location?.search||'').includes('beta=1')?'Profile':initialProfileQuery?'Discover':'For You'),[posts,setPosts]=useState<Post[]>([]),[marketListings,setMarketListings]=useState<any[]>([]),[marketTitle,setMarketTitle]=useState(''),[marketDescription,setMarketDescription]=useState(''),[marketPrice,setMarketPrice]=useState(''),[marketCategory,setMarketCategory]=useState('All'),[marketCondition,setMarketCondition]=useState('Good'),[marketLocation,setMarketLocation]=useState(''),[marketAck,setMarketAck]=useState(false),[marketMode,setMarketMode]=useState<'browse'|'sell'>('browse'),[marketSearch,setMarketSearch]=useState(''),[loading,setLoading]=useState(false),[search,setSearch]=useState(initialProfileQuery),[email,setEmail]=useState<string>(()=>{if(Platform.OS!=='web'||!String((globalThis as any).location?.search||'').includes('beta=1'))return '';try{return String((globalThis as any).sessionStorage?.getItem('reconfeed_beta_email')||'').trim().toLowerCase()}catch(_error){return ''}}),[password,setPassword]=useState(''),[name,setName]=useState(''),[gender,setGender]=useState(''),[caption,setCaption]=useState(''),[asset,setAsset]=useState<ImagePicker.ImagePickerAsset|null>(null),[prompt,setPrompt]=useState(''),[workflow,setWorkflow]=useState('text-video'),[aiUrl,setAiUrl]=useState(''),[aiStatus,setAiStatus]=useState(''),[busy,setBusy]=useState(false),[profile,setProfile]=useState<any>(null),[commentTarget,setCommentTarget]=useState<Post|null>(null),[commentText,setCommentText]=useState(''),[commentItems,setCommentItems]=useState<any[]>([]),[commentsBusy,setCommentsBusy]=useState(false),[notInterested,setNotInterested]=useState<string[]>([]),[savedPostIds,setSavedPostIds]=useState<string[]>([]);
 const [termsAccepted,setTermsAccepted]=useState(false);
 const [politicalParty,setPoliticalParty]=useState<'republican'|'democratic'|''>(()=>{try{const v=Platform.OS==='web'?(globalThis as any).sessionStorage?.getItem('reconfeed_beta_party'):'';return v==='republican'||v==='democratic'?v:''}catch{return ''}});
 const [recovering,setRecovering]=useState(Platform.OS==='web'&&String((globalThis as any).location?.hash||'').includes('type=recovery')),[newPassword,setNewPassword]=useState('');
 const [captureMode,setCaptureMode]=useState<'photo'|'video'>('video'),[captureSeconds,setCaptureSeconds]=useState(15);
 const [profileStats,setProfileStats]=useState({following:0,followers:0,posts:0,likes:0});
 const [likedPostIds,setLikedPostIds]=useState<string[]>([]);
 const [recentActivity,setRecentActivity]=useState<Array<{post_id:string;kind:'Liked'|'Saved'|'Reposted';created_at:string;post:any}>>([]);
 const [activityBusy,setActivityBusy]=useState(false);
 const [activityError,setActivityError]=useState('');
 const [profilePosts,setProfilePosts]=useState<Array<{id:string;media_url:string;media_type:string;caption:string;visibility?:string;pinned_at?:string|null}>>([]);
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
 const [profileSettingsPage,setProfileSettingsPage]=useState<'drawer'|'settings'|'balance'|'advanced'>('drawer');
 const [blockedAccounts,setBlockedAccounts]=useState<Array<{blocked_id:string;created_at:string}>>([]);
 const [profileGridTab,setProfileGridTab]=useState<'videos'|'photos'|'private'|'reposts'|'saved'|'liked'|'activity'>('videos');
 const [profileLoading,setProfileLoading]=useState(false);
 const [followingIds,setFollowingIds]=useState<string[]>([]);
 const [repostedIds,setRepostedIds]=useState<string[]>([]);
 const [profileCollectionPosts,setProfileCollectionPosts]=useState<any[]>([]);
 const [profileCollectionLoading,setProfileCollectionLoading]=useState(false);
 const [profileCollectionError,setProfileCollectionError]=useState('');
 const [connections,setConnections]=useState<'following'|'followers'|null>(null);
 const [analyticsOpen,setAnalyticsOpen]=useState(false);
 const [profileEditOpen,setProfileEditOpen]=useState(false);
 const [researchPanelOpen,setResearchPanelOpen]=useState(false);
 const [profileSelected,setProfileSelected]=useState<{id:string;media_url:string;media_type:string;caption:string}|null>(null);
 const [profileGridLimit,setProfileGridLimit]=useState(18);
 const [profileViewCounts,setProfileViewCounts]=useState<Record<string,number>>({});
 const exploreSearchRequest=useRef(0);
 const profileDeepLinkOpened=useRef(false);
 const creatorProfileRequest=useRef(0);
 const [exploreBusy,setExploreBusy]=useState(false);
 const [exploreResults,setExploreResults]=useState<any[]>([]);
 const [exploreCreators,setExploreCreators]=useState<any[]>([]);
 const [suggestedCreatorIds,setSuggestedCreatorIds]=useState<string[]>([]);
 const [exploreSearched,setExploreSearched]=useState(false);
 const [exploreSelected,setExploreSelected]=useState<any>(null);
 const [replyTo,setReplyTo]=useState<any|null>(null);
 const [expandedThreads,setExpandedThreads]=useState<string[]>([]);
 const [commentLikedIds,setCommentLikedIds]=useState<string[]>([]);
 const [shareTarget,setShareTarget]=useState<Post|null>(null);
 const [feedMorePost,setFeedMorePost]=useState<Post|null>(null);
 const [soundTarget,setSoundTarget]=useState<Post|null>(null);
 const [testerIssueOpen,setTesterIssueOpen]=useState(false);
 const [testerReportsOpen,setTesterReportsOpen]=useState(false);
 const testerSubmitPending=useRef(false);
 const deletionRequestPending=useRef(false);
 useEffect(()=>{setTesterIssueOpen(false);setTesterReportsOpen(false);setTesterIssueTitle('');setTesterIssueDescription('');setTesterIssueSteps('');setTesterScreenshot(null);setProfileAvatarDraft(null);setProfilePhotoOpen(false);setProfileEditOpen(false);setProfileSettingsOpen(false);setProfileSettingsPage('drawer');setConnections(null);setAnalyticsOpen(false);setProfileGridTab('videos');setViewingCreator(null)},[session?.user.id]);
 const [testerIssueTitle,setTesterIssueTitle]=useState('');
 const [testerIssueDescription,setTesterIssueDescription]=useState('');
 const [testerIssueSteps,setTesterIssueSteps]=useState('');
 const [testerIssueCategory,setTesterIssueCategory]=useState('Bug');
 const [testerIssueBusy,setTesterIssueBusy]=useState(false);
 const [testerScreenshot,setTesterScreenshot]=useState<ImagePicker.ImagePickerAsset|null>(null);
 async function chooseTesterScreenshot(){try{const p=await ImagePicker.launchImageLibraryAsync({mediaTypes:['images'],allowsEditing:false,quality:0.8,exif:false,base64:false});if(!p.canceled&&p.assets[0])setTesterScreenshot(p.assets[0])}catch(e:any){showAlert('Screenshot unavailable',safeErrorMessage(e))}}
 const [reportTarget,setReportTarget]=useState<Post|null>(null);
 const [reportBusy,setReportBusy]=useState(false);
 const [viewingCreator,setViewingCreator]=useState<any>(null);
 const [viewingCreatorPosts,setViewingCreatorPosts]=useState<any[]>([]);
 const [creatorProfileLoading,setCreatorProfileLoading]=useState(false);
 const [profileBioDraft,setProfileBioDraft]=useState('');
 const [profileUsernameDraft,setProfileUsernameDraft]=useState('');
 const [profileAvatarDraft,setProfileAvatarDraft]=useState<ImagePicker.ImagePickerAsset|null>(null);
 const [profilePhotoOpen,setProfilePhotoOpen]=useState(false);
 const [profilePhotoBusy,setProfilePhotoBusy]=useState(false);
 const profilePhotoPending=useRef(false);
 const [postPrivacy,setPostPrivacy]=useState<'public'|'followers'|'private'>('public');
 const [isPromotional,setIsPromotional]=useState(false);
 const [mediaRightsConfirmed,setMediaRightsConfirmed]=useState(false);
 useEffect(()=>{setMediaRightsConfirmed(false)},[asset?.uri]);
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
 const personalizationRef=useRef(false);personalizationRef.current=personalizationEnabled;
 useEffect(()=>{
  let active=true;
  setPersonalizationEnabled(false);personalizationRef.current=false;
  if(!session?.user.id){setPersonalizationEnabled(false);return()=>{active=false}}
  void AsyncStorage.getItem('reconfeed_personalization_consent_v2_'+session.user.id)
   .then(value=>{if(active)setPersonalizationEnabled(value==='on')})
   .catch(()=>{if(active)setPersonalizationEnabled(false)});
  return()=>{active=false};
 },[session?.user.id]);
 function togglePersonalization(){
  if(!session)return;
  const value=!personalizationEnabled;
  personalizationRef.current=value;
  if(!value){watchRef.current=null;void feedQueueRef.current?.clear()}
  setPersonalizationEnabled(value);
  void AsyncStorage.setItem('reconfeed_personalization_consent_v2_'+session.user.id,value?'on':'off').catch(()=>{});
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
  if(!supabase||!session){setProfileStats({following:0,followers:0,posts:0,likes:0});setProfilePosts([]);setFollowingIds([]);setRepostedIds([]);return}
  setProfileLoading(true);
  void(async()=>{try{const id=session.user.id;const [following,followers,posts,preview,analytics,viewCounts]=await Promise.all([
   supabase.from('follows').select('following_id',{count:'exact'}).eq('follower_id',id),
   supabase.from('follows').select('follower_id',{head:true,count:'exact'}).eq('following_id',id),
   supabase.from('posts').select('id',{head:true,count:'exact'}).eq('user_id',id),
   supabase.from('posts').select('id,media_url,media_type,caption,pinned_at,visibility').eq('user_id',id).order('pinned_at',{ascending:false,nullsFirst:false}).order('created_at',{ascending:false}).limit(90),
   supabase.rpc('reconfeed_my_creator_analytics'),
   supabase.rpc('reconfeed_my_post_view_counts')
  ]);if(live){
   const numbers=analytics.data||{};
   setCreatorAnalytics({views:Number(numbers.views||0),completedViews:Number(numbers.completedViews||0),watchSeconds:Number(numbers.watchSeconds||0),shares:Number(numbers.shares||0)});
   setProfileStats({following:following.count||0,followers:followers.count||0,posts:posts.count||0,likes:Number(numbers.totalLikes||0)});
   setProfilePosts((preview.data||[]) as any);
   if(!following.error)setFollowingIds((following.data||[]).map((r:any)=>r.following_id));
   if(!viewCounts.error)setProfileViewCounts(Object.fromEntries((viewCounts.data||[]).map((row:any)=>[row.post_id,Number(row.view_count||0)])));
  }
  }catch(e){console.warn('Profile gallery unavailable',e)}finally{if(live)setProfileLoading(false)}})();
  return()=>{live=false};
 },[session?.user.id,tab==='Profile']);

 const accountRef=useRef<string|undefined>(undefined);accountRef.current=session?.user.id;
 useEffect(()=>{
  if(!supabase)return;
  let active=true;
  // Do not hold the whole app behind a session spinner on a slow network.
  const startupFallback=setTimeout(()=>{if(active)setAuthReady(true)},1800);
  const {data}=supabase.auth.onAuthStateChange((event,next)=>{
   if(!active)return;
   setSession(next);
   if(event==='INITIAL_SESSION')setAuthReady(true);
   if(event==='PASSWORD_RECOVERY'){setRecovering(true);setTab('Profile')}
  });
  void supabase.auth.getSession().then(({data:restored,error})=>{
   if(!active)return;
   if(error)console.warn('Session restore failed',error.message);
   else setSession(current=>current&&!restored.session?current:restored.session);
   setAuthReady(true);
  }).catch(error=>{if(active){console.warn('Session restore unavailable',error);setAuthReady(true)}});
  return()=>{active=false;clearTimeout(startupFallback);data.subscription.unsubscribe()};
 },[]);
 // Keep the message badge synced for all devices, without loading message
 // bodies or requiring the user to leave the feed. Account isolation is
 // handled by the recipient_id RLS query and the effect cleanup guard.
 useEffect(()=>{
  const userId=session?.user.id;
  let live=true;
  if(!supabase||!userId){setUnreadMessages(0);unreadRefreshRef.current=()=>{};return}
  const refresh=async()=>{
   if(AppState.currentState!=='active')return;
   try{
    const result=await supabase.from('direct_messages')
     .select('id',{head:true,count:'exact'})
     .eq('recipient_id',userId).is('read_at',null);
    if(result.error)throw result.error;
    if(live&&accountRef.current===userId)setUnreadMessages(result.count||0);
   }catch(error){console.warn('ReconFeed unread messages unavailable',error)}
  };
  unreadRefreshRef.current=()=>{void refresh()};
  void refresh();
  const timer=setInterval(()=>{void refresh()},25000);
  const subscription=AppState.addEventListener('change',state=>{if(state==='active')void refresh()});
  return()=>{live=false;clearInterval(timer);subscription.remove();unreadRefreshRef.current=()=>{}};
 },[session?.user.id]);
 // Fetch compatible updates automatically for all signed ReconFeed builds.
 // Downloads are applied on the next launch (or immediately if the user agrees
 // to restart), so account forms and uploads are never interrupted silently.
 useEffect(()=>{
  let cancelled=false,checking=false,lastCheck=0;
  async function syncReconFeedUpdate(){
   if(Platform.OS==='web'||!Updates.isEnabled||checking||Date.now()-lastCheck<5*60*1000)return;
   checking=true;lastCheck=Date.now();
   try{
    const check=await Updates.checkForUpdateAsync();
    if(cancelled||!check.isAvailable)return;
    const downloaded=await Updates.fetchUpdateAsync();
    if(cancelled||!downloaded.isNew)return;
    showAlert('ReconFeed update ready','The latest update has downloaded for your device. It will install automatically the next time you open ReconFeed, or you can restart now.',[
     {text:'Later',style:'cancel'},
     {text:'Restart now',onPress:()=>{void Updates.reloadAsync().catch(error=>console.warn('ReconFeed update restart failed',error))}}
    ]);
   }catch(error){console.warn('ReconFeed automatic update check failed',error)}
   finally{checking=false}
  }
  const timer=setTimeout(()=>{void syncReconFeedUpdate()},10000);
  const sub=AppState.addEventListener('change',state=>{if(state==='active')void syncReconFeedUpdate()});
  return()=>{cancelled=true;clearTimeout(timer);sub.remove()};
 },[]);
 useEffect(()=>{const sub=AppState.addEventListener('change',state=>{
  const active=state==='active';setAppActive(active);
  if(active){supabase?.auth.startAutoRefresh();void feedQueueRef.current?.flush();if(supabase){void supabase.auth.getSession().then(({data,error})=>{if(!error&&data.session)setSession(data.session)}).catch(error=>console.warn('Foreground session restore unavailable',error))}}
  else{supabase?.auth.stopAutoRefresh();void feedQueueRef.current?.flush()}
 });return()=>sub.remove()},[]);
 useEffect(()=>{
  if(!supabase||!session?.user.id){feedQueueRef.current?.dispose();feedQueueRef.current=null;return}
  const queue=createFeedEventQueue({
   userId:session.user.id,
   storage:AsyncStorage,
   insert:async events=>{const allowed=events.filter(event=>event.event_type==='not_interested'||personalizationRef.current);if(!allowed.length)return {error:null};const response=await supabase.from('feed_events').insert(allowed);return {error:response.error}}
  });
  feedQueueRef.current=queue;
  void queue.hydrate().then(()=>queue.flush());
  const flushInterval=setInterval(()=>{void queue.flush()},7000);
  return()=>{clearInterval(flushInterval);if(feedQueueRef.current===queue)feedQueueRef.current=null;queue.dispose()};
 },[session?.user.id]);

 useEffect(()=>{++feedRequest.current;++marketRequest.current;setActivePostId(null);if(tab==='Market')void loadMarketplace();else if((tab==='For You'||tab==='Following')&&(!session||prefsLoaded))void loadFeed();return()=>{++feedRequest.current;++marketRequest.current}},[tab,session?.user.id,prefsLoaded]);
 useEffect(()=>{
  if(tab!=='For You'||!authReady)return;
  let live=true;
  void AsyncStorage.getItem(feedCacheKey(session?.user.id)).then(raw=>{
   if(!live||!raw)return;
   const parsed=JSON.parse(raw) as {savedAt?:number;items?:Post[]};
   if(!parsed.savedAt||Date.now()-parsed.savedAt>3*60*1000||!Array.isArray(parsed.items))return;
   const candidates=parsed.items.filter(p=>p&&p.id&&p.media_url&&(p.media_type==='video'||p.media_type==='image')).slice(0,8);
   if(!candidates.length)return;
   const prefs:RankingContext={mode:'For You',followingIds:[],likedPostIds:[],savedPostIds:[],history:[],historyPosts:[],hiddenIds:notInterested,blockedKeywords,hideMatureContent};
   const visible=rankFeedPosts(candidates,prefs);
   if(!visible.length)return;
   setPosts(previous=>previous.length?previous:visible);
   setActivePostId(previous=>previous||visible[0].id);
  }).catch(error=>{console.warn('ReconFeed feed cache unavailable',error)});
  return()=>{live=false};
 },[authReady,session?.user.id,prefsLoaded,tab,hideMatureContent,blockedKeywords.join('|')]);
 useEffect(()=>{setPosts([]);setReadyVideoIds([]);setNotInterested([]);setSavedPostIds([]);setProfile(null);setName('');setPassword('');setCommentTarget(null);setCommentItems([]);setInboxOpen(false);setSocialInboxOpen(false);setSocialPeer(null);setStoryComposerOpen(false);setMarketThread(null);setCollection(null);setAiUrl('');setAiStatus('');setCaption('');setAsset(null);setMarketMode('browse');setMarketAck(false);setResearchLoaded(false);setResearchSaved(false);setResearchFeatures([]);setResearchPrice('free');setResearchIdentity('both');setResearchNeed('');setResearchWilling(false)},[session?.user.id]);
 useEffect(()=>{if(session){loadProfile();loadResearchResponse()}else{setResearchLoaded(false);setResearchSaved(false);setResearchFeatures([]);setResearchPrice('free');setResearchIdentity('both');setResearchNeed('');setResearchWilling(false)}},[session?.user.id]);
 useEffect(()=>{let active=true;setRepostedIds([]);if(supabase&&session){void supabase.from('reposts').select('post_id').eq('user_id',session.user.id).then(r=>{if(active&&!r.error)setRepostedIds((r.data||[]).map(x=>x.post_id))})}return()=>{active=false}},[session?.user.id]);
 useEffect(()=>{let active=true;setProfileCollectionPosts([]);setProfileCollectionError('');
  if(!supabase||!session||!['reposts','saved','liked'].includes(profileGridTab)){setProfileCollectionLoading(false);return}
  setProfileCollectionLoading(true);void(async()=>{try{
   const ids=profileGridTab==='reposts'?repostedIds:profileGridTab==='saved'?savedPostIds:likedPostIds;
   if(!ids.length)return;
   const r=await supabase.from('posts').select('id,user_id,caption,is_promotional,media_url,media_type,pinned_at,visibility').in('id',ids.slice(0,200));
   if(r.error)throw r.error;
   if(active)setProfileCollectionPosts(ids.flatMap(id=>(r.data||[]).filter(p=>p.id===id)));
  }catch(e:any){if(active)setProfileCollectionError(safeErrorMessage(e))}finally{if(active)setProfileCollectionLoading(false)}})();return()=>{active=false};
 },[session?.user.id,profileGridTab,repostedIds,savedPostIds,likedPostIds]);
 useEffect(()=>{
  let active=true;
  setRecentActivity([]);setActivityError('');
  if(!supabase||!session||profileGridTab!=='activity'){setActivityBusy(false);return}
  const userId=session.user.id;
  setActivityBusy(true);
  void(async()=>{
   try{
    const [likes,saves,reposts]=await Promise.all([
     supabase.from('likes').select('post_id,created_at').eq('user_id',userId).order('created_at',{ascending:false}).limit(40),
     supabase.from('saved_posts').select('post_id,created_at').eq('user_id',userId).order('created_at',{ascending:false}).limit(40),
     supabase.from('reposts').select('post_id,created_at').eq('user_id',userId).order('created_at',{ascending:false}).limit(40)
    ]);
    if(likes.error||saves.error||reposts.error)throw (likes.error||saves.error||reposts.error);
    const events:Array<{post_id:string;created_at:string;kind:'Liked'|'Saved'|'Reposted'}>=[
     ...(likes.data||[]).map((item:any)=>({...item,kind:'Liked' as const})),
     ...(saves.data||[]).map((item:any)=>({...item,kind:'Saved' as const})),
     ...(reposts.data||[]).map((item:any)=>({...item,kind:'Reposted' as const}))
    ].sort((a,b)=>new Date(b.created_at).getTime()-new Date(a.created_at).getTime()).slice(0,70);
    const ids=[...new Set(events.map(item=>item.post_id))];
    const result=ids.length?await supabase.from('posts').select('id,caption,media_url,media_type,visibility').in('id',ids):{data:[],error:null};
    if(result.error)throw result.error;
    const found=new Map((result.data||[]).map((post:any)=>[post.id,post]));
    if(active&&accountRef.current===userId){
     setRecentActivity(events.filter(event=>found.has(event.post_id)).map(event=>({...event,post:found.get(event.post_id)})));
    }
   }catch(error:any){if(active)setActivityError(safeErrorMessage(error))}
   finally{if(active)setActivityBusy(false)}
  })();
  return()=>{active=false};
 },[session?.user.id,profileGridTab,likedPostIds,savedPostIds,repostedIds]);
 const visibleProfilePosts=['reposts','saved','liked'].includes(profileGridTab)?profileCollectionPosts:profilePosts.filter(p=>profileGridTab==='private'?(p.visibility==='private'||creatorSettings.is_private):!creatorSettings.is_private&&p.visibility!=='private'&&(profileGridTab!=='photos'||p.media_type==='image'));
 function showCreatorAnalytics(){setAnalyticsOpen(true)}
 function startCreating(){setCaptureMode('video');setTab('Create')}
 function startStory(){if(!session){setTab('Profile');showAlert('Sign in required','Sign in to add a story.');return}setStoryComposerOpen(true)}
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
 async function loadProfile(){if(!supabase||!session)return;const r=await supabase.from('profiles').select('id,username,display_name,bio,avatar_url,created_at').eq('id',session.user.id).maybeSingle();if(r.error){showAlert('Profile unavailable',safeErrorMessage(r.error));return}if(accountRef.current===session.user.id){setProfile(r.data);setName(r.data?.display_name||'');setProfileBioDraft(r.data?.bio||'');setProfileUsernameDraft(r.data?.username||'')}}
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
    ?supabase.from('posts').select('id,user_id,caption,is_promotional,media_url,media_type,topic_tags,audio_label,overlay_text,transcript,content_rating,recommendation_status,created_at,profiles!posts_user_id_fkey(username,display_name,avatar_url)').eq('visibility','public').or(clauses.join(',')).order('created_at',{ascending:false}).limit(35)
    :supabase.from('posts').select('id,user_id,caption,is_promotional,media_url,media_type,topic_tags,audio_label,overlay_text,transcript,content_rating,recommendation_status,created_at,profiles!posts_user_id_fkey(username,display_name,avatar_url)').eq('visibility','public').order('created_at',{ascending:false}).limit(30);
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
  }finally{if(request===exploreSearchRequest.current){
   setExploreBusy(false);
   if(pendingExploreJump.current){
    pendingExploreJump.current=false;
    setTimeout(()=>exploreScrollRef.current?.scrollTo({y:exploreResultsOffset.current||330,animated:true}),175);
   }
  }}
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
  if(!supabase)return;if(creator.id===session?.user.id){setViewingCreator(null);setTab('Profile');return}
  const request=++creatorProfileRequest.current;setViewingCreator(creator);setViewingCreatorPosts([]);setCreatorProfileLoading(true);
  try{const [person,linkInfo,following,followers,response,followsYou]=await Promise.all([
   supabase.from('profiles').select('id,username,display_name,bio,avatar_url').eq('id',creator.id).maybeSingle(),
   supabase.from('profile_settings').select('pronouns,website_url').eq('user_id',creator.id).maybeSingle(),
   supabase.from('follows').select('following_id',{head:true,count:'exact'}).eq('follower_id',creator.id),
   supabase.from('follows').select('follower_id',{head:true,count:'exact'}).eq('following_id',creator.id),
   supabase.from('posts').select('id,user_id,caption,is_promotional,media_type,media_url,created_at,topic_tags,audio_label,overlay_text,transcript,content_rating,recommendation_status,likes(count)').eq('user_id',creator.id).eq('visibility','public').order('created_at',{ascending:false}).limit(90),
    session?supabase.from('follows').select('follower_id').eq('follower_id',creator.id).eq('following_id',session.user.id).maybeSingle():Promise.resolve({data:null,error:null})
  ]);if(request!==creatorProfileRequest.current)return;if(person.error)throw person.error;if(!person.data)throw new Error('This profile is unavailable.');if(response.error)throw response.error;
   setViewingCreator({...person.data,...linkInfo.data,followsYou:!!followsYou.data,following:following.count||0,followers:followers.count||0});
   setViewingCreatorPosts((response.data||[]).filter((p:any)=>allowedForFeed(p,{blockedKeywords,hideMatureContent},'Following')));
  }catch(error:any){if(request===creatorProfileRequest.current)showAlert('Profile unavailable',safeErrorMessage(error))}
  finally{if(request===creatorProfileRequest.current)setCreatorProfileLoading(false)}
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
     setProfilePosts(items=>items.filter(p=>p.id!==postId));setProfileSelected(p=>p?.id===postId?null:p);
     setProfileStats(v=>({...v,posts:Math.max(0,v.posts-1)}));
     setPosts(items=>items.filter(p=>p.id!==postId));
     showAlert('Post deleted','Your video or photo is no longer listed.');
    }catch(error:any){showAlert('Deletion failed',safeErrorMessage(error))}
   })()}}
  ]);
 }
 async function chooseProfilePhoto(){
  if(!session)return;
  try{
   const result=await ImagePicker.launchImageLibraryAsync({mediaTypes:['images'],allowsEditing:true,aspect:[1,1],quality:.7,exif:false,base64:Platform.OS!=='web'});
   if(result.canceled||!result.assets?.[0])return;
   setProfileAvatarDraft(result.assets[0]);
   // Keep the editor open: the photo, username, name and bio are saved together.
   // Outside the editor, use the dedicated photo preview-and-save sheet.
   if(!profileEditOpen)setProfilePhotoOpen(true);
  }catch(error:any){showAlert('Profile photo unavailable',safeErrorMessage(error))}
 }
  async function saveProfilePhoto(){
  if(!supabase||!session||!profileAvatarDraft||profilePhotoPending.current)return;
  const userId=session.user.id;const selected=profileAvatarDraft;
  profilePhotoPending.current=true;setProfilePhotoBusy(true);
  try{
   const avatar_url=await uploadProfilePhoto(supabase,userId,selected,Platform.OS==='web');
   const saved=await supabase.from('profiles').update({avatar_url}).eq('id',userId).select('id,avatar_url').single();
   if(saved.error)throw saved.error;
   if(saved.data?.avatar_url!==avatar_url)throw new Error('Your photo was not saved. Please retry.');
   if(accountRef.current!==userId)return;
   setProfile((previous:any)=>({...previous,...saved.data}));setProfileAvatarDraft(null);setProfilePhotoOpen(false);
   showAlert('Profile photo saved','Your new photo is saved to your account and is now displayed on your profile.');
  }catch(error:any){if(accountRef.current===userId)showAlert('Photo not saved',safeErrorMessage(error)+' Your selection is kept so you can retry.')}
  finally{profilePhotoPending.current=false;setProfilePhotoBusy(false)}
 }
 async function saveFullProfile(){
  if(!supabase||!session||busy)return;
  setBusy(true);
  try{
   const username=profileUsernameDraft.trim().replace(/^@/,'').toLowerCase();
   if(!/^[a-z0-9_.]{3,24}$/.test(username))throw new Error('Username must be 3–24 characters: lowercase letters, numbers, underscores or periods.');
   const update:any={username,display_name:name.trim().slice(0,80)||profile?.display_name,bio:profileBioDraft.trim().slice(0,80)};
   if(profileAvatarDraft)update.avatar_url=await uploadProfilePhoto(supabase,session.user.id,profileAvatarDraft,Platform.OS==='web');
   const result=await supabase.from('profiles').update(update).eq('id',session.user.id).select('id,username,display_name,bio,avatar_url').single();
   if(result.error)throw result.error;
   if(!result.data)throw new Error('Your profile was not saved. Please retry.');
   // The update response is the source of truth; avoid a second load racing
   // with the edited form and replacing it with cached profile fields.
   setProfile((previous:any)=>({...previous,...result.data}));
   setProfileAvatarDraft(null);
   setProfileEditOpen(false);
   showAlert('Profile updated','Your photo, username, name and bio have been saved.');
  }catch(error:any){showAlert('Could not update profile',error?.code==='23505'?'That username is already taken. Choose another.':safeErrorMessage(error))}
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
  // Real visual progress for guests; ranking signals below remain consent-gated.
  if(status?.isLoaded&&postId===(activePostId||posts[0]?.id)){
   const duration=Math.max(0,Number(status.durationMillis)||0);
   if(duration>0)progressValue.current.setValue(Math.min(1,Math.max(0,(Number(status.positionMillis)||0)/duration)));
  }
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
  let previewShown=false;
  try{
   const userId=session?.user.id;
   const isFollowing=tab==='Following';
   const feedSelect='id,user_id,caption,is_promotional,media_url,media_type,format,topic_tags,audio_label,overlay_text,transcript,content_rating,recommendation_status,created_at,profiles!posts_user_id_fkey(username,display_name,avatar_url),likes(count),comments(count)';
   // Begin the public For You request immediately; don't wait for preference queries.
   const initialFeedPageSize=12;
   const publicFeedPromise=!isFollowing
    ?supabase.from('posts').select(feedSelect).eq('visibility','public').eq('recommendation_status','eligible').order('created_at',{ascending:false}).limit(initialFeedPageSize)
    :Promise.resolve(null);
   // Render a first batch before historical signal queries finish. Filters
   // already honor the loaded account preferences; recommendation ranking
   // continues independently so it cannot delay the first video.
   if(!isFollowing){
    const preview=await publicFeedPromise;
    if(request!==feedRequest.current)return;
    if(!preview||preview.error)throw (preview?.error||new Error('Could not load videos'));
    const starterContext:RankingContext={
     mode:'For You',followingIds:[],likedPostIds:[],savedPostIds:[],
     history:[],historyPosts:[],hiddenIds:notInterested,blockedKeywords,hideMatureContent
    };
    const starterRanked=rankFeedPosts((preview.data||[]) as Post[],starterContext);
    // A video-first social feed should open on a playable video whenever an
    // eligible public video exists; still respect ranking and content filters.
    const starterPosts=[...starterRanked.filter(post=>post.media_type==='video'),...starterRanked.filter(post=>post.media_type!=='video')];
    setPosts(starterPosts);
    setActivePostId(starterPosts[0]?.id||null);
    if(starterPosts.length){
     void AsyncStorage.setItem(feedCacheKey(userId),JSON.stringify({savedAt:Date.now(),items:starterPosts.slice(0,8)})).catch(()=>{});
    }
    setLoading(false);
    previewShown=true;
   }
   const [followRes,historyRes,likesRes,saveRes]=userId?await Promise.all([
    supabase.from('follows').select('following_id,created_at').eq('follower_id',userId).limit(300),
    personalizationEnabled?(recommendationsResetAt?supabase.from('feed_events').select('post_id,event_type,watched_ms,duration_ms,created_at').eq('user_id',userId).gte('created_at',recommendationsResetAt).order('created_at',{ascending:false}).limit(100):supabase.from('feed_events').select('post_id,event_type,watched_ms,duration_ms,created_at').eq('user_id',userId).order('created_at',{ascending:false}).limit(100)):(recommendationsResetAt?supabase.from('feed_events').select('post_id,event_type,watched_ms,duration_ms,created_at').eq('user_id',userId).eq('event_type','not_interested').gte('created_at',recommendationsResetAt).order('created_at',{ascending:false}).limit(100):supabase.from('feed_events').select('post_id,event_type,watched_ms,duration_ms,created_at').eq('user_id',userId).eq('event_type','not_interested').order('created_at',{ascending:false}).limit(100)),
    personalizationEnabled?(recommendationsResetAt?supabase.from('likes').select('post_id').eq('user_id',userId).gte('created_at',recommendationsResetAt).limit(100):supabase.from('likes').select('post_id').eq('user_id',userId).limit(100)):Promise.resolve({data:[]}),
    personalizationEnabled?(recommendationsResetAt?supabase.from('saved_posts').select('post_id').eq('user_id',userId).gte('created_at',recommendationsResetAt).limit(100):supabase.from('saved_posts').select('post_id').eq('user_id',userId).limit(100)):Promise.resolve({data:[]})
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
   const oldIds=personalizationEnabled?[...new Set([...history.map(h=>h.post_id),...saved,...liked])].slice(0,55):[];
   const olderPosts=oldIds.length
    ?supabase.from('posts').select('id,user_id,caption,is_promotional,format,topic_tags,audio_label,overlay_text,transcript').in('id',oldIds).limit(55)
    :Promise.resolve({data:[],error:null});
   const followedSamples=personalizationEnabled&&personalFollows.length
    ?supabase.from('posts').select('id,user_id,caption,is_promotional,format,topic_tags,audio_label,overlay_text,transcript').in('user_id',personalFollows.slice(0,50)).eq('visibility','public').order('created_at',{ascending:false}).limit(24)
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
   feedCanLoadMoreRef.current=candidatePosts.length>=initialFeedPageSize;
   feedCursorRef.current=candidatePosts.length?candidatePosts[candidatePosts.length-1].created_at:null;
   if(previewShown){
    // Do not jump to a different video when slower personalization finishes.
    setPosts(current=>{
     if(!current.length)return ranked;
     const rankedIds=new Set(ranked.map(post=>post.id));
     const retained=current.filter(post=>rankedIds.has(post.id));
     const existing=new Set(retained.map(post=>post.id));
     return [...retained,...ranked.filter(post=>!existing.has(post.id))];
    });
   }else{
    setPosts(ranked);
    setActivePostId(id=>ranked.some(p=>p.id===id)?id:ranked[0]?.id||null);
   }
  }catch(error:any){
   if(request===feedRequest.current){
    console.warn('Feed load failed',safeErrorMessage(error));
    if(!previewShown)showAlert('Feed temporarily unavailable',safeErrorMessage(error));
   }
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
   const fields='id,user_id,caption,is_promotional,media_url,media_type,format,topic_tags,audio_label,overlay_text,transcript,content_rating,recommendation_status,created_at,profiles!posts_user_id_fkey(username,display_name,avatar_url),likes(count),comments(count)';
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
 async function auth(signup:boolean){if(busy)return;if(!supabase){showAlert('Setup required','Add the Supabase URL and public anon key to the mobile environment.');return}if(!email.trim()||password.length<6){showAlert('Check details','Enter an email and a password with at least 6 characters.');return}if(signup&&password.length<12){showAlert('Stronger password required','Use at least 12 characters for a new ReconFeed account. Existing accounts can still sign in with their current password.');return}if(signup&&!['MALE','FEMALE','Other'].includes(gender)){showAlert('Choose gender','Choose MALE, FEMALE, or Other to continue.');return}if(signup&&!termsAccepted){showAlert('Accept terms first','Read and accept the ReconFeed Terms of Service and Privacy Policy before creating an account.');return}if(signup&&!politicalParty){showAlert('Political party required','Select Republican or Democratic to complete beta registration.');return}if(signup&&politicalParty!=='republican'){showAlert('Registration unavailable','ReconFeed beta registration is currently restricted to applicants selecting Republican.');return}setBusy(true);try{const r=signup?await supabase.auth.signUp({email:email.trim(),password,options:{emailRedirectTo:(api||'https://reconfeed.com')+'/app/',data:{display_name:name||email.split('@')[0],gender,terms_accepted_version:'2026-10-10',terms_accepted_at:new Date().toISOString()}}}):await supabase.auth.signInWithPassword({email:email.trim(),password});if(r.error)throw r.error;if(signup&&!r.data.session)showAlert('Account request received','If this is a new account, check your email for confirmation. If you already confirmed this email, use Sign in with your original password or Forgot password.');else {if(r.data.session){setSession(r.data.session);setAuthReady(true)}setTab('For You')}}catch(e:any){showAlert('Account error',e.code==='invalid_credentials'?'Email or password did not match. Use your original account password, or choose Forgot password.':e.code==='over_email_send_rate_limit'?'Email sending is temporarily limited. Wait before requesting another email.':safeErrorMessage(e))}finally{setBusy(false)}}
 async function choose(){try{
  const r=await ImagePicker.launchImageLibraryAsync({mediaTypes:['images','videos'],quality:.9,videoMaxDuration:90,videoExportPreset:ImagePicker.VideoExportPreset.MediumQuality,exif:false,base64:false});
  if(!r.canceled&&r.assets?.[0])setAsset(r.assets[0]);
 }catch(e:any){showAlert('Gallery unavailable',safeErrorMessage(e))}}
 async function capture(forcedMode?:'video'|'photo'){try{
  const selectedMode=forcedMode||captureMode;
  if(Platform.OS!=='web'){
   const permission=await capturePermission(selectedMode,{camera:ImagePicker.requestCameraPermissionsAsync,microphone:Audio.requestPermissionsAsync});
   if(!permission.allowed){
    showAlert('Permission declined','ReconFeed cannot use your '+permission.feature+' without permission. You can keep browsing or choose an existing file. Change permissions in your phone settings.',[{text:'Not now',style:'cancel'},{text:'Open settings',onPress:()=>{void Linking.openSettings()}}]);return;
   }
  }
  const result=await ImagePicker.launchCameraAsync({mediaTypes:selectedMode==='video'?['videos']:['images'],quality:.9,videoMaxDuration:captureSeconds,exif:false,base64:false});
  if(!result.canceled&&result.assets?.[0])setAsset(result.assets[0]);
 }catch(e:any){showAlert('Camera unavailable',safeErrorMessage(e))}}

 async function publish(){if(!supabase||!session){showAlert('Sign in required','Sign in before publishing.');setTab('Profile');return}if(!asset){showAlert('Choose media','Select a photo or video first.');return}if(!mediaRightsConfirmed){showAlert('Media rights confirmation required','Confirm that you own or have permission to use the photo, video, audio and any recognizable people or brand content.');return}const maxBytes=24*1024*1024;if(asset.fileSize&&asset.fileSize>maxBytes){showAlert('File too large','This beta currently supports uploads up to 24 MB. Choose a smaller photo/video or compress the video, then try again.');return}setBusy(true);try{const connection=await supabase.from('profiles').select('id').eq('id',session.user.id).maybeSingle();if(connection.error){const msg=String(connection.error.message||'');if(/fetch|network|timeout|connection/i.test(msg))throw new Error('ReconFeed cannot reach the server. Check the phone’s Wi-Fi or mobile data, then try again.');throw connection.error}const response=await fetch(asset.uri);if(!response.ok)throw new Error('Could not read the selected media from this phone. Please choose it again.');const binary=await response.arrayBuffer();if(binary.byteLength>maxBytes){throw new Error('This file is over the 24 MB upload limit. Choose a smaller file or compress the video.')}const ext=(asset.fileName?.split('.').pop()||(asset.type==='video'?'mp4':'jpg')).toLowerCase().replace(/[^a-z0-9]/g,'');const path=session.user.id+'/'+Date.now()+'.'+ext;// Supabase currently caps the post-media bucket at 25 MB. Use a safe 24 MB application limit.
const mimeByExt:Record<string,string>={jpg:'image/jpeg',jpeg:'image/jpeg',png:'image/png',webp:'image/webp',gif:'image/gif',mp4:'video/mp4',mov:'video/quicktime',webm:'video/webm'};
const contentType=mimeByExt[ext]||asset.mimeType||(asset.type==='video'?'video/mp4':'image/jpeg');
const attemptUpload=()=>supabase.storage.from('post-media').upload(path,binary,{contentType,cacheControl:'3600',upsert:false});
let upload=await attemptUpload();
for(let retry=0;retry<2&&upload.error;retry++){
 const message=String(upload.error.message||'').toLowerCase();
 const status=String((upload.error as any).statusCode||(upload.error as any).status||'');
 // Retry only transient errors; policy, size and format errors must be shown to creators.
 if(!(/network|fetch|timeout|connection|temporarily|socket|reset/.test(message)||status==='429'||/^5\d\d$/.test(status)))break;
 await new Promise(resolve=>setTimeout(resolve,500*(retry+1)));
 upload=await attemptUpload();
}
if(upload.error){const raw=String(upload.error.message||'Storage upload failed');const status=String((upload.error as any).statusCode||(upload.error as any).status||'');console.error('ReconFeed media upload failed',{status,message:raw});if(/row-level security|policy|permission/i.test(raw))throw new Error('Supabase blocked this upload. Verify the signed-in user’s post-media Storage policy. '+raw);if(/bucket/i.test(raw))throw new Error('The Supabase post-media bucket is missing or misconfigured. '+raw);if(/network|fetch|timeout|connection/i.test(raw))throw new Error('Media upload request failed'+(status?' (HTTP '+status+')':'')+': '+raw+'. Keep the app open, check the connection, and retry.');throw new Error('Media upload failed'+(status?' (HTTP '+status+')':'')+': '+raw)}const media=supabase.storage.from('post-media').getPublicUrl(upload.data.path).data.publicUrl;const post=await supabase.from('posts').insert({user_id:session.user.id,caption:caption.trim(),media_url:media,media_type:asset.type==='video'?'video':'image',format:'Original',visibility:postPrivacy,is_promotional:isPromotional,
  topic_tags:parseCreatorTags(tagDraft),
  audio_label:audioLabelDraft.trim().slice(0,90),
  overlay_text:overlayTextDraft.trim().slice(0,500),
  transcript:transcriptDraft.trim().slice(0,2000),
  content_rating:creatorMature?'mature':'general'
 });if(post.error){await supabase.storage.from('post-media').remove([upload.data.path]);if(/network|fetch|timeout|connection/i.test(String(post.error.message||'')))throw new Error('Your media uploaded, but the post could not be saved because the connection failed. Reconnect and try again.');throw post.error}setCaption('');setAsset(null);setIsPromotional(false);setTagDraft('');setAudioLabelDraft('');setOverlayTextDraft('');setTranscriptDraft('');setCreatorMature(false);setPostPrivacy('public');setTab('For You');await loadFeed();showAlert('Published','Your post is live.')}catch(e:any){showAlert('Publish failed',safeErrorMessage(e))}finally{setBusy(false)}}
 async function openComments(p:Post){setCommentTarget(p);setCommentText('');setReplyTo(null);setExpandedThreads([]);setCommentItems([]);if(!supabase){showAlert('Setup required','Connect Supabase to load and publish comments.');return}setCommentsBusy(true);try{const r=await supabase.from('comments').select('id,post_id,user_id,body,created_at,parent_id').eq('post_id',p.id).order('created_at',{ascending:true}).limit(100);if(r.error)throw r.error;const rows=r.data||[];const ids=[...new Set(rows.map((x:any)=>x.user_id))];const pr=ids.length?await supabase.from('profiles').select('id,username,display_name,avatar_url').in('id',ids):{data:[]};const byId:any={};(pr.data||[]).forEach((x:any)=>byId[x.id]=x);setCommentItems(rows.map((x:any)=>({...x,profiles:byId[x.user_id]})))}catch(e:any){showAlert('Comments unavailable',e.message)}finally{setCommentsBusy(false)}}
  async function submitComment(){if(!supabase||!session){showAlert('Sign in required','Sign in to comment.');setCommentTarget(null);setTab('Profile');return}if(!commentTarget||!commentText.trim())return;setCommentsBusy(true);try{const r=await supabase.from('comments').insert({post_id:commentTarget.id,user_id:session.user.id,body:commentText.trim(),parent_id:replyTo?.id||null}).select('id,post_id,user_id,body,created_at,parent_id').single();if(r.error)throw r.error;setCommentItems(items=>[...items,{...r.data,profiles:profile||{display_name:'You'}}]);setPosts(items=>items.map(p=>p.id===commentTarget.id?{...p,comments:[{count:Number(p.comments?.[0]?.count||0)+1}]}:p));setCommentText('');if(replyTo){setExpandedThreads(ids=>ids.includes(replyTo.id)?ids:[...ids,replyTo.id]);setReplyTo(null)}}catch(e:any){showAlert('Comment failed',e.message)}finally{setCommentsBusy(false)}}
  async function like(p:Post,onlyAdd=false){if(!supabase||!session){showAlert('Sign in required','Sign in to like posts.');return}const userId=session.user.id;const operation='like:'+userId+':'+p.id;if(pendingInteractions.current.has(operation))return;pendingInteractions.current.add(operation);try{const ex=await supabase.from('likes').select('post_id').eq('post_id',p.id).eq('user_id',session.user.id).maybeSingle();if(ex.error)throw ex.error;if(ex.data&&onlyAdd){setLikedPostIds(ids=>ids.includes(p.id)?ids:[p.id,...ids]);return}const r=ex.data?await supabase.from('likes').delete().eq('post_id',p.id).eq('user_id',session.user.id):await supabase.from('likes').insert({post_id:p.id,user_id:session.user.id});if(r.error)throw r.error;if(accountRef.current!==userId)return;setLikedPostIds(ids=>ex.data?ids.filter(id=>id!==p.id):ids.includes(p.id)?ids:[p.id,...ids]);setPosts(items=>items.map(item=>item.id===p.id?{...item,likes:[{count:Math.max(0,Number(item.likes?.[0]?.count||0)+(ex.data?-1:1))}]}:item))}catch(e:any){showAlert('Like unavailable',safeErrorMessage(e))}finally{pendingInteractions.current.delete(operation)}}
 function onFeedVideoTap(p:Post){
  const now=Date.now();const last=lastVideoTap.current;
  if(last.id===p.id&&now-last.at<=375){
   lastVideoTap.current={id:'',at:0};
   if(pauseTapTimer.current)clearTimeout(pauseTapTimer.current);
   pauseTapTimer.current=null;
   void like(p,true);
   setHeartBurstPostId(p.id);
   if(burstTimer.current)clearTimeout(burstTimer.current);
   burstTimer.current=setTimeout(()=>setHeartBurstPostId(null),700);
  }else{
   lastVideoTap.current={id:p.id,at:now};
   if(pauseTapTimer.current)clearTimeout(pauseTapTimer.current);
   if(p.media_type==='video')pauseTapTimer.current=setTimeout(()=>{setPausedPostId(id=>id===p.id?null:p.id);pauseTapTimer.current=null;},380);
  }
 }
 useEffect(()=>()=>{if(burstTimer.current)clearTimeout(burstTimer.current);if(pauseTapTimer.current)clearTimeout(pauseTapTimer.current)},[]);
 useEffect(()=>{setPausedPostId(null);progressValue.current.setValue(0)},[tab]);
 async function savePost(p:Post){if(!supabase||!session){showAlert('Sign in required','Sign in to save posts to your collection.');setTab('Profile');return}const userId=session.user.id;const operation='save:'+userId+':'+p.id;if(pendingInteractions.current.has(operation))return;pendingInteractions.current.add(operation);const already=savedPostIds.includes(p.id);try{if(already){const r=await supabase.from('saved_posts').delete().eq('user_id',session.user.id).eq('post_id',p.id);if(r.error)throw r.error;if(accountRef.current!==userId)return;setSavedPostIds(ids=>ids.filter(id=>id!==p.id))}else{const r=await supabase.from('saved_posts').insert({user_id:session.user.id,post_id:p.id});if(r.error)throw r.error;if(accountRef.current!==userId)return;setSavedPostIds(ids=>ids.includes(p.id)?ids:[...ids,p.id])}}catch(e:any){showAlert('Save unavailable',safeErrorMessage(e))}finally{pendingInteractions.current.delete(operation)}}
 async function follow(p:Post,unfollow=false){
  if(!supabase||!session){showAlert('Sign in required','Sign in to follow creators.');return}if(p.user_id===session.user.id)return;
  const actor=session.user.id,token='follow:'+actor+':'+p.user_id;if(pendingInteractions.current.has(token))return;pendingInteractions.current.add(token);
  try{const r=unfollow?await supabase.from('follows').delete().eq('follower_id',actor).eq('following_id',p.user_id):await supabase.from('follows').upsert({follower_id:actor,following_id:p.user_id},{onConflict:'follower_id,following_id',ignoreDuplicates:true});
   if(r.error)throw r.error;if(accountRef.current!==actor)return;
   setFollowingIds(ids=>unfollow?ids.filter(id=>id!==p.user_id):ids.includes(p.user_id)?ids:[...ids,p.user_id]);
   if(followingIds.includes(p.user_id)!==!unfollow)setProfileStats(v=>({...v,following:Math.max(0,v.following+(unfollow?-1:1))}));
   if(viewingCreator?.id===p.user_id&&followingIds.includes(p.user_id)!==!unfollow)setViewingCreator((v:any)=>v?.id===p.user_id?{...v,followers:Math.max(0,(v.followers||0)+(unfollow?-1:1))}:v);
  }catch(e:any){showAlert('Follow failed',safeErrorMessage(e))}finally{pendingInteractions.current.delete(token)}
 }
 async function repost(p:Post){if(!supabase||!session){showAlert('Sign in required','Sign in to repost.');return}const actor=session.user.id,token='repost:'+actor+':'+p.id;if(pendingInteractions.current.has(token))return;pendingInteractions.current.add(token);try{const exists=repostedIds.includes(p.id);const r=exists?await supabase.from('reposts').delete().eq('user_id',actor).eq('post_id',p.id):await supabase.from('reposts').upsert({user_id:actor,post_id:p.id},{onConflict:'user_id,post_id',ignoreDuplicates:true});if(r.error)throw r.error;if(accountRef.current===actor)setRepostedIds(ids=>exists?ids.filter(id=>id!==p.id):[p.id,...ids])}catch(e:any){showAlert('Repost failed',safeErrorMessage(e))}finally{pendingInteractions.current.delete(token)}}
 async function generate(){if(!session){showAlert('Sign in required','Sign in before using AI Studio.');setTab('Profile');return}if(!api){showAlert('AI setup required','Configure the deployed API URL and provider token before generating.');return}if(prompt.trim().length<8){showAlert('Add detail','Describe the creation in at least 8 characters.');return}setBusy(true);setAiStatus('Starting…');setAiUrl('');try{const r=await fetch(api+'/api/generate',{method:'POST',headers:{'Content-Type':'application/json','Authorization':'Bearer '+session.access_token},body:JSON.stringify({workflow,prompt,duration:5,aspectRatio:'9:16'})});const d=await r.json();if(!r.ok)throw new Error(d.error||'Generation could not start');if(d.output){setAiUrl(Array.isArray(d.output)?d.output[0]:d.output);setAiStatus('Ready')}else if(d.id){for(let i=0;i<60;i++){await new Promise(res=>setTimeout(res,4000));const rr=await fetch(api+'/api/generation-status?id='+encodeURIComponent(d.id),{headers:{'Authorization':'Bearer '+session.access_token}});const st=await rr.json();if(!rr.ok)throw new Error(st.error||'Could not check generation status');if(st.status==='succeeded'&&st.output){setAiUrl(Array.isArray(st.output)?st.output[0]:st.output);setAiStatus('Ready');return}if(['failed','canceled'].includes(st.status))throw new Error(st.error||'Generation failed');setAiStatus('Generating…')}setAiStatus('Still processing.')}else setAiStatus('Request accepted; no output returned yet.')}catch(e:any){setAiStatus('Unavailable');showAlert('AI Studio',e.message)}finally{setBusy(false)}}
 const media=(p:Post)=>{
  const focus=Math.max(0,posts.findIndex(item=>item.id===(activePostId||posts[0]?.id)));
  const position=posts.findIndex(item=>item.id===p.id);
  // Keep only the active player and its next two neighbors mounted; those can buffer ahead.
  // Distant videos stay unmounted to avoid too many decoders on a phone.
  const currentId=activePostId||posts[0]?.id||'';
  const nearby=position===focus||(position===focus-1&&readyVideoIds.includes(p.id))||(position===focus+1&&readyVideoIds.includes(currentId));
  if(p.media_type==='video'&&failedVideoIds.includes(p.id))return <View style={[s.fullMedia,{justifyContent:'center',alignItems:'center',padding:22,backgroundColor:olive.deep}]}>
   <Text accessibilityRole="alert" style={{fontSize:19,color:olive.text,fontWeight:'900',textAlign:'center'}}>Video couldn't load</Text>
   <Text style={{fontSize:13,color:olive.muted,textAlign:'center',marginTop:9}}>Check your connection or retry this video.</Text>
   <Pressable accessibilityRole="button" accessibilityLabel="Retry video" style={{marginTop:16,borderWidth:1,borderColor:olive.border,backgroundColor:olive.raised,paddingHorizontal:26,paddingVertical:13,borderRadius:11}} onPress={()=>{setFailedVideoIds(ids=>ids.filter(id=>id!==p.id));setVideoRetryVersions(v=>({...v,[p.id]:(v[p.id]||0)+1}));}}><Text style={{color:olive.gold,fontWeight:'900'}}>↻ Retry video</Text></Pressable>
  </View>;
   if(p.media_type==='video'&&!nearby)return <View style={[s.fullMedia,{justifyContent:'center',alignItems:'center'}]}><Text style={{color:'#9caa96',fontSize:16}}>Up next…</Text></View>;
  return <>{p.media_type==='video'?<FeedVideo key={p.id+':'+(videoRetryVersions[p.id]||0)} uri={p.media_url}
   active={appActive&&!commentTarget&&!soundTarget&&!inboxOpen&&!socialInboxOpen&&!collection&&(tab==='For You'||tab==='Following')&&p.id===(activePostId||posts[0]?.id)}
   muted={muted} paused={pausedPostId===p.id} wide={wideVideoIds.includes(p.id)}
   onElement={element=>{if(element)webPlayerElements.current.set(p.id,element);else webPlayerElements.current.delete(p.id)}}
   onLoad={size=>{setFailedVideoIds(ids=>ids.includes(p.id)?ids.filter(id=>id!==p.id):ids);setReadyVideoIds(ids=>ids.includes(p.id)?ids:[p.id,...ids].slice(0,8));if(size.width>0&&size.height>0){const wide=size.width>size.height*.95;setWideVideoIds(ids=>{const had=ids.includes(p.id);return had===wide?ids:wide?[...ids,p.id]:ids.filter(id=>id!==p.id)})}}}
   onError={()=>{setFailedVideoIds(ids=>ids.includes(p.id)?ids:[...ids,p.id].slice(-16));setReadyVideoIds(ids=>ids.filter(id=>id!==p.id));}}
   onProgress={status=>trackPlayback(p.id,status)}
  />:<Image source={{uri:p.media_url}} style={s.fullMedia} resizeMode="cover"/>}</>;
 };
 const feed=()=> <View style={{flex:1,backgroundColor:olive.bg}}><View style={[s.feedTop,{height:compact?50:56}]}><View style={s.feedNavRow}>
 <Pressable accessibilityRole="button" accessibilityLabel="Discover people and videos" style={s.feedUtilityButton} onPress={()=>setTab('Discover')}><Text style={s.feedUtilityIcon}>⌕</Text></Pressable>
 <View style={s.feedMainTabs}>
  <Pressable accessibilityRole="tab" accessibilityState={{selected:tab==='Following'}} style={s.feedMainTabButton} onPress={()=>{setSearch('');setTab('Following')}}><Text style={[s.feedMainTabText,tab==='Following'&&s.feedMainTabActive]}>Following</Text>{tab==='Following'?<View style={s.feedActiveIndicator}/>:null}</Pressable>
  <View style={s.feedMainDivider}/>
  <Pressable accessibilityRole="tab" accessibilityState={{selected:tab==='For You'}} style={s.feedMainTabButton} onPress={()=>{setSearch('');setTab('For You')}}><Text style={[s.feedMainTabText,tab==='For You'&&s.feedMainTabActive]}>For You</Text>{tab==='For You'?<View style={s.feedActiveIndicator}/>:null}</Pressable>
 </View>
 <Pressable accessibilityRole="button" accessibilityLabel="Marketplace" style={s.feedUtilityButton} onPress={()=>setTab('Market')}><Text style={s.feedUtilityIcon}>▣</Text></Pressable>
 </View></View>{tab==='Following'?<View style={{paddingTop:compact?50:56,backgroundColor:olive.deep}}><StoryStrip client={supabase} session={session} refreshToken={storyRefreshToken} onCreate={startStory}/></View>:null}{loading&&!posts.length?<View style={[s.feedLoading,{backgroundColor:olive.deep,paddingTop:56}]}>
<Image source={require('./assets/icon.png')} style={{width:86,height:86,opacity:.93,borderRadius:22}} resizeMode="contain"/>
<Text style={{color:olive.gold,fontSize:22,fontWeight:'900',letterSpacing:1.5}}>RECONFEED</Text>
<Text style={{color:olive.muted,fontSize:13,textAlign:'center',paddingHorizontal:24}}>Finding something worth watching…</Text>
<Pressable accessibilityRole="button" accessibilityLabel="Retry loading videos" onPress={()=>void loadFeed()} style={{paddingHorizontal:20,paddingVertical:12,borderWidth:1,borderColor:olive.border,borderRadius:12,marginTop:8}}><Text style={{color:olive.text,fontWeight:'800'}}>Retry</Text></Pressable>
</View>:posts.length?<View style={{flex:1,minHeight:0,overflow:'hidden'}} onLayout={event=>{const h=Math.round(event.nativeEvent.layout.height);if(h>0&&h!==feedViewportHeight)setFeedViewportHeight(h)}}><FlatList key={tab} ref={feedListRef} style={[{flex:1,minHeight:0},Platform.OS==='web'?({scrollSnapType:'y mandatory',overscrollBehaviorY:'contain',scrollbarWidth:'none'} as any):null]} onLayout={event=>{const h=Math.round(event.nativeEvent.layout.height);if(h>0&&h!==feedViewportHeight)setFeedViewportHeight(h)}} data={posts} keyExtractor={p=>p.id} extraData={activePostId+'|'+readyVideoIds.join(',')+'|'+failedVideoIds.join(',')+'|'+likedPostIds.join(',')+'|'+savedPostIds.join(',')+'|'+heartBurstPostId+'|'+wideVideoIds.join(',')+'|'+pausedPostId} windowSize={5} initialNumToRender={2} maxToRenderPerBatch={2} updateCellsBatchingPeriod={50} onEndReached={()=>{void loadMoreFeed()}} onEndReachedThreshold={0.65} ListFooterComponent={null} getItemLayout={(_,index)=>({length:feedPageHeight,offset:feedPageHeight*index,index})} pagingEnabled snapToInterval={feedPageHeight} snapToAlignment="start" disableIntervalMomentum decelerationRate="fast" showsVerticalScrollIndicator={false} scrollEventThrottle={16} onScroll={event=>{if(Platform.OS==='web')scheduleWebFeedSnap(event.nativeEvent.contentOffset.y)}} onScrollEndDrag={event=>{if(Platform.OS==='web')scheduleWebFeedSnap(event.nativeEvent.contentOffset.y)}} onMomentumScrollEnd={event=>{if(Platform.OS==='web')scheduleWebFeedSnap(event.nativeEvent.contentOffset.y)}} onViewableItemsChanged={onViewableItemsChanged} viewabilityConfig={viewabilityConfig} refreshControl={<RefreshControl refreshing={loading} onRefresh={loadFeed} tintColor={theme.purple} colors={[theme.purple]}/>} renderItem={({item:p})=>{const pr=Array.isArray(p.profiles)?p.profiles[0]:p.profiles;const pageHeight=feedPageHeight;return <View style={[s.videoPage,{height:pageHeight},Platform.OS==='web'?({scrollSnapAlign:'start',scrollSnapStop:'always'} as any):null]}><View style={s.videoCanvas}>{media(p)}</View><Pressable accessibilityRole="button" accessibilityLabel="Double tap video to like" pointerEvents={failedVideoIds.includes(p.id)?'none':'auto'} onPress={()=>onFeedVideoTap(p)} style={StyleSheet.absoluteFillObject}/>{pausedPostId===p.id&&p.media_type==='video'?<View pointerEvents="none" style={s.feedPausedIndicator}><Text style={s.feedPausedGlyph}>▶</Text></View>:null}{heartBurstPostId===p.id?<View pointerEvents="none" style={{position:'absolute',alignSelf:'center',top:'36%',zIndex:5}}><Text style={{fontSize:88,fontWeight:'900',color:'#ef3340',textShadowColor:'#fff',textShadowRadius:8}}>♥</Text></View>:null}<View pointerEvents="box-none" style={s.videoShade}/>{p.media_type==='video'?<View pointerEvents="none" style={s.feedProgressTrack}><Animated.View style={[s.feedProgressFill,{width:progressValue.current.interpolate({inputRange:[0,1],outputRange:['0%','100%']})}]}/></View>:null}{p.media_type==='video'?<Pressable accessibilityRole="button" accessibilityLabel={muted?'Turn on video sound':'Mute video sound'} onPress={()=>{const unmute=muted;const el=webPlayerElements.current.get(p.id);if(el){el.muted=!unmute;if(unmute){setPausedPostId(null);void el.play().catch(()=>{})}}setMuted(!muted)}} style={{position:'absolute',left:12,top:63,paddingHorizontal:10,paddingVertical:6,backgroundColor:'rgba(10,19,12,.65)',borderWidth:1,borderColor:olive.border,borderRadius:12,zIndex:6}}><Text style={{fontSize:11,color:olive.text,fontWeight:'800'}}>{muted?'🔇 Tap for sound':'🔊 Sound on'}</Text></Pressable>:null}<View style={s.videoTopBadge}><Text style={s.videoBadgeText}>✦  RECONFEED COMMUNITY</Text></View><View style={[s.videoInfo,{left:compact?10:16,right:compact?66:80,bottom:Math.max(26,Math.min(58,Math.round(pageHeight*.09)))}]}><Pressable onPress={()=>void openCreatorProfile({...pr,id:p.user_id})}><Text style={s.videoCreator}>@{pr?.username||pr?.display_name||'creator'}</Text></Pressable>{p.is_promotional?<Text accessibilityLabel="Paid promotion or gifted product" style={{color:olive.gold,fontSize:12,fontWeight:'900',marginVertical:4,textShadowColor:'#000',textShadowRadius:5}}>PAID PROMOTION / GIFTED PRODUCT</Text>:null}<Text style={[s.videoCaption,pageHeight<440&&{fontSize:12,lineHeight:17}]} numberOfLines={pageHeight<440?2:4}>{p.caption||'A new perspective from the ReconFeed community.'}</Text><Pressable onPress={()=>setSoundTarget(p)}><Text style={s.videoMeta}>♫ {p.audio_label||'Original Sound'}  ›</Text></Pressable></View><View style={[s.videoActions,{right:compact?5:12,bottom:Math.max(26,Math.min(58,Math.round(pageHeight*.09))),width:compact?52:62,gap:pageHeight<550?2:8}]}>
 <View style={[s.actionButton,{backgroundColor:'transparent',minHeight:55}]}>
  <Pressable accessibilityRole="button" accessibilityLabel={'Open @'+(pr?.username||'creator')} onPress={()=>void openCreatorProfile({...pr,id:p.user_id})} style={s.feedCreatorAvatar}>{pr?.avatar_url?<Image source={{uri:pr.avatar_url}} style={{width:'100%',height:'100%',borderRadius:24}}/>:<Text style={s.followDiscText}>{(pr?.display_name||pr?.username||'R')[0]}</Text>}</Pressable>
  {p.user_id!==session?.user.id&&!followingIds.includes(p.user_id)?<Pressable accessibilityRole="button" accessibilityLabel="Follow creator" onPress={()=>void follow(p)} style={s.feedFollowPlus}><Text style={{color:'#fff',fontWeight:'900',fontSize:18}}>+</Text></Pressable>:null}
 </View>
 <Pressable accessibilityRole="button" accessibilityLabel={likedPostIds.includes(p.id)?'Unlike post':'Like post'} style={({pressed})=>[s.actionButton,pressed&&{transform:[{scale:.9}],opacity:.8}]} onPress={()=>void like(p)}><ProfileIcon name="heart" size={pageHeight<550?27:32} color={likedPostIds.includes(p.id)?'#ff3763':'#fff'}/><Text style={s.actionCount}>{Number(p.likes?.[0]?.count||0).toLocaleString()}</Text></Pressable>
 <Pressable accessibilityRole="button" accessibilityLabel="Read comments" style={({pressed})=>[s.actionButton,pressed&&{transform:[{scale:.9}],opacity:.8}]} onPress={()=>void openComments(p)}><ProfileIcon name="inbox" size={pageHeight<550?27:32} color="#fff"/><Text style={s.actionCount}>{Number(p.comments?.[0]?.count||0).toLocaleString()}</Text></Pressable>
 {pageHeight>=400?<Pressable accessibilityRole="button" accessibilityLabel={savedPostIds.includes(p.id)?'Remove saved post':'Save post'} style={({pressed})=>[s.actionButton,pressed&&{transform:[{scale:.9}],opacity:.8}]} onPress={()=>void savePost(p)}><ProfileIcon name="bookmark" size={pageHeight<550?27:32} color={savedPostIds.includes(p.id)?'#d3efac':'#fff'}/><Text style={s.actionCount}>{savedPostIds.includes(p.id)?'Saved':'Save'}</Text></Pressable>:null}
 {pageHeight>=460?<Pressable accessibilityRole="button" accessibilityLabel="Share post" style={({pressed})=>[s.actionButton,pressed&&{transform:[{scale:.9}],opacity:.8}]} onPress={()=>setShareTarget(p)}><Text style={[s.actionIcon,{fontSize:pageHeight<550?29:34}]}>➤</Text><Text style={s.actionCount}>Share</Text></Pressable>:null}
 <Pressable accessibilityRole="button" accessibilityLabel="More post actions" style={s.actionButton} onPress={()=>setFeedMorePost(p)}><Text style={[s.actionIcon,{fontSize:pageHeight<550?24:28}]}>•••</Text><Text style={s.actionCount}>More</Text></Pressable>
 </View></View>}}/></View>:<ImageBackground source={require('./assets/icon.png')} style={s.emptyHero} imageStyle={s.emptyHeroImage}><View style={s.emptyHeroShade}><Text style={s.overlineGold}>VETERAN OWNED  /  RECONFEED</Text><Text style={s.heroTitle}>REAL PEOPLE.\nREAL STORIES.\n<Text style={{color:theme.purple}}>NO LIMITS.</Text></Text><Text style={s.heroBody}>{supabase?(tab==='Following'?'Follow creators from For You to see posts from your community.':'Things are quiet here for now. Post a video or photo and start the conversation.'):'ReconFeed connects to the live community when Supabase is configured.'}</Text><Pressable style={s.button} onPress={()=>setTab('Create')}><Text style={s.buttonText}>✚ Open Creator Bay</Text></Pressable><Pressable style={s.outline} onPress={()=>{setSearch('');setTab('Discover')}}><Text style={s.link}>⌕ Find creators to follow</Text></Pressable><Pressable style={s.outline} onPress={loadFeed}><Text style={s.link}>↻ Refresh feed</Text></Pressable></View></ImageBackground>}</View>;
 async function loadMarketplace(categoryOverride=marketCategory,searchOverride=marketSearch){const request=++marketRequest.current;if(!supabase){setMarketListings([]);return}try{let q=supabase.from('marketplace_listings').select('id,seller_id,title,description,category,condition,price,location,image_urls,accepted_responsibility,seller_shipping_terms,created_at').eq('status','active').order('created_at',{ascending:false}).limit(60);if(categoryOverride!=='All')q=q.eq('category',categoryOverride);if(searchOverride.trim())q=q.ilike('title','%'+searchOverride.trim().replace(/[%_]/g,'')+'%');const r=await q;if(r.error)throw r.error;if(request===marketRequest.current)setMarketListings(r.data||[])}catch(e:any){if(request===marketRequest.current){console.warn('Marketplace:',e.message);showAlert('Marketplace unavailable',safeErrorMessage(e))}}}
 async function createListing(){if(!supabase||!session){showAlert('Sign in required','Sign in to list an item.');setTab('Profile');return}const enteredPrice=Number(marketPrice);if(marketTitle.trim().length<3||!marketPrice.trim()||!Number.isFinite(enteredPrice)||enteredPrice<=0||enteredPrice>1000000){showAlert('Listing details','Enter a title and a price greater than $0 and no more than $1,000,000.');return}if(!marketAck){showAlert('Seller responsibility required','Please accept the seller responsibility notice before publishing.');return}setBusy(true);try{const created=await supabase.from('marketplace_listings').insert({seller_id:session.user.id,title:marketTitle.trim(),description:marketDescription.trim(),category:marketCategory==='All'?'Other':marketCategory,condition:marketCondition,price:enteredPrice,location:marketLocation.trim(),accepted_responsibility:true,seller_shipping_terms:'Seller is responsible for determining shipping, delivery, payment, returns, and fulfillment terms directly with the buyer.',status:'draft'}).select('id').single();if(created.error)throw created.error;const published=await supabase.from('marketplace_listings').update({status:'active'}).eq('id',created.data.id).eq('seller_id',session.user.id).select('id').single();if(published.error)throw new Error('Your listing was saved as a draft but could not be published. '+published.error.message);setMarketTitle('');setMarketDescription('');setMarketPrice('');setMarketLocation('');setMarketAck(false);setMarketMode('browse');await loadMarketplace();showAlert('Listing published','Your listing is live. You are responsible for handling the sale, shipping, delivery, returns, and all transaction details.')}catch(e:any){showAlert('Could not publish listing',safeErrorMessage(e))}finally{setBusy(false)}}
 const marketplace=()=> <ScrollView keyboardShouldPersistTaps="handled"><ImageBackground source={require('./assets/icon.png')} style={s.sectionHero} imageStyle={s.sectionHeroImage}><View style={s.sectionHeroInner}><Text style={s.overlineGold}>RECONFEED / COMMUNITY</Text><Text style={s.sectionHeroTitle}>FIELD EXCHANGE.</Text><Text style={s.sectionHeroSubtitle}>BUY. SELL. CONNECT.  •  Gear, vehicles, parts and more.</Text></View></ImageBackground><View style={s.row}><Pressable onPress={()=>setMarketMode('browse')} style={[s.chip,marketMode==='browse'&&s.selected]}><Text style={s.chipText}>Shop</Text></Pressable><Pressable onPress={()=>{if(!session){showAlert('Sign in required','Sign in to sell on ReconFeed.');setTab('Profile')}else{if(marketCategory==='All')setMarketCategory('Other');setMarketMode('sell')}}} style={[s.chip,marketMode==='sell'&&s.selected]}><Text style={s.chipText}>＋ Sell</Text></Pressable><Pressable onPress={()=>{void loadMarketplace()}} style={s.chip}><Text style={s.chipText}>↻ Refresh</Text></Pressable><Pressable onPress={()=>{if(!session){showAlert('Sign in required','Sign in to read your messages.');setTab('Profile');return}setMarketThread(null);setInboxOpen(true)}} style={s.chip}><Text style={s.chipText}>Messages</Text></Pressable></View>{marketMode==='sell'?<><Text style={s.subheading}>Create a listing</Text><TextInput value={marketTitle} onChangeText={setMarketTitle} maxLength={120} placeholder="Item title" placeholderTextColor={theme.muted} style={s.input}/><TextInput value={marketDescription} onChangeText={setMarketDescription} maxLength={5000} multiline placeholder="Description, features, condition, what’s included…" placeholderTextColor={theme.muted} style={[s.input,{height:95}]}/><TextInput value={marketPrice} onChangeText={setMarketPrice} keyboardType="decimal-pad" placeholder="Price in USD" placeholderTextColor={theme.muted} style={s.input}/><TextInput value={marketLocation} onChangeText={setMarketLocation} maxLength={160} placeholder="City / area (don’t post your street address)" placeholderTextColor={theme.muted} style={s.input}/><Text style={s.muted}>Category</Text><View style={s.row}>{['Vehicles','Parts & Accessories','Tools & Equipment','Outdoor & Lifestyle','Other'].map(x=><Pressable key={x} onPress={()=>setMarketCategory(x)} style={[s.chip,marketCategory===x&&s.selected]}><Text style={s.chipText}>{x}</Text></Pressable>)}</View><Text style={s.muted}>Condition</Text><View style={s.row}>{['New','Like new','Good','Fair','For parts','Used'].map(x=><Pressable key={x} onPress={()=>setMarketCondition(x)} style={[s.chip,marketCondition===x&&s.selected]}><Text style={s.chipText}>{x}</Text></Pressable>)}</View><View style={[s.card,{padding:14}]}><Text style={s.strong}>Seller responsibility — required</Text><Text style={s.muted}>You are responsible for your listing and transaction, including item accuracy and legality, pricing, buyer communication, payment arrangements, packaging, shipping, delivery, taxes, refunds, returns, warranties, and resolving disputes. ReconFeed does not sell, ship, store, inspect, or guarantee listed items and is not a party to the transaction. Your legal rights and obligations may vary; this notice does not waive liability where the law prohibits it.</Text><Pressable onPress={()=>setMarketAck(v=>!v)} style={[s.row,{marginTop:10}]}><Text style={{fontSize:24,color:marketAck?theme.purple:theme.muted}}>{marketAck?'☑':'☐'}</Text><Text style={[s.muted,{flex:1}]}>I understand and accept the seller responsibilities and marketplace terms.</Text></Pressable></View><Pressable style={s.button} disabled={busy||!marketAck} onPress={createListing}><Text style={s.buttonText}>{busy?'Publishing…':'▤ DEPLOY LISTING'}</Text></Pressable><Pressable style={s.outline} onPress={()=>setMarketMode('browse')}><Text style={s.link}>Cancel</Text></Pressable></>:<><TextInput value={marketSearch} onChangeText={setMarketSearch} onSubmitEditing={()=>{void loadMarketplace()}} placeholder="Search vehicles, parts, gear…" placeholderTextColor={theme.muted} style={s.input}/><ScrollView horizontal showsHorizontalScrollIndicator={false}>{['All','Vehicles','Parts & Accessories','Tools & Equipment','Outdoor & Lifestyle','Other'].map(x=><Pressable key={x} onPress={()=>{setMarketCategory(x);void loadMarketplace(x,marketSearch)}} style={[s.chip,marketCategory===x&&s.selected]}><Text style={s.chipText}>{x}</Text></Pressable>)}</ScrollView>{marketListings.length?marketListings.map((item:any)=><View key={item.id} style={s.card}><View style={s.row}><View style={{flex:1}}><Text style={s.strong}>{item.title}</Text><Text style={s.muted}>{item.category} · {item.condition}{item.location?' · '+item.location:''}</Text></View><Text style={[s.strong,{color:theme.purple,fontSize:18}]}>{Number(item.price||0).toLocaleString('en-US',{style:'currency',currency:'USD'})}</Text></View>{!!item.description&&<Text style={s.caption}>{item.description}</Text>}<Pressable style={s.outline} onPress={()=>{if(!session){showAlert('Sign in required','Sign in to contact the seller.');setTab('Profile');return}if(item.seller_id===session.user.id){setMarketThread(null);setInboxOpen(true);return}setMarketThread({listingId:item.id,peerId:item.seller_id,title:item.title});setInboxOpen(true)}}><Text style={s.link}>{item.seller_id===session?.user.id?'View messages':'Contact seller'}</Text></Pressable></View>):<View style={s.empty}><Text style={s.strong}>{supabase?'No listings yet':'Marketplace setup needed'}</Text><Text style={s.muted}>{supabase?'Be the first to list something for the community.':'Apply the marketplace database migration in Supabase to activate live listings.'}</Text><Pressable style={s.button} onPress={()=>{if(!session){showAlert('Sign in required','Sign in to sell on ReconFeed.');setTab('Profile')}else{if(marketCategory==='All')setMarketCategory('Other');setMarketMode('sell')}}}><Text style={s.buttonText}>＋ List an item</Text></Pressable></View>}<View style={[s.card,{padding:12}]}><Text style={s.strong}>Marketplace notice</Text><Text style={s.muted}>Buyers and sellers are responsible for their own transactions, payment, shipping, delivery, returns, and compliance with applicable laws. ReconFeed is a platform, not the seller or shipper. See the Marketplace Terms on reconfeed.com.</Text></View></>}</ScrollView>;

 const exploreCategories=[
  {label:'Trending',query:'',glyph:'✦'},
  {label:'Veterans',query:'veteran',glyph:'★'},
  {label:'Trucks',query:'truck',glyph:'◆'},
  {label:'Outdoors',query:'outdoors',glyph:'▲'},
  {label:'Skilled Trades',query:'welding',glyph:'⚒'},
  {label:'Country Life',query:'country',glyph:'✧'},
  {label:'Builds & Mechanics',query:'build',glyph:'⚙'},
  {label:'Tools',query:'tools',glyph:'🔧'},
  {label:'Fitness',query:'fitness',glyph:'✚'}
 ];
 const exploreView=()=> <ScrollView ref={exploreScrollRef} keyboardShouldPersistTaps="handled" contentContainerStyle={s.exploreContent}>
  <View style={s.exploreHeading}><Text style={s.screenDisplayTitle}>EXPLORE</Text><Text style={s.exploreSub}>MILITARY ROOTS  /  REAL WORK  /  REAL PEOPLE</Text></View>
  <View style={s.exploreSearchRow}><Text style={s.exploreSearchIcon}>⌕</Text><TextInput value={search} onChangeText={setSearch} onSubmitEditing={()=>{void runExploreSearch(search)}} returnKeyType="search" placeholder="Search creators, tags, or videos..." placeholderTextColor="#aab6a4" style={s.exploreSearch}/><Pressable accessibilityRole="button" accessibilityLabel="Search" onPress={()=>{void runExploreSearch(search)}} style={s.exploreSearchGo}><Text style={s.exploreSearchGoText}>↗</Text></Pressable></View>
  <View style={s.exploreGrid}>{exploreCategories.map(item=><Pressable accessibilityRole="button" accessibilityLabel={'Browse '+item.label} key={item.label} style={[s.exploreTile,activeExploreCategory===item.label&&{borderWidth:2,borderColor:theme.purple}]} onPress={()=>{
  setActiveExploreCategory(item.label);setSearch(item.query);setExploreSearched(true);pendingExploreJump.current=true;
  if(search===item.query)void runExploreSearch(item.query);
 }}><View style={[s.exploreTileImage,{backgroundColor:olive.raised,justifyContent:'space-between',paddingTop:16}]}><Text style={{fontSize:35,color:olive.gold,textAlign:'center'}}>{item.glyph}</Text><View style={s.exploreTileOverlay}><Text style={s.exploreTileLabel}>{item.label}</Text><Text style={s.exploreTileArrow}>↗</Text></View></View></Pressable>)}</View>
  {exploreBusy&&<ActivityIndicator color={theme.purple} style={{marginVertical:18}}/>}
  {exploreSearched&&!exploreBusy&&<View onLayout={event=>{exploreResultsOffset.current=event.nativeEvent.layout.y}} style={{paddingVertical:16,gap:12}}>
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

  <Modal visible={!!exploreSelected} animationType="slide" onRequestClose={()=>setExploreSelected(null)}>
   <SafeAreaView style={[s.safe,{padding:12}]}><Pressable onPress={()=>setExploreSelected(null)} style={s.outline}><Text style={s.link}>✕ Close search result</Text></Pressable>
   {exploreSelected?.media_type==='video'?<ViewerVideo uri={exploreSelected.media_url}/>:exploreSelected?<Image source={{uri:exploreSelected.media_url}} style={{flex:1,width:'100%'}} resizeMode="contain"/>:null}
   <Text style={s.muted}>{exploreSelected?.caption||''}</Text></SafeAreaView>
  </Modal>
  <Pressable accessibilityRole="button" onPress={()=>setTab('Market')} style={s.exchangePromo}><Text style={s.exchangePromoBig}>▣  FIELD EXCHANGE</Text><Text style={s.exchangePromoSmall}>BUY · SELL · MESSAGE  /  EXPLORE THE MARKETPLACE  ↗</Text></Pressable>
 </ScrollView>;

 const create=()=> <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={s.createContent}>
 <View style={s.exploreHeading}><Text style={s.screenDisplayTitle}>CREATE</Text><Text style={s.exploreSub}>CAPTURE IT. SHARE IT. OWN YOUR STORY.</Text></View>
 <ImageBackground source={asset?.type==='image'?{uri:asset.uri}:require('./assets/icon.png')} style={s.cameraStage} imageStyle={s.cameraStageImage}>
  <View style={s.cameraTop}><Text style={s.cameraCancel}>RECONFEED · CREATE</Text><Pressable onPress={()=>showAlert('Audio tools','Music and audio editing tools are planned for a future update. You can publish videos with their existing audio.')} style={s.addSound}><Text style={s.addSoundText}>♫  Add Sound</Text></Pressable></View>
  <View style={s.cameraMid}><Text style={s.cameraMessage}>{asset?(asset.fileName||'Media ready to publish'):'Your next story starts here.'}</Text><View style={s.cameraTools}><Pressable onPress={()=>showAlert('Camera controls','Your device camera provides its available front/back controls. Tap Record below to launch it.')}><Text style={s.cameraTool}>⟳</Text><Text style={s.cameraToolLabel}>Flip</Text></Pressable><Pressable onPress={()=>showAlert('Speed','Video speed controls are planned for a future update.')}><Text style={s.cameraTool}>◷</Text><Text style={s.cameraToolLabel}>Speed</Text></Pressable><Pressable onPress={()=>showAlert('Filters','Video filters are planned for a future update.')}><Text style={s.cameraTool}>✧</Text><Text style={s.cameraToolLabel}>Filters</Text></Pressable><Pressable onPress={()=>showAlert('Timer','Choose 15, 60, or 90 seconds below to set your maximum clip duration.')}><Text style={s.cameraTool}>◴</Text><Text style={s.cameraToolLabel}>Timer</Text></Pressable></View></View>
  <View style={s.cameraBottom}>
   <View style={s.captureModes}>{[15,60,90].map(seconds=><Pressable key={seconds} onPress={()=>{setCaptureMode('video');setCaptureSeconds(seconds)}}><Text style={[s.captureMode,captureMode==='video'&&captureSeconds===seconds&&s.captureModeActive]}>{seconds}s</Text></Pressable>)}<Pressable onPress={()=>setCaptureMode('photo')}><Text style={[s.captureMode,captureMode==='photo'&&s.captureModeActive]}>Photo</Text></Pressable></View>
   <View style={s.captureActions}><Pressable onPress={choose} accessibilityRole="button" accessibilityLabel="Select gallery media" style={s.galleryButton}><Text style={s.galleryIcon}>▧</Text><Text style={s.galleryLabel}>GALLERY</Text></Pressable><Pressable accessibilityRole="button" accessibilityLabel={captureMode==='photo'?'Take photo':'Record video'} accessibilityHint="Opens the device camera" onPress={()=>{void capture()}} style={s.recordOuter}><View style={s.grenadeBody}><View style={s.recordInner}/></View><Text style={s.grenadeLabel}>{captureMode==='photo'?'PHOTO':'RECORD'}</Text></Pressable><Pressable onPress={()=>setTab('Profile')} accessibilityRole="button" accessibilityLabel="Open profile" style={s.galleryButton}><Text style={s.galleryIcon}>◈</Text><Text style={s.galleryLabel}>PROFILE</Text></Pressable></View>
   <Text style={s.muted}>Camera and microphone require your permission. Capture stays on your device until you tap Publish.</Text><Text style={s.captureHint}>Camera · {captureMode==='photo'?'Photo':captureSeconds+'s max'}</Text>
  </View>
 </ImageBackground><Pressable style={s.picker} onPress={choose}><Text style={s.link}>▤ Load media</Text><Text style={s.muted}>{asset?.fileName|| (asset?'Media selected':'Up to 90 seconds')}</Text></Pressable>{asset?.type==='image'&&<Image source={{uri:asset.uri}} style={s.preview}/>}
 {asset?.type==='video'&&<View style={s.card}><Text style={s.subheading}>VIDEO PREVIEW · REVIEW BEFORE POSTING</Text><Video key={asset.uri} source={{uri:asset.uri}} style={{width:'100%',height:310,backgroundColor:'#000'}} useNativeControls resizeMode={ResizeMode.CONTAIN}/></View>}
 {!!asset&&<Pressable style={s.outline} accessibilityRole="button" onPress={()=>{setAsset(null);setCaption('')}}><Text style={s.link}>✕ Delete draft / Retake</Text></Pressable>}
 <Text style={s.subheading}>WHO CAN SEE THIS POST?</Text>
 <View style={s.row}>{[{key:'public',label:'Everyone'},{key:'followers',label:'Followers (in app)'},{key:'private',label:'Only me (in app)'}].map(option=><Pressable key={option.key} style={[s.chip,postPrivacy===option.key&&s.selected]} onPress={()=>setPostPrivacy(option.key as any)}><Text style={s.chipText}>{option.label}</Text></Pressable>)}</View>
 {postPrivacy!=='public'&&<Text accessibilityRole="alert" style={[s.muted,{color:olive.gold,padding:11,borderWidth:1,borderColor:olive.gold,borderRadius:9}]}>Important: Restricted visibility currently hides your post inside ReconFeed, but its underlying media uses a publicly reachable link. Anyone with that link can access the file. Do not upload confidential media.</Text>}
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
 <Pressable accessibilityRole="checkbox" accessibilityState={{checked:isPromotional}} onPress={()=>setIsPromotional(v=>!v)} style={[s.outline,{flexDirection:'row',alignItems:'center',gap:10,borderColor:isPromotional?olive.gold:olive.border}]}>
<Text style={{fontSize:22,color:olive.gold}}>{isPromotional?'☑':'☐'}</Text>
<Text style={[s.link,{flex:1}]}>Paid promotion, sponsorship, affiliate link or gifted product. Display an on-screen disclosure to viewers.</Text></Pressable>
<Text style={s.muted}>If you received money, free products or another material benefit, enable this and describe the relationship clearly in the content.</Text>
<Pressable accessibilityRole="checkbox" accessibilityState={{checked:mediaRightsConfirmed}} onPress={()=>setMediaRightsConfirmed(v=>!v)} style={[s.outline,{flexDirection:'row',alignItems:'center',gap:10,borderColor:mediaRightsConfirmed?olive.gold:olive.border}]}>
<Text style={{fontSize:22,color:olive.gold}}>{mediaRightsConfirmed?'☑':'☐'}</Text>
<Text style={[s.link,{flex:1}]}>I own or have permission to publish this photo, video and audio, including any recognizable people or brand material.</Text></Pressable>
<Text style={s.muted}>Review the <Text onPress={()=>{void Linking.openURL('https://reconfeed.com/copyright.html')}} style={{color:olive.gold,textDecorationLine:'underline'}}>copyright and trademark rules ↗</Text></Text>
<Pressable style={s.button} disabled={busy||!mediaRightsConfirmed} onPress={publish}><Text style={s.buttonText}>{busy?'Deploying…':'⌖ DEPLOY POST'}</Text></Pressable><View style={s.rule}/><Text style={s.subheading}>AI CONCEPT LAB</Text><ScrollView horizontal showsHorizontalScrollIndicator={false}>{[{id:'text-video',label:'Text → video'},{id:'image',label:'Image from prompt'}].map(x=><Pressable key={x.id} onPress={()=>setWorkflow(x.id)} style={[s.chip,workflow===x.id&&s.selected]}><Text style={s.chipText}>{x.label}</Text></Pressable>)}</ScrollView><TextInput value={prompt} onChangeText={setPrompt} multiline placeholder="Describe your scene or edit…" placeholderTextColor={theme.muted} style={[s.input,{height:100}]}/><Pressable style={s.outline} onPress={generate} disabled={busy}><Text style={s.link}>{busy?'Working…':'⌖ Generate concept'}</Text></Pressable>{!!aiStatus&&<Text style={s.muted}>{aiStatus}</Text>}{!!aiUrl&&<View style={s.card}><Text style={s.strong}>Your output</Text>{workflow==='image'?<Image source={{uri:aiUrl}} style={s.preview}/>:<Video source={{uri:aiUrl}} style={s.media} useNativeControls/>}<Pressable onPress={()=>{setAsset({uri:aiUrl,type:workflow==='image'?'image':'video',width:0,height:0} as ImagePicker.ImagePickerAsset)}}><Text style={s.link}>Use output in post</Text></Pressable></View>}</ScrollView>;
 async function submitTesterIssue(){
  if(!supabase||!session){showAlert('Sign in required','Please sign in to submit an issue.');return}
  if(testerSubmitPending.current)return;
  if(testerIssueTitle.trim().length<5||testerIssueDescription.trim().length<10){showAlert('More detail needed','Enter a title of at least 5 characters and a description of at least 10 characters.');return}
  testerSubmitPending.current=true;setTesterIssueBusy(true);
  let screenshotPath:string|null=null;
  try{
   if(testerScreenshot){
    const response=await fetch(testerScreenshot.uri);
    if(!response.ok)throw new Error('Could not read screenshot. Please choose it again.');
    const bytes=await response.arrayBuffer();
    if(bytes.byteLength===0)throw new Error('Screenshot was empty. Please choose it again.');
    if(bytes.byteLength>10*1024*1024)throw new Error('Screenshot must be under 10 MB');
    const mime=testerScreenshot.mimeType||response.headers.get('content-type')||'image/jpeg';
    if(!['image/jpeg','image/png','image/webp'].includes(mime))throw new Error('Choose a JPEG, PNG or WebP screenshot.');
    screenshotPath=session.user.id+'/'+Date.now()+'-'+Math.random().toString(36).slice(2)+'.'+mime.split('/')[1];
    // Typed bytes are required for reliable Supabase upload on Expo Android,
    // iOS and mobile Safari; ArrayBuffer previously yielded empty uploads.
    const upload=await supabase.storage.from('tester-screenshots').upload(screenshotPath,new Uint8Array(bytes),{contentType:mime,upsert:false});
    if(upload.error)throw upload.error;
    if(!upload.data?.path)throw new Error('Screenshot upload could not be confirmed.');
   }
   // Attach only non-identifying layout diagnostics when the user submits a
   // tester report. Avoid a device fingerprint, advertising ID, or location.
   const deviceContext='[Layout info: '+Platform.OS+' '+String(Platform.Version)+
    '; viewport '+Math.round(screenWidth)+'x'+Math.round(screenHeight)+
    '; pixel ratio '+PixelRatio.get()+
    '; orientation '+(screenWidth>screenHeight?'landscape':'portrait')+']';
   const issueSteps=[testerIssueSteps.trim(),deviceContext].filter(Boolean).join('\n');
   const result=await supabase.from('tester_issues').insert({reporter_id:session.user.id,category:testerIssueCategory,title:testerIssueTitle.trim(),description:testerIssueDescription.trim(),steps_to_reproduce:issueSteps,platform:Platform.OS,status:'open',screenshot_path:screenshotPath}).select('id').single();
   if(result.error)throw result.error;
   setTesterIssueOpen(false);setTesterIssueTitle('');setTesterIssueDescription('');setTesterIssueSteps('');setTesterScreenshot(null);setTesterReportsOpen(true);
   showAlert('Issue submitted','Your report is saved. Reference: '+result.data.id.slice(0,8));
  }catch(e:any){
   if(screenshotPath){
    // Don't leave an orphaned screenshot behind if issue insert fails.
    try{await supabase.storage.from('tester-screenshots').remove([screenshotPath])}
    catch(cleanupError){console.warn('Screenshot cleanup failed',cleanupError)}
   }
   showAlert('Issue not saved',safeErrorMessage(e));
  }
  finally{testerSubmitPending.current=false;setTesterIssueBusy(false)}
 }

 async function submitAccountDeletionRequest(){
  if(!supabase||!session){showAlert('Sign in required','Sign in to request deletion of your ReconFeed account.');return}
  if(deletionRequestPending.current)return;
  deletionRequestPending.current=true;
  try{
   const previous=await supabase.from('account_deletion_requests')
    .select('id,status,requested_at').eq('user_id',session.user.id).maybeSingle();
   if(previous.error)throw previous.error;
   if(previous.data){
    showAlert('Deletion request already received',
     'Your request is '+previous.data.status+'. We will verify and process it according to our deletion policy. You can also contact reconfeed@reconfeed.com.');
    return;
   }
   const result=await supabase.from('account_deletion_requests')
    .insert({user_id:session.user.id}).select('id').single();
   if(result.error)throw result.error;
   showAlert('Deletion request received',
    'Your account deletion request was securely recorded. This does not immediately erase your account. ReconFeed must verify and complete the deletion, including eligible posts, media and personal information. We aim to complete verified requests within 30 days. See reconfeed.com/delete-account.html.');
  }catch(error:any){
   showAlert('Could not request deletion',safeErrorMessage(error)+' Please contact reconfeed@reconfeed.com from the email on your account.');
  }finally{deletionRequestPending.current=false;}
 }
 function confirmAccountDeletion(){
  showAlert('Request permanent account deletion?',
   'This requests deletion of your ReconFeed account, public posts, uploads, Stories and other associated personal data except records lawfully retained. The account remains accessible until the request is verified and processed. This is not just deactivation.',
   [{text:'Cancel',style:'cancel'},
    {text:'Request account deletion',style:'destructive',onPress:()=>{void submitAccountDeletionRequest()}}]);
 }

 function handleSettingsAction(action:SettingsAction){
  if(action==='delete_account'){setProfileSettingsOpen(false);confirmAccountDeletion();return}
  if(action==='manage_posts'){setProfileSettingsOpen(false);setProfileGridTab('videos');setProfileGridLimit(18);return}
  if(action==='following'){setProfileSettingsOpen(false);setConnections('following');return}
  if(action==='liked'){setProfileSettingsOpen(false);setProfileGridTab('liked');return}
  if(action==='share'){void shareProfile(profile?.username||'');return}
  if(action==='inbox'){setProfileSettingsOpen(false);setSocialPeer(null);setSocialInboxOpen(true);return}
  if(action==='viewers'){setProfileSettingsOpen(false);showCreatorAnalytics();return}
  if(action==='report_issue'||action==='help'){setProfileSettingsOpen(false);setTesterIssueOpen(true);return}
  if(action==='tester_reports'){setProfileSettingsOpen(false);setTesterReportsOpen(true);return}
  if(action==='logout'||action==='switch_account'){
   showAlert(action==='logout'?'Log out of ReconFeed?':'Switch ReconFeed account?',
    action==='logout'?'You will need to sign in again to use this account.':'You will sign out of the current account so another account can sign in.',
    [{text:'Cancel',style:'cancel'},{text:action==='logout'?'Log out':'Continue',onPress:()=>{setProfileSettingsOpen(false);void (async()=>{await feedQueueRef.current?.clear();await supabase?.auth.signOut()})()}}]);
   return;
  }
  if(action==='legal_center'){setProfileSettingsOpen(false);void Linking.openURL('https://reconfeed.com/legal.html');return}if(action==='terms'){setProfileSettingsOpen(false);void Linking.openURL('https://reconfeed.com/terms.html');return}if(action==='privacy'){setProfileSettingsOpen(false);void Linking.openURL('https://reconfeed.com/privacy.html');return}if(['content_preferences','account','security','private','blocked','comments','audience','contacts'].includes(action)){
   setProfileSettingsPage('advanced');return;
  }
  const labels:Partial<Record<SettingsAction,string>>={
   live:'LIVE streaming',notifications:'Notifications',wellbeing:'Time and well-being',family:'Family Pairing',
   orders:'Your orders',mentions:'Mentions',messages:'Direct messages',reuse:'Reuse of content',
   shared_links:'Display profile when sharing links',downloads:'Downloads',music:'Music',
   activity:'Activity center',ads:'Ads',playback:'Playback',language:'Language',display:'Display',
   accessibility:'Accessibility',offline:'Offline videos',storage:'Free up space',data_saver:'Data Saver'
  };
  const label=labels[action]||'This feature';
  showAlert(label,label+' is not available in this ReconFeed beta yet. No settings have been changed.');
 }
 const profileView=()=> <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={[s.profileScreenContent,session&&{backgroundColor:olive.bg}]}>
{!session?<><Text style={s.sectionEyebrow}>JOIN THE RECONFEED COMMUNITY</Text><ImageBackground source={require('./assets/icon.png')} style={s.loginHero} imageStyle={s.sectionHeroImage}><View style={s.loginHeroInner}><Image source={require('./assets/icon.png')} style={s.loginEmblem}/><Text style={s.loginMotto}>MORE THAN A SCROLL.\n<Text style={{color:theme.purple}}>IT'S A BROTHERHOOD.</Text></Text></View></ImageBackground></>:null}
{session?<>
 <CreatorProfileHeader
  profile={profile} email={session.user.email} stats={profileStats}
  isBetaTester={isBetaTester} pronouns={creatorSettings.pronouns} websiteUrl={creatorSettings.website_url}
  onSettings={()=>{setProfileSettingsPage('drawer');setProfileSettingsOpen(true);setProfileEditOpen(false)}}
  onEdit={()=>{setProfileEditOpen(true);setProfileSettingsOpen(false)}}
  onAnalytics={showCreatorAnalytics}
  onDiscover={()=>setTab('Discover')}
  onChangePhoto={()=>{void chooseProfilePhoto()}}
  onCreate={startStory}
  onShare={()=>{void shareProfile(profile?.username||'')}}
  onMarket={()=>setTab('Market')}
  onConnections={setConnections}
  onWebsite={()=>{void Linking.openURL(creatorSettings.website_url)}}
 />
 <Modal visible={profileEditOpen} animationType="slide" onRequestClose={()=>setProfileEditOpen(false)}><SafeAreaView style={s.safe}><ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={s.profileEditorSheet}><Pressable accessibilityRole="button" style={s.profileCloseVideo} onPress={()=>setProfileEditOpen(false)}><Text style={s.link}>← Back to profile</Text></Pressable><Text style={s.profileEditTitle}>Edit profile</Text><Text style={s.profileEditDescription}>Show the community who you are. Your profile updates are saved to your real account.</Text><Pressable accessibilityRole="button" accessibilityLabel="Change profile picture" onPress={chooseProfilePhoto} style={s.profilePhotoEdit}>
  {profileAvatarDraft?.uri||profile?.avatar_url?<Image source={{uri:profileAvatarDraft?.uri||profile.avatar_url}} style={s.profileEditorAvatar}/>:<View style={[s.profileEditorAvatar,{alignItems:'center',justifyContent:'center',backgroundColor:olive.raised}]}><Text style={{color:olive.text,fontWeight:'800',fontSize:35}}>{(profile?.display_name||profile?.username||'R')[0].toUpperCase()}</Text></View>}
  <Text style={s.profileEditPhotoLabel}>✎ Change photo</Text>
 </Pressable>
 <Text style={s.profileFieldLabel}>Username</Text><TextInput value={profileUsernameDraft} onChangeText={setProfileUsernameDraft} maxLength={24} autoCapitalize="none" placeholder="@username" placeholderTextColor={theme.muted} style={s.input}/>
 <Text style={s.profileFieldLabel}>Name</Text><TextInput value={name} onChangeText={setName} maxLength={80} placeholder="Display name" placeholderTextColor={theme.muted} style={s.input}/>
 <Text style={s.profileFieldLabel}>Bio</Text><TextInput value={profileBioDraft} onChangeText={setProfileBioDraft} maxLength={80} multiline placeholder="Your bio (80 characters max)" placeholderTextColor={theme.muted} style={[s.input,{height:90}]}/>
 <Text style={s.profileHelp}>Usernames use 3–24 lowercase letters, numbers, underscores, or periods. Your bio can contain up to 80 characters.</Text>
 <Pressable accessibilityRole="button" style={s.profileEditExtra} onPress={()=>{setProfileEditOpen(false);setProfileSettingsPage('advanced');setProfileSettingsOpen(true)}}>
  <View><Text style={s.profileExtraTitle}>Pronouns, links &amp; privacy</Text><Text style={s.profileExtraSubtitle}>Add your website and control who can contact you</Text></View><Text style={s.profileExtraArrow}>›</Text>
 </Pressable>
 <Pressable style={[s.button,{marginTop:18}]} disabled={busy} onPress={saveFullProfile}><Text style={s.buttonText}>{busy?'Saving…':'Save changes'}</Text></Pressable><View style={s.rule}/>
</ScrollView></SafeAreaView></Modal>
 <View style={s.profileContentTabs}>
 {([{id:'videos',symbol:'grid',label:'Posts'},{id:'photos',symbol:'photos',label:'Photos'},{id:'private',symbol:'lock',label:'Private posts'},{id:'reposts',symbol:'repost',label:'Reposts'},{id:'saved',symbol:'bookmark',label:'Favorites'},{id:'liked',symbol:'heart',label:'Liked'},{id:'activity',symbol:'footprints',label:'Activity'}] as const).map(item=>
 <Pressable accessibilityRole="tab" accessibilityState={{selected:profileGridTab===item.id}} accessibilityLabel={item.label} key={item.id} onPress={()=>{
  setProfileGridTab(item.id);setProfileGridLimit(12);

 }} style={[s.profileContentTab,profileGridTab===item.id&&s.profileContentTabActive]}><ProfileIcon name={item.symbol} color={profileGridTab===item.id?olive.text:olive.muted}/>{(item.id==='liked'||item.id==='activity')&&<Text style={{fontSize:9,color:olive.text,fontWeight:'700',marginTop:2}}>{item.label}</Text>}</Pressable>)}
 </View>
 {profileGridTab==='activity'?<View style={{backgroundColor:olive.bg,padding:15,gap:10}}>
  <Text style={s.subheading}>Recent Activity</Text>
  <Text style={s.muted}>Your liked videos, saved posts and reposts. This history is private to your account.</Text>
  {activityBusy?<ActivityIndicator color={theme.purple}/>:activityError?<Text style={s.muted}>{activityError}</Text>:recentActivity.length?recentActivity.map((entry,i)=><Pressable key={entry.kind+'-'+entry.post_id+'-'+i} accessibilityRole="button" accessibilityLabel={'View '+entry.kind+' post'} onPress={()=>setProfileSelected(entry.post)} style={[s.card,{flexDirection:'row',alignItems:'center',gap:12,marginVertical:3}]}>
   {entry.post.media_type==='image'?<Image source={{uri:entry.post.media_url}} style={{width:55,height:70,borderRadius:8}} resizeMode="cover"/>:<View style={{width:55,height:70,backgroundColor:olive.raised,alignItems:'center',justifyContent:'center',borderRadius:8}}><Text style={{color:olive.text,fontSize:22}}>▶</Text></View>}
   <View style={{flex:1}}><Text style={s.strong}>{entry.kind} · {new Date(entry.created_at).toLocaleDateString()}</Text><Text style={s.muted} numberOfLines={2}>{entry.post.caption||'ReconFeed post'}</Text></View>
  </Pressable>):<Text style={s.muted}>No recent activity. Like or save a post to see it here.</Text>}
 </View>:<View style={s.profileTileGrid}>
 {profileCollectionError?<View style={s.profileTabEmpty}><Text accessibilityRole="alert" style={s.profileEmptyBody}>{profileCollectionError}</Text><Pressable onPress={()=>{setProfileGridTab('videos')}}><Text style={s.link}>Back to posts</Text></Pressable></View>:profileCollectionLoading?<View style={s.profileTabEmpty}><ActivityIndicator color={theme.purple}/></View>:visibleProfilePosts.length
 ? visibleProfilePosts.slice(0,profileGridLimit).map((p,index)=>
  <Pressable key={p.id} accessibilityRole="button" accessibilityLabel={'View '+(p.caption||'post')} onPress={()=>setProfileSelected(p)} style={s.profileVideoTile}>
   {p.media_type==='image'?<Image source={{uri:p.media_url}} style={s.profileVideoThumbnail} resizeMode="cover"/>:<View style={s.profileVideoThumbnail}><VideoTilePreview uri={p.media_url} playing={index<3&&!profileSelected&&tab==='Profile'}/><View pointerEvents="none" style={{position:'absolute',bottom:5,right:5,backgroundColor:'#08170d99',borderRadius:9,paddingHorizontal:6,paddingVertical:3}}><Text style={{color:'#fff',fontSize:12}}>▶</Text></View></View>}
   <View pointerEvents="none" style={s.profileTileShade}/>

   {p.pinned_at?<View pointerEvents="none" style={s.profilePinBadge}><Text style={s.profilePinText}>★ PINNED</Text></View>:null}
   {profileViewCounts[p.id]!==undefined?<View pointerEvents="none" style={s.profileViewsBadge}><Text style={s.profileViewsText}>▷ {Number(profileViewCounts[p.id]).toLocaleString()}</Text></View>:null}
   {profileEditOpen?<View style={s.profileTileEditTools}>
    <Pressable accessibilityRole="button" accessibilityLabel={p.pinned_at?'Unpin post':'Pin post'} onPress={()=>{void togglePinPost(p.id,!!p.pinned_at)}} style={s.profileTileTool}><Text style={s.profileTileToolText}>{p.pinned_at?'UNPIN':'☆ PIN'}</Text></Pressable>
    <Pressable accessibilityRole="button" accessibilityLabel="Delete post" onPress={()=>deleteOwnPost(p.id)} style={[s.profileTileTool,{backgroundColor:'#8c2c2c'}]}><Text style={s.profileTileToolText}>DELETE</Text></Pressable>
   </View>:null}
  </Pressable>
 )
 : <View style={s.profileTabEmpty}><Text style={s.profileEmptyTitle}>{profileLoading?'Loading posts…':profileGridTab==='private'?'No private posts':profileGridTab==='reposts'?'No reposts yet':profileGridTab==='saved'?'Nothing saved yet':profileGridTab==='liked'?'No liked posts yet':profileGridTab==='photos'?'No photos yet':'Nothing posted yet'}</Text><Text style={s.profileEmptyBody}>{profileGridTab==='reposts'?'Tap Repost on a feed post to add it here.':profileGridTab==='saved'?'Save a feed post to keep it here.':profileGridTab==='liked'?'Posts you like will appear here.':profileGridTab==='private'?'Posts you publish with private visibility appear here.':'Your moments will show up here. Start with a photo or video worth sharing.'}</Text>{['videos','photos','private'].includes(profileGridTab)?<Pressable onPress={startCreating} style={s.profileTabButton}><Text style={s.profileActionLabel}>＋ Create a post</Text></Pressable>:null}</View>}
 </View>}
 {profileGridTab!=='activity'&&visibleProfilePosts.length>profileGridLimit?<Pressable accessibilityRole="button" style={s.profileLoadMore} onPress={()=>setProfileGridLimit(n=>n+18)}><Text style={s.profileActionLabel}>Show more posts ↓</Text></Pressable>:null}
 <Modal visible={!!profileSelected} animationType="slide" onRequestClose={()=>setProfileSelected(null)}>
  <SafeAreaView style={s.safe}><Pressable style={s.profileCloseVideo} onPress={()=>setProfileSelected(null)}><Text style={s.profileActionLabel}>← BACK TO PROFILE</Text></Pressable>
   {profileSelected?.media_type==='video'?<ViewerVideo key={profileSelected.id} uri={profileSelected.media_url}/>:profileSelected?<Image source={{uri:profileSelected.media_url}} style={{flex:1,width:'100%'}} resizeMode="contain"/>:null}
   <Text style={[s.muted,{padding:14}]}>{profileSelected?.caption||''}</Text>{profileSelected&&profilePosts.some(p=>p.id===profileSelected.id)?<View style={[s.row,{padding:12}]}><Pressable accessibilityRole="button" style={s.chip} onPress={()=>void togglePinPost(profileSelected.id,!!profilePosts.find(p=>p.id===profileSelected.id)?.pinned_at)}><Text style={s.chipText}>{profilePosts.find(p=>p.id===profileSelected.id)?.pinned_at?'Unpin':'Pin post'}</Text></Pressable><Pressable accessibilityRole="button" style={s.chip} onPress={()=>deleteOwnPost(profileSelected.id)}><Text style={s.chipText}>Delete post</Text></Pressable></View>:null}
  </SafeAreaView>
 </Modal>
 <Modal visible={profileSettingsOpen} transparent animationType="fade" onRequestClose={()=>profileSettingsPage==='drawer'?setProfileSettingsOpen(false):setProfileSettingsPage(profileSettingsPage==='advanced'?'settings':'drawer')}>
  {profileSettingsPage==='drawer'?
   <ProfileMenuOverview
    onClose={()=>setProfileSettingsOpen(false)}
    onBalance={()=>setProfileSettingsPage('balance')}
    onSettings={()=>setProfileSettingsPage('settings')}
    onAnalytics={()=>{setProfileSettingsOpen(false);showCreatorAnalytics()}}
    onSaved={()=>{setProfileSettingsOpen(false);setProfileGridTab('saved')}}
    onMyPosts={()=>{setProfileSettingsOpen(false);setProfileGridTab('videos')}}
    onInbox={()=>{setProfileSettingsOpen(false);setMarketThread(null);setInboxOpen(true)}}
    onReportIssue={()=>{setProfileSettingsOpen(false);setTesterIssueOpen(true)}}
    onTesterReports={()=>{setProfileSettingsOpen(false);setTesterReportsOpen(true)}}
    onUnavailable={label=>showAlert(label,label+' is planned for a future ReconFeed update and is not enabled in this beta.')}
   />
  :profileSettingsPage==='settings'?
   <SettingsPrivacyPage onBack={()=>setProfileSettingsPage('drawer')} onSelect={handleSettingsAction} isPrivate={creatorSettings.is_private} commentVisibility={creatorSettings.allow_comments}/>
  :profileSettingsPage==='balance'?
   <BalancePage
    onBack={()=>setProfileSettingsPage('drawer')}
    onSettings={()=>setProfileSettingsPage('settings')}
    onUnavailable={label=>showAlert(label,label+' is not available during the ReconFeed beta. No payments, credits or subscriptions have been started.')}
   />
  :<SafeAreaView style={s.safe}>
   <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={s.profileBelowGrid}>
    <Pressable accessibilityRole="button" onPress={()=>setProfileSettingsPage('settings')} style={s.profileCloseVideo}><Text style={s.link}>← Settings and privacy</Text></Pressable>
    <Text style={[s.heading,{marginVertical:14}]}>Account, privacy & content controls</Text>
 {profileSettingsOpen&&<View style={[s.card,{gap:13,marginVertical:14,borderColor:'#C6AA72',borderWidth:1}]}>
  <Text style={s.heading}>≡ RECONFEED ACCOUNT CONTROL</Text>
  <Text style={s.muted}>These settings save to your account. Personal and Business are profile categories; paid rewards, commercial music rights and passkeys are not enabled here.</Text>
  <Text style={s.subheading}>ACCOUNT & DATA DELETION</Text>
  <Text style={s.muted}>You may request permanent deletion of your ReconFeed account and associated content. An authorized reviewer must verify and complete the request; sending a request does not erase your account immediately.</Text>
  <Pressable accessibilityRole="button" accessibilityLabel="Request permanent account deletion" style={[s.outline,{borderColor:'#B86560'}]} onPress={confirmAccountDeletion}><Text style={[s.link,{color:'#F4C4B4'}]}>Request deletion of my account</Text></Pressable>
  <Pressable accessibilityRole="link" onPress={()=>{void Linking.openURL('https://reconfeed.com/delete-account.html')}} style={s.outline}><Text style={s.link}>Account deletion details ↗</Text></Pressable>
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
  <Text style={s.subheading}>WHO MAY SEND YOU DIRECT MESSAGES?</Text>
  <View style={s.row}>{([{id:'followers',name:'Mutual followers'},{id:'everyone',name:'Everyone'},{id:'none',name:'Nobody'}] as const).map(option=><Pressable key={option.id} accessibilityRole="radio" accessibilityState={{checked:creatorSettings.allow_messages===option.id}} style={[s.chip,creatorSettings.allow_messages===option.id&&s.selected]} onPress={()=>setCreatorSettings(v=>({...v,allow_messages:option.id}))}><Text style={s.chipText}>{option.name}</Text></Pressable>)}</View>
  <Text style={s.muted}>Mutual followers means both accounts follow each other. Everyone allows messages from other signed-in accounts. Nobody disables new messages. Blocked accounts cannot send new messages.</Text>
  <Text style={s.muted}>Mention and liked-video publicity controls are not yet enabled.</Text>
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
  <Text style={s.subheading}>DEVICE PERMISSIONS & YOUR DATA</Text>
  <Text style={s.muted}>Camera access is requested only when you tap Record or Photo. Video with sound also needs microphone permission. The system photo picker lets you choose files; selecting or recording media does not upload it until you tap Publish, Save photo, Save profile changes or Submit issue.</Text>
  <Text style={s.muted}>ReconFeed does not access phone contacts, SMS, call history or device location. You can deny permissions and still browse. Account details, content you submit, likes, follows, messages and reports are stored to run those features. Public posts and profile photos are shareable; tester screenshots are private to their reporter and the owner.</Text>
  <Pressable accessibilityRole="button" onPress={()=>{if(Platform.OS==='web')showAlert('Browser permissions','Use your browser site settings to review permissions. Selecting a file only gives ReconFeed access to that file.');else void Linking.openSettings()}} style={s.outline}><Text style={s.link}>Manage camera, microphone & photo permissions</Text></Pressable>
  <Text style={s.subheading}>FEED PERSONALIZATION & PRIVACY</Text>
  <Text style={s.muted}>Optional viewing-history personalization is OFF until you turn it on. Turning it off stops new watch/share tracking and clears unsent events. Likes, follows and your explicit Not interested choices still work. You can clear previously saved recommendation history below.</Text>
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
 </View><Pressable accessibilityRole="button" onPress={()=>setResearchPanelOpen(v=>!v)} style={s.outline}><Text style={s.link}>{researchPanelOpen?'▾ CLOSE TESTER SURVEY':'▸ TESTER SURVEY & FEEDBACK'}</Text></Pressable>{researchPanelOpen&&<><Text style={s.heading}>Help shape ReconFeed</Text><Text style={s.muted}>A short research survey. These are hypothetical preferences, not a purchase or subscription.</Text>{!researchLoaded?<ActivityIndicator color={theme.purple}/>:<><Text style={s.subheading}>Which features would you actually use?</Text><View style={s.row}>{researchOptions.map(o=>{const selected=researchFeatures.includes(o.id);return <Pressable key={o.id} onPress={()=>setResearchFeatures(prev=>o.id==='none_yet'?(selected?[]:['none_yet']):selected?prev.filter(x=>x!==o.id&&x!=='none_yet'):[...prev.filter(x=>x!=='none_yet'),o.id])} style={[s.chip,selected&&s.selected]}><Text style={s.chipText}>{selected?'✓ ':''}{o.label}</Text></Pressable>})}</View><Text style={s.subheading}>What is the most you would pay monthly for optional premium features?</Text><View style={s.row}>{[{v:'free',l:'Free only'},{v:'2.99',l:'$2.99/mo'},{v:'5.99',l:'$5.99/mo'},{v:'9.99',l:'$9.99/mo'}].map(o=><Pressable key={o.v} onPress={()=>setResearchPrice(o.v)} style={[s.chip,researchPrice===o.v&&s.selected]}><Text style={s.chipText}>{o.l}</Text></Pressable>)}</View><Text style={s.subheading}>How would you prefer to show up?</Text><View style={s.row}>{[{v:'real',l:'Real identity / camera'},{v:'avatar',l:'Virtual avatar'},{v:'both',l:'Both — switch anytime'}].map(o=><Pressable key={o.v} onPress={()=>setResearchIdentity(o.v)} style={[s.chip,researchIdentity===o.v&&s.selected]}><Text style={s.chipText}>{researchIdentity===o.v?'✓ ':''}{o.l}</Text></Pressable>)}</View><Text style={s.subheading}>What is the biggest thing social apps are missing? (optional)</Text><TextInput value={researchNeed} onChangeText={setResearchNeed} maxLength={500} multiline placeholder="Tell us what would make ReconFeed worth opening every day…" placeholderTextColor={theme.muted} style={[s.input,{height:86}]}/><Pressable onPress={()=>setResearchWilling(v=>!v)} style={[s.row,{alignItems:'center',marginVertical:8}]}><Text style={{fontSize:23,color:researchWilling?theme.purple:theme.muted}}>{researchWilling?'☑':'☐'}</Text><Text style={[s.muted,{flex:1}]}>I am willing to test an early prototype and give feedback.</Text></Pressable><Pressable style={s.button} disabled={busy} onPress={saveResearchResponse}><Text style={s.buttonText}>{busy?'Saving…':researchSaved?'Update survey response':'Submit tester survey'}</Text></Pressable><Text style={s.muted}>One response per signed-in account. You can edit it later. Research answers are separate from your public profile.</Text></>}</>}<Pressable style={s.outline} onPress={async()=>{await feedQueueRef.current?.clear();await supabase?.auth.signOut()}}><Text style={[s.link,{color:theme.pink}]}>Sign out</Text></Pressable></ScrollView></SafeAreaView>}</Modal></>:<>{Platform.OS==='web'&&String((globalThis as any).location?.search||'').includes('beta=1')?<View style={{backgroundColor:'#1e2b20',borderColor:'#C6AA72',borderWidth:1,borderRadius:10,padding:15,marginVertical:14}}><Text style={{fontSize:15,fontWeight:'900',color:'#C6AA72',marginBottom:7}}>★ BETA TESTER — CREATE YOUR ACCOUNT</Text><Text style={{fontSize:13,color:'#F0EEE5',lineHeight:21}}>Your tester application is in. Create a ReconFeed account with the same email you used on the tester form, then confirm your email. Already have an account? Sign in below instead.</Text></View>:null}<Text style={s.muted}>Veteran owned · 18+. Built for mature-minded people who respect the military and those who serve.</Text><TextInput value={email} onChangeText={setEmail} autoCapitalize="none" keyboardType="email-address" placeholder="Email address" placeholderTextColor={theme.muted} style={s.input}/><TextInput value={password} onChangeText={setPassword} secureTextEntry placeholder="Password (12+ for new accounts)" placeholderTextColor={theme.muted} style={s.input}/><TextInput value={name} onChangeText={setName} placeholder="Display name" placeholderTextColor={theme.muted} style={s.input}/><Text style={s.muted}>Gender</Text><View style={s.row}>{['MALE','FEMALE','Other'].map(g=><Pressable key={g} onPress={()=>setGender(g)} style={[s.chip,gender===g&&s.selected]}><Text style={s.chipText}>{g}</Text></Pressable>)}</View><Text style={s.muted}>Political party (required for new accounts)</Text><View style={s.row}>{([{id:'republican',label:'Republican'},{id:'democratic',label:'Democratic'}] as const).map(p=><Pressable key={p.id} accessibilityRole="radio" accessibilityState={{checked:politicalParty===p.id}} onPress={()=>setPoliticalParty(p.id)} style={[s.chip,politicalParty===p.id&&s.selected]}><Text style={s.chipText}>{politicalParty===p.id?'✓ ':''}{p.label}</Text></Pressable>)}</View><Text style={s.muted}>Select one option to create an account. During this beta, only Republican selections are eligible to register. Existing users may sign in normally.</Text><Pressable accessibilityRole="checkbox" accessibilityState={{checked:termsAccepted}} onPress={()=>setTermsAccepted(v=>!v)} style={[s.outline,{marginTop:8,minHeight:46,flexDirection:'row',gap:10,alignItems:'center'}]}><Text style={s.link}>{termsAccepted?'☑':'☐'} I accept ReconFeed Terms and acknowledge its Privacy Policy for new account signup</Text></Pressable>
<Pressable accessibilityRole="button" onPress={()=>void Linking.openURL('https://reconfeed.com/terms.html')} style={s.outline}><Text style={s.link}>Read Terms of Service ↗</Text></Pressable>
<Pressable accessibilityRole="button" onPress={()=>void Linking.openURL('https://reconfeed.com/privacy.html')} style={s.outline}><Text style={s.link}>Read Privacy Policy ↗</Text></Pressable>
<Pressable style={s.button} disabled={busy} onPress={()=>auth(false)}><Text style={s.buttonText}>Sign in</Text></Pressable><Pressable style={s.outline} disabled={busy} onPress={()=>auth(true)}><Text style={s.link}>Create account</Text></Pressable><Pressable style={s.outline} disabled={busy} onPress={()=>requestAccountEmail(true)}><Text style={s.link}>Forgot password</Text></Pressable><Pressable style={s.outline} disabled={busy} onPress={()=>requestAccountEmail(false)}><Text style={s.link}>Resend confirmation email</Text></Pressable></>}</ScrollView>;
 const commentsModal=<Modal visible={!!commentTarget} animationType="slide" transparent onRequestClose={()=>setCommentTarget(null)}><KeyboardAvoidingView behavior={Platform.OS==='ios'?'padding':undefined} style={{flex:1,justifyContent:'flex-end'}}><View style={{flex:1,backgroundColor:'#000a',justifyContent:'flex-end'}}><View style={{backgroundColor:olive.bg,borderTopLeftRadius:25,borderTopRightRadius:25,padding:15,height:'75%'}}><View style={{width:42,height:4,backgroundColor:olive.border,borderRadius:3,alignSelf:'center',marginBottom:13}}/><View style={{flexDirection:'row',justifyContent:'center',alignItems:'center',marginBottom:16}}><Text style={{fontSize:17,fontWeight:'800',color:olive.text}}>{commentItems.length||commentTarget?.comments?.[0]?.count||0} comments</Text><Pressable style={{position:'absolute',right:5}} onPress={()=>setCommentTarget(null)}><Text style={{fontSize:25,color:olive.text}}>×</Text></Pressable></View>{commentsBusy?<ActivityIndicator color="#222"/>:<FlatList data={commentItems.filter(x=>!x.parent_id||expandedThreads.includes(x.parent_id))} keyExtractor={x=>x.id} ListEmptyComponent={<Text style={{color:olive.muted,textAlign:'center',marginTop:25}}>No comments yet. Start the conversation.</Text>} renderItem={({item})=><View style={{flexDirection:'row',gap:11,paddingVertical:14}}><Pressable accessibilityRole="button" accessibilityLabel={'View '+(item.profiles?.username||'creator')+' profile'} onPress={()=>{setCommentTarget(null);void openCreatorProfile({id:item.user_id,username:item.profiles?.username,display_name:item.profiles?.display_name,avatar_url:item.profiles?.avatar_url})}} style={{width:40,height:40,borderRadius:20,backgroundColor:olive.raised,alignItems:'center',justifyContent:'center',overflow:'hidden',borderWidth:1,borderColor:olive.border}}>{item.profiles?.avatar_url?<Image source={{uri:item.profiles.avatar_url}} style={{width:40,height:40,borderRadius:20}}/>:<Text style={{color:olive.text,fontSize:16,fontWeight:'800'}}>{(item.profiles?.display_name||item.profiles?.username||'R')[0].toUpperCase()}</Text>}</Pressable><View style={{flex:1,gap:5}}><Pressable accessibilityRole="button" accessibilityLabel={'Open '+(item.profiles?.username||'creator')+' profile'} onPress={()=>{setCommentTarget(null);void openCreatorProfile({id:item.user_id,username:item.profiles?.username,display_name:item.profiles?.display_name,avatar_url:item.profiles?.avatar_url})}}><Text style={{color:olive.accent,fontWeight:'700',fontSize:13}}>{item.profiles?.display_name||item.profiles?.username||'Creator'}</Text></Pressable><Text style={{color:olive.text,fontSize:15}}>{item.body}</Text><View style={{flexDirection:'row',alignItems:'center',gap:12,flexWrap:'wrap'}}><Text style={{color:olive.muted,fontSize:11}}>{new Date(item.created_at).toLocaleDateString()}</Text><Pressable accessibilityRole="button" accessibilityLabel={'Reply to '+(item.profiles?.username||'creator')} onPress={()=>{setReplyTo(item);setCommentText('@'+(item.profiles?.username||'creator')+' ')}}><Text style={{color:olive.muted,fontSize:12,fontWeight:'800'}}>Reply</Text></Pressable></View>{!item.parent_id&&commentItems.some(x=>x.parent_id===item.id)&&<Pressable onPress={()=>setExpandedThreads(ids=>ids.includes(item.id)?ids.filter(id=>id!==item.id):[...ids,item.id])}><Text style={{color:olive.muted}}> {expandedThreads.includes(item.id)?'Hide replies':'View replies'} ⌄</Text></Pressable>}</View><Pressable onPress={async()=>{if(!session||!supabase){showAlert('Sign in required','Sign in to like comments.');return}const liked=commentLikedIds.includes(item.id);const req=liked?await supabase.from('comment_likes').delete().eq('comment_id',item.id).eq('user_id',session.user.id):await supabase.from('comment_likes').insert({comment_id:item.id,user_id:session.user.id});if(req.error){showAlert('Like failed',req.error.message);return}setCommentLikedIds(ids=>liked?ids.filter(id=>id!==item.id):[...ids,item.id])}}><Text style={{color:commentLikedIds.includes(item.id)?'#ef365e':'#888',fontSize:22}}>{commentLikedIds.includes(item.id)?'♥':'♡'}</Text></Pressable></View>}/>}{replyTo?<View style={{flexDirection:'row',alignItems:'center',justifyContent:'space-between',paddingBottom:8}}><Text style={{color:olive.accent,fontWeight:'700',fontSize:12}}>↪ Replying to @{replyTo.profiles?.username||'creator'}</Text><Pressable accessibilityRole="button" accessibilityLabel="Cancel reply" onPress={()=>{setReplyTo(null);setCommentText('')}}><Text style={{color:olive.muted,fontSize:15}}>✕ Cancel</Text></Pressable></View>:null}
 <ScrollView horizontal showsHorizontalScrollIndicator={false} keyboardShouldPersistTaps="always" style={{flexGrow:0,marginBottom:10}} contentContainerStyle={{gap:12,alignItems:'center',paddingHorizontal:2}}>
 {['❤️','😂','🔥','👏','🙌','😍','🥹','💯','👍','🙏','😎','🎉'].map(symbol=><Pressable key={symbol} accessibilityRole="button" accessibilityLabel={'Insert '+symbol+' emoji'} onPress={()=>setCommentText(value=>value+symbol)} style={({pressed})=>[{minWidth:34,minHeight:36,alignItems:'center',justifyContent:'center'},pressed&&{opacity:.6}]}><Text style={{fontSize:25}}>{symbol}</Text></Pressable>)}
 </ScrollView>
 <View style={{flexDirection:'row',alignItems:'center',gap:9,borderTopWidth:1,borderColor:olive.border,paddingTop:9}}><TextInput value={commentText} onChangeText={setCommentText} placeholder={replyTo?'Reply to @'+(replyTo.profiles?.username||'creator'):'Add comment…'} placeholderTextColor="#999" style={{flex:1,backgroundColor:olive.surface,borderRadius:25,paddingHorizontal:16,paddingVertical:12,color:olive.text}} maxLength={1000} returnKeyType="send" onSubmitEditing={()=>{if(commentText.trim()&&!commentsBusy)void submitComment()}}/><Pressable accessibilityRole="button" accessibilityLabel="Post comment" disabled={commentsBusy||!commentText.trim()} onPress={submitComment} style={{backgroundColor:commentText.trim()?olive.accent:olive.raised,width:41,height:41,borderRadius:21,alignItems:'center',justifyContent:'center'}}><Text style={{fontWeight:'900',fontSize:21,color:olive.deep}}>↑</Text></Pressable></View></View></View></KeyboardAvoidingView></Modal>;
  if(!authReady)return <SafeAreaView style={[s.safe,{backgroundColor:olive.bg,alignItems:'center',justifyContent:'center',gap:12}]}>
<Image source={require('./assets/icon.png')} style={{width:92,height:92,borderRadius:22}} resizeMode="contain"/>
<Text style={{fontSize:24,color:olive.gold,fontWeight:'900',letterSpacing:1.4}}>RECONFEED</Text>
<Text style={{fontSize:12,color:olive.muted}}>Veteran owned · Real community</Text>
</SafeAreaView>;
  if(recovering)return <SafeAreaView style={s.safe}><ScrollView contentContainerStyle={{padding:24,maxWidth:600,width:'100%',alignSelf:'center'}}><Text style={s.heading}>Reset your password</Text><Text style={s.muted}>Choose a new password with at least 12 characters.</Text><TextInput value={newPassword} onChangeText={setNewPassword} secureTextEntry autoCapitalize="none" placeholder="New password" placeholderTextColor={theme.muted} style={s.input}/><Pressable disabled={busy||!session} style={s.button} onPress={saveRecoveredPassword}><Text style={s.buttonText}>{busy?'Saving…':'Save new password'}</Text></Pressable>{!session&&<Text style={s.muted}>Open the newest reset link from your email. If it has expired, request another.</Text>}<Pressable style={s.outline} onPress={()=>{setRecovering(false);setNewPassword('');setTab('Profile')}}><Text style={s.link}>Back to ReconFeed</Text></Pressable></ScrollView></SafeAreaView>;
  return <SafeAreaView style={[s.safe,tab==='Profile'&&{backgroundColor:olive.bg}]}><StatusBar barStyle="light-content"/>{tab!=='Profile'&&tab!=='For You'&&tab!=='Following'&&<View style={[s.header,{paddingHorizontal:compact?8:20,maxWidth:contentMaxWidth,alignSelf:'center',width:'100%',gap:6}]}><View style={[s.brandRow,{flexShrink:1,minWidth:0,gap:compact?6:11}]}><Image source={require('./assets/icon.png')} style={[s.brandLogo,compact&&{width:38,height:38}]} accessibilityLabel="ReconFeed veteran-owned military shield logo"/><View style={{minWidth:0,flexShrink:1}}><Text style={[s.logo,compact&&{fontSize:21}]} numberOfLines={1}>Recon<Text style={s.logoAccent}>Feed</Text></Text><Text style={[s.tagline,compact&&{fontSize:7,letterSpacing:.4}]} numberOfLines={1}>VETERAN OWNED · 18+ · BETA</Text></View></View><Pressable accessibilityRole="button" onPress={()=>setTab('Profile')} style={[s.headerAction,compact&&{paddingHorizontal:8,paddingVertical:9}]}><Text style={s.headerActionText}>{session?'PROFILE':'SIGN IN'} ↗</Text></Pressable></View>}<ImageBackground source={require('./assets/icon.png')} imageStyle={[s.appBackdropImage,(tab==='Profile'||tab==='For You'||tab==='Following')&&{opacity:0}]} style={[s.body,tab==='Profile'&&{backgroundColor:olive.bg},{minHeight:0,overflow:'hidden',maxWidth:(tab==='For You'||tab==='Following')?feedMaxWidth:contentMaxWidth,width:'100%',alignSelf:'center',paddingHorizontal:(tab==='For You'||tab==='Following'||tab==='Profile')?0:(compact?10:16),paddingTop:0}]}>{tab==='Market'?marketplace():tab==='Create'?create():tab==='Profile'?profileView():tab==='Discover'?exploreView():feed()}</ImageBackground><View style={[s.navOuter,tab==='Profile'&&{backgroundColor:olive.bg},(tab==='For You'||tab==='Following')&&{backgroundColor:olive.bg},{flexShrink:0,maxWidth:(tab==='For You'||tab==='Following')?feedMaxWidth:contentMaxWidth,width:'100%',alignSelf:'center',paddingBottom:Platform.OS==='android'?Math.max(8,Math.min(18,Math.round(screenHeight*.016))):3}]}><View style={[s.nav,tab==='Profile'&&{backgroundColor:olive.bg,borderColor:olive.border},(tab==='For You'||tab==='Following')&&{backgroundColor:olive.bg,borderTopColor:olive.border},micro&&{paddingHorizontal:0,paddingTop:2,paddingBottom:2}]}>{([{key:'For You',label:'Home',icon:'home'},{key:'Following',label:'Friends',icon:'users'},{key:'Create',label:'Create',icon:'plus'},{key:'Market',label:'Inbox',icon:'inbox'},{key:'Profile',label:'Profile',icon:'user'}] as Array<{key:Tab;label:string;icon:ProfileIconName}>).map(item=><Pressable accessibilityRole="button" accessibilityLabel={item.key==='Market'&&unreadMessages>0?'Inbox, '+unreadMessages+' unread messages':item.label} accessibilityState={{selected:item.key==='Market'?socialInboxOpen:(tab===item.key)}} key={item.key} onPress={()=>{if(item.key==='Market'){if(!session){showAlert('Sign in required','Sign in to read your direct messages.');setTab('Profile')}else{setSocialPeer(null);setSocialInboxOpen(true)}}else if(item.key==='Create'){startCreating();if(Platform.OS!=='web')void capture('video')}else setTab(item.key)}} style={({pressed})=>[s.navItem,pressed&&{opacity:.74,transform:[{scale:.96}]},item.key==='Create'&&s.navCreateItem,item.key==='Create'&&(tab==='For You'||tab==='Following')&&{backgroundColor:olive.accent,borderLeftColor:olive.border,borderRightColor:olive.gold,borderTopColor:olive.gold,borderBottomColor:olive.gold,borderRadius:12},micro&&{paddingHorizontal:0},micro&&item.key==='Create'&&{marginHorizontal:2},(tab===item.key)&&s.navItemActive]}><ProfileIcon name={item.icon} size={micro?(item.key==='Create'?26:22):(item.key==='Create'?30:26)} color={item.key==='Create'&&(tab==='For You'||tab==='Following')?olive.deep:tab==='Profile'?olive.text:(tab===item.key)?olive.gold:olive.text}/>{item.key!=='Create'?<Text style={[s.navLabel,micro&&{fontSize:10,letterSpacing:0},tab==='Profile'&&{color:olive.text},(tab===item.key)&&s.navLabelActive]}>{item.label}</Text>:null}{item.key==='Market'&&unreadMessages>0?<View pointerEvents="none" style={{position:'absolute',right:micro?0:9,top:0,minWidth:18,height:18,borderRadius:9,paddingHorizontal:3,backgroundColor:'#B83235',alignItems:'center',justifyContent:'center'}}><Text style={{color:'#fff',fontSize:10,fontWeight:'900'}}>{unreadMessages>99?'99+':unreadMessages}</Text></View>:null}</Pressable>)}</View></View>{commentsModal}{supabase&&session?<StoryComposer client={supabase} session={session} visible={storyComposerOpen} onClose={()=>setStoryComposerOpen(false)} onPublished={()=>setStoryRefreshToken(v=>v+1)}/>:null}  <Modal visible={!!viewingCreator} animationType="slide" onRequestClose={()=>setViewingCreator(null)}>
   <SafeAreaView style={[s.safe,{backgroundColor:olive.bg}]}>
    <ScrollView contentContainerStyle={{paddingBottom:20,backgroundColor:olive.bg}}><Pressable accessibilityRole="button" style={[s.profileCloseVideo,{backgroundColor:olive.bg}]} onPress={()=>{++creatorProfileRequest.current;setViewingCreator(null)}}><Text style={{color:olive.text,fontSize:15,fontWeight:'700'}}>← Back</Text></Pressable>
     {viewingCreator&&<PublicCreatorHeader
      creator={viewingCreator}
      following={followingIds.includes(viewingCreator.id)}
      onFollow={()=>{if(followingIds.includes(viewingCreator.id))showAlert('Unfollow creator?','Remove this account from your Following feed?',[{text:'Cancel',style:'cancel'},{text:'Unfollow',onPress:()=>void follow({user_id:viewingCreator.id} as Post,true)}]);else void follow({user_id:viewingCreator.id} as Post)}}
      followsYou={!!viewingCreator.followsYou}
       onMessage={()=>{if(!session){++creatorProfileRequest.current;setViewingCreator(null);setTab('Profile');showAlert('Sign in required','Sign in to message creators.');return}setSocialPeer({id:viewingCreator.id,username:viewingCreator.username,display_name:viewingCreator.display_name,avatar_url:viewingCreator.avatar_url});++creatorProfileRequest.current;setViewingCreator(null);setSocialInboxOpen(true)}}
       onShare={()=>void shareProfile(viewingCreator.username)}
     />}
     <View style={[s.profileContentTabs,{justifyContent:'center'}]}><View style={{padding:12}}><ProfileIcon name="grid"/></View></View>
     {creatorProfileLoading?<ActivityIndicator color={theme.purple}/>:<View style={s.profileTileGrid}>{viewingCreatorPosts.length?viewingCreatorPosts.map((p,index)=><Pressable key={p.id} accessibilityRole="button" accessibilityLabel={'View '+(p.caption||'post')} onPress={()=>{++creatorProfileRequest.current;setViewingCreator(null);setExploreSelected(p)}} style={s.profileVideoTile}>{p.media_type==='image'?<Image source={{uri:p.media_url}} style={s.profileVideoThumbnail}/>:<View style={s.profileVideoThumbnail}><VideoTilePreview uri={p.media_url} playing={index<3&&!!viewingCreator}/><View pointerEvents="none" style={{position:'absolute',bottom:5,right:5,backgroundColor:'#08170d99',borderRadius:9,paddingHorizontal:6,paddingVertical:3}}><Text style={{color:'#fff',fontSize:12}}>▶</Text></View></View>}</Pressable>):<View style={s.profileTabEmpty}><Text style={s.profileEmptyBody}>No public posts available.</Text></View>}</View>}
     {session&&viewingCreator?<Pressable accessibilityRole="button" style={s.outline} onPress={()=>void blockCreator(viewingCreator.id)}><Text style={s.link}>Block creator</Text></Pressable>:null}

    </ScrollView>
   </SafeAreaView>
  </Modal>{connections&&supabase&&session?<ProfileConnections client={supabase} userId={session.user.id} kind={connections} followingIds={followingIds} onFollowBack={async p=>{await follow({user_id:p.id} as Post)}} onClose={()=>setConnections(null)} onCreator={p=>{setConnections(null);void openCreatorProfile(p)}}/>:null}<Modal visible={analyticsOpen} animationType="slide" onRequestClose={()=>setAnalyticsOpen(false)}><SafeAreaView style={s.safe}><ScrollView contentContainerStyle={{padding:20,gap:20}}><Pressable accessibilityRole="button" onPress={()=>setAnalyticsOpen(false)}><Text style={s.link}>← Back to profile</Text></Pressable><Text style={s.heading}>ReconFeed Studio</Text><Text style={s.strong}>{profileStats.posts.toLocaleString()} posts · {profileStats.likes.toLocaleString()} likes</Text><Text style={s.strong}>{creatorAnalytics.views.toLocaleString()} tracked views · {creatorAnalytics.completedViews.toLocaleString()} completed views</Text><Text style={s.strong}>{Math.round(creatorAnalytics.watchSeconds/60).toLocaleString()} watch minutes · {creatorAnalytics.shares.toLocaleString()} recorded shares</Text><Text style={s.muted}>Views reflect optional viewing-history tracking. Visitor identities are not collected.</Text><Pressable style={s.outline} onPress={()=>{setAnalyticsOpen(false);setProfileEditOpen(true)}}><Text style={s.link}>Edit profile</Text></Pressable><Pressable style={s.outline} onPress={()=>{setAnalyticsOpen(false);setProfileSettingsPage('settings');setProfileSettingsOpen(true)}}><Text style={s.link}>Account settings & permissions</Text></Pressable></ScrollView></SafeAreaView></Modal><Modal visible={profilePhotoOpen} animationType="slide" onRequestClose={()=>{if(!profilePhotoBusy){setProfilePhotoOpen(false);setProfileAvatarDraft(null)}}}><SafeAreaView style={s.safe}><ScrollView contentContainerStyle={{padding:20,gap:20,paddingBottom:50}}><Text style={s.heading}>Save profile photo</Text><Text style={s.muted}>Preview only — your photo is uploaded when you tap Save photo.</Text>{profileAvatarDraft?<Image source={{uri:profileAvatarDraft.uri}} style={{width:180,height:180,borderRadius:90,alignSelf:'center'}} resizeMode="cover"/>:null}<Pressable accessibilityRole="button" disabled={profilePhotoBusy} style={s.button} onPress={()=>void saveProfilePhoto()}><Text style={s.buttonText}>{profilePhotoBusy?'Saving photo…':'Save photo'}</Text></Pressable><Pressable accessibilityRole="button" disabled={profilePhotoBusy} style={s.outline} onPress={()=>{setProfilePhotoOpen(false);setProfileAvatarDraft(null)}}><Text style={s.link}>Cancel</Text></Pressable></ScrollView></SafeAreaView></Modal>{supabase&&session&&<TesterReports client={supabase} userId={session.user.id} visible={testerReportsOpen} onClose={()=>setTesterReportsOpen(false)} onReport={()=>{setTesterReportsOpen(false);setTesterIssueOpen(true)}}/>}<Modal visible={testerIssueOpen} animationType="slide" onRequestClose={()=>setTesterIssueOpen(false)}><SafeAreaView style={{flex:1,backgroundColor:'#101410',padding:20}}><ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={{gap:15,paddingBottom:50}}><View style={{flexDirection:'row',justifyContent:'space-between',alignItems:'center'}}><Text style={{color:'#fff',fontSize:23,fontWeight:'900'}}>ReconFeed TesterFile</Text><Pressable onPress={()=>setTesterIssueOpen(false)}><Text style={{color:'#fff',fontSize:26}}>×</Text></Pressable></View><Text style={{color:'#bfc8b0'}}>Found something broken? Report it here. Your report is automatically saved for the ReconFeed team. When you submit, we'll include screen dimensions, pixel density, platform and OS version to help fix device-specific display issues—not your location or contacts.</Text><Text style={{color:'#fff',fontWeight:'800'}}>Issue category</Text><View style={{flexDirection:'row',flexWrap:'wrap',gap:8}}>{['Bug','Playback','Comments','Sharing','Account','Design','Other'].map(c=><Pressable key={c} onPress={()=>setTesterIssueCategory(c)} style={{padding:10,borderRadius:18,backgroundColor:testerIssueCategory===c?'#b1bd8a':'#293228'}}><Text style={{color:testerIssueCategory===c?'#111':'#fff'}}>{c}</Text></Pressable>)}</View><TextInput value={testerIssueTitle} onChangeText={setTesterIssueTitle} placeholder="Short issue title (required)" placeholderTextColor="#aaa" maxLength={140} style={[s.input,{color:'#fff'}]}/><TextInput value={testerIssueDescription} onChangeText={setTesterIssueDescription} placeholder="What happened? What did you expect? (required)" placeholderTextColor="#aaa" multiline maxLength={4000} style={[s.input,{color:'#fff',minHeight:130,textAlignVertical:'top'}]}/><TextInput value={testerIssueSteps} onChangeText={setTesterIssueSteps} placeholder="Steps to reproduce (optional)" placeholderTextColor="#aaa" multiline style={[s.input,{color:'#fff',minHeight:100,textAlignVertical:'top'}]}/><Pressable accessibilityRole="button" onPress={chooseTesterScreenshot} style={[s.button,{padding:12}]}><Text style={s.buttonText}>{testerScreenshot?'✓ Screenshot selected · Tap to change':'＋ Attach screenshot from gallery (optional)'}</Text></Pressable>{testerScreenshot?<Image source={{uri:testerScreenshot.uri}} style={{width:130,height:180,borderRadius:8}} resizeMode="contain"/>:null}<Text style={{color:'#aaa'}}>Platform: {Platform.OS}. Screenshots are stored privately. Avoid passwords or private information.</Text><Pressable disabled={testerIssueBusy} onPress={submitTesterIssue} style={[s.button,{padding:17}]}><Text style={s.buttonText}>{testerIssueBusy?'Submitting…':'Submit issue to TesterFile'}</Text></Pressable></ScrollView></SafeAreaView></Modal><Modal visible={!!feedMorePost} transparent animationType="slide" onRequestClose={()=>setFeedMorePost(null)}><View style={{flex:1,justifyContent:'flex-end',backgroundColor:'#0009'}}><View style={{backgroundColor:olive.bg,padding:20,paddingBottom:32,borderTopLeftRadius:22,borderTopRightRadius:22,gap:9}}>
<Text style={{color:olive.text,fontSize:20,fontWeight:'900',marginBottom:8}}>Post options</Text>
<Pressable accessibilityRole="button" onPress={()=>{setMuted(v=>!v);setFeedMorePost(null)}} style={s.outline}><Text style={s.link}>{muted?'Unmute videos':'Mute videos'}</Text></Pressable>
<Pressable accessibilityRole="button" onPress={()=>{const p=feedMorePost;setFeedMorePost(null);if(p)void savePost(p)}} style={s.outline}><Text style={s.link}>{feedMorePost&&savedPostIds.includes(feedMorePost.id)?'Remove saved post':'Save post'}</Text></Pressable>
<Pressable accessibilityRole="button" onPress={()=>{const p=feedMorePost;setFeedMorePost(null);if(p)setShareTarget(p)}} style={s.outline}><Text style={s.link}>Share post</Text></Pressable>
<Pressable accessibilityRole="button" onPress={()=>{const p=feedMorePost;setFeedMorePost(null);if(p)void repost(p)}} style={s.outline}><Text style={s.link}>{feedMorePost&&repostedIds.includes(feedMorePost.id)?'Remove repost':'Repost'}</Text></Pressable>
<Pressable accessibilityRole="button" onPress={()=>{const p=feedMorePost;setFeedMorePost(null);if(p)showAlert('Not interested','Show fewer posts like this?',[{text:'Cancel',style:'cancel'},{text:'Not interested',onPress:()=>{setNotInterested(ids=>ids.includes(p.id)?ids:[...ids,p.id]);setPosts(items=>items.filter(x=>x.id!==p.id));void recordFeedAction(p.id,'not_interested')}}])}} style={s.outline}><Text style={s.link}>Not interested</Text></Pressable>
<Pressable accessibilityRole="button" onPress={()=>{const p=feedMorePost;setFeedMorePost(null);if(p)setReportTarget(p)}} style={s.outline}><Text style={s.link}>⚑ Report post</Text></Pressable>
<Pressable accessibilityRole="button" onPress={()=>setFeedMorePost(null)} style={s.outline}><Text style={s.link}>Cancel</Text></Pressable>
</View></View></Modal><Modal visible={!!shareTarget} transparent animationType="slide" onRequestClose={()=>setShareTarget(null)}><View style={{flex:1,justifyContent:'flex-end',backgroundColor:'#0009'}}><View style={{backgroundColor:olive.bg,borderTopLeftRadius:24,borderTopRightRadius:24,padding:20,gap:20}}><View style={{flexDirection:'row',justifyContent:'space-between'}}><Text style={{fontSize:19,fontWeight:'800',color:olive.text}}>Send to</Text><Pressable onPress={()=>setShareTarget(null)}><Text style={{fontSize:24,color:olive.text}}>×</Text></Pressable></View><Text style={{color:olive.muted}}>Share this ReconFeed video</Text><View style={{flexDirection:'row',justifyContent:'space-around'}}>{[{name:'Messages',icon:'✉'},{name:'Share',icon:'↗'},{name:'Copy link',icon:'🔗'}].map(item=><Pressable key={item.name} onPress={async()=>{const p=shareTarget;if(!p)return;try{await Share.share({message:'Watch on ReconFeed: '+p.caption+' '+p.media_url});void recordFeedAction(p.id,'share')}catch(e){console.warn('Share unavailable')}setShareTarget(null)}} style={{alignItems:'center',gap:8}}><Text style={{fontSize:31,color:olive.text}}>{item.icon}</Text><Text style={{color:olive.text}}>{item.name}</Text></Pressable>)}</View><Pressable onPress={()=>{setReportTarget(shareTarget);setShareTarget(null)}}><Text style={{color:olive.muted,textAlign:'center'}}>⚑ Report video</Text></Pressable></View></View></Modal><Modal visible={!!soundTarget} transparent animationType="slide" onRequestClose={()=>setSoundTarget(null)}>
 <View style={{flex:1,justifyContent:'flex-end',backgroundColor:'#000c'}}>
  <View style={{backgroundColor:olive.bg,height:'76%',borderTopLeftRadius:26,borderTopRightRadius:26,paddingHorizontal:18,paddingTop:10,paddingBottom:20,gap:13}}>
   <View style={{width:42,height:4,borderRadius:4,backgroundColor:olive.border,alignSelf:'center',marginBottom:7}}/>
   <View style={{flexDirection:'row',alignItems:'center',justifyContent:'space-between'}}>
    <Text style={{fontSize:23,fontWeight:'800',color:olive.text}}>Sound details</Text>
    <Pressable accessibilityRole="button" accessibilityLabel="Close sound details" onPress={()=>setSoundTarget(null)} style={{width:42,height:42,justifyContent:'center',alignItems:'center'}}><Text style={{fontSize:28,color:olive.text}}>×</Text></Pressable>
   </View>
   <View style={{flexDirection:'row',gap:13,alignItems:'center',padding:14,backgroundColor:olive.surface,borderWidth:1,borderColor:olive.border,borderRadius:18}}>
    <View style={{width:59,height:59,borderRadius:13,backgroundColor:olive.raised,justifyContent:'center',alignItems:'center'}}><Text style={{fontSize:30,color:olive.accent}}>♫</Text></View>
    <View style={{flex:1,gap:5}}><Text style={{fontSize:17,fontWeight:'800',color:olive.text}} numberOfLines={2}>{soundTarget?.audio_label||'Original sound'}</Text><Text style={{fontSize:12,color:olive.muted}} numberOfLines={1}>Original post · @{(Array.isArray(soundTarget?.profiles)?soundTarget?.profiles[0]:soundTarget?.profiles)?.username||'creator'}</Text></View>
   </View>
   {soundTarget?.media_type==='video'?<View style={{flex:1,minHeight:150,backgroundColor:olive.deep,borderRadius:17,overflow:'hidden',borderWidth:1,borderColor:olive.border}}>
    <Video source={{uri:soundTarget.media_url}} resizeMode={ResizeMode.CONTAIN} style={{flex:1,width:'100%'}} isMuted={false} shouldPlay={Platform.OS!=='web'} useNativeControls isLooping/>
   </View>:<View style={{flex:1,alignItems:'center',justifyContent:'center',backgroundColor:olive.surface,borderRadius:17}}><Text style={{color:olive.muted,fontSize:14}}>Audio preview is available on video posts.</Text></View>}
   <Text style={{color:olive.muted,fontSize:12,lineHeight:19}}>Play the source video to hear its original audio. Copying someone else's audio into a new upload is not supported in this beta.</Text>
   <Pressable accessibilityRole="button" accessibilityLabel="Reference this sound name while creating a post" onPress={()=>{setAudioLabelDraft(soundTarget?.audio_label||'Original Sound');setSoundTarget(null);setTab('Create')}} style={{backgroundColor:olive.accent,paddingVertical:17,paddingHorizontal:16,borderRadius:16}}>
    <Text style={{color:olive.deep,textAlign:'center',fontSize:15,fontWeight:'800'}}>Use sound name as a reference ↗</Text>
   </Pressable>
  </View>
 </View>
</Modal>
 <Modal visible={!!reportTarget} transparent animationType="fade" onRequestClose={()=>setReportTarget(null)}>
  <View style={{flex:1,justifyContent:'center',backgroundColor:'#000c',padding:24}}>
   <View style={{backgroundColor:theme.panel,borderRadius:13,borderWidth:1,borderColor:'#C6AA72',padding:20,gap:13}}>
    <Text style={s.heading}>REPORT CONTENT</Text>
    <Text style={s.muted}>Choose a reason. Reports are private and reviewed; they do not automatically remove content.</Text>
    {([{id:'spam',name:'Spam or deceptive content'},{id:'harassment',name:'Harassment or threats'},{id:'unsafe',name:'Dangerous acts or violence'},{id:'privacy',name:'Privacy or personal information'},{id:'adult',name:'Sexual content or nudity'},{id:'other',name:'Something else'}] as const).map(choice=><Pressable key={choice.id} accessibilityRole="button" disabled={reportBusy} onPress={()=>{void submitReport(choice.id)}} style={s.outline}><Text style={s.link}>{choice.name}</Text></Pressable>)}
    <Pressable style={s.outline} onPress={()=>setReportTarget(null)}><Text style={s.link}>Cancel</Text></Pressable>
   </View>
  </View>
 </Modal>{socialInboxOpen&&supabase&&session?<SocialInbox client={supabase} session={session} initialPeer={socialPeer} onUnreadChange={refreshUnreadMessages} onClose={()=>{setSocialInboxOpen(false);setSocialPeer(null)}} onProfile={peer=>{setSocialInboxOpen(false);setSocialPeer(null);void openCreatorProfile(peer)}} onCreateStory={()=>{setSocialInboxOpen(false);setSocialPeer(null);startStory()}} onDiscover={()=>{setSocialInboxOpen(false);setSocialPeer(null);setTab('Discover')}}/>:null}{inboxOpen&&supabase&&session?<MarketplaceInbox key={session.user.id} client={supabase} session={session} initialThread={marketThread} onClose={()=>setInboxOpen(false)}/>:null}{collection&&supabase?<PostCollection client={supabase} userId={collection.userId} savedIds={collection.liked?likedPostIds:collection.saved?savedPostIds:undefined} onClose={()=>setCollection(null)}/>:null}</SafeAreaView>
}
const s=StyleSheet.create({
 profileAvatarWrap:{position:'absolute',right:0,top:4},
 feedCreatorAvatar:{width:48,height:48,borderRadius:24,borderWidth:2,borderColor:olive.accent,backgroundColor:olive.raised,alignItems:'center',justifyContent:'center',shadowColor:olive.accent,shadowOpacity:.25,shadowRadius:5,elevation:3},
 feedFollowPlus:{position:'absolute',bottom:-6,alignSelf:'center',width:25,height:25,borderRadius:13,backgroundColor:olive.accent,alignItems:'center',justifyContent:'center',borderWidth:2,borderColor:olive.deep},
 profileScreenContent:{paddingBottom:30,backgroundColor:olive.bg},
 profileTopBar:{flexDirection:'row',alignItems:'center',justifyContent:'space-between',minHeight:62,paddingHorizontal:12,backgroundColor:olive.bg,borderBottomWidth:1,borderBottomColor:olive.border},
 profileTopBrand:{flex:1,alignItems:'flex-start',paddingLeft:8},
 profileTopBrandText:{fontSize:15,color:'#F0EEE5',fontWeight:'900',fontStyle:'italic',letterSpacing:.8},
 profileTopBrandSub:{fontSize:8,color:'#C6AA72',fontWeight:'900',letterSpacing:1.8},
 profileTopIcon:{minWidth:39,minHeight:43,alignItems:'center',justifyContent:'center',borderRadius:8},
 profileTopIconText:{fontSize:26,color:'#F0EEE5',fontWeight:'800'},
 profileHeaderBlock:{paddingHorizontal:16,paddingTop:20,paddingBottom:18,backgroundColor:olive.bg},
 profileIdentity:{flexDirection:'row',justifyContent:'space-between',alignItems:'flex-start',gap:11,minHeight:58,paddingRight:92},
 profileIdentityText:{flex:1,justifyContent:'center',gap:5},
 profileIdentityName:{fontSize:20,fontWeight:'900',color:'#F0EEE5',lineHeight:28,letterSpacing:-.6},
 profileIdentityHandle:{fontSize:13,color:'#B7BDBB',fontWeight:'600'},
 profileBadge:{alignSelf:'flex-start',backgroundColor:'#273626',borderColor:'#C6AA72',borderWidth:1,paddingHorizontal:8,paddingVertical:5,borderRadius:5},
 profileBadgeText:{fontSize:9,color:'#E4D5A9',fontWeight:'900',letterSpacing:.7},
 profileIdentityAvatar:{width:88,height:88,borderRadius:44,borderWidth:2,borderColor:'#C6AA72',backgroundColor:'#364836',alignItems:'center',justifyContent:'center',marginRight:0},
 profileIdentityAvatarImage:{width:'100%',height:'100%',borderRadius:44},
 profileIdentityAvatarInitial:{fontSize:43,fontWeight:'900',color:'#F0EEE5'},
 profileAvatarAdd:{position:'absolute',bottom:-2,right:-5,width:34,height:34,borderRadius:17,backgroundColor:'#C6AA72',borderWidth:2,borderColor:'#090C0B',alignItems:'center',justifyContent:'center'},
 profileAvatarAddText:{color:'#101510',fontSize:26,fontWeight:'900',lineHeight:28},
 profileNumbers:{flexDirection:'row',alignItems:'flex-start',justifyContent:'flex-start',gap:18,paddingTop:13,paddingBottom:18,paddingRight:88},
 profileNumberBox:{alignItems:'flex-start',minWidth:48},
 profileNumberValue:{fontSize:22,fontWeight:'900',color:'#F0EEE5',lineHeight:30},
 profileNumberLabel:{fontSize:11,color:'#B7BDBB'},
 profileMainBio:{color:'#F0EEE5',fontSize:14,lineHeight:21,fontWeight:'600',marginTop:6,marginBottom:7},
 profileMetaLine:{fontSize:10,color:'#BAC6AF',fontWeight:'700',marginTop:3,lineHeight:17,letterSpacing:.35},
 profileLink:{color:'#C6AA72',fontSize:12,fontWeight:'900',marginTop:5},
 profileActionRow:{flexDirection:'row',gap:9,marginTop:16,marginBottom:2},
 profileActionPill:{minHeight:36,flex:1,paddingHorizontal:8,justifyContent:'center',alignItems:'center',backgroundColor:'#232D26',borderWidth:1,borderColor:'#5C6D58',borderRadius:24},
 profileActionLabel:{color:'#F0EEE5',fontSize:13,fontWeight:'700',letterSpacing:0,textAlign:'center'},
 profileContentTabs:{flexDirection:'row',backgroundColor:olive.bg,borderBottomWidth:1,borderBottomColor:olive.border,paddingTop:5,minHeight:55},
 profileContentTab:{width:'14.2857%',alignItems:'center',justifyContent:'center',borderBottomWidth:3,borderBottomColor:'transparent',paddingVertical:10},
 profileContentTabActive:{borderBottomColor:olive.gold},
 profileContentTabIcon:{fontSize:24,color:'#88958A',fontWeight:'700'},
 profileContentTabIconActive:{color:'#F0EEE5'},
 profileTileGrid:{flexDirection:'row',flexWrap:'wrap',backgroundColor:olive.bg,width:'100%'},
 profileVideoTile:{width:'33.3333%',aspectRatio:.75,backgroundColor:olive.surface,overflow:'hidden',borderWidth:1,borderColor:olive.bg,position:'relative'},
 profileVideoThumbnail:{width:'100%',height:'100%',backgroundColor:'#202820'},
 profileTileShade:{position:'absolute',left:0,right:0,bottom:0,height:53,backgroundColor:'rgba(0,0,0,.4)'},
 profileViewsBadge:{position:'absolute',bottom:9,left:7},
 profileViewsText:{color:'#fff',fontSize:12,fontWeight:'900',textShadowColor:'#000',textShadowRadius:3},
 profilePinBadge:{position:'absolute',top:7,left:5,backgroundColor:'#101610ce',borderRadius:4,paddingHorizontal:6,paddingVertical:3},
 profilePinText:{fontSize:9,fontWeight:'900',color:'#E4D5A9'},
 profileTileEditTools:{position:'absolute',top:5,right:4,gap:5,alignItems:'flex-end'},
 profileTileTool:{paddingHorizontal:6,paddingVertical:6,borderRadius:4,backgroundColor:'#30383D'},
 profileTileToolText:{fontSize:9,color:'#F0EEE5',fontWeight:'900'},
 profileTabEmpty:{width:'100%',minHeight:170,padding:20,alignItems:'center',justifyContent:'center',gap:10,backgroundColor:olive.bg},
 profileEmptyTitle:{color:olive.text,fontWeight:'700',fontSize:15,textAlign:'center'},
 profileEmptyBody:{color:olive.muted,fontSize:12,textAlign:'center',lineHeight:19},
 profileTabButton:{backgroundColor:'#344C35',padding:13,borderRadius:8,borderWidth:1,borderColor:'#C6AA72',marginTop:8},
 profileLoadMore:{alignSelf:'center',marginVertical:15,backgroundColor:'#263728',borderColor:'#C6AA72',borderWidth:1,borderRadius:10,paddingHorizontal:22,paddingVertical:13},
 profileCloseVideo:{minHeight:45,justifyContent:'center',paddingHorizontal:14,backgroundColor:'#1B261C'},
 profileBelowGrid:{paddingHorizontal:12,paddingTop:19,paddingBottom:16,backgroundColor:olive.bg},
 profileEditorSheet:{padding:18,backgroundColor:olive.bg,paddingBottom:75},
 profileEditTitle:{fontSize:27,color:olive.text,fontWeight:'800',letterSpacing:-.5,marginTop:10},
 profileEditDescription:{fontSize:13,color:olive.muted,lineHeight:20,marginTop:7,marginBottom:21},
 profilePhotoEdit:{alignSelf:'center',alignItems:'center',gap:8,marginVertical:18,minHeight:124,justifyContent:'center'},
 profileEditorAvatar:{width:92,height:92,borderRadius:46,borderColor:olive.accent,borderWidth:2,overflow:'hidden'},
 profileEditPhotoLabel:{fontSize:13,fontWeight:'800',color:olive.accent},
 profileFieldLabel:{fontSize:13,fontWeight:'700',color:olive.text,marginTop:13,marginBottom:2},
 profileHelp:{fontSize:11,lineHeight:17,color:olive.muted,marginVertical:10},
 profileEditExtra:{flexDirection:'row',backgroundColor:olive.surface,borderRadius:15,padding:16,alignItems:'center',justifyContent:'space-between',borderWidth:1,borderColor:olive.border,marginTop:18},
 profileExtraTitle:{fontSize:15,fontWeight:'700',color:olive.text},
 profileExtraSubtitle:{fontSize:11,color:olive.muted,marginTop:4},
 profileExtraArrow:{fontSize:29,color:olive.accent},

 appBackdropImage:{opacity:0.06},

 screenDisplayTitle:{fontSize:29,fontWeight:'800',color:olive.text,letterSpacing:-.5,textAlign:'center',marginBottom:5},
 exploreContent:{paddingBottom:40},
 exploreHeading:{alignItems:'center',paddingTop:13,paddingBottom:10},
 exploreSub:{fontSize:9,color:'#d6dabf',fontWeight:'900',letterSpacing:1.15},
 exploreSearchRow:{flexDirection:'row',alignItems:'center',backgroundColor:olive.surface,borderWidth:1,borderColor:olive.border,borderRadius:13,paddingHorizontal:13,marginVertical:13},
 exploreSearchIcon:{fontSize:25,color:'#c9d2b8'},
 exploreSearch:{flex:1,color:'#f2f2e9',fontSize:12,paddingVertical:13,paddingHorizontal:9,minHeight:46},
 exploreSearchGo:{minWidth:38,minHeight:38,alignItems:'center',justifyContent:'center',backgroundColor:'#3c4b2f',borderRadius:18},
 exploreSearchGoText:{fontSize:22,color:'#e3ebd4'},
 exploreGrid:{flexDirection:'row',flexWrap:'wrap',justifyContent:'space-between',gap:9},
 exploreTile:{width:'48.6%',aspectRatio:1.07,borderRadius:15,borderWidth:1,borderColor:olive.border,overflow:'hidden',backgroundColor:olive.surface},
 exploreTileImage:{width:'100%',height:'100%',justifyContent:'flex-end'},
 exploreTileOverlay:{backgroundColor:'rgba(5,9,5,.62)',padding:11,minHeight:43,flexDirection:'row',alignItems:'center',justifyContent:'space-between'},
 exploreTileLabel:{fontSize:14,fontWeight:'900',color:'#f3f5e9'},
 exploreTileArrow:{fontSize:18,color:'#c3d698'},
 exchangePromo:{backgroundColor:olive.surface,borderColor:olive.border,borderWidth:1,borderRadius:16,padding:19,marginTop:15},
 exchangePromoBig:{fontSize:19,fontWeight:'900',color:'#e7eadc',letterSpacing:.5},
 exchangePromoSmall:{fontSize:9,fontWeight:'900',color:'#b5ca8e',marginTop:8,letterSpacing:.25},
 createContent:{paddingBottom:44},
 cameraStage:{height:550,borderRadius:19,overflow:'hidden',borderColor:olive.border,borderWidth:1,justifyContent:'space-between',backgroundColor:olive.deep},
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
 recordOuter:{width:96,height:100,alignItems:'center',justifyContent:'center',paddingBottom:14,position:'relative'},
 grenadePinRing:{position:'absolute',width:22,height:22,borderRadius:12,borderWidth:4,borderColor:'#c6cbb9',top:0,right:10,backgroundColor:'transparent'},
 grenadePinStem:{position:'absolute',width:22,height:13,borderTopLeftRadius:4,borderTopRightRadius:4,backgroundColor:'#b6bea9',top:13,left:37,borderWidth:2,borderColor:'#d9dfcd'},
 grenadeLever:{position:'absolute',width:9,height:49,borderRadius:3,backgroundColor:'#8f9b82',top:12,right:10,transform:[{rotate:'-16deg'}],borderColor:'#d8dfcd',borderWidth:1},
 grenadeBody:{width:78,height:78,borderRadius:40,backgroundColor:'rgba(5,12,8,.56)',borderColor:olive.text,borderWidth:4,alignItems:'center',justifyContent:'center',shadowColor:'#000',shadowOpacity:.35,shadowRadius:8,elevation:3},
 grenadeSeamHorizontal:{position:'absolute',top:29,left:0,right:0,height:5,backgroundColor:'#151d13',borderTopColor:'#93a388',borderTopWidth:1},
 grenadeSeamVertical:{position:'absolute',left:29,top:0,bottom:0,width:5,backgroundColor:'#182517',borderLeftWidth:1,borderLeftColor:'#788b70'},
 recordInner:{width:58,height:58,borderRadius:30,backgroundColor:'#CA4052',borderWidth:2,borderColor:'#f6e8e6',shadowColor:'#000',shadowOpacity:.4,shadowRadius:6,elevation:2},
 grenadeLabel:{position:'absolute',bottom:-9,fontSize:10,fontWeight:'800',color:olive.text,backgroundColor:olive.deep,overflow:'hidden',paddingHorizontal:10,paddingVertical:5,borderRadius:9,letterSpacing:.6,borderWidth:1,borderColor:olive.border},
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
 heroTitle:{color:olive.text,fontWeight:'800',fontSize:36,lineHeight:41,letterSpacing:-.6,textShadowColor:'#000c',textShadowRadius:7,marginBottom:13},
 heroBody:{color:olive.text,fontWeight:'500',fontSize:15,lineHeight:23,textShadowColor:'#000',textShadowRadius:5,marginBottom:15,maxWidth:390},
 emptyHero:{borderRadius:20,overflow:'hidden',marginTop:13,minHeight:355,borderWidth:1,borderColor:olive.border,justifyContent:'flex-end',backgroundColor:olive.surface},
 emptyHeroImage:{borderRadius:15},
 emptyHeroShade:{padding:24,paddingTop:125,backgroundColor:'rgba(15,33,19,.73)',alignItems:'flex-start'},
 sectionHero:{minHeight:160,borderRadius:19,overflow:'hidden',marginTop:12,marginBottom:16,borderWidth:1,borderColor:olive.border,justifyContent:'flex-end',backgroundColor:olive.surface},
 sectionHeroImage:{borderRadius:12},
 sectionHeroInner:{padding:19,paddingTop:32,backgroundColor:'rgba(4,9,5,.59)'},
 sectionHeroTitle:{fontWeight:'800',letterSpacing:-.4,fontSize:29,color:olive.text,lineHeight:34,textShadowColor:'#000',textShadowRadius:7},
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
navOuter:{backgroundColor:olive.bg,paddingHorizontal:4,paddingTop:3,paddingBottom:5,borderTopWidth:1,borderTopColor:'#ffffff22'},
navItemActive:{backgroundColor:olive.surface,borderRadius:12},
navIconActive:{color:olive.accent},
navLabelActive:{color:olive.accent,fontWeight:'800'},
safe:{flex:1,backgroundColor:olive.bg},
header:{minHeight:72,paddingVertical:10,flexDirection:'row',alignItems:'center',justifyContent:'space-between',borderBottomWidth:1,borderBottomColor:olive.border,backgroundColor:olive.bg},
logo:{fontSize:24,fontWeight:'800',letterSpacing:-.7,color:olive.text},
tagline:{fontSize:8,fontWeight:'900',color:theme.purple,marginTop:1,letterSpacing:1.2},
body:{flex:1,paddingTop:6},
heading:{fontSize:27,fontWeight:'800',letterSpacing:-.6,color:theme.text,marginTop:12,marginBottom:13},
subheading:{fontSize:21,fontWeight:'800',letterSpacing:-.3,color:theme.text,marginTop:24,marginBottom:12},
muted:{fontSize:13,color:theme.muted,lineHeight:21},
input:{backgroundColor:olive.deep,borderWidth:1,borderColor:olive.border,borderRadius:12,paddingHorizontal:16,paddingVertical:14,color:theme.text,marginVertical:8,fontSize:15,minHeight:50},
card:{backgroundColor:olive.surface,borderColor:olive.border,borderWidth:1,borderRadius:18,overflow:'hidden',marginVertical:10,padding:19,shadowColor:'#000',shadowOpacity:.13,shadowRadius:9,elevation:2},
row:{flexDirection:'row',alignItems:'center',gap:10,marginBottom:10,flexWrap:'wrap'},
avatar:{width:38,height:38,borderRadius:19,backgroundColor:'#263321',borderWidth:1,borderColor:theme.purple,alignItems:'center',justifyContent:'center'},
avatarText:{fontWeight:'900',color:theme.pink,fontSize:16},
strong:{color:theme.text,fontWeight:'900',fontSize:14,letterSpacing:.1},
link:{color:theme.pink,fontWeight:'900',fontSize:12,letterSpacing:.25},
caption:{color:theme.text,fontSize:14,lineHeight:21,marginBottom:10},
media:{width:'100%',backgroundColor:'#0a0d09',borderRadius:6},
feedTop:{position:'absolute',top:0,left:0,right:0,height:56,justifyContent:'center',backgroundColor:olive.bg,zIndex:12,elevation:12},
feedNavRow:{flexDirection:'row',width:'100%',alignItems:'center',justifyContent:'space-between',paddingHorizontal:9},
 feedUtilityButton:{width:45,height:44,alignItems:'center',justifyContent:'center',borderRadius:22},
 feedUtilityIcon:{fontSize:26,fontWeight:'700',color:'#fff',textShadowColor:'#000',textShadowRadius:5},
 feedMainTabs:{flex:1,flexDirection:'row',alignItems:'center',justifyContent:'center',gap:7},
 feedMainTabButton:{minWidth:81,height:51,paddingHorizontal:4,alignItems:'center',justifyContent:'center'},
 feedMainTabText:{fontSize:16,fontWeight:'600',color:'#ffffffac',textShadowColor:'#0009',textShadowRadius:4},
 feedMainTabActive:{color:'#fff',fontWeight:'800'},
 feedMainDivider:{width:1,height:16,backgroundColor:'#ffffff5c'},
 feedActiveIndicator:{position:'absolute',bottom:3,width:29,height:3,borderRadius:3,backgroundColor:olive.accent},
feedTabButton:{minWidth:0,flexShrink:1,minHeight:44,alignItems:'center',justifyContent:'center',paddingHorizontal:0},
feedTabs:{flexDirection:'row',alignItems:'center',justifyContent:'space-around',gap:10,paddingVertical:10,backgroundColor:olive.surface,borderRadius:12,borderWidth:1,borderColor:olive.border},
feedTab:{fontSize:15,fontWeight:'600',color:olive.muted,letterSpacing:0},
feedTabActive:{color:olive.text,borderBottomWidth:2,borderBottomColor:olive.gold,paddingBottom:4},
feedDivider:{height:12,width:1,backgroundColor:theme.line},
feedSearch:{backgroundColor:'#1b241c',borderWidth:1,borderColor:'#596c51',borderRadius:10,paddingHorizontal:14,paddingVertical:11,color:theme.text,fontSize:13,marginVertical:3},
feedLoading:{flex:1,alignItems:'center',justifyContent:'center',gap:12},
videoPage:{width:'100%',backgroundColor:olive.deep,borderRadius:0,overflow:'hidden',marginBottom:0,position:'relative',borderWidth:0},
videoCanvas:{...StyleSheet.absoluteFillObject,backgroundColor:'#060806'},
fullMedia:{width:'100%',height:'100%',backgroundColor:'#060806'},
videoShade:{...StyleSheet.absoluteFillObject,backgroundColor:'transparent'},
 feedPausedIndicator:{position:'absolute',alignSelf:'center',top:'43%',width:68,height:68,borderRadius:35,backgroundColor:'rgba(5,12,8,.62)',alignItems:'center',justifyContent:'center',zIndex:6},
 feedPausedGlyph:{color:'#fff',fontSize:30,marginLeft:5},
 feedProgressTrack:{position:'absolute',bottom:0,left:0,right:0,height:3,backgroundColor:'#ffffff4a',zIndex:9},
 feedProgressFill:{height:'100%',backgroundColor:olive.accent},
videoTopBadge:{display:'none'},
videoBadgeText:{color:'#e7ebd7',fontSize:9,fontWeight:'900',letterSpacing:1.2,backgroundColor:'rgba(6,11,7,.85)',paddingHorizontal:12,paddingVertical:9,borderRadius:8,overflow:'hidden',borderWidth:1,borderColor:'#a8bc835c'},
videoInfo:{position:'absolute',left:16,right:80,bottom:35,gap:8},
videoCreator:{color:'#fff',fontSize:19,fontWeight:'800',textShadowColor:'#000',textShadowRadius:8,letterSpacing:-.3},
videoCaption:{color:'#fff',fontSize:15,fontWeight:'500',lineHeight:22,textShadowColor:'#000',textShadowRadius:8},
videoMeta:{color:olive.accent,fontSize:11,fontWeight:'700',textShadowColor:'#000',textShadowRadius:6},
videoActions:{position:'absolute',right:12,bottom:30,alignItems:'center',gap:13},
actionButton:{alignItems:'center',justifyContent:'center',minWidth:44,minHeight:44,gap:2,backgroundColor:'transparent',borderRadius:13,paddingVertical:1},
actionIcon:{fontSize:25,fontWeight:'900',color:'#fff',textShadowColor:'#000',textShadowRadius:6},
actionCount:{fontSize:11,fontWeight:'800',color:'#fff',textShadowColor:'#000',textShadowRadius:6},
followDisc:{width:29,height:29,borderRadius:9,backgroundColor:theme.purple,alignItems:'center',justifyContent:'center',borderWidth:2,borderColor:'#fff'},
followDiscText:{color:'#111510',fontSize:19,fontWeight:'900',marginTop:-2},
rowActions:{flexDirection:'row',justifyContent:'space-around',flexWrap:'wrap',gap:12,paddingTop:14,paddingBottom:3},
empty:{alignItems:'center',padding:25,backgroundColor:theme.panel,borderRadius:14,marginTop:18,gap:8,borderWidth:1,borderColor:theme.line},
button:{backgroundColor:theme.purple,paddingHorizontal:18,paddingVertical:15,borderRadius:12,alignItems:'center',justifyContent:'center',marginVertical:10,minHeight:50,borderWidth:1,borderColor:theme.purple},
buttonText:{color:olive.deep,fontWeight:'800',letterSpacing:.1,fontSize:14},
outline:{borderWidth:1,borderColor:olive.border,backgroundColor:olive.surface,paddingHorizontal:16,paddingVertical:14,borderRadius:12,alignItems:'center',justifyContent:'center',marginVertical:6,minHeight:49},
picker:{backgroundColor:'#1b251b',borderWidth:1,borderColor:'#99b181',borderStyle:'dashed',borderRadius:13,minHeight:112,alignItems:'center',justifyContent:'center',marginVertical:14,gap:8,padding:16},
preview:{width:'100%',aspectRatio:4/3,borderRadius:13,marginVertical:10},
rule:{height:1,backgroundColor:theme.line,marginVertical:22},
chip:{paddingHorizontal:14,paddingVertical:10,borderRadius:19,backgroundColor:olive.surface,borderWidth:1,borderColor:olive.border,marginRight:8,marginVertical:6},
selected:{borderColor:olive.accent,backgroundColor:olive.raised},
chipText:{color:theme.text,fontSize:12,fontWeight:'800',letterSpacing:.2},
profile:{alignItems:'center',padding:25,backgroundColor:'#1e281d',borderRadius:16,marginTop:12,gap:9,borderWidth:1,borderColor:'#8a9b70'},
nav:{flexDirection:'row',backgroundColor:olive.deep,borderTopWidth:1,borderColor:'#ffffff33',paddingTop:6,paddingBottom:6,paddingHorizontal:6},
navItem:{flex:1,alignItems:'center',justifyContent:'center',gap:3,minHeight:54,paddingHorizontal:1,borderRadius:12},
navIcon:{fontSize:24,color:'#ccd4bf'},
navCreateItem:{backgroundColor:olive.accent,flex:0.8,minHeight:42,marginVertical:6,marginHorizontal:7,borderWidth:1,borderColor:olive.accent,borderRadius:14,shadowColor:olive.accent,shadowOpacity:.23,shadowRadius:7,elevation:3},
navCreateGlyph:{fontSize:31,color:'#F0EEE5',fontWeight:'900'},
navLabel:{fontSize:11,color:olive.muted,fontWeight:'600',letterSpacing:.1},
});
