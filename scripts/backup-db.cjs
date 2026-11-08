#!/usr/bin/env node
/**
 * RelayForge Automated Database Backup Utility
 *
 * Exports consistent snapshot of database schema and rows.
 * High-performance container-native dump avoids memory buffer limits.
 */

const { execSync } = require('node:child_process');
const fs = require('node:fs');
const path = require('node:path');

const BACKUP_DIR = path.resolve(__dirname, '../backups');
if (!fs.existsSync(BACKUP_DIR)) {
  fs.mkdirSync(BACKUP_DIR, { recursive: true });
}

const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
const backupFile = path.join(BACKUP_DIR, `relayforge-backup-${timestamp}.sql`);
const containerDumpPath = `/tmp/rf-backup-${timestamp}.sql`;

console.log(`[RelayForge Backup] Initiating backup at ${timestamp}...`);

try {
  const dockerContainer = 'relayforge-postgres-1';
  let dumped = false;

  try {
    const isDockerAvailable = execSync(`docker ps --filter "name=${dockerContainer}" --format "{{.Names}}"`, { encoding: 'utf8' }).trim();
    if (isDockerAvailable.includes(dockerContainer)) {
      console.log(`[RelayForge Backup] Executing pg_dump inside ${dockerContainer} (user: relayforge_admin)...`);
      execSync(`docker exec ${dockerContainer} pg_dump -U relayforge_admin -d relayforge --clean --if-exists -f ${containerDumpPath}`);
      execSync(`docker cp ${dockerContainer}:${containerDumpPath} "${backupFile}"`);
      execSync(`docker exec ${dockerContainer} rm -f ${containerDumpPath}`);
      dumped = true;
    }
  } catch (err) {
    console.warn(`[RelayForge Backup] Docker dump path failed:`, err.message);
  }

  if (!dumped) {
    console.error(`[RelayForge Backup] FAILED: Could not create backup.`);
    process.exit(1);
  }

  const stat = fs.statSync(backupFile);
  console.log(`[RelayForge Backup] SUCCESS: Backup saved to ${backupFile} (${(stat.size / (1024 * 1024)).toFixed(2)} MB)`);
  process.exit(0);
} catch (err) {
  console.error(`[RelayForge Backup] FAILED:`, err.message);
  process.exit(1);
}
