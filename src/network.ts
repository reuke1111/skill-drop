import { githubError } from './github';
export async function fetchBytes(url:string,limit:number,token='',fetcher:typeof fetch=fetch):Promise<Uint8Array>{
  const u=new URL(url);if(u.protocol!=='https:'||!['api.github.com','raw.githubusercontent.com','codeload.github.com'].includes(u.hostname)||u.username||u.password)throw new Error('Unexpected GitHub host');
  const response=await fetcher(url,{headers:u.hostname==='api.github.com'?{Accept:'application/vnd.github+json',...(token?{Authorization:'Bearer '+token}:{})}:{},redirect:'error',credentials:'omit',signal:AbortSignal.timeout(60000)});
  if(!response.ok)throw githubError(response.status,response.headers,(await response.text()).slice(0,300));
  if(Number(response.headers.get('content-length')||0)>limit)throw new Error('Response exceeds size limit.');
  if(!response.body)throw new Error('Empty response body');
  const reader=response.body.getReader();const chunks:Uint8Array[]=[];let size=0;
  try{for(;;){const {done,value}=await reader.read();if(done)break;size+=value.length;if(size>limit)throw new Error('Response exceeds size limit.');chunks.push(value);}}
  catch(error){await reader.cancel();throw error;}
  const bytes=new Uint8Array(size);let offset=0;for(const chunk of chunks){bytes.set(chunk,offset);offset+=chunk.length;}return bytes;
}
export async function digest(bytes:Uint8Array,algorithm='SHA-256'):Promise<string>{
  return Array.from(new Uint8Array(await crypto.subtle.digest(algorithm,new Uint8Array(bytes).buffer))).map(x=>x.toString(16).padStart(2,'0')).join('');
}
export async function gitBlobHash(bytes:Uint8Array){const header=new TextEncoder().encode(`blob ${bytes.length}\0`);const all=new Uint8Array(header.length+bytes.length);all.set(header);all.set(bytes,header.length);return digest(all,'SHA-1');}
