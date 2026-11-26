import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { proxyRequest } from '../worker.js';
const preview = { PREVIEW_ONLY:'true', FRONTEND_URL:'https://preview.invalid', API_ORIGIN:'https://preview-api.invalid', ASSETS:{fetch:async()=>new Response('landing assets')} };
const noUpstream = () => { throw new Error('Preview must never call API'); };
test('both configs explicitly isolate preview variables while preserving production', async () => {
  for (const file of ['../../wrangler.jsonc','../wrangler.jsonc']) {
    const config = JSON.parse(await readFile(new URL(file, import.meta.url), 'utf8'));
    assert.deepEqual(config.previews.vars, { FRONTEND_URL:'https://preview.invalid', API_ORIGIN:'https://preview-api.invalid', PREVIEW_ONLY:'true' });
    assert.equal(config.name,'relayforge');
    assert.equal(config.vars.FRONTEND_URL,'https://relayforge.deepmuse.workers.dev');
    assert.equal(config.vars.API_ORIGIN,'https://relayforge-staging-api.onrender.com');
    assert.equal(config.assets.binding,'ASSETS');
  }
});
test('preview homepage renders assets without using upstream', async () => {
  assert.equal(await (await proxyRequest(new Request('https://branch.example/'),preview,noUpstream)).text(),'landing assets');
});
test('preview session check is explicitly unauthenticated and never forwards cookies', async () => {
  const res=await proxyRequest(new Request('https://branch.example/v1/me',{headers:{Cookie:'rf_session=fixture'}}),preview,noUpstream);
  assert.equal(res.status,401); assert.equal(res.headers.get('cache-control'),'no-store'); assert.equal(res.headers.get('set-cookie'),null);
});
test('preview OAuth, mutations and health do not touch production services', async () => {
  for (const [route,method] of [['/auth/github/start','GET'],['/auth/google/callback','GET'],['/v1/auth/logout','POST'],['/health/ready','GET']]) {
    assert.equal((await proxyRequest(new Request('https://branch.example'+route,{method}),preview,noUpstream)).status,503);
  }
});
