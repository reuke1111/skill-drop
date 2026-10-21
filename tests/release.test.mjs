import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {collectFiles,verifyRelease} from '../scripts/verify-release.mjs';
import {deliver} from '../test-build/phase3.mjs';
import {parseHTML} from 'linkedom';

test('release artifact: runtime allowlist, permissions, CSP, PNG sizes and disclaimers pass the audit',async()=>{
  const files=await collectFiles('dist');
  const audit=verifyRelease(files);
  assert.equal(audit.iconSizes.length,4);assert.equal(audit.manifest.name,'Skill Drop');
  const {document}=parseHTML(new TextDecoder().decode(files['panel.html']));
  assert.equal(document.querySelector('details.settings').hasAttribute('open'),false);
  assert.equal(document.querySelector('footer a').getAttribute('href'),'privacy.html');
  await assert.rejects(readFile('src/fixture.ts'),{code:'ENOENT'});
  await assert.rejects(readFile('src/test-exports.ts'),{code:'ENOENT'});
});

test('release artifact: stale prototype files, logging, broader capabilities and wrong-size icons are rejected',async()=>{
  const files=await collectFiles('dist');
  assert.throws(()=>verifyRelease({...files,'fixture.js':new Uint8Array()}),/Unexpected or missing/);
  assert.throws(()=>verifyRelease({...files,'panel.js':new TextEncoder().encode('console.log("debug")')}),/Logging or string/);
  const manifest=JSON.parse(new TextDecoder().decode(files['manifest.json']));
  manifest.permissions.push('tabs');
  assert.throws(()=>verifyRelease({...files,'manifest.json':new TextEncoder().encode(JSON.stringify(manifest))}));
  assert.throws(()=>verifyRelease({...files,'icons/icon16.png':files['icons/icon32.png']}));
});

test('mocked delivery: missing field reports browse fallback and still explains how to open a blocked dialog',async()=>{
  const calls=[];
  const result=await deliver([{filename:'one.zip',bytes:new Uint8Array([1])}],{
    target:async()=>1,send:async()=>({code:'FIELD_NOT_FOUND'}),download:async()=>calls.push('download'),
    open:async()=>{calls.push('open');throw new Error('blocked');}
  });
  assert.deepEqual(calls,['download','open']);assert.equal(result.state,'downloaded');
  assert.match(result.message,/Skill file field could not be found or filled/);
  assert.match(result.message,/Downloads\/ClaudeSkills/);assert.match(result.message,/browse button/);
  assert.match(result.message,/Check Chrome Downloads/);assert.match(result.message,/Open upload dialog/);
});

test('mocked delivery: a denied download does not claim files were saved or opened',async()=>{
  let opened=false;
  const result=await deliver([{filename:'one.zip',bytes:new Uint8Array([1])}],{
    target:async()=>1,send:async()=>({code:'FIELD_NOT_FOUND'}),download:async()=>{throw new Error('denied');},open:async()=>{opened=true;}
  });
  assert.equal(result.state,'download-failed');assert.equal(opened,false);
  assert.match(result.message,/could not all be started/);assert.match(result.message,/Save prepared ZIPs/);
  assert.ok(!/were saved|downloads have started/.test(result.message));
});
