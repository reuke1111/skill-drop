import { build } from 'esbuild';
import { mkdir, copyFile, readFile, writeFile, rm } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
const root=dirname(fileURLToPath(import.meta.url));
process.chdir(root);
// Clean only this project's generated directory so old prototype assets cannot ship.
const output=resolve(root,'dist');
if(dirname(output)!==root||output!==resolve(root,'dist'))throw new Error('Unexpected output path');
await rm(output,{recursive:true,force:true});
await mkdir('dist', { recursive: true });
await mkdir('dist/icons',{recursive:true});
for(const size of [16,32,48,128])await copyFile(`icons/icon${size}.png`,`dist/icons/icon${size}.png`);
await mkdir('index-repo/lib',{recursive:true});
await build({entryPoints:['src/builder-core.ts'],outfile:'index-repo/lib/core.mjs',bundle:true,platform:'node',format:'esm',target:'node22',banner:{js:"import { createRequire as nodeRequireFactory } from 'node:module'; const require = nodeRequireFactory(import.meta.url);"}});
await build({ entryPoints: ['src/background.ts','src/content.ts','src/panel.ts'], outdir:'dist', bundle:true, format:'iife', target:'chrome120',drop:['console','debugger'] });
for (const name of ['manifest.json','panel.html','panel.css']) await copyFile(name, `dist/${name}`);
await copyFile('index-repo/skills-index.json','dist/bootstrap-index.json');
await copyFile('docs/privacy.html','dist/privacy.html');
const notices=(await Promise.all(['fflate','yaml'].map(async name=>`# ${name}\n\n${await readFile('node_modules/'+name+'/LICENSE','utf8')}`))).join('\n\n');
await writeFile('dist/THIRD-PARTY-LICENSES.txt',notices);await writeFile('index-repo/THIRD-PARTY-LICENSES.txt',notices);

