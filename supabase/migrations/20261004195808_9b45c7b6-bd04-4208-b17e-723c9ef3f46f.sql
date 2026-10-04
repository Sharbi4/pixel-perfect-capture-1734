ALTER TABLE public.appointments DROP CONSTRAINT appointments_source_check;
ALTER TABLE public.appointments ADD CONSTRAINT appointments_source_check CHECK (source IN ('staff','ai_call','ai_text','online'));
ALTER TABLE public.appointments
  ADD COLUMN IF NOT EXISTS provider text NOT NULL DEFAULT 'salon_pro',
  ADD COLUMN IF NOT EXISTS deposit_status text NOT NULL DEFAULT 'none' CHECK (deposit_status IN ('none','required','link_sent','paid','waived')),
  ADD COLUMN IF NOT EXISTS deposit_cents integer NOT NULL DEFAULT 0 CHECK (deposit_cents >= 0),
  ADD COLUMN IF NOT EXISTS confirmation_sent_at timestamptz;
ALTER TABLE public.appointments ADD CONSTRAINT appointments_provider_chk CHECK (provider IN ('salon_pro','square','google','outlook','acuity','mindbody','calendly'));