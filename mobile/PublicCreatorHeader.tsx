import React from 'react';
import {Image,Linking,Pressable,StyleSheet,Text,View} from 'react-native';

type Creator={
 display_name?:string|null;username?:string|null;avatar_url?:string|null;
 bio?:string|null;pronouns?:string|null;website_url?:string|null;
 following?:number|null;followers?:number|null;
};
type Props={creator:Creator;following:boolean;onFollow:()=>void;onShare:()=>void};
export default function PublicCreatorHeader({creator,following,onFollow,onShare}:Props){
 const name=creator.display_name||creator.username||'ReconFeed Creator';
 return <View style={s.header}>
  <View style={s.avatarWrap}>
   <View style={s.avatar}>{creator.avatar_url?<Image source={{uri:creator.avatar_url}} style={s.avatarImage}/>:<Text style={s.avatarInitial}>{name.charAt(0).toUpperCase()}</Text>}</View>
   {!following&&<Pressable accessibilityRole="button" accessibilityLabel="Follow creator" onPress={onFollow} style={s.followPlus}><Text style={s.plusText}>+</Text></Pressable>}
  </View>
  <Text style={s.name} numberOfLines={2}>{name}</Text>
  <Text style={s.handle}>@{creator.username||'creator'}</Text>
  <View style={s.stats}>
   <View style={s.stat}><Text style={s.count}>{Number(creator.following||0).toLocaleString()}</Text><Text style={s.statLabel}>Following</Text></View>
   <View style={s.stat}><Text style={s.count}>{Number(creator.followers||0).toLocaleString()}</Text><Text style={s.statLabel}>Followers</Text></View>
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
 header:{paddingHorizontal:18,paddingTop:23,paddingBottom:21,backgroundColor:'#101612',alignItems:'center'},
 avatarWrap:{position:'relative',marginBottom:15},
 avatar:{height:112,width:112,borderRadius:56,borderWidth:3,borderColor:'#C6AA72',backgroundColor:'#364836',alignItems:'center',justifyContent:'center',overflow:'hidden'},
 avatarImage:{height:'100%',width:'100%',borderRadius:56},avatarInitial:{fontSize:46,color:'#F0EEE5',fontWeight:'900'},
 followPlus:{position:'absolute',right:-5,bottom:0,width:35,height:35,borderRadius:18,backgroundColor:'#C6AA72',borderWidth:2,borderColor:'#101612',alignItems:'center',justifyContent:'center'},
 plusText:{fontSize:26,color:'#101510',fontWeight:'900',lineHeight:30},
 name:{fontSize:23,fontWeight:'900',color:'#F0EEE5',textAlign:'center',lineHeight:30},
 handle:{color:'#B7BDBB',fontSize:13,fontWeight:'600',marginTop:4},
 stats:{flexDirection:'row',width:'100%',justifyContent:'space-around',paddingVertical:19},
 stat:{alignItems:'center',flex:1},count:{fontSize:22,fontWeight:'900',color:'#F0EEE5'},statLabel:{fontSize:11,color:'#B7BDBB',marginTop:4},
 bio:{fontSize:14,lineHeight:21,fontWeight:'600',color:'#F0EEE5',textAlign:'center',marginTop:6},
 meta:{fontSize:11,color:'#BAC6AF',fontWeight:'700',marginTop:5},
 website:{color:'#C6AA72',fontWeight:'800',fontSize:12,marginTop:8,textAlign:'center'},
 actions:{flexDirection:'row',width:'100%',gap:9,marginTop:17},
 pill:{flex:1,minHeight:40,borderRadius:22,borderWidth:1,borderColor:'#5C6D58',backgroundColor:'#232D26',alignItems:'center',justifyContent:'center',paddingHorizontal:5},
 pillText:{fontSize:13,fontWeight:'700',color:'#F0EEE5',textAlign:'center'}
});
