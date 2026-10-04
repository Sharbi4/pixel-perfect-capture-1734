CREATE EXTENSION IF NOT EXISTS btree_gist WITH SCHEMA extensions;

ALTER TABLE public.salons
  ADD COLUMN timezone text NOT NULL DEFAULT 'America/Phoenix',
  ADD COLUMN buffer_min integer NOT NULL DEFAULT 10 CHECK (buffer_min BETWEEN 0 AND 120),
  ADD COLUMN lead_min integer NOT NULL DEFAULT 60 CHECK (lead_min BETWEEN 0 AND 10080),
  ADD COLUMN horizon_days integer NOT NULL DEFAULT 60 CHECK (horizon_days BETWEEN 1 AND 365),
  ADD COLUMN confirm_texts boolean NOT NULL DEFAULT true,
  ADD COLUMN plan_tier text NOT NULL DEFAULT 'pro' CHECK (plan_tier IN ('essential','pro','premier')),
  ADD COLUMN scheduling_addon boolean NOT NULL DEFAULT false;
GRANT SELECT (timezone, buffer_min, lead_min, horizon_days, confirm_texts, plan_tier, scheduling_addon) ON public.salons TO authenticated;
GRANT UPDATE (timezone, buffer_min, lead_min, horizon_days, confirm_texts, plan_tier, scheduling_addon) ON public.salons TO authenticated;

CREATE TABLE public.staff (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  salon_id uuid NOT NULL REFERENCES public.salons(id) ON DELETE RESTRICT,
  name text NOT NULL CHECK (char_length(name) BETWEEN 1 AND 60),
  service_ids uuid[] NOT NULL DEFAULT '{}',
  hours jsonb NOT NULL DEFAULT '{"1":[[540,1080]],"2":[[540,1080]],"3":[[540,1080]],"4":[[540,1080]],"5":[[540,1080]],"6":[[540,1020]]}'::jsonb,
  active boolean NOT NULL DEFAULT true,
  position integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.staff TO authenticated;
GRANT ALL ON public.staff TO service_role;
ALTER TABLE public.staff ENABLE ROW LEVEL SECURITY;
CREATE POLICY "members manage staff" ON public.staff FOR ALL TO authenticated USING (public.is_salon_member(salon_id, auth.uid())) WITH CHECK (public.is_salon_member(salon_id, auth.uid()));

CREATE TABLE public.staff_time_off (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  salon_id uuid NOT NULL REFERENCES public.salons(id) ON DELETE RESTRICT,
  staff_id uuid NOT NULL REFERENCES public.staff(id) ON DELETE CASCADE,
  starts_at timestamptz NOT NULL,
  ends_at timestamptz NOT NULL,
  reason text NOT NULL DEFAULT '',
  created_at timestamptz NOT NULL DEFAULT now(),
  CHECK (ends_at > starts_at)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.staff_time_off TO authenticated;
GRANT ALL ON public.staff_time_off TO service_role;
ALTER TABLE public.staff_time_off ENABLE ROW LEVEL SECURITY;
CREATE POLICY "members manage time off" ON public.staff_time_off FOR ALL TO authenticated USING (public.is_salon_member(salon_id, auth.uid())) WITH CHECK (public.is_salon_member(salon_id, auth.uid()));

CREATE TABLE public.appointments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  salon_id uuid NOT NULL REFERENCES public.salons(id) ON DELETE RESTRICT,
  staff_id uuid REFERENCES public.staff(id) ON DELETE SET NULL,
  service_id uuid REFERENCES public.services(id) ON DELETE SET NULL,
  service_name text NOT NULL DEFAULT '',
  price numeric NOT NULL DEFAULT 0,
  client_name text NOT NULL DEFAULT '' CHECK (char_length(client_name) <= 120),
  client_phone text NOT NULL DEFAULT '',
  starts_at timestamptz NOT NULL,
  ends_at timestamptz NOT NULL,
  status text NOT NULL DEFAULT 'booked' CHECK (status IN ('booked','confirmed','completed','cancelled','no_show')),
  source text NOT NULL DEFAULT 'staff' CHECK (source IN ('staff','ai_call','ai_text')),
  call_id uuid REFERENCES public.calls(id) ON DELETE SET NULL,
  notes text NOT NULL DEFAULT '' CHECK (char_length(notes) <= 2000),
  text_confirmed boolean NOT NULL DEFAULT false,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CHECK (ends_at > starts_at),
  CONSTRAINT appointments_no_overlap EXCLUDE USING gist (staff_id WITH =, tstzrange(starts_at, ends_at) WITH &&) WHERE (status IN ('booked','confirmed') AND staff_id IS NOT NULL)
);
CREATE INDEX appointments_salon_time ON public.appointments (salon_id, starts_at);
CREATE INDEX appointments_phone ON public.appointments (salon_id, client_phone);
GRANT SELECT, INSERT, UPDATE ON public.appointments TO authenticated;
GRANT ALL ON public.appointments TO service_role;
ALTER TABLE public.appointments ENABLE ROW LEVEL SECURITY;
CREATE POLICY "members read appointments" ON public.appointments FOR SELECT TO authenticated USING (public.is_salon_member(salon_id, auth.uid()));
CREATE POLICY "members add appointments" ON public.appointments FOR INSERT TO authenticated WITH CHECK (public.is_salon_member(salon_id, auth.uid()) AND source = 'staff');
CREATE POLICY "members edit appointments" ON public.appointments FOR UPDATE TO authenticated USING (public.is_salon_member(salon_id, auth.uid())) WITH CHECK (public.is_salon_member(salon_id, auth.uid()));

CREATE TABLE public.waitlist (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  salon_id uuid NOT NULL REFERENCES public.salons(id) ON DELETE RESTRICT,
  client_name text NOT NULL DEFAULT '',
  client_phone text NOT NULL DEFAULT '',
  service_name text NOT NULL DEFAULT '',
  staff_id uuid REFERENCES public.staff(id) ON DELETE SET NULL,
  preferred text NOT NULL DEFAULT '' CHECK (char_length(preferred) <= 300),
  status text NOT NULL DEFAULT 'waiting' CHECK (status IN ('waiting','contacted','booked','removed')),
  source text NOT NULL DEFAULT 'staff',
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.waitlist TO authenticated;
GRANT ALL ON public.waitlist TO service_role;
ALTER TABLE public.waitlist ENABLE ROW LEVEL SECURITY;
CREATE POLICY "members manage waitlist" ON public.waitlist FOR ALL TO authenticated USING (public.is_salon_member(salon_id, auth.uid())) WITH CHECK (public.is_salon_member(salon_id, auth.uid()));