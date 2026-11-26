// Frontend-only build, usable from either Cloudflare root. Never deploys or uses DB credentials.
const { spawnSync } = require('node:child_process');
const path = require('node:path');
const fs = require('node:fs');
const root = path.resolve(__dirname, '..');
function buildFrontend(run) {
  // Cloudflare may install only root/backend dependencies before invoking us.
  // Always install the frontend lockfile, including its TypeScript/Vite tooling.
  for (const args of [
    ['--prefix', path.join(root, 'web'), 'ci', '--include=dev'],
    ['--prefix', path.join(root, 'web'), 'run', 'build'],
  ]) {
    const code = run(args);
    if (code !== 0) return code;
  }
  return 0;
}
function main() {
  if (!process.env.npm_execpath) throw new Error('Run npm run build:cloudflare');
  const code = buildFrontend(args => {
    const result = spawnSync(process.execPath, [process.env.npm_execpath, ...args], {
      cwd: root, env: { ...process.env, VITE_API_URL: '/' }, stdio: 'inherit',
    });
    return result.error || result.status === null ? 1 : result.status;
  });
  if (code !== 0) { process.exitCode = code; return; }
  if (!fs.existsSync(path.join(root, 'web/dist/index.html'))) throw new Error('Missing frontend build output');
  console.log('Cloudflare frontend assets ready; no backend build, migration or deployment performed.');
}
module.exports = { buildFrontend };
if (require.main === module) { try { main(); } catch (error) { console.error(error.message); process.exitCode = 1; } }
