-- Fix concurrency and replay guards for outbox delivery

-- 1. Complete outbox dispatch with optimistic guard on PENDING status
CREATE OR REPLACE FUNCTION complete_outbox_dispatch(
  p_outbox_id UUID,
  p_event_id UUID,
  p_status VARCHAR,
  p_event_status VARCHAR
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE outbox_messages
  SET status = p_status::outbox_status,
      dispatched_at = NOW(),
      lease_expires_at = NULL
  WHERE id = p_outbox_id
    AND status = 'PENDING';

  UPDATE events
  SET status = p_event_status::event_status
  WHERE id = p_event_id;
END;
$$;

GRANT EXECUTE ON FUNCTION complete_outbox_dispatch(UUID, UUID, VARCHAR, VARCHAR) TO relayforge_worker, relayforge_api;

-- 2. Schedule outbox retry with guard on PENDING status
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
    WHERE id = p_outbox_id
      AND status = 'PENDING';

    UPDATE events
    SET status = 'FAILED'::event_status
    WHERE id = p_event_id;
  ELSE
    UPDATE outbox_messages
    SET status = 'PENDING'::outbox_status,
        next_retry_at = p_next_retry_at,
        lease_expires_at = NULL
    WHERE id = p_outbox_id
      AND status = 'PENDING';

    UPDATE events
    SET status = 'PROCESSING'::event_status
    WHERE id = p_event_id;
  END IF;
END;
$$;

GRANT EXECUTE ON FUNCTION schedule_outbox_retry(UUID, UUID, TIMESTAMPTZ, BOOLEAN) TO relayforge_worker, relayforge_api;

-- 3. Concurrent replay protection: row-level lock and guard against in-flight worker leases
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
  v_current_status "outbox_status";
  v_lease_expires_at TIMESTAMPTZ;
BEGIN
  -- Acquire row-level lock to prevent concurrent race conditions
  SELECT event_id, status, lease_expires_at
  INTO v_event_id, v_current_status, v_lease_expires_at
  FROM outbox_messages
  WHERE id = p_outbox_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Outbox message not found';
  END IF;

  -- Block replay if currently leased by an active worker in-flight
  IF v_lease_expires_at IS NOT NULL AND v_lease_expires_at > NOW() THEN
    RAISE EXCEPTION 'Outbox message is currently being processed by an active worker';
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
