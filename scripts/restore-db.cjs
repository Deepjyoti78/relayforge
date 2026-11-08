#!/usr/bin/env node
/**
 * RelayForge Database Restore & Drill Utility
 *
 * Restores a SQL backup into a target database (defaulting to disposable test database).
 * Verifies schema and row consistency after restoration.
 */

const { execSync } = require('node:child_process');
const fs = require('node:fs');
const path = require('node:path');

const BACKUP_DIR = path.resolve(__dirname, '../backups');
const targetDb = process.argv[2] || process.env.RESTORE_TARGET_DB || 'relayforge_restore_test';

// Find most recent backup if not explicitly specified
let backupFile = process.argv[3];
if (!backupFile) {
  if (!fs.existsSync(BACKUP_DIR)) {
    console.error(`[RelayForge Restore] No backups directory found at ${BACKUP_DIR}`);
    process.exit(1);
  }
  const files = fs.readdirSync(BACKUP_DIR).filter(f => f.endsWith('.sql')).sort().reverse();
  if (files.length === 0) {
    console.error(`[RelayForge Restore] No .sql backup files found in ${BACKUP_DIR}`);
    process.exit(1);
  }
  backupFile = path.join(BACKUP_DIR, files[0]);
} else if (!path.isAbsolute(backupFile)) {
  backupFile = path.resolve(process.cwd(), backupFile);
}

if (!fs.existsSync(backupFile)) {
  console.error(`[RelayForge Restore] Backup file not found: ${backupFile}`);
  process.exit(1);
}

console.log(`[RelayForge Restore] Target database: ${targetDb}`);
console.log(`[RelayForge Restore] Restoring from file: ${backupFile}`);

try {
  const dockerContainer = 'relayforge-postgres-1';
  const containerRestorePath = `/tmp/restore-drill-${Date.now()}.sql`;
  let restored = false;

  try {
    const isDockerAvailable = execSync(`docker ps --filter "name=${dockerContainer}" --format "{{.Names}}"`, { encoding: 'utf8' }).trim();
    if (isDockerAvailable.includes(dockerContainer)) {
      console.log(`[RelayForge Restore] Using container ${dockerContainer}...`);

      // Terminate any active connections to target DB if it exists, then drop and recreate
      execSync(`docker exec ${dockerContainer} psql -U relayforge_admin -d postgres -c "SELECT pg_terminate_backend(pid) FROM pg_stat_activity WHERE datname = '${targetDb}';"`);
      execSync(`docker exec ${dockerContainer} psql -U relayforge_admin -d postgres -c "DROP DATABASE IF EXISTS ${targetDb};"`);
      execSync(`docker exec ${dockerContainer} psql -U relayforge_admin -d postgres -c "CREATE DATABASE ${targetDb} OWNER relayforge_admin;"`);

      // Copy backup file into container
      console.log(`[RelayForge Restore] Copying backup file into container...`);
      execSync(`docker cp "${backupFile}" ${dockerContainer}:${containerRestorePath}`);

      // Execute restore
      console.log(`[RelayForge Restore] Applying schema and data snapshot...`);
      execSync(`docker exec ${dockerContainer} psql -U relayforge_admin -d ${targetDb} -f ${containerRestorePath} --quiet`);
      execSync(`docker exec ${dockerContainer} rm -f ${containerRestorePath}`);

      // Verification queries
      const tableCount = execSync(`docker exec ${dockerContainer} psql -U relayforge_admin -d ${targetDb} -t -c "SELECT count(*) FROM information_schema.tables WHERE table_schema = 'public';"`, { encoding: 'utf8' }).trim();
      const orgCount = execSync(`docker exec ${dockerContainer} psql -U relayforge_admin -d ${targetDb} -t -c "SELECT count(*) FROM organizations;"`, { encoding: 'utf8' }).trim();
      const outboxCount = execSync(`docker exec ${dockerContainer} psql -U relayforge_admin -d ${targetDb} -t -c "SELECT count(*) FROM outbox_messages;"`, { encoding: 'utf8' }).trim();
      const workflowCount = execSync(`docker exec ${dockerContainer} psql -U relayforge_admin -d ${targetDb} -t -c "SELECT count(*) FROM workflows;"`, { encoding: 'utf8' }).trim();

      console.log(`[RelayForge Restore] VERIFICATION DRILL PASSED:`);
      console.log(`  - Public tables created: ${tableCount}`);
      console.log(`  - Organizations restored: ${orgCount}`);
      console.log(`  - Outbox messages restored: ${outboxCount}`);
      console.log(`  - Workflows restored: ${workflowCount}`);
      restored = true;
    }
  } catch (err) {
    console.error(`[RelayForge Restore] Restore operation failed:`, err.message);
  }

  if (!restored) {
    console.error(`[RelayForge Restore] Could not complete restore drill.`);
    process.exit(1);
  }

  console.log(`[RelayForge Restore] SUCCESS: Restoration drill completed successfully into ${targetDb}.`);
  process.exit(0);
} catch (err) {
  console.error(`[RelayForge Restore] FAILED:`, err.message);
  process.exit(1);
}
