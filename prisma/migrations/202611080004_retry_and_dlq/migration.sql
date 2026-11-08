-- Add DEAD_LETTER to outbox_status enum
ALTER TYPE "outbox_status" ADD VALUE IF NOT EXISTS 'DEAD_LETTER';

-- Alter outbox_messages table
ALTER TABLE "outbox_messages" ADD COLUMN IF NOT EXISTS "max_retries" INT NOT NULL DEFAULT 5;
ALTER TABLE "outbox_messages" ADD COLUMN IF NOT EXISTS "next_retry_at" TIMESTAMPTZ(3);
ALTER TABLE "outbox_messages" ADD COLUMN IF NOT EXISTS "lease_expires_at" TIMESTAMPTZ(3);

-- Create indexes for efficient scheduling and crash recovery
CREATE INDEX IF NOT EXISTS "outbox_messages_status_next_retry_at_idx" ON "outbox_messages"("status", "next_retry_at");
CREATE INDEX IF NOT EXISTS "outbox_messages_lease_expires_at_idx" ON "outbox_messages"("lease_expires_at");

-- Update claim_pending_outbox_messages with lease tracking and retry scheduling
DROP FUNCTION IF EXISTS claim_pending_outbox_messages(INT);
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
  max_retries INT
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
        lease_expires_at = NOW() + (p_lease_seconds || ' seconds')::INTERVAL
    FROM claimed c
    WHERE o.id = c.id
    RETURNING o.id, o.event_id, o.org_id, o.channel, o.payload, o.status, o.attempt_count, o.created_at, o.max_retries
  )
  SELECT u.id, u.event_id, u.org_id, u.channel, u.payload::jsonb, u.status, u.attempt_count, u.created_at, COALESCE(e.event_type, 'webhook.event')::VARCHAR(128), u.max_retries
  FROM updated u
  LEFT JOIN events e ON e.id = u.event_id;
END;
$$;

GRANT EXECUTE ON FUNCTION claim_pending_outbox_messages(INT, INT) TO relayforge_worker, relayforge_api;

-- Helper function: schedule_outbox_retry
CREATE OR REPLACE FUNCTION schedule_outbox_retry(
  p_outbox_id UUID,
  p_event_id UUID,
  p_next_retry_at TIMESTAMPTZ,
  p_is_dead_letter BOOLEAN
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF p_is_dead_letter THEN
    UPDATE outbox_messages
    SET status = 'DEAD_LETTER'::outbox_status,
        lease_expires_at = NULL,
        dispatched_at = NOW()
    WHERE id = p_outbox_id;

    UPDATE events
    SET status = 'FAILED'::event_status
    WHERE id = p_event_id;
  ELSE
    UPDATE outbox_messages
    SET status = 'PENDING'::outbox_status,
        next_retry_at = p_next_retry_at,
        lease_expires_at = NULL
    WHERE id = p_outbox_id;

    UPDATE events
    SET status = 'PROCESSING'::event_status
    WHERE id = p_event_id;
  END IF;
END;
$$;

GRANT EXECUTE ON FUNCTION schedule_outbox_retry(UUID, UUID, TIMESTAMPTZ, BOOLEAN) TO relayforge_worker, relayforge_api;

-- Helper function: reclaim_stale_outbox_leases (Crash Recovery)
CREATE OR REPLACE FUNCTION reclaim_stale_outbox_leases()
RETURNS INT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_reclaimed_count INT;
BEGIN
  WITH stale AS (
    SELECT id
    FROM outbox_messages
    WHERE status = 'PENDING'
      AND lease_expires_at IS NOT NULL
      AND lease_expires_at < NOW()
    FOR UPDATE SKIP LOCKED
  )
  UPDATE outbox_messages o
  SET lease_expires_at = NULL
  FROM stale s
  WHERE o.id = s.id;

  GET DIAGNOSTICS v_reclaimed_count = ROW_COUNT;
  RETURN v_reclaimed_count;
END;
$$;

GRANT EXECUTE ON FUNCTION reclaim_stale_outbox_leases() TO relayforge_worker, relayforge_api;

-- Helper function: replay_outbox_message (Manual Replay & DLQ recovery)
CREATE OR REPLACE FUNCTION replay_outbox_message(p_outbox_id UUID)
RETURNS TABLE (
  replayed_outbox_id UUID,
  replayed_event_id UUID,
  new_status "outbox_status"
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_event_id UUID;
BEGIN
  SELECT event_id INTO v_event_id
  FROM outbox_messages
  WHERE id = p_outbox_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Outbox message not found';
  END IF;

  UPDATE outbox_messages
  SET status = 'PENDING'::outbox_status,
      next_retry_at = NOW(),
      lease_expires_at = NULL,
      dispatched_at = NULL,
      attempt_count = 0
  WHERE id = p_outbox_id;

  UPDATE events
  SET status = 'RECEIVED'::event_status
  WHERE id = v_event_id;

  RETURN QUERY
  SELECT p_outbox_id, v_event_id, 'PENDING'::outbox_status;
END;
$$;

GRANT EXECUTE ON FUNCTION replay_outbox_message(UUID) TO relayforge_worker, relayforge_api;
