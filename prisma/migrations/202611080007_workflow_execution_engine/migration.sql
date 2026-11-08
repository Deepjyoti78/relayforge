-- CreateEnum: workflow_status
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'workflow_status') THEN
    CREATE TYPE "workflow_status" AS ENUM ('DRAFT', 'ACTIVE', 'PAUSED', 'ARCHIVED');
  END IF;
END $$;

-- CreateEnum: workflow_execution_status
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'workflow_execution_status') THEN
    CREATE TYPE "workflow_execution_status" AS ENUM ('QUEUED', 'RUNNING', 'SUCCEEDED', 'FAILED', 'FILTERED', 'RETRY_WAIT', 'CANCELLED');
  END IF;
END $$;

-- CreateEnum: workflow_step_type
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'workflow_step_type') THEN
    CREATE TYPE "workflow_step_type" AS ENUM ('TRIGGER', 'CONDITION', 'TRANSFORM', 'HTTP_ACTION');
  END IF;
END $$;

-- CreateEnum: workflow_step_status
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'workflow_step_status') THEN
    CREATE TYPE "workflow_step_status" AS ENUM ('PENDING', 'RUNNING', 'SUCCEEDED', 'FAILED', 'SKIPPED', 'RETRY_WAIT');
  END IF;
END $$;

-- CreateTable: workflows
CREATE TABLE IF NOT EXISTS "workflows" (
    "id" UUID NOT NULL,
    "org_id" UUID NOT NULL,
    "endpoint_id" UUID NOT NULL,
    "name" VARCHAR(128) NOT NULL,
    "description" VARCHAR(512),
    "status" "workflow_status" NOT NULL DEFAULT 'DRAFT',
    "active_version_id" UUID,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "workflows_pkey" PRIMARY KEY ("id")
);

-- CreateTable: workflow_versions
CREATE TABLE IF NOT EXISTS "workflow_versions" (
    "id" UUID NOT NULL,
    "workflow_id" UUID NOT NULL,
    "org_id" UUID NOT NULL,
    "version_number" INTEGER NOT NULL,
    "definition" JSONB NOT NULL,
    "definition_hash" VARCHAR(64) NOT NULL,
    "published_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "workflow_versions_pkey" PRIMARY KEY ("id")
);

-- CreateTable: workflow_executions
CREATE TABLE IF NOT EXISTS "workflow_executions" (
    "id" UUID NOT NULL,
    "org_id" UUID NOT NULL,
    "workflow_id" UUID NOT NULL,
    "workflow_version_id" UUID NOT NULL,
    "event_id" UUID NOT NULL,
    "status" "workflow_execution_status" NOT NULL DEFAULT 'QUEUED',
    "current_step" INTEGER NOT NULL DEFAULT 0,
    "started_at" TIMESTAMPTZ(3),
    "completed_at" TIMESTAMPTZ(3),
    "failure_reason" TEXT,
    "context" JSONB,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "workflow_executions_pkey" PRIMARY KEY ("id")
);

-- CreateTable: workflow_step_executions
CREATE TABLE IF NOT EXISTS "workflow_step_executions" (
    "id" UUID NOT NULL,
    "execution_id" UUID NOT NULL,
    "org_id" UUID NOT NULL,
    "node_id" VARCHAR(64) NOT NULL,
    "step_index" INTEGER NOT NULL,
    "step_type" "workflow_step_type" NOT NULL,
    "status" "workflow_step_status" NOT NULL DEFAULT 'PENDING',
    "attempt_count" INTEGER NOT NULL DEFAULT 0,
    "input_snapshot" JSONB,
    "output_snapshot" JSONB,
    "error_details" JSONB,
    "started_at" TIMESTAMPTZ(3),
    "completed_at" TIMESTAMPTZ(3),
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "workflow_step_executions_pkey" PRIMARY KEY ("id")
);

-- AlterTable: outbox_messages
ALTER TABLE "outbox_messages" ADD COLUMN IF NOT EXISTS "workflow_execution_id" UUID;

