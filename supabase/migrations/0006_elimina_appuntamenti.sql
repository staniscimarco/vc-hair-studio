-- L'eliminazione di un appuntamento falliva: lo storico provava a riferirsi alla riga appena cancellata.
-- Ora lo storico registra solo inserimenti e modifiche; l'eliminazione resta tracciata nel registro di audit.
create or replace function public.record_appointment_history()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if tg_op = 'DELETE' then
    return old;
  end if;
  insert into public.appointment_history (appointment_id, actor_id, action, snapshot)
  values (new.id, auth.uid(), tg_op, to_jsonb(new));
  return new;
end;
$$;
