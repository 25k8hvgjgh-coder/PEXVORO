type Permission={granted:boolean;canAskAgain?:boolean};
type Dependencies={camera:()=>Promise<Permission>;microphone:()=>Promise<Permission>};
export async function capturePermission(mode:'photo'|'video',deps:Dependencies):Promise<{allowed:true}|{allowed:false;feature:'camera'|'microphone';canAskAgain:boolean}>{
 const camera=await deps.camera();
 if(!camera.granted)return {allowed:false,feature:'camera',canAskAgain:camera.canAskAgain!==false};
 if(mode==='video'){
  const microphone=await deps.microphone();
  if(!microphone.granted)return {allowed:false,feature:'microphone',canAskAgain:microphone.canAskAgain!==false};
 }
 return {allowed:true};
}
