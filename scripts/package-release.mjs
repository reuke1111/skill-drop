import {mkdir,writeFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {dirname,resolve} from 'node:path';
import {fileURLToPath} from 'node:url';
import assert from 'node:assert/strict';
import {zipSync,unzipSync} from 'fflate';
import {collectFiles,verifyRelease,EXPECTED_FILES} from './verify-release.mjs';
const root=resolve(dirname(fileURLToPath(import.meta.url)),'..');
const files=await collectFiles(resolve(root,'dist'));
const audit=verifyRelease(files);
const sha256=bytes=>createHash('sha256').update(bytes).digest('hex');
const entries=Object.fromEntries(EXPECTED_FILES.map(name=>[name,[files[name],{level:name.endsWith('.png')?0:6,mtime:new Date('2026-01-01T00:00:00Z')}]]));
const zip=zipSync(entries),unpacked=unzipSync(zip);
assert.deepEqual(Object.keys(unpacked).sort(),EXPECTED_FILES);
for(const name of EXPECTED_FILES)assert.deepEqual(unpacked[name],files[name]);
const filename=`skill-drop-${audit.manifest.version}.zip`;
const report={
  product:audit.manifest.name,version:audit.manifest.version,generatedAt:new Date().toISOString(),file:filename,
  repository:'https://github.com/reuke1111/skill-drop',privacyPolicyUrl:'https://reuke1111.github.io/skill-drop/privacy.html',
  compressedBytes:zip.length,compressedKiB:Number((zip.length/1024).toFixed(2)),
  uncompressedBytes:EXPECTED_FILES.reduce((sum,name)=>sum+files[name].length,0),sha256:sha256(zip),
  contents:EXPECTED_FILES.map(name=>({path:name,bytes:files[name].length,sha256:sha256(files[name])})),
  permissions:audit.manifest.permissions,hostPermissions:audit.manifest.host_permissions,
  iconSizes:audit.iconSizes,bundledSkills:audit.bundledSkills,checks:[...audit.checks,'Reopened ZIP: every root path and file byte matches dist/'],
  verificationScope:'Agent checks were local static/build/ZIP checks only. Automated regression results are in artifacts/latest-test-run.log. The user subsequently reported Chrome testing; the agent did not observe Chrome or Claude, perform an upload, or submit to the Store.',
  userEvidence:'On October 21, 2026 (Asia/Calcutta), after v1.0.0 release preparation, the user reported "tested in Chrome". Individual cases, outcomes and an exact tested ZIP hash were not supplied. The user previously confirmed one- and two-skill uploads from anthropics/skills on an earlier build; exact upload commit and skill names were not provided. See artifacts/USER-CONFIRMED-UPLOADS.md.',
  pending:['Record flow-specific Chrome outcomes not detailed in the general test confirmation, including fallback/download completion and four dialog tab cases','Review prepared 1280x800 screenshot crops and 440x280 promotional tile in store-assets/','Working developer contact details in the Store dashboard','Developer dashboard disclosures, submission and review']
};
await mkdir(resolve(root,'release'),{recursive:true});
await writeFile(resolve(root,'release',filename),zip);
await writeFile(resolve(root,'release/release-report.json'),JSON.stringify(report,null,2)+'\n');
const markdown=[`# ${report.product} ${report.version} release package`,'',`ZIP: ${filename} — **${report.compressedBytes.toLocaleString('en-US')} bytes (${report.compressedKiB} KiB)**. Uncompressed: ${report.uncompressedBytes.toLocaleString('en-US')} bytes.`,'',`SHA-256: \`${report.sha256}\``,'','All entries are at the archive root; there is no enclosing dist/ directory.','','| File | Bytes |','|---|---:|',...report.contents.map(row=>`| ${row.path} | ${row.bytes.toLocaleString('en-US')} |`),'','## Local checks','',...report.checks.map(check=>'- '+check),'',report.verificationScope,'',report.userEvidence,'','## Pending before submission','',...report.pending.map(item=>'- '+item),'','Permission justifications: ../docs/PERMISSIONS.md. Listing/privacy declarations: ../docs/STORE-LISTING.md. Screenshot and hosting steps: ../docs/RELEASE.md.'];
await writeFile(resolve(root,'release/release-report.md'),markdown.join('\n')+'\n');
console.log(JSON.stringify({file:resolve(root,'release',filename),compressedBytes:zip.length,sha256:report.sha256,files:EXPECTED_FILES,localChecks:report.checks.length},null,2));