-- AlterTable: delivery_attempts
ALTER TABLE "delivery_attempts" ADD COLUMN IF NOT EXISTS "workflow_execution_id" UUID;
ALTER TABLE "delivery_attempts" ADD COLUMN IF NOT EXISTS "step_execution_id" UUID;

-- CreateIndexes
CREATE INDEX IF NOT EXISTS "workflows_org_id_idx" ON "workflows"("org_id");
CREATE INDEX IF NOT EXISTS "workflows_endpoint_id_idx" ON "workflows"("endpoint_id");
CREATE INDEX IF NOT EXISTS "workflows_org_id_status_idx" ON "workflows"("org_id", "status");

CREATE UNIQUE INDEX IF NOT EXISTS "workflow_versions_workflow_id_version_number_key" ON "workflow_versions"("workflow_id", "version_number");
CREATE INDEX IF NOT EXISTS "workflow_versions_org_id_idx" ON "workflow_versions"("org_id");
CREATE INDEX IF NOT EXISTS "workflow_versions_workflow_id_idx" ON "workflow_versions"("workflow_id");

CREATE INDEX IF NOT EXISTS "workflow_executions_org_id_idx" ON "workflow_executions"("org_id");
CREATE INDEX IF NOT EXISTS "workflow_executions_workflow_id_idx" ON "workflow_executions"("workflow_id");
CREATE INDEX IF NOT EXISTS "workflow_executions_event_id_idx" ON "workflow_executions"("event_id");
CREATE INDEX IF NOT EXISTS "workflow_executions_status_created_at_idx" ON "workflow_executions"("status", "created_at");

CREATE UNIQUE INDEX IF NOT EXISTS "workflow_step_executions_execution_id_step_index_key" ON "workflow_step_executions"("execution_id", "step_index");
CREATE INDEX IF NOT EXISTS "workflow_step_executions_org_id_idx" ON "workflow_step_executions"("org_id");
CREATE INDEX IF NOT EXISTS "workflow_step_executions_execution_id_idx" ON "workflow_step_executions"("execution_id");

CREATE INDEX IF NOT EXISTS "outbox_messages_workflow_execution_id_idx" ON "outbox_messages"("workflow_execution_id");
CREATE INDEX IF NOT EXISTS "delivery_attempts_workflow_execution_id_idx" ON "delivery_attempts"("workflow_execution_id");
CREATE INDEX IF NOT EXISTS "delivery_attempts_step_execution_id_idx" ON "delivery_attempts"("step_execution_id");

-- AddForeignKeys (idempotent DO blocks)
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'workflows_org_id_fkey') THEN
    ALTER TABLE "workflows" ADD CONSTRAINT "workflows_org_id_fkey" FOREIGN KEY ("org_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'workflows_endpoint_id_fkey') THEN
    ALTER TABLE "workflows" ADD CONSTRAINT "workflows_endpoint_id_fkey" FOREIGN KEY ("endpoint_id") REFERENCES "endpoints"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'workflows_active_version_id_fkey') THEN
    ALTER TABLE "workflows" ADD CONSTRAINT "workflows_active_version_id_fkey" FOREIGN KEY ("active_version_id") REFERENCES "workflow_versions"("id") ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'workflow_versions_workflow_id_fkey') THEN
    ALTER TABLE "workflow_versions" ADD CONSTRAINT "workflow_versions_workflow_id_fkey" FOREIGN KEY ("workflow_id") REFERENCES "workflows"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'workflow_versions_org_id_fkey') THEN
    ALTER TABLE "workflow_versions" ADD CONSTRAINT "workflow_versions_org_id_fkey" FOREIGN KEY ("org_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'workflow_executions_org_id_fkey') THEN
    ALTER TABLE "workflow_executions" ADD CONSTRAINT "workflow_executions_org_id_fkey" FOREIGN KEY ("org_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'workflow_executions_workflow_id_fkey') THEN
    ALTER TABLE "workflow_executions" ADD CONSTRAINT "workflow_executions_workflow_id_fkey" FOREIGN KEY ("workflow_id") REFERENCES "workflows"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'workflow_executions_workflow_version_id_fkey') THEN
    ALTER TABLE "workflow_executions" ADD CONSTRAINT "workflow_executions_workflow_version_id_fkey" FOREIGN KEY ("workflow_version_id") REFERENCES "workflow_versions"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'workflow_executions_event_id_fkey') THEN
    ALTER TABLE "workflow_executions" ADD CONSTRAINT "workflow_executions_event_id_fkey" FOREIGN KEY ("event_id") REFERENCES "events"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'workflow_step_executions_execution_id_fkey') THEN
    ALTER TABLE "workflow_step_executions" ADD CONSTRAINT "workflow_step_executions_execution_id_fkey" FOREIGN KEY ("execution_id") REFERENCES "workflow_executions"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'workflow_step_executions_org_id_fkey') THEN
    ALTER TABLE "workflow_step_executions" ADD CONSTRAINT "workflow_step_executions_org_id_fkey" FOREIGN KEY ("org_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'outbox_messages_workflow_execution_id_fkey') THEN
    ALTER TABLE "outbox_messages" ADD CONSTRAINT "outbox_messages_workflow_execution_id_fkey" FOREIGN KEY ("workflow_execution_id") REFERENCES "workflow_executions"("id") ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'delivery_attempts_workflow_execution_id_fkey') THEN
    ALTER TABLE "delivery_attempts" ADD CONSTRAINT "delivery_attempts_workflow_execution_id_fkey" FOREIGN KEY ("workflow_execution_id") REFERENCES "workflow_executions"("id") ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'delivery_attempts_step_execution_id_fkey') THEN
    ALTER TABLE "delivery_attempts" ADD CONSTRAINT "delivery_attempts_step_execution_id_fkey" FOREIGN KEY ("step_execution_id") REFERENCES "workflow_step_executions"("id") ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END $$;

