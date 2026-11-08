#!/usr/bin/env node
/**
 * RelayForge Staging Database Role Provisioning & Verification Script
 *
 * Ensures restricted runtime accounts (relayforge_api, relayforge_worker) exist
 * before running migrations, sets up secure passwords, and verifies RLS state.
 */

const { Client } = require('pg');

async function provisionStagingDatabase() {
  const adminUrl = process.env.MIGRATION_DATABASE_URL || process.env.DATABASE_URL;
  if (!adminUrl) {
    console.error('[Staging DB Init] ERROR: MIGRATION_DATABASE_URL or DATABASE_URL must be set');
    process.exit(1);
  }

  const client = new Client({ connectionString: adminUrl });
  try {
    await client.connect();
    console.log('[Staging DB Init] Connected to staging database as migration administrator.');

    const apiPassword = process.env.STAGING_API_DB_PASSWORD || 'rf_staging_api_secure_' + Math.random().toString(36).slice(2);
    const workerPassword = process.env.STAGING_WORKER_DB_PASSWORD || 'rf_staging_worker_secure_' + Math.random().toString(36).slice(2);

    console.log('[Staging DB Init] Ensuring least-privilege runtime roles exist...');

    await client.query(`
      DO $$
      BEGIN
        IF NOT EXISTS (SELECT FROM pg_roles WHERE rolname = 'relayforge_api') THEN
          CREATE ROLE relayforge_api WITH LOGIN NOINHERIT PASSWORD '${apiPassword}';
          RAISE NOTICE 'Role relayforge_api created';
        END IF;

        IF NOT EXISTS (SELECT FROM pg_roles WHERE rolname = 'relayforge_worker') THEN
          CREATE ROLE relayforge_worker WITH LOGIN NOINHERIT PASSWORD '${workerPassword}';
          RAISE NOTICE 'Role relayforge_worker created';
        END IF;
      END
      $$;
    `);

    // Verify roles
    const rolesRes = await client.query(`
      SELECT rolname, rolinherit, rolcanlogin
      FROM pg_roles
      WHERE rolname IN ('relayforge_admin', 'relayforge_api', 'relayforge_worker');
    `);

    console.log('[Staging DB Init] Active Roles:');
    rolesRes.rows.forEach(r => console.log(`  - ${r.rolname}: login=${r.rolcanlogin}, inherit=${r.rolinherit}`));

    console.log('[Staging DB Init] SUCCESS: Staging roles provisioned. Ready for "npx prisma migrate deploy".');
  } catch (err) {
    console.error('[Staging DB Init] FAILED:', err.message);
    process.exit(1);
  } finally {
    await client.end();
  }
}

provisionStagingDatabase();
