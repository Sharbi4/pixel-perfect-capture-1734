CREATE TABLE public.sms_threads (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  salon_id uuid NOT NULL REFERENCES public.salons(id) ON DELETE RESTRICT,
  customer_phone text NOT NULL,
  customer_name text NOT NULL DEFAULT '' CHECK (char_length(customer_name) <= 120),
  tags text[] NOT NULL DEFAULT '{}',
  notes text NOT NULL DEFAULT '' CHECK (char_length(notes) <= 4000),
  ai_enabled boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (salon_id, customer_phone)
);
GRANT SELECT ON public.sms_threads TO authenticated;
GRANT INSERT (salon_id, customer_phone, customer_name, tags, notes, ai_enabled) ON public.sms_threads TO authenticated;
GRANT UPDATE (customer_name, tags, notes, ai_enabled, updated_at) ON public.sms_threads TO authenticated;
GRANT ALL ON public.sms_threads TO service_role;
ALTER TABLE public.sms_threads ENABLE ROW LEVEL SECURITY;
CREATE POLICY "members read threads" ON public.sms_threads FOR SELECT TO authenticated USING (public.is_salon_member(salon_id, auth.uid()));
CREATE POLICY "members add threads" ON public.sms_threads FOR INSERT TO authenticated WITH CHECK (public.is_salon_member(salon_id, auth.uid()));
CREATE POLICY "members edit threads" ON public.sms_threads FOR UPDATE TO authenticated USING (public.is_salon_member(salon_id, auth.uid())) WITH CHECK (public.is_salon_member(salon_id, auth.uid()));

ALTER TABLE public.messages ADD COLUMN sent_by text NOT NULL DEFAULT '', ADD COLUMN sender_user uuid;