-- Centro notifiche della cliente: esiti delle richieste e messaggi personali, con stato di lettura.
create table if not exists public.customer_notifications (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid not null references public.profiles (id) on delete cascade,
  appointment_id uuid references public.appointments (id) on delete set null,
  title text not null,
  body text not null,
  url text not null default '/',
  read_at timestamptz,
  created_at timestamptz not null default now()
);

create index if not exists customer_notifications_profile_idx on public.customer_notifications (profile_id, created_at desc);

alter table public.customer_notifications enable row level security;

-- Messaggi a tutte (posti liberi, promozioni) letti fino a questo momento.
alter table public.profiles add column if not exists notifications_seen_at timestamptz;
