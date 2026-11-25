-- Notifiche anche per chi ha installato l'app senza aver ancora effettuato l'accesso:
-- riceve posti liberi e promozioni; quando accede il dispositivo viene collegato al profilo.
alter table public.push_subscriptions alter column profile_id drop not null;
