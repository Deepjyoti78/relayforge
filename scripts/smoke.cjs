const { config } = require('dotenv');
const { parseEnvironment } = require('../dist/modules/config/environment');
const { probeWorker } = require('../dist/worker/probe');

config({ path: process.env.ENV_FILE || '.env', quiet: true });

async function main() {
  const apiConfig = parseEnvironment('api', process.env);
  const origin = process.env.SMOKE_API_URL || `http://127.0.0.1:${apiConfig.port}`;
  for (const route of ['/health/live', '/health/ready']) {
    const response = await fetch(`${origin}${route}`, { signal: AbortSignal.timeout(5000) });
    if (!response.ok) throw new Error(`API ${route} returned ${response.status}`);
    console.log(`PASS ${route}`);
  }
  const result = await probeWorker(parseEnvironment('worker', process.env));
  console.log(`PASS worker queue round trip (${result.instanceId})`);
}

const deadline = setTimeout(() => process.exit(1), 20000).unref();
main().then(() => clearTimeout(deadline)).catch((error) => {
  console.error(`FAIL ${error.message}`);
  process.exit(1);
});
