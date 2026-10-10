import React from 'react';
import {Image,Pressable,StyleSheet,Text,View} from 'react-native';
import ProfileIcon from './ProfileIcon';
import {olive} from './oliveTheme';

type Stats={following:number;followers:number;likes:number};
type Profile={display_name?:string|null;username?:string|null;avatar_url?:string|null;bio?:string|null;is_beta_tester?:boolean|null};
type Props={
 profile:Profile|null|undefined;email?:string;stats:Stats;
 isBetaTester:boolean;pronouns?:string;websiteUrl?:string;
 onSettings:()=>void;onEdit:()=>void;onAnalytics:()=>void;onDiscover:()=>void;
 onChangePhoto:()=>void;onCreate:()=>void;onShare:()=>void;onMarket:()=>void;
 onConnections:(which:'following'|'followers')=>void;onWebsite:()=>void;
};
export default function CreatorProfileHeader({profile,email,stats,isBetaTester,pronouns,websiteUrl,onSettings,onEdit,onAnalytics,onDiscover,onChangePhoto,onCreate,onMarket,onConnections,onWebsite}:Props){
 const displayName=profile?.display_name||email?.split('@')[0]||'ReconFeed Creator';
 const handle=profile?.username||'creator';
 return <View style={s.page}>
  <View style={s.topBar}>
   <View style={s.topActions}>
    <Pressable accessibilityRole="button" accessibilityLabel="Edit profile" onPress={onEdit} style={s.topIcon}><ProfileIcon name="pencil" color={olive.text} size={25}/></Pressable>
    <Pressable accessibilityRole="button" accessibilityLabel="ReconFeed Studio" onPress={onAnalytics} style={s.topIcon}><Text style={s.studioGlyph}>✦</Text></Pressable>
   </View>
   <View style={s.topActions}>
    <Pressable accessibilityRole="button" accessibilityLabel="Creator analytics" onPress={onAnalytics} style={s.topIcon}><ProfileIcon name="footprints" color={olive.text} size={25}/></Pressable>
    <Pressable accessibilityRole="button" accessibilityLabel="Find other creators" onPress={onDiscover} style={s.topIcon}><ProfileIcon name="adduser" color={olive.text} size={26}/></Pressable>
    <Pressable accessibilityRole="button" accessibilityLabel="Open three-line profile menu" onPress={onSettings} style={s.topIcon}><ProfileIcon name="menu" color={olive.text} size={28}/></Pressable>
   </View>
  </View>
  <View style={s.header}>
   <View style={s.identityRow}>
    <View style={s.identityText}>
     <Pressable accessibilityRole="button" accessibilityLabel="Open account settings" onPress={onSettings}>
      <Text style={s.displayName} numberOfLines={2}>{displayName} <Text style={s.downArrow}>⌄</Text></Text>
     </Pressable>
     <View style={s.handleRow}><Text numberOfLines={1} style={s.handle}>@{handle}</Text>{(isBetaTester||profile?.is_beta_tester===true)&&<Text accessibilityLabel="Verified beta tester">👨‍💻</Text>}</View>
     <View style={s.stats}>
      <Pressable style={s.stat} accessibilityRole="button" accessibilityLabel="Following accounts" onPress={()=>onConnections('following')}><Text style={s.statValue}>{stats.following.toLocaleString()}</Text><Text style={s.statLabel}>Following</Text></Pressable>
      <Pressable style={s.stat} accessibilityRole="button" accessibilityLabel="Followers" onPress={()=>onConnections('followers')}><Text style={s.statValue}>{stats.followers.toLocaleString()}</Text><Text style={s.statLabel}>Followers</Text></Pressable>
      <Pressable style={s.stat} accessibilityRole="button" accessibilityLabel="Likes and analytics" onPress={onAnalytics}><Text style={s.statValue}>{stats.likes.toLocaleString()}</Text><Text style={s.statLabel}>Likes</Text></Pressable>
     </View>
    </View>
    <View style={s.avatarWrap}>
     <Pressable accessibilityRole="button" accessibilityLabel="Change profile picture" onPress={onChangePhoto} style={s.avatar}>
      {profile?.avatar_url?<Image source={{uri:profile.avatar_url}} style={s.avatarImage}/>:<Text style={s.avatarInitial}>{displayName.charAt(0).toUpperCase()}</Text>}
     </Pressable>
     <Pressable accessibilityRole="button" accessibilityLabel="Create a post" onPress={onCreate} style={s.avatarAdd}><Text style={s.plus}>+</Text></Pressable>
    </View>
   </View>
   <Text style={s.bio}>{profile?.bio||'Add a bio to tell your story.'}</Text>
   {!!pronouns&&<Text style={s.meta}>{pronouns}</Text>}
   {!!websiteUrl&&<Pressable accessibilityRole="link" onPress={onWebsite}><Text style={s.website}>⌁ {websiteUrl} ↗</Text></Pressable>}
   <View style={s.actions}>
    <Pressable accessibilityRole="button" onPress={onAnalytics} style={s.pill}><Text style={s.pillText}>✦ ReconFeed Studio</Text></Pressable>
    <Pressable accessibilityRole="button" onPress={onMarket} style={s.pill}><Text style={s.pillText}>▣ Marketplace</Text></Pressable>
   </View>
  </View>
 </View>;
}
const s=StyleSheet.create({
 page:{backgroundColor:olive.bg},
 topBar:{flexDirection:'row',alignItems:'center',justifyContent:'space-between',paddingHorizontal:11,minHeight:68,backgroundColor:olive.bg},
 topActions:{flexDirection:'row',alignItems:'center',gap:2},
 topIcon:{width:41,minHeight:52,alignItems:'center',justifyContent:'center'},
 studioGlyph:{fontSize:20,color:olive.gold,fontWeight:'900'},
 header:{backgroundColor:olive.bg,paddingHorizontal:14,paddingTop:14,paddingBottom:20},
 identityRow:{flexDirection:'row',alignItems:'flex-start',gap:8},
 identityText:{flex:1,minWidth:0,paddingTop:1},
 displayName:{fontSize:21,color:olive.text,fontWeight:'900',lineHeight:27},
 downArrow:{fontSize:22,color:olive.text},
 handleRow:{flexDirection:'row',alignItems:'center',gap:5,marginTop:3},
 handle:{fontSize:14,color:olive.muted,fontWeight:'600',flexShrink:1},
 stats:{flexDirection:'row',justifyContent:'flex-start',gap:15,marginTop:20},
 stat:{alignItems:'flex-start',minWidth:0},
 statValue:{fontSize:21,color:olive.text,fontWeight:'900',lineHeight:26},
 statLabel:{fontSize:12,color:olive.muted},
 avatarWrap:{position:'relative',marginTop:5,marginBottom:5},
 avatar:{height:96,width:96,borderRadius:48,backgroundColor:olive.raised,alignItems:'center',justifyContent:'center',overflow:'hidden'},
 avatarImage:{height:'100%',width:'100%',borderRadius:48},
 avatarInitial:{fontSize:41,color:olive.text,fontWeight:'900'},
 avatarAdd:{position:'absolute',right:-3,bottom:-4,width:33,height:33,borderRadius:17,alignItems:'center',justifyContent:'center',backgroundColor:olive.accent,borderWidth:3,borderColor:olive.bg},
 plus:{fontSize:26,color:olive.deep,fontWeight:'900',lineHeight:27},
 bio:{fontSize:14,color:olive.text,lineHeight:21,marginTop:10,fontWeight:'600'},
 meta:{fontSize:12,color:olive.muted,marginTop:5,fontWeight:'600'},
 website:{fontSize:12,color:olive.gold,fontWeight:'800',marginTop:7},
 actions:{flexDirection:'row',gap:9,marginTop:17},
 pill:{paddingHorizontal:12,paddingVertical:10,borderWidth:1,borderColor:olive.border,backgroundColor:olive.surface,borderRadius:28,alignItems:'center',justifyContent:'center',minHeight:42},
 pillText:{fontSize:13,color:olive.text,fontWeight:'800'}
});
