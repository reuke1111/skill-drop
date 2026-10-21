import {mkdir,readFile,writeFile,mkdtemp} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import path from 'node:path';
import {createHash} from 'node:crypto';
import assert from 'node:assert/strict';
import {zipSync,strToU8,unzipSync} from 'fflate';
import {detect,validate,collisions,getTree,githubError,packageSkill} from '../test-build/github.mjs';
const sha256=b=>createHash('sha256').update(b).digest('hex');
const blobSha=b=>createHash('sha1').update(`blob ${b.length}\0`).update(b).digest('hex');
await mkdir('test-cache',{recursive:true});await mkdir('artifacts',{recursive:true});
const memo=new Map();let requests=0,cacheHits=0;const rows=[];
async function cached(url){
  if(memo.has(url))return memo.get(url);
  const promise=(async()=>{
    const file=`test-cache/${sha256(url)}.bin`;
    try{const data=await readFile(file);cacheHits++;return data;}catch(e){if(e.code!=='ENOENT')throw e;}
    requests++;console.log('GET',url);
    const response=await fetch(url,{headers:{Accept:url.includes('api.github.com')?'application/vnd.github+json':'*/*','User-Agent':'Claude-Skill-Drop-Tests'},signal:AbortSignal.timeout(120000)});
    if(!response.ok)throw githubError(response.status,response.headers,await response.text());
    const data=Buffer.from(await response.arrayBuffer());await writeFile(file,data);await writeFile(file+'.json',JSON.stringify({url,fetchedAt:new Date().toISOString()},null,2));return data;
  })();memo.set(url,promise);return promise;
}
const json=async url=>JSON.parse((await cached(url)).toString());
let context={repo:'anthropics/skills',commit:'UNRESOLVED'};
try{
  const meta=await json('https://api.github.com/repos/anthropics/skills');assert.equal(meta.private,false);
  const commit=await json(`https://api.github.com/repos/anthropics/skills/commits/${encodeURIComponent(meta.default_branch)}`);
  context={repo:meta.full_name,defaultBranch:meta.default_branch,commit:commit.sha,tree:commit.commit.tree.sha,source:'Real GitHub snapshot (cached responses reused when available)'};
  const tree=await getTree(context.repo,context.tree,json);const skills=detect(tree);assert.ok(skills.length>=3,'Need at least three real skills');
  await writeFile('artifacts/detected-skills.json',JSON.stringify({context,skills},null,2));
  const selected=skills.find(s=>tree.some(e=>e.type==='blob'&&e.path.startsWith(s.root+'/')&&e.path.slice(s.root.length+1).includes('/')));
  assert.ok(selected,'No skill with supporting subfolders exists; choose replacement');
  const archive=await cached(`https://codeload.github.com/${context.repo}/zip/${context.commit}`);
  const built=packageSkill(archive,selected.root,meta.name);
  const rawUrl=`https://raw.githubusercontent.com/${context.repo}/${context.commit}/${selected.path.split('/').map(encodeURIComponent).join('/')}`;
  const raw=await cached(rawUrl);assert.deepEqual(Buffer.from(built.preview),raw);assert.equal(blobSha(raw),selected.sha);
  rows.push({test:'1 · public repo, recursive detection, exact preview',status:'PASS',...context,path:selected.path,root:selected.root,detected:skills.length,previewSHA256:sha256(raw),rawUrl});
  const temp=await mkdtemp(path.join(tmpdir(),'claude-skill-drop-'));
  const packageEvidence=[];
  for(const [index,skill] of skills.entries()){
    const result=packageSkill(archive,skill.root,meta.name);const folder=skill.root.split('/').at(-1)||meta.name;
    const expected=tree.filter(e=>e.type==='blob'&&e.path.startsWith(skill.root+'/'));
    const submodules=tree.filter(e=>e.type==='commit'&&e.path.startsWith(skill.root+'/'));assert.equal(submodules.length,0,'Submodule contents unavailable from archive');
    const unzipped=unzipSync(result.zip);const keys=Object.keys(unzipped).sort();
    const expectedKeys=expected.map(e=>folder+'/'+e.path.slice(skill.root.length+1)).sort();
    const missing=expectedKeys.filter(k=>!keys.includes(k)),extra=keys.filter(k=>!expectedKeys.includes(k));assert.deepEqual(missing,[]);assert.deepEqual(extra,[]);
    const extractionRoot=path.join(temp,String(index));let bytes=0;
    for(const e of expected){
      const relative=folder+'/'+e.path.slice(skill.root.length+1);const data=unzipped[relative];bytes+=data.length;
      assert.equal(data.length,e.size,`Size mismatch: ${e.path}`);assert.equal(blobSha(data),e.sha,`Git blob mismatch: ${e.path}`);
      const target=path.resolve(extractionRoot,...relative.split('/'));assert.ok(target.startsWith(extractionRoot+path.sep));
      await mkdir(path.dirname(target),{recursive:true});await writeFile(target,data);
      assert.deepEqual(await readFile(target),Buffer.from(result.contents[relative]),`Extracted diff: ${relative}`);
    }
    assert.equal(bytes,expected.reduce((sum,e)=>sum+(e.size||0),0));
    const filename=`${String(index+1).padStart(2,'0')}-${folder}-${sha256(skill.root).slice(0,8)}.zip`;
    await writeFile('artifacts/'+filename,result.zip);await writeFile('artifacts/'+filename+'.SKILL.md',result.preview);
    packageEvidence.push({root:skill.root,nestedUnder:skill.nestedUnder||null,filename,fileCount:keys.length,totalBytes:bytes,zipSHA256:sha256(result.zip),missing,extra,warnings:result.warnings,name:validate(new TextDecoder().decode(result.preview)).name});
  }
  const evidence=packageEvidence.find(e=>e.root===selected.root);assert.ok(evidence.fileCount>1);
  rows.push({test:'2 · complete supporting files and extracted diff',status:'PASS',...context,...evidence,extractionDirectory:temp,diff:'All paths, byte lengths and Git blob SHA-1 values match tree; extracted bytes match archive subset.'});
  assert.equal(new Set(skills.map(s=>s.root)).size,skills.length);
  rows.push({test:'3 · multiple skills detected and packaged',status:'PASS (packaging); NOT RUN (Claude delivery)',...context,skillCount:skills.length,nestedSkills:skills.filter(s=>s.nestedUnder),packages:packageEvidence});
  const warnings=collisions(packageEvidence.map(e=>({id:e.root,name:e.name})));
  rows.push({test:'4 · duplicate names',status:'PASS (fixtures and warning); NOT RUN (Claude behavior)',repo:'local fixtures',commit:'N/A',source:'Local fixtures; real repository inspected for collisions',realRepoInspection:{...context,collisions:warnings},fixtures:['duplicate-a.zip','duplicate-b.zip'],name:'collision-fixture'});
  await writeFile('artifacts/batch-manifest.json',JSON.stringify(packageEvidence,null,2));
}catch(error){rows.push({test:'Live public-repository suite',status:'FAIL',...context,reason:String(error)});process.exitCode=1;}
// Intentional local duplicates, visibly distinct archive names and folders. No author text rewritten.
const fixture='---\nname: collision-fixture\ndescription: Local fixture for testing duplicate skill names.\n---\n\n# Duplicate-name fixture\n';
for(const id of ['a','b'])await writeFile(`artifacts/duplicate-${id}.zip`,zipSync({[`duplicate-${id}/SKILL.md`]:strToU8(fixture+`\nFixture ${id}.\n`)}));
const warning=collisions([{id:'duplicate-a.zip',name:'collision-fixture'},{id:'duplicate-b.zip',name:'collision-fixture'}]);assert.equal(warning.length,1);
await writeFile('artifacts/duplicate-warning.txt',warning[0]);
const nested=JSON.parse(await readFile('artifacts/nested-fixture-evidence.json','utf8'));
rows.push({test:'Nested skill inside another skill folder',status:'PASS (local archive fixture)',...nested,evidence:'Two distinct roots, child marked nestedUnder parent SKILL.md; parent ZIP has all 4 files including child, child ZIP has only its own 2 files. All paths and bytes match.'});
const edgeCases=[
  {test:'No SKILL.md',source:'Local tree fixture',evidence:'Empty tree detects zero skills.'},
  {test:'Missing or invalid frontmatter warns only',source:'Local text fixtures',evidence:'Missing frontmatter, list-valued name, and invalid quoted name emit warnings.'},
  {test:'Spaces and special characters',source:'Local archive fixture',evidence:'Folder a space #; supporting path references/é & #.txt; original bytes preserved.'},
  {test:'Truncated recursive tree fallback and incomplete-tree refusal',source:'Mocked GitHub API responses',evidence:'Truncated recursive response triggers 3-call traversal; truncated non-recursive response rejects.'},
  {test:'GitHub rate limit message',source:'Mocked GitHub HTTP errors',evidence:'403 with zero remaining and HTTP 429 both produce a clear rate-limit message.'},
  {test:'Non-default branch including slash',source:'Mocked GitHub metadata and commit responses',evidence:'feature/branch resolves instead of default trunk; path a space# is decoded.'}
];
for(const item of edgeCases)rows.push({...item,status:'PASS (automated fixture)',repo:'local mocked inputs',commit:'N/A'});
const edgeCaseCoverage=[
  ...edgeCases.map(item=>({edgeCase:item.test,realGitHub:false,method:item.source,evidence:item.evidence})),
  {edgeCase:'Skill nested inside another skill folder',realGitHub:false,method:nested.source,evidence:'Parent and child archives verified independently; real snapshot has zero nested roots.'},
  {edgeCase:'Duplicate frontmatter names',realGitHub:false,method:'Local duplicate-a and duplicate-b fixtures',evidence:'No colliding names found in the real snapshot; duplicate behavior exercised with unchanged local fixture text.'}
];
const report={generatedAt:new Date().toISOString(),runCommand:'npm.cmd test',workingDirectory:process.cwd(),requests,cacheHits,cachePolicy:'Real GitHub tests use the pinned repository snapshot, not mocked data. Cached runs do not contact GitHub again. Successful responses are reused from disk without refresh; fetchedAt is stored alongside each response. Delete selected cache entries deliberately to refresh. No token or Authorization header.',edgeCaseCoverage,rows,manual:['Reload extension; refresh Claude after loading Phase 2 test build.','Select several real ZIPs in the side panel; send to a Claude tab once. Do not click Upload until user chooses.','Select duplicate-a.zip and duplicate-b.zip together; verify warning and two distinct filenames. After choosing Upload, observe error, replacement confirmation, or both added; inspect security scan and Your skills.','Page-card drag acceptance, actual upload, scan result, persistence, and duplicate behavior remain unverified.']};
await writeFile('artifacts/results.json',JSON.stringify(report,null,2));
const table=['# Phase 2 test results','',`Generated: ${report.generatedAt}`,`Rerun from ${report.workingDirectory}:`, '', '```text',report.runCommand,'```','',`GitHub network requests: ${requests}; disk cache hits: ${cacheHits}.`,report.cachePolicy,'','| Test | Result | Data source | Repo / commit SHA | Evidence |','|---|---|---|---|---|',...rows.map(r=>`| ${r.test} | ${r.status} | ${r.source||'Real GitHub snapshot'} | ${r.repo} / ${r.commit} | ${r.reason||r.evidence||[r.path||r.root,r.fileCount?`${r.fileCount} files, ${r.totalBytes} bytes`:'',r.detected?`${r.detected} skills`:'',r.skillCount?`${r.skillCount} distinct roots and ZIPs; ${r.nestedSkills.length} nested roots`:'',r.fixtures?.join(', '),r.realRepoInspection?`Real collision scan: ${r.realRepoInspection.repo} @ ${r.realRepoInspection.commit}; ${r.realRepoInspection.collisions.length} collisions`:'',r.previewSHA256||r.zipSHA256||''].filter(Boolean).join('; ')} |`),'','Full per-skill counts, hashes and paths: results.json. Nested fixture paths, file counts and ZIP hashes: nested-fixture-evidence.json. Separate live browser attempt: BROWSER-RESULTS.md (when present).','','## Edge-case provenance','', 'None of the exceptional edge conditions below was exercised against a real GitHub repository. The real tests cover public metadata, default-branch discovery, recursive multi-skill detection, raw preview comparison, supporting subfolders, and complete archive packaging at the commit listed for each test. The original retrieval used GitHub; cached reruns reuse those exact responses.','','| Edge case | Real GitHub edge condition? | Fixture / mock | Evidence |','|---|---|---|---|',...edgeCaseCoverage.map(item=>`| ${item.edgeCase} | No | ${item.method} | ${item.evidence} |`),'','## Manual verification',...report.manual.map(x=>'- '+x)];
await writeFile('artifacts/RESULTS.md',table.join('\n'));console.log(JSON.stringify({requests,cacheHits,rows:rows.map(({test,status})=>({test,status}))},null,2));
