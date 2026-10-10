import assert from 'node:assert/strict';
import fs from 'node:fs';
import {createRequire} from 'node:module';
const require=createRequire(new URL('../mobile/package.json',import.meta.url));
const ts=require('typescript');
const compiled=ts.transpileModule(fs.readFileSync(new URL('../mobile/profilePhoto.ts',import.meta.url),'utf8'),{compilerOptions:{module:ts.ModuleKind.ES2022}}).outputText;
const {imageFormat,readProfilePhoto,uploadProfilePhoto}=await import('data:text/javascript;base64,'+Buffer.from(compiled).toString('base64'));
const jpg=new Uint8Array([255,216,255,224,0,0,0,0]).buffer;
const png=new Uint8Array([137,80,78,71,13,10,26,10]).buffer;
assert.equal(imageFormat(jpg).type,'image/jpeg');
assert.equal(imageFormat(png).type,'image/png');
assert.throws(()=>imageFormat(new Uint8Array([1,2,3]).buffer),/format/);
globalThis.fetch=async()=>({ok:true,arrayBuffer:async()=>jpg});
assert.equal((await readProfilePhoto({uri:'fixture',mimeType:'image/heic'},false)).type,'image/jpeg','Use actual cropped bytes instead of original HEIC label');
let drawn=false;
globalThis.Image=class{naturalWidth=4000;naturalHeight=3000;async decode(){}};
globalThis.document={createElement:()=>({getContext:()=>({drawImage(...args){drawn=true;assert.deepEqual(args.slice(1),[500,0,3000,3000,0,0,1024,1024])}}),toBlob(cb,type){assert.equal(type,'image/jpeg');cb(new Blob([jpg],{type}))}})};
const web=await readProfilePhoto({uri:'fixture'},true);assert.equal(web.type,'image/jpeg');assert.equal(drawn,true);
let uploaded=false;
const client={storage:{from:bucket=>{assert.equal(bucket,'post-media');return {upload:async(path,bytes,options)=>{assert.match(path,/^owner\/avatar-/);assert.equal(options.contentType,'image/jpeg');assert.equal(bytes.byteLength,jpg.byteLength);uploaded=true;return {error:null,data:{path}}},getPublicUrl:path=>({data:{publicUrl:'https://example.com/'+path}})}}}};
const saved=await uploadProfilePhoto(client,'owner',{uri:'fixture',mimeType:'image/heic'},false);assert.match(saved,/owner\/avatar-/);assert.equal(uploaded,true);

// Missing storage confirmation must not be treated as a successful upload.
const failedClient={storage:{from:()=>({upload:async()=>({error:null,data:null}),getPublicUrl:()=>({data:{publicUrl:'https://example.com/invalid'}})})}};
await assert.rejects(()=>uploadProfilePhoto(failedClient,'owner',{uri:'fixture'},false),/could not be confirmed/);

globalThis.fetch=async()=>({ok:true,arrayBuffer:async()=>new ArrayBuffer(6*1024*1024)});
await assert.rejects(()=>readProfilePhoto({uri:'oversize'},false),/5 MB/);
console.log('Profile-photo checks passed: cropped MIME detection, browser resizing/cropping, upload bytes and size rejection.');
