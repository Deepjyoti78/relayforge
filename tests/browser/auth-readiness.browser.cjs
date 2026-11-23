const { test, expect } = require('@playwright/test');

test.beforeEach(async ({ context }) => { await context.route('https://**/*', route => route.abort()); });
async function authenticate(page) {
  await page.goto('/auth/google/start');
  await expect.poll(() => page.evaluate(() => JSON.parse(localStorage.getItem('rf_cached_user') || 'null')?.id)).toBeTruthy();
  return page.evaluate(() => JSON.parse(localStorage.getItem('rf_cached_user')));
}

for (const failure of [502, 503, 'network']) {
  test(`${failure}: session lookup failure is recoverable without losing dashboard intent`, async ({ page, context }) => {
    const user = await authenticate(page);
    const before = (await context.cookies()).find(cookie => cookie.name === 'rf_session');
    const route = '/dashboard/deliveries?org=' + user.organizations[0].id;
    let unavailable = true;
    await page.route('**/v1/me', request => unavailable
      ? failure === 'network' ? request.abort('failed') : request.fulfill({ status: failure, contentType: 'text/html', body: 'Upstream unavailable' })
      : request.continue());
    await page.goto(route);
    await expect(page.getByRole('alert')).toContainText('Unable to verify your session');
    await expect(page.locator('#open-signin-button')).toHaveCount(0);
    expect(new URL(page.url()).pathname).toBe('/dashboard/deliveries');
    expect((await context.cookies()).find(cookie => cookie.name === 'rf_session').value).toBe(before.value);
    expect(await page.evaluate(() => JSON.parse(localStorage.getItem('rf_cached_user')).id)).toBe(user.id);
    unavailable = false;
    await page.getByRole('button', {name:'Retry', exact:true}).click();
    await expect(page.getByRole('alert')).toHaveCount(0);
    await expect(page).toHaveURL(new RegExp('/dashboard/deliveries\\?org=' + user.organizations[0].id + '$'));
    await page.reload();
    await expect(page).toHaveURL(new RegExp('/dashboard/deliveries\\?org=' + user.organizations[0].id + '$'));
    await expect.poll(() => page.evaluate(() => document.querySelector('[data-active-tab]')?.getAttribute('data-active-tab'))).toBe('deliveries');
  });
}

test('unverified cached user is not rendered when the session service is unavailable', async ({ page }) => {
  await page.addInitScript(() => localStorage.setItem('rf_cached_user', JSON.stringify({id:'unverified-cache', displayName:'Unverified cached identity', organizations:[]})));
  await page.route('**/v1/me', route => route.fulfill({status:503}));
  await page.goto('/dashboard');
  await expect(page.getByRole('alert')).toContainText('Unable to verify your session');
  await expect(page.getByText('Unverified cached identity', {exact:true})).toHaveCount(0);
});

test('login modal remains on the landing page until OAuth starts', async ({ page }) => {
  await page.goto('/');
  await page.locator('#open-signin-button').click();
  await expect(page.locator('#signin-modal-container')).toBeVisible();
  await expect(page).toHaveURL('http://localhost:5175/');
  await page.getByRole('button', {name:'Close modal',exact:true}).click();
  await expect(page.locator('#signin-modal-container')).toHaveCount(0);
  await expect(page).toHaveURL('http://localhost:5175/');
});

test('401 rejects protected content and clears untrusted cached identity', async ({ page }) => {
  await page.addInitScript(() => localStorage.setItem('rf_cached_user', JSON.stringify({id:'unverified-cache', displayName:'Unverified cached identity', organizations:[]})));
  await page.goto('/dashboard/deliveries');
  await expect(page.locator('#open-signin-button')).toBeVisible();
  await expect(page.locator('main[data-active-tab]')).toHaveCount(0);
  expect(await page.evaluate(() => localStorage.getItem('rf_cached_user'))).toBe(null);
});

test('dashboard navigation persists the selected tab and organization on reload', async ({ page }) => {
  const user = await authenticate(page);
  await page.goto('/dashboard?org=' + user.organizations[0].id);
  await page.locator('.rf-sidebar-desktop').getByRole('button',{name:/Delivery History/}).click();
  await expect(page).toHaveURL(new RegExp('/dashboard/deliveries\\?org=' + user.organizations[0].id + '$'));
  await page.reload();
  await expect(page.locator('main[data-active-tab="deliveries"]')).toBeVisible();
});

test('a route cannot select an organization outside the validated memberships', async ({ page }) => {
  const user = await authenticate(page);
  const foreign = '00000000-0000-4000-8000-000000000001';
  const requests=[];
  page.on('request',request=>requests.push(request.url()));
  await page.goto('/dashboard/deliveries?org=' + foreign);
  await expect(page).toHaveURL(new RegExp('/dashboard/deliveries\\?org=' + user.organizations[0].id + '$'));
  expect(requests.some(url=>url.includes('/v1/organizations/'+foreign))).toBe(false);
});

for (const provider of ['google','github']) {
  test(`${provider}: new account gets onboarding; returning account in a fresh browser gets dashboard`, async ({ page, browser }) => {
    expect((await page.request.post('http://127.0.0.1:3311/__test/identity', {headers:{'x-test-control':'rotate'}})).status()).toBe(204);
    const enter = async target => {
      await target.goto('/');
      await target.locator('#open-signin-button').click();
      await target.locator('#signin-modal-container').getByRole('button',{name:provider==='google'?'Continue with Google':'Continue with GitHub',exact:true}).click();
    };
    await enter(page);
    await expect(page).toHaveURL('http://localhost:5175/onboarding');
    await expect(page.getByRole('heading',{name:'Create Your Organization',exact:true})).toBeVisible();
    const user = await page.evaluate(async()=> (await fetch('/v1/me')).json());
    await page.reload();
    await expect(page.getByRole('heading',{name:'Create Your Organization',exact:true})).toBeVisible();
    await page.getByRole('button',{name:'Skip for now',exact:true}).click();
    await expect(page).toHaveURL(/\/dashboard\?org=/);
    const fresh = await browser.newContext();
    try {
      await fresh.route('https://**/*',route=>route.abort());
      const returning = await fresh.newPage();
      await enter(returning);
      await expect(returning).toHaveURL(/\/dashboard\?org=/);
      await expect(returning.getByRole('heading',{name:'Create Your Organization',exact:true})).toHaveCount(0);
      expect((await returning.evaluate(async()=> (await fetch('/v1/me')).json())).id).toBe(user.id);
      expect(returning.url()).not.toContain('token=');
      expect(await returning.evaluate(()=>[localStorage.getItem('rf_session_token'),localStorage.getItem('rf_oauth_token')])).toEqual([null,null]);
    } finally { await fresh.close(); }
  });
}
