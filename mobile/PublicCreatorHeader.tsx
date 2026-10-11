import React from 'react';
import {Image,Linking,Pressable,StyleSheet,Text,View} from 'react-native';
import {olive} from './oliveTheme';

type Creator={
 display_name?:string|null;username?:string|null;avatar_url?:string|null;
 bio?:string|null;pronouns?:string|null;website_url?:string|null;
 following?:number|null;followers?:number|null;
};
type Props={creator:Creator;following:boolean;followsYou:boolean;onFollow:()=>void;onShare:()=>void;onMessage:()=>void};
export default function PublicCreatorHeader({creator,following,followsYou,onFollow,onShare,onMessage}:Props){
 const name=creator.display_name||creator.username||'ReconFeed Creator';
 return <View style={s.header}>
  <View style={s.identityRow}>
   <View style={s.identityText}>
    <Text style={s.name} numberOfLines={2}>{name}</Text>
    <Text style={s.handle} numberOfLines={1}>@{creator.username||'creator'}</Text>
    {followsYou&&<Text style={s.followsYou}>{following?'✓ Mutual following':'Follows you · Follow back'}</Text>}
    <View style={s.stats}>
     <View style={s.stat}><Text style={s.count}>{Number(creator.following||0).toLocaleString()}</Text><Text style={s.statLabel}>Following</Text></View>
     <View style={s.stat}><Text style={s.count}>{Number(creator.followers||0).toLocaleString()}</Text><Text style={s.statLabel}>Followers</Text></View>
    </View>
   </View>
   <View style={s.avatarWrap}>
    <View style={s.avatar}>{creator.avatar_url?<Image source={{uri:creator.avatar_url}} style={s.avatarImage}/>:<Text style={s.avatarInitial}>{name.charAt(0).toUpperCase()}</Text>}</View>
    {!following&&<Pressable accessibilityRole="button" accessibilityLabel="Follow creator" onPress={onFollow} style={s.followPlus}><Text style={s.plusText}>+</Text></Pressable>}
   </View>
  </View>
  {!!creator.bio&&<Text style={s.bio}>{creator.bio}</Text>}
  {!!creator.pronouns&&<Text style={s.meta}>{creator.pronouns}</Text>}
  {!!creator.website_url&&<Pressable accessibilityRole="link" onPress={()=>void Linking.openURL(creator.website_url!)}><Text style={s.website}>⌁ {creator.website_url} ↗</Text></Pressable>}
  <View style={s.actions}>
   <Pressable accessibilityRole="button" accessibilityLabel={following?'Unfollow':'Follow creator'} onPress={onFollow} style={({pressed})=>[s.pill,s.followButton,pressed&&s.pillPressed]}><Text style={s.followButtonText}>{following?'✓ Following':followsYou?'+ Follow back':'+ Follow'}</Text></Pressable>
   <Pressable accessibilityRole="button" accessibilityLabel="Message creator" onPress={onMessage} style={({pressed})=>[s.pill,pressed&&s.pillPressed]}><Text style={s.pillText}>✉ Message</Text></Pressable>
   <Pressable accessibilityRole="button" onPress={onShare} style={({pressed})=>[s.pill,pressed&&s.pillPressed]}><Text style={s.pillText}>Share ↗</Text></Pressable>
  </View>
 </View>;
}
const s=StyleSheet.create({
 header:{paddingHorizontal:18,paddingTop:20,paddingBottom:22,backgroundColor:olive.bg,borderBottomWidth:1,borderBottomColor:olive.border},
 identityRow:{flexDirection:'row',alignItems:'flex-start',gap:8},
 identityText:{flex:1,minWidth:0},
 name:{fontSize:22,fontWeight:'900',color:olive.text,lineHeight:28},
 handle:{color:olive.muted,fontSize:14,fontWeight:'600',marginTop:3},
 followsYou:{fontSize:12,color:olive.gold,fontWeight:'800',marginTop:6},
 stats:{flexDirection:'row',gap:20,marginTop:20},
 stat:{alignItems:'flex-start'},
 count:{fontSize:21,fontWeight:'900',color:olive.text},statLabel:{fontSize:12,color:olive.muted,marginTop:1},
 avatarWrap:{position:'relative',marginTop:4,marginBottom:5},
 avatar:{height:96,width:96,borderRadius:48,backgroundColor:olive.raised,alignItems:'center',justifyContent:'center',overflow:'hidden',borderWidth:3,borderColor:olive.accent,shadowColor:olive.accent,shadowOpacity:.19,shadowRadius:7,elevation:3},
 avatarImage:{height:'100%',width:'100%',borderRadius:48},avatarInitial:{fontSize:42,color:olive.text,fontWeight:'900'},
 followPlus:{position:'absolute',right:-3,bottom:-4,width:33,height:33,borderRadius:17,backgroundColor:olive.accent,borderWidth:3,borderColor:olive.bg},
 plusText:{fontSize:26,color:olive.deep,fontWeight:'900',lineHeight:27},
 bio:{fontSize:14,lineHeight:22,fontWeight:'500',color:olive.text,marginTop:15},
 meta:{fontSize:12,color:olive.muted,fontWeight:'700',marginTop:5},
 website:{color:olive.gold,fontWeight:'800',fontSize:12,marginTop:7},
 actions:{flexDirection:'row',gap:8,marginTop:17,flexWrap:'wrap'},
 pill:{minHeight:44,paddingHorizontal:15,paddingVertical:10,borderWidth:1,borderColor:olive.border,borderRadius:14,backgroundColor:olive.surface,alignItems:'center',justifyContent:'center'},
 followButton:{backgroundColor:olive.accent,borderColor:olive.accent},
 followButtonText:{fontSize:13,fontWeight:'800',color:olive.deep,textAlign:'center'},
 pillPressed:{transform:[{scale:.97}],opacity:.78},
 pillText:{fontSize:13,fontWeight:'700',color:olive.text,textAlign:'center'}
});
