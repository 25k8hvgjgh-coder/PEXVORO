// ReconFeed Field Preferences and creator metadata. Shared by search, publishing and For You.
export type ContentPreferences={blockedKeywords:string[];hideMatureContent:boolean};
export type DiscoverablePost={
 caption?:string;format?:string;topic_tags?:string[];audio_label?:string;overlay_text?:string;
 transcript?:string;content_rating?:string;recommendation_status?:string;
};
const clean=(v:string)=>String(v||'').toLowerCase().normalize('NFKC').replace(/\s+/g,' ').trim();
export function normalizeBlockedKeywords(input:string|string[]):string[]{
 const source=Array.isArray(input)?input:input.split(/[,\n]/g);
 return [...new Set(source.map(v=>clean(v).replace(/^#+/,'').replace(/[^\p{L}\p{N}_ -]/gu,'').trim()).filter(v=>v.length>=2&&v.length<=40))].slice(0,40);
}
export function contentSearchText(post:DiscoverablePost):string{
 return [post.caption||'',post.format||'',(post.topic_tags||[]).join(' '),post.audio_label||'',post.overlay_text||'',post.transcript||''].join(' ');
}
function containsKeyword(haystack:string,word:string):boolean{
 const escaped=word.replace(/[.*+?^${}()|[\]\\]/g,'\\$&');
 return new RegExp('(^|[^\\p{L}\\p{N}_])#?'+escaped+'(?=$|[^\\p{L}\\p{N}_])','iu').test(haystack);
}
export function matchesBlockedKeyword(post:DiscoverablePost,words:string[]):boolean{
 if(!words.length)return false;
 const text=clean(contentSearchText(post));
 return words.some(w=>containsKeyword(text,clean(w).replace(/^#+/,'')));
}
export function allowedForFeed(post:DiscoverablePost,prefs:ContentPreferences,mode:'For You'|'Following'):boolean{
 // The trusted recommendation status is assigned server-side, not by creator-controlled settings.
 if(mode==='For You'&&post.recommendation_status&&post.recommendation_status!=='eligible')return false;
 if(prefs.hideMatureContent&&post.content_rating==='mature')return false;
 if(matchesBlockedKeyword(post,prefs.blockedKeywords))return false;
 return true;
}
export function parseCreatorTags(input:string):string[]{
 return [...new Set(String(input||'').split(/[,\s]+/g).map(t=>t.replace(/^#/,'').replace(/[^a-zA-Z0-9_]/g,'').toLowerCase()).filter(t=>t.length>=2&&t.length<=25))].slice(0,12);
}
export function suggestReviewReason(post:DiscoverablePost):string|null{
 // Conservative low-confidence spam detection only. Nothing here determines violence or safety.
 const text=String(post.caption||'');
 if((text.match(/https?:\/\//gi)||[]).length>=4)return 'excessive-links';
 if((text.match(/#[a-z0-9_]+/gi)||[]).length>24)return 'excessive-hashtags';
 if(/(.)\1{29,}/u.test(text))return 'repeated-text';
 return null;
}
