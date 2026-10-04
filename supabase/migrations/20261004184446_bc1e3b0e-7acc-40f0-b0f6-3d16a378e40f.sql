CREATE TYPE public.salon_role AS ENUM ('owner','manager','staff');

CREATE TABLE public.salon_members (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  salon_id uuid NOT NULL REFERENCES public.salons(id) ON DELETE RESTRICT,
  user_id uuid NOT NULL,
  role public.salon_role NOT NULL DEFAULT 'staff',
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (salon_id, user_id)
);
GRANT SELECT ON public.salon_members TO authenticated;
GRANT ALL ON public.salon_members TO service_role;
ALTER TABLE public.salon_members ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION public.is_salon_member(_salon uuid, _user uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.salon_members WHERE salon_id = _salon AND user_id = _user)
$$;

CREATE POLICY "members read memberships of their salons" ON public.salon_members
  FOR SELECT TO authenticated USING (public.is_salon_member(salon_id, auth.uid()));

CREATE POLICY "members read their salons" ON public.salons
  FOR SELECT TO authenticated USING (public.is_salon_member(id, auth.uid()));

INSERT INTO public.salon_members (salon_id, user_id, role)
SELECT id, owner_id, 'owner' FROM public.salons ON CONFLICT DO NOTHING;

CREATE OR REPLACE FUNCTION public.add_salon_owner_member()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  INSERT INTO public.salon_members (salon_id, user_id, role) VALUES (NEW.id, NEW.owner_id, 'owner')
  ON CONFLICT DO NOTHING;
  RETURN NEW;
END $$;
CREATE TRIGGER salons_add_owner_member AFTER INSERT ON public.salons
  FOR EACH ROW EXECUTE FUNCTION public.add_salon_owner_member();