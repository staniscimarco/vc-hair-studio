"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { BellOff, BellRing, CalendarCheck, Megaphone } from "lucide-react";
import { TitleHero } from "@/components/ui/app-header";
import { localSeen, markLocalSeen, notifyLive, useLive } from "@/lib/live";
import { enablePush, pushSupported } from "@/lib/push-client";
import { toast } from "sonner";

type Item = { id: string; title: string; body: string; url: string; createdAt: string; letta: boolean; tipo: "personale" | "salone" | "prenotazione" };

function when(value: string) {
  const date = new Date(value);
  const today = new Date();
  const sameDay = date.toDateString() === today.toDateString();
  return sameDay
    ? `Oggi, ${date.toLocaleTimeString("it-IT", { hour: "2-digit", minute: "2-digit" })}`
    : date.toLocaleDateString("it-IT", { weekday: "short", day: "numeric", month: "short" });
}

/** Centro notifiche della cliente: esiti delle richieste, posti liberi e offerte. */
export default function NotificationsCenter() {
  const [items, setItems] = useState<Item[] | null>(null);
  const [logged, setLogged] = useState<boolean | null>(null);
  const [permission, setPermission] = useState<string>("granted");
  const [supported, setSupported] = useState(false);

  const load = useCallback(async (markRead: boolean) => {
    const response = await fetch(`/api/notifiche/centro?visto=${encodeURIComponent(localSeen())}`, { cache: "no-store" });
    const body = await response.json().catch(() => ({ elementi: [] }));
    setItems(body.elementi ?? []);
    setLogged(Boolean(body.ruolo));
    if (markRead && (body.nonLette ?? 0) > 0) {
      // Aprendo la pagina le notifiche diventano lette: la campanella si azzera.
      const done = await fetch("/api/notifiche/centro", { method: "POST", headers: { "content-type": "application/json" }, body: "{}" })
        .then((res) => res.json())
        .catch(() => ({}));
      markLocalSeen(done.visto ?? new Date().toISOString());
      notifyLive();
    }
  }, []);

  useEffect(() => {
    setSupported(pushSupported());
    if ("Notification" in window) setPermission(Notification.permission);
    void load(true);
  }, [load]);
  useLive(() => void load(true));

  return (
    <section className="app-screen">
      <TitleHero title="Notifiche" back="/" subtitle="Conferme dei tuoi appuntamenti, posti liberi e offerte del salone." />

      {logged === false ? (
        <div className="empty-state mt-5">
          <span className="tile-icon"><BellRing size={20} /></span>
          Accedi per ricevere la conferma dei tuoi appuntamenti, i posti liberi e le offerte riservate.
          <Link className="btn btn-primary btn-sm" href="/accesso?prossimo=/notifiche">Accedi</Link>
        </div>
      ) : null}

      {logged && permission !== "granted" && supported ? (
        <div className="card-soft mt-5 flex items-center gap-3">
          <span className="tile-icon is-primary"><BellRing size={18} /></span>
          <p className="m-0 flex-1 text-sm">Attiva le notifiche per sapere subito quando il salone conferma.</p>
          <button className="btn btn-primary btn-sm" type="button" onClick={async () => {
            const result = await enablePush("customer");
            if (result.ok) {
              setPermission("granted");
              toast.success("Notifiche attivate 💜");
            } else toast.error(result.motivo ?? "Notifiche non attivate.");
          }}>Attiva</button>
        </div>
      ) : null}

      <div className="mt-5 grid gap-3">
        {items === null ? [0, 1, 2].map((index) => <div key={index} className="skeleton" style={{ height: 84 }} />) : null}
        {logged && items && items.length === 0 ? (
          <div className="empty-state">
            <span className="tile-icon"><BellOff size={20} /></span>
            Nessuna notifica, per ora. Ti scriveremo qui appena c&apos;è una novità per te.
          </div>
        ) : null}
        {(items ?? []).map((item) => {
          const Icon = item.tipo === "personale" ? CalendarCheck : Megaphone;
          return (
            <Link key={`${item.tipo}-${item.id}`} href={item.url || "/"} className="pick-card" style={{ padding: 12, background: item.letta ? "var(--lavender-soft)" : undefined }}>
              <span className={`tile-icon ${item.letta ? "" : "is-primary"}`}><Icon size={18} /></span>
              <span className="pick-main">
                <h3>{item.title}</h3>
                <p>{item.body}</p>
                <span className="mt-1 block text-[11px] text-muted">{when(item.createdAt)}</span>
              </span>
              {!item.letta ? <span className="unread-dot" aria-label="Non letta" /> : null}
            </Link>
          );
        })}
      </div>
    </section>
  );
}
