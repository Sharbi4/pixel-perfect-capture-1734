CREATE OR REPLACE FUNCTION public.begin_phone_job(p_salon uuid, p_kind text, p_key text)
 RETURNS TABLE(job_id uuid, acquired boolean, job_state text, lock_token uuid, target text, provider_ref text, error_code text)
 LANGUAGE plpgsql
 SET search_path TO 'public'
AS $function$
DECLARE j phone_jobs; s salons; jid uuid; tok uuid := gen_random_uuid();
BEGIN
  IF p_kind NOT IN ('create_agent','purchase_number') THEN RAISE EXCEPTION 'bad kind'; END IF;
  -- Serialize every begin for this salon so the checks below and the insert are atomic.
  SELECT * INTO s FROM salons WHERE id = p_salon FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'salon not found'; END IF;

  SELECT * INTO j FROM phone_jobs WHERE idempotency_key = p_key;
  IF FOUND AND (j.salon_id <> p_salon OR j.kind <> p_kind) THEN RAISE EXCEPTION 'idempotency key reused'; END IF;
  IF NOT FOUND THEN
    SELECT * INTO j FROM phone_jobs WHERE salon_id = p_salon AND kind = p_kind
      AND state IN ('pending','in_progress','uncertain') ORDER BY created_at LIMIT 1;
  END IF;
  IF j.id IS NULL THEN
    -- Already completed once: never grant a new paid create/purchase.
    SELECT * INTO j FROM phone_jobs WHERE salon_id = p_salon AND kind = p_kind AND state = 'succeeded'
      ORDER BY completed_at DESC NULLS LAST LIMIT 1;
    IF j.id IS NOT NULL THEN
      RETURN QUERY SELECT j.id, false, j.state, NULL::uuid, j.target, j.provider_ref, j.error_code; RETURN;
    END IF;
    IF p_kind = 'create_agent' AND s.agent_id <> '' THEN
      RETURN QUERY SELECT NULL::uuid, false, 'succeeded'::text, NULL::uuid, ''::text, s.agent_id, ''::text; RETURN;
    END IF;
    IF p_kind = 'purchase_number' AND (s.phone_number_sid <> '' OR s.phone_number <> '') THEN
      RETURN QUERY SELECT NULL::uuid, false, 'succeeded'::text, NULL::uuid, s.phone_number, s.phone_number_sid, ''::text; RETURN;
    END IF;
    INSERT INTO phone_jobs (salon_id, kind, idempotency_key) VALUES (p_salon, p_kind, p_key) RETURNING * INTO j;
  END IF;
  jid := j.id;
  IF j.state = 'in_progress' AND j.locked_at < now() - interval '3 minutes' THEN
    UPDATE phone_jobs SET state = 'uncertain', error_code = 'interrupted', lock_token = NULL, updated_at = now()
      WHERE id = jid AND state = 'in_progress' RETURNING * INTO j;
    IF j.id IS NOT NULL THEN PERFORM _apply_phone_job(j); END IF;
    SELECT * INTO j FROM phone_jobs WHERE id = jid;
  END IF;
  IF j.state = 'pending' THEN
    UPDATE phone_jobs SET state = 'in_progress', attempts = attempts + 1, lock_token = tok, locked_at = now(), updated_at = now()
      WHERE id = jid AND state = 'pending' RETURNING * INTO j;
    IF j.id IS NOT NULL THEN
      PERFORM _apply_phone_job(j);
      RETURN QUERY SELECT j.id, true, j.state, j.lock_token, j.target, j.provider_ref, j.error_code;
      RETURN;
    END IF;
    SELECT * INTO j FROM phone_jobs WHERE id = jid;
  END IF;
  RETURN QUERY SELECT j.id, false, j.state, NULL::uuid, j.target, j.provider_ref, j.error_code;
END $function$;

REVOKE ALL ON FUNCTION public.begin_phone_job(uuid, text, text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.begin_phone_job(uuid, text, text) TO service_role;
REVOKE ALL ON FUNCTION public.set_phone_job_target(uuid, uuid, text) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.transition_phone_job(uuid, uuid, text, text, text) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public._apply_phone_job(phone_jobs) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON public.phone_jobs FROM anon, authenticated;
REVOKE ALL ON public.phone_setups FROM anon;
REVOKE INSERT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER ON public.phone_setups FROM authenticated;
REVOKE DELETE, TRUNCATE, REFERENCES, TRIGGER ON public.salons FROM anon, authenticated;
REVOKE TRUNCATE, REFERENCES, TRIGGER ON public.services FROM anon, authenticated;
REVOKE ALL ON public.services FROM anon;