-- Enable and FORCE Row-Level Security
ALTER TABLE "workflows" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "workflows" FORCE ROW LEVEL SECURITY;

ALTER TABLE "workflow_versions" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "workflow_versions" FORCE ROW LEVEL SECURITY;

ALTER TABLE "workflow_executions" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "workflow_executions" FORCE ROW LEVEL SECURITY;

ALTER TABLE "workflow_step_executions" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "workflow_step_executions" FORCE ROW LEVEL SECURITY;

-- RLS Policies: workflows
DO $$ BEGIN
  DROP POLICY IF EXISTS "workflows_select_policy" ON "workflows";
  CREATE POLICY "workflows_select_policy" ON "workflows"
  FOR SELECT
  USING (
    org_id = NULLIF(current_setting('app.current_org_id', true), '')::uuid
    AND (
      current_setting('app.current_user_id', true) IS NULL
      OR current_setting('app.current_user_id', true) = ''
      OR is_org_member(org_id, NULLIF(current_setting('app.current_user_id', true), '')::uuid)
    )
  );

  DROP POLICY IF EXISTS "workflows_insert_policy" ON "workflows";
  CREATE POLICY "workflows_insert_policy" ON "workflows"
  FOR INSERT
  WITH CHECK (
    org_id = NULLIF(current_setting('app.current_org_id', true), '')::uuid
    AND (
      current_setting('app.current_user_id', true) IS NULL
      OR current_setting('app.current_user_id', true) = ''
      OR get_org_role(org_id, NULLIF(current_setting('app.current_user_id', true), '')::uuid) IN ('OWNER', 'DEVELOPER')
    )
  );

  DROP POLICY IF EXISTS "workflows_update_policy" ON "workflows";
  CREATE POLICY "workflows_update_policy" ON "workflows"
  FOR UPDATE
  USING (
    org_id = NULLIF(current_setting('app.current_org_id', true), '')::uuid
    AND (
      current_setting('app.current_user_id', true) IS NULL
      OR current_setting('app.current_user_id', true) = ''
      OR get_org_role(org_id, NULLIF(current_setting('app.current_user_id', true), '')::uuid) IN ('OWNER', 'DEVELOPER')
    )
  )
  WITH CHECK (
    org_id = NULLIF(current_setting('app.current_org_id', true), '')::uuid
    AND (
      current_setting('app.current_user_id', true) IS NULL
      OR current_setting('app.current_user_id', true) = ''
      OR get_org_role(org_id, NULLIF(current_setting('app.current_user_id', true), '')::uuid) IN ('OWNER', 'DEVELOPER')
    )
  );

  DROP POLICY IF EXISTS "workflows_delete_policy" ON "workflows";
  CREATE POLICY "workflows_delete_policy" ON "workflows"
  FOR DELETE
  USING (
    org_id = NULLIF(current_setting('app.current_org_id', true), '')::uuid
    AND (
      current_setting('app.current_user_id', true) IS NULL
      OR current_setting('app.current_user_id', true) = ''
      OR get_org_role(org_id, NULLIF(current_setting('app.current_user_id', true), '')::uuid) IN ('OWNER', 'DEVELOPER')
    )
  );
