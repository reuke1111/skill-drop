import {readFile,writeFile,mkdir} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {fileURLToPath} from 'node:url';
import path from 'node:path';
import {detect,getTree,validate,parseIndex,unzipSync,githubError} from '../lib/core.mjs';
const hash=b=>createHash('sha256').update(b).digest('hex');
const repoPattern=/^[A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+$/;
export function candidatesFromList(text){
  return [...new Set([...text.matchAll(/https:\/\/github\.com\/([A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+)(?=[/#)?\s]|$)/g)].map(m=>m[1].replace(/\.git$/,'')))];
}
export async function buildIndex(config,io){
  const report={generatedAt:new Date().toISOString(),skipped:[],sources:[],repos:[],limitations:[],candidateCount:0};
  const candidates=new Set((config.seeds||[]).filter(r=>repoPattern.test(r)));
  async function discover(label,url){
    try{const result=await io.json(url);if(result.incomplete_results)report.limitations.push(`${label}: GitHub returned incomplete_results.`);
      if(result.total_count>(result.items?.length||0))report.limitations.push(`${label}: ${result.items?.length||0} results in this page of ${result.total_count} matches; configured pagination is bounded (GitHub also caps each search at 1,000 results).`);
      for(const item of result.items||[]){const repo=item.repository?.full_name||item.full_name;if(repoPattern.test(repo))candidates.add(repo);}
      report.sources.push({label,status:'ok',items:result.items?.length||0,totalCount:result.total_count});
    }catch(error){report.sources.push({label,status:'failed',error:String(error)});}
  }
  for(const topic of config.topics||[])for(let page=1;page<=Math.min(config.maxSearchPages||1,10);page++)await discover(`topic:${topic} page ${page}`,`https://api.github.com/search/repositories?q=${encodeURIComponent('topic:'+topic+' archived:false')}&sort=stars&per_page=100&page=${page}`);
  if(config.codeSearch&&io.hasToken)await discover('optional authenticated code search',`https://api.github.com/search/code?q=${encodeURIComponent('skill filename:SKILL.md')}&per_page=100`);
  else report.sources.push({label:'code search',status:'skipped',reason:'No token; anonymous code search is not assumed to work.'});
  for(const list of config.curatedLists||[]){
    try{
      if(!repoPattern.test(list.repo))throw new Error('Invalid curated repository');
      const meta=await io.json(`https://api.github.com/repos/${list.repo}`);
      const url=`https://raw.githubusercontent.com/${list.repo}/${encodeURIComponent(meta.default_branch)}/${list.path.split('/').map(encodeURIComponent).join('/')}`;
      const found=candidatesFromList(new TextDecoder().decode(await io.bytes(url,2*1024*1024)));found.forEach(repo=>candidates.add(repo));
      report.sources.push({label:list.repo+'/'+list.path,status:'ok',candidates:found.length});
    }catch(error){report.sources.push({label:'curated list',status:'failed',error:String(error)});}
  }
  report.candidateCount=candidates.size;const maxRepos=Math.max(1,Math.min(config.maxRepos||8,100));
  if(candidates.size>maxRepos)report.limitations.push(`Repository cap ${maxRepos}: ${candidates.size-maxRepos} candidates deferred. This is a bounded directory, not exhaustive GitHub coverage.`);
  const skills=[];
  for(const repo of [...candidates].slice(0,maxRepos)){
    io.onProgress?.(`Indexing ${repo}`);
    let commit;
    try{
      const meta=await io.json(`https://api.github.com/repos/${repo}`);if(meta.private)throw new Error('Private repositories are excluded.');
      const revision=await io.json(`https://api.github.com/repos/${repo}/commits/${encodeURIComponent(meta.default_branch)}`);commit=revision.sha;
      const tree=await getTree(repo,revision.commit.tree.sha,io.json);
      const detected=detect(tree);report.repos.push({repo,branch:meta.default_branch,commit,detected:detected.length});if(!detected.length)continue;
      const archive=await io.bytes(`https://codeload.github.com/${repo}/zip/${commit}`,50*1024*1024);
      let inflated=0;const files=unzipSync(archive,{filter:f=>{inflated+=f.originalSize;if(inflated>150*1024*1024||f.originalSize>32*1024*1024)throw new Error('Archive extraction limit exceeded');return true;}});
      const top=Object.keys(files)[0]?.split('/')[0];
      for(const skill of detected){
        try{
          const bytes=files[top+'/'+skill.path];if(!bytes||bytes.length>512*1024)throw new Error('SKILL.md missing, unreadable, or larger than 512 KB');
          const text=new TextDecoder('utf-8',{fatal:true}).decode(bytes);const metadata=validate(text);
          if(metadata.warnings.length)throw new Error(metadata.warnings.join(' '));
          const members=tree.filter(e=>e.type==='blob'&&(!skill.root||e.path.startsWith(skill.root+'/')));
          if(tree.some(e=>e.type==='commit'&&(!skill.root||e.path.startsWith(skill.root+'/'))))throw new Error('Skill has submodules; complete packaging cannot be guaranteed.');
          for(const member of members){const data=files[top+'/'+member.path];if(!data||data.length!==member.size||createHash('sha1').update(`blob ${data.length}\0`).update(data).digest('hex')!==member.sha)throw new Error(`Archive/tree mismatch: ${member.path}`);}
          const treeSha=skill.root?tree.find(e=>e.type==='tree'&&e.path===skill.root)?.sha:revision.commit.tree.sha;
          if(!treeSha)throw new Error('Skill folder tree SHA missing');
          const record={repo,path:skill.path,root:skill.root,branch:meta.default_branch,commit,treeSha,skillSha:skill.sha,name:metadata.name,description:metadata.description,stars:meta.stargazers_count,updatedAt:meta.pushed_at,fileCount:members.length,previewSha256:hash(bytes),...(skill.nestedUnder?{nestedUnder:skill.nestedUnder}:{})};
          parseIndex(JSON.stringify({version:1,generatedAt:report.generatedAt,skills:[record]}));
          if(skills.length>=Math.min(config.maxSkills||1500,5000))throw new Error('Index skill-count cap reached');
          skills.push(record);
        }catch(error){report.skipped.push({repo,commit,path:skill.path,reason:String(error)});}
      }
    }catch(error){report.skipped.push({repo,commit:commit||null,reason:String(error)});}
  }
  const index={version:1,generatedAt:report.generatedAt,skills:skills.sort((a,b)=>b.stars-a.stars||`${a.repo}/${a.path}`.localeCompare(`${b.repo}/${b.path}`))};
  while(Buffer.byteLength(JSON.stringify(index))>2*1024*1024){const record=index.skills.pop();report.skipped.push({repo:record.repo,path:record.path,commit:record.commit,reason:'2 MB index-size cap reached'});}
  parseIndex(JSON.stringify(index));report.indexed=index.skills.length;
  if(!index.skills.length)throw Object.assign(new Error('No valid skills indexed; refusing to replace the published snapshot.'),{report});
  return {index,report};
}
export async function main(options={}){
  const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');const config=JSON.parse(await readFile(path.join(root,'config.json'),'utf8'));
  const token=options.token??process.env.GITHUB_TOKEN??'';const memo=new Map();let apiCalls=0,lastSearch=0;
  const bytes=async(url,limit=8*1024*1024)=>{
    if(memo.has(url))return memo.get(url);
    const task=(async()=>{const u=new URL(url);if(!['api.github.com','raw.githubusercontent.com','codeload.github.com'].includes(u.hostname))throw new Error('Unexpected source host');
      if(u.hostname==='api.github.com'&&++apiCalls>(token?800:45))throw new Error('API request budget reached; remaining repositories deferred.');
      if(u.pathname.startsWith('/search/')){const wait=6100-(Date.now()-lastSearch);if(wait>0)await new Promise(resolve=>setTimeout(resolve,wait));lastSearch=Date.now();}
      const response=await fetch(url,{headers:{'User-Agent':'Claude-Skill-Drop-Indexer',...(u.hostname==='api.github.com'?{Accept:'application/vnd.github+json',...(token?{Authorization:'Bearer '+token}:{})}:{})},redirect:'error',signal:AbortSignal.timeout(60000)});
      if(!response.ok)throw githubError(response.status,response.headers,await response.text());
      if(Number(response.headers.get('content-length')||0)>limit)throw new Error('Response too large');const chunks=[];let size=0;
      for await(const chunk of response.body){size+=chunk.length;if(size>limit)throw new Error('Response too large');chunks.push(chunk);}return Buffer.concat(chunks);
    })();memo.set(url,task);return task;
  };
  let result;
  try{result=await buildIndex(config,{bytes,json:async url=>JSON.parse((await bytes(url)).toString()),hasToken:!!token,onProgress:message=>console.log(message)});}
  catch(error){await writeFile(path.join(root,'skipped-skills.json'),JSON.stringify(error.report||{error:String(error)},null,2));throw error;}
  const {index,report}=result;
  await writeFile(path.join(root,'skills-index.json'),JSON.stringify(index));await writeFile(path.join(root,'skipped-skills.json'),JSON.stringify(report,null,2));console.log(`Indexed ${index.skills.length} skills; ${report.skipped.length} skipped. API calls: ${apiCalls}`);
}
if(process.argv[1]&&path.resolve(process.argv[1])===fileURLToPath(import.meta.url))await main();
