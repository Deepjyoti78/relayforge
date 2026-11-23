-- Additive destination fanout state; existing attempts remain immutable evidence.
ALTER TABLE outbox_messages ADD COLUMN deliveries_initialized BOOLEAN NOT NULL DEFAULT false;
CREATE UNIQUE INDEX outbox_messages_id_org_id_key ON outbox_messages(id, org_id);
CREATE TABLE destination_deliveries (
  outbox_message_id UUID NOT NULL,
  destination_id UUID NOT NULL,
  org_id UUID NOT NULL,
  status outbox_status NOT NULL DEFAULT 'PENDING',
  attempt_count INT NOT NULL DEFAULT 0 CHECK (attempt_count >= 0),
  next_retry_at TIMESTAMPTZ(3),
  active_lease_token UUID,
  last_error TEXT,
  updated_at TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY(outbox_message_id, destination_id),
  FOREIGN KEY(outbox_message_id, org_id) REFERENCES outbox_messages(id, org_id) ON DELETE CASCADE ON UPDATE CASCADE,
  CHECK (status IN ('PENDING', 'DISPATCHED', 'DEAD_LETTER'))
);
CREATE INDEX destination_deliveries_org_id_idx ON destination_deliveries(org_id);
ALTER TABLE destination_deliveries ENABLE ROW LEVEL SECURITY;
ALTER TABLE destination_deliveries FORCE ROW LEVEL SECURITY;
CREATE POLICY destination_deliveries_read ON destination_deliveries FOR SELECT USING (
  org_id = NULLIF(current_setting('app.current_org_id', true), '')::uuid
  AND is_org_member(org_id, NULLIF(current_setting('app.current_user_id', true), '')::uuid)
);
GRANT SELECT ON destination_deliveries TO relayforge_api;

-- Claim just-in-time; a sweep may exclude already visited rows so a slow sweep
-- does not consume the same destination's next retry in its current pass.
DROP FUNCTION claim_pending_outbox_messages(INT, INT);
CREATE FUNCTION claim_pending_outbox_messages(p_limit INT DEFAULT 50, p_lease_seconds INT DEFAULT 30, p_excluded UUID[] DEFAULT '{}')
RETURNS TABLE(id UUID, event_id UUID, org_id UUID, channel VARCHAR(64), payload JSONB,
  status outbox_status, attempt_count INT, created_at TIMESTAMPTZ(3), event_type VARCHAR(128),
  max_retries INT, lease_token UUID, workflow_execution_id UUID)
LANGUAGE plpgsql SECURITY DEFINER SET search_path = pg_catalog, public AS $$
BEGIN
 RETURN QUERY WITH claimed AS (
   SELECT o.id FROM outbox_messages o WHERE o.status='PENDING'
     AND (o.next_retry_at IS NULL OR o.next_retry_at <= clock_timestamp())
     AND (o.lease_expires_at IS NULL OR o.lease_expires_at <= clock_timestamp())
     AND NOT (o.id = ANY(p_excluded))
   ORDER BY COALESCE(o.next_retry_at, o.created_at), o.id
   LIMIT LEAST(50, GREATEST(1, p_limit)) FOR UPDATE SKIP LOCKED
 ), updated AS (
   UPDATE outbox_messages o SET attempt_count=o.attempt_count+1,
     lease_expires_at=clock_timestamp()+make_interval(secs=>LEAST(300,GREATEST(1,p_lease_seconds))), lease_token=gen_random_uuid()
   FROM claimed c WHERE o.id=c.id RETURNING o.*
 ) SELECT u.id,u.event_id,u.org_id,u.channel,u.payload::jsonb,u.status,u.attempt_count,u.created_at,
   COALESCE(e.event_type,'webhook.event')::varchar(128),u.max_retries,u.lease_token,u.workflow_execution_id
 FROM updated u JOIN events e ON e.id=u.event_id AND e.org_id=u.org_id;
END $$;
REVOKE ALL ON FUNCTION claim_pending_outbox_messages(INT,INT,UUID[]) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION claim_pending_outbox_messages(INT,INT,UUID[]) TO relayforge_worker, relayforge_api;

