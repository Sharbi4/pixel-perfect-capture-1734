ALTER TABLE public.appointments ADD COLUMN IF NOT EXISTS provider_event_id text NOT NULL DEFAULT '';

CREATE TABLE public.salon_calendar_connections (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  salon_id uuid NOT NULL UNIQUE REFERENCES public.salons(id) ON DELETE CASCADE,
  provider text NOT NULL DEFAULT 'google',
  user_id uuid NOT NULL,
  calendar_id text NOT NULL DEFAULT 'primary',
  calendar_summary text NOT NULL DEFAULT '',
  connection_key_ciphertext text NOT NULL DEFAULT '',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT ALL ON public.salon_calendar_connections TO service_role;
ALTER TABLE public.salon_calendar_connections ENABLE ROW LEVEL SECURITY;