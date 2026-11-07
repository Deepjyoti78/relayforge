-- CreateTable
CREATE TABLE "api_keys" (
    "id" UUID NOT NULL,
    "org_id" UUID NOT NULL,
    "name" VARCHAR(128) NOT NULL,
    "key_prefix" VARCHAR(16) NOT NULL,
    "key_hash" VARCHAR(64) NOT NULL,
    "scopes" TEXT[] DEFAULT ARRAY['ingest'::TEXT],
    "created_by" UUID,
    "last_used_at" TIMESTAMPTZ(3),
    "expires_at" TIMESTAMPTZ(3),
    "revoked_at" TIMESTAMPTZ(3),
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "api_keys_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "api_keys_key_hash_key" ON "api_keys"("key_hash");

-- CreateIndex
CREATE INDEX "api_keys_org_id_idx" ON "api_keys"("org_id");

-- CreateIndex
CREATE INDEX "api_keys_org_id_revoked_at_idx" ON "api_keys"("org_id", "revoked_at");

-- AddForeignKey
ALTER TABLE "api_keys" ADD CONSTRAINT "api_keys_org_id_fkey" FOREIGN KEY ("org_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "api_keys" ADD CONSTRAINT "api_keys_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- Enable and FORCE Row-Level Security on api_keys
ALTER TABLE "api_keys" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "api_keys" FORCE ROW LEVEL SECURITY;

-- RLS Policies: api_keys
-- SELECT: Users can only see API keys for organizations they belong to within tenant context
CREATE POLICY "api_keys_select_policy" ON "api_keys"
FOR SELECT
USING (
  org_id = NULLIF(current_setting('app.current_org_id', true), '')::uuid
  AND is_org_member(org_id, NULLIF(current_setting('app.current_user_id', true), '')::uuid)
);

-- INSERT: Only OWNER or DEVELOPER can create API keys
CREATE POLICY "api_keys_insert_policy" ON "api_keys"
FOR INSERT
WITH CHECK (
  org_id = NULLIF(current_setting('app.current_org_id', true), '')::uuid
  AND get_org_role(org_id, NULLIF(current_setting('app.current_user_id', true), '')::uuid) IN ('OWNER', 'DEVELOPER')
);

-- UPDATE: Only OWNER or DEVELOPER can update/revoke API keys
CREATE POLICY "api_keys_update_policy" ON "api_keys"
FOR UPDATE
USING (
  org_id = NULLIF(current_setting('app.current_org_id', true), '')::uuid
  AND get_org_role(org_id, NULLIF(current_setting('app.current_user_id', true), '')::uuid) IN ('OWNER', 'DEVELOPER')
)
WITH CHECK (
  org_id = NULLIF(current_setting('app.current_org_id', true), '')::uuid
  AND get_org_role(org_id, NULLIF(current_setting('app.current_user_id', true), '')::uuid) IN ('OWNER', 'DEVELOPER')
);

-- DELETE: Only OWNER can permanently delete API keys
CREATE POLICY "api_keys_delete_policy" ON "api_keys"
FOR DELETE
USING (
  org_id = NULLIF(current_setting('app.current_org_id', true), '')::uuid
  AND get_org_role(org_id, NULLIF(current_setting('app.current_user_id', true), '')::uuid) = 'OWNER'
);

-- SECURITY DEFINER helper function for authenticating incoming API keys by hash without tenant context pre-set
CREATE OR REPLACE FUNCTION verify_api_key(p_key_hash TEXT)
RETURNS TABLE (
  id UUID,
  org_id UUID,
  name VARCHAR(128),
  key_prefix VARCHAR(16),
  scopes TEXT[],
  created_by UUID,
  expires_at TIMESTAMPTZ(3),
  revoked_at TIMESTAMPTZ(3)
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT id, org_id, name, key_prefix, scopes, created_by, expires_at, revoked_at
  FROM api_keys
  WHERE key_hash = p_key_hash
    AND revoked_at IS NULL
    AND (expires_at IS NULL OR expires_at > clock_timestamp())
  LIMIT 1;
$$;

-- Grant privileges to API runtime role
GRANT SELECT, INSERT, UPDATE, DELETE ON "api_keys" TO relayforge_api;
GRANT EXECUTE ON FUNCTION verify_api_key(TEXT) TO relayforge_api;
