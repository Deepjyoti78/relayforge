-- CreateEnum: delivery_status
CREATE TYPE "delivery_status" AS ENUM ('SUCCESS', 'FAILED');

-- CreateTable: delivery_attempts
CREATE TABLE "delivery_attempts" (
    "id" UUID NOT NULL,
    "org_id" UUID NOT NULL,
    "event_id" UUID NOT NULL,
    "destination_id" UUID NOT NULL,
    "outbox_message_id" UUID,
    "attempt_number" INTEGER NOT NULL DEFAULT 1,
    "status" "delivery_status" NOT NULL,
    "status_code" INTEGER,
    "latency_ms" INTEGER NOT NULL,
    "request_url" VARCHAR(2048) NOT NULL,
    "request_method" VARCHAR(16) NOT NULL DEFAULT 'POST',
    "request_headers" JSONB,
    "response_headers" JSONB,
    "response_body_preview" TEXT,
    "error_description" TEXT,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "delivery_attempts_pkey" PRIMARY KEY ("id")
);

-- CreateIndexes
CREATE INDEX "delivery_attempts_org_id_idx" ON "delivery_attempts"("org_id");
CREATE INDEX "delivery_attempts_event_id_idx" ON "delivery_attempts"("event_id");
CREATE INDEX "delivery_attempts_destination_id_idx" ON "delivery_attempts"("destination_id");
CREATE INDEX "delivery_attempts_created_at_idx" ON "delivery_attempts"("created_at");

-- AddForeignKeys
ALTER TABLE "delivery_attempts" ADD CONSTRAINT "delivery_attempts_org_id_fkey" FOREIGN KEY ("org_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "delivery_attempts" ADD CONSTRAINT "delivery_attempts_event_id_fkey" FOREIGN KEY ("event_id") REFERENCES "events"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "delivery_attempts" ADD CONSTRAINT "delivery_attempts_destination_id_fkey" FOREIGN KEY ("destination_id") REFERENCES "destinations"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "delivery_attempts" ADD CONSTRAINT "delivery_attempts_outbox_message_id_fkey" FOREIGN KEY ("outbox_message_id") REFERENCES "outbox_messages"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- Enable and FORCE Row-Level Security
ALTER TABLE "delivery_attempts" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "delivery_attempts" FORCE ROW LEVEL SECURITY;

-- RLS Policies: delivery_attempts
CREATE POLICY "delivery_attempts_select_policy" ON "delivery_attempts"
FOR SELECT
USING (
  org_id = NULLIF(current_setting('app.current_org_id', true), '')::uuid
  AND (
    current_setting('app.current_user_id', true) IS NULL
    OR current_setting('app.current_user_id', true) = ''
    OR is_org_member(org_id, NULLIF(current_setting('app.current_user_id', true), '')::uuid)
  )
);

CREATE POLICY "delivery_attempts_insert_policy" ON "delivery_attempts"
FOR INSERT
WITH CHECK (
  org_id = NULLIF(current_setting('app.current_org_id', true), '')::uuid
);

CREATE POLICY "delivery_attempts_update_policy" ON "delivery_attempts"
FOR UPDATE
USING (
  org_id = NULLIF(current_setting('app.current_org_id', true), '')::uuid
)
WITH CHECK (
  org_id = NULLIF(current_setting('app.current_org_id', true), '')::uuid
);

CREATE POLICY "delivery_attempts_delete_policy" ON "delivery_attempts"
FOR DELETE
USING (
  org_id = NULLIF(current_setting('app.current_org_id', true), '')::uuid
  AND get_org_role(org_id, NULLIF(current_setting('app.current_user_id', true), '')::uuid) = 'OWNER'
);

-- Helper function: claim_pending_outbox_messages
CREATE OR REPLACE FUNCTION claim_pending_outbox_messages(p_limit INT DEFAULT 50)
RETURNS TABLE (
  id UUID,
  event_id UUID,
  org_id UUID,
  channel VARCHAR(64),
  payload JSONB,
  status "outbox_status",
  attempt_count INT,
  created_at TIMESTAMPTZ(3)
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
    ORDER BY o.created_at ASC
    LIMIT p_limit
    FOR UPDATE SKIP LOCKED
  )
  UPDATE outbox_messages o
  SET attempt_count = o.attempt_count + 1
  FROM claimed c
  WHERE o.id = c.id
  RETURNING o.id, o.event_id, o.org_id, o.channel, o.payload::jsonb, o.status, o.attempt_count, o.created_at;
END;
$$;

-- Grant permissions to runtime roles
GRANT SELECT, INSERT, UPDATE, DELETE ON "delivery_attempts" TO relayforge_api, relayforge_worker;
GRANT EXECUTE ON FUNCTION claim_pending_outbox_messages(INT) TO relayforge_worker;
