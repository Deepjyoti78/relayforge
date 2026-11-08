-- Update destinations_select_policy to allow worker access without user context
DROP POLICY IF EXISTS "destinations_select_policy" ON "destinations";
CREATE POLICY "destinations_select_policy" ON "destinations"
FOR SELECT
USING (
  org_id = NULLIF(current_setting('app.current_org_id', true), '')::uuid
  AND (
    current_setting('app.current_user_id', true) IS NULL
    OR current_setting('app.current_user_id', true) = ''
    OR is_org_member(org_id, NULLIF(current_setting('app.current_user_id', true), '')::uuid)
  )
);

-- Helper function: get_active_destinations_for_org
CREATE OR REPLACE FUNCTION get_active_destinations_for_org(p_org_id UUID)
RETURNS TABLE (
  id UUID,
  org_id UUID,
  name VARCHAR(128),
  url VARCHAR(2048),
  http_method VARCHAR(16),
  headers JSONB,
  rate_limit_per_second INT,
  timeout_ms INT,
  is_active BOOLEAN
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT id, org_id, name, url, http_method, headers, rate_limit_per_second, timeout_ms, is_active
  FROM destinations
  WHERE org_id = p_org_id
    AND is_active = true;
$$;

GRANT EXECUTE ON FUNCTION get_active_destinations_for_org(UUID) TO relayforge_worker;

-- Re-define claim_pending_outbox_messages to include event_type via JOIN
DROP FUNCTION IF EXISTS claim_pending_outbox_messages(INT);
CREATE OR REPLACE FUNCTION claim_pending_outbox_messages(p_limit INT DEFAULT 50)
RETURNS TABLE (
  id UUID,
  event_id UUID,
  org_id UUID,
  channel VARCHAR(64),
  payload JSONB,
  status "outbox_status",
  attempt_count INT,
  created_at TIMESTAMPTZ(3),
  event_type VARCHAR(128)
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
  ),
  updated AS (
    UPDATE outbox_messages o
    SET attempt_count = o.attempt_count + 1
    FROM claimed c
    WHERE o.id = c.id
    RETURNING o.id, o.event_id, o.org_id, o.channel, o.payload, o.status, o.attempt_count, o.created_at
  )
  SELECT u.id, u.event_id, u.org_id, u.channel, u.payload::jsonb, u.status, u.attempt_count, u.created_at, COALESCE(e.event_type, 'webhook.event')::VARCHAR(128)
  FROM updated u
  LEFT JOIN events e ON e.id = u.event_id;
END;
$$;

GRANT EXECUTE ON FUNCTION claim_pending_outbox_messages(INT) TO relayforge_worker, relayforge_api;

-- Helper function: complete_outbox_dispatch
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
      dispatched_at = NOW()
  WHERE id = p_outbox_id;

  UPDATE events
  SET status = p_event_status::event_status
  WHERE id = p_event_id;
END;
$$;

GRANT EXECUTE ON FUNCTION complete_outbox_dispatch(UUID, UUID, VARCHAR, VARCHAR) TO relayforge_worker, relayforge_api;

-- Helper function: reset_outbox_pending
CREATE OR REPLACE FUNCTION reset_outbox_pending(p_outbox_id UUID)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE outbox_messages
  SET status = 'PENDING'::outbox_status
  WHERE id = p_outbox_id;
END;
$$;

GRANT EXECUTE ON FUNCTION reset_outbox_pending(UUID) TO relayforge_worker, relayforge_api;
