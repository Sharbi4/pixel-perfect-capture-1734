CREATE TABLE public.salon_square_connections (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  salon_id uuid NOT NULL UNIQUE REFERENCES public.salons(id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  merchant_id text NOT NULL,
  merchant_name text NOT NULL DEFAULT '',
  location_id text NOT NULL DEFAULT '',
  location_name text NOT NULL DEFAULT '',
  access_token_ciphertext text NOT NULL,
  refresh_token_ciphertext text NOT NULL,
  expires_at timestamptz NOT NULL,
  scopes text NOT NULL DEFAULT '',
  reconnect_required boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT ALL ON public.salon_square_connections TO service_role;
ALTER TABLE public.salon_square_connections ENABLE ROW LEVEL SECURITY;

CREATE TABLE public.square_oauth_states (
  nonce text PRIMARY KEY,
  salon_id uuid NOT NULL REFERENCES public.salons(id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  expires_at timestamptz NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT ALL ON public.square_oauth_states TO service_role;
ALTER TABLE public.square_oauth_states ENABLE ROW LEVEL SECURITY;

ALTER TABLE public.services ADD COLUMN IF NOT EXISTS square_variation_id text NOT NULL DEFAULT '';
ALTER TABLE public.staff ADD COLUMN IF NOT EXISTS square_team_member_id text NOT NULL DEFAULT '';