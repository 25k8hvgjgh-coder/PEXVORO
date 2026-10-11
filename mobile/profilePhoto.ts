import type {ImagePickerAsset} from 'expo-image-picker';
import type {SupabaseClient} from '@supabase/supabase-js';
export function imageFormat(bytes:ArrayBuffer){
 const b=new Uint8Array(bytes);
 if(b[0]===255&&b[1]===216&&b[2]===255)return {type:'image/jpeg',extension:'jpg'};
 if(b[0]===137&&b[1]===80&&b[2]===78&&b[3]===71)return {type:'image/png',extension:'png'};
 if(String.fromCharCode(...b.slice(0,4))==='RIFF'&&String.fromCharCode(...b.slice(8,12))==='WEBP')return {type:'image/webp',extension:'webp'};
 if(String.fromCharCode(...b.slice(0,3))==='GIF')return {type:'image/gif',extension:'gif'};
 throw new Error('This photo format cannot be uploaded. Choose a JPEG, PNG or WebP photo.');
}
// Native ImagePicker can return photo bytes as base64 even when fetch(file://...) fails
// or reports a zero-byte payload on some Android/iOS runtimes.
function decodePickerBase64(value:string):ArrayBuffer{
 const data=String(value||'').replace(/\s+/g,'');
 if(!data||data.length>7_100_000||data.length%4===1||!/^[a-z0-9+/]*={0,2}$/i.test(data))
  throw new Error('The chosen photo could not be decoded. Please select it again.');
 const alphabet='ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';
 const padding=data.endsWith('==')?2:data.endsWith('=')?1:0;
 const bytesLength=Math.floor(data.length*3/4)-padding;
 if(bytesLength>5*1024*1024)throw new Error('Choose a profile photo smaller than 5 MB.');
 const bytes=new Uint8Array(bytesLength);
 for(let i=0,j=0;i<data.length;i+=4){
  const a=alphabet.indexOf(data[i]),b=alphabet.indexOf(data[i+1]);
  const c=data[i+2]&&data[i+2]!=='='?alphabet.indexOf(data[i+2]):0;
  const d=data[i+3]&&data[i+3]!=='='?alphabet.indexOf(data[i+3]):0;
  const bits=(a<<18)|(b<<12)|(c<<6)|d;
  if(j<bytesLength)bytes[j++]=(bits>>>16)&255;
  if(j<bytesLength)bytes[j++]=(bits>>>8)&255;
  if(j<bytesLength)bytes[j++]=bits&255;
 }
 return bytes.buffer;
}
export async function readProfilePhoto(asset:ImagePickerAsset,web:boolean){
 let bytes:ArrayBuffer;
 if(web){
  // Decode the selected file locally, scale large phone photos and remove embedded metadata.
  const source=asset.file?URL.createObjectURL(asset.file):asset.uri;
  try{
   const image=new globalThis.Image();image.src=source;await image.decode();
   const size=Math.min(1024,image.naturalWidth,image.naturalHeight);
   if(!size)throw new Error('The selected image could not be read. Choose another photo.');
   const canvas=document.createElement('canvas');canvas.width=size;canvas.height=size;
   const context=canvas.getContext('2d');if(!context)throw new Error('Your browser could not prepare the photo.');
   const side=Math.min(image.naturalWidth,image.naturalHeight);
   context.drawImage(image,(image.naturalWidth-side)/2,(image.naturalHeight-side)/2,side,side,0,0,size,size);
   const blob=await new Promise<Blob>((resolve,reject)=>canvas.toBlob(value=>value?resolve(value):reject(new Error('Could not prepare the photo.')),'image/jpeg',.85));
   bytes=await blob.arrayBuffer();
  }finally{if(asset.file)URL.revokeObjectURL(source)}
 }else if(asset.base64){
  // Use bytes already returned by ImagePicker; avoids unreliable native file URI fetches.
  bytes=decodePickerBase64(asset.base64);
 }else{
  const response=await fetch(asset.uri);if(!response.ok)throw new Error('Could not read the selected photo. Choose it again.');
  bytes=await response.arrayBuffer();
 }
 if(!bytes.byteLength)throw new Error('The selected photo is empty. Choose another photo.');
 if(bytes.byteLength>5*1024*1024)throw new Error('Choose a profile photo smaller than 5 MB.');
 return {bytes,...imageFormat(bytes)};
}
export async function uploadProfilePhoto(client:SupabaseClient,userId:string,asset:ImagePickerAsset,web:boolean){
 const photo=await readProfilePhoto(asset,web);
 const path=userId+'/avatar-'+Date.now()+'-'+Math.random().toString(36).slice(2)+'.'+photo.extension;
 // Supabase Storage expects actual binary content, not a file:// URI or an
 // uninitialized React Native FormData payload. A typed byte array is portable
 // across Safari, Chrome, Expo iOS, and Expo Android.
 const data=new Uint8Array(photo.bytes);
 if(data.byteLength===0)throw new Error('The profile photo contained no image data.');
 let upload=await client.storage.from('post-media').upload(path,data,{contentType:photo.type,upsert:false});
 for(let attempt=0;attempt<2&&upload.error;attempt++){
  const message=String(upload.error.message||'').toLowerCase();
  const status=String((upload.error as any).statusCode||(upload.error as any).status||'');
  if(!(/network|fetch|timeout|connection|temporarily|socket|reset/.test(message)||status==='429'||/^5\d\d$/.test(status)))break;
  await new Promise(resolve=>setTimeout(resolve,(attempt+1)*500));
  upload=await client.storage.from('post-media').upload(path,data,{contentType:photo.type,upsert:false});
 }
 if(upload.error){
  const message=String(upload.error.message||'');
  if(/no content provided|empty/i.test(message))throw new Error('Photo upload was empty. Please select your photo again.');
  if(/policy|permission|unauthorized|forbidden/i.test(message))throw new Error('Photo upload was denied. Sign out and back in, then retry.');
  throw upload.error;
 }
 if(!upload.data?.path)throw new Error('Your photo upload could not be confirmed. Try again.');
 const link=client.storage.from('post-media').getPublicUrl(upload.data.path).data.publicUrl;
 if(!link)throw new Error('The photo uploaded but its public URL could not be retrieved.');
 return link;
}