CREATE FUNCTION renew_outbox_lease(p_id UUID,p_token UUID,p_seconds INT DEFAULT 30) RETURNS BOOLEAN
LANGUAGE sql SECURITY DEFINER SET search_path = pg_catalog, public AS $$
 WITH renewed AS (UPDATE outbox_messages SET lease_expires_at=clock_timestamp()+make_interval(secs=>LEAST(300,GREATEST(1,p_seconds)))
 WHERE id=p_id AND status='PENDING' AND lease_token=p_token AND lease_expires_at>clock_timestamp() RETURNING id)
 SELECT EXISTS(SELECT 1 FROM renewed)
$$;
REVOKE ALL ON FUNCTION renew_outbox_lease(UUID,UUID,INT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION renew_outbox_lease(UUID,UUID,INT) TO relayforge_worker;

CREATE FUNCTION get_event_endpoint_signing_secret(p_org UUID,p_event UUID)
RETURNS TABLE(endpoint_id UUID,secret_ciphertext TEXT,secret_iv VARCHAR(32),secret_tag VARCHAR(32))
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = pg_catalog, public AS $$
 SELECT ep.id,ep.secret_ciphertext,ep.secret_iv,ep.secret_tag FROM events e
 JOIN endpoints ep ON ep.id=e.endpoint_id AND ep.org_id=e.org_id
 WHERE e.id=p_event AND e.org_id=p_org
   AND (session_user='relayforge_worker' OR p_org=NULLIF(current_setting('app.current_org_id',true),'')::uuid)
$$;
REVOKE ALL ON FUNCTION get_event_endpoint_signing_secret(UUID,UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION get_event_endpoint_signing_secret(UUID,UUID) TO relayforge_worker,relayforge_api;

CREATE FUNCTION prepare_destination_deliveries(p_id UUID,p_token UUID)
RETURNS TABLE(id UUID,org_id UUID,name VARCHAR(128),url VARCHAR(2048),http_method VARCHAR(16),headers JSONB,
  rate_limit_per_second INT,timeout_ms INT,is_active BOOLEAN,attempt_count INT)
LANGUAGE plpgsql SECURITY DEFINER SET search_path = pg_catalog, public AS $$
DECLARE o outbox_messages%ROWTYPE;
BEGIN
 SELECT * INTO o FROM outbox_messages WHERE outbox_messages.id=p_id FOR UPDATE;
 IF NOT FOUND OR o.status<>'PENDING' OR o.lease_token IS DISTINCT FROM p_token
   OR o.lease_expires_at<=clock_timestamp() OR o.lease_expires_at IS NULL OR o.channel='workflow' THEN RETURN; END IF;
 IF NOT o.deliveries_initialized THEN
   INSERT INTO destination_deliveries(outbox_message_id,destination_id,org_id,status,attempt_count)
   SELECT o.id,d.id,o.org_id,
     CASE WHEN COALESCE(bool_or(a.status='SUCCESS'),false) THEN 'DISPATCHED'::outbox_status ELSE 'PENDING'::outbox_status END,
     (count(a.id) FILTER (WHERE o.replayed_at IS NULL OR a.created_at>=o.replayed_at))::int
   FROM destinations d LEFT JOIN delivery_attempts a ON a.outbox_message_id=o.id AND a.destination_id=d.id AND a.org_id=o.org_id
   WHERE d.org_id=o.org_id AND d.is_active GROUP BY d.id;
   UPDATE outbox_messages SET deliveries_initialized=true WHERE outbox_messages.id=o.id;
 END IF;
 -- Recover a crash after the HTTP acknowledgement/attempt commit but before
 -- the coordinator recorded success. Never resend a known successful pair.
 UPDATE destination_deliveries s SET status='DISPATCHED',active_lease_token=NULL,next_retry_at=NULL,updated_at=clock_timestamp()
 WHERE s.outbox_message_id=o.id AND s.status<>'DISPATCHED' AND EXISTS (
   SELECT 1 FROM delivery_attempts a WHERE a.outbox_message_id=o.id AND a.destination_id=s.destination_id
     AND a.org_id=o.org_id AND a.status='SUCCESS'
 );
 RETURN QUERY SELECT s.destination_id,o.org_id,d.name,d.url,d.http_method,d.headers::jsonb,
   d.rate_limit_per_second,d.timeout_ms,COALESCE(d.is_active,false),s.attempt_count
 FROM destination_deliveries s LEFT JOIN destinations d ON d.id=s.destination_id AND d.org_id=s.org_id
 WHERE s.outbox_message_id=o.id AND s.org_id=o.org_id AND s.status='PENDING'
   AND (s.next_retry_at IS NULL OR s.next_retry_at<=clock_timestamp()) ORDER BY s.destination_id;
END $$;
REVOKE ALL ON FUNCTION prepare_destination_deliveries(UUID,UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION prepare_destination_deliveries(UUID,UUID) TO relayforge_worker;

CREATE FUNCTION begin_destination_delivery(p_id UUID,p_dest UUID,p_token UUID) RETURNS INT
LANGUAGE plpgsql SECURITY DEFINER SET search_path = pg_catalog, public AS $$
DECLARE o outbox_messages%ROWTYPE; n INT;
BEGIN
 SELECT * INTO o FROM outbox_messages WHERE id=p_id FOR UPDATE;
 IF NOT FOUND OR o.status<>'PENDING' OR o.lease_token IS DISTINCT FROM p_token
   OR o.lease_expires_at IS NULL OR o.lease_expires_at<=clock_timestamp() THEN RETURN 0; END IF;
 UPDATE destination_deliveries SET status='DEAD_LETTER',last_error='Attempt limit reached after interrupted delivery',updated_at=clock_timestamp()
 WHERE outbox_message_id=p_id AND status='PENDING' AND destination_id=p_dest AND attempt_count>=o.max_retries;
 UPDATE destination_deliveries SET attempt_count=attempt_count+1,active_lease_token=p_token,updated_at=clock_timestamp()
 WHERE outbox_message_id=p_id AND destination_id=p_dest AND status='PENDING'
   AND active_lease_token IS DISTINCT FROM p_token AND (next_retry_at IS NULL OR next_retry_at<=clock_timestamp())
 RETURNING attempt_count INTO n;
 RETURN COALESCE(n,0);
END $$;
REVOKE ALL ON FUNCTION begin_destination_delivery(UUID,UUID,UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION begin_destination_delivery(UUID,UUID,UUID) TO relayforge_worker;

CREATE FUNCTION record_destination_result(p_id UUID,p_dest UUID,p_token UUID,p_status outbox_status,p_next TIMESTAMPTZ,p_error TEXT,p_refund BOOLEAN DEFAULT false) RETURNS BOOLEAN
LANGUAGE plpgsql SECURITY DEFINER SET search_path = pg_catalog, public AS $$
DECLARE o outbox_messages%ROWTYPE; n INT;
BEGIN
 IF p_status NOT IN ('PENDING','DISPATCHED','DEAD_LETTER') OR (p_refund AND p_status<>'PENDING') THEN RAISE EXCEPTION 'Invalid delivery transition'; END IF;
 SELECT * INTO o FROM outbox_messages WHERE id=p_id FOR UPDATE;
 IF NOT FOUND OR o.status<>'PENDING' OR o.lease_token IS DISTINCT FROM p_token
   OR o.lease_expires_at IS NULL OR o.lease_expires_at<=clock_timestamp() THEN RETURN false; END IF;
 UPDATE destination_deliveries SET status=p_status,next_retry_at=p_next,active_lease_token=NULL,
   attempt_count=attempt_count-CASE WHEN p_refund THEN 1 ELSE 0 END,last_error=left(p_error,2048),updated_at=clock_timestamp()
 WHERE outbox_message_id=p_id AND destination_id=p_dest AND org_id=o.org_id AND status='PENDING' AND active_lease_token=p_token;
 GET DIAGNOSTICS n=ROW_COUNT;
 RETURN n=1;
END $$;
REVOKE ALL ON FUNCTION record_destination_result(UUID,UUID,UUID,outbox_status,TIMESTAMPTZ,TEXT,BOOLEAN) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION record_destination_result(UUID,UUID,UUID,outbox_status,TIMESTAMPTZ,TEXT,BOOLEAN) TO relayforge_worker;

CREATE FUNCTION finish_destination_batch(p_id UUID,p_token UUID) RETURNS outbox_status
LANGUAGE plpgsql SECURITY DEFINER SET search_path = pg_catalog, public AS $$
DECLARE o outbox_messages%ROWTYPE; pending BOOLEAN; dead BOOLEAN; next_at TIMESTAMPTZ; result outbox_status;
BEGIN
 SELECT * INTO o FROM outbox_messages WHERE id=p_id FOR UPDATE;
 IF NOT FOUND OR o.status<>'PENDING' OR o.lease_token IS DISTINCT FROM p_token OR NOT o.deliveries_initialized
   OR o.lease_expires_at IS NULL OR o.lease_expires_at<=clock_timestamp() THEN RETURN NULL; END IF;
 SELECT COALESCE(bool_or(status='PENDING'),false),COALESCE(bool_or(status='DEAD_LETTER'),false),
   min(COALESCE(next_retry_at,clock_timestamp())) FILTER (WHERE status='PENDING')
 INTO pending,dead,next_at FROM destination_deliveries WHERE outbox_message_id=p_id;
 result:=CASE WHEN pending THEN 'PENDING'::outbox_status WHEN dead THEN 'DEAD_LETTER'::outbox_status ELSE 'DISPATCHED'::outbox_status END;
 UPDATE outbox_messages SET status=result,next_retry_at=next_at,lease_token=NULL,lease_expires_at=NULL,
   dispatched_at=CASE WHEN pending THEN NULL ELSE clock_timestamp() END WHERE id=p_id;
 UPDATE events SET status=CASE WHEN pending THEN 'PROCESSING'::event_status WHEN dead THEN 'FAILED'::event_status ELSE 'COMPLETED'::event_status END
 WHERE id=o.event_id AND org_id=o.org_id;
 RETURN result;
END $$;
REVOKE ALL ON FUNCTION finish_destination_batch(UUID,UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION finish_destination_batch(UUID,UUID) TO relayforge_worker;

-- Retain existing replay locking/authorization/attribution and successful-delivery
-- rejection. Reset only unfinished destinations, in the same transaction.
ALTER FUNCTION replay_outbox_message(UUID,UUID) RENAME TO replay_outbox_message_before_fanout;
REVOKE ALL ON FUNCTION replay_outbox_message_before_fanout(UUID,UUID) FROM PUBLIC,relayforge_worker,relayforge_api;
CREATE FUNCTION replay_outbox_message(p_outbox_id UUID,p_user_id UUID DEFAULT NULL)
RETURNS TABLE(replayed_outbox_id UUID,replayed_event_id UUID,new_status outbox_status)
LANGUAGE plpgsql SECURITY DEFINER SET search_path = pg_catalog, public AS $$
BEGIN
 -- The bulk API historically accepts FAILED as well as DEAD_LETTER. Normalize
 -- that legacy terminal spelling while retaining the locked replay checks.
 UPDATE outbox_messages SET status='DEAD_LETTER' WHERE id=p_outbox_id AND status='FAILED'
   AND (lease_expires_at IS NULL OR lease_expires_at<=clock_timestamp());
 RETURN QUERY SELECT * FROM replay_outbox_message_before_fanout(p_outbox_id,p_user_id);
 UPDATE destination_deliveries SET status='PENDING',attempt_count=0,next_retry_at=clock_timestamp(),active_lease_token=NULL,last_error=NULL,updated_at=clock_timestamp()
 WHERE outbox_message_id=p_outbox_id AND status<>'DISPATCHED';
END $$;
REVOKE ALL ON FUNCTION replay_outbox_message(UUID,UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION replay_outbox_message(UUID,UUID) TO relayforge_api,relayforge_worker;
