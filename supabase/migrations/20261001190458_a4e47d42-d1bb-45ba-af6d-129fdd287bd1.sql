CREATE TABLE public.salons (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id uuid NOT NULL UNIQUE,
  name text NOT NULL DEFAULT '',
  address text NOT NULL DEFAULT '',
  phone text NOT NULL DEFAULT '',
  website text NOT NULL DEFAULT '',
  hours text NOT NULL DEFAULT '',
  languages text[] NOT NULL DEFAULT ARRAY['English'],
  contact_name text NOT NULL DEFAULT '',
  voice text NOT NULL DEFAULT 'mia',
  deposit_policy text NOT NULL DEFAULT '',
  cancellation_policy text NOT NULL DEFAULT '',
  walk_ins boolean NOT NULL DEFAULT true,
  booking_app text NOT NULL DEFAULT '',
  setup_method text NOT NULL DEFAULT 'online',
  status text NOT NULL DEFAULT 'draft',
  launched_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.salons TO authenticated;
GRANT ALL ON public.salons TO service_role;
ALTER TABLE public.salons ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own salon select" ON public.salons FOR SELECT TO authenticated USING (auth.uid() = owner_id);
CREATE POLICY "own salon insert" ON public.salons FOR INSERT TO authenticated WITH CHECK (auth.uid() = owner_id);
CREATE POLICY "own salon update" ON public.salons FOR UPDATE TO authenticated USING (auth.uid() = owner_id);
CREATE POLICY "own salon delete" ON public.salons FOR DELETE TO authenticated USING (auth.uid() = owner_id);

CREATE TABLE public.services (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  salon_id uuid NOT NULL REFERENCES public.salons(id) ON DELETE CASCADE,
  name text NOT NULL,
  price numeric NOT NULL DEFAULT 0,
  minutes integer NOT NULL DEFAULT 30,
  is_addon boolean NOT NULL DEFAULT false,
  position integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.services TO authenticated;
GRANT ALL ON public.services TO service_role;
ALTER TABLE public.services ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own services all" ON public.services FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM public.salons s WHERE s.id = salon_id AND s.owner_id = auth.uid()))
  WITH CHECK (EXISTS (SELECT 1 FROM public.salons s WHERE s.id = salon_id AND s.owner_id = auth.uid()));