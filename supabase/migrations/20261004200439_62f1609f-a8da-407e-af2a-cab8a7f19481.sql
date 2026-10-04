ALTER TABLE public.salons ADD COLUMN IF NOT EXISTS agent_settings jsonb NOT NULL DEFAULT '{}'::jsonb;
GRANT SELECT (agent_settings) ON public.salons TO authenticated;

CREATE OR REPLACE FUNCTION public.salon_config_changed() RETURNS trigger
LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
  IF (NEW.name, NEW.address, NEW.phone, NEW.website, NEW.hours, NEW.languages, NEW.voice, NEW.deposit_policy,
      NEW.cancellation_policy, NEW.walk_ins, NEW.timezone, NEW.buffer_min, NEW.lead_min, NEW.horizon_days, NEW.booking_provider, NEW.agent_settings)
     IS DISTINCT FROM
     (OLD.name, OLD.address, OLD.phone, OLD.website, OLD.hours, OLD.languages, OLD.voice, OLD.deposit_policy,
      OLD.cancellation_policy, OLD.walk_ins, OLD.timezone, OLD.buffer_min, OLD.lead_min, OLD.horizon_days, OLD.booking_provider, OLD.agent_settings) THEN
    NEW.config_version := NEW.config_version + 1;
    IF NEW.agent_sync_status <> 'syncing' THEN NEW.agent_sync_status := 'update_required'; END IF;
  END IF;
  RETURN NEW;
END $$;