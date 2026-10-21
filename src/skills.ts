import {packageSkill,getTree,validate} from './github';
import {type SkillRecord,skillId} from './index';
import {type CachedZip,ZipCache} from './cache';
import {digest,gitBlobHash,fetchBytes} from './network';
import {discoverRepository,repositoryUrl,fallbackSkillName,missingDescription,type RepositoryResult} from './repository';
export const cacheKey=(s:SkillRecord)=>`${s.repo}:${s.treeSha}:${s.root}`;
export function createSkillClient(cache:ZipCache,token='',fetcher:typeof fetch=fetch){
  const previews=new Map<string,string>();const jsonMemo=new Map<string,Promise<any>>();
  const archiveMemo=new Map<string,Promise<Uint8Array>>();const repoMemo=new Map<string,Promise<RepositoryResult>>();
  const archive=(url:string)=>{
    if(!archiveMemo.has(url)){
      if(archiveMemo.size>=2)archiveMemo.delete(archiveMemo.keys().next().value!);
      archiveMemo.set(url,fetchBytes(url,50*1024*1024,token,fetcher).catch(error=>{archiveMemo.delete(url);throw error;}));
    }
    return archiveMemo.get(url)!;
  };
  const json=(url:string)=>{if(!jsonMemo.has(url))jsonMemo.set(url,fetchBytes(url,12*1024*1024,token,fetcher).then(bytes=>JSON.parse(new TextDecoder().decode(bytes))));return jsonMemo.get(url)!;};
  function metadataMatches(s:SkillRecord,metadata:ReturnType<typeof validate>){
    const direct=s.source==='repository';
    return (direct||!metadata.warnings.length)&&(metadata.name||(direct?fallbackSkillName(s.root,s.repo):undefined))===s.name&&(metadata.description||(direct?missingDescription:undefined))===s.description;
  }
  async function discover(input:string){
    const url=repositoryUrl(input);if(!url)throw new Error('Enter a GitHub repository link.');
    if(!repoMemo.has(url))repoMemo.set(url,discoverRepository(input,{json,archive}).catch(error=>{repoMemo.delete(url);throw error;}));
    const result=await repoMemo.get(url)!;
    for(const s of result.skills){
      const text=result.previews.get(s.path);if(text!==undefined)previews.set(skillId(s),text);
      jsonMemo.set(`https://api.github.com/repos/${s.repo}/git/trees/${s.treeSha}?recursive=1`,Promise.resolve({tree:result.trees.get(s.treeSha),truncated:false}));
    }
    return result;
  }
  async function preview(s:SkillRecord){
    const id=skillId(s);if(previews.has(id))return previews.get(id)!;
    const cached=await cache.get(cacheKey(s));if(cached){if(await digest(new TextEncoder().encode(cached.preview))===s.previewSha256){previews.set(id,cached.preview);return cached.preview;}await cache.delete(cacheKey(s));}
    const url=`https://raw.githubusercontent.com/${s.repo}/${s.commit}/${s.path.split('/').map(encodeURIComponent).join('/')}`;
    const bytes=await fetchBytes(url,512*1024,token,fetcher);
    if(await digest(bytes)!==s.previewSha256||await gitBlobHash(bytes)!==s.skillSha)throw new Error('SKILL.md hash differs from index; refresh the index.');
    const text=new TextDecoder('utf-8',{fatal:true}).decode(bytes);previews.set(id,text);return text;
  }
  async function build(skills:SkillRecord[]):Promise<CachedZip[]>{
    const archives=new Map<string,Promise<Uint8Array>>();const output:CachedZip[]=[];
    for(const s of skills){
      const key=cacheKey(s);const cached=await cache.get(key);
      if(cached){
        const metadata=validate(cached.preview);
        if(await digest(cached.bytes)===cached.zipSha256&&await digest(new TextEncoder().encode(cached.preview))===s.previewSha256&&metadataMatches(s,metadata)){output.push(cached);continue;}
        await cache.delete(key);
      }
      const repoCommit=s.repo+'@'+s.commit;
      if(!archives.has(repoCommit))archives.set(repoCommit,archive(`https://codeload.github.com/${s.repo}/zip/${s.commit}`));
      const packaged=packageSkill(await archives.get(repoCommit)!,s.root,s.repo.split('/')[1]);
      if(await digest(packaged.preview)!==s.previewSha256||await gitBlobHash(packaged.preview)!==s.skillSha)throw new Error('Archive preview differs from index; refresh the index.');
      const tree=await getTree(s.repo,s.treeSha,json);
      const members=tree.filter(e=>e.type==='blob');if(tree.some(e=>e.type==='commit'))throw new Error('Skill includes a submodule; complete packaging unavailable.');
      const folder=s.root.split('/').at(-1)||s.repo.split('/')[1];
      const keys=Object.keys(packaged.contents);if(keys.length!==members.length||keys.length!==s.fileCount)throw new Error('Archive file count differs from skill tree.');
      for(const e of members){const bytes=packaged.contents[folder+'/'+e.path];if(!bytes||bytes.length!==e.size||await gitBlobHash(bytes)!==e.sha)throw new Error('Archive supporting file mismatch: '+e.path);}
      const text=new TextDecoder('utf-8',{fatal:true}).decode(packaged.preview);const metadata=validate(text);
      if(!metadataMatches(s,metadata))throw new Error('Skill metadata differs from the selected record; reload the source.');
      const stem=`${s.repo}-${folder}`.replace(/[^a-zA-Z0-9_-]/g,'-').slice(0,100);
      const filename=`${stem}-${s.treeSha.slice(0,8)}-${(await digest(new TextEncoder().encode(skillId(s)))).slice(0,8)}.zip`;
      const row={key,bytes:packaged.zip,preview:text,filename,zipSha256:await digest(packaged.zip),createdAt:Date.now(),accessedAt:Date.now()};
      try{await cache.put(row);}catch(error){
        // A browser storage quota must not prevent delivery of an already built ZIP.
        if((error as {name?:string})?.name!=='QuotaExceededError')throw error;
      }
      output.push(row);
    }
    return output;
  }
  return {preview,build,discover};
}
