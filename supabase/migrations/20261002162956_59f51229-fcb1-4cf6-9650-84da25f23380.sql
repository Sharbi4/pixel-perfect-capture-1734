-- Salons: customers may read safe columns, insert their own row, and edit profile fields. No delete/truncate.
REVOKE ALL ON public.salons FROM anon, authenticated;
DROP POLICY IF EXISTS "own salon delete" ON public.salons;

ALTER TABLE public.salons
  ADD COLUMN IF NOT EXISTS has_receptionist boolean GENERATED ALWAYS AS (agent_id <> '') STORED;

GRANT SELECT (id, owner_id, name, address, phone, website, hours, languages, contact_name, voice,
  deposit_policy, cancellation_policy, walk_ins, booking_app, setup_method, status, launched_at,
  created_at, updated_at, agent_error, phone_number, has_receptionist) ON public.salons TO authenticated;
GRANT INSERT (owner_id, name, address, phone, website, hours, languages, contact_name, voice,
  deposit_policy, cancellation_policy, walk_ins, booking_app, setup_method) ON public.salons TO authenticated;
GRANT UPDATE (name, address, phone, website, hours, languages, contact_name, voice,
  deposit_policy, cancellation_policy, walk_ins, booking_app, setup_method, updated_at) ON public.salons TO authenticated;
GRANT ALL ON public.salons TO service_role;

-- Setup status: owner-scoped read only.
REVOKE ALL ON public.phone_setups FROM anon, authenticated;
GRANT SELECT ON public.phone_setups TO authenticated;
GRANT ALL ON public.phone_setups TO service_role;

-- Jobs: backend only.
REVOKE ALL ON public.phone_jobs FROM anon, authenticated;
GRANT ALL ON public.phone_jobs TO service_role;

-- Services: owner CRUD (setup replaces the list), nothing for anon, no truncate.
REVOKE ALL ON public.services FROM anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.services TO authenticated;
GRANT ALL ON public.services TO service_role;

-- Paid-resource records must outlive accidental salon deletion; backend removes them explicitly.
ALTER TABLE public.phone_jobs DROP CONSTRAINT phone_jobs_salon_id_fkey;
ALTER TABLE public.phone_jobs ADD CONSTRAINT phone_jobs_salon_id_fkey
  FOREIGN KEY (salon_id) REFERENCES public.salons(id) ON DELETE RESTRICT;