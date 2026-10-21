export const MAX_INDEX_BYTES=2*1024*1024;
export const INDEX_TTL=24*60*60*1000;
export type SkillRecord={repo:string;path:string;root:string;branch:string;commit:string;treeSha:string;skillSha:string;name:string;description:string;stars:number;updatedAt:string;fileCount:number;previewSha256:string;nestedUnder?:string;source?:'repository';validationWarnings?:string[]};
export type SkillsIndex={version:1;generatedAt:string;skills:SkillRecord[]};
export const skillId=(s:SkillRecord)=>`${s.repo}:${s.root}:${s.treeSha}`;
const safePath=(s:string)=>!s.includes('\\')&&!s.split('/').some(x=>!x||x==='.'||x==='..')&&!/[\u0000-\u001f]/.test(s);
export function parseIndex(text:string):SkillsIndex {
  if(new TextEncoder().encode(text).length>MAX_INDEX_BYTES)throw new Error('Index exceeds the 2 MB limit.');
  let data:any;try{data=JSON.parse(text);}catch{throw new Error('Index is corrupted: invalid JSON.');}
  if(data?.version!==1||typeof data.generatedAt!=='string'||!Number.isFinite(Date.parse(data.generatedAt))||!Array.isArray(data.skills)||data.skills.length>5000)throw new Error('Invalid index schema or version.');
  const ids=new Set<string>();
  for(const s of data.skills){
    if(!s||!['repo','path','root','branch','commit','treeSha','skillSha','name','description','updatedAt','previewSha256'].every(k=>typeof s[k]==='string'))throw new Error('Invalid skill record.');
    if(!/^[A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+$/.test(s.repo)||!safePath(s.path)||(s.root!==''&&!safePath(s.root))||s.path!==(s.root?s.root+'/':'')+'SKILL.md'||!s.branch||s.branch.length>255||s.name.length>200||!s.name.trim()||s.description.length>8000||!s.description.trim()||!Number.isFinite(Date.parse(s.updatedAt))||!Number.isInteger(s.stars)||s.stars<0||!Number.isInteger(s.fileCount)||s.fileCount<1||!['commit','treeSha','skillSha'].every(k=>/^[a-f0-9]{40}$/.test(s[k]))||!/^[a-f0-9]{64}$/.test(s.previewSha256))throw new Error('Invalid skill metadata or unsafe path.');
    if(s.nestedUnder!==undefined&&(typeof s.nestedUnder!=='string'||!safePath(s.nestedUnder)))throw new Error('Invalid nested skill path.');
    const id=skillId(s);if(ids.has(id))throw new Error('Duplicate index record.');ids.add(id);
  }
  // Strip fields that are only produced by direct discovery, including any forged source marker.
  return {version:1,generatedAt:data.generatedAt,skills:data.skills.map((s:SkillRecord)=>({repo:s.repo,path:s.path,root:s.root,branch:s.branch,commit:s.commit,treeSha:s.treeSha,skillSha:s.skillSha,name:s.name,description:s.description,stars:s.stars,updatedAt:s.updatedAt,fileCount:s.fileCount,previewSha256:s.previewSha256,...(s.nestedUnder?{nestedUnder:s.nestedUnder}:{})}))};
}
export function search(index:SkillsIndex,query:string):SkillRecord[]{
  const terms=query.toLocaleLowerCase().trim().split(/\s+/).filter(Boolean);
  return index.skills.filter(s=>terms.every(t=>`${s.name} ${s.description} ${s.repo}`.toLocaleLowerCase().includes(t))).sort((a,b)=>b.stars-a.stars||a.name.localeCompare(b.name));
}
export function indexUrl(url:string):string {
  const help='Enter the full URL of skills-index.json, for example https://raw.githubusercontent.com/example/skills-directory/main/skills-index.json. A repository name or GitHub page URL is not an index file URL.';
  let parsed:URL;try{parsed=new URL(url.trim());}catch{throw new Error(help);}
  if(parsed.protocol!=='https:'||parsed.hostname!=='raw.githubusercontent.com'||parsed.username||parsed.password||parsed.port||parsed.search||parsed.hash||!parsed.pathname.endsWith('/skills-index.json')||parsed.pathname.split('/').filter(Boolean).length<4)throw new Error(help);
  return parsed.href;
}
export type IndexSnapshot={url:string;text:string;expiresAt:number};
export async function loadIndex(url:string,cached:IndexSnapshot|undefined,fetchText:(url:string)=>Promise<string>,now=Date.now()):Promise<{index:SkillsIndex;snapshot:IndexSnapshot;source:'network'|'cache'|'offline cache';warning?:string}>{
  indexUrl(url);
  let valid:SkillsIndex|undefined;
  if(cached?.url===url)try{valid=parseIndex(cached.text);}catch{cached=undefined;}
  if(valid&&cached!.expiresAt>now)return {index:valid,snapshot:cached!,source:'cache'};
  try{
    const text=await fetchText(url);const index=parseIndex(text);const snapshot={url,text,expiresAt:now+INDEX_TTL};
    return {index,snapshot,source:'network'};
  }catch(error){
    if(valid)return {index:valid,snapshot:cached!,source:'offline cache',warning:String(error)};
    throw error;
  }
}
