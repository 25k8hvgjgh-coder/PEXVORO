import React from 'react';
import {Pressable,SafeAreaView,ScrollView,StyleSheet,Text,View} from 'react-native';
import ProfileIcon,{type ProfileIconName} from './ProfileIcon';
import {olive} from './oliveTheme';

export type SettingsAction=
 'manage_posts'|'content_preferences'|'live'|'notifications'|'wellbeing'|'family'
 |'account'|'security'|'orders'|'share'|'private'|'blocked'
 |'comments'|'mentions'|'messages'|'reuse'|'shared_links'|'downloads'
 |'following'|'liked'|'viewers'|'music'|'inbox'|'activity'|'audience'|'ads'
 |'playback'|'language'|'display'|'accessibility'|'contacts'
 |'offline'|'storage'|'data_saver'|'help'|'privacy'|'terms'|'legal_center'
 |'switch_account'|'logout'|'report_issue'|'tester_reports'|'delete_account';

type Item={id:SettingsAction;name:string;symbol:string;icon?:ProfileIconName};
type Group={heading:string;items:Item[]};
const groups:Group[]=[
 {heading:'Activity',items:[
  {id:'manage_posts',name:'Manage posts',symbol:'▣',icon:'grid'},
  {id:'content_preferences',name:'Content preferences',symbol:'▤'},
  {id:'live',name:'LIVE',symbol:'▷'},
  {id:'notifications',name:'Notifications',symbol:'♧'},
  {id:'wellbeing',name:'Time and well-being',symbol:'⌛'},
  {id:'family',name:'Family Pairing',symbol:'⌂'},
 ]},
 {heading:'Account',items:[
  {id:'account',name:'Account',symbol:'♙',icon:'user'},
  {id:'security',name:'Security & permissions',symbol:'⬡',icon:'lock'},
  {id:'delete_account',name:'Delete account & associated data',symbol:'×',icon:'lock'},
  {id:'orders',name:'Your orders',symbol:'▣'},
  {id:'share',name:'Share profile',symbol:'➚',icon:'adduser'}
 ]},
 {heading:'Visibility',items:[
  {id:'private',name:'Private account',symbol:'▣',icon:'lock'},
  {id:'blocked',name:'Blocked accounts',symbol:'⊘'}
 ]},
 {heading:'Interactions',items:[
  {id:'comments',name:'Comments',symbol:'◉'},
  {id:'mentions',name:'Mentions',symbol:'@'},
  {id:'messages',name:'Direct messages',symbol:'➤',icon:'inbox'},
  {id:'reuse',name:'Reuse of content',symbol:'▧'},
  {id:'shared_links',name:'Display profile when sharing links',symbol:'⌁'},
  {id:'downloads',name:'Downloads',symbol:'↓'},
  {id:'following',name:'Following list',symbol:'♙',icon:'users'},
  {id:'liked',name:'Liked videos',symbol:'♥',icon:'heart'},
  {id:'viewers',name:'Viewers',symbol:'◉',icon:'footprints'}
 ]},
 {heading:'Preferences',items:[
  {id:'music',name:'Music',symbol:'♫'},
  {id:'inbox',name:'Inbox & Messaging',symbol:'↔',icon:'inbox'},
  {id:'activity',name:'Activity center',symbol:'◷'},
  {id:'audience',name:'Audience control',symbol:'♙',icon:'users'},
  {id:'ads',name:'Ads',symbol:'⚑'},
  {id:'playback',name:'Playback',symbol:'▣'},
  {id:'language',name:'Language',symbol:'A'},
  {id:'display',name:'Display',symbol:'◐'},
  {id:'accessibility',name:'Accessibility',symbol:'✣'},
  {id:'contacts',name:'Contacts and location',symbol:'♙'}
 ]},
 {heading:'Cache & Cellular',items:[
  {id:'offline',name:'Offline videos',symbol:'↓'},
  {id:'storage',name:'Free up space',symbol:'▤'},
  {id:'data_saver',name:'Data Saver',symbol:'◈'}
 ]},
 {heading:'Support & About',items:[
  {id:'help',name:'Help Center',symbol:'?'},
  {id:'privacy',name:'Privacy Center',symbol:'▣',icon:'lock'},
  {id:'legal_center',name:'Legal & Intellectual Property',symbol:'§'},
  {id:'terms',name:'Terms and Policies',symbol:'ⓘ'}
 ]},
 {heading:'Login',items:[
  {id:'switch_account',name:'Switch account',symbol:'⇄'},
  {id:'logout',name:'Log out',symbol:'↪'}
 ]},
 {heading:'ReconFeed Beta',items:[
  {id:'report_issue',name:'Report an app issue',symbol:'⚑'},
  {id:'tester_reports',name:'Tester reports & screenshots',symbol:'▧'}
 ]}
];

