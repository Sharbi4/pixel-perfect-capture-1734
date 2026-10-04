ALTER TABLE public.services
  ADD COLUMN IF NOT EXISTS description text NOT NULL DEFAULT '' CHECK (char_length(description) <= 500),
  ADD COLUMN IF NOT EXISTS deposit_cents integer NOT NULL DEFAULT 0 CHECK (deposit_cents BETWEEN 0 AND 100000),
  ADD COLUMN IF NOT EXISTS archived boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS days integer[] NOT NULL DEFAULT '{}';
CREATE POLICY "members read services" ON public.services FOR SELECT TO authenticated USING (public.is_salon_member(salon_id, auth.uid()));

ALTER TABLE public.salons ADD COLUMN IF NOT EXISTS knowledge jsonb NOT NULL DEFAULT '{}'::jsonb;
GRANT SELECT (knowledge) ON public.salons TO authenticated;

CREATE OR REPLACE FUNCTION public.salon_config_changed() RETURNS trigger
LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
  IF (NEW.name, NEW.address, NEW.phone, NEW.website, NEW.hours, NEW.languages, NEW.voice, NEW.deposit_policy,
      NEW.cancellation_policy, NEW.walk_ins, NEW.timezone, NEW.buffer_min, NEW.lead_min, NEW.horizon_days, NEW.booking_provider, NEW.agent_settings, NEW.knowledge)
     IS DISTINCT FROM
     (OLD.name, OLD.address, OLD.phone, OLD.website, OLD.hours, OLD.languages, OLD.voice, OLD.deposit_policy,
      OLD.cancellation_policy, OLD.walk_ins, OLD.timezone, OLD.buffer_min, OLD.lead_min, OLD.horizon_days, OLD.booking_provider, OLD.agent_settings, OLD.knowledge) THEN
    NEW.config_version := NEW.config_version + 1;
    IF NEW.agent_sync_status <> 'syncing' THEN NEW.agent_sync_status := 'update_required'; END IF;
  END IF;
  RETURN NEW;
END $$;