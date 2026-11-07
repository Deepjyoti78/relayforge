-- CreateEnum
CREATE TYPE "event_status" AS ENUM ('RECEIVED', 'PROCESSING', 'COMPLETED', 'FAILED');

-- CreateEnum
CREATE TYPE "outbox_status" AS ENUM ('PENDING', 'DISPATCHED', 'FAILED');

-- CreateTable: endpoints
CREATE TABLE "endpoints" (
    "id" UUID NOT NULL,
    "org_id" UUID NOT NULL,
    "name" VARCHAR(128) NOT NULL,
    "slug" VARCHAR(128) NOT NULL,
    "secret_ciphertext" TEXT NOT NULL,
    "secret_iv" VARCHAR(32) NOT NULL,
    "secret_tag" VARCHAR(32) NOT NULL,
    "secret_preview" VARCHAR(16) NOT NULL,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "endpoints_pkey" PRIMARY KEY ("id")
);

-- CreateTable: events
CREATE TABLE "events" (
    "id" UUID NOT NULL,
    "org_id" UUID NOT NULL,
    "endpoint_id" UUID NOT NULL,
    "idempotency_key" VARCHAR(255),
    "event_type" VARCHAR(128) NOT NULL,
    "payload" JSONB NOT NULL,
    "headers" JSONB,
    "status" "event_status" NOT NULL DEFAULT 'RECEIVED',
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "events_pkey" PRIMARY KEY ("id")
);

-- CreateTable: outbox_messages
CREATE TABLE "outbox_messages" (
    "id" UUID NOT NULL,
    "event_id" UUID NOT NULL,
    "org_id" UUID NOT NULL,
    "channel" VARCHAR(64) NOT NULL DEFAULT 'events',
    "payload" JSONB NOT NULL,
    "status" "outbox_status" NOT NULL DEFAULT 'PENDING',
    "attempt_count" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "dispatched_at" TIMESTAMPTZ(3),

    CONSTRAINT "outbox_messages_pkey" PRIMARY KEY ("id")
);

-- CreateIndexes
CREATE UNIQUE INDEX "endpoints_org_id_slug_key" ON "endpoints"("org_id", "slug");
CREATE INDEX "endpoints_org_id_idx" ON "endpoints"("org_id");

CREATE UNIQUE INDEX "events_endpoint_id_idempotency_key_key" ON "events"("endpoint_id", "idempotency_key");
CREATE INDEX "events_org_id_idx" ON "events"("org_id");
CREATE INDEX "events_endpoint_id_idx" ON "events"("endpoint_id");
CREATE INDEX "events_created_at_idx" ON "events"("created_at");

CREATE INDEX "outbox_messages_status_created_at_idx" ON "outbox_messages"("status", "created_at");
CREATE INDEX "outbox_messages_org_id_idx" ON "outbox_messages"("org_id");

