-- Drafts are never provider configuration. Only explicit confirmation updates approved data.
ALTER TABLE public.salons
  ADD COLUMN setup_draft jsonb,
  ADD COLUMN setup_config jsonb NOT NULL DEFAULT '{}',
  ADD COLUMN setup_revision integer NOT NULL DEFAULT 0,
  ADD COLUMN setup_completed integer[] NOT NULL DEFAULT '{}',
  ADD COLUMN config_version integer NOT NULL DEFAULT 0,
  ADD COLUMN agent_synced_version integer NOT NULL DEFAULT -1;
ALTER TABLE public.services ADD COLUMN details jsonb NOT NULL DEFAULT '{}';
GRANT SELECT (setup_draft,setup_config,setup_revision,setup_completed,config_version,agent_synced_version) ON public.salons TO authenticated;

-- service_role only: authenticated server validates the draft and proves ownership first.
CREATE FUNCTION public.save_setup_draft(p_salon uuid, p_owner uuid, p_revision integer, p_draft jsonb, p_step integer DEFAULT NULL, p_profile jsonb DEFAULT '{}')
RETURNS integer LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE s public.salons; item jsonb; published jsonb; completed integer[]; new_revision integer;
BEGIN
  SELECT * INTO s FROM public.salons WHERE id=p_salon AND owner_id=p_owner FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'setup_not_found'; END IF;
  IF s.setup_revision <> p_revision THEN RAISE EXCEPTION 'setup_conflict'; END IF;
  IF jsonb_typeof(p_draft) <> 'object' OR octet_length(p_draft::text)>500000 THEN RAISE EXCEPTION 'invalid_draft'; END IF;
  IF p_step IS NOT NULL AND (p_step < 0 OR p_step > 3) THEN RAISE EXCEPTION 'invalid_step'; END IF;
  IF p_step > 0 AND NOT (p_step-1 = ANY(s.setup_completed)) THEN RAISE EXCEPTION 'missing_prerequisite'; END IF;
  published := s.setup_config; completed := s.setup_completed;
  IF p_step IS NOT NULL THEN
    IF p_step=0 THEN published := published || jsonb_build_object('business',p_draft->'business'); END IF;
    IF p_step=1 THEN
      -- Check UUID ownership before upsert: no moving a service across salons.
      IF EXISTS (SELECT 1 FROM jsonb_array_elements(p_draft->'services') x JOIN public.services v ON v.id=(x->>'id')::uuid WHERE v.salon_id<>p_salon) THEN RAISE EXCEPTION 'invalid_service'; END IF;
      DELETE FROM public.services WHERE salon_id=p_salon AND id NOT IN (SELECT (x->>'id')::uuid FROM jsonb_array_elements(p_draft->'services') x);
      FOR item IN SELECT value FROM jsonb_array_elements(p_draft->'services') LOOP
        INSERT INTO public.services(id,salon_id,name,price,minutes,is_addon,position,details)
        VALUES ((item->>'id')::uuid,p_salon,item->>'name',(item->>'price')::numeric,(item->>'minutes')::integer,(item->>'is_addon')::boolean,
          (SELECT ordinality-1 FROM jsonb_array_elements(p_draft->'services') WITH ORDINALITY WHERE value=item LIMIT 1),item)
        ON CONFLICT(id) DO UPDATE SET name=excluded.name,price=excluded.price,minutes=excluded.minutes,is_addon=excluded.is_addon,position=excluded.position,details=excluded.details;
      END LOOP;
    END IF;
    IF p_step=2 THEN published := published || jsonb_build_object('team',p_draft->'team','solo',p_draft->'solo','any_available',p_draft->'any_available'); END IF;
    IF p_step=3 THEN published := published || jsonb_build_object('receptionist',p_draft->'receptionist'); END IF;
    -- Changes require downstream review again; do not mark any provider state complete.
    completed := ARRAY(SELECT x FROM unnest(completed) x WHERE x<p_step) || p_step;
    UPDATE public.salons SET
      name=coalesce(p_profile->>'name',name),address=coalesce(p_profile->>'address',address),phone=coalesce(p_profile->>'phone',phone),
      website=coalesce(p_profile->>'website',website),hours=coalesce(p_profile->>'hours',hours),contact_name=coalesce(p_profile->>'contact_name',contact_name),
      voice=coalesce(p_profile->>'voice',voice),languages=CASE WHEN p_profile ? 'languages' THEN ARRAY(SELECT jsonb_array_elements_text(p_profile->'languages')) ELSE languages END,
      cancellation_policy=coalesce(p_profile->>'cancellation_policy',cancellation_policy),deposit_policy=coalesce(p_profile->>'deposit_policy',deposit_policy),
      walk_ins=coalesce((p_profile->>'walk_ins')::boolean,walk_ins),config_version=config_version+1 WHERE id=p_salon;
  END IF;
  UPDATE public.salons SET setup_draft=p_draft,setup_config=published,setup_completed=completed,setup_revision=setup_revision+1,updated_at=now()
    WHERE id=p_salon RETURNING setup_revision INTO new_revision;
  RETURN new_revision;
END $$;
REVOKE ALL ON FUNCTION public.save_setup_draft(uuid,uuid,integer,jsonb,integer,jsonb) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.save_setup_draft(uuid,uuid,integer,jsonb,integer,jsonb) TO service_role;
