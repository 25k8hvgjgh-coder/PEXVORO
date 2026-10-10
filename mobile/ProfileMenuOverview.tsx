import React from 'react';
import {Image,Pressable,StyleSheet,Text,View} from 'react-native';
import ProfileIcon from './ProfileIcon';

type Props={
 displayName:string;username:string;avatarUrl?:string|null;
 onClose:()=>void;onEdit:()=>void;onAnalytics:()=>void;onSaved:()=>void;
 onMyPosts:()=>void;onInbox:()=>void;onMarketplace:()=>void;onShare:()=>void;
 onReportIssue:()=>void;onTesterReports:()=>void;
};
export default function ProfileMenuOverview({displayName,username,avatarUrl,onClose,onEdit,onAnalytics,onSaved,onMyPosts,onInbox,onMarketplace,onShare,onReportIssue,onTesterReports}:Props){
 return <View>
  <View style={s.top}>
   <View><Text style={s.eyebrow}>RECONFEED</Text><Text style={s.title}>Settings & activity</Text></View>
   <Pressable accessibilityRole="button" accessibilityLabel="Close profile settings menu" onPress={onClose} style={s.close}><Text style={s.closeText}>✕</Text></Pressable>
  </View>
  <View style={s.account}>
   <View style={s.avatar}>{avatarUrl?<Image source={{uri:avatarUrl}} style={s.avatarImage}/>:<Text style={s.avatarText}>{(displayName||'R').charAt(0).toUpperCase()}</Text>}</View>
   <View style={{flex:1}}><Text numberOfLines={1} style={s.displayName}>{displayName}</Text><Text style={s.handle}>@{username}</Text></View>
  </View>
  <Text style={s.section}>CREATOR TOOLS</Text>
  <View style={s.grid}>
   <Pressable accessibilityRole="button" style={s.tile} onPress={onEdit}><ProfileIcon name="pencil" size={24}/><Text style={s.tileLabel}>Edit profile</Text></Pressable>
   <Pressable accessibilityRole="button" style={s.tile} onPress={onAnalytics}><ProfileIcon name="footprints" size={24}/><Text style={s.tileLabel}>Analytics</Text></Pressable>
   <Pressable accessibilityRole="button" style={s.tile} onPress={onSaved}><ProfileIcon name="bookmark" size={24}/><Text style={s.tileLabel}>Saved posts</Text></Pressable>
  </View>
  <Text style={s.section}>MY ACTIVITY</Text>
  <MenuRow icon="grid" label="My posts" action={onMyPosts}/>
  <MenuRow icon="inbox" label="Market messages" action={onInbox}/>
  <MenuRow icon="photos" label="Marketplace" action={onMarketplace}/>
  <MenuRow icon="adduser" label="Share profile" action={onShare}/>
  <Text style={s.section}>HELP & BETA TESTING</Text>
  <MenuRow icon="footprints" label="Report an app issue" action={onReportIssue}/>
  <MenuRow icon="photos" label="Tester reports & screenshots" action={onTesterReports}/>
  <Text style={s.section}>ACCOUNT & PRIVACY</Text>
 </View>
}
function MenuRow({icon,label,action}:{icon:'grid'|'inbox'|'photos'|'adduser'|'footprints';label:string;action:()=>void}){
 return <Pressable style={s.item} accessibilityRole="button" accessibilityLabel={label} onPress={action}><ProfileIcon name={icon} size={22}/><Text style={s.itemText}>{label}</Text><Text style={s.chevron}>›</Text></Pressable>;
}
const s=StyleSheet.create({
 top:{flexDirection:'row',justifyContent:'space-between',alignItems:'center',paddingTop:12,paddingBottom:16},
 eyebrow:{fontSize:10,color:'#C6AA72',fontWeight:'900',letterSpacing:1.8},
 title:{fontSize:25,fontWeight:'900',color:'#F0EEE5',marginTop:5},
 close:{width:44,height:44,borderRadius:22,alignItems:'center',justifyContent:'center',backgroundColor:'#263027'},
 closeText:{color:'#F0EEE5',fontSize:20,fontWeight:'800'},
 account:{flexDirection:'row',alignItems:'center',padding:14,gap:12,borderRadius:16,backgroundColor:'#1D2921',borderWidth:1,borderColor:'#40513F',marginBottom:19},
 avatar:{width:52,height:52,borderRadius:26,backgroundColor:'#344436',borderWidth:2,borderColor:'#C6AA72',alignItems:'center',justifyContent:'center',overflow:'hidden'},
 avatarImage:{height:'100%',width:'100%',borderRadius:26},avatarText:{color:'#F0EEE5',fontSize:24,fontWeight:'900'},
 displayName:{fontSize:16,color:'#F0EEE5',fontWeight:'900'},handle:{fontSize:12,color:'#B7BDBB',marginTop:4},
 section:{fontSize:11,color:'#C6AA72',fontWeight:'900',letterSpacing:1.6,marginTop:18,marginBottom:12},
 grid:{flexDirection:'row',gap:10},
 tile:{flex:1,minWidth:0,backgroundColor:'#1D2921',borderWidth:1,borderColor:'#394A3B',borderRadius:13,minHeight:91,alignItems:'center',justifyContent:'center',padding:8,gap:10},
 tileLabel:{color:'#F0EEE5',fontSize:11,fontWeight:'800',textAlign:'center'},
 item:{flexDirection:'row',minHeight:54,alignItems:'center',paddingHorizontal:14,gap:14,backgroundColor:'#1D2921',borderBottomWidth:1,borderBottomColor:'#344136'},
 itemText:{flex:1,color:'#F0EEE5',fontSize:14,fontWeight:'700'},chevron:{fontSize:24,color:'#B7BDBB'}
});
