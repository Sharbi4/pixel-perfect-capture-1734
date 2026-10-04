CREATE TABLE public.calls (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  salon_id uuid NOT NULL REFERENCES public.salons(id) ON DELETE RESTRICT,
  provider_ref text NOT NULL UNIQUE,
  started_at timestamptz NOT NULL,
  duration_secs integer NOT NULL DEFAULT 0,
  direction text NOT NULL DEFAULT 'inbound',
  customer_phone text NOT NULL DEFAULT '',
  status text NOT NULL DEFAULT '',
  outcome text NOT NULL DEFAULT '',
  summary text NOT NULL DEFAULT '',
  title text NOT NULL DEFAULT '',
  transcript jsonb NOT NULL DEFAULT '[]'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX calls_salon_started ON public.calls (salon_id, started_at DESC);
GRANT SELECT ON public.calls TO authenticated;
GRANT ALL ON public.calls TO service_role;
ALTER TABLE public.calls ENABLE ROW LEVEL SECURITY;
CREATE POLICY "members read calls" ON public.calls FOR SELECT TO authenticated USING (public.is_salon_member(salon_id, auth.uid()));

CREATE TABLE public.messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  salon_id uuid NOT NULL REFERENCES public.salons(id) ON DELETE RESTRICT,
  provider_ref text NOT NULL UNIQUE,
  sent_at timestamptz NOT NULL,
  direction text NOT NULL,
  customer_phone text NOT NULL DEFAULT '',
  body text NOT NULL DEFAULT '',
  status text NOT NULL DEFAULT '',
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX messages_salon_sent ON public.messages (salon_id, sent_at DESC);
GRANT SELECT ON public.messages TO authenticated;
GRANT ALL ON public.messages TO service_role;
ALTER TABLE public.messages ENABLE ROW LEVEL SECURITY;
CREATE POLICY "members read messages" ON public.messages FOR SELECT TO authenticated USING (public.is_salon_member(salon_id, auth.uid()));