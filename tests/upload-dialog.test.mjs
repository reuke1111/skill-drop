import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFile,writeFile} from 'node:fs/promises';
import vm from 'node:vm';
import {openUploadDialog,UPLOAD_URL} from '../test-build/phase3.mjs';
const evidence=[];
function mocked(tabs,states=[{ready:true}],currentWindow=10){
  const calls=[];let index=0;
  const api={
    query:async query=>{calls.push({method:'query',query});assert.deepEqual(query,{currentWindow:true});return tabs.filter(tab=>tab.windowId===currentWindow);},
    update:async(id,changes)=>{calls.push({method:'update',id,changes});},
    create:async properties=>{calls.push({method:'create',properties});},
    reload:async id=>{calls.push({method:'reload',id});},
    sendMessage:async(id,message)=>{calls.push({method:'sendMessage',id,message});const state=states[Math.min(index++,states.length-1)];if(state instanceof Error)throw state;return state;}
  };
  const pause=async milliseconds=>{calls.push({method:'wait',milliseconds});};return {api,calls,pause};
}
function tab(id,active,url,windowId=10){return {id,active,url,windowId};}
async function check(name,run,source='mocked tab lists / content script'){await run();evidence.push({test:name,source,status:'PASS'});}
test('mocked tabs case 1: focus active upload tab without navigation, probing, reloading or creating',()=>check('1: active upload tab',async()=>{
  const mock=mocked([tab(2,false,UPLOAD_URL),tab(1,true,UPLOAD_URL)]);
  assert.equal((await openUploadDialog(mock.api,mock.pause)).action,'focused-active');
  assert.deepEqual(mock.calls,[{method:'query',query:{currentWindow:true}},{method:'update',id:1,changes:{active:true}}]);
}));
test('mocked tabs case 2: activate existing upload tab before considering the active /new tab',()=>check('2: another upload tab in this window',async()=>{
  const mock=mocked([tab(1,true,'https://claude.ai/new'),tab(2,false,UPLOAD_URL)]);
  assert.equal((await openUploadDialog(mock.api,mock.pause)).action,'activated-existing');
  assert.deepEqual(mock.calls,[{method:'query',query:{currentWindow:true}},{method:'update',id:2,changes:{active:true}}]);
}));
test('mocked tabs case 3: reuse active /new and avoid reload when the dialog field appears',()=>check('3: active /new with successful hash navigation',async()=>{
  const mock=mocked([tab(1,true,'https://claude.ai/new#customize')],[{ready:false},{ready:true}]);
  assert.deepEqual(await openUploadDialog(mock.api,mock.pause),{action:'reused-new',reloaded:false});
  assert.deepEqual(mock.calls.find(call=>call.method==='update'),{method:'update',id:1,changes:{url:UPLOAD_URL,active:true}});
  assert.equal(mock.calls.filter(call=>call.method==='sendMessage').length,2);
  assert.ok(!mock.calls.some(call=>['reload','create'].includes(call.method)));
}));
test('mocked tabs case 3 fallback: reload the same tab once when the field stays unavailable',()=>check('3: one reload after failed dialog readiness checks',async()=>{
  for(const state of [{ready:false},new Error('Receiving end does not exist')]){
    const mock=mocked([tab(1,true,'https://claude.ai/new')],[state]);
    assert.deepEqual(await openUploadDialog(mock.api,mock.pause),{action:'reused-new',reloaded:true});
    assert.deepEqual(mock.calls.find(call=>call.method==='update').changes,{url:UPLOAD_URL,active:true});
    assert.equal(mock.calls.filter(call=>call.method==='sendMessage').length,6);
    assert.deepEqual(mock.calls.filter(call=>call.method==='reload'),[{method:'reload',id:1}]);
    assert.ok(!mock.calls.some(call=>call.method==='create'));
  }
}));
test('mocked tabs case 4: existing chats and unrelated/missing URLs get a new tab; other windows are ignored',()=>check('4: create without navigating existing chats',async()=>{
  for(const url of ['https://claude.ai/chat/existing','https://claude.ai/new/chat/existing','https://claude.ai/','https://example.com','https://claude.ai.evil.test/new',undefined]){
    const mock=mocked([tab(1,true,url),tab(2,false,'https://claude.ai/new'),tab(3,false,UPLOAD_URL,20)]);
    assert.deepEqual(await openUploadDialog(mock.api,mock.pause),{action:'created',reloaded:false});
    assert.deepEqual(mock.calls,[{method:'query',query:{currentWindow:true}},{method:'create',properties:{url:UPLOAD_URL,active:true}}]);
  }
}));
test('mocked tabs: a pending chat navigation is not replaced using its old /new URL',()=>check('Pending chat navigation is preserved',async()=>{
  const mock=mocked([{...tab(1,true,'https://claude.ai/new'),pendingUrl:'https://claude.ai/chat/opening'}]);
  assert.equal((await openUploadDialog(mock.api,mock.pause)).action,'created');assert.ok(!mock.calls.some(call=>call.method==='update'));
}));
test('mocked content script: readiness probe checks route and field without assigning a FileList',()=>check('Readiness probe is read-only',async()=>{
  const script=await readFile('test-build/content.js','utf8');let listener,assignments=0,url=UPLOAD_URL;
  const input={accept:'.zip,.skill',disabled:false,set files(value){assignments++;},dispatchEvent(){throw new Error('Probe must not dispatch file events');}};let inputs=[input];
  vm.runInNewContext(script,{chrome:{runtime:{id:'self',onMessage:{addListener:fn=>listener=fn}}},document:{querySelectorAll:()=>inputs},location:{get href(){return url;}},URL});
  const probe=()=>{let response;listener({type:'SKILL_DROP_DIALOG_STATUS'},{id:'self'},result=>response=result);return response;};
  assert.equal(probe().ready,true);inputs=[];assert.equal(probe().ready,false);inputs=[input];url='https://claude.ai/new';assert.equal(probe().ready,false);assert.equal(assignments,0);
}));
test('fixture: release uses only required permissions; tab reuse needs no tabs or scripting permission',()=>check('Minimal release permission set',async()=>{
  const manifest=JSON.parse(await readFile('manifest.json','utf8'));
  assert.deepEqual(manifest.permissions,['sidePanel','downloads','storage']);
  assert.deepEqual(manifest.host_permissions,['https://claude.ai/*','https://api.github.com/*','https://raw.githubusercontent.com/*','https://codeload.github.com/*']);
},'fixture'));
test.after(async()=>{await writeFile('artifacts/upload-dialog-results.json',JSON.stringify(evidence,null,2));});
