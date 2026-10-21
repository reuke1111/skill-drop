import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {parseHTML} from 'linkedom';
import {indexedDB} from 'fake-indexeddb';
import {zipSync,strToU8} from 'fflate';
import vm from 'node:vm';
import {gitBlobHash} from '../test-build/phase3.mjs';
async function until(predicate){const deadline=Date.now()+5000;while(Date.now()<deadline){if(predicate())return;await new Promise(resolve=>setTimeout(resolve,5));}throw new Error('Panel did not reach expected mocked state');}
async function panel(count=2,tabs=[]){
  const {document,Event}=parseHTML(await readFile('panel.html','utf8'));const state={};let network=0;
  const files={'repo/skills/one/SKILL.md':strToU8('---\nname: one\ndescription: "<img src=x onerror=bad()>"\n---\nOriginal text\n'),'repo/skills/two/SKILL.md':strToU8('---\nname: two\ndescription: second skill\n---\n')};
  for(let i=2;i<count;i++)files[`repo/skills/extra-${i}/SKILL.md`]=strToU8(`---\nname: extra-${i}\ndescription: Additional skill\n---\n`);
  const tree=[];for(const [path,bytes] of Object.entries(files))tree.push({path:path.slice(5),type:'blob',sha:await gitBlobHash(bytes),size:bytes.length});
  tree.push({path:'skills/one',type:'tree',sha:'b'.repeat(40)},{path:'skills/two',type:'tree',sha:'c'.repeat(40)});
  for(let i=2;i<count;i++)tree.push({path:`skills/extra-${i}`,type:'tree',sha:i.toString(16).padStart(40,'0')});
  const fetcher=async url=>{network++;if(url==='extension://bootstrap-index.json')return Response.json({version:1,generatedAt:new Date().toISOString(),skills:[]});
    if(url.includes('codeload'))return new Response(zipSync(files));
    if(url.includes('/commits/'))return Response.json({sha:'a'.repeat(40),commit:{tree:{sha:'d'.repeat(40)}}});
    if(url.includes('/git/trees/'))return Response.json({tree,truncated:false});
    return Response.json({full_name:'owner/repo',default_branch:'trunk',private:false,stargazers_count:2,pushed_at:'2026-10-21T00:00:00Z'});
  };
  const tabCalls=[];
  const chrome={storage:{local:{get:async()=>structuredClone(state),set:async patch=>Object.assign(state,patch),remove:async key=>{delete state[key];}}},runtime:{getURL:file=>'extension://'+file},tabs:{query:async query=>{tabCalls.push({method:'query',query});return tabs;},update:async(id,changes)=>{tabCalls.push({method:'update',id,changes});},create:async properties=>{tabCalls.push({method:'create',properties});return {id:1};},reload:async id=>{tabCalls.push({method:'reload',id});},sendMessage:async()=>({ready:true})}};
  vm.runInNewContext(await readFile('test-build/panel.js','utf8'),{document,Event,chrome,indexedDB,fetch:fetcher,crypto,URL,Blob,Uint8Array,TextEncoder,TextDecoder,AbortSignal,navigator:{storage:{persist:async()=>false}},setTimeout,clearTimeout,console});
  await until(()=>document.getElementById('index-status').textContent.includes('bundled snapshot'));
  const event=(id,type)=>document.getElementById(id).dispatchEvent(new Event(type,{bubbles:true,cancelable:true}));
  return {document,event,state,network:()=>network,until,tabCalls};
}
test('mocked DOM: repo input waits for Enter, lists checkbox results, previews safely and uses the existing Add flow',async()=>{
  const p=await panel();const get=id=>p.document.getElementById(id);const before=p.network();
  get('search').value='owner/repo';p.event('search','input');assert.equal(p.network(),before);assert.equal(get('repo-load').hidden,false);
  p.event('search-form','submit');await p.until(()=>get('repo-status').textContent.startsWith('2 SKILL.md'));
  assert.equal(get('results').querySelectorAll('input[type=checkbox]').length,2);assert.equal(p.document.querySelectorAll('img').length,0);
  get('results').querySelector('button.title').dispatchEvent(new p.document.defaultView.Event('click'));
  await p.until(()=>get('preview').textContent.includes('Original text'));assert.match(get('preview').textContent,/<img/);assert.equal(get('detail').querySelectorAll('img').length,0);
  p.event('back','click');const check=get('results').querySelector('input[type=checkbox]');check.checked=true;check.dispatchEvent(new p.document.defaultView.Event('change'));assert.equal(get('add').disabled,false);
  p.event('add','click');await p.until(()=>get('status').textContent.includes('Prepared ZIPs remain available'));assert.match(get('status').textContent,/Open the upload dialog/);
});
test('mocked DOM: index field uses requested label and gives a clear inline message for owner/repo',async()=>{
  const p=await panel();const get=id=>p.document.getElementById(id);
  assert.equal(p.document.querySelector('label[for="index-url"]').textContent,'Index file URL (raw.githubusercontent.com, skills-index.json)');
  get('index-url').value='owner/repo';p.event('save','click');await p.until(()=>get('index-error').hidden===false);
  assert.match(get('index-error').textContent,/full URL of skills-index.json/);assert.ok(!get('index-error').textContent.includes('TypeError'));assert.equal(p.state.indexUrl,undefined);
});
test('mocked DOM: direct repository results show every detected skill beyond the directory 100-result cap',async()=>{
  const p=await panel(105);const get=id=>p.document.getElementById(id);get('search').value='owner/repo';p.event('search','input');p.event('search-form','submit');
  await p.until(()=>get('repo-status').textContent.startsWith('105 SKILL.md'));assert.equal(get('results').querySelectorAll('input[type=checkbox]').length,105);
});
test('mocked DOM: Open upload dialog button activates an existing upload tab through the shared opener',async()=>{
  const p=await panel(2,[{id:1,active:true,url:'https://claude.ai/chat/existing'},{id:8,active:false,url:'https://claude.ai/new#customize/skills/new/upload'}]);
  p.event('open','click');await p.until(()=>p.tabCalls.some(call=>call.method==='update'));
  const update=p.tabCalls.find(call=>call.method==='update');assert.equal(update.id,8);assert.equal(update.changes.active,true);assert.deepEqual(Object.keys(update.changes),['active']);assert.ok(!p.tabCalls.some(call=>call.method==='create'));
});
