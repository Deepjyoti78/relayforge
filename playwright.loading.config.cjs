const { defineConfig } = require('@playwright/test');
module.exports = defineConfig({
  testDir: './tests/browser', testMatch: 'loading.browser.cjs',
  workers: 1, timeout: 20000, reporter: 'list',
  outputDir: '.cache/loading-browser-results',
  use: { baseURL: 'http://localhost:5287', browserName: 'chromium' },
  webServer: {
    command: 'npm --prefix web run dev -- --port 5287 --strictPort',
    url: 'http://localhost:5287', reuseExistingServer: false,
    env: { VITE_API_URL: '/' },
  },
});
