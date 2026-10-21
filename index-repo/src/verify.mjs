import {readFile} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';
import path from 'node:path';
import {parseIndex} from '../lib/core.mjs';
export function verify(indexText,reportText){
  const index=parseIndex(indexText);const report=JSON.parse(reportText);
  if(report.indexed!==index.skills.length||report.generatedAt!==index.generatedAt||!Array.isArray(report.skipped)||!Array.isArray(report.repos))throw new Error('Index and build report disagree.');
  for(const skill of index.skills)if(!report.repos.some(repo=>repo.repo===skill.repo&&repo.commit===skill.commit))throw new Error('Skill has no pinned repository build record: '+skill.path);
  for(const row of report.skipped)if(typeof row.reason!=='string'||!row.reason)throw new Error('Skipped skill is missing its reason.');
  return {skills:index.skills.length,bytes:new TextEncoder().encode(indexText).length,skipped:report.skipped.length};
}
if(process.argv[1]&&path.resolve(process.argv[1])===fileURLToPath(import.meta.url)){
  const root=new URL('../',import.meta.url);
  console.log(JSON.stringify(verify(await readFile(new URL('skills-index.json',root),'utf8'),await readFile(new URL('skipped-skills.json',root),'utf8'))));
}
