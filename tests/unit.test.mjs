import {test} from 'node:test';
import assert from 'node:assert/strict';
import {mkdir,writeFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {zipSync,strToU8,unzipSync} from 'fflate';
import {detect,validate,collisions,githubError,getTree,resolveUrl,packageSkill} from '../test-build/github.mjs';
test('no skills, multiple distinct roots, nested skills reported',()=>{
  assert.deepEqual(detect([]),[]);
  const s=detect(['skills/a/SKILL.md','skills/b/SKILL.md','skills/a/nested/SKILL.md'].map(path=>({path,type:'blob',sha:path})));
  assert.equal(new Set(s.map(x=>x.root)).size,3);assert.equal(s[2].nestedUnder,'skills/a/SKILL.md');
});
test('nested skill roots are reported once and parent/child ZIPs preserve their full subtrees',async()=>{
  const entries={
    'repo/skills/parent/SKILL.md':strToU8('---\nname: parent\ndescription: Parent fixture\n---\n'),
    'repo/skills/parent/references/parent.md':strToU8('Parent reference.\n'),
    'repo/skills/parent/children/child/SKILL.md':strToU8('---\nname: child\ndescription: Nested child fixture\n---\n'),
    'repo/skills/parent/children/child/references/child.md':strToU8('Child reference.\n'),
    'repo/outside.txt':strToU8('Excluded from both packages.\n')
  };
  const tree=Object.keys(entries).map(path=>({path:path.slice('repo/'.length),type:'blob',sha:'fixture'}));
  const skills=detect(tree);
  assert.deepEqual(skills.map(s=>s.root),['skills/parent','skills/parent/children/child']);
  assert.equal(new Set(skills.map(s=>s.root)).size,2);
  assert.equal(skills[0].nestedUnder,undefined);
  assert.equal(skills[1].nestedUnder,'skills/parent/SKILL.md');
  const archive=zipSync(entries);const packages=[];
  for(const skill of skills){
    const folder=skill.root.split('/').at(-1);
    const result=packageSkill(archive,skill.root,'repo');const extracted=unzipSync(result.zip);
    const prefix='repo/'+skill.root+'/';
    const expected=Object.entries(entries).filter(([path])=>path.startsWith(prefix));
    const expectedPaths=expected.map(([path])=>folder+'/'+path.slice(prefix.length)).sort();
    assert.deepEqual(Object.keys(extracted).sort(),expectedPaths);
    for(const [path,bytes] of expected)assert.deepEqual(extracted[folder+'/'+path.slice(prefix.length)],bytes);
    const filename=`nested-${folder}-fixture.zip`;
    packages.push({root:skill.root,nestedUnder:skill.nestedUnder||null,filename,fileCount:expected.length,totalBytes:expected.reduce((sum,[,bytes])=>sum+bytes.length,0),paths:expectedPaths,zipSHA256:createHash('sha256').update(result.zip).digest('hex'),missing:[],extra:[]});
    await mkdir('artifacts',{recursive:true});await writeFile('artifacts/'+filename,result.zip);
  }
  assert.equal(packages[0].fileCount,4);assert.equal(packages[1].fileCount,2);
  assert.ok(packages[0].paths.includes('parent/children/child/SKILL.md'));
  assert.ok(packages[1].paths.includes('child/SKILL.md'));
  assert.ok(!packages[1].paths.some(path=>path.includes('parent.md')));
  await writeFile('artifacts/nested-fixture-evidence.json',JSON.stringify({source:'Local archive fixture; no GitHub requests',repo:'local fixtures',commit:'N/A',distinctRoots:2,packages},null,2));
});
test('missing, invalid and valid frontmatter warn only; duplicate names preserved',()=>{
  for(const value of ['body','---\nname: [bad]\n---\ntext','---\nname: "bad\ndescription: ok\n---\n'])assert.ok(validate(value).warnings.length);
  const raw='---\nname: same\ndescription: A skill\n---\nbody';assert.equal(validate(raw).name,'same');
  assert.equal(collisions([{id:'a',name:'same'},{id:'b',name:'same'}]).length,1);
});
test('archive includes every supporting byte and spaces/special characters only within selected root',()=>{
  const entries={'repo/skills/a space #/SKILL.md':strToU8('---\nname: same\ndescription: test\n---\n'),'repo/skills/a space #/references/é & #.txt':strToU8('keep bytes'),'repo/other.txt':strToU8('excluded')};
  const p=packageSkill(zipSync(entries),'skills/a space #','repo');const unpacked=unzipSync(p.zip);
  assert.deepEqual(Object.keys(unpacked).sort(),['a space #/SKILL.md','a space #/references/é & #.txt']);assert.deepEqual(unpacked['a space #/references/é & #.txt'],entries['repo/skills/a space #/references/é & #.txt']);
});
test('truncated recursive tree traverses subtrees; incomplete non-recursive tree fails',async()=>{
  const calls=[];const tree=await getTree('a/b','root',async url=>{calls.push(url);if(url.includes('?'))return {truncated:true};return url.endsWith('root')?{tree:[{type:'tree',path:'skills',sha:'sub'}]}:{tree:[{type:'blob',path:'SKILL.md',sha:'file'}]};});
  assert.equal(detect(tree)[0].path,'skills/SKILL.md');assert.equal(calls.length,3);
  await assert.rejects(getTree('a/b','root',async()=>({truncated:true})),/refusing incomplete/);
});
test('rate limits produce clear messages',()=>{assert.match(githubError(403,{get:()=> '0'},'').message,/rate limit reached/);assert.match(githubError(429,{get:()=>null},'').message,/rate limit reached/);});
test('non-default branch with slash and encoded special path resolves without hardcoding main',async()=>{
  const result=await resolveUrl('https://github.com/a/b/tree/feature/branch/a%20space%23',async url=>{if(url.endsWith('/a/b'))return {default_branch:'trunk'};if(url.endsWith('feature%2Fbranch'))return {};throw new Error('GitHub HTTP 404');});
  assert.equal(result.ref,'feature/branch');assert.equal(result.path,'a space#');
});
