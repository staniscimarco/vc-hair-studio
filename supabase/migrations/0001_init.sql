-- VC Hair Studio — schema iniziale
-- Un solo salone, una sola agenda. Gli orari sono interpretati in Europe/Rome
-- e salvati come timestamptz (UTC).

create extension if not exists pgcrypto;
create extension if not exists btree_gist;

-- ---------------------------------------------------------------------------
-- Profili e clienti
-- ---------------------------------------------------------------------------

create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  role text not null default 'customer' check (role in ('customer', 'admin')),
  first_name text not null default '',
  last_name text not null default '',
  phone text not null default '',
  email text not null default '',
  privacy_accepted_at timestamptz,
  deletion_requested_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.customers (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid unique references public.profiles (id) on delete set null,
  first_name text not null,
  last_name text not null,
  email text,
  phone text,
  notes text,
  archived_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index customers_email_idx on public.customers (lower(email));
create index customers_phone_idx on public.customers (phone);

-- ---------------------------------------------------------------------------
-- Servizi e impostazioni
-- ---------------------------------------------------------------------------

create table public.services (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  description text not null default '',
  duration_minutes integer not null check (duration_minutes between 15 and 480),
  prep_minutes integer not null default 0 check (prep_minutes between 0 and 180),
  buffer_minutes integer not null default 0 check (buffer_minutes between 0 and 180),
  price_cents integer check (price_cents is null or price_cents >= 0),
  color text not null default '#E8B4B8',
  active boolean not null default true,
  visible boolean not null default true,
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.salon_settings (
  id integer primary key default 1 check (id = 1),
  salon_name text not null default 'VC Hair Studio',
  stylist_name text not null default '',
  phone text not null default '',
  email text not null default '',
  address text not null default '',
  city text not null default '',
  postal_code text not null default '',
  booking_enabled boolean not null default false,
  setup_completed boolean not null default false,
  slot_minutes integer not null default 15 check (slot_minutes in (5, 10, 15, 20, 30, 60)),
  min_advance_minutes integer not null default 120 check (min_advance_minutes >= 0),
  max_horizon_days integer not null default 60 check (max_horizon_days between 1 and 365),
  cancel_min_hours integer not null default 24 check (cancel_min_hours >= 0),
  reschedule_min_hours integer not null default 24 check (reschedule_min_hours >= 0),
  reminders_enabled boolean not null default true,
  reminder_hours_before integer not null default 24 check (reminder_hours_before >= 1),
  privacy_controller_name text not null default '',
  privacy_controller_email text not null default '',
  privacy_controller_address text not null default '',
  vat_number text not null default '',
  retention_months integer not null default 24 check (retention_months between 1 and 120),
  legal_notes text not null default '',
  updated_at timestamptz not null default now()
);

insert into public.salon_settings (id) values (1);

insert into public.services (name, description, duration_minutes, color, sort_order)
values
  (
    'Piega',
    'Una piega personalizzata per valorizzare i tuoi capelli e il tuo stile.',
    30,
    '#E8B4B8',
    1
  ),
  (
    'Colore',
    'Rinnova il tuo look con un trattamento colore pensato per esaltare la tua bellezza e donare luminosità ai capelli.',
    60,
    '#C4B5D4',
    2
  ),
  (
    'Colore e piega',
    'Un trattamento completo per rinnovare il colore e completare il tuo look con una piega personalizzata.',
    90,
    '#B76E79',
    3
  );

-- ---------------------------------------------------------------------------
-- Agenda
-- ---------------------------------------------------------------------------

create table public.working_hours (
  id uuid primary key default gen_random_uuid(),
  weekday smallint not null check (weekday between 1 and 7),
  start_minute integer not null check (start_minute >= 0 and start_minute < 1440),
  end_minute integer not null check (end_minute > start_minute and end_minute <= 1440)
);

create table public.recurrence_rules (
  id uuid primary key default gen_random_uuid(),
  kind text not null check (kind in ('block', 'extra_opening')),
  frequency text not null check (frequency in ('daily', 'weekly', 'biweekly', 'monthly', 'weekdays')),
  weekdays smallint[] not null default '{}',
  start_date date not null,
  until_date date,
  all_day boolean not null default false,
  start_minute integer,
  end_minute integer,
  reason text,
  notes text,
  created_at timestamptz not null default now(),
  check (until_date is null or until_date >= start_date),
  check (all_day or (start_minute is not null and end_minute is not null and end_minute > start_minute))
);

create table public.availability_exceptions (
  id uuid primary key default gen_random_uuid(),
  kind text not null check (kind in ('block', 'extra_opening', 'full_day_closure', 'reopen_day', 'skip_occurrence')),
  start_date date not null,
  end_date date not null,
  all_day boolean not null default false,
  start_minute integer,
  end_minute integer,
  recurrence_id uuid references public.recurrence_rules (id) on delete cascade,
  reason text,
  notes text,
  created_at timestamptz not null default now(),
  check (end_date >= start_date),
  check (
    kind in ('full_day_closure', 'reopen_day', 'skip_occurrence')
    or all_day
    or (start_minute is not null and end_minute is not null and end_minute > start_minute)
  )
);

create index availability_exceptions_dates_idx on public.availability_exceptions (start_date, end_date);

-- Fasce concrete usate anche dal vincolo di esclusione.
create table public.blocked_slots (
  id uuid primary key default gen_random_uuid(),
  exception_id uuid references public.availability_exceptions (id) on delete cascade,
  recurrence_id uuid references public.recurrence_rules (id) on delete cascade,
  starts_at timestamptz not null,
  ends_at timestamptz not null,
  reason text,
  notes text,
  check (ends_at > starts_at)
);

create index blocked_slots_range_idx on public.blocked_slots using gist (tstzrange(starts_at, ends_at, '[)'));

create table public.appointments (
  id uuid primary key default gen_random_uuid(),
  customer_id uuid not null references public.customers (id),
  service_id uuid not null references public.services (id),
  starts_at timestamptz not null,
  ends_at timestamptz not null,
  prep_minutes integer not null default 0,
  buffer_minutes integer not null default 0,
  price_cents integer,
  amount_paid_cents integer check (amount_paid_cents is null or amount_paid_cents >= 0),
  payment_status text not null default 'da_pagare' check (payment_status in ('da_pagare', 'pagato', 'parziale')),
  payment_method text check (payment_method in ('contanti', 'carta', 'altro')),
  status text not null default 'confirmed' check (status in ('confirmed', 'in_progress', 'completed', 'cancelled', 'no_show')),
  source text not null check (source in ('online', 'manuale')),
  code text not null unique,
  calendar_token uuid not null unique default gen_random_uuid(),
  idempotency_key text unique,
  notes text,
  cancel_reason text,
  created_by uuid references public.profiles (id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (ends_at > starts_at)
);

create index appointments_range_idx on public.appointments (starts_at, ends_at);
create index appointments_customer_idx on public.appointments (customer_id);
create index appointments_status_idx on public.appointments (status, starts_at);

-- Occupa il tempo reale della poltrona: preparazione prima, intervallo dopo.
-- Gli appuntamenti annullati non inseriscono una riga e quindi liberano la fascia.
create table public.occupancy (
  source_type text not null check (source_type in ('appointment', 'block')),
  source_id uuid not null,
  span tstzrange not null,
  primary key (source_type, source_id),
  exclude using gist (span with &&)
);

create table public.appointment_history (
  id uuid primary key default gen_random_uuid(),
  appointment_id uuid not null references public.appointments (id) on delete cascade,
  actor_id uuid,
  action text not null,
  snapshot jsonb not null,
  created_at timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- Notifiche, e-mail, audit
-- ---------------------------------------------------------------------------

create table public.push_subscriptions (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid not null references public.profiles (id) on delete cascade,
  endpoint text not null unique,
  p256dh text not null,
  auth_key text not null,
  user_agent text,
  fail_count integer not null default 0,
  disabled_at timestamptz,
  last_success_at timestamptz,
  created_at timestamptz not null default now()
);

create table public.notifications (
  id uuid primary key default gen_random_uuid(),
  appointment_id uuid references public.appointments (id) on delete set null,
  event text not null,
  title text not null,
  body text not null,
  url text not null,
  read_at timestamptz,
  created_at timestamptz not null default now()
);

create table public.notification_outbox (
  id uuid primary key default gen_random_uuid(),
  notification_id uuid references public.notifications (id) on delete cascade,
  appointment_id uuid references public.appointments (id) on delete set null,
  payload jsonb not null,
  status text not null default 'pending' check (status in ('pending', 'sent', 'failed', 'skipped')),
  attempts integer not null default 0,
  next_attempt_at timestamptz not null default now(),
  last_error text,
  created_at timestamptz not null default now(),
  sent_at timestamptz
);

create index notification_outbox_pending_idx on public.notification_outbox (status, next_attempt_at);

create table public.email_logs (
  id uuid primary key default gen_random_uuid(),
  appointment_id uuid references public.appointments (id) on delete set null,
  kind text not null,
  to_email text,
  subject text not null,
  status text not null check (status in ('pending', 'sent', 'failed', 'skipped', 'not_configured')),
  dedupe_key text unique,
  provider_id text,
  error text,
  created_at timestamptz not null default now(),
  sent_at timestamptz
);

create table public.audit_logs (
  id uuid primary key default gen_random_uuid(),
  actor_id uuid,
  action text not null,
  entity text not null,
  entity_id text,
  payload jsonb,
  created_at timestamptz not null default now()
);

create table public.rate_limits (
  bucket text not null,
  window_start timestamptz not null,
  count integer not null default 0,
  primary key (bucket, window_start)
);

create table public.app_errors (
  id uuid primary key default gen_random_uuid(),
  source text not null,
  message text not null,
  created_at timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- Funzioni
-- ---------------------------------------------------------------------------

create or replace function public.touch_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger profiles_touch before update on public.profiles
for each row execute function public.touch_updated_at();
create trigger customers_touch before update on public.customers
for each row execute function public.touch_updated_at();
create trigger services_touch before update on public.services
for each row execute function public.touch_updated_at();
create trigger settings_touch before update on public.salon_settings
for each row execute function public.touch_updated_at();
create trigger appointments_touch before update on public.appointments
for each row execute function public.touch_updated_at();

create or replace function public.prevent_role_change()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.role is distinct from old.role
     and coalesce(auth.jwt() ->> 'role', '') is distinct from 'service_role'
     and current_user not in ('postgres', 'supabase_admin') then
    raise exception 'modifica_ruolo_non_consentita';
  end if;
  return new;
end;
$$;

create trigger profiles_role_guard before update of role on public.profiles
for each row execute function public.prevent_role_change();

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  meta jsonb := coalesce(new.raw_user_meta_data, '{}'::jsonb);
begin
  insert into public.profiles (id, role, first_name, last_name, phone, email, privacy_accepted_at)
  values (
    new.id,
    'customer',
    coalesce(meta ->> 'first_name', ''),
    coalesce(meta ->> 'last_name', ''),
    coalesce(meta ->> 'phone', ''),
    coalesce(new.email, ''),
    case when meta ->> 'privacy_accepted' = 'true' then now() else null end
  );
  insert into public.customers (profile_id, first_name, last_name, phone, email)
  values (
    new.id,
    coalesce(meta ->> 'first_name', ''),
    coalesce(meta ->> 'last_name', ''),
    nullif(meta ->> 'phone', ''),
    nullif(new.email, '')
  );
  return new;
end;
$$;

create trigger on_auth_user_created
after insert on auth.users
for each row execute function public.handle_new_user();

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
      email = nullif(new.email, '')
  where profile_id = new.id;
  return new;
end;
$$;

create trigger profiles_sync_customer
after update of first_name, last_name, phone, email on public.profiles
for each row execute function public.sync_customer_from_profile();

create or replace function public.sync_appointment_occupancy()
returns trigger
language plpgsql
as $$
begin
  if tg_op = 'DELETE' then
    delete from public.occupancy
    where source_type = 'appointment' and source_id = old.id;
    return old;
  end if;

  if new.status = 'cancelled' then
    delete from public.occupancy
    where source_type = 'appointment' and source_id = new.id;
    return new;
  end if;

  insert into public.occupancy (source_type, source_id, span)
  values (
    'appointment',
    new.id,
    tstzrange(
      new.starts_at - make_interval(mins => new.prep_minutes),
      new.ends_at + make_interval(mins => new.buffer_minutes),
      '[)'
    )
  )
  on conflict (source_type, source_id) do update
  set span = excluded.span;
  return new;
end;
$$;

create trigger appointments_occupancy
after insert or update of starts_at, ends_at, prep_minutes, buffer_minutes, status or delete
on public.appointments
for each row execute function public.sync_appointment_occupancy();

create or replace function public.sync_block_occupancy()
returns trigger
language plpgsql
as $$
begin
  if tg_op = 'DELETE' then
    delete from public.occupancy where source_type = 'block' and source_id = old.id;
    return old;
  end if;
  insert into public.occupancy (source_type, source_id, span)
  values ('block', new.id, tstzrange(new.starts_at, new.ends_at, '[)'))
  on conflict (source_type, source_id) do update
  set span = excluded.span;
  return new;
end;
$$;

create trigger blocked_slots_occupancy
after insert or update or delete on public.blocked_slots
for each row execute function public.sync_block_occupancy();

create or replace function public.record_appointment_history()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  row_id uuid;
  snapshot jsonb;
begin
  if tg_op = 'DELETE' then
    row_id := old.id;
    snapshot := to_jsonb(old);
  else
    row_id := new.id;
    snapshot := to_jsonb(new);
  end if;
  insert into public.appointment_history (appointment_id, actor_id, action, snapshot)
  values (row_id, auth.uid(), tg_op, snapshot);
  if tg_op = 'DELETE' then
    return old;
  end if;
  return new;
end;
$$;

create trigger appointments_history
after insert or update or delete on public.appointments
for each row execute function public.record_appointment_history();

create or replace function public.write_audit()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  row_id text;
begin
  if tg_op = 'DELETE' then
    row_id := old.id::text;
  else
    row_id := new.id::text;
  end if;
  insert into public.audit_logs (actor_id, action, entity, entity_id, payload)
  values (
    auth.uid(),
    tg_op,
    tg_table_name,
    row_id,
    jsonb_build_object(
      'nuovo', case when tg_op = 'DELETE' then null else to_jsonb(new) end,
      'precedente', case when tg_op = 'INSERT' then null else to_jsonb(old) end
    )
  );
  if tg_op = 'DELETE' then
    return old;
  end if;
  return new;
end;
$$;

create trigger services_audit after insert or update or delete on public.services
for each row execute function public.write_audit();
create trigger settings_audit after update on public.salon_settings
for each row execute function public.write_audit();
create trigger hours_audit after insert or update or delete on public.working_hours
for each row execute function public.write_audit();
create trigger rules_audit after insert or update or delete on public.recurrence_rules
for each row execute function public.write_audit();
create trigger exceptions_audit after insert or update or delete on public.availability_exceptions
for each row execute function public.write_audit();

create or replace function public.is_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.profiles
    where id = auth.uid() and role = 'admin'
  );
$$;

-- ---------------------------------------------------------------------------
-- Row Level Security
-- ---------------------------------------------------------------------------

alter table public.profiles enable row level security;
alter table public.customers enable row level security;
alter table public.services enable row level security;
alter table public.salon_settings enable row level security;
alter table public.working_hours enable row level security;
alter table public.recurrence_rules enable row level security;
alter table public.availability_exceptions enable row level security;
alter table public.blocked_slots enable row level security;
alter table public.occupancy enable row level security;
alter table public.appointments enable row level security;
alter table public.appointment_history enable row level security;
alter table public.push_subscriptions enable row level security;
alter table public.notifications enable row level security;
alter table public.notification_outbox enable row level security;
alter table public.email_logs enable row level security;
alter table public.audit_logs enable row level security;
alter table public.rate_limits enable row level security;
alter table public.app_errors enable row level security;

create policy profiles_select_own on public.profiles
for select to authenticated
using (id = auth.uid() or public.is_admin());

create or replace function public.current_role()
returns text
language sql
stable
security definer
set search_path = public
as $$
  select role from public.profiles where id = auth.uid();
$$;

create policy profiles_update_own on public.profiles
for update to authenticated
using (id = auth.uid())
with check (id = auth.uid() and role = public.current_role());

create policy customers_select on public.customers
for select to authenticated
using (profile_id = auth.uid() or public.is_admin());

create policy customers_update_own on public.customers
for update to authenticated
using (profile_id = auth.uid() or public.is_admin())
with check (profile_id = auth.uid() or public.is_admin());

create policy services_public_read on public.services
for select to anon, authenticated
using ((active and visible) or public.is_admin());

create policy services_admin_write on public.services
for all to authenticated
using (public.is_admin())
with check (public.is_admin());

create policy settings_admin on public.salon_settings
for all to authenticated
using (public.is_admin())
with check (public.is_admin());

create policy hours_admin on public.working_hours
for all to authenticated using (public.is_admin()) with check (public.is_admin());
create policy rules_admin on public.recurrence_rules
for all to authenticated using (public.is_admin()) with check (public.is_admin());
create policy exceptions_admin on public.availability_exceptions
for all to authenticated using (public.is_admin()) with check (public.is_admin());
create policy blocks_admin on public.blocked_slots
for all to authenticated using (public.is_admin()) with check (public.is_admin());
create policy occupancy_admin on public.occupancy
for select to authenticated using (public.is_admin());

create policy appointments_select on public.appointments
for select to authenticated
using (
  public.is_admin()
  or exists (
    select 1 from public.customers c
    where c.id = appointments.customer_id and c.profile_id = auth.uid()
  )
);

create policy history_select on public.appointment_history
for select to authenticated
using (
  public.is_admin()
  or exists (
    select 1
    from public.appointments a
    join public.customers c on c.id = a.customer_id
    where a.id = appointment_history.appointment_id and c.profile_id = auth.uid()
  )
);

create policy push_own on public.push_subscriptions
for all to authenticated
using (profile_id = auth.uid() or public.is_admin())
with check (profile_id = auth.uid() or public.is_admin());

create policy notifications_admin on public.notifications
for select to authenticated using (public.is_admin());
create policy outbox_admin on public.notification_outbox
for select to authenticated using (public.is_admin());
create policy email_admin on public.email_logs
for select to authenticated using (public.is_admin());
create policy audit_admin on public.audit_logs
for select to authenticated using (public.is_admin());
create policy errors_admin on public.app_errors
for select to authenticated using (public.is_admin());

revoke insert, delete on public.profiles from anon, authenticated;
revoke update (role) on public.profiles from anon, authenticated;

-- Le scritture dell'agenda passano dal server con la service role.
revoke insert, update, delete on public.appointments from anon, authenticated;
revoke insert, update, delete on public.occupancy from anon, authenticated;
revoke insert, update, delete on public.notification_outbox from anon, authenticated;
revoke insert, update, delete on public.notifications from anon, authenticated;
revoke insert, update, delete on public.email_logs from anon, authenticated;
revoke all on public.rate_limits from anon, authenticated;

do $$
begin
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime') then
    alter publication supabase_realtime add table public.appointments;
    alter publication supabase_realtime add table public.blocked_slots;
    alter publication supabase_realtime add table public.availability_exceptions;
  end if;
exception
  when duplicate_object then null;
end $$;
