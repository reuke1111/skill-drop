import { build } from 'esbuild';
import { spawnSync } from 'node:child_process';
const banner={js:"import { createRequire as nodeRequireFactory } from 'node:module'; const require = nodeRequireFactory(import.meta.url);"};
await import('../build.mjs');
await build({entryPoints:['src/github.ts'],outfile:'test-build/github.mjs',bundle:true,platform:'node',format:'esm',banner});
await build({entryPoints:['tests/exports.ts'],outfile:'test-build/phase3.mjs',bundle:true,platform:'node',format:'esm',target:'node22',banner});
await build({entryPoints:['src/content.ts'],outfile:'test-build/content.js',bundle:true,format:'iife',target:'chrome120'});
await build({entryPoints:['src/panel.ts'],outfile:'test-build/panel.js',bundle:true,format:'iife',target:'chrome120'});
const unit=spawnSync(process.execPath,['--test','tests/unit.test.mjs','tests/phase3.test.mjs','tests/panel.test.mjs','tests/upload-dialog.test.mjs','tests/release.test.mjs'],{stdio:'inherit'});
if(unit.status)process.exit(unit.status);
await import('./integration.mjs');
await import('./phase3-real.mjs');
await import('./repository-real.mjs');

