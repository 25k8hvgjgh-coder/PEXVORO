import React from 'react';
import {Image,Pressable,StyleSheet,Text,View} from 'react-native';
import ProfileIcon from './ProfileIcon';

type Stats={following:number;followers:number;likes:number};
type Profile={display_name?:string|null;username?:string|null;avatar_url?:string|null;bio?:string|null;is_beta_tester?:boolean|null};
type Props={
 profile:Profile|null|undefined;email?:string;stats:Stats;
 isBetaTester:boolean;pronouns?:string;websiteUrl?:string;
 onSettings:()=>void;onEdit:()=>void;onAnalytics:()=>void;onDiscover:()=>void;
 onChangePhoto:()=>void;onCreate:()=>void;onShare:()=>void;onMarket:()=>void;
 onConnections:(which:'following'|'followers')=>void;onWebsite:()=>void;
};

export default function CreatorProfileHeader({profile,email,stats,isBetaTester,pronouns,websiteUrl,onSettings,onEdit,onAnalytics,onDiscover,onChangePhoto,onCreate,onShare,onMarket,onConnections,onWebsite}:Props){
 const displayName=profile?.display_name||email?.split('@')[0]||'ReconFeed Creator';
 const handle=profile?.username||'creator';
 return <View>
  <View style={s.topBar}>
   <Pressable onPress={onSettings} accessibilityRole="button" accessibilityLabel="Open account menu" style={s.account}><Text style={s.accountLabel} numberOfLines={1}>@{handle} ⌄</Text></Pressable>
   <Text style={s.brand}>RECON<Text style={s.brandGold}>FEED</Text></Text>
   <View style={s.topActions}>
    <Pressable onPress={onAnalytics} accessibilityRole="button" accessibilityLabel="Creator analytics" style={s.iconButton}><ProfileIcon name="footprints" size={23}/></Pressable>
    <Pressable onPress={onDiscover} accessibilityRole="button" accessibilityLabel="Find creators" style={s.iconButton}><ProfileIcon name="adduser" size={23}/></Pressable>
    <Pressable onPress={onSettings} accessibilityRole="button" accessibilityLabel="Open profile settings menu" style={s.iconButton}><ProfileIcon name="menu" size={25}/></Pressable>
   </View>
  </View>
  <View style={s.header}>
   <View style={s.avatarWrap}>
    <Pressable style={s.avatar} accessibilityRole="button" accessibilityLabel="Change profile picture" onPress={onChangePhoto}>
     {profile?.avatar_url?<Image source={{uri:profile.avatar_url}} style={s.avatarImage}/>:<Text style={s.avatarInitial}>{displayName.charAt(0).toUpperCase()}</Text>}
    </Pressable>
    <Pressable style={s.avatarAdd} accessibilityRole="button" accessibilityLabel="Create a post" onPress={onCreate}><Text style={s.avatarAddText}>+</Text></Pressable>
   </View>
   <Text style={s.displayName} numberOfLines={2}>{displayName}</Text>
   <View style={s.handleRow}><Text style={s.handle}>@{handle}</Text>{(isBetaTester||profile?.is_beta_tester===true)&&<Text accessibilityLabel="Verified beta tester">👨‍💻</Text>}</View>
   <View style={s.stats}>
    <Pressable style={s.stat} accessibilityRole="button" accessibilityLabel="Following accounts" onPress={()=>onConnections('following')}><Text style={s.statValue}>{stats.following.toLocaleString()}</Text><Text style={s.statLabel}>Following</Text></Pressable>
    <Pressable style={s.stat} accessibilityRole="button" accessibilityLabel="Followers" onPress={()=>onConnections('followers')}><Text style={s.statValue}>{stats.followers.toLocaleString()}</Text><Text style={s.statLabel}>Followers</Text></Pressable>
    <Pressable style={s.stat} accessibilityRole="button" accessibilityLabel="Your likes and analytics" onPress={onAnalytics}><Text style={s.statValue}>{stats.likes.toLocaleString()}</Text><Text style={s.statLabel}>Likes</Text></Pressable>
   </View>
   <Text style={s.bio}>{profile?.bio||'Tell the community your story. Tap Edit profile to add a bio.'}</Text>
   {!!pronouns&&<Text style={s.extra}>{pronouns}</Text>}
   {!!websiteUrl&&<Pressable accessibilityRole="link" onPress={onWebsite}><Text style={s.website}>⌁ {websiteUrl} ↗</Text></Pressable>}
   <View style={s.actions}>
    <Pressable style={s.pill} accessibilityRole="button" onPress={onEdit}><Text style={s.pillText}>Edit profile</Text></Pressable>
    <Pressable style={s.pill} accessibilityRole="button" onPress={onShare}><Text style={s.pillText}>Share profile ↗</Text></Pressable>
   </View>
   <View style={s.shortcuts}>
    <Pressable style={s.shortcut} accessibilityRole="button" onPress={onAnalytics}><Text style={s.shortcutText}>✦ Creator Studio</Text></Pressable>
    <Pressable style={s.shortcut} accessibilityRole="button" onPress={onMarket}><Text style={s.shortcutText}>▣ Marketplace</Text></Pressable>
   </View>
  </View>
 </View>
}

