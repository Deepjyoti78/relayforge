// UI-only tests: session responses are mocked. Provider/cookie integration tests
// remain in the normal PostgreSQL-backed browser suite.
const { test, expect } = require('@playwright/test');
test.beforeEach(async ({ page }) => {
  await page.route('https://**/*', route => route.abort());
});

test('landing content and login are usable before the session request completes', async ({ page }) => {
  let release;
  const pending = new Promise(resolve => { release = resolve; });
  let finished = false;
  await page.route('**/v1/me', async route => {
    await pending;
    finished = true;
    await route.fulfill({ status: 401, json: {} });
  });
  try {
    await page.goto('/');
    await expect(page.getByRole('heading', { level: 1 })).toContainText('Every event.');
    await expect(page.locator('#hero-signin-btn')).toBeVisible();
    expect(finished).toBe(false);
    await page.locator('#hero-signin-btn').click();
    await expect(page.getByRole('button', { name: 'Continue with Google' })).toBeVisible();
    await page.screenshot({ path: '.cache/landing-login.png' });
    await page.getByRole('button', { name: 'Close modal', exact: true }).click();
    await page.screenshot({ path: '.cache/landing-desktop.png' });
  } finally { release(); }
});

test('verified returning user reaches the intended dashboard after revalidation and reload', async ({ page }) => {
  const org = { id: 'fixture-org', name: 'Fixture workspace', slug: 'fixture', role: 'OWNER', createdAt: '2026-01-01', updatedAt: '2026-01-01' };
  await page.route('**/v1/organizations/**', route => route.fulfill({ json: route.request().url().endsWith('/members') ? [] : org }));
  await page.route('**/v1/me', route => route.fulfill({ json: {
    id: 'fixture-user', email: 'user@example.test', displayName: 'Fixture user',
    avatarUrl: null, createdAt: '2026-01-01', organizations: [org],
  } }));
  await page.goto('/dashboard/settings?org=fixture-org');
  await expect(page.locator('main[data-active-tab="settings"]')).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Opening your workspace.' })).toHaveCount(0);
  await page.reload();
  await expect(page.locator('main[data-active-tab="settings"]')).toBeVisible();
  await expect(page).toHaveURL(/\/dashboard\/settings\?org=fixture-org$/);
});

test('protected route keeps account data hidden during slow session verification', async ({ page }) => {
  await page.route('**/v1/me', async route => {
    await new Promise(resolve => setTimeout(resolve, 6500));
    await route.fulfill({ status: 401, json: {} });
  });
  await page.goto('/dashboard?tab=deliveries');
  await expect(page.getByRole('heading', { name: 'Opening your workspace.' })).toBeVisible();
  await expect(page.locator('[data-active-tab]')).toHaveCount(0);
  await expect(page.getByRole('status')).toContainText('longer than usual', { timeout: 6000 });
  await page.screenshot({ path: '.cache/session-loading-desktop.png' });
  await expect(page.getByRole('heading', { level: 1 })).toContainText('Every event.', { timeout: 6000 });
});

test('session outage is retryable and preserves the protected route', async ({ page }) => {
  let attempts = 0;
  await page.route('**/v1/me', route => {
    attempts++;
    return route.fulfill({ status: 503, json: {} });
  });
  await page.goto('/dashboard?tab=deliveries&org=test-org');
  await expect(page.getByRole('alert')).toContainText('session may still be active');
  const before = attempts;
  await page.getByRole('button', { name: 'Retry', exact: true }).click();
  await expect.poll(() => attempts).toBeGreaterThan(before);
  await expect(page.getByRole('button', { name: 'Retry', exact: true })).toBeVisible();
  await expect(page).toHaveURL(/dashboard\?tab=deliveries&org=test-org/);
  await expect(page.locator('[data-active-tab]')).toHaveCount(0);
});

test('landing remains available when the API fails and uses the new light sans typography', async ({ page }) => {
  await page.route('**/v1/me', route => route.fulfill({ status: 502, json: {} }));
  await page.goto('/');
  await expect(page.getByRole('alert')).toContainText('still explore');
  await expect(page.locator('#hero-signin-btn')).toBeVisible();
  expect(await page.locator('h1').evaluate(el => getComputedStyle(el).fontFamily)).toContain('Helvetica Neue');
  const secondLine = await page.locator('.rf-headline-line-2').evaluate(el => {
    const style = getComputedStyle(el);
    return { family: style.fontFamily, weight: style.fontWeight, color: style.color };
  });
  expect(secondLine.family).toContain('Helvetica Neue');
  expect(secondLine.weight).toBe('400');
  expect(secondLine.color).toBe('rgb(170, 165, 158)');
  expect(await page.locator('h1').evaluate(el => getComputedStyle(el).fontWeight)).toBe('400');
});

