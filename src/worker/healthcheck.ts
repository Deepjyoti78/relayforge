import { config } from 'dotenv';
import { parseEnvironment } from '../modules/config/environment';
import { safeError } from '../modules/observability/logging';
import { probeWorker } from './probe';

config({ path: process.env.ENV_FILE ?? '.env', quiet: true });
const deadline = setTimeout(() => process.exit(1), 7500).unref();

void probeWorker(parseEnvironment('worker', process.env))
  .then(() => { clearTimeout(deadline); process.exitCode = 0; })
  .catch((error: unknown) => {
    console.error(JSON.stringify({ event: 'worker_probe_failed', error: safeError(error) }));
    process.exit(1);
  });