-- AddForeignKeys
ALTER TABLE "endpoints" ADD CONSTRAINT "endpoints_org_id_fkey" FOREIGN KEY ("org_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "events" ADD CONSTRAINT "events_org_id_fkey" FOREIGN KEY ("org_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "events" ADD CONSTRAINT "events_endpoint_id_fkey" FOREIGN KEY ("endpoint_id") REFERENCES "endpoints"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "outbox_messages" ADD CONSTRAINT "outbox_messages_event_id_fkey" FOREIGN KEY ("event_id") REFERENCES "events"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "outbox_messages" ADD CONSTRAINT "outbox_messages_org_id_fkey" FOREIGN KEY ("org_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Enable and FORCE Row-Level Security
ALTER TABLE "endpoints" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "endpoints" FORCE ROW LEVEL SECURITY;

ALTER TABLE "events" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "events" FORCE ROW LEVEL SECURITY;

ALTER TABLE "outbox_messages" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "outbox_messages" FORCE ROW LEVEL SECURITY;

-- RLS Policies: endpoints
CREATE POLICY "endpoints_select_policy" ON "endpoints"
FOR SELECT
USING (
  org_id = NULLIF(current_setting('app.current_org_id', true), '')::uuid
  AND is_org_member(org_id, NULLIF(current_setting('app.current_user_id', true), '')::uuid)
);

CREATE POLICY "endpoints_insert_policy" ON "endpoints"
FOR INSERT
WITH CHECK (
  org_id = NULLIF(current_setting('app.current_org_id', true), '')::uuid
  AND get_org_role(org_id, NULLIF(current_setting('app.current_user_id', true), '')::uuid) IN ('OWNER', 'DEVELOPER')
);

CREATE POLICY "endpoints_update_policy" ON "endpoints"
FOR UPDATE
USING (
  org_id = NULLIF(current_setting('app.current_org_id', true), '')::uuid
  AND get_org_role(org_id, NULLIF(current_setting('app.current_user_id', true), '')::uuid) IN ('OWNER', 'DEVELOPER')
)
WITH CHECK (
  org_id = NULLIF(current_setting('app.current_org_id', true), '')::uuid
  AND get_org_role(org_id, NULLIF(current_setting('app.current_user_id', true), '')::uuid) IN ('OWNER', 'DEVELOPER')
);

CREATE POLICY "endpoints_delete_policy" ON "endpoints"
FOR DELETE
USING (
  org_id = NULLIF(current_setting('app.current_org_id', true), '')::uuid
  AND get_org_role(org_id, NULLIF(current_setting('app.current_user_id', true), '')::uuid) IN ('OWNER', 'DEVELOPER')
);

-- RLS Policies: events
CREATE POLICY "events_select_policy" ON "events"
FOR SELECT
USING (
  org_id = NULLIF(current_setting('app.current_org_id', true), '')::uuid
  AND (
    current_setting('app.current_user_id', true) IS NULL
    OR current_setting('app.current_user_id', true) = ''
    OR is_org_member(org_id, NULLIF(current_setting('app.current_user_id', true), '')::uuid)
  )
);

CREATE POLICY "events_insert_policy" ON "events"
FOR INSERT
WITH CHECK (
  org_id = NULLIF(current_setting('app.current_org_id', true), '')::uuid
);

-- RLS Policies: outbox_messages
CREATE POLICY "outbox_messages_tenant_policy" ON "outbox_messages"
FOR ALL
USING (
  org_id = NULLIF(current_setting('app.current_org_id', true), '')::uuid
)
WITH CHECK (
  org_id = NULLIF(current_setting('app.current_org_id', true), '')::uuid
);

-- Helper function: get_endpoint_for_ingestion
CREATE OR REPLACE FUNCTION get_endpoint_for_ingestion(p_endpoint_id UUID)
RETURNS TABLE (
  id UUID,
  org_id UUID,
  name VARCHAR(128),
  slug VARCHAR(128),
  secret_ciphertext TEXT,
  secret_iv VARCHAR(32),
  secret_tag VARCHAR(32),
  is_active BOOLEAN
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT id, org_id, name, slug, secret_ciphertext, secret_iv, secret_tag, is_active
  FROM endpoints
  WHERE id = p_endpoint_id
    AND is_active = true
  LIMIT 1;
$$;

-- Grant permissions to runtime roles
GRANT SELECT, INSERT, UPDATE, DELETE ON "endpoints" TO relayforge_api, relayforge_worker;
GRANT SELECT, INSERT, UPDATE, DELETE ON "events" TO relayforge_api, relayforge_worker;
GRANT SELECT, INSERT, UPDATE, DELETE ON "outbox_messages" TO relayforge_api, relayforge_worker;
GRANT EXECUTE ON FUNCTION get_endpoint_for_ingestion(UUID) TO relayforge_api;


-- Helper function: find_event_by_idempotency
CREATE OR REPLACE FUNCTION find_event_by_idempotency(p_endpoint_id UUID, p_idempotency_key TEXT)
RETURNS TABLE (
  id UUID,
  created_at TIMESTAMPTZ(3),
  status "event_status"
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT id, created_at, status
  FROM events
  WHERE endpoint_id = p_endpoint_id
    AND idempotency_key = p_idempotency_key
  LIMIT 1;
$$;

GRANT EXECUTE ON FUNCTION find_event_by_idempotency(UUID, TEXT) TO relayforge_api;
