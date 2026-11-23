const { defineConfig } = require('@playwright/test');
const path = require('node:path');
const fs = require('node:fs');
const envFile = process.env.ENV_FILE || (fs.existsSync('.env.test') ? '.env.test' : path.resolve('..', '.env.test'));
module.exports = defineConfig({
  testDir: './tests/browser', testMatch: '*.browser.cjs', timeout: 45000,
  fullyParallel: false, workers: 1, reporter: 'list',
  outputDir: '.cache/playwright-results',
  use: { baseURL: 'http://localhost:5175', browserName: 'chromium', trace: 'off' },
  webServer: [
    { command: 'node tests/browser/server.cjs', url: 'http://127.0.0.1:3310/health/live', timeout: 60000,
      reuseExistingServer: false, env: { ENV_FILE: envFile, NODE_ENV: 'test', FRONTEND_URL: 'http://localhost:5175',
        GITHUB_CALLBACK_URL: 'http://localhost:5175/auth/github/callback', GOOGLE_CALLBACK_URL: 'http://localhost:5175/auth/google/callback',
        SESSION_COOKIE_NAME: 'rf_session', SESSION_COOKIE_SAME_SITE: 'lax', LOG_LEVEL: 'silent' } },
    { command: 'npm --prefix web run dev -- --port 5175 --strictPort', url: 'http://localhost:5175', timeout: 60000,
      reuseExistingServer: false, env: { VITE_API_URL: '/', DEV_API_PROXY_TARGET: 'http://127.0.0.1:3312' } },
  ],
});