export default function SettingsPrivacyPage({onBack,onSelect,isPrivate,commentVisibility}:{
 onBack:()=>void;onSelect:(action:SettingsAction)=>void;isPrivate:boolean;commentVisibility:string;
}){
 return <SafeAreaView style={s.safe}>
  <View style={s.nav}>
   <Pressable accessibilityRole="button" accessibilityLabel="Back to profile menu" style={s.back} onPress={onBack}><Text style={s.backText}>‹</Text></Pressable>
   <Text style={s.navTitle}>ReconFeed settings</Text>
   <View style={s.back}/>
  </View>
  <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={s.scroll}>
   <Text style={s.pageTitle}>Settings and privacy</Text><Text style={s.pageIntro}>Make your space feel like yours. You're in control of what you share and see.</Text>
   {groups.map(group=><View key={group.heading} style={s.section}>
    <Text style={s.sectionTitle}>{group.heading}</Text>
    <View style={s.groupCard}>
     {group.items.map((item,i)=>{
      const value=item.id==='private'?(isPrivate?'On':'Off'):item.id==='comments'?(commentVisibility==='none'?'Nobody':commentVisibility==='followers'?'Followers':'Everyone'):undefined;
      return <Pressable key={item.id} accessibilityRole="button" accessibilityLabel={item.name} style={({pressed})=>[s.item,i===0&&s.firstItem,i===group.items.length-1&&s.lastItem,pressed&&s.itemPressed]} onPress={()=>onSelect(item.id)}>
       <View style={s.symbolBox}>{item.icon?<ProfileIcon name={item.icon} size={20} color={olive.muted}/>:<Text style={s.symbol}>{item.symbol}</Text>}</View>
       <Text style={s.itemLabel} numberOfLines={2}>{item.name}</Text>
       {!!value&&<Text style={s.valueText}>{value}</Text>}
       <Text style={s.chevron}>›</Text>
      </Pressable>
     })}
    </View>
   </View>)}
   <Text style={s.footer}>ReconFeed · Veteran owned · 18+\nSome options are being developed during beta. Unavailable features will tell you before taking any action.</Text>
  </ScrollView>
 </SafeAreaView>;
}
const s=StyleSheet.create({
 safe:{flex:1,backgroundColor:olive.bg},
 nav:{height:58,flexDirection:'row',alignItems:'center',justifyContent:'space-between',paddingHorizontal:16,backgroundColor:olive.bg,borderBottomWidth:1,borderBottomColor:olive.border},
 back:{width:44,height:48,justifyContent:'center',alignItems:'flex-start'},
 backText:{fontSize:42,fontWeight:'300',lineHeight:47,color:olive.text},
 navTitle:{fontSize:16,color:olive.text,fontWeight:'700',letterSpacing:-.2},
 scroll:{paddingBottom:70,paddingTop:10},
 pageTitle:{fontSize:28,fontWeight:'800',letterSpacing:-.65,color:olive.text,paddingHorizontal:21,paddingTop:14,paddingBottom:5},
 pageIntro:{fontSize:14,lineHeight:21,color:olive.muted,paddingHorizontal:21,paddingBottom:22,maxWidth:450},
 section:{marginBottom:22},
 sectionTitle:{fontSize:12,color:olive.muted,fontWeight:'700',letterSpacing:1,textTransform:'uppercase',paddingHorizontal:22,paddingVertical:11},
 groupCard:{marginHorizontal:12,borderRadius:17,overflow:'hidden',backgroundColor:olive.surface,borderWidth:1,borderColor:olive.border},
 item:{flexDirection:'row',alignItems:'center',backgroundColor:olive.surface,minHeight:60,paddingLeft:16,paddingRight:16,borderBottomWidth:1,borderBottomColor:olive.border},
 firstItem:{paddingTop:3},lastItem:{paddingBottom:3},
 symbolBox:{width:25,marginRight:11,justifyContent:'center',alignItems:'center'},
 symbol:{fontSize:22,fontWeight:'700',color:olive.muted,textAlign:'center'},
 itemLabel:{color:olive.text,fontSize:15,fontWeight:'600',flex:1,letterSpacing:-.12},
 itemPressed:{backgroundColor:olive.raised,opacity:.88},
 valueText:{fontSize:14,color:olive.muted,marginLeft:5,marginRight:7},
 chevron:{fontSize:25,color:olive.muted,fontWeight:'300',lineHeight:32,marginLeft:5},
 footer:{textAlign:'center',fontSize:12,color:olive.muted,lineHeight:20,marginHorizontal:21,marginTop:13}
});
