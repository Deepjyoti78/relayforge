// Frontend-only build, usable from either Cloudflare root. Never deploys or uses DB credentials.
const { spawnSync } = require('node:child_process');
const path = require('node:path');
const fs = require('node:fs');
const root = path.resolve(__dirname, '..');
function main() {
  if (!process.env.npm_execpath) throw new Error('Run npm run build:cloudflare');
  const result = spawnSync(process.execPath, [process.env.npm_execpath, '--prefix', path.join(root, 'web'), 'run', 'build'], {
    cwd: root, env: { ...process.env, VITE_API_URL: '/' }, stdio: 'inherit',
  });
  if (result.error || result.status !== 0) { process.exitCode = result.status || 1; return; }
  if (!fs.existsSync(path.join(root, 'web/dist/index.html'))) throw new Error('Missing frontend build output');
  console.log('Cloudflare frontend assets ready; no backend build, migration or deployment performed.');
}
if (require.main === module) { try { main(); } catch (error) { console.error(error.message); process.exitCode = 1; } }