const s=StyleSheet.create({
 topBar:{flexDirection:'row',alignItems:'center',minHeight:62,paddingHorizontal:12,backgroundColor:'#101612',borderBottomWidth:1,borderBottomColor:'#2B362D'},
 account:{flex:1,minWidth:0,minHeight:44,justifyContent:'center'},accountLabel:{fontSize:11,color:'#F0EEE5',fontWeight:'800'},
 brand:{fontSize:13,color:'#F0EEE5',fontWeight:'900',fontStyle:'italic',letterSpacing:.3},brandGold:{color:'#C6AA72'},
 topActions:{flexDirection:'row',alignItems:'center',marginLeft:6},
 iconButton:{width:36,minHeight:44,alignItems:'center',justifyContent:'center'},
 header:{paddingHorizontal:18,paddingTop:23,paddingBottom:20,backgroundColor:'#101612',alignItems:'center'},
 avatarWrap:{position:'relative',marginBottom:15},
 avatar:{width:112,height:112,borderRadius:56,borderWidth:3,borderColor:'#C6AA72',backgroundColor:'#364836',alignItems:'center',justifyContent:'center',overflow:'hidden'},
 avatarImage:{width:'100%',height:'100%',borderRadius:56},avatarInitial:{fontSize:46,color:'#F0EEE5',fontWeight:'900'},
 avatarAdd:{position:'absolute',right:-5,bottom:0,width:35,height:35,borderRadius:18,backgroundColor:'#C6AA72',borderWidth:2,borderColor:'#101612',alignItems:'center',justifyContent:'center'},
 avatarAddText:{fontSize:26,color:'#101510',fontWeight:'900',lineHeight:30},
 displayName:{fontSize:23,fontWeight:'900',color:'#F0EEE5',textAlign:'center',lineHeight:30},
 handleRow:{flexDirection:'row',alignItems:'center',justifyContent:'center',gap:6,marginTop:4},handle:{fontSize:13,color:'#B7BDBB',fontWeight:'600'},
 stats:{width:'100%',flexDirection:'row',justifyContent:'space-around',alignItems:'center',paddingTop:22,paddingBottom:18},
 stat:{flex:1,alignItems:'center'},statValue:{fontSize:22,color:'#F0EEE5',fontWeight:'900',lineHeight:30},statLabel:{color:'#B7BDBB',fontSize:11},
 bio:{fontSize:14,color:'#F0EEE5',fontWeight:'600',lineHeight:21,textAlign:'center',marginTop:4,marginBottom:7},
 extra:{fontSize:11,color:'#BAC6AF',fontWeight:'700',marginTop:4,textAlign:'center'},
 website:{color:'#C6AA72',fontSize:12,fontWeight:'800',marginTop:8,textAlign:'center'},
 actions:{flexDirection:'row',width:'100%',gap:9,marginTop:17},
 pill:{flex:1,minHeight:40,borderRadius:22,borderWidth:1,borderColor:'#5C6D58',backgroundColor:'#232D26',alignItems:'center',justifyContent:'center',paddingHorizontal:5},
 pillText:{color:'#F0EEE5',fontSize:13,fontWeight:'700',textAlign:'center'},
 shortcuts:{flexDirection:'row',width:'100%',justifyContent:'center',gap:12,marginTop:14},
 shortcut:{flex:1,alignItems:'center',paddingVertical:8},shortcutText:{color:'#C6AA72',fontSize:12,fontWeight:'800'}
});
