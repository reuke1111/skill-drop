import {mkdir,readFile,writeFile,copyFile,readdir} from 'node:fs/promises';
import {resolve,dirname,relative} from 'node:path';
import {fileURLToPath} from 'node:url';
import {createHash} from 'node:crypto';
const root=resolve(dirname(fileURLToPath(import.meta.url)),'..');
const target=resolve(root,'publish/skill-drop');
const folders=['src','tests','scripts','icons','docs','.github','index-repo'];
const topFiles=['.gitignore','build.mjs','manifest.json','package.json','package-lock.json','panel.html','panel.css','README.md','tsconfig.json'];
const extras=['store-assets/screenshot-discovery-1280x800.png','store-assets/screenshot-add-controls-1280x800.png','store-assets/promo-440x280.png','store-assets/README.md','store-assets/assets.json','artifacts/USER-CONFIRMED-UPLOADS.md','release/skill-drop-1.0.0.zip','release/release-report.json','release/release-report.md'];
async function walk(folder){
  const files=[];
  for(const entry of await readdir(resolve(root,folder),{withFileTypes:true})){
    if(entry.name==='.git'||entry.name==='node_modules')continue;
    const name=folder+'/'+entry.name;
    if(entry.isDirectory())files.push(...await walk(name));
    else if(entry.isFile())files.push(name);
    else throw new Error('Unexpected non-file: '+name);
  }
  return files;
}
const files=[...topFiles,...extras,...(await Promise.all(folders.map(walk))).flat()].sort();
await mkdir(target,{recursive:true});
const existing=await readdir(target);
if(existing.some(name=>name!=='.git'))throw new Error('Publish folder already contains files; preserve it and choose a new target before re-preparing.');
const inventory=[];
for(const name of files){
  if(/(?:^|\/)(?:\.git|node_modules|test-cache|test-build|\.env(?:\..*)?)(?:\/|$)/.test(name))throw new Error('Excluded path: '+name);
  const destination=resolve(target,name);
  if(relative(target,destination).startsWith('..'))throw new Error('Unsafe destination');
  const bytes=await readFile(resolve(root,name));
  if(/\.(?:ts|mjs|json|md|html|yml|ps1|css)$/.test(name)&&/\b(?:gh[pousr]_[A-Za-z0-9]{20,}|github_pat_[A-Za-z0-9_]{20,}|-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----)/.test(bytes.toString('utf8')))throw new Error('Possible credential in '+name);
  await mkdir(dirname(destination),{recursive:true});await copyFile(resolve(root,name),destination);
  inventory.push({path:name,bytes:bytes.length,sha256:createHash('sha256').update(bytes).digest('hex')});
}
const report={target,files:inventory.length,totalBytes:inventory.reduce((sum,row)=>sum+row.bytes,0),excluded:['node_modules','dist','test-cache','test-build','generated test artifacts','nested Git history','original screenshot with browser profile details','promo master','environment/key files'],inventory};
await writeFile(resolve(root,'release/github-publish-inventory.json'),JSON.stringify(report,null,2)+'\n');
console.log(JSON.stringify({target,files:report.files,totalBytes:report.totalBytes,excluded:report.excluded},null,2));
