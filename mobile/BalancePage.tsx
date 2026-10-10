import React,{useState} from 'react';
import {Pressable,SafeAreaView,ScrollView,StyleSheet,Text,View} from 'react-native';
import {olive} from './oliveTheme';

type Props={onBack:()=>void;onSettings:()=>void;onUnavailable:(label:string)=>void};
type Option={symbol:string;label:string;description?:string};
const options:Option[]=[
 {symbol:'✦',label:'LIVE rewards'},
 {symbol:'▥',label:'Monetization'},
 {symbol:'★',label:'Campaigns'},
 {symbol:'▣',label:'Subscriptions Manager'},
];
export default function BalancePage({onBack,onSettings,onUnavailable}:Props){
 const [amountHidden,setAmountHidden]=useState(false);
 return <SafeAreaView style={s.safe}>
  <View style={s.header}>
   <Pressable accessibilityRole="button" accessibilityLabel="Back to profile menu" onPress={onBack} style={s.headerButton}><Text style={s.headerIcon}>‹</Text></Pressable>
   <View style={s.headerCenter}><Text style={s.title}>Balance</Text><Text style={s.subtitle}>RECONFEED · ACCOUNT</Text></View>
   <Pressable accessibilityRole="button" accessibilityLabel="Balance settings" onPress={onSettings} style={s.headerButton}><Text style={s.gear}>⚙</Text></Pressable>
  </View>
  <ScrollView contentContainerStyle={s.content} keyboardShouldPersistTaps="handled">
   <View style={s.hero}>
    <View style={s.labelRow}>
     <Text style={s.estimateLabel}>Estimated balance  USD</Text>
     <Pressable accessibilityRole="button" accessibilityLabel={amountHidden?'Show balance':'Hide balance'} onPress={()=>setAmountHidden(x=>!x)}>
      <Text style={s.eye}>{amountHidden?'◌':'◎'}</Text>
     </Pressable>
    </View>
    <Text style={s.amount}>{amountHidden?'••••':'—'}</Text>
    <Text style={s.unavailable}>Balance tracking is not active yet</Text>
    <Pressable accessibilityRole="button" onPress={()=>onUnavailable('Creator coins')} style={s.coinBar}>
     <Text style={s.coinIcon}>✦</Text>
     <Text style={s.coinText}>Coins & credits</Text><Text style={s.coinDisabled}>Not available  ›</Text>
    </Pressable>
   </View>
   <Pressable accessibilityRole="button" style={s.transactions} onPress={()=>onUnavailable('Transactions')}>
    <View style={{flex:1}}><Text style={s.transactionTitle}>Transactions</Text><Text style={s.transactionSub}>No wallet or transaction history is connected</Text></View>
    <Text style={s.chevron}>›</Text>
   </Pressable>
   <View style={s.notice}>
    <Text style={s.noticeHeading}>ReconFeed creator earnings</Text>
    <Text style={s.noticeBody}>Monetization, creator rewards, and coin purchases are planned features. No payments or payouts are enabled during this beta.</Text>
    <Text style={s.noticeMark}>✦</Text>
   </View>
   <View style={s.options}>
    {options.map(o=><Pressable key={o.label} style={s.option} accessibilityRole="button" accessibilityLabel={o.label} onPress={()=>onUnavailable(o.label)}>
      <View style={s.optionIcon}><Text style={s.optionSymbol}>{o.symbol}</Text></View>
      <Text style={s.optionLabel}>{o.label}</Text>
      <Text style={s.comingSoon}>Soon</Text>
     </Pressable>)}
   </View>
   <Text style={s.disclaimer}>This Balance page is a preview. It is not a bank account, financial product, stored-value wallet, or statement of available funds. Earnings, coins, transactions, payouts, and subscriptions are not active.</Text>
  </ScrollView>
 </SafeAreaView>;
}
const s=StyleSheet.create({
 safe:{flex:1,backgroundColor:olive.bg},
 header:{minHeight:72,flexDirection:'row',alignItems:'center',justifyContent:'space-between',paddingHorizontal:18},
 headerButton:{width:48,minHeight:52,alignItems:'center',justifyContent:'center'},
 headerIcon:{fontSize:43,color:olive.text,lineHeight:50,fontWeight:'300'},
 headerCenter:{alignItems:'center'},title:{fontSize:24,color:olive.text,fontWeight:'900'},
 subtitle:{fontSize:10,color:olive.accent,fontWeight:'800',letterSpacing:1.5,marginTop:3},
 gear:{fontSize:32,color:olive.text},
 content:{paddingHorizontal:16,paddingTop:18,paddingBottom:85},
 hero:{alignItems:'center',marginBottom:23,paddingVertical:15},
 labelRow:{flexDirection:'row',alignItems:'center',gap:8},
 estimateLabel:{color:olive.muted,fontSize:18,fontWeight:'700'},
 eye:{color:olive.muted,fontSize:23},
 amount:{fontSize:61,color:olive.text,fontWeight:'900',letterSpacing:-2,marginTop:13},
 unavailable:{fontSize:13,color:olive.muted,marginTop:2,marginBottom:22},
 coinBar:{borderRadius:28,paddingHorizontal:16,paddingVertical:11,flexDirection:'row',alignItems:'center',gap:9,backgroundColor:olive.surface,borderWidth:1,borderColor:olive.border},
 coinIcon:{color:olive.gold,fontSize:20,fontWeight:'800'},
 coinText:{color:olive.text,fontWeight:'800',fontSize:15},
 coinDisabled:{color:olive.muted,fontSize:13},
 transactions:{backgroundColor:olive.surface,flexDirection:'row',alignItems:'center',borderRadius:21,paddingHorizontal:21,paddingVertical:22,marginBottom:14,borderWidth:1,borderColor:olive.border},
 transactionTitle:{color:olive.text,fontSize:19,fontWeight:'900'},
 transactionSub:{color:olive.muted,fontSize:12,marginTop:7,lineHeight:17},
 chevron:{fontSize:29,color:olive.muted},
 notice:{backgroundColor:olive.raised,borderRadius:20,paddingHorizontal:20,paddingVertical:18,marginBottom:17,borderWidth:1,borderColor:olive.border,minHeight:128},
 noticeHeading:{color:olive.text,fontSize:18,fontWeight:'900',paddingRight:22},
 noticeBody:{color:olive.muted,fontSize:14,lineHeight:21,marginTop:9,paddingRight:17},
 noticeMark:{position:'absolute',right:18,top:13,color:olive.gold,fontSize:25},
 options:{backgroundColor:olive.surface,borderRadius:20,paddingHorizontal:10,paddingVertical:19,flexDirection:'row',flexWrap:'wrap',marginBottom:25,borderWidth:1,borderColor:olive.border},
 option:{width:'50%',paddingHorizontal:9,alignItems:'center',minHeight:151,justifyContent:'center',gap:10},
 optionIcon:{height:61,width:61,backgroundColor:olive.raised,borderRadius:19,alignItems:'center',justifyContent:'center'},
 optionSymbol:{fontSize:28,fontWeight:'900',color:olive.text},
 optionLabel:{fontSize:15,color:olive.text,fontWeight:'800',textAlign:'center',lineHeight:20},
 comingSoon:{fontSize:11,color:olive.gold,fontWeight:'700',textAlign:'center'},
 disclaimer:{fontSize:12,color:olive.muted,textAlign:'center',lineHeight:19,marginHorizontal:5,marginTop:18}
});