test('mobile landing has no horizontal overflow and reduced-motion loading is static', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.route('**/v1/me', route => route.fulfill({ status: 401, json: {} }));
  await page.goto('/');
  await expect(page.locator('#hero-signin-btn')).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await page.screenshot({ path: '.cache/landing-mobile.png', fullPage: true });
  await page.route('**/v1/me', route => route.fulfill({ status: 503, json: {} }));
  await page.goto('/dashboard');
  await expect(page.getByRole('alert')).toBeVisible();
  expect(await page.locator('.rf-session-relay span').first().evaluate(el => getComputedStyle(el).animationName)).toBe('none');
  await page.screenshot({ path: '.cache/session-error-mobile.png' });
});

test('hero stays exactly two lines without clipped text across mobile and desktop', async ({ page }) => {
  await page.route('**/v1/me', route => route.fulfill({ status: 401, json: {} }));
  await page.goto('/');
  for (const width of [320, 390, 768, 1280, 1860]) {
    await page.setViewportSize({ width, height: 940 });
    const lines = await page.locator('.rf-hero-headline > span').evaluateAll(spans => spans.map(span => {
      const range = document.createRange();
      range.selectNodeContents(span);
      const rects = [...range.getClientRects()];
      const heading = span.parentElement.getBoundingClientRect();
      return { text: span.textContent, count: rects.length, fits: rects.every(rect => rect.right <= heading.right + 1 && rect.right <= innerWidth) };
    }));
    expect(lines.map(line => line.text)).toEqual(['Every event.', 'Delivered reliably.']);
    expect(lines.every(line => line.count === 1 && line.fits), `two complete lines at ${width}px`).toBe(true);
  }
  await page.screenshot({ path: '.cache/landing-two-line-desktop.png' });
});

test('delivery ticker is labeled as a sample and can be paused and resumed', async ({ page }) => {
  await page.route('**/v1/me', route => route.fulfill({ status: 401, json: {} }));
  await page.goto('/');
  const ticker = page.getByRole('region', { name: 'Webhook delivery preview' });
  await ticker.scrollIntoViewIfNeeded();
  await expect(ticker).toContainText('Illustrative stream');
  await expect(ticker).toContainText('No customer data');
  await expect(page.getByText('Trusted By Engineering Teams Building Reliable Systems', { exact: true })).toHaveCount(0);
  await expect(page.locator('.rf-trusted-section')).toHaveCount(0);
  await expect(ticker.getByRole('listitem')).toHaveCount(6);
  await ticker.getByRole('button', { name: 'Pause delivery preview' }).click();
  await expect(ticker.getByRole('button', { name: 'Resume delivery preview' })).toHaveAttribute('aria-pressed', 'true');
  expect(await ticker.locator('.rf-ticker-track').evaluate(el => getComputedStyle(el).animationPlayState)).toBe('paused');
  await ticker.getByRole('button', { name: 'Resume delivery preview' }).click();
  await page.mouse.move(0, 0);
  await page.locator('h1').click();
  expect(await ticker.locator('.rf-ticker-track').evaluate(el => getComputedStyle(el).animationPlayState)).toBe('running');
  await page.screenshot({ path: '.cache/landing-ticker-desktop.png', fullPage: true });
});

test('reduced-motion ticker is static and all sample events remain readable on mobile', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.setViewportSize({ width: 320, height: 844 });
  await page.route('**/v1/me', route => route.fulfill({ status: 401, json: {} }));
  await page.goto('/');
  const ticker = page.getByRole('region', { name: 'Webhook delivery preview' });
  await ticker.scrollIntoViewIfNeeded();
  expect(await ticker.locator('.rf-ticker-track').evaluate(el => getComputedStyle(el).animationName)).toBe('none');
  await expect(ticker.getByRole('listitem')).toHaveCount(6);
  await expect(ticker.getByRole('button')).toHaveCount(0);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await page.screenshot({ path: '.cache/landing-ticker-mobile.png', fullPage: true });
});
