ALTER TABLE public.sms_threads
  ADD COLUMN IF NOT EXISTS email text NOT NULL DEFAULT '' CHECK (char_length(email) <= 200),
  ADD COLUMN IF NOT EXISTS preferred_language text NOT NULL DEFAULT '' CHECK (char_length(preferred_language) <= 40),
  ADD COLUMN IF NOT EXISTS preferred_staff_id uuid REFERENCES public.staff(id) ON DELETE SET NULL;

CREATE TABLE public.customer_notes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  salon_id uuid NOT NULL REFERENCES public.salons(id) ON DELETE CASCADE,
  customer_phone text NOT NULL,
  user_id uuid NOT NULL DEFAULT auth.uid(),
  body text NOT NULL CHECK (char_length(body) BETWEEN 1 AND 2000),
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX customer_notes_lookup ON public.customer_notes (salon_id, customer_phone, created_at DESC);
GRANT SELECT, INSERT, DELETE ON public.customer_notes TO authenticated;
GRANT ALL ON public.customer_notes TO service_role;
ALTER TABLE public.customer_notes ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Members read customer notes" ON public.customer_notes FOR SELECT TO authenticated USING (public.is_salon_member(salon_id, auth.uid()));
CREATE POLICY "Members add their own customer notes" ON public.customer_notes FOR INSERT TO authenticated WITH CHECK (public.is_salon_member(salon_id, auth.uid()) AND user_id = auth.uid());
CREATE POLICY "Authors delete their customer notes" ON public.customer_notes FOR DELETE TO authenticated USING (user_id = auth.uid() AND public.is_salon_member(salon_id, auth.uid()));