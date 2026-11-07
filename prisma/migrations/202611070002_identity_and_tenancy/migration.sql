-- CreateEnum
CREATE TYPE "membership_role" AS ENUM ('OWNER', 'DEVELOPER', 'VIEWER');

-- CreateTable users
CREATE TABLE "users" (
    "id" UUID NOT NULL,
    "email" VARCHAR(255),
    "display_name" VARCHAR(255),
    "avatar_url" VARCHAR(1024),
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

-- CreateTable external_identities
CREATE TABLE "external_identities" (
    "id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "provider" VARCHAR(32) NOT NULL,
    "provider_user_id" VARCHAR(255) NOT NULL,
    "provider_username" VARCHAR(255),
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "external_identities_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "external_identities_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE UNIQUE INDEX "external_identities_provider_provider_user_id_key" ON "external_identities"("provider", "provider_user_id");
CREATE INDEX "external_identities_user_id_idx" ON "external_identities"("user_id");

-- CreateTable sessions
CREATE TABLE "sessions" (
    "id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "token_hash" VARCHAR(64) NOT NULL,
    "expires_at" TIMESTAMPTZ(3) NOT NULL,
    "revoked_at" TIMESTAMPTZ(3),
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "last_active_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "sessions_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "sessions_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE UNIQUE INDEX "sessions_token_hash_key" ON "sessions"("token_hash");
CREATE INDEX "sessions_user_id_idx" ON "sessions"("user_id");
CREATE INDEX "sessions_expires_at_idx" ON "sessions"("expires_at");

-- CreateTable oauth_states
CREATE TABLE "oauth_states" (
    "id" UUID NOT NULL,
    "state" VARCHAR(128) NOT NULL,
    "code_verifier" VARCHAR(128) NOT NULL,
    "redirect_uri" VARCHAR(512),
    "expires_at" TIMESTAMPTZ(3) NOT NULL,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "oauth_states_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "oauth_states_state_key" ON "oauth_states"("state");
CREATE INDEX "oauth_states_expires_at_idx" ON "oauth_states"("expires_at");

-- CreateTable organizations
CREATE TABLE "organizations" (
    "id" UUID NOT NULL,
    "name" VARCHAR(128) NOT NULL,
    "slug" VARCHAR(128) NOT NULL,
    "created_by" UUID,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "organizations_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "organizations_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE
);

CREATE UNIQUE INDEX "organizations_slug_key" ON "organizations"("slug");
CREATE INDEX "organizations_created_by_idx" ON "organizations"("created_by");

-- CreateTable memberships
CREATE TABLE "memberships" (
    "id" UUID NOT NULL,
    "org_id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "role" "membership_role" NOT NULL,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "memberships_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "memberships_org_id_fkey" FOREIGN KEY ("org_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "memberships_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE UNIQUE INDEX "memberships_org_id_user_id_key" ON "memberships"("org_id", "user_id");
CREATE INDEX "memberships_user_id_idx" ON "memberships"("user_id");
CREATE INDEX "memberships_org_id_role_idx" ON "memberships"("org_id", "role");

-- Security functions for RLS to prevent recursion and execute as schema owner
CREATE OR REPLACE FUNCTION is_org_member(p_org_id UUID, p_user_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
STABLE
AS $$
  SELECT EXISTS (
    SELECT 1 FROM memberships
    WHERE org_id = p_org_id AND user_id = p_user_id
  );
$$;

CREATE OR REPLACE FUNCTION get_org_role(p_org_id UUID, p_user_id UUID)
RETURNS membership_role
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
STABLE
AS $$
  SELECT role FROM memberships
  WHERE org_id = p_org_id AND user_id = p_user_id
  LIMIT 1;
$$;

-- Enable and FORCE Row-Level Security on tenant entities
ALTER TABLE "organizations" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "organizations" FORCE ROW LEVEL SECURITY;

ALTER TABLE "memberships" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "memberships" FORCE ROW LEVEL SECURITY;

-- RLS Policies: organizations
CREATE POLICY "organizations_select_policy" ON "organizations"
FOR SELECT
USING (
  NULLIF(current_setting('app.current_user_id', true), '') IS NOT NULL
  AND (
    is_org_member(id, NULLIF(current_setting('app.current_user_id', true), '')::uuid)
    OR created_by = NULLIF(current_setting('app.current_user_id', true), '')::uuid
  )
  AND (
    NULLIF(current_setting('app.current_org_id', true), '') IS NULL
    OR id = NULLIF(current_setting('app.current_org_id', true), '')::uuid
  )
);

CREATE POLICY "organizations_insert_policy" ON "organizations"
FOR INSERT
WITH CHECK (
  NULLIF(current_setting('app.current_user_id', true), '') IS NOT NULL
);

CREATE POLICY "organizations_update_policy" ON "organizations"
FOR UPDATE
USING (
  id = NULLIF(current_setting('app.current_org_id', true), '')::uuid
  AND get_org_role(id, NULLIF(current_setting('app.current_user_id', true), '')::uuid) = 'OWNER'
)
WITH CHECK (
  id = NULLIF(current_setting('app.current_org_id', true), '')::uuid
  AND get_org_role(id, NULLIF(current_setting('app.current_user_id', true), '')::uuid) = 'OWNER'
);

CREATE POLICY "organizations_delete_policy" ON "organizations"
FOR DELETE
USING (
  id = NULLIF(current_setting('app.current_org_id', true), '')::uuid
  AND get_org_role(id, NULLIF(current_setting('app.current_user_id', true), '')::uuid) = 'OWNER'
);

-- RLS Policies: memberships
CREATE POLICY "memberships_select_policy" ON "memberships"
FOR SELECT
USING (
  user_id = NULLIF(current_setting('app.current_user_id', true), '')::uuid
  OR (
    org_id = NULLIF(current_setting('app.current_org_id', true), '')::uuid
    AND is_org_member(org_id, NULLIF(current_setting('app.current_user_id', true), '')::uuid)
  )
);

CREATE POLICY "memberships_insert_policy" ON "memberships"
FOR INSERT
WITH CHECK (
  (
    user_id = NULLIF(current_setting('app.current_user_id', true), '')::uuid
    AND role = 'OWNER'
  )
  OR (
    org_id = NULLIF(current_setting('app.current_org_id', true), '')::uuid
    AND get_org_role(org_id, NULLIF(current_setting('app.current_user_id', true), '')::uuid) = 'OWNER'
  )
);

CREATE POLICY "memberships_update_policy" ON "memberships"
FOR UPDATE
USING (
  org_id = NULLIF(current_setting('app.current_org_id', true), '')::uuid
  AND get_org_role(org_id, NULLIF(current_setting('app.current_user_id', true), '')::uuid) = 'OWNER'
)
WITH CHECK (
  org_id = NULLIF(current_setting('app.current_org_id', true), '')::uuid
  AND get_org_role(org_id, NULLIF(current_setting('app.current_user_id', true), '')::uuid) = 'OWNER'
);

CREATE POLICY "memberships_delete_policy" ON "memberships"
FOR DELETE
USING (
  (
    org_id = NULLIF(current_setting('app.current_org_id', true), '')::uuid
    AND get_org_role(org_id, NULLIF(current_setting('app.current_user_id', true), '')::uuid) = 'OWNER'
  )
  OR (
    user_id = NULLIF(current_setting('app.current_user_id', true), '')::uuid
  )
);

-- Grant privileges to API runtime role (worker runtime role does not receive these)
GRANT SELECT, INSERT, UPDATE, DELETE ON "users", "external_identities", "sessions", "oauth_states", "organizations", "memberships" TO relayforge_api;
