-- Migration: 202611200001_outbound_signing_secret_helper
--
-- Provides a SECURITY DEFINER helper so the outbox worker can retrieve the
-- AES-256-GCM encrypted signing-secret fields for the first active ingestion
-- endpoint belonging to an organisation.  The worker decrypts the secret
-- in-process (using the application encryption key) and passes it to
-- DeliveryService for outbound webhook HMAC signing.
--
-- Why SECURITY DEFINER: the endpoints table has RLS policies that require an
-- authenticated user context (app.current_user_id).  The worker processes
-- messages without a user principal, so direct table access would return
-- nothing.  Using SECURITY DEFINER lets the function bypass RLS safely while
-- exposing only the minimum columns needed.

CREATE OR REPLACE FUNCTION get_org_endpoint_signing_secret(p_org_id UUID)
RETURNS TABLE (
  endpoint_id          UUID,
  secret_ciphertext    TEXT,
  secret_iv            VARCHAR(32),
  secret_tag           VARCHAR(32)
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT id, secret_ciphertext, secret_iv, secret_tag
  FROM endpoints
  WHERE org_id = p_org_id
    AND is_active = true
  ORDER BY created_at ASC
  LIMIT 1;
$$;

-- Grant execution rights to the worker role only; the API role does not need
-- this function (it uses get_endpoint_for_ingestion which also decrypts).
GRANT EXECUTE ON FUNCTION get_org_endpoint_signing_secret(UUID) TO relayforge_worker;
