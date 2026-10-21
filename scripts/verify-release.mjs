import assert from 'node:assert/strict';
import {readdir,readFile} from 'node:fs/promises';
import path from 'node:path';
export const EXPECTED_FILES=[
  'THIRD-PARTY-LICENSES.txt','background.js','bootstrap-index.json','content.js',
  'icons/icon128.png','icons/icon16.png','icons/icon32.png','icons/icon48.png',
  'manifest.json','panel.css','panel.html','panel.js','privacy.html'
].sort();
export async function collectFiles(directory,prefix=''){
  const files={};
  for(const entry of await readdir(directory,{withFileTypes:true})){
    const name=prefix+entry.name;
    if(entry.isDirectory())Object.assign(files,await collectFiles(path.join(directory,entry.name),name+'/'));
    else {assert.ok(entry.isFile(),'Unexpected non-file: '+name);files[name]=new Uint8Array(await readFile(path.join(directory,entry.name)));}
  }
  return files;
}
export function verifyRelease(files){
  assert.deepEqual(Object.keys(files).sort(),EXPECTED_FILES,'Unexpected or missing release files');
  const text=name=>new TextDecoder('utf-8',{fatal:true}).decode(files[name]);
  const manifest=JSON.parse(text('manifest.json'));
  assert.equal(manifest.manifest_version,3);
  assert.equal(manifest.name,'Skill Drop');
  assert.equal(manifest.minimum_chrome_version,'120');
  assert.match(manifest.version,/^\d+\.\d+\.\d+$/);
  assert.ok(manifest.description.length<=132);
  assert.deepEqual(manifest.permissions,['sidePanel','downloads','storage']);
  assert.deepEqual(manifest.host_permissions,['https://claude.ai/*','https://api.github.com/*','https://raw.githubusercontent.com/*','https://codeload.github.com/*']);
  assert.deepEqual(manifest.content_scripts,[{matches:['https://claude.ai/*'],js:['content.js']}]);
  assert.equal(manifest.background.service_worker,'background.js');
  assert.equal(manifest.side_panel.default_path,'panel.html');
  assert.equal(manifest.action.default_title,manifest.name);
  assert.equal(manifest.content_security_policy.extension_pages,"script-src 'self'; object-src 'none'; connect-src 'self' https://api.github.com https://raw.githubusercontent.com https://codeload.github.com; base-uri 'none'; frame-src 'none'");
  for(const field of ['optional_permissions','optional_host_permissions','web_accessible_resources','externally_connectable','sandbox'])assert.equal(manifest[field],undefined,'Unexpected manifest capability: '+field);
  const iconSizes=[];
  for(const size of [16,32,48,128]){
    const filename=`icons/icon${size}.png`,bytes=files[filename];
    assert.equal(manifest.icons[size],filename);
    assert.equal(manifest.action.default_icon[size],filename);
    assert.equal(Buffer.from(bytes.subarray(0,8)).toString('hex'),'89504e470d0a1a0a');
    const view=new DataView(bytes.buffer,bytes.byteOffset,bytes.byteLength);
    assert.equal(view.getUint32(16),size);assert.equal(view.getUint32(20),size);
    iconSizes.push({path:filename,width:size,height:size,bytes:bytes.length});
  }
  for(const filename of ['panel.html','privacy.html']){
    assert.ok(text(filename).includes('Unofficial. Not affiliated with Anthropic.'));
    assert.ok(!/<script\b[^>]*src=["']https?:/i.test(text(filename)),'Remote script');
  }
  assert.ok(/href="privacy\.html"/.test(text('panel.html')));
  assert.ok(!/<script\b/i.test(text('privacy.html')),'Policy must be script-free');
  for(const filename of ['background.js','panel.js','content.js','panel.html']){
    assert.ok(!/\bconsole\s*\.|\bdebugger\b|\beval\s*\(|new\s+Function\s*\(/.test(text(filename)),'Logging or string execution: '+filename);
    assert.ok(!/dragstart|dragover|synthetic.drop|Arm drop|skill-drop-test|testZip|fixture-picker|draggable\s*=|addEventListener\(["']drop["']/i.test(text(filename)),'Prototype code: '+filename);
  }
  const index=JSON.parse(text('bootstrap-index.json'));
  assert.equal(index.version,1);assert.ok(index.skills.length>0);
  assert.ok(files['bootstrap-index.json'].length<=2*1024*1024);
  return {manifest,iconSizes,bundledSkills:index.skills.length,checks:['Exact 13-file runtime allowlist; no tests, fixtures, secrets/settings files or source maps','MV3, product name, Chrome floor, description length and declared entry points','Only 3 API permissions and 4 required GitHub/Claude hosts','Packaged-script CSP and no external connection/sandbox/resource grants','Four PNG headers match declared dimensions','Footer and policy disclaimer; local policy link; script-free policy','No console/debugger, string execution, prototype card/drop/fixture controls in runtime bundles','Versioned, nonempty bundled directory under 2 MiB']};
}
