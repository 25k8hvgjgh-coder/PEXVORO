import React from 'react';
import {Text,View,StyleSheet} from 'react-native';

export type MorningBriefItem = {
  id: string;
  headline: string;
  summary: string;
  source: string;
  publishedAt: string;
  videoUrl?: string;
  isAiNarrated?: boolean;
};

/** Optional feed card. Render between ordinary posts; never auto-open or interrupt scrolling. */
export default function MorningBriefCard({item}: {item: MorningBriefItem}) {
  return <View style={s.card}>
    <Text style={s.eyebrow}>MORNING NEWS · OPTIONAL</Text>
    <Text style={s.headline}>{item.headline}</Text>
    <Text style={s.summary}>{item.summary}</Text>
    <Text style={s.meta}>{item.source} · {item.publishedAt}{item.isAiNarrated?' · AI narration':''}</Text>
    <Text style={s.disclaimer}>Check the source for the full report. AI summaries may contain errors.</Text>
  </View>;
}
const s=StyleSheet.create({
 card:{backgroundColor:'#151520',borderColor:'#4b3c70',borderWidth:1,borderRadius:16,padding:14,marginVertical:8},
 eyebrow:{color:'#b49aff',fontSize:10,fontWeight:'800',letterSpacing:1.5,marginBottom:8},
 headline:{color:'#f8f7ff',fontSize:18,fontWeight:'800',lineHeight:23},
 summary:{color:'#d7d4e4',fontSize:13,lineHeight:19,marginTop:8},
 meta:{color:'#b49aff',fontSize:11,marginTop:10},
 disclaimer:{color:'#a09db4',fontSize:10,lineHeight:15,marginTop:6}
});
