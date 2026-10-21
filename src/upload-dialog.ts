export const UPLOAD_URL='https://claude.ai/new#customize/skills/new/upload';
type DialogTab={id?:number;active:boolean;url?:string;pendingUrl?:string};
export type DialogTabs={
  query(query:{currentWindow:true}):Promise<DialogTab[]>;
  update(id:number,changes:{active:true;url?:string}):Promise<unknown>;
  create(properties:{url:string;active:true}):Promise<unknown>;
  reload(id:number):Promise<void>;
  sendMessage(id:number,message:{type:'SKILL_DROP_DIALOG_STATUS'}):Promise<unknown>;
};
export function isUploadUrl(value:string|undefined):boolean{
  if(!value)return false;
  try{return new URL(value).href===UPLOAD_URL;}catch{return false;}
}
function isNewPage(value:string|undefined):boolean{
  if(!value)return false;
  try{const url=new URL(value);return url.origin==='https://claude.ai'&&url.pathname==='/new';}catch{return false;}
}
async function waitForDialog(tabId:number,tabs:DialogTabs,pause:(milliseconds:number)=>Promise<void>):Promise<boolean>{
  // A hash navigation may need time to render, or may not trigger Claude's router.
  for(const delay of [0,100,200,400,800,1000]){
    if(delay)await pause(delay);
    try{const state=await tabs.sendMessage(tabId,{type:'SKILL_DROP_DIALOG_STATUS'});if((state as {ready?:boolean}|undefined)?.ready===true)return true;}catch{/* A missing/reloading content script is not ready. */}
  }
  return false;
}
export async function openUploadDialog(tabs:DialogTabs,pause=(milliseconds:number)=>new Promise<void>(resolve=>setTimeout(resolve,milliseconds))):Promise<{action:'focused-active'|'activated-existing'|'reused-new'|'created';reloaded:boolean}>{
  // URL metadata for Claude tabs is available through the existing host permission.
  const list=await tabs.query({currentWindow:true});
  const active=list.find(tab=>tab.active);
  const tabUrl=(tab:DialogTab)=>tab.pendingUrl||tab.url;
  if(active?.id!==undefined&&isUploadUrl(tabUrl(active))){
    await tabs.update(active.id,{active:true});return {action:'focused-active',reloaded:false};
  }
  const existing=list.find(tab=>tab.id!==undefined&&isUploadUrl(tabUrl(tab)));
  if(existing?.id!==undefined){
    await tabs.update(existing.id,{active:true});return {action:'activated-existing',reloaded:false};
  }
  if(active?.id!==undefined&&isNewPage(tabUrl(active))){
    await tabs.update(active.id,{url:UPLOAD_URL,active:true});
    const ready=await waitForDialog(active.id,tabs,pause);
    if(!ready)await tabs.reload(active.id);
    return {action:'reused-new',reloaded:!ready};
  }
  await tabs.create({url:UPLOAD_URL,active:true});return {action:'created',reloaded:false};
}