END $$;

-- RLS Policies: workflow_versions (Immutable: once inserted, updates are prohibited)
DO $$ BEGIN
  DROP POLICY IF EXISTS "workflow_versions_select_policy" ON "workflow_versions";
  CREATE POLICY "workflow_versions_select_policy" ON "workflow_versions"
  FOR SELECT
  USING (
    org_id = NULLIF(current_setting('app.current_org_id', true), '')::uuid
    AND (
      current_setting('app.current_user_id', true) IS NULL
      OR current_setting('app.current_user_id', true) = ''
      OR is_org_member(org_id, NULLIF(current_setting('app.current_user_id', true), '')::uuid)
    )
  );

  DROP POLICY IF EXISTS "workflow_versions_insert_policy" ON "workflow_versions";
  CREATE POLICY "workflow_versions_insert_policy" ON "workflow_versions"
  FOR INSERT
  WITH CHECK (
    org_id = NULLIF(current_setting('app.current_org_id', true), '')::uuid
    AND (
      current_setting('app.current_user_id', true) IS NULL
      OR current_setting('app.current_user_id', true) = ''
      OR get_org_role(org_id, NULLIF(current_setting('app.current_user_id', true), '')::uuid) IN ('OWNER', 'DEVELOPER')
    )
  );

  DROP POLICY IF EXISTS "workflow_versions_update_policy" ON "workflow_versions";
  CREATE POLICY "workflow_versions_update_policy" ON "workflow_versions"
  FOR UPDATE
  USING (false);

  DROP POLICY IF EXISTS "workflow_versions_delete_policy" ON "workflow_versions";
  CREATE POLICY "workflow_versions_delete_policy" ON "workflow_versions"
  FOR DELETE
  USING (
    org_id = NULLIF(current_setting('app.current_org_id', true), '')::uuid
    AND (
      current_setting('app.current_user_id', true) IS NULL
      OR current_setting('app.current_user_id', true) = ''
      OR get_org_role(org_id, NULLIF(current_setting('app.current_user_id', true), '')::uuid) IN ('OWNER', 'DEVELOPER')
    )
  );
END $$;

-- RLS Policies: workflow_executions
DO $$ BEGIN
  DROP POLICY IF EXISTS "workflow_executions_tenant_policy" ON "workflow_executions";
  CREATE POLICY "workflow_executions_tenant_policy" ON "workflow_executions"
  FOR ALL
  USING (
    org_id = NULLIF(current_setting('app.current_org_id', true), '')::uuid
    AND (
      current_setting('app.current_user_id', true) IS NULL
      OR current_setting('app.current_user_id', true) = ''
      OR is_org_member(org_id, NULLIF(current_setting('app.current_user_id', true), '')::uuid)
    )
  )
  WITH CHECK (
    org_id = NULLIF(current_setting('app.current_org_id', true), '')::uuid
  );
END $$;

-- RLS Policies: workflow_step_executions
DO $$ BEGIN
  DROP POLICY IF EXISTS "workflow_step_executions_tenant_policy" ON "workflow_step_executions";
  CREATE POLICY "workflow_step_executions_tenant_policy" ON "workflow_step_executions"
  FOR ALL
  USING (
    org_id = NULLIF(current_setting('app.current_org_id', true), '')::uuid
    AND (
      current_setting('app.current_user_id', true) IS NULL
      OR current_setting('app.current_user_id', true) = ''
      OR is_org_member(org_id, NULLIF(current_setting('app.current_user_id', true), '')::uuid)
    )
  )
  WITH CHECK (
    org_id = NULLIF(current_setting('app.current_org_id', true), '')::uuid
  );
