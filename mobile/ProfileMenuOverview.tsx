import React from 'react';
import {Pressable,SafeAreaView,ScrollView,StyleSheet,Text,View} from 'react-native';
import ProfileIcon,{type ProfileIconName} from './ProfileIcon';
import {olive} from './oliveTheme';

type Props={
 onClose:()=>void;onSettings:()=>void;onBalance:()=>void;onAnalytics:()=>void;
 onSaved:()=>void;onMyPosts:()=>void;onInbox:()=>void;
 onReportIssue:()=>void;onTesterReports:()=>void;
 isReviewer?:boolean;onCommandCenter?:()=>void;
 onUnavailable:(label:string)=>void;
};
type Entry={id:string;label:string;glyph:string;icon?:ProfileIconName;action:()=>void};
export default function ProfileMenuOverview({onClose,onSettings,onBalance,onAnalytics,onSaved,onMyPosts,onInbox,onReportIssue,onTesterReports,isReviewer=false,onCommandCenter,onUnavailable}:Props){
 const section=(items:Entry[],key:string)=> <View key={key} style={s.group}>
  {items.map((item,i)=><Pressable accessibilityRole="button" accessibilityLabel={item.label} key={item.id} onPress={item.action} style={({pressed})=>[s.row,i!==items.length-1&&s.rowDivider,pressed&&s.rowPressed]}>
    <View style={s.iconBox}>{item.icon?<ProfileIcon name={item.icon} size={22} color={olive.muted}/>:<Text style={s.glyph}>{item.glyph}</Text>}</View>
    <Text style={s.itemText}>{item.label}</Text><Text style={s.chevron}>›</Text>
   </Pressable>)}
 </View>;
 return <View style={s.overlay}>
  <Pressable accessibilityRole="button" accessibilityLabel="Close menu" onPress={onClose} style={s.scrim}/>
  <SafeAreaView style={s.sheet}>
   <ScrollView contentContainerStyle={s.scroll} showsVerticalScrollIndicator={false}>
    <View style={s.menuHeader}><View style={s.menuIdentity}><Text style={s.menuTitle}>Your corner</Text><Text style={s.menuSubtitle}>Your posts, people, and favorite things.</Text></View><Pressable accessibilityRole="button" accessibilityLabel="Close account menu" onPress={onClose} style={s.closeButton}><Text style={s.closeGlyph}>×</Text></Pressable></View>
    {section([{id:'balance',label:'Balance',glyph:'▣',action:onBalance}],'balance')}
    {section([
     {id:'activity',label:'Activity center',glyph:'◷',action:onSettings},
     {id:'offline',label:'Offline videos',glyph:'↓',action:()=>onUnavailable('Offline videos')}
    ],'activity')}
    {section([{id:'qr',label:'Your QR code',glyph:'▦',action:()=>onUnavailable('Profile QR code')}],'qr')}
    {section([
     {id:'studio',label:'ReconFeed Studio',glyph:'♙',icon:'footprints',action:onAnalytics},
     {id:'promote',label:'Promote',glyph:'✦',action:()=>onUnavailable('Promote')}
    ],'studio')}
    {section([{id:'settings',label:'Settings and privacy',glyph:'⚙',action:onSettings}],'settings')}
    <View style={s.group}>
     <Pressable accessibilityRole="button" style={s.row} onPress={onSettings}>
      <View style={s.iconBox}><Text style={s.glyph}>▤</Text></View><Text style={s.itemText}>ReconFeed Extras</Text><Text style={s.chevron}>›</Text>
     </Pressable>
     <View style={s.extras}>
      <Pressable style={s.extraTile} accessibilityRole="button" onPress={onMyPosts}><ProfileIcon name="grid" color={olive.muted} size={24}/><Text style={s.extraLabel}>My posts</Text></Pressable>
      <Pressable style={s.extraTile} accessibilityRole="button" onPress={onSaved}><ProfileIcon name="bookmark" color={olive.muted} size={24}/><Text style={s.extraLabel}>Saved</Text></Pressable>
      <Pressable style={s.extraTile} accessibilityRole="button" onPress={onInbox}><ProfileIcon name="inbox" color={olive.muted} size={24}/><Text style={s.extraLabel}>Inbox</Text></Pressable>
     </View>
    </View>
    {isReviewer&&onCommandCenter?section([{id:'command-center',label:'Command Center · Private',glyph:'▣',action:onCommandCenter}],'admin'):null}
    {section([
     {id:'report',label:'Report a problem',glyph:'⚑',action:onReportIssue},
     {id:'testers',label:'Beta tester reports',glyph:'▧',action:onTesterReports}
    ],'beta')}
   </ScrollView>
  </SafeAreaView>
 </View>;
}
const s=StyleSheet.create({
 overlay:{flex:1,flexDirection:'row',backgroundColor:olive.scrim},
 scrim:{flex:1},
 sheet:{width:'86%',height:'100%',backgroundColor:olive.bg,borderRightWidth:1,borderRightColor:olive.border},
 scroll:{paddingHorizontal:14,paddingTop:28,paddingBottom:48,gap:11},
 menuHeader:{flexDirection:'row',alignItems:'center',justifyContent:'space-between',gap:10,paddingHorizontal:3,paddingBottom:15},
 menuIdentity:{flex:1},
 menuTitle:{fontSize:25,fontWeight:'800',letterSpacing:-.65,color:olive.text},
 menuSubtitle:{fontSize:12,color:olive.muted,marginTop:5,lineHeight:18},
 closeButton:{width:40,height:40,borderRadius:12,backgroundColor:olive.surface,borderWidth:1,borderColor:olive.border,alignItems:'center',justifyContent:'center'},
 closeGlyph:{color:olive.text,fontSize:25,lineHeight:28},
 group:{backgroundColor:olive.surface,borderRadius:16,overflow:'hidden',borderWidth:1,borderColor:olive.border,shadowColor:'#000',shadowOpacity:.1,shadowRadius:6,elevation:1},
 row:{minHeight:60,flexDirection:'row',alignItems:'center',paddingHorizontal:17,backgroundColor:olive.surface},
 rowDivider:{borderBottomWidth:1,borderBottomColor:olive.border},
 rowPressed:{backgroundColor:olive.raised,opacity:.88},
 iconBox:{width:25,alignItems:'center',marginRight:11},
 glyph:{color:olive.muted,fontSize:23,fontWeight:'700'},
 itemText:{color:olive.text,fontWeight:'600',fontSize:15,flex:1},
 chevron:{color:olive.muted,fontSize:25,fontWeight:'300'},
 extras:{flexDirection:'row',justifyContent:'space-around',paddingVertical:13,paddingHorizontal:11,borderTopWidth:1,borderTopColor:olive.border},
 extraTile:{flex:1,alignItems:'center',gap:7,paddingVertical:5},
 extraLabel:{color:olive.text,fontSize:12,fontWeight:'600'}
});
