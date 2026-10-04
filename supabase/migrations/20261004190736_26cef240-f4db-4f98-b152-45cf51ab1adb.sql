ALTER TABLE public.calls ADD COLUMN resolved_at timestamptz, ADD COLUMN follow_up_at timestamptz, ADD COLUMN has_recording boolean NOT NULL DEFAULT false;
GRANT UPDATE (resolved_at, follow_up_at) ON public.calls TO authenticated;
CREATE POLICY "members update call status" ON public.calls FOR UPDATE TO authenticated
  USING (public.is_salon_member(salon_id, auth.uid())) WITH CHECK (public.is_salon_member(salon_id, auth.uid()));

CREATE TABLE public.call_notes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  call_id uuid NOT NULL REFERENCES public.calls(id) ON DELETE CASCADE,
  salon_id uuid NOT NULL REFERENCES public.salons(id) ON DELETE RESTRICT,
  user_id uuid NOT NULL DEFAULT auth.uid(),
  body text NOT NULL CHECK (char_length(body) BETWEEN 1 AND 2000),
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT ON public.call_notes TO authenticated;
GRANT DELETE ON public.call_notes TO authenticated;
GRANT ALL ON public.call_notes TO service_role;
ALTER TABLE public.call_notes ENABLE ROW LEVEL SECURITY;
CREATE POLICY "members read notes" ON public.call_notes FOR SELECT TO authenticated USING (public.is_salon_member(salon_id, auth.uid()));
CREATE POLICY "members add notes" ON public.call_notes FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid() AND public.is_salon_member(salon_id, auth.uid())
    AND EXISTS (SELECT 1 FROM public.calls c WHERE c.id = call_id AND c.salon_id = call_notes.salon_id));
CREATE POLICY "authors delete own notes" ON public.call_notes FOR DELETE TO authenticated USING (user_id = auth.uid());