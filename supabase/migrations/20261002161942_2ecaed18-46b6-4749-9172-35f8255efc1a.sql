-- 1) Salons: owners may only write their editable profile fields.
REVOKE INSERT, UPDATE ON public.salons FROM authenticated;
REVOKE ALL ON public.salons FROM anon;
GRANT INSERT (owner_id, name, address, phone, website, hours, languages, contact_name, voice,
  deposit_policy, cancellation_policy, walk_ins, booking_app, setup_method)
  ON public.salons TO authenticated;
GRANT UPDATE (name, address, phone, website, hours, languages, contact_name, voice,
  deposit_policy, cancellation_policy, walk_ins, booking_app, setup_method, updated_at)
  ON public.salons TO authenticated;
GRANT ALL ON public.salons TO service_role;

DROP POLICY IF EXISTS "own salon update" ON public.salons;
CREATE POLICY "own salon update" ON public.salons FOR UPDATE TO authenticated
  USING (auth.uid() = owner_id) WITH CHECK (auth.uid() = owner_id);

-- 2) Owner-readable, sanitized phone setup status (backend writes only).
CREATE TABLE public.phone_setups (
  salon_id uuid PRIMARY KEY REFERENCES public.salons(id) ON DELETE CASCADE,
  business_number text NOT NULL DEFAULT '',
  portability_status text NOT NULL DEFAULT 'unknown'
    CHECK (portability_status IN ('unknown','checking','portable','not_portable')),
  agent_status text NOT NULL DEFAULT 'none'
    CHECK (agent_status IN ('none','in_progress','ready','needs_review','failed')),
  agent_error text NOT NULL DEFAULT '',
  temp_number_status text NOT NULL DEFAULT 'none'
    CHECK (temp_number_status IN ('none','in_progress','active','needs_review','failed')),
  temp_number_error text NOT NULL DEFAULT '',
  voice_status text NOT NULL DEFAULT 'not_verified' CHECK (voice_status IN ('not_verified','verified')),
  forwarding_status text NOT NULL DEFAULT 'not_started' CHECK (forwarding_status IN ('not_started','verified')),
  texting_status text NOT NULL DEFAULT 'not_started'
    CHECK (texting_status IN ('not_started','submitted','approved','rejected')),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.phone_setups TO authenticated;
GRANT ALL ON public.phone_setups TO service_role;
ALTER TABLE public.phone_setups ENABLE ROW LEVEL SECURITY;
CREATE POLICY "owner reads own phone setup" ON public.phone_setups FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.salons s WHERE s.id = phone_setups.salon_id AND s.owner_id = auth.uid()));

-- 3) Backend-only provisioning jobs (no client access at all).
CREATE TABLE public.phone_jobs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  salon_id uuid NOT NULL REFERENCES public.salons(id) ON DELETE CASCADE,
  kind text NOT NULL CHECK (kind IN ('purchase_number','create_agent')),
  idempotency_key text NOT NULL UNIQUE,
  state text NOT NULL DEFAULT 'pending'
    CHECK (state IN ('pending','in_progress','succeeded','failed','uncertain')),
  attempts integer NOT NULL DEFAULT 0,
  lock_token uuid,
  locked_at timestamptz,
  target text NOT NULL DEFAULT '',
  provider_ref text NOT NULL DEFAULT '',
  error_code text NOT NULL DEFAULT '',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  completed_at timestamptz
);
CREATE UNIQUE INDEX phone_jobs_one_active_per_kind ON public.phone_jobs (salon_id, kind)
  WHERE state IN ('pending','in_progress','uncertain');
REVOKE ALL ON public.phone_jobs FROM anon, authenticated;
GRANT ALL ON public.phone_jobs TO service_role;
ALTER TABLE public.phone_jobs ENABLE ROW LEVEL SECURITY;

-- Mirror a job's state onto the salon + sanitized setup row.
CREATE OR REPLACE FUNCTION public._apply_phone_job(j public.phone_jobs)
RETURNS void LANGUAGE plpgsql SET search_path = public AS $$
DECLARE st text := CASE j.state
  WHEN 'pending' THEN 'in_progress' WHEN 'in_progress' THEN 'in_progress'
  WHEN 'uncertain' THEN 'needs_review' WHEN 'failed' THEN 'failed'
  ELSE CASE WHEN j.kind = 'create_agent' THEN 'ready' ELSE 'active' END END;
