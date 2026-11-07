CREATE TABLE "worker_heartbeats" (
    "instance_id" UUID NOT NULL,
    "started_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "last_seen_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "version" VARCHAR(64) NOT NULL,
    CONSTRAINT "worker_heartbeats_pkey" PRIMARY KEY ("instance_id")
);

CREATE INDEX "worker_heartbeats_last_seen_at_idx" ON "worker_heartbeats"("last_seen_at");

-- Runtime identities do not own tables. Grants are reviewed with each migration.
GRANT SELECT ON "worker_heartbeats" TO relayforge_api;
GRANT SELECT, INSERT, UPDATE, DELETE ON "worker_heartbeats" TO relayforge_worker;
