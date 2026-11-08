-- Add UNKNOWN to delivery_status enum
ALTER TYPE "delivery_status" ADD VALUE IF NOT EXISTS 'UNKNOWN';

-- Add lease_token, replayed_by, replayed_at to outbox_messages table
ALTER TABLE "outbox_messages" ADD COLUMN IF NOT EXISTS "lease_token" UUID;
ALTER TABLE "outbox_messages" ADD COLUMN IF NOT EXISTS "replayed_by" UUID;
ALTER TABLE "outbox_messages" ADD COLUMN IF NOT EXISTS "replayed_at" TIMESTAMPTZ(3);

-- Update claim_pending_outbox_messages to generate and return unique lease_token
DROP FUNCTION IF EXISTS claim_pending_outbox_messages(INT, INT);
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
  max_retries INT,
  lease_token UUID
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
    RETURNING o.id, o.event_id, o.org_id, o.channel, o.payload, o.status, o.attempt_count, o.created_at, o.max_retries, o.lease_token
  )
  SELECT u.id, u.event_id, u.org_id, u.channel, u.payload::jsonb, u.status, u.attempt_count, u.created_at, COALESCE(e.event_type, 'webhook.event')::VARCHAR(128), u.max_retries, u.lease_token
  FROM updated u
  LEFT JOIN events e ON e.id = u.event_id;
END;
$$;

GRANT EXECUTE ON FUNCTION claim_pending_outbox_messages(INT, INT) TO relayforge_worker, relayforge_api;

-- Update complete_outbox_dispatch with explicit lease_token verification
DROP FUNCTION IF EXISTS complete_outbox_dispatch(UUID, UUID, VARCHAR, VARCHAR);
CREATE OR REPLACE FUNCTION complete_outbox_dispatch(
  p_outbox_id UUID,
  p_event_id UUID,
  p_status VARCHAR,
  p_event_status VARCHAR,
  p_lease_token UUID
)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_rows_affected INT;
BEGIN
  UPDATE outbox_messages
  SET status = p_status::outbox_status,
      dispatched_at = NOW(),
      lease_expires_at = NULL,
      lease_token = NULL
  WHERE id = p_outbox_id
    AND lease_token = p_lease_token
    AND status = 'PENDING';

  GET DIAGNOSTICS v_rows_affected = ROW_COUNT;

  IF v_rows_affected = 0 THEN
    RETURN FALSE;
  END IF;

  UPDATE events
  SET status = p_event_status::event_status
  WHERE id = p_event_id;

  RETURN TRUE;
END;
$$;

GRANT EXECUTE ON FUNCTION complete_outbox_dispatch(UUID, UUID, VARCHAR, VARCHAR, UUID) TO relayforge_worker, relayforge_api;

-- Update schedule_outbox_retry with explicit lease_token verification
DROP FUNCTION IF EXISTS schedule_outbox_retry(UUID, UUID, TIMESTAMPTZ, BOOLEAN);
CREATE OR REPLACE FUNCTION schedule_outbox_retry(
  p_outbox_id UUID,
  p_event_id UUID,
  p_next_retry_at TIMESTAMPTZ,
  p_is_dead_letter BOOLEAN,
  p_lease_token UUID
)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_rows_affected INT;
BEGIN
  IF p_is_dead_letter THEN
    UPDATE outbox_messages
    SET status = 'DEAD_LETTER'::outbox_status,
        lease_expires_at = NULL,
        lease_token = NULL,
        dispatched_at = NOW()
    WHERE id = p_outbox_id
      AND lease_token = p_lease_token
      AND status = 'PENDING';
  ELSE
    UPDATE outbox_messages
    SET status = 'PENDING'::outbox_status,
        next_retry_at = p_next_retry_at,
        lease_expires_at = NULL,
        lease_token = NULL
    WHERE id = p_outbox_id
      AND lease_token = p_lease_token
      AND status = 'PENDING';
  END IF;

  GET DIAGNOSTICS v_rows_affected = ROW_COUNT;

  IF v_rows_affected = 0 THEN
    RETURN FALSE;
  END IF;

  UPDATE events
  SET status = CASE WHEN p_is_dead_letter THEN 'FAILED'::event_status ELSE 'PROCESSING'::event_status END
  WHERE id = p_event_id;

  RETURN TRUE;
END;
$$;

GRANT EXECUTE ON FUNCTION schedule_outbox_retry(UUID, UUID, TIMESTAMPTZ, BOOLEAN, UUID) TO relayforge_worker, relayforge_api;

-- Update reclaim_stale_outbox_leases to also clear stale lease_token
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
  SET lease_expires_at = NULL,
      lease_token = NULL
  FROM stale s
  WHERE o.id = s.id;

  GET DIAGNOSTICS v_reclaimed_count = ROW_COUNT;
  RETURN v_reclaimed_count;
END;
$$;

GRANT EXECUTE ON FUNCTION reclaim_stale_outbox_leases() TO relayforge_worker, relayforge_api;

-- Update replay_outbox_message with strict replay rules and user attribution
DROP FUNCTION IF EXISTS replay_outbox_message(UUID);
CREATE OR REPLACE FUNCTION replay_outbox_message(
  p_outbox_id UUID,
  p_user_id UUID DEFAULT NULL
)
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
  v_current_status "outbox_status";
  v_lease_expires_at TIMESTAMPTZ;
  v_next_retry_at TIMESTAMPTZ;
BEGIN
  -- Strict row-level lock
  SELECT event_id, status, lease_expires_at, next_retry_at
  INTO v_event_id, v_current_status, v_lease_expires_at, v_next_retry_at
  FROM outbox_messages
  WHERE id = p_outbox_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Outbox message not found';
  END IF;

  -- Replay invariant: Only failed/DEAD_LETTER messages or scheduled retries may be replayed.
  -- Successful deliveries must not be retried.
  IF v_current_status = 'DISPATCHED' THEN
    RAISE EXCEPTION 'Cannot replay a successfully dispatched delivery';
  END IF;

  -- In-flight invariant: In-progress active worker leases cannot be concurrently replayed
  IF v_lease_expires_at IS NOT NULL AND v_lease_expires_at > NOW() THEN
    RAISE EXCEPTION 'Outbox message is currently in-flight by an active worker';
  END IF;

  -- If message is already pending immediate dispatch (next_retry_at <= NOW()), reject duplicate replay
  IF v_current_status = 'PENDING' AND (v_next_retry_at IS NULL OR v_next_retry_at <= NOW()) THEN
    RAISE EXCEPTION 'Outbox message is already pending delivery';
  END IF;

  -- Transition atomically to PENDING for immediate dispatch
  UPDATE outbox_messages
  SET status = 'PENDING'::outbox_status,
      next_retry_at = NOW(),
      lease_expires_at = NULL,
      lease_token = NULL,
      dispatched_at = NULL,
      attempt_count = 0,
      replayed_by = p_user_id,
      replayed_at = NOW()
  WHERE id = p_outbox_id
    AND (
      status = 'DEAD_LETTER'::outbox_status
      OR (status = 'PENDING'::outbox_status AND (lease_expires_at IS NULL OR lease_expires_at <= NOW()) AND (next_retry_at IS NOT NULL AND next_retry_at > NOW()))
    );

  UPDATE events
  SET status = 'RECEIVED'::event_status
  WHERE id = v_event_id;

  RETURN QUERY
  SELECT p_outbox_id, v_event_id, 'PENDING'::outbox_status;
END;
$$;

GRANT EXECUTE ON FUNCTION replay_outbox_message(UUID, UUID) TO relayforge_worker, relayforge_api;