END $$;

-- Grant table permissions to runtime roles
GRANT SELECT, INSERT, UPDATE, DELETE ON "workflows" TO relayforge_api, relayforge_worker;
GRANT SELECT, INSERT, UPDATE, DELETE ON "workflow_versions" TO relayforge_api, relayforge_worker;
GRANT SELECT, INSERT, UPDATE, DELETE ON "workflow_executions" TO relayforge_api, relayforge_worker;
GRANT SELECT, INSERT, UPDATE, DELETE ON "workflow_step_executions" TO relayforge_api, relayforge_worker;

-- Helper function: get_active_workflow_for_endpoint
CREATE OR REPLACE FUNCTION get_active_workflow_for_endpoint(p_endpoint_id UUID)
RETURNS TABLE (
  workflow_id UUID,
  org_id UUID,
  version_id UUID,
  version_number INT,
  definition JSONB
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT w.id, w.org_id, wv.id, wv.version_number, wv.definition
  FROM workflows w
  JOIN workflow_versions wv ON wv.id = w.active_version_id
  WHERE w.endpoint_id = p_endpoint_id
    AND w.status = 'ACTIVE'
  LIMIT 1;
$$;

GRANT EXECUTE ON FUNCTION get_active_workflow_for_endpoint(UUID) TO relayforge_api, relayforge_worker;

-- Update claim_pending_outbox_messages to also return workflow_execution_id
DROP FUNCTION IF EXISTS claim_pending_outbox_messages(INT, INT);
CREATE OR REPLACE FUNCTION claim_pending_outbox_messages(
  p_limit INT DEFAULT 50,
  p_lease_seconds INT DEFAULT 30
)
RETURNS TABLE (
  id UUID,
  event_id UUID,
  org_id UUID,
  channel VARCHAR(64),
  payload JSONB,
  status "outbox_status",
  attempt_count INT,
  created_at TIMESTAMPTZ(3),
  event_type VARCHAR(128),
  max_retries INT,
  lease_token UUID,
  workflow_execution_id UUID
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN QUERY
  WITH claimed AS (
    SELECT o.id
    FROM outbox_messages o
    WHERE o.status = 'PENDING'
      AND (o.next_retry_at IS NULL OR o.next_retry_at <= NOW())
      AND (o.lease_expires_at IS NULL OR o.lease_expires_at <= NOW())
    ORDER BY COALESCE(o.next_retry_at, o.created_at) ASC
    LIMIT p_limit
    FOR UPDATE SKIP LOCKED
  ),
  updated AS (
    UPDATE outbox_messages o
    SET attempt_count = o.attempt_count + 1,
        lease_expires_at = NOW() + (p_lease_seconds || ' seconds')::INTERVAL,
        lease_token = gen_random_uuid()
    FROM claimed c
    WHERE o.id = c.id
    RETURNING o.id, o.event_id, o.org_id, o.channel, o.payload, o.status, o.attempt_count, o.created_at, o.max_retries, o.lease_token, o.workflow_execution_id
  )
  SELECT u.id, u.event_id, u.org_id, u.channel, u.payload::jsonb, u.status, u.attempt_count, u.created_at, COALESCE(e.event_type, 'webhook.event')::VARCHAR(128), u.max_retries, u.lease_token, u.workflow_execution_id
  FROM updated u
  LEFT JOIN events e ON e.id = u.event_id;
END;
$$;

GRANT EXECUTE ON FUNCTION claim_pending_outbox_messages(INT, INT) TO relayforge_worker, relayforge_api;

-- Helper function: get_workflow_execution_org
CREATE OR REPLACE FUNCTION get_workflow_execution_org(p_execution_id UUID)
RETURNS UUID
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT org_id FROM workflow_executions WHERE id = p_execution_id LIMIT 1;
$$;
GRANT EXECUTE ON FUNCTION get_workflow_execution_org(UUID) TO relayforge_api, relayforge_worker;

