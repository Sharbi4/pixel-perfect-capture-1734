create table public.payments (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete cascade not null,
  salon_id uuid references public.salons(id) on delete cascade not null,
  kind text not null check (kind in ('setup','subscription')),
  status text not null default 'pending' check (status in ('pending','paid','failed')),
  amount_cents integer not null check (amount_cents > 0),
  currency text not null default 'USD',
  square_order_id text unique,
  square_payment_id text,
  checkout_url text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index payments_salon_kind_idx on public.payments (salon_id, kind, created_at desc);

-- Owners may read their own payment rows only; all writes are backend-only.
grant select on public.payments to authenticated;
grant all on public.payments to service_role;

alter table public.payments enable row level security;

create policy "Owners read own payments"
  on public.payments for select to authenticated
  using (user_id = auth.uid());