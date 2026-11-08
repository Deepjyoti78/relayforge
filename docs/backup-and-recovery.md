# RelayForge Database Backup & Disaster Recovery Runbook

## 1. Overview & Recovery Objectives

RelayForge stores critical transactional outbox states, webhook delivery histories, and encrypted cryptographic secrets. To protect against infrastructure failures, data corruption, or operator error, this runbook defines backup procedures, restoration drills, and Disaster Recovery (DR) protocols.

- **Recovery Point Objective (RPO):** < 15 minutes (via automated WAL archiving / snapshots).
- **Recovery Time Objective (RTO):** < 30 minutes (full cluster restoration).

---

## 2. Automated Backup Protocol

### 2.1 Daily Logical Snapshots
RelayForge includes an automated backup utility in `scripts/backup-db.cjs`.

```bash
# Run logical backup
npm run db:backup
# or
node scripts/backup-db.cjs
```

The script:
1. Connects to PostgreSQL using privileged role `relayforge_admin`.
2. Generates a clean, consistent snapshot using `pg_dump` with `--clean --if-exists`.
3. Stores timestamped SQL archives in `./backups/relayforge-backup-<ISO-DATE>.sql`.
4. Supports running inside local Docker environments or direct remote PostgreSQL connections.

### 2.2 Production Cloud Storage Sync
In production environments (e.g. AWS or Render), pipe the output of `pg_dump` to an encrypted, versioned object storage bucket:
```bash
pg_dump "$DATABASE_URL" --format=custom --no-owner | \
  aws s3 cp - s3://relayforge-backups-prod/db/$(date +%Y-%m-%d-%H%M%S).dump --sse aws:kms
```
- **Lifecycle Policy:** Keep daily backups for 30 days; retain monthly backups for 365 days; transition older archives to Glacier / Coldline.

---

## 3. Restoration Procedure & Verification Drill

RelayForge mandates recurring restoration drills into disposable databases to guarantee backup validity without touching production data.

### 3.1 Executing the Restoration Drill
Run the included restoration script:
```bash
# Performs restore drill into disposable database 'relayforge_restore_test'
npm run db:restore
# or
node scripts/restore-db.cjs relayforge_restore_test ./backups/relayforge-backup-<TIMESTAMP>.sql
```

### 3.2 Automated Integrity Checks Performed
The restore utility automatically validates:
1. Schema integrity: Ensures all 18 public tables and indexes are recreated.
2. Tenant integrity: Confirms total organizations count matches pre-backup counts.
3. Outbox integrity: Validates outbox message counts and delivery attempts.
4. RLS Policy preservation: Confirms table policies remain attached and active.

---

## 4. Point-In-Time Recovery (PITR)

For managed databases (such as AWS RDS, Neon, or Supabase):
1. **Enable Continuous WAL Archiving:** Retain Write-Ahead Logs for 7 days.
2. **Restoring to a Specific Second:**
   - In AWS RDS: `aws rds restore-db-instance-to-point-in-time --source-db-instance-identifier prod-db --target-db-instance-identifier restore-db --restore-time 2026-11-08T12:00:00Z`.
   - Update `DATABASE_URL` and `WORKER_DATABASE_URL` to point to the restored instance once verified.

---

## 5. Migration Recovery & Rollback Runbook

If a migration fails during deployment (e.g. lock timeout or network interruption):

### 5.1 Inspect Migration Status
```bash
npx prisma migrate status
```

### 5.2 Rollback / Resolution Steps
1. **Do Not Manually Delete `_prisma_migrations` Rows:**
2. Inspect the failed SQL statement in `prisma/migrations/<migration_name>/migration.sql`.
3. If the failure was partial, manually roll back any partially created tables or constraints using `psql`.
4. Mark the migration as rolled back:
   ```bash
   npx prisma migrate resolve --rolled-back "<migration_name>"
   ```
5. Fix the migration script or underlying table issue, then re-run:
   ```bash
   npx prisma migrate deploy
   ```
