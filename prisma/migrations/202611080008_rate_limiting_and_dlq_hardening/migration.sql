-- Migration: 202611080008_rate_limiting_and_dlq_hardening
-- Adds atomic rate-limit postpone procedure for outbox worker

CREATE OR REPLACE FUNCTION postpone_outbox_rate_limit(
  p_outbox_id UUID,
  p_lease_token UUID,
  p_postpone_seconds INT
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
  SET attempt_count = GREATEST(0, attempt_count - 1),
      next_retry_at = NOW() + (p_postpone_seconds || ' seconds')::INTERVAL,
      lease_expires_at = NULL,
      lease_token = NULL
  WHERE id = p_outbox_id
    AND lease_token = p_lease_token
    AND status = 'PENDING';

  GET DIAGNOSTICS v_rows_affected = ROW_COUNT;
  RETURN v_rows_affected > 0;
END;
$$;

GRANT EXECUTE ON FUNCTION postpone_outbox_rate_limit(UUID, UUID, INT) TO relayforge_worker, relayforge_api;
