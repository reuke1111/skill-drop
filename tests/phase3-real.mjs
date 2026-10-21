import {readFile,writeFile,mkdir,copyFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {indexedDB} from 'fake-indexeddb';
import assert from 'node:assert/strict';
import {buildIndex} from '../index-repo/src/build.mjs';
import {parseIndex,search,ZipCache,indexedDbStore,createSkillClient} from '../test-build/phase3.mjs';
const key=url=>createHash('sha256').update(url).digest('hex');
let requests=0,hits=0;const sources=[];const memo=new Map();
async function bytes(url,limit=12*1024*1024){
  if(memo.has(url))return memo.get(url);
  const task=(async()=>{const file='test-cache/'+key(url)+'.bin';
    try{const data=await readFile(file);hits++;const info=JSON.parse(await readFile(file+'.json','utf8'));sources.push({...info,transport:'disk cache'});return data;}catch(e){if(e.code!=='ENOENT')throw e;}
    requests++;console.log('Phase 3 GET',url);const response=await fetch(url,{headers:{'User-Agent':'Claude-Skill-Drop-Tests'},signal:AbortSignal.timeout(60000)});
    if(!response.ok)throw new Error(`GitHub HTTP ${response.status}: ${(await response.text()).slice(0,200)}`);
    const chunks=[];let total=0;for await(const chunk of response.body){total+=chunk.length;if(total>limit)throw new Error('Response exceeds size limit');chunks.push(chunk);}const data=Buffer.concat(chunks);const info={url,fetchedAt:new Date().toISOString()};
    await writeFile(file,data);await writeFile(file+'.json',JSON.stringify(info,null,2));sources.push({...info,transport:'network'});return data;
  })();memo.set(url,task);return task;
}
const json=async url=>JSON.parse((await bytes(url)).toString());let live=[];
try{
  // Bound the test to one packaged repository while exercising real topic and curated-list discovery.
  const {index,report}=await buildIndex({seeds:['anthropics/skills'],topics:['claude-skills'],curatedLists:[{repo:'ComposioHQ/awesome-claude-skills',path:'README.md'}],maxRepos:1,codeSearch:true},{bytes,json,hasToken:false});
  assert.ok(index.skills.length>=3);parseIndex(JSON.stringify(index));assert.ok(report.sources.some(s=>s.label.startsWith('topic:')&&s.status==='ok'));assert.ok(report.sources.some(s=>s.label.includes('README')&&s.status==='ok'));
  await writeFile('artifacts/phase3-test-index.json',JSON.stringify(index));await writeFile('artifacts/phase3-test-skipped.json',JSON.stringify(report,null,2));
  live.push({test:'Index builder, real topic and curated-list discovery',source:'real GitHub (cached snapshot when available)',status:'PASS',repo:'anthropics/skills',commit:index.skills[0].commit,skills:index.skills.length,candidateCount:report.candidateCount,limitations:report.limitations,sourceReports:report.sources});
  assert.equal(search(index,'algorithmic').length,1);
  globalThis.indexedDB=indexedDB;
  const fetcher=async url=>{try{return new Response(await bytes(String(url),50*1024*1024));}catch(error){throw error;}};
  const cache=new ZipCache(indexedDbStore('phase3-real-'+crypto.randomUUID()));const client=createSkillClient(cache,'',fetcher);
  const chosen=['algorithmic-art','brand-guidelines','internal-comms'].map(name=>index.skills.find(s=>s.name===name));assert.ok(chosen.every(Boolean));
  const preview=await client.preview(chosen[0]);const before=sources.filter(s=>s.url.includes('codeload')).length;
  const batch=await client.build(chosen);assert.equal(batch.length,3);assert.equal(new Set(batch.map(r=>r.filename)).size,3);
  const after=sources.filter(s=>s.url.includes('codeload')).length;assert.ok(after-before<=1);
  const offline=createSkillClient(cache,'',async()=>{throw new Error('offline');});assert.equal((await offline.build(chosen)).length,3);assert.equal(await offline.preview(chosen[0]),preview);
  await mkdir('artifacts/phase3-batch',{recursive:true});for(const row of batch)await writeFile('artifacts/phase3-batch/'+row.filename,row.bytes);
  live.push({test:'Three-skill Add packaging, exact preview and offline ZIP reuse',source:'real GitHub snapshot + mocked IndexedDB implementation',status:'PASS (browser-independent); Claude delivery NOT RUN',repo:'anthropics/skills',commit:chosen[0].commit,packages:batch.map((row,i)=>({path:chosen[i].path,treeSha:chosen[i].treeSha,filename:row.filename,fileCount:chosen[i].fileCount,zipBytes:row.bytes.length,zipSHA256:row.zipSha256})),archiveRequests:'One archive URL per repo/commit; successful URL responses memoized'});
}catch(error){live.push({test:'Phase 3 real GitHub integration',source:'real GitHub',status:'FAIL',reason:String(error)});process.exitCode=1;}
const units=JSON.parse(await readFile('artifacts/phase3-unit-results.json','utf8'));
const result={runCommand:'npm.cmd test',generatedAt:new Date().toISOString(),requests,cacheHits:hits,sources,tests:[...live,...units],notVerified:['No Chrome inspection or UI automation performed in Phase 3.','Claude input acceptance, Upload, scan results, installed skill list and duplicate resolution remain manual.','Action execution and raw endpoint hosting require publishing index-repo; neither is claimed deployed.','Authenticated code search is mocked only; no Actions or user token was used.']};
await writeFile('artifacts/phase3-results.json',JSON.stringify(result,null,2));
const md=['# Phase 3 results','',`Rerun from project directory: \`${result.runCommand}\``, '',`GitHub network requests: ${requests}; disk cache hits: ${hits}.`,'','| Test | Status | Source | Commit / evidence |','|---|---|---|---|',...result.tests.map(t=>`| ${t.test} | ${t.status} | ${t.source} | ${t.commit||t.reason||'Local fixture / mock; no live commit'}${t.skills?`; ${t.skills} skills; ${t.candidateCount} candidate repos`:''} |`),'','## Limits','',...result.notVerified.map(x=>'- '+x),'','Complete per-source fetch times, pinned commits, package paths and hashes: phase3-results.json. Previous suite: RESULTS.md.'];
await writeFile('artifacts/PHASE3-RESULTS.md',md.join('\n'));
console.log(JSON.stringify({phase3:result.tests.map(t=>({test:t.test,status:t.status})),requests,cacheHits:hits},null,2));
