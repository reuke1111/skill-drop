import {detect,getTree,resolveUrl,unpackArchive,validate,type GetJson,type Entry} from './github';
import {type SkillRecord} from './index';
import {digest,gitBlobHash} from './network';
export function repositoryUrl(input:string):string|undefined {
  const value=input.trim();
  if(/^[-A-Za-z0-9_.]+\/[-A-Za-z0-9_.]+\/?$/.test(value))return 'https://github.com/'+value.replace(/\/$/,'');
  if(/^https?:\/\//i.test(value)||/^github\.com\//i.test(value))return /^github\.com\//i.test(value)?'https://'+value:value;
  return undefined;
}
export const fallbackSkillName=(root:string,repo:string)=>root.split('/').at(-1)||repo.split('/')[1];
export const missingDescription='No valid description found. Review the original SKILL.md.';
export type RepositoryResult={repo:string;branch:string;commit:string;scope:string;totalDetected:number;skills:SkillRecord[];previews:Map<string,string>;trees:Map<string,Entry[]>};
export async function discoverRepository(input:string,io:{json:GetJson;archive(url:string):Promise<Uint8Array>}):Promise<RepositoryResult>{
  const url=repositoryUrl(input);if(!url)throw new Error('Paste a GitHub repository link, then press Enter.');
  const resolved=await resolveUrl(url,io.json);
  if(resolved.path.split('/').some(p=>p==='.'||p==='..'||p.includes('\\'))||/[\u0000-\u001f]/.test(resolved.path))throw new Error('The repository folder path is invalid.');
  const meta=await io.json(`https://api.github.com/repos/${resolved.repo}`);if(meta.private)throw new Error('Only public repositories are supported.');
  const revision=await io.json(`https://api.github.com/repos/${resolved.repo}/commits/${encodeURIComponent(resolved.ref)}`);
  const tree=await getTree(resolved.repo,revision.commit.tree.sha,io.json);
  const all=detect(tree);const detected=all.filter(s=>!resolved.path||s.root===resolved.path||s.root.startsWith(resolved.path+'/'));
  const result:RepositoryResult={repo:meta.full_name||resolved.repo,branch:resolved.ref,commit:revision.sha,scope:resolved.path,totalDetected:all.length,skills:[],previews:new Map(),trees:new Map()};
  if(!detected.length)return result;
  const files=unpackArchive(await io.archive(`https://codeload.github.com/${resolved.repo}/zip/${revision.sha}`));
  const top=Object.keys(files)[0]?.split('/')[0];
  for(const skill of detected){
    const bytes=files[top+'/'+skill.path];
    if(!bytes)throw new Error('Repository archive is missing '+skill.path);
    if(await gitBlobHash(bytes)!==skill.sha)throw new Error('Repository tree and archive disagree for '+skill.path);
    let text='';let warnings:string[]=[];let metadata:ReturnType<typeof validate>={warnings:[]};
    try{if(bytes.length>512*1024)throw new Error('SKILL.md exceeds the 512 KiB preview limit.');text=new TextDecoder('utf-8',{fatal:true}).decode(bytes);metadata=validate(text);warnings=metadata.warnings;}
    catch(error){warnings=[String(error)];}
    const members=tree.filter(e=>e.type==='blob'&&(!skill.root||e.path.startsWith(skill.root+'/')));
    if(tree.some(e=>e.type==='commit'&&(!skill.root||e.path.startsWith(skill.root+'/'))))warnings=[...warnings,'This skill contains a Git submodule; complete packaging is unavailable.'];
    const treeSha=skill.root?tree.find(e=>e.type==='tree'&&e.path===skill.root)?.sha:revision.commit.tree.sha;
    if(!treeSha)throw new Error('Folder tree SHA missing for '+skill.path);
    const record:SkillRecord={repo:result.repo,path:skill.path,root:skill.root,branch:resolved.ref,commit:revision.sha,treeSha,skillSha:skill.sha,name:metadata.name||fallbackSkillName(skill.root,result.repo),description:metadata.description||missingDescription,stars:meta.stargazers_count,updatedAt:meta.pushed_at,fileCount:members.length,previewSha256:await digest(bytes),source:'repository',validationWarnings:warnings,...(skill.nestedUnder?{nestedUnder:skill.nestedUnder}:{})};
    result.skills.push(record);if(text)result.previews.set(skill.path,text);
    result.trees.set(treeSha,tree.filter(e=>!skill.root||e.path.startsWith(skill.root+'/')).map(e=>({...e,path:skill.root?e.path.slice(skill.root.length+1):e.path})));
  }
  return result;
}
