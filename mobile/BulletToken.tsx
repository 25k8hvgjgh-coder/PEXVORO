import React from 'react';
import {StyleSheet,View} from 'react-native';
import {olive} from './oliveTheme';

/** An original brass cartridge symbol for ReconFeed's virtual "Bullets" currency. */
export default function BulletToken({size=28}:{size?:number}){
 const scale=size/28;
 return <View accessible accessibilityRole="image" accessibilityLabel="ReconFeed Bullet currency" style={[s.circle,{width:size,height:size,borderRadius:size/2}]}>
  <View style={[s.tip,{width:7*scale,height:7*scale,borderTopLeftRadius:5*scale,borderTopRightRadius:5*scale}]}/>
  <View style={[s.neck,{width:9*scale,height:2*scale}]}/>
  <View style={[s.case,{width:11*scale,height:10*scale}]}>
   <View style={[s.shine,{width:2*scale,height:8*scale,left:2*scale,top:1*scale}]}/>
  </View>
  <View style={[s.rim,{width:13*scale,height:3*scale,borderRadius:1*scale}]}/>
 </View>;
}
const s=StyleSheet.create({
 circle:{backgroundColor:olive.raised,alignItems:'center',justifyContent:'center',borderWidth:1,borderColor:olive.gold,overflow:'hidden'},
 tip:{backgroundColor:'#E5CA83'},
 neck:{backgroundColor:'#B18D42'},
 case:{backgroundColor:'#C9A355',position:'relative',borderLeftWidth:1,borderRightWidth:1,borderColor:'#E5CA83'},
 shine:{position:'absolute',backgroundColor:'#F0D697',opacity:.8},
 rim:{backgroundColor:'#F0D697'}
});
