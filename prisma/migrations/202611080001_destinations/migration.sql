-- CreateTable: destinations
CREATE TABLE "destinations" (
    "id" UUID NOT NULL,
    "org_id" UUID NOT NULL,
    "name" VARCHAR(128) NOT NULL,
    "url" VARCHAR(2048) NOT NULL,
    "http_method" VARCHAR(16) NOT NULL DEFAULT 'POST',
    "headers" JSONB,
    "rate_limit_per_second" INTEGER NOT NULL DEFAULT 50,
    "timeout_ms" INTEGER NOT NULL DEFAULT 10000,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "destinations_pkey" PRIMARY KEY ("id")
);

-- CreateIndexes
CREATE INDEX "destinations_org_id_idx" ON "destinations"("org_id");
CREATE INDEX "destinations_org_id_is_active_idx" ON "destinations"("org_id", "is_active");

-- AddForeignKey
ALTER TABLE "destinations" ADD CONSTRAINT "destinations_org_id_fkey" FOREIGN KEY ("org_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Enable and FORCE Row-Level Security
ALTER TABLE "destinations" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "destinations" FORCE ROW LEVEL SECURITY;

-- RLS Policies: destinations
CREATE POLICY "destinations_select_policy" ON "destinations"
FOR SELECT
USING (
  org_id = NULLIF(current_setting('app.current_org_id', true), '')::uuid
  AND is_org_member(org_id, NULLIF(current_setting('app.current_user_id', true), '')::uuid)
);

CREATE POLICY "destinations_insert_policy" ON "destinations"
FOR INSERT
WITH CHECK (
  org_id = NULLIF(current_setting('app.current_org_id', true), '')::uuid
  AND get_org_role(org_id, NULLIF(current_setting('app.current_user_id', true), '')::uuid) IN ('OWNER', 'DEVELOPER')
);

CREATE POLICY "destinations_update_policy" ON "destinations"
FOR UPDATE
USING (
  org_id = NULLIF(current_setting('app.current_org_id', true), '')::uuid
  AND get_org_role(org_id, NULLIF(current_setting('app.current_user_id', true), '')::uuid) IN ('OWNER', 'DEVELOPER')
)
WITH CHECK (
  org_id = NULLIF(current_setting('app.current_org_id', true), '')::uuid
  AND get_org_role(org_id, NULLIF(current_setting('app.current_user_id', true), '')::uuid) IN ('OWNER', 'DEVELOPER')
);

CREATE POLICY "destinations_delete_policy" ON "destinations"
FOR DELETE
USING (
  org_id = NULLIF(current_setting('app.current_org_id', true), '')::uuid
  AND get_org_role(org_id, NULLIF(current_setting('app.current_user_id', true), '')::uuid) IN ('OWNER', 'DEVELOPER')
);

-- Grant permissions to runtime roles
GRANT SELECT, INSERT, UPDATE, DELETE ON "destinations" TO relayforge_api, relayforge_worker;
