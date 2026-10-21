export const ZIP_TTL=24*60*60*1000;
export const ZIP_CAP=75*1024*1024;
export type CachedZip={key:string;bytes:Uint8Array;preview:string;filename:string;zipSha256:string;createdAt:number;accessedAt:number};
export interface ZipStore {all():Promise<CachedZip[]>;put(value:CachedZip):Promise<void>;delete(key:string):Promise<void>}
export class ZipCache {
  constructor(private store:ZipStore,private cap=ZIP_CAP,private ttl=ZIP_TTL){}
  async prune(now=Date.now()){
    const live:CachedZip[]=[];
    for(const row of await this.store.all())if(row.createdAt+this.ttl<=now)await this.store.delete(row.key);else live.push(row);
    let size=live.reduce((sum,row)=>sum+row.bytes.byteLength+new TextEncoder().encode(row.preview).length,0);
    for(const row of live.sort((a,b)=>a.accessedAt-b.accessedAt))if(size>this.cap){await this.store.delete(row.key);size-=row.bytes.byteLength+new TextEncoder().encode(row.preview).length;}
  }
  async get(key:string,now=Date.now()){
    await this.prune(now);const row=(await this.store.all()).find(row=>row.key===key);
    if(row){row.accessedAt=now;await this.store.put(row);}return row;
  }
  async put(row:CachedZip,now=Date.now()){
    if(row.bytes.byteLength+new TextEncoder().encode(row.preview).length>this.cap)throw new Error('Skill ZIP exceeds the cache capacity.');
    await this.store.put({...row,createdAt:now,accessedAt:now});await this.prune(now);
  }
  delete(key:string){return this.store.delete(key);}
}
export function indexedDbStore(name='claude-skill-drop'):ZipStore {
  const ready=new Promise<IDBDatabase>((resolve,reject)=>{
    const open=indexedDB.open(name,1);open.onupgradeneeded=()=>open.result.createObjectStore('zips',{keyPath:'key'});open.onsuccess=()=>resolve(open.result);open.onerror=()=>reject(open.error);
  });
  async function op<T>(mode:IDBTransactionMode,run:(store:IDBObjectStore)=>IDBRequest<T>):Promise<T>{
    const db=await ready;return new Promise((resolve,reject)=>{const tx=db.transaction('zips',mode);const request=run(tx.objectStore('zips'));let result:T;
      request.onsuccess=()=>{result=request.result;};tx.oncomplete=()=>resolve(result);tx.onerror=()=>reject(tx.error);tx.onabort=()=>reject(tx.error||new Error('Cache transaction aborted'));});
  }
  return {all:()=>op('readonly',s=>s.getAll()),put:async row=>{await op('readwrite',s=>s.put(row));},delete:async key=>{await op('readwrite',s=>s.delete(key));}};
}
