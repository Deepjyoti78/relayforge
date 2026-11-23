const { test, expect } = require('@playwright/test');
const base = 'http://localhost:5175';

test.beforeEach(async ({ context }) => {
  await context.route('https://**/*', route => route.abort());
});

async function signIn(page, provider, redirect = base) {
  await page.goto(`/auth/${provider}/start?redirect_uri=${encodeURIComponent(redirect)}`);
  await expect(page).toHaveURL(/\/(dashboard|onboarding)(\?|$)/);
  await expect.poll(() => page.evaluate(async () => (await fetch('/v1/me', { credentials: 'include' })).status)).toBe(200);
}
async function me(page) {
  return page.evaluate(async () => { const res = await fetch('/v1/me', { credentials: 'include' });
    return { status: res.status, cache: res.headers.get('cache-control'), body: await res.json() }; });
}

for (const provider of ['google', 'github']) {
  test(`${provider}: real cookie persistence, frontend reload and logout; provider exchange mocked`, async ({ page, context }) => {
    await signIn(page, provider);
    const before = await me(page);
    expect(before.cache).toBe('no-store');
    expect(before.body.organizations.length).toBeGreaterThan(0);
    const cookie = (await context.cookies()).find(c => c.name === 'rf_session');
    expect(cookie.httpOnly).toBe(true); expect(cookie.sameSite).toBe('Lax'); expect(cookie.expires).toBeGreaterThan(Date.now() / 1000);
    expect((await context.cookies()).some(c => c.name.includes('_oauth_'))).toBe(false);
    expect(await page.evaluate(() => document.cookie)).not.toContain('rf_session');
    expect(page.url()).not.toContain('token=');
    expect(await page.evaluate(() => [localStorage.getItem('rf_session_token'), localStorage.getItem('rf_oauth_token')])).toEqual([null, null]);
    await page.reload();
    await expect.poll(async () => (await me(page)).status).toBe(200);
    expect((await me(page)).body.id).toBe(before.body.id);
    // Real frontend must have revalidated the HttpOnly cookie and cached this user.
    await expect.poll(() => page.evaluate(() => JSON.parse(localStorage.getItem('rf_cached_user') || 'null')?.id)).toBe(before.body.id);
    await page.evaluate(async () => { const api = await import('/src/api.ts'); await api.logout(); });
    expect((await context.cookies()).some(c => c.name === 'rf_session')).toBe(false);
    await page.reload(); expect((await me(page)).status).toBe(401);
  });
  test(`${provider}: rejects a stolen callback state in another browser`, async ({ page, browser }) => {
    const started = await page.request.get(`/auth/${provider}/start`, { maxRedirects: 0 });
    const state = new URL(started.headers().location).searchParams.get('state');
    const other = await browser.newContext();
    try {
      const otherPage = await other.newPage();
      await otherPage.goto(`${base}/auth/${provider}/callback?code=browser-mock-code&state=${state}`);
      expect(otherPage.url()).toContain('error=');
      expect((await other.cookies()).some(c => c.name === 'rf_session')).toBe(false);
      await page.goto(`/auth/${provider}/callback?code=browser-mock-code&state=${state}`);
      expect((await me(page)).status).toBe(200);
    } finally { await other.close(); }
  });
  test(`${provider}: untrusted redirect falls back to configured frontend`, async ({ page }) => {
    await signIn(page, provider, 'https://attacker.pages.dev/capture');
  });
}

for (const action of ['expire', 'revoke']) {
  test(`${action}: old cookie receives 401 and is cleared after reload`, async ({ page, context }) => {
    await signIn(page, 'google');
    const res = await page.request.post('http://127.0.0.1:3311/__test/session/' + action, {
      headers: { Cookie: 'rf_session=' + (await context.cookies()).find(c => c.name === 'rf_session').value },
    });
    expect(res.status()).toBe(204);
    await page.reload();
    await expect.poll(async () => (await me(page)).status).toBe(401);
    expect((await context.cookies()).some(c => c.name === 'rf_session')).toBe(false);
  });
}

test('same-site but untrusted origin cannot log out a cookie-authenticated user', async ({ page }) => {
  await signIn(page, 'google');
  await page.goto('http://localhost:3311');
  const result = await page.evaluate(async () => {
    try { await fetch('http://localhost:5175/v1/auth/logout', { method: 'POST', credentials: 'include' }); return 'readable'; }
    catch { return 'CORS blocked'; }
  });
  expect(result).toBe('CORS blocked');
  await page.goto(base); expect((await me(page)).status).toBe(200);
});

test('failed logout is reported and does not pretend to clear the active server session', async ({ page }) => {
  await signIn(page, 'google');
  await page.route('**/v1/auth/logout', route => route.fulfill({ status: 503 }));
  const rejected = await page.evaluate(async () => { try { await (await import('/src/api.ts')).logout(); return false; } catch { return true; } });
  expect(rejected).toBe(true); expect((await me(page)).status).toBe(200);
});

for (const action of ['revoke', 'remove-membership']) {
  test('live SSE reauthorizes after ' + action, async ({ page, context }) => {
    await signIn(page, 'google');
    const orgId = (await me(page)).body.organizations[0].id;
    await page.evaluate(id => {
      window.__sseState = { opens: 0, state: 0 };
      window.__sse = new EventSource('/v1/organizations/' + id + '/events/stream', { withCredentials: true });
      window.__sse.onopen = () => { window.__sseState.opens++; window.__sseState.state = window.__sse.readyState; };
      window.__sse.onerror = () => { window.__sseState.state = window.__sse.readyState; };
    }, orgId);
    await expect.poll(() => page.evaluate(() => window.__sseState.opens)).toBe(1);
    const cookie = (await context.cookies()).find(c => c.name === 'rf_session');
    const res = await page.request.post('http://127.0.0.1:3311/__test/session/' + action, {
      headers: { Cookie: 'rf_session=' + cookie.value, 'x-test-org': orgId },
    });
    expect(res.status()).toBe(204);
    // The old connection is bounded to 30 seconds; automatic reconnect hits the
    // real session and RLS membership guards and then fails closed.
    await expect.poll(() => page.evaluate(() => window.__sseState.state), { timeout: 40000, intervals: [500] }).toBe(2);
    const denied = await page.request.get('/v1/organizations/' + orgId + '/events/stream');
    expect(denied.status()).toBe(action === 'revoke' ? 401 : 403);
  });
}
