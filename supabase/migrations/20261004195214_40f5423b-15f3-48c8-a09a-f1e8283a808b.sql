ALTER TABLE public.salons
  ADD COLUMN IF NOT EXISTS booking_provider text NOT NULL DEFAULT 'salon_pro',
  ADD COLUMN IF NOT EXISTS agent_sync_status text NOT NULL DEFAULT 'update_required',
  ADD COLUMN IF NOT EXISTS last_synced_at timestamptz;

ALTER TABLE public.salons ADD CONSTRAINT salons_booking_provider_chk
  CHECK (booking_provider IN ('salon_pro','square','google','outlook','acuity','mindbody','calendly'));
ALTER TABLE public.salons ADD CONSTRAINT salons_agent_sync_status_chk
  CHECK (agent_sync_status IN ('synced','syncing','update_required','failed'));

GRANT SELECT (booking_provider, agent_sync_status, last_synced_at) ON public.salons TO authenticated;
GRANT UPDATE (booking_provider) ON public.salons TO authenticated;

-- Any change the agent needs to know about marks it out of date.
CREATE OR REPLACE FUNCTION public.bump_salon_config() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE sid uuid := COALESCE(NEW.salon_id, OLD.salon_id);
BEGIN
  UPDATE public.salons SET config_version = config_version + 1,
    agent_sync_status = CASE WHEN agent_sync_status = 'syncing' THEN agent_sync_status ELSE 'update_required' END
  WHERE id = sid;
  RETURN NULL;
END $$;
REVOKE EXECUTE ON FUNCTION public.bump_salon_config() FROM PUBLIC, anon, authenticated;

CREATE TRIGGER staff_bump_config AFTER INSERT OR UPDATE OR DELETE ON public.staff FOR EACH ROW EXECUTE FUNCTION public.bump_salon_config();
CREATE TRIGGER services_bump_config AFTER INSERT OR UPDATE OR DELETE ON public.services FOR EACH ROW EXECUTE FUNCTION public.bump_salon_config();

CREATE OR REPLACE FUNCTION public.salon_config_changed() RETURNS trigger
LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
  IF (NEW.name, NEW.address, NEW.phone, NEW.website, NEW.hours, NEW.languages, NEW.voice, NEW.deposit_policy,
      NEW.cancellation_policy, NEW.walk_ins, NEW.timezone, NEW.buffer_min, NEW.lead_min, NEW.horizon_days, NEW.booking_provider)
     IS DISTINCT FROM
     (OLD.name, OLD.address, OLD.phone, OLD.website, OLD.hours, OLD.languages, OLD.voice, OLD.deposit_policy,
      OLD.cancellation_policy, OLD.walk_ins, OLD.timezone, OLD.buffer_min, OLD.lead_min, OLD.horizon_days, OLD.booking_provider) THEN
    NEW.config_version := NEW.config_version + 1;
    IF NEW.agent_sync_status <> 'syncing' THEN NEW.agent_sync_status := 'update_required'; END IF;
  END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER salons_config_changed BEFORE UPDATE ON public.salons FOR EACH ROW EXECUTE FUNCTION public.salon_config_changed();