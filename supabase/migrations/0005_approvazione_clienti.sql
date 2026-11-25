-- Approvazione delle nuove registrazioni (contro lo spam): finché approved_at è vuoto la cliente non può prenotare.
alter table public.profiles add column if not exists approved_at timestamptz;
alter table public.profiles add column if not exists signup_notified_at timestamptz;

-- Chi era già registrato prima di questa novità resta attivo.
update public.profiles set approved_at = coalesce(created_at, now()) where approved_at is null;
update public.profiles set signup_notified_at = coalesce(created_at, now()) where signup_notified_at is null;

create index if not exists profiles_pending_idx on public.profiles (approved_at) where approved_at is null;
