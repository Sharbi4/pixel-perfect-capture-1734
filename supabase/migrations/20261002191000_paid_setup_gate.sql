-- Written only after provider-verified payment. No owner or anonymous writes.
ALTER TABLE public.salons ADD COLUMN paid_access_until timestamptz;
GRANT SELECT (paid_access_until) ON public.salons TO authenticated;

-- Defense in depth at the durable paid-resource entry point.
ALTER FUNCTION public.begin_phone_job(uuid,text,text) RENAME TO _begin_phone_job_unpaid_check;
CREATE FUNCTION public.begin_phone_job(p_salon uuid,p_kind text,p_key text)
RETURNS TABLE(job_id uuid,acquired boolean,job_state text,lock_token uuid,target text,provider_ref text,error_code text)
LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
BEGIN
  IF NOT EXISTS(SELECT 1 FROM public.salons WHERE id=p_salon AND paid_access_until>now()) THEN
    RAISE EXCEPTION 'payment_required';
  END IF;
  RETURN QUERY SELECT * FROM public._begin_phone_job_unpaid_check(p_salon,p_kind,p_key);
END $$;
REVOKE ALL ON FUNCTION public.begin_phone_job(uuid,text,text) FROM PUBLIC,anon,authenticated;
REVOKE ALL ON FUNCTION public._begin_phone_job_unpaid_check(uuid,text,text) FROM PUBLIC,anon,authenticated,service_role;
GRANT EXECUTE ON FUNCTION public.begin_phone_job(uuid,text,text) TO service_role;
