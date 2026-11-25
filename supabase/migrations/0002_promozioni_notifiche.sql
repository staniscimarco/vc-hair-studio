-- Promozioni (es. Black Friday) e notifiche push alle clienti.
-- Idempotente: può essere eseguita più volte senza effetti collaterali.

create table if not exists public.promotions (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  subtitle text not null default '',
  badge text not null default '',
  discount_percent integer not null default 0 check (discount_percent between 0 and 90),
  service_ids uuid[] not null default '{}',
  starts_on date not null,
  ends_on date not null,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  check (ends_on >= starts_on)
);

alter table public.promotions enable row level security;

drop policy if exists "promozioni visibili" on public.promotions;
create policy "promozioni visibili" on public.promotions for select using (active);

create table if not exists public.broadcasts (
  id uuid primary key default gen_random_uuid(),
  kind text not null check (kind in ('manuale', 'disponibilita', 'promozione')),
  title text not null,
  body text not null,
  url text not null default '/',
  recipients integer not null default 0,
  sent integer not null default 0,
  dedupe_key text unique,
  created_at timestamptz not null default now()
);

alter table public.broadcasts enable row level security;

alter table public.salon_settings add column if not exists daily_push_enabled boolean not null default false;
alter table public.salon_settings add column if not exists daily_push_hour integer not null default 9 check (daily_push_hour between 6 and 21);

alter table public.appointments add column if not exists promotion_id uuid references public.promotions (id) on delete set null;

-- Prenotazioni online da approvare: lo stato "pending" occupa l'orario finché il salone non decide.
alter table public.appointments drop constraint if exists appointments_status_check;
alter table public.appointments add constraint appointments_status_check
  check (status in ('pending', 'confirmed', 'in_progress', 'completed', 'cancelled', 'no_show'));

alter table public.salon_settings add column if not exists require_approval boolean not null default true;

-- Calendario da abbonare sull'iPhone dell'amministratrice (link segreto, rigenerabile).
alter table public.salon_settings add column if not exists admin_calendar_token text not null default replace(gen_random_uuid()::text, '-', '');

-- Indirizzo della cliente (servizio solo a Brindisi, CAP 72100): usato come luogo negli eventi dell'agenda.
alter table public.profiles add column if not exists address text not null default '';
alter table public.customers add column if not exists address text not null default '';

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  meta jsonb := coalesce(new.raw_user_meta_data, '{}'::jsonb);
  first_name text := coalesce(meta ->> 'first_name', split_part(coalesce(meta ->> 'full_name', meta ->> 'name', ''), ' ', 1), '');
  last_name text := coalesce(meta ->> 'last_name', nullif(substr(coalesce(meta ->> 'full_name', meta ->> 'name', ''), length(split_part(coalesce(meta ->> 'full_name', meta ->> 'name', ''), ' ', 1)) + 2), ''), '');
begin
  insert into public.profiles (id, role, first_name, last_name, phone, email, address, privacy_accepted_at)
  values (
    new.id,
    'customer',
    first_name,
    last_name,
    coalesce(meta ->> 'phone', ''),
    coalesce(new.email, ''),
    coalesce(meta ->> 'address', ''),
    case when meta ->> 'privacy_accepted' = 'true' then now() else null end
  );
  insert into public.customers (profile_id, first_name, last_name, phone, email, address)
  values (
    new.id,
    first_name,
    last_name,
    nullif(meta ->> 'phone', ''),
    nullif(new.email, ''),
    coalesce(meta ->> 'address', '')
  );
  return new;
end;
$$;

create or replace function public.sync_customer_from_profile()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  update public.customers
  set first_name = new.first_name,
      last_name = new.last_name,
      phone = nullif(new.phone, ''),
      email = nullif(new.email, ''),
      address = coalesce(new.address, '')
  where profile_id = new.id;
  return new;
end;
$$;

drop trigger if exists profiles_sync_customer on public.profiles;
create trigger profiles_sync_customer
after update of first_name, last_name, phone, email, address on public.profiles
for each row execute function public.sync_customer_from_profile();
