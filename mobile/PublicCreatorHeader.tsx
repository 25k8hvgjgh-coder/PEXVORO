import React from 'react';
import {Image,Linking,Pressable,StyleSheet,Text,View} from 'react-native';
import {olive} from './oliveTheme';

type Creator={
 display_name?:string|null;username?:string|null;avatar_url?:string|null;
 bio?:string|null;pronouns?:string|null;website_url?:string|null;
 following?:number|null;followers?:number|null;
};
type Props={creator:Creator;following:boolean;onFollow:()=>void;onShare:()=>void};
export default function PublicCreatorHeader({creator,following,onFollow,onShare}:Props){
 const name=creator.display_name||creator.username||'ReconFeed Creator';
 return <View style={s.header}>
  <View style={s.identityRow}>
   <View style={s.identityText}>
    <Text style={s.name} numberOfLines={2}>{name}</Text>
    <Text style={s.handle} numberOfLines={1}>@{creator.username||'creator'}</Text>
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
   <Pressable accessibilityRole="button" onPress={onFollow} style={s.pill}><Text style={s.pillText}>{following?'✓ Following':'+ Follow'}</Text></Pressable>
   <Pressable accessibilityRole="button" onPress={onShare} style={s.pill}><Text style={s.pillText}>Share profile ↗</Text></Pressable>
  </View>
 </View>;
}
const s=StyleSheet.create({
 header:{paddingHorizontal:14,paddingTop:18,paddingBottom:20,backgroundColor:olive.bg},
 identityRow:{flexDirection:'row',alignItems:'flex-start',gap:8},
 identityText:{flex:1,minWidth:0},
 name:{fontSize:22,fontWeight:'900',color:olive.text,lineHeight:28},
 handle:{color:olive.muted,fontSize:14,fontWeight:'600',marginTop:3},
 stats:{flexDirection:'row',gap:20,marginTop:20},
 stat:{alignItems:'flex-start'},
 count:{fontSize:21,fontWeight:'900',color:olive.text},statLabel:{fontSize:12,color:olive.muted,marginTop:1},
 avatarWrap:{position:'relative',marginTop:4,marginBottom:5},
 avatar:{height:96,width:96,borderRadius:48,backgroundColor:olive.raised,alignItems:'center',justifyContent:'center',overflow:'hidden'},
 avatarImage:{height:'100%',width:'100%',borderRadius:48},avatarInitial:{fontSize:42,color:olive.text,fontWeight:'900'},
 followPlus:{position:'absolute',right:-3,bottom:-4,width:33,height:33,borderRadius:17,backgroundColor:olive.accent,borderWidth:3,borderColor:olive.bg,alignItems:'center',justifyContent:'center'},
 plusText:{fontSize:26,color:olive.deep,fontWeight:'900',lineHeight:27},
 bio:{fontSize:14,lineHeight:21,fontWeight:'600',color:olive.text,marginTop:11},
 meta:{fontSize:12,color:olive.muted,fontWeight:'700',marginTop:5},
 website:{color:olive.gold,fontWeight:'800',fontSize:12,marginTop:7},
 actions:{flexDirection:'row',gap:9,marginTop:17},
 pill:{minHeight:42,paddingHorizontal:16,paddingVertical:9,borderWidth:1,borderColor:olive.border,borderRadius:23,backgroundColor:olive.surface,alignItems:'center',justifyContent:'center'},
 pillText:{fontSize:13,fontWeight:'700',color:olive.text,textAlign:'center'}
});
