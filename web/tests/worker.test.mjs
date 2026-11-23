import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {proxyRequest} from '../worker.js';

const env = {API_ORIGIN:'https://api.example.test', FRONTEND_URL:'https://app.example.test', ASSETS:{fetch:async () => new Response('SPA')}};
test('both Wrangler entry points wire the Worker and reserved routes before SPA fallback', async () => {
  for (const config of [new URL('../../wrangler.jsonc',import.meta.url),new URL('../wrangler.jsonc',import.meta.url)]) {
    const settings=JSON.parse(await readFile(config,'utf8'));
    assert.equal(new URL(settings.main,config).pathname,new URL('../worker.js',import.meta.url).pathname);
    assert.equal(settings.assets.binding,'ASSETS');
    assert.equal(new URL(settings.assets.directory+'/',config).pathname,new URL('../dist/',import.meta.url).pathname);
    for (const route of ['/auth','/auth/*','/v1','/v1/*','/health','/health/*']) assert.ok(settings.assets.run_worker_first.includes(route));
    assert.equal(settings.assets.not_found_handling,'single-page-application');
  }
});
test('fixed upstream preserves request, multiple cookies and provider redirect without following/caching', async () => {
  const request = new Request(env.FRONTEND_URL+'/auth/google/callback?state=state&code=code', {method:'POST',headers:{Cookie:'binding=opaque', Origin:'https://attacker.example.test', Referer:'https://attacker.example.test/', Authorization:'Bearer manual', 'X-Forwarded-Host':'attacker.example.test'}, body:'payload'});
  const response = await proxyRequest(request, env, async (outbound, options) => {
    assert.equal(outbound.url, env.API_ORIGIN+'/auth/google/callback?state=state&code=code');
    assert.equal(outbound.method, 'POST'); assert.equal(await outbound.text(), 'payload');
    assert.equal(outbound.headers.get('cookie'), 'binding=opaque');
    assert.equal(outbound.headers.get('origin'), 'https://attacker.example.test');
    assert.equal(outbound.headers.get('referer'), 'https://attacker.example.test/');
    assert.equal(outbound.headers.get('authorization'), 'Bearer manual');
    assert.equal(outbound.headers.get('x-forwarded-host'), null);
    assert.equal(options.redirect, 'manual'); assert.equal(options.cache, 'no-store');
    const headers = new Headers({Location:'https://accounts.google.com/authorize', 'Cache-Control':'public, max-age=3600'});
    headers.append('Set-Cookie','state=; Max-Age=0; HttpOnly; Secure; SameSite=Lax; Path=/');
    headers.append('Set-Cookie','session=opaque; HttpOnly; Secure; SameSite=Lax; Path=/');
    return new Response(null,{status:302,headers});
  });
  assert.equal(response.status,302); assert.equal(response.headers.get('Location'),'https://accounts.google.com/authorize');
  assert.equal(response.headers.getSetCookie().length,2);
  assert.equal(response.headers.get('Cache-Control'),'no-store');
  assert.equal(response.headers.get('Cloudflare-CDN-Cache-Control'),'no-store');
});
test('unconfigured, insecure, credentialed, path-bearing or looping origins fail closed', async () => {
  for (const bad of ['', 'http://api.example.test', 'https://user:password@api.example.test', 'https://api.example.test/base', env.FRONTEND_URL]) {
    const response=await proxyRequest(new Request(env.FRONTEND_URL+'/v1/me'),{...env,API_ORIGIN:bad},()=>{throw new Error('Must not egress');});
    assert.equal(response.status,503);
  }
  assert.equal((await proxyRequest(new Request('https://preview.example.test/v1/me'),env)).status,421);
});
test('legacy OAuth session-token redirects fail closed without forwarding cookies or Location', async () => {
  for (const location of [env.FRONTEND_URL+'/?token=opaque',env.FRONTEND_URL+'/#access_token=opaque']) {
    const response=await proxyRequest(new Request(env.FRONTEND_URL+'/auth/google/callback'),env,async()=>new Response(null,{status:302,headers:{Location:location,'Set-Cookie':'session=opaque; HttpOnly; Secure; Path=/'}}));
    assert.equal(response.status,503); assert.equal(response.headers.get('Location'),null);
    assert.equal(response.headers.get('Set-Cookie'),null); assert.equal(response.headers.get('Cache-Control'),'no-store');
  }
});
test('only reserved API routes proxy, and URL-looking paths/queries cannot change upstream', async () => {
  assert.equal(await (await proxyRequest(new Request(env.FRONTEND_URL+'/dashboard/deliveries'),env)).text(),'SPA');
  assert.equal(await (await proxyRequest(new Request(env.FRONTEND_URL+'/v1evil'),env)).text(),'SPA');
  await proxyRequest(new Request(env.FRONTEND_URL+'/v1//attacker.example.test?upstream=https://attacker.example.test'),env,async outbound=>{
    assert.equal(new URL(outbound.url).origin,env.API_ORIGIN); return new Response(null,{status:204});
  });
});
test('upstream failures remain explicit and SSE is streamed, not buffered', async () => {
  assert.equal((await proxyRequest(new Request(env.FRONTEND_URL+'/v1/me'),env,async()=>{throw new Error('offline');})).status,503);
  for (const status of [401,403,502,503]) assert.equal((await proxyRequest(new Request(env.FRONTEND_URL+'/v1/me'),env,async()=>new Response('error',{status}))).status,status);
  let streamController;
  const stream=new ReadableStream({start(controller){streamController=controller; controller.enqueue(new TextEncoder().encode('data: first\n\n'));}});
  const response=await proxyRequest(new Request(env.FRONTEND_URL+'/v1/organizations/org/events/stream'),env,async()=>new Response(stream,{headers:{'Content-Type':'text/event-stream'}}));
  const reader=response.body.getReader();
  assert.equal(new TextDecoder().decode((await reader.read()).value),'data: first\n\n');
  streamController.enqueue(new TextEncoder().encode('data: second\n\n')); streamController.close();
  assert.equal(new TextDecoder().decode((await reader.read()).value),'data: second\n\n');
  assert.equal((await reader.read()).done,true);
});
