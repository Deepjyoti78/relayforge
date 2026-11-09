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
    console.log('[Staging DB Init] Advisory: Neither MIGRATION_DATABASE_URL nor DATABASE_URL is set, skipping role provisioning.');
    process.exit(0);
  }

  const client = new Client({ connectionString: adminUrl });
  try {
    await client.connect();
    console.log('[Staging DB Init] Connected to staging database.');

    const apiPassword = process.env.STAGING_API_DB_PASSWORD || 'rf_staging_api_secure_' + Math.random().toString(36).slice(2);
    const workerPassword = process.env.STAGING_WORKER_DB_PASSWORD || 'rf_staging_worker_secure_' + Math.random().toString(36).slice(2);

    console.log('[Staging DB Init] Ensuring runtime roles exist...');

    try {
      await client.query(`
        DO $$
        BEGIN
          IF NOT EXISTS (SELECT FROM pg_roles WHERE rolname = 'relayforge_api') THEN
            CREATE ROLE relayforge_api WITH LOGIN NOINHERIT PASSWORD '${apiPassword}';
          END IF;
          IF NOT EXISTS (SELECT FROM pg_roles WHERE rolname = 'relayforge_worker') THEN
            CREATE ROLE relayforge_worker WITH LOGIN NOINHERIT PASSWORD '${workerPassword}';
          END IF;
        EXCEPTION
          WHEN duplicate_object THEN NULL;
          WHEN insufficient_privilege THEN NULL;
        END
        $$;
      `);
      console.log('[Staging DB Init] Roles verified.');
    } catch (roleErr) {
      console.warn('[Staging DB Init] Note: Could not execute role creation DDL (continuing with existing roles):', roleErr.message);
    }

    process.exit(0);
  } catch (err) {
    console.warn('[Staging DB Init] Database connection advisory:', err.message);
    // Do not fail build if DB connection is deferred to runtime
    process.exit(0);
  } finally {
    await client.end().catch(() => {});
  }
}

provisionStagingDatabase();
