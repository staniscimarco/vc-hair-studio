"use client";

import Link from "next/link";
import { use, useCallback, useEffect, useState } from "react";
import { notifyLive, useLive } from "@/lib/live";
import { CalendarDays } from "lucide-react";
import { TitleHero } from "@/components/ui/app-header";
import { RequestCard, type Request } from "@/components/admin/request-card";

/** Pagina aperta toccando la notifica di una nuova richiesta di prenotazione. */
export default function RequestPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const [request, setRequest] = useState<Request | null>(null);
  const [error, setError] = useState("");

  const load = useCallback(() => {
    void fetch(`/api/admin/richieste?id=${encodeURIComponent(id)}`).then(async (response) => {
      const body = await response.json();
      if (!response.ok) setError(body.errore ?? "Prenotazione non trovata.");
      else setRequest(body.richiesta);
    });
  }, [id]);

  useEffect(() => {
    load();
    // Aprendo la richiesta, la sua notifica risulta letta: la campanella si aggiorna.
    void fetch("/api/notifiche/centro", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ appuntamento: id }) })
      .then(() => notifyLive())
      .catch(() => undefined);
  }, [id, load]);
  useLive(load);

  return (
    <section>
      <TitleHero title="Nuova richiesta" back="/admin" subtitle="Accetta o rifiuta: la cliente riceve subito una notifica con la tua risposta." />
      <div className="mx-auto mt-6 grid max-w-xl gap-4">
        {!request && !error ? <div className="skeleton" style={{ height: 170 }} /> : null}
        {error ? <div className="empty-state">{error}</div> : null}
        {request ? <RequestCard key={`${request.id}-${request.status}`} request={request} onDone={() => notifyLive()} /> : null}
        <Link className="btn btn-soft btn-block" href="/admin/calendario"><CalendarDays size={18} /> Apri l&apos;agenda</Link>
      </div>
    </section>
  );
}
