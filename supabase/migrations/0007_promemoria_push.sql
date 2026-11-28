-- Promemoria push un'ora prima dell'appuntamento: inviato una sola volta.
alter table public.appointments add column if not exists reminder_push_at timestamptz;
