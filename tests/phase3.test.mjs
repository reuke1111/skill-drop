import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFile,writeFile,mkdir} from 'node:fs/promises';
import {zipSync,strToU8,unzipSync} from 'fflate';
import {indexedDB} from 'fake-indexeddb';
import vm from 'node:vm';
import {buildIndex,candidatesFromList} from '../index-repo/src/build.mjs';
import {verify} from '../index-repo/src/verify.mjs';
import {parse as parseYaml} from 'yaml';
import {parseIndex,search,loadIndex,indexUrl,INDEX_TTL,MAX_INDEX_BYTES,ZipCache,indexedDbStore,fetchBytes,digest,gitBlobHash,validate,createSkillClient,cacheKey,deliver,repositoryUrl} from '../test-build/phase3.mjs';
const record={repo:'owner/repo',path:'skills/demo/SKILL.md',root:'skills/demo',branch:'trunk',commit:'a'.repeat(40),treeSha:'b'.repeat(40),skillSha:'c'.repeat(40),name:'demo',description:'Review documents',stars:10,updatedAt:'2026-10-20T00:00:00Z',fileCount:2,previewSha256:'d'.repeat(64)};
const index={version:1,generatedAt:'2026-10-20T00:00:00Z',skills:[record]};const text=JSON.stringify(index);
const completed=[];
function checked(name,source,fn){test(`${source}: ${name}`,async()=>{await fn();completed.push({test:name,source,status:'PASS'});});}
checked('search name, description, repo; AND terms and case-insensitive matching','fixture',()=>{
  for(const query of ['DEMO','documents','owner/repo','demo review'])assert.equal(search(index,query).length,1);assert.equal(search(index,'missing').length,0);
});
checked('corrupted, oversized and unsafe indexes rejected; untrusted text remains text','fixture',()=>{
  assert.throws(()=>parseIndex('{'),/corrupted/);assert.throws(()=>parseIndex(' '.repeat(MAX_INDEX_BYTES+1)),/2 MB/);
  for(const patch of [{path:'../SKILL.md'},{treeSha:'wrong'},{fileCount:0},{repo:'https://evil.test'},{name:''}])assert.throws(()=>parseIndex(JSON.stringify({...index,skills:[{...record,...patch}]})));
  assert.throws(()=>parseIndex(JSON.stringify({...index,skills:[record,record]})),/Duplicate/);
  assert.equal(parseIndex(JSON.stringify({...index,skills:[{...record,name:'<img src=x onerror=alert(1)>'}]})).skills[0].name,'<img src=x onerror=alert(1)>');
  const forged=parseIndex(JSON.stringify({...index,skills:[{...record,source:'repository',validationWarnings:['forged']}]})).skills[0];assert.equal(forged.source,undefined);assert.equal(forged.validationWarnings,undefined);
});
checked('repository input recognition and index field messages distinguish repo pages from index JSON','fixture',()=>{
  assert.equal(repositoryUrl('owner/repo'),'https://github.com/owner/repo');assert.equal(repositoryUrl('github.com/owner/repo/tree/trunk/folder'),'https://github.com/owner/repo/tree/trunk/folder');assert.equal(repositoryUrl('writing skills'),undefined);
  for(const value of ['owner/repo','not a URL','https://github.com/owner/repo','https://raw.githubusercontent.com/owner/repo/main/README.md'])assert.throws(()=>indexUrl(value),error=>{assert.equal(error.name,'Error');assert.match(error.message,/full URL of skills-index.json/);assert.match(error.message,/raw.githubusercontent.com/);return true;});
  assert.equal(indexUrl(' https://raw.githubusercontent.com/owner/repo/main/skills-index.json '),'https://raw.githubusercontent.com/owner/repo/main/skills-index.json');
});
checked('index TTL prevents fetch; expired cache refreshes; failed or corrupt network falls back offline','mocked',async()=>{
  const url='https://raw.githubusercontent.com/o/r/main/skills-index.json';let calls=0;
  const get=async()=>{calls++;return text;};const snapshot={url,text,expiresAt:100};
  assert.equal((await loadIndex(url,snapshot,get,10)).source,'cache');assert.equal(calls,0);
  const fresh=await loadIndex(url,snapshot,get,200);assert.equal(fresh.source,'network');assert.equal(fresh.snapshot.expiresAt,200+INDEX_TTL);
  for(const get of [async()=>{throw new Error('offline');},async()=>'{',async()=>' '.repeat(MAX_INDEX_BYTES+1)])assert.equal((await loadIndex(url,snapshot,get,200)).source,'offline cache');
  await assert.rejects(loadIndex(url,{...snapshot,text:'bad'},async()=>'{',200),/corrupted/);
  await assert.rejects(loadIndex('https://evil.test/index.json',undefined,get),/raw.githubusercontent/);
});
checked('IndexedDB ZIP round-trip, shared-tree keys, expiry, LRU, capacity and explicit deletion','mocked',async()=>{
  globalThis.indexedDB=indexedDB;const store=indexedDbStore('test-'+crypto.randomUUID());const cache=new ZipCache(store,12,100);
  const row=key=>({key,bytes:new Uint8Array(4),preview:'x',filename:key+'.zip',createdAt:0,accessedAt:0});
  await cache.put(row('a'),1);await cache.put(row('b'),2);assert.ok(await cache.get('a',3));await cache.put(row('c'),4);
  assert.equal(await cache.get('b',5),undefined);assert.ok(await cache.get('a',5));await cache.delete('a');assert.equal(await cache.get('a',6),undefined);assert.equal(await cache.get('c',105),undefined);
  await assert.rejects(cache.put({...row('large'),bytes:new Uint8Array(20)},106),/capacity/);
  assert.notEqual(cacheKey(record),cacheKey({...record,root:'another'}));
});
checked('token sent only to API; rate limits and streamed oversized responses fail clearly','mocked',async()=>{
  const requests=[];const fake=async(url,options)=>{requests.push({url,options});return new Response('ok');};
  for(const host of ['api.github.com','raw.githubusercontent.com','codeload.github.com'])await fetchBytes('https://'+host+'/test',20,'test-token',fake);
  assert.equal(requests[0].options.headers.Authorization,'Bearer test-token');assert.equal(requests[1].options.headers.Authorization,undefined);assert.equal(requests[2].options.headers.Authorization,undefined);assert.ok(requests.every(r=>r.options.redirect==='error'));
  await assert.rejects(fetchBytes('https://evil.test/',10,'test-token',fake),/host/);
  await assert.rejects(fetchBytes('https://api.github.com/test',100,'',async()=>new Response('rate limit',{status:403,headers:{'x-ratelimit-remaining':'0'}})),/rate limit reached/);
  await assert.rejects(fetchBytes('https://raw.githubusercontent.com/o/r/f',1,'',fake),/size limit/);
});
checked('YAML multiline supported, invalid values and executable tags rejected','fixture',()=>{
  assert.deepEqual(validate('---\nname: demo\ndescription: >-\n  First line\n  second line\n---\n').warnings,[]);
  for(const body of ['name: demo\ndescription: [bad]','name: demo\nname: dup\ndescription: text','name: !!js/function x\ndescription: text','name: true\ndescription: text'])assert.ok(validate('---\n'+body+'\n---\n').warnings.length);
});
async function fixtureRepo(){
  const valid=strToU8('---\nname: demo\ndescription: >-\n  Review documents\n---\n');const invalid=strToU8('# Missing frontmatter');
  const child=strToU8('---\nname: child\ndescription: Child skill\n---\n');
  const entries={'skills/demo/SKILL.md':valid,'skills/demo/references/info #.md':strToU8('support'),'skills/demo/child/SKILL.md':child,'skills/invalid/SKILL.md':invalid};
  const tree=[];for(const [path,bytes] of Object.entries(entries))tree.push({path,type:'blob',sha:await gitBlobHash(bytes),size:bytes.length});
  tree.push({path:'skills/demo',type:'tree',sha:'b'.repeat(40)},{path:'skills/demo/child',type:'tree',sha:'e'.repeat(40)},{path:'skills/invalid',type:'tree',sha:'f'.repeat(40)});
  const archive=zipSync(Object.fromEntries(Object.entries(entries).map(([k,v])=>['repo/'+k,v])));
  return {entries,tree,archive};
}
checked('builder discovery, nested records, folder SHAs, invalid skip report, incomplete results and code-search denial','mocked',async()=>{
  const fixture=await fixtureRepo();let archiveCalls=0;
  const json=async url=>{
    if(url.includes('/search/code'))throw new Error('GitHub HTTP 403');
    if(url.includes('/search/repositories'))return {items:[{full_name:'owner/repo'}],incomplete_results:true};
    if(url.includes('/commits/'))return {sha:record.commit,commit:{tree:{sha:'1'.repeat(40)}}};
    if(url.includes('/git/trees/'))return {tree:fixture.tree,truncated:false};
    return {private:false,default_branch:'trunk',stargazers_count:10,pushed_at:record.updatedAt};
  };
  const result=await buildIndex({seeds:['owner/repo'],topics:['claude-skills'],codeSearch:true,curatedLists:[{repo:'list/awesome',path:'README.md'}]}, {json,hasToken:true,bytes:async url=>{if(url.includes('codeload')){archiveCalls++;return fixture.archive;}return strToU8('[repo](https://github.com/owner/repo/tree/trunk/skills/demo)');}});
  assert.equal(archiveCalls,1);assert.equal(result.index.skills.length,2);assert.equal(result.report.skipped.length,1);assert.match(result.report.skipped[0].reason,/frontmatter/);
  assert.equal(result.index.skills.find(s=>s.name==='child').nestedUnder,'skills/demo/SKILL.md');assert.equal(result.index.skills.find(s=>s.name==='demo').treeSha,record.treeSha);assert.ok(result.report.sources.some(s=>s.status==='failed'));assert.ok(result.report.limitations.length);
  assert.deepEqual(candidatesFromList('https://evil.test/x https://github.com/owner/repo/tree/trunk/path https://github.com/owner/repo'),['owner/repo']);
});
checked('Add groups archives per repo/commit, validates supporting hashes and reuses cached ZIPs offline','mocked',async()=>{
  const fixture=await fixtureRepo();const records=[];
  for(const root of ['skills/demo','skills/demo/child']){const bytes=fixture.entries[root+'/SKILL.md'];const md=validate(new TextDecoder().decode(bytes));records.push({...record,root,path:root+'/SKILL.md',treeSha:fixture.tree.find(e=>e.type==='tree'&&e.path===root).sha,skillSha:await gitBlobHash(bytes),previewSha256:await digest(bytes),name:md.name,description:md.description,fileCount:Object.keys(fixture.entries).filter(p=>p.startsWith(root+'/')).length});}
  globalThis.indexedDB=indexedDB;const cache=new ZipCache(indexedDbStore('add-'+crypto.randomUUID()));const calls=[];
  const fake=async url=>{calls.push(url);if(url.includes('codeload'))return new Response(fixture.archive);
    const s=records.find(s=>url.includes(s.treeSha));if(s)return Response.json({tree:fixture.tree.filter(e=>e.path.startsWith(s.root+'/')).map(e=>({...e,path:e.path.slice(s.root.length+1)})),truncated:false});
    throw new Error('Unexpected fetch '+url);
  };
  const built=await createSkillClient(cache,'',fake).build(records);assert.equal(calls.filter(u=>u.includes('codeload')).length,1);assert.equal(built.length,2);assert.notEqual(built[0].filename,built[1].filename);
  assert.equal(Object.keys(unzipSync(built[0].bytes)).length,3);assert.equal(Object.keys(unzipSync(built[1].bytes)).length,1);
  const offline=createSkillClient(cache,'',async()=>{throw new Error('offline');});assert.equal((await offline.build(records)).length,2);assert.match(await offline.preview(records[0]),/name: demo/);
});
checked('direct discovery lists every root including invalid metadata, previews from one archive and reuses it for Add','mocked',async()=>{
  const fixture=await fixtureRepo();const calls=[];
  const fake=async url=>{
    calls.push(String(url));if(url.includes('codeload'))return new Response(fixture.archive);
    if(url.includes('/commits/'))return Response.json({sha:record.commit,commit:{tree:{sha:'1'.repeat(40)}}});
    if(url.includes('/git/trees/'))return Response.json({tree:fixture.tree,truncated:false});
    return Response.json({private:false,full_name:'owner/repo',default_branch:'trunk',stargazers_count:10,pushed_at:record.updatedAt});
  };
  globalThis.indexedDB=indexedDB;const cache=new ZipCache(indexedDbStore('discovery-'+crypto.randomUUID()));const client=createSkillClient(cache,'',fake);
  const result=await client.discover('owner/repo');assert.equal(result.skills.length,3);assert.equal(new Set(result.skills.map(s=>s.root)).size,3);
  const invalid=result.skills.find(s=>s.root==='skills/invalid');assert.ok(invalid.validationWarnings.length);assert.equal(result.skills.find(s=>s.name==='child').nestedUnder,'skills/demo/SKILL.md');
  assert.match(await client.preview(invalid),/Missing frontmatter/);const built=await client.build(result.skills);assert.equal(built.length,3);assert.equal(calls.filter(url=>url.includes('codeload')).length,1);
  assert.equal(calls.filter(url=>url.includes('/git/trees/')).length,1);assert.equal(calls.filter(url=>url.includes('raw.githubusercontent')).length,0);
  const before=calls.length;assert.equal((await client.discover('https://github.com/owner/repo')).skills.length,3);assert.equal(calls.length,before);
  assert.equal(new TextDecoder().decode(unzipSync(built[result.skills.indexOf(invalid)].bytes)['invalid/SKILL.md']),'# Missing frontmatter');
});
checked('normal browser cache quota failure does not block delivery of a verified skill ZIP','mocked',async()=>{
  const fixture=await fixtureRepo();let writes=0;
  const cache={get:async()=>undefined,delete:async()=>undefined,put:async()=>{writes++;throw new DOMException('Quota reached','QuotaExceededError');}};
  const fake=async url=>{
    if(url.includes('codeload'))return new Response(fixture.archive);
    if(url.includes('/commits/'))return Response.json({sha:record.commit,commit:{tree:{sha:'1'.repeat(40)}}});
    if(url.includes('/git/trees/'))return Response.json({tree:fixture.tree,truncated:false});
    return Response.json({private:false,full_name:'owner/repo',default_branch:'trunk',stargazers_count:10,pushed_at:record.updatedAt});
  };
  const client=createSkillClient(cache,'',fake),found=await client.discover('owner/repo');
  const built=await client.build([found.skills.find(s=>s.root==='skills/demo')]);
  assert.equal(writes,1);assert.equal(built.length,1);
  assert.deepEqual(unzipSync(built[0].bytes)['demo/SKILL.md'],fixture.entries['skills/demo/SKILL.md']);
});
checked('direct branch URL resolves slash branch and special path; scans subtree with nested roots only','mocked',async()=>{
  const fixture=await fixtureRepo();fixture.tree=fixture.tree.map(e=>({...e,path:e.path.replace('skills/demo','skills/demo space #')}));fixture.archive=zipSync(Object.fromEntries(Object.entries(fixture.entries).map(([path,bytes])=>['repo/'+path.replace('skills/demo','skills/demo space #'),bytes])));const fake=async url=>{
    if(url.includes('codeload'))return new Response(fixture.archive);
    if(url.includes('/commits/'))return url.endsWith('feature%2Fbranch')?Response.json({sha:record.commit,commit:{tree:{sha:'1'.repeat(40)}}}):new Response('not found',{status:404});
    if(url.includes('/git/trees/'))return Response.json({tree:fixture.tree,truncated:false});
    return Response.json({private:false,full_name:'owner/repo',default_branch:'trunk',stargazers_count:10,pushed_at:record.updatedAt});
  };
  globalThis.indexedDB=indexedDB;const client=createSkillClient(new ZipCache(indexedDbStore('branch-'+crypto.randomUUID())),'',fake);
  const result=await client.discover('https://github.com/owner/repo/tree/feature/branch/skills/demo%20space%20%23');assert.equal(result.branch,'feature/branch');assert.equal(result.scope,'skills/demo space #');assert.equal(result.skills.length,2);assert.equal(result.totalDetected,3);
  const empty=await client.discover('https://github.com/owner/repo/tree/feature/branch/not-here');assert.equal(empty.skills.length,0);
  await assert.rejects(client.discover('https://evil.test/owner/repo'),/github.com/);
});
checked('content script fills one batch; closed dialog and missing input return separate codes; no Upload action','mocked',async()=>{
  const script=await readFile('test-build/content.js','utf8');let listener;const events=[];const input={accept:'.zip,.skill',disabled:false,files:undefined,dispatchEvent:event=>events.push(event.type)};
  let inputs=[input];let hash='#customize/skills/new/upload';let assignments=0;
  Object.defineProperty(input,'files',{get(){return this._files;},set(value){this._files=value;assignments++;}});
  const context={chrome:{runtime:{id:'self',onMessage:{addListener:fn=>listener=fn}}},document:{querySelectorAll:()=>inputs},location:{get href(){return 'https://claude.ai/new'+hash;}},URL,File,Uint8Array,Event,DataTransfer:class{files=[];items={add:file=>this.files.push(file)}}};
  vm.runInNewContext(script,context);
  const call=()=>{let result;listener({type:'SKILL_DROP_BATCH',files:[{name:'a.zip',bytes:[1]},{name:'b.zip',bytes:[2]}]},{id:'self'},r=>result=r);return result;};
  assert.equal(call().count,2);assert.equal(assignments,1);assert.deepEqual(events,['input','change']);inputs=[];assert.equal(call().code,'FIELD_NOT_FOUND');hash='';inputs=[input];assert.equal(call().code,'DIALOG_CLOSED');assert.equal(assignments,1);
  assert.ok(!script.includes('dragstart'));assert.ok(!script.includes('.click('));
});
checked('Add delivery opens no dialog automatically when closed; missing field downloads and opens; partial batches fall back','mocked',async()=>{
  const prepared=[{filename:'a.zip',bytes:new Uint8Array([1])},{filename:'b.zip',bytes:new Uint8Array([2])}];
  for(const variant of ['none','closed','missing','throw','partial','success']){
    const calls=[];
    const outcome=await deliver(prepared,{target:async()=>variant==='none'?undefined:7,send:async(tab,files)=>{calls.push('send');assert.equal(tab,7);assert.equal(files.length,2);if(variant==='throw')throw new Error('no listener');return variant==='success'?{ok:true,count:2}:variant==='partial'?{ok:true,count:1}:{ok:false,code:variant==='closed'?'DIALOG_CLOSED':'FIELD_NOT_FOUND'};},download:async()=>{calls.push('download');},open:async()=>{calls.push('open');}});
    if(['none','closed'].includes(variant)){assert.equal(outcome.state,'needs-dialog');assert.ok(!calls.includes('download'));assert.ok(!calls.includes('open'));}
    else if(variant==='success'){assert.equal(outcome.state,'filled');assert.deepEqual(calls,['send']);}
    else{assert.equal(outcome.state,'downloaded');assert.deepEqual(calls,['send','download','open']);}
  }
});
checked('all-invalid builder run preserves its skip report and refuses empty publication','mocked',async()=>{
  const bytes=strToU8('# No frontmatter');
  const json=async url=>url.includes('/commits/')?{sha:record.commit,commit:{tree:{sha:'a'.repeat(40)}}}:url.includes('/git/trees/')?{tree:[{type:'blob',path:'SKILL.md',sha:await gitBlobHash(bytes),size:bytes.length}],truncated:false}:{private:false,default_branch:'trunk'};
  await assert.rejects(buildIndex({seeds:['owner/repo']},{hasToken:false,json,bytes:async()=>zipSync({'repo/SKILL.md':bytes})}),error=>{assert.match(error.message,/refusing to replace/);assert.equal(error.report.skipped.length,1);assert.match(error.report.skipped[0].reason,/frontmatter/);return true;});
});
checked('daily Action uses manual dispatch, validation and report retention; output verification rejects mismatches','fixture',async()=>{
  const workflow=parseYaml(await readFile('index-repo/.github/workflows/index.yml','utf8'));
  assert.equal(workflow.on.schedule[0].cron,'23 3 * * *');assert.ok('workflow_dispatch' in workflow.on);assert.equal(workflow.permissions.contents,'write');
  const steps=workflow.jobs.index.steps;assert.ok(steps.some(step=>step.run==='npm run build'));assert.ok(steps.some(step=>step.run==='npm run verify'));assert.ok(steps.some(step=>step.if==='always()'&&step.uses==='actions/upload-artifact@v4'));
  const report={generatedAt:index.generatedAt,indexed:1,repos:[{repo:record.repo,commit:record.commit}],skipped:[]};assert.equal(verify(text,JSON.stringify(report)).skills,1);
  assert.throws(()=>verify(text,JSON.stringify({...report,indexed:0})),/disagree/);assert.throws(()=>verify(text,JSON.stringify({...report,repos:[]})),/pinned repository/);
});
test.after(async()=>{await mkdir('artifacts',{recursive:true});await writeFile('artifacts/phase3-unit-results.json',JSON.stringify(completed,null,2));});
