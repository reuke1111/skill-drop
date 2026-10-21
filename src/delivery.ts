import {type CachedZip} from './cache';
export type DeliveryResult={state:'filled'|'needs-dialog'|'downloaded'|'download-failed';count?:number;message:string};
export async function deliver(prepared:CachedZip[],io:{target():Promise<number|undefined>;send(tab:number,files:{name:string;bytes:number[]}[]):Promise<any>;download():Promise<void>;open():Promise<void>}):Promise<DeliveryResult>{
  const tab=await io.target();
  if(tab===undefined)return {state:'needs-dialog',message:'Open the upload dialog in one Claude tab, or make your intended Claude tab active, then click Add again. Prepared ZIPs remain available in this panel.'};
  let response:any;
  if(prepared.reduce((sum,row)=>sum+row.bytes.length,0)>15*1024*1024)response={code:'FIELD_NOT_FOUND',error:'Batch exceeds the 15 MB delivery limit.'};
  else try{response=await io.send(tab,prepared.map(row=>({name:row.filename,bytes:Array.from(row.bytes)})));}
  catch{response={code:'FIELD_NOT_FOUND',error:'Content script unavailable. Reload the extension and refresh Claude.'};}
  if(response?.ok&&response.count===prepared.length)return {state:'filled',count:response.count,message:`Prepared ${response.count} files in Claude. Check every name and preview, then click Upload yourself. Acceptance and security scan are not confirmed.`};
  if(response?.code==='DIALOG_CLOSED')return {state:'needs-dialog',message:'The upload dialog is not open. Use Open upload dialog, then click Add again. Prepared ZIPs remain available in this panel.'};
  try{await io.download();}
  catch{return {state:'download-failed',message:'Claude’s Skill file field could not be filled, and ZIP downloads could not all be started. Click Save prepared ZIPs to retry, check Chrome Downloads, then use the upload dialog’s browse button. Your prepared ZIPs remain available in this panel.'};}
  let opened=true;try{await io.open();}catch{opened=false;}
  return {state:'downloaded',message:'Claude’s Skill file field could not be found or filled. ZIP downloads have started in Downloads/ClaudeSkills/ (under your configured download folder). Check Chrome Downloads, then use the Skills upload dialog’s browse button to select the ZIPs. Review the previews and click Upload yourself.'+(opened?'':' Use Open upload dialog to try opening the dialog again.')};
}