BEGIN
  INSERT INTO phone_setups (salon_id) VALUES (j.salon_id) ON CONFLICT (salon_id) DO NOTHING;
  IF j.kind = 'create_agent' THEN
    UPDATE phone_setups SET agent_status = st, agent_error = CASE WHEN j.state IN ('failed','uncertain') THEN j.error_code ELSE '' END, updated_at = now() WHERE salon_id = j.salon_id;
    IF j.state = 'succeeded' THEN
      UPDATE salons SET agent_id = j.provider_ref, agent_error = '', updated_at = now() WHERE id = j.salon_id AND agent_id = '';
    END IF;
  ELSE
    UPDATE phone_setups SET temp_number_status = st, temp_number_error = CASE WHEN j.state IN ('failed','uncertain') THEN j.error_code ELSE '' END, updated_at = now() WHERE salon_id = j.salon_id;
    IF j.state = 'succeeded' THEN
      UPDATE salons SET phone_number = j.target, phone_number_sid = j.provider_ref, updated_at = now() WHERE id = j.salon_id AND phone_number = '';
    END IF;
  END IF;
END $$;

-- Atomically create-or-find a job and try to take its lock. Never re-runs uncertain/finished jobs.
CREATE OR REPLACE FUNCTION public.begin_phone_job(p_salon uuid, p_kind text, p_key text)
RETURNS TABLE(job_id uuid, acquired boolean, job_state text, lock_token uuid, target text, provider_ref text, error_code text)
LANGUAGE plpgsql SET search_path = public AS $$
DECLARE j phone_jobs; jid uuid; tok uuid := gen_random_uuid();
BEGIN
  SELECT * INTO j FROM phone_jobs WHERE idempotency_key = p_key;
  IF NOT FOUND THEN
    BEGIN
      INSERT INTO phone_jobs (salon_id, kind, idempotency_key) VALUES (p_salon, p_kind, p_key) RETURNING * INTO j;
    EXCEPTION WHEN unique_violation THEN
      SELECT * INTO j FROM phone_jobs WHERE idempotency_key = p_key;
      IF NOT FOUND THEN
        SELECT * INTO j FROM phone_jobs WHERE salon_id = p_salon AND kind = p_kind
          AND state IN ('pending','in_progress','uncertain') LIMIT 1;
      END IF;
    END;
  END IF;
  IF j.id IS NULL THEN RAISE EXCEPTION 'phone job conflict'; END IF;
  IF j.salon_id <> p_salon OR j.kind <> p_kind THEN RAISE EXCEPTION 'idempotency key reused'; END IF;
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
END $$;

-- Record the exact target (e.g. chosen number) before calling the provider.
CREATE OR REPLACE FUNCTION public.set_phone_job_target(p_job uuid, p_token uuid, p_target text)
RETURNS boolean LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
  UPDATE phone_jobs SET target = p_target, updated_at = now()
    WHERE id = p_job AND lock_token = p_token AND state = 'in_progress';
  RETURN FOUND;
END $$;

-- Guarded transitions: in_progress (lock holder) -> succeeded|failed|uncertain; uncertain -> succeeded|failed.
CREATE OR REPLACE FUNCTION public.transition_phone_job(p_job uuid, p_token uuid, p_to text, p_ref text, p_error text)
RETURNS boolean LANGUAGE plpgsql SET search_path = public AS $$
DECLARE j phone_jobs;
BEGIN
  IF p_token IS NOT NULL THEN
    IF p_to NOT IN ('succeeded','failed','uncertain') THEN RAISE EXCEPTION 'bad transition'; END IF;
    UPDATE phone_jobs SET state = p_to, provider_ref = COALESCE(NULLIF(p_ref,''), provider_ref), error_code = COALESCE(p_error,''),
      lock_token = NULL, updated_at = now(), completed_at = CASE WHEN p_to = 'uncertain' THEN NULL ELSE now() END
      WHERE id = p_job AND lock_token = p_token AND state = 'in_progress' RETURNING * INTO j;
  ELSE
    IF p_to NOT IN ('succeeded','failed') THEN RAISE EXCEPTION 'bad transition'; END IF;
    UPDATE phone_jobs SET state = p_to, provider_ref = COALESCE(NULLIF(p_ref,''), provider_ref), error_code = COALESCE(p_error,''),
      updated_at = now(), completed_at = now()
      WHERE id = p_job AND state = 'uncertain' RETURNING * INTO j;
  END IF;
  IF j.id IS NULL THEN RETURN false; END IF;
  PERFORM _apply_phone_job(j);
  RETURN true;
END $$;

REVOKE ALL ON FUNCTION public._apply_phone_job(public.phone_jobs) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.begin_phone_job(uuid, text, text) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.set_phone_job_target(uuid, uuid, text) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.transition_phone_job(uuid, uuid, text, text, text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public._apply_phone_job(public.phone_jobs) TO service_role;
GRANT EXECUTE ON FUNCTION public.begin_phone_job(uuid, text, text) TO service_role;
GRANT EXECUTE ON FUNCTION public.set_phone_job_target(uuid, uuid, text) TO service_role;
GRANT EXECUTE ON FUNCTION public.transition_phone_job(uuid, uuid, text, text, text) TO service_role;