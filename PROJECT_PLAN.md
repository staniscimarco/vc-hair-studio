# Piano di progetto — VC Hair Studio

Aggiornato il 25 novembre 2026.

## Decisioni

- Repository di riferimento `letsopencals/template-haar` analizzata: licenza MIT, dipende da Opencals e include più sedi, staff e pagamenti. Non è stato copiato codice. L'applicazione è indipendente.
- Il logo `vale.png` della cartella principale è stato copiato senza ricompressione in `public/brand/vale.png` (1254×1254, con canale alpha).
- Stack: Next.js 16, React 19, TypeScript strict, Tailwind 4, componenti nello stile shadcn, Framer Motion, FullCalendar 6, Supabase, Zod, React Hook Form.

## Stato

| Fase | Stato |
| --- | --- |
| 1 Analisi del riferimento | Completata |
| 2 Architettura e progetto | Completata |
| 3 Design system e logo | Completata |
| 4 Database e autenticazione | Schema e flussi pronti, da applicare su Supabase |
| 5 Motore disponibilità | Completato e coperto da test |
| 6 Prenotazioni cliente | Completate nel codice |
| 7 Calendario e amministrazione | Completati nel codice |
| 8 Indisponibilità | Completate nel codice |
| 9 PWA e notifiche | Codice pronto, chiavi e dispositivi reali da configurare |
| 10 E-mail e promemoria | Codice pronto, provider da configurare |
| 11 Sicurezza e test | Test unitari eseguiti. Build di produzione eseguita. Playwright su Chromium alle quattro risoluzioni: 8 superati. Prove su telefoni reali non eseguite |
| 12 Ottimizzazione | Build riuscita. Lighthouse non misurato |
| 13 GitHub | Bloccata: `gh` non è autenticato |
| 14 Vercel | CLI autenticata come `staniscimarco-9107`. Deploy non eseguito |
| 15 Documentazione | Questo file e il README |

## Test eseguiti

`npx vitest run`: 30 test superati, tra cui durate, sovrapposizioni, chiusure, ferie, ricorrenze, riapertura, conflitti, ora solare e ora legale.

`npx tsc --noEmit`: superato.

`npx next build`: superato.

`node scripts/scan-secrets.mjs`: nessun segreto nel codice.

`npx playwright test`: 8 test superati su Chromium alle risoluzioni 390×844, 430×932, 768×1024 e 1440×900. Verificano homepage, accesso, privacy, condizioni e assenza di scorrimento orizzontale. Il server di prova usa la porta 3210.

Non eseguiti: prenotazioni simultanee contro PostgreSQL reale, notifiche su iPhone e Android, Lighthouse.

## Da fare prima dell'uso reale

1. Creare il progetto Supabase in UE e applicare la migrazione.
2. Inserire le variabili in Vercel e in `.env.local`.
3. Promuovere gli amministratori via SQL.
4. Completare orari, prezzi e testi legali.
5. Autenticare `gh` come `staniscimarco` e creare la repository privata.
6. Collegare la repository a Vercel su un piano compatibile con l'uso commerciale.
