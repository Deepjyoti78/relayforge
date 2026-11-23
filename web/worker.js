// Fixed-upstream same-origin gateway. No provider credentials or session storage.
const apiPath = pathname => ['/auth', '/v1', '/health'].some(prefix => pathname === prefix || pathname.startsWith(prefix + '/'));
const unavailable = message => new Response(message, {status:503, headers:{'Cache-Control':'no-store', 'Content-Type':'text/plain; charset=utf-8'}});

function configuredOrigin(value, allowLocal = false) {
  const url = new URL(value);
  const local = allowLocal && url.protocol === 'http:' && ['localhost', '127.0.0.1'].includes(url.hostname);
  if ((!local && url.protocol !== 'https:') || url.username || url.password || url.pathname !== '/' || url.search || url.hash) throw new Error('Invalid origin');
  return url.origin;
}

// fetchUpstream is injectable for local contract/browser tests; the deployed
// default always uses Workers fetch with the configured HTTPS API_ORIGIN.
export async function proxyRequest(request, env, fetchUpstream = fetch) {
  const incoming = new URL(request.url);
  if (!apiPath(incoming.pathname)) return env.ASSETS.fetch(request);
  let upstreamOrigin, frontendOrigin;
  try {
    upstreamOrigin = configuredOrigin(env.API_ORIGIN);
    frontendOrigin = configuredOrigin(env.FRONTEND_URL, true);
    if (upstreamOrigin === frontendOrigin) throw new Error('Proxy loop');
  } catch { return unavailable('Authentication gateway is not configured.'); }
  if (incoming.origin !== frontendOrigin) return new Response('Unconfigured frontend origin', {status:421, headers:{'Cache-Control':'no-store'}});

  // Assign pathname/search separately: a double slash must never select a host.
  const target = new URL(upstreamOrigin);
  target.pathname = incoming.pathname;
  target.search = incoming.search;
  const outbound = new Request(target, request);
  for (const name of ['host', 'forwarded', 'x-forwarded-host', 'x-forwarded-proto', 'x-forwarded-for', 'connection', 'upgrade', 'keep-alive', 'te', 'trailer', 'transfer-encoding']) outbound.headers.delete(name);
  // Preserve the browser's Origin/Referer, Cookie and Authorization. In
  // particular, never replace an untrusted Origin with the trusted frontend.
  let upstream;
  try { upstream = await fetchUpstream(outbound, {redirect:'manual', cache:'no-store'}); }
  catch { return unavailable('Authentication service is temporarily unavailable.'); }
  if (incoming.pathname.startsWith('/auth/') && upstream.headers.has('Location')) {
    try {
      const location = new URL(upstream.headers.get('Location'), frontendOrigin);
      const fragment = new URLSearchParams(location.hash.slice(1));
      if (['token','session_token','access_token','id_token'].some(name => location.searchParams.has(name) || fragment.has(name))) {
        return unavailable('Authentication service requires an update.');
      }
    } catch { return unavailable('Authentication service returned an invalid redirect.'); }
  }
  // Do not read/buffer the body: SSE and large payloads remain streams. Cloning
  // the Response preserves distinct Set-Cookie headers and provider Location.
  const response = new Response(upstream.body, upstream);
  response.headers.set('Cache-Control', 'no-store');
  response.headers.set('CDN-Cache-Control', 'no-store');
  response.headers.set('Cloudflare-CDN-Cache-Control', 'no-store');
  response.headers.set('Referrer-Policy', 'no-referrer');
  return response;
}

export default {fetch: (request, env) => proxyRequest(request, env)};
