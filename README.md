# VC Hair Studio

Applicazione di prenotazione per un salone con una sola parrucchiera, una sola sede e un unico calendario. Interfaccia in italiano, valuta euro, fuso `Europe/Rome`.

Il logo originale è `public/brand/vale.png`. Non va ricompresso né ritagliato. Le icone in `public/icons` sono generate da quello stesso file con `node scripts/genera-icone.mjs`.

## Avvio

```bash
npm install
cp .env.example .env.local
npm run dev
```

Senza le variabili Supabase il sito mostra il marchio e avvisa che le prenotazioni non sono ancora attive. Non usa dati finti.

## Variabili

| Nome | Uso |
| --- | --- |
| `NEXT_PUBLIC_APP_URL` | Indirizzo pubblico, usato nei link delle e-mail e nel callback di accesso |
| `NEXT_PUBLIC_SUPABASE_URL` | URL del progetto Supabase |
| `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | Chiave pubblica, usata nel browser |
| `SUPABASE_SERVICE_ROLE_KEY` | Solo sul server. Non va mai nel frontend |
| `NEXT_PUBLIC_VAPID_PUBLIC_KEY` | Chiave pubblica delle notifiche |
| `VAPID_PRIVATE_KEY` | Chiave privata delle notifiche, solo server |
| `VAPID_SUBJECT` | Contatto del mittente, `mailto:mansons82@live.it` |
| `RESEND_API_KEY` | Invio e-mail. Se manca, l'app non dichiara l'invio |
| `EMAIL_FROM` | Mittente verificato su Resend |
| `CRON_SECRET` | Protegge `/api/cron/dispatch` |

Genera le chiavi push prima della pubblicazione:

```bash
npx web-push generate-vapid-keys
```

## Database

Applicare `supabase/migrations/0001_init.sql` nel SQL editor di Supabase, in una regione UE. Poi creare il primo amministratore:

1. Registrare l'account dalla pagina di registrazione e confermare l'e-mail.
2. Nel SQL editor, promuoverlo. Non esiste una password predefinita.

```sql
update public.profiles
set role = 'admin'
where email = 'indirizzo-della-parrucchiera@example.com';
```

Un secondo account tecnico si promuove allo stesso modo e condivide la stessa agenda. Un cliente non può assegnarsi il ruolo `admin`.

In Authentication, aggiungere l'URL di redirect:

`https://TUO-DOMINIO/auth/callback`

Prima di aprire le prenotazioni, completare `/admin/configurazione`: dati del salone, almeno una fascia oraria, servizi, regole e testi legali. Poi, in Impostazioni, segnare la configurazione come completata e attivare le prenotazioni.

## Cosa è già presente

- Prenotazione: trattamento, giorno, orario, accesso, riepilogo, conferma automatica, codice, file ICS.
- Motore di disponibilità con orari, pause, chiusure, ferie, ricorrenze, aperture straordinarie, anticipo e orizzonte.
- Vincolo PostgreSQL `EXCLUDE` su `occupancy` per impedire due prenotazioni dello stesso orario.
- Area cliente e area amministrativa, calendario, clienti, servizi, incassi manuali.
- PWA, service worker che non mette in cache dati personali, notifiche Web Push con outbox.
- E-mail via Resend solo se configurata. Promemoria dal cron.
- Test del motore con Vitest, inclusi ora solare e ora legale.

## Controlli

```bash
npm test
npm run typecheck
npm run lint
npm run build
npm run scan:secrets
```

I test end-to-end con Playwright sono in `e2e/` e usano la porta 3210. In questa consegna `npx playwright test` ha superato 8 prove su Chromium (390×844, 430×932, 768×1024, 1440×900). Non sono stati lanciati su iPhone o Android reali.

## Pubblicazione

GitHub CLI non risultava autenticato (`gh auth status`). La repository privata `vc-hair-studio` non è stata creata e non è stato fatto alcun push.

Quando l'account `staniscimarco` è collegato:

```bash
gh auth login
gh api user --jq .login
gh repo create vc-hair-studio --private --source=. --remote=origin
git push -u origin main
```

Il piano Hobby di Vercel non è adatto a un uso commerciale e i cron orari richiedono un piano superiore. Non è stato attivato alcun piano a pagamento. Il cron previsto è `0 * * * *` su `/api/cron/dispatch`.

## Backup

Dal piano Supabase gratuito non c'è ripristino point-in-time. Esportare periodicamente:

```bash
supabase db dump -f backup.sql
```

Clienti e appuntamenti si esportano anche dall'area amministrativa. Conservare il dump fuori dal computer del salone.

## Prima dell'apertura

- Completare titolare, indirizzo e partita IVA.
- Far rileggere informativa e condizioni.
- Impostare gli orari reali.
- Generare le chiavi VAPID e provarle su un iPhone con l'app installata e su Android.
- Confermare che il progetto Supabase sia in UE.
- Verificare un invio e-mail di prova su un indirizzo proprio.
- Non usare il piano gratuito di Vercel per l'attività del salone.
