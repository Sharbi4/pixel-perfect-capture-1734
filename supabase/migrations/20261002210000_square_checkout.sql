CREATE TABLE public.checkout_purchases(
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(), secret_hash text NOT NULL UNIQUE,
  owner_id uuid, email text NOT NULL, buyer jsonb NOT NULL, preview jsonb NOT NULL,
  state text NOT NULL DEFAULT 'draft' CHECK(state IN ('draft','processing','paid','needs_review','refunded')),
  environment text NOT NULL CHECK(environment IN ('sandbox','production')),
  location_id text NOT NULL,plan_id text NOT NULL,plan_name text NOT NULL,timezone text NOT NULL,
  next_billing_date date NOT NULL,total_cents integer NOT NULL CHECK(total_cents>0),monthly_cents integer NOT NULL CHECK(monthly_cents>0),
  customer_id text NOT NULL DEFAULT '',payment_id text NOT NULL DEFAULT '',card_id text NOT NULL DEFAULT '',subscription_id text NOT NULL DEFAULT '',
  source_cipher text NOT NULL DEFAULT '',source_hash text NOT NULL DEFAULT '',lock_token uuid,locked_at timestamptz,
  error_code text NOT NULL DEFAULT '',paid_through timestamptz,consent_at timestamptz NOT NULL,
  invite_state text NOT NULL DEFAULT 'pending',created_at timestamptz NOT NULL DEFAULT now(),updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX checkout_one_purchase_per_email ON public.checkout_purchases(lower(email),environment) WHERE state<>'refunded';
CREATE UNIQUE INDEX checkout_payment_unique ON public.checkout_purchases(payment_id) WHERE payment_id<>'';
CREATE UNIQUE INDEX checkout_subscription_unique ON public.checkout_purchases(subscription_id) WHERE subscription_id<>'';
ALTER TABLE public.checkout_purchases ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.checkout_purchases FROM PUBLIC,anon,authenticated;
GRANT ALL ON public.checkout_purchases TO service_role;

CREATE TABLE public.billing_events(id text PRIMARY KEY,purchase_id uuid REFERENCES public.checkout_purchases(id),event_type text NOT NULL,processed_at timestamptz,created_at timestamptz NOT NULL DEFAULT now());
ALTER TABLE public.billing_events ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.billing_events FROM PUBLIC,anon,authenticated;
GRANT ALL ON public.billing_events TO service_role;

CREATE FUNCTION public.acquire_checkout(p_id uuid,p_secret text,p_cipher text DEFAULT '',p_hash text DEFAULT '') RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE p public.checkout_purchases; tok uuid:=gen_random_uuid();
BEGIN
 SELECT * INTO p FROM public.checkout_purchases WHERE id=p_id AND secret_hash=p_secret FOR UPDATE;
 IF NOT FOUND THEN RAISE EXCEPTION 'checkout_not_found'; END IF;
 IF p.state IN ('paid','refunded') THEN RETURN NULL; END IF;
 IF p.lock_token IS NOT NULL AND p.locked_at>now()-interval '5 minutes' THEN RETURN NULL; END IF;
 -- Never replay uncertain payment mutations after the bounded recovery window.
 IF p.created_at<now()-interval '1 hour' THEN RAISE EXCEPTION 'checkout_review_required'; END IF;
 IF p.source_cipher='' AND p_cipher='' THEN RAISE EXCEPTION 'payment_details_required'; END IF;
 UPDATE public.checkout_purchases SET lock_token=tok,locked_at=now(),state='processing',updated_at=now(),
   source_cipher=CASE WHEN source_cipher='' THEN p_cipher ELSE source_cipher END,
   source_hash=CASE WHEN source_hash='' THEN p_hash ELSE source_hash END
 WHERE id=p_id RETURNING * INTO p;
 RETURN to_jsonb(p);
END $$;

CREATE FUNCTION public.claim_checkout(p_owner uuid,p_email text,p_draft jsonb) RETURNS uuid
LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE p public.checkout_purchases; sid uuid;
BEGIN
 -- Prove email ownership in the auth database, even though this function is backend-only.
 IF NOT EXISTS(SELECT 1 FROM auth.users WHERE id=p_owner AND lower(email)=lower(p_email) AND email_confirmed_at IS NOT NULL) THEN RAISE EXCEPTION 'verify_email'; END IF;
 SELECT * INTO p FROM public.checkout_purchases WHERE lower(email)=lower(p_email) AND state='paid' AND (owner_id IS NULL OR owner_id=p_owner)
 ORDER BY (environment='production') DESC,created_at DESC LIMIT 1 FOR UPDATE;
 IF NOT FOUND OR p.paid_through<=now() THEN RAISE EXCEPTION 'payment_required'; END IF;
 INSERT INTO public.salons(owner_id) VALUES(p_owner) ON CONFLICT(owner_id) DO NOTHING;
 SELECT id INTO sid FROM public.salons WHERE owner_id=p_owner FOR UPDATE;
 UPDATE public.checkout_purchases SET owner_id=p_owner WHERE id=p.id;
 UPDATE public.salons SET
   paid_access_until=CASE WHEN p.environment='production' THEN greatest(paid_access_until,p.paid_through) ELSE paid_access_until END,
   setup_draft=CASE WHEN setup_draft IS NULL AND name='' THEN p_draft ELSE setup_draft END,
   setup_revision=CASE WHEN setup_draft IS NULL AND name='' THEN setup_revision+1 ELSE setup_revision END
 WHERE id=sid;
 RETURN sid;
END $$;
REVOKE ALL ON FUNCTION public.acquire_checkout(uuid,text,text,text),public.claim_checkout(uuid,text,jsonb) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.acquire_checkout(uuid,text,text,text),public.claim_checkout(uuid,text,jsonb) TO service_role;

-- Monotonic paid periods; a refunded purchase cannot be restored by an older event.
CREATE FUNCTION public.apply_checkout_access(p_id uuid,p_until timestamptz,p_refunded boolean) RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE p public.checkout_purchases;
BEGIN
 SELECT * INTO p FROM public.checkout_purchases WHERE id=p_id FOR UPDATE;
 IF NOT FOUND OR p.state NOT IN ('paid','refunded') THEN RAISE EXCEPTION 'purchase_pending'; END IF;
 IF p_refunded OR p.state='refunded' THEN
   UPDATE public.checkout_purchases SET state='refunded',paid_through=least(paid_through,now()),source_cipher='',source_hash='',error_code='refund_review_required',updated_at=now() WHERE id=p_id;
 ELSIF p_until IS NOT NULL THEN
   UPDATE public.checkout_purchases SET paid_through=greatest(paid_through,p_until),updated_at=now() WHERE id=p_id;
 END IF;
 IF p.environment='production' AND p.owner_id IS NOT NULL THEN
   UPDATE public.salons SET paid_access_until=(SELECT max(paid_through) FROM public.checkout_purchases WHERE owner_id=p.owner_id AND environment='production' AND state='paid') WHERE owner_id=p.owner_id;
 END IF;
END $$;
REVOKE ALL ON FUNCTION public.apply_checkout_access(uuid,timestamptz,boolean) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.apply_checkout_access(uuid,timestamptz,boolean) TO service_role;
