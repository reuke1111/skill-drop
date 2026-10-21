// Respond only to the extension's own file-input and readiness requests.
import {isUploadUrl} from './upload-dialog';
chrome.runtime.onMessage.addListener((message,sender,respond)=>{
  if(sender.id!==chrome.runtime.id||!['SKILL_DROP_BATCH','SKILL_DROP_DIALOG_STATUS'].includes(message?.type))return;
  try{
    const candidates=Array.from(document.querySelectorAll<HTMLInputElement>('input[type=file]')).filter(input=>/zip|skill|markdown|\.md/i.test(input.accept)&&!input.disabled);
    if(message.type==='SKILL_DROP_DIALOG_STATUS'){respond({ready:isUploadUrl(location.href)&&candidates.length===1});return;}
    if(!isUploadUrl(location.href)){respond({ok:false,code:'DIALOG_CLOSED'});return;}
    if(candidates.length!==1){respond({ok:false,code:'FIELD_NOT_FOUND',error:'Claude’s Skill file field could not be found. Use the downloaded ZIPs with the upload dialog’s browse button.'});return;}
    if(!Array.isArray(message.files)||!message.files.length||message.files.length>30)throw new Error('Choose 1–30 skills per batch.');
    const data=new DataTransfer();let total=0;
    for(const item of message.files){
      if(typeof item.name!=='string'||!Array.isArray(item.bytes)||!item.bytes.every((x:unknown)=>typeof x==='number'&&Number.isInteger(x)&&x>=0&&x<=255))throw new Error('Invalid file message');
      total+=item.bytes.length;if(total>15*1024*1024)throw new Error('Batch exceeds 15 MB; use the downloaded ZIPs.');
      data.items.add(new File([new Uint8Array(item.bytes).buffer],item.name,{type:'application/zip'}));
    }
    const input=candidates[0];input.files=data.files;
    const names=Array.from(input.files||[]).map(file=>file.name);
    input.dispatchEvent(new Event('input',{bubbles:true}));input.dispatchEvent(new Event('change',{bubbles:true}));
    respond({ok:true,count:names.length,names});
  }catch(error){respond({ok:false,code:'FIELD_NOT_FOUND',error:String(error)});}
});
