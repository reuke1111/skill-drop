import {loadIndex,parseIndex,search,indexUrl,skillId,MAX_INDEX_BYTES,type SkillsIndex,type SkillRecord,type IndexSnapshot} from './index';
import {indexedDbStore,ZipCache,type CachedZip} from './cache';
import {createSkillClient} from './skills';
import {fetchBytes} from './network';
import {collisions} from './github';
import {deliver} from './delivery';
import {repositoryUrl,type RepositoryResult} from './repository';
import {openUploadDialog} from './upload-dialog';
const $=<T extends HTMLElement=HTMLElement>(id:string)=>document.getElementById(id) as T;
const cache=new ZipCache(indexedDbStore());let client=createSkillClient(cache);
let clientToken='';const imported=new Map<string,SkillRecord>();let activeRepo:{query:string;result:RepositoryResult}|undefined;let scanning=false;
let index:SkillsIndex={version:1,generatedAt:new Date().toISOString(),skills:[]};
const selected=new Map<string,SkillRecord>();let history:{id:string;name:string}[]=[];let prepared:CachedZip[]=[];let busy=false;let detailVersion=0;
const status=(message:string)=>{$('status').textContent=message;};
function library():SkillsIndex{
  const all=new Map(index.skills.map(s=>[skillId(s),s]));for(const s of imported.values())all.set(skillId(s),s);return {...index,skills:[...all.values()]};
}
function selection(){
  $('selection-count').textContent=selected.size?`${selected.size} skill${selected.size===1?'':'s'} selected`:'No skills selected';
  $<HTMLButtonElement>('add').disabled=busy||!selected.size;
  const chosen=[...selected.values()];const warnings=collisions(chosen.map(s=>({id:s.repo+'/'+s.path,name:s.name})));
  for(const s of chosen){
    const other=library().skills.filter(o=>o.name===s.name&&skillId(o)!==skillId(s));
    if(other.length)warnings.push(`“${s.name}” also appears in ${other.length} other directory record(s).`);
    if(history.some(h=>h.name===s.name))warnings.push(`“${s.name}” was previously prepared here. Claude’s installed list has not been checked.`);
    if(s.validationWarnings?.length)warnings.push(`${s.path}: ${s.validationWarnings.join(' ')}`);
  }
  $('warnings').textContent=[...new Set(warnings)].join('\n');
}
function render(){
  const query=$<HTMLInputElement>('search').value;const isRepo=!!repositoryUrl(query);
  const direct=activeRepo?.query===query.trim()?activeRepo.result:undefined;
  $<HTMLButtonElement>('repo-load').hidden=!isRepo;$<HTMLButtonElement>('repo-load').disabled=scanning||busy;
  const target=$('results');target.replaceChildren();const matches=direct?direct.skills:search(library(),query);
  for(const s of (direct?matches:matches.slice(0,100))){
    const row=document.createElement('article');row.className='result';
    const check=document.createElement('input');check.type='checkbox';check.checked=selected.has(skillId(s));check.setAttribute('aria-label','Select '+s.name);check.disabled=busy;
    check.addEventListener('change',()=>{if(check.checked)selected.set(skillId(s),s);else selected.delete(skillId(s));selection();});
    const body=document.createElement('div');body.className='result-content';
    const title=document.createElement('button');title.className='title';title.textContent=s.name;title.addEventListener('click',()=>void showPreview(s));
    const desc=document.createElement('p');desc.className='description';desc.textContent=s.description;
    const meta=document.createElement('div');meta.className='meta';meta.textContent=`${s.repo} · ★ ${s.stars.toLocaleString()} · Repo updated ${s.updatedAt.slice(0,10)}${direct?' · '+s.path:''}${s.nestedUnder?' · Nested skill':''}${s.validationWarnings?.length?' · Review metadata warning':''}`;
    body.append(title,desc,meta);row.append(check,body);target.append(row);
  }
  if(!matches.length){const p=document.createElement('p');p.className='empty';p.textContent=direct?'No SKILL.md found in this repository folder.':isRepo?'Press Enter or Load repository to search this GitHub repository.':'No matching skills. Try another search or paste a GitHub link.';target.append(p);}
  if(!direct&&matches.length>100){const p=document.createElement('p');p.textContent=`Showing 100 of ${matches.length}. Refine your search.`;target.append(p);}selection();
}
async function showPreview(s:SkillRecord){
  const version=++detailVersion;$('results').hidden=true;$('detail').hidden=false;$('detail-name').textContent=s.name;
  $('detail-meta').textContent=`${s.repo} / ${s.path}\nBranch: ${s.branch} · Commit: ${s.commit}\n${s.fileCount-1} supporting files${s.nestedUnder?' · Nested under '+s.nestedUnder:''}${s.validationWarnings?.length?'\nWarning: '+s.validationWarnings.join(' '):''}`;
  $<HTMLAnchorElement>('repo-link').href=`https://github.com/${s.repo}/blob/${s.commit}/${s.path.split('/').map(encodeURIComponent).join('/')}`;
  $('preview').textContent='';$('preview-status').textContent='Fetching exact SKILL.md…';
  try{const text=await client.preview(s);if(version!==detailVersion)return;$('preview').textContent=text;$('preview-status').textContent='Original UTF-8 text. Verified against the pinned source hash.';}
  catch(error){if(version===detailVersion)$('preview-status').textContent=String(error);}
}
async function refresh(force=false){
  const data=await chrome.storage.local.get(['indexUrl','indexSnapshot','githubToken','preparedNames']);
  history=data.preparedNames||[];if(clientToken!==(data.githubToken||'')){clientToken=data.githubToken||'';client=createSkillClient(cache,clientToken);}$<HTMLInputElement>('index-url').value=data.indexUrl||'';$<HTMLInputElement>('token').value=data.githubToken||'';
  if(data.indexUrl){
    try{
      const saved=data.indexSnapshot as IndexSnapshot|undefined;
      const result=await loadIndex(data.indexUrl,force&&saved?{...saved,expiresAt:0}:saved,async url=>new TextDecoder('utf-8',{fatal:true}).decode(await fetchBytes(url,MAX_INDEX_BYTES)));
      index=result.index;await chrome.storage.local.set({indexSnapshot:result.snapshot});
      $('index-status').textContent=`${index.skills.length} skills · ${result.source} · ${index.generatedAt.slice(0,10)}`;
      if(result.warning)status('Using the offline directory cache. '+result.warning);
    }catch(error){status(String(error));$('index-status').textContent='Directory unavailable';return;}
  }else{
    index=parseIndex(await (await fetch(chrome.runtime.getURL('bootstrap-index.json'))).text());
    $('index-status').textContent=`${index.skills.length} skills · bundled snapshot`;
    status('Configure the raw URL of your published index repository for daily directory updates.');
  }
  render();
}
async function openDialog(){await openUploadDialog(chrome.tabs);status('Review Claude’s Skills upload dialog, then return here and click Add.');}
async function download(){
  for(const row of prepared){const url=URL.createObjectURL(new Blob([new Uint8Array(row.bytes).buffer],{type:'application/zip'}));
    try{await chrome.downloads.download({url,filename:'ClaudeSkills/'+row.filename,saveAs:false});}finally{setTimeout(()=>URL.revokeObjectURL(url),60000);}}
}
$('search').addEventListener('input',()=>{detailVersion++;$('detail').hidden=true;$('results').hidden=false;render();});$('back').addEventListener('click',()=>{detailVersion++;$('detail').hidden=true;$('results').hidden=false;});
$('search-form').addEventListener('submit',async event=>{
  event.preventDefault();const query=$<HTMLInputElement>('search').value.trim();if(!repositoryUrl(query)||scanning||busy){render();return;}
  scanning=true;render();$('repo-status').textContent='Reading the repository branch, recursive tree, and skill files…';
  try{
    const result=await client.discover(query);for(const s of result.skills)imported.set(skillId(s),s);activeRepo={query,result};
    $('repo-status').textContent=`${result.skills.length} SKILL.md file(s) in ${result.repo}${result.scope?' / '+result.scope:''} · ${result.branch} @ ${result.commit.slice(0,8)}${result.scope?' · '+result.totalDetected+' in the whole repository':''}.`;
    if($<HTMLInputElement>('search').value.trim()===query){detailVersion++;$('detail').hidden=true;$('results').hidden=false;}
    status('Repository skills use the same checkboxes, original previews, and complete-folder Add flow. Metadata warnings do not change the author’s files.');
  }catch(error){$('repo-status').textContent=error instanceof Error?error.message:String(error);}
  finally{scanning=false;render();}
});
$('refresh').addEventListener('click',()=>void refresh(true).catch(e=>status(String(e))));
function clearIndexError(){$('index-error').hidden=true;$('index-error').textContent='';$<HTMLInputElement>('index-url').removeAttribute('aria-invalid');}
$('index-url').addEventListener('input',clearIndexError);
$('save').addEventListener('click',async()=>{
  const input=$<HTMLInputElement>('index-url');const url=input.value.trim();clearIndexError();
  try{if(url)indexUrl(url);}catch(error){$('index-error').textContent=error instanceof Error?error.message:String(error);$('index-error').hidden=false;input.setAttribute('aria-invalid','true');input.focus();return;}
  try{const token=$<HTMLInputElement>('token').value.trim();if(token&&/[\s\r\n]/.test(token))throw new Error('Token must not contain whitespace');await chrome.storage.local.set({indexUrl:url,githubToken:token});await refresh(true);}catch(error){status(error instanceof Error?error.message:String(error));}
});
$('clear-history').addEventListener('click',async()=>{history=[];await chrome.storage.local.remove('preparedNames');selection();status('Prepared-name history cleared.');});
$('open').addEventListener('click',()=>void openDialog().catch(e=>status(String(e))));$('download').addEventListener('click',()=>void download().catch(e=>status(String(e))));
$('add').addEventListener('click',async()=>{
  if(busy)return;busy=true;render();const batch=[...selected.values()];
  try{
    if(batch.length>30)throw new Error('Choose at most 30 skills per batch.');
    status('Fetching and packaging complete skill folders…');prepared=[];$('download').hidden=true;prepared=await client.build(batch);$('download').hidden=false;
    const outcome=await deliver(prepared,{
      target:async()=>{const tabs=await chrome.tabs.query({url:'https://claude.ai/*',currentWindow:true});return (tabs.find(t=>t.active)||(tabs.length===1?tabs[0]:undefined))?.id;},
      send:(tab,files)=>chrome.tabs.sendMessage(tab,{type:'SKILL_DROP_BATCH',files}),download,open:openDialog
    });
    if(outcome.state==='filled'){
      history=[...history,...batch.map(s=>({id:skillId(s),name:s.name}))].slice(-300);await chrome.storage.local.set({preparedNames:history});
      for(const row of prepared)await cache.delete(row.key);
    }
    status(outcome.message);
  }catch(error){status(String(error));}finally{busy=false;render();}
});
void navigator.storage?.persist().catch(()=>false);void cache.prune().catch(e=>status('Cache unavailable: '+e));void refresh().catch(e=>status(String(e)));
