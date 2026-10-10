import React,{useState} from 'react';
import {Pressable,SafeAreaView,ScrollView,StyleSheet,Text,View} from 'react-native';
import {olive} from './oliveTheme';
import BulletToken from './BulletToken';

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
 const [showBulletGuide,setShowBulletGuide]=useState(false);
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
    <View style={s.bulletWallet}>
     <BulletToken size={29}/>
     <Text style={s.bulletText}>Bullets</Text>
     <Text style={s.bulletCount} accessibilityLabel="Bullet balance not yet available">—</Text>
     <View style={s.walletDivider}/>
     <Pressable accessibilityRole="button" accessibilityLabel="Get Bullets" onPress={()=>onUnavailable('Get Bullets')} style={s.getBullets}>
      <Text style={s.bulletDisabled}>Get Bullets  →</Text>
     </Pressable>
    </View>
    <Pressable accessibilityRole="button" onPress={()=>setShowBulletGuide(v=>!v)} style={s.bulletInfoButton}>
     <Text style={s.bulletInfoLabel}>{showBulletGuide?'▾ Hide Bullet details':'▸ How do Bullets work?'}</Text>
    </Pressable>
    {showBulletGuide?<View style={s.bulletExplainer}>
     <Text style={s.bulletExplainerHeading}>Bullets · ReconFeed's virtual currency</Text>
     <Text style={s.bulletExplainerText}>Bullets will be used for eligible creator support and rewards after secure accounting and purchase checks are available. You cannot purchase, transfer, cash out, or spend Bullets in this beta. A real balance will appear only when the secure wallet system is live.</Text>
    </View>:null}
   </View>
   <Pressable accessibilityRole="button" style={s.transactions} onPress={()=>onUnavailable('Transaction & Bullet history')}>
    <View style={{flex:1}}><Text style={s.transactionTitle}>Transaction & Bullet history</Text><Text style={s.transactionSub}>No verified earnings or Bullet transactions are connected yet</Text></View>
    <Text style={s.chevron}>›</Text>
   </Pressable>
   <View style={s.notice}>
    <Text style={s.noticeHeading}>ReconFeed creator earnings</Text>
    <Text style={s.noticeBody}>Monetization, creator rewards, and Bullet purchases are planned features. No payments, Bullet transfers or payouts are enabled during this beta.</Text>
    <Text style={s.noticeMark}>✦</Text>
   </View>
   <View style={s.options}>
    {options.map(o=><Pressable key={o.label} style={s.option} accessibilityRole="button" accessibilityLabel={o.label} onPress={()=>onUnavailable(o.label)}>
      <View style={s.optionIcon}><Text style={s.optionSymbol}>{o.symbol}</Text></View>
      <Text style={s.optionLabel}>{o.label}</Text>
      <Text style={s.comingSoon}>Soon</Text>
     </Pressable>)}
   </View>
   <Text style={s.disclaimer}>This Balance page is a preview. Bullets are planned in-app virtual credits, not ammunition, cash, a bank account or a financial product. No Bullets, earnings, transfers, payouts, purchases or subscriptions are active.</Text>
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
 bulletWallet:{borderRadius:28,paddingHorizontal:13,paddingVertical:10,flexDirection:'row',alignItems:'center',gap:8,backgroundColor:olive.surface,borderWidth:1,borderColor:olive.border},
 bulletText:{color:olive.text,fontWeight:'800',fontSize:15},
 bulletCount:{color:olive.gold,fontSize:17,fontWeight:'900'},
 walletDivider:{height:21,width:1,backgroundColor:olive.border,marginHorizontal:3},
 getBullets:{paddingVertical:4,paddingHorizontal:2},
 bulletDisabled:{color:olive.muted,fontWeight:'700',fontSize:13},
 bulletInfoButton:{marginTop:13,padding:8,alignItems:'center'},
 bulletInfoLabel:{color:olive.gold,fontSize:13,fontWeight:'800'},
 bulletExplainer:{backgroundColor:olive.surface,borderColor:olive.border,borderWidth:1,borderRadius:14,padding:15,marginTop:5,maxWidth:385},
 bulletExplainerHeading:{color:olive.text,fontWeight:'900',fontSize:14,marginBottom:7},
 bulletExplainerText:{color:olive.muted,lineHeight:18,fontSize:12},
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
