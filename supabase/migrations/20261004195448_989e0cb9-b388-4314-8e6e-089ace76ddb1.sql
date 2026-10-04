CREATE TABLE public.sms_automations (
  salon_id uuid NOT NULL REFERENCES public.salons(id) ON DELETE CASCADE,
  kind text NOT NULL CHECK (kind IN ('appointment_confirmation','appointment_reminder','missed_call','deposit_reminder','booking_link','cancellation_confirmation','reschedule_confirmation','address','after_hours','callback_confirmation','review_request','marketing')),
  enabled boolean NOT NULL DEFAULT false,
  body text NOT NULL DEFAULT '' CHECK (char_length(body) <= 480),
  marketing_ack_at timestamptz,
  updated_by uuid,
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (salon_id, kind)
);
GRANT SELECT, INSERT, UPDATE ON public.sms_automations TO authenticated;
GRANT ALL ON public.sms_automations TO service_role;
ALTER TABLE public.sms_automations ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION public.can_manage_salon(_salon uuid, _user uuid) RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.salon_members WHERE salon_id=_salon AND user_id=_user AND role IN ('owner','manager'))
$$;

CREATE POLICY "Members read SMS settings" ON public.sms_automations FOR SELECT TO authenticated USING (public.is_salon_member(salon_id, auth.uid()));
CREATE POLICY "Managers add SMS settings" ON public.sms_automations FOR INSERT TO authenticated WITH CHECK (public.can_manage_salon(salon_id, auth.uid()));
CREATE POLICY "Managers change SMS settings" ON public.sms_automations FOR UPDATE TO authenticated USING (public.can_manage_salon(salon_id, auth.uid())) WITH CHECK (public.can_manage_salon(salon_id, auth.uid()));

-- Marketing can only be turned on after the owner confirms consent rules.
CREATE OR REPLACE FUNCTION public.sms_automation_guard() RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
  NEW.updated_at := now(); NEW.updated_by := auth.uid();
  IF NEW.kind = 'marketing' AND NEW.enabled AND NEW.marketing_ack_at IS NULL THEN RAISE EXCEPTION 'marketing_consent_required'; END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER sms_automations_guard BEFORE INSERT OR UPDATE ON public.sms_automations FOR EACH ROW EXECUTE FUNCTION public.sms_automation_guard();

-- Per-client marketing consent, separate from transactional texting.
ALTER TABLE public.sms_threads
  ADD COLUMN IF NOT EXISTS marketing_opt_in boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS marketing_opt_in_at timestamptz,
  ADD COLUMN IF NOT EXISTS marketing_opt_in_source text NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS opted_out boolean NOT NULL DEFAULT false;

-- Carry the existing confirmation setting over.
INSERT INTO public.sms_automations (salon_id, kind, enabled)
SELECT id, 'appointment_confirmation', confirm_texts FROM public.salons ON CONFLICT DO NOTHING;