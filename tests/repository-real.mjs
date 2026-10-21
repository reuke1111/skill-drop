import {readFile,writeFile,mkdir} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {indexedDB} from 'fake-indexeddb';
import {unzipSync} from 'fflate';
import assert from 'node:assert/strict';
import {ZipCache,indexedDbStore,createSkillClient} from '../test-build/phase3.mjs';
let requests=0,hits=0;const sources=[];const memo=new Map();
async function fetcher(url){
  url=String(url);if(memo.has(url)){const item=await memo.get(url);return new Response(item.bytes,{status:item.status,headers:item.headers});}
  const pending=(async()=>{
    const file='test-cache/'+createHash('sha256').update(url).digest('hex')+'.bin';
    try{const bytes=await readFile(file);hits++;const info=JSON.parse(await readFile(file+'.json','utf8'));sources.push({...info,transport:'disk cache'});return {bytes,status:info.status||200,headers:info.headers};}catch(error){if(error.code!=='ENOENT')throw error;}
    console.log('Direct repo GET',url);requests++;const response=await fetch(url,{headers:{'User-Agent':'Claude-Skill-Drop-Tests'},redirect:'error',signal:AbortSignal.timeout(60000)});
    let total=0;const chunks=[];for await(const chunk of response.body){total+=chunk.length;if(total>50*1024*1024)throw new Error('Test input exceeds 50 MB');chunks.push(chunk);}
    const bytes=Buffer.concat(chunks);const info={url,fetchedAt:new Date().toISOString(),status:response.status,headers:Object.fromEntries(response.headers)};await writeFile(file,bytes);await writeFile(file+'.json',JSON.stringify(info,null,2));sources.push({...info,transport:'network'});return {bytes,status:response.status,headers:info.headers};
  })();memo.set(url,pending);const item=await pending;return new Response(item.bytes,{status:item.status,headers:item.headers});
}
const result={generatedAt:new Date().toISOString(),source:'real GitHub snapshot; transport cached where available; mocked IndexedDB',tests:[]};
try{
  globalThis.indexedDB=indexedDB;const client=createSkillClient(new ZipCache(indexedDbStore('direct-real-'+crypto.randomUUID())),'',fetcher);
  const repo=await client.discover('sergebulaev/linkedin-skills');assert.ok(repo.skills.length>1);assert.equal(new Set(repo.skills.map(s=>s.path)).size,repo.skills.length);
  const preview=await client.preview(repo.skills[0]);const path=repo.skills[0].path;const rawUrl=`https://raw.githubusercontent.com/${repo.repo}/${repo.commit}/${path.split('/').map(encodeURIComponent).join('/')}`;
  assert.equal(preview,new TextDecoder('utf-8',{fatal:true}).decode(await (await fetcher(rawUrl)).arrayBuffer()));
  const chosen=repo.skills.filter(s=>s.root&&!(s.validationWarnings||[]).length).slice(0,2);assert.equal(chosen.length,2);
  const batch=await client.build(chosen);assert.equal(batch.length,2);assert.notEqual(batch[0].filename,batch[1].filename);
  for(let i=0;i<batch.length;i++)assert.equal(Object.keys(unzipSync(batch[i].bytes)).length,chosen[i].fileCount);
  const before=sources.filter(s=>s.url.includes('codeload')).length;
  const scoped=await client.discover(`https://github.com/${repo.repo}/tree/${encodeURIComponent(repo.branch)}/${chosen[0].root.split('/').map(encodeURIComponent).join('/')}`);
  assert.ok(scoped.skills.some(s=>s.path===chosen[0].path));assert.ok(scoped.skills.every(s=>s.root===chosen[0].root||s.root.startsWith(chosen[0].root+'/')));
  assert.equal(sources.filter(s=>s.url.includes('codeload')).length,before);assert.equal(before,1);
  await mkdir('artifacts/direct-repo-batch',{recursive:true});for(const row of batch)await writeFile('artifacts/direct-repo-batch/'+row.filename,row.bytes);
  const names=new Map();for(const s of repo.skills)names.set(s.name,[...(names.get(s.name)||[]),s.path]);
  result.tests.push({test:'Direct owner/repo, raw preview equality, two-skill ZIP build, and tree URL scope',status:'PASS',repo:repo.repo,branch:repo.branch,commit:repo.commit,detected:repo.skills.length,paths:repo.skills.map(s=>s.path),nestedRoots:repo.skills.filter(s=>s.nestedUnder).map(s=>({path:s.path,nestedUnder:s.nestedUnder})),collidingNames:[...names].filter(([,paths])=>paths.length>1).map(([name,paths])=>({name,paths})),warnings:repo.skills.filter(s=>s.validationWarnings?.length).map(s=>({path:s.path,warnings:s.validationWarnings})),packages:batch.map((row,i)=>({path:chosen[i].path,filename:row.filename,fileCount:chosen[i].fileCount,sha256:row.zipSha256})),archiveDownloads:1,scope:scoped.scope});
}catch(error){result.tests.push({test:'Direct repository integration',status:'FAIL',reason:String(error)});process.exitCode=1;}
Object.assign(result,{requests,cacheHits:hits,sources});await writeFile('artifacts/direct-repo-results.json',JSON.stringify(result,null,2));
await writeFile('artifacts/DIRECT-REPO-RESULTS.md',['# Direct repository results','', 'Run from project directory: `npm.cmd test`.','',`Network requests: ${requests}; cache hits: ${hits}.`,'',...result.tests.map(t=>`- ${t.status}: ${t.test}. ${t.repo||''} ${t.commit||t.reason||''}${t.detected?'; '+t.detected+' distinct SKILL.md files; 1 archive download; 2 ZIPs verified.':''}`),'','Full paths, hashes, source fetch times and warnings: direct-repo-results.json. Branches containing slashes, special paths, no skills, and invalid metadata are additionally covered by mocked tests. UI interaction uses a local mocked DOM, not Chrome.','', 'User-confirmed evidence: uploads of 1 and 2 skills from anthropics/skills work. This does not claim a live upload of this new repository.'].join('\n'));
console.log(JSON.stringify(result.tests,null,2));
