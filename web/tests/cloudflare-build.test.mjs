import {test} from 'node:test';
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {readFile} from 'node:fs/promises';
const {buildFrontend} = createRequire(import.meta.url)('../../scripts/build-cloudflare.cjs');
test('Cloudflare installs locked frontend dev dependencies before compiling, even from repository root', () => {
  const calls=[];
  assert.equal(buildFrontend(args=>{calls.push(args);return 0;}),0);
  assert.equal(calls.length,2);
  assert.match(calls[0][1],/[\\/]web$/);
  assert.deepEqual(calls[0].slice(2),['ci','--include=dev']);
  assert.deepEqual(calls[1],['--prefix',calls[0][1],'run','build']);
});
test('failed dependency installation stops the build and preserves failure', () => {
  let calls=0;
  assert.equal(buildFrontend(()=>{calls++;return 42;}),42);
  assert.equal(calls,1);
});
test('compiler failures are propagated', () => {
  let calls=0;
  assert.equal(buildFrontend(()=>++calls===1?0:2),2);
});
test('frontend build uses installed Vite without npx downloading a different version', async () => {
  const manifest=JSON.parse(await readFile(new URL('../package.json',import.meta.url),'utf8'));
  assert.equal(manifest.scripts.build,'tsc && vite build');
});
