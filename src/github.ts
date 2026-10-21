import { unzipSync, zipSync } from 'fflate';
import { validate } from './metadata';
export { validate } from './metadata';
export type Entry = {path:string;type:string;sha:string;size?:number;mode?:string};
export type Skill = {path:string;root:string;sha:string;nestedUnder?:string};
export function detect(tree:Entry[]):Skill[] {
  const skills=tree.filter(e=>e.type==='blob' && e.path.split('/').at(-1)==='SKILL.md').map(e=>({path:e.path,root:e.path.split('/').slice(0,-1).join('/'),sha:e.sha}));
  return skills.map(s=>({...s,nestedUnder:skills.filter(p=>p!==s && (!p.root || s.root.startsWith(p.root+'/'))).sort((a,b)=>b.root.length-a.root.length)[0]?.path}));
}
export function collisions(items:{id:string;name?:string}[]):string[]{
  const groups=new Map<string,string[]>();
  for(const item of items)if(item.name)groups.set(item.name,[...(groups.get(item.name)||[]),item.id]);
  return [...groups].filter(([,ids])=>ids.length>1).map(([name,ids])=>`Name collision: ${name} (${ids.join(', ')}). Original skills are unchanged.`);
}
export function githubError(status:number, headers:{get(name:string):string|null},body:string):Error {
  if(status===429 || (status===403 && (headers.get('x-ratelimit-remaining')==='0'||/rate limit/i.test(body)))){
    const reset=Number(headers.get('x-ratelimit-reset'));const retry=headers.get('retry-after');
    const when=retry?`Retry after ${retry} seconds.`:reset>0?`Retry at ${new Date(reset*1000).toISOString()}.`:'Retry when the limit resets.';
    return new Error(`GitHub rate limit reached. ${when} Cached responses remain usable.`);
  }
  return new Error(`GitHub HTTP ${status}: ${body.slice(0,160)}`);
}
export type GetJson=(url:string)=>Promise<any>;
export async function getTree(repo:string,sha:string,get:GetJson):Promise<Entry[]> {
  const base=`https://api.github.com/repos/${repo}/git/trees/`;
  const recursive=await get(base+encodeURIComponent(sha)+'?recursive=1');
  if(!recursive.truncated)return recursive.tree;
  const entries:Entry[]=[];
  async function visit(id:string,prefix:string){
    const part=await get(base+encodeURIComponent(id));
    if(part.truncated)throw new Error('GitHub truncated a non-recursive tree; refusing incomplete packaging.');
    for(const e of part.tree){const path=prefix+e.path;entries.push({...e,path});if(e.type==='tree')await visit(e.sha,path+'/');}
  }
  await visit(sha,'');return entries;
}
export async function resolveUrl(url:string,get:GetJson):Promise<{repo:string;ref:string;path:string}> {
  let u:URL;try{u=new URL(url);}catch{throw new Error('Enter an HTTPS GitHub repository link.');}
  if(u.protocol!=='https:'||u.hostname!=='github.com'||u.username||u.password||u.port)throw new Error('Enter an HTTPS github.com repository link.');
  let segments:string[];try{segments=u.pathname.split('/').filter(Boolean).map(decodeURIComponent);}catch{throw new Error('The GitHub URL contains an invalid encoded path.');}
  if(segments.length<2||segments.slice(0,2).some(s=>!/^[-A-Za-z0-9_.]+$/.test(s)||s==='.'||s==='..'))throw new Error('Enter a complete repository link, for example https://github.com/anthropics/skills.');
  const repo=segments.slice(0,2).join('/').replace(/\.git$/,'');
  if(segments.length>2&&segments[2]!=='tree')throw new Error('Use a repository URL or /tree/<branch>/<folder> URL.');
  if(segments[2]==='tree'&&segments.length<4)throw new Error('The /tree/ URL needs a branch or commit.');
  const metadata=await get(`https://api.github.com/repos/${repo}`);
  if(segments[2]!=='tree')return {repo,ref:metadata.default_branch,path:''};
  const rest=segments.slice(3);
  // Try longest candidate first to support branch names containing slashes.
  for(let n=rest.length;n>0;n--){const ref=rest.slice(0,n).join('/');try{await get(`https://api.github.com/repos/${repo}/commits/${encodeURIComponent(ref)}`);return {repo,ref,path:rest.slice(n).join('/')};}catch(e){if(!String(e).includes('HTTP 404')&&!String(e).includes('HTTP 422'))throw e;}}
  throw new Error('Branch or ref not found.');
}
export function unpackArchive(archive:Uint8Array):Record<string,Uint8Array> {
  let total=0;
  return unzipSync(archive,{filter:file=>{total+=file.originalSize;if(total>150*1024*1024||file.originalSize>32*1024*1024)throw new Error('Repository archive exceeds safe extraction limit (150 MB total / 32 MB per file).');return true;}});
}
export function packageSkill(archive:Uint8Array,root:string,repoName:string):{zip:Uint8Array;contents:Record<string,Uint8Array>;preview:Uint8Array;warnings:string[]} {
  const all=unpackArchive(archive);const files:Record<string,Uint8Array>={};
  const top=Object.keys(all)[0]?.split('/')[0];if(!top)throw new Error('Empty archive');
  const prefix=top+'/'+(root?root+'/':'');const folder=root.split('/').at(-1)||repoName;
  for(const [path,data] of Object.entries(all)){
    if(!path.startsWith(prefix)||path.endsWith('/'))continue;
    const relative=path.slice(prefix.length);
    if(relative.split('/').some(p=>!p||p==='..'||p==='.'||p.includes('\\'))||!relative)throw new Error('Unsafe archive path');
    files[folder+'/'+relative]=data;
  }
  const preview=files[folder+'/SKILL.md'];if(!preview)throw new Error('SKILL.md missing from skill folder');
  let text:string;try{text=new TextDecoder('utf-8',{fatal:true}).decode(preview);}catch{throw new Error('SKILL.md is not readable UTF-8');}
  return {zip:zipSync(files),contents:files,preview,warnings:validate(text).warnings};
}
