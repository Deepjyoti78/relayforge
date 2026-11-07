const { config } = require('dotenv');
process.env.ENV_FILE = process.env.ENV_FILE || '.env.test';
config({ path: process.env.ENV_FILE, quiet: true });
for (const key of ['DATABASE_URL', 'WORKER_DATABASE_URL', 'MIGRATION_DATABASE_URL', 'REDIS_URL']) {
  if (!process.env[key]) throw new Error(`Integration configuration requires ${key}`);
}
for (const key of ['DATABASE_URL', 'WORKER_DATABASE_URL', 'MIGRATION_DATABASE_URL']) {
  if (!new URL(process.env[key]).pathname.endsWith('_test')) {
    throw new Error('Integration tests require a dedicated database whose name ends in _test');
  }
}
process.env.LOG_LEVEL = 'silent';
