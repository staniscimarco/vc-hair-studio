"use client";

import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Plus } from "lucide-react";
import { formatPrice } from "@/lib/format";
import { SectionHead, TitleHero } from "@/components/ui/app-header";
import { ServiceArt, ServiceIcon } from "@/components/ui/service-icon";

type Service = {
  id: string;
  name: string;
  description: string;
  duration_minutes: number;
  prep_minutes: number;
  buffer_minutes: number;
  price_cents: number | null;
  color: string;
  active: boolean;
  visible: boolean;
  sort_order: number;
};

const empty = {
  nome: "",
  descrizione: "",
  durataMinuti: 30,
  preparazioneMinuti: 0,
  intervalloMinuti: 0,
  prezzoCentesimi: null as number | null,
  colore: "#9D6CFB",
  attivo: true,
  visibile: true,
  ordine: 10,
};

export default function ServicesPage() {
  const [rows, setRows] = useState<Service[]>([]);
  async function load() {
    const response = await fetch("/api/admin/servizi");
    const body = await response.json();
    setRows(body.servizi ?? []);
  }
  useEffect(() => { void load(); }, []);
  async function save(formData: FormData) {
    const price = String(formData.get("prezzo") ?? "");
    const response = await fetch("/api/admin/servizi", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        id: formData.get("id") || undefined,
        nome: formData.get("nome"),
        descrizione: formData.get("descrizione"),
        durataMinuti: Number(formData.get("durata")),
        preparazioneMinuti: Number(formData.get("preparazione")),
        intervalloMinuti: Number(formData.get("intervallo")),
        prezzoCentesimi: price === "" ? null : Math.round(Number(price) * 100),
        colore: formData.get("colore"),
        attivo: formData.get("attivo") === "on",
        visibile: formData.get("visibile") === "on",
        ordine: Number(formData.get("ordine")),
      }),
    });
    const body = await response.json();
    if (!response.ok) toast.error(body.errore);
    else {
      toast.success("Trattamento salvato.");
      await load();
    }
  }
  return (
    <section>
      <TitleHero title="Servizi" back="/admin" subtitle="Trattamenti, prezzi, durate e visibilità per le clienti." />

      {rows.length > 0 ? (
        <div className="service-dots mt-6">
          {rows.map((row) => (
            <a key={row.id} href={`#servizio-${row.id}`} className="service-dot">
              <span className="dot-circle"><ServiceIcon name={row.name} /></span>
              <span>{row.name}</span>
            </a>
          ))}
          <a href="#nuovo-servizio" className="service-dot">
            <span className="dot-circle" style={{ background: "var(--accent)", color: "#fff" }}><Plus size={24} /></span>
            <span>Nuovo</span>
          </a>
        </div>
      ) : null}

      <SectionHead title="Trattamenti" subtitle={`${rows.length} in elenco`} />
      <div className="grid gap-4 lg:grid-cols-2">
        {rows.map((row, index) => (
          <form key={row.id} id={`servizio-${row.id}`} onSubmit={(event) => { event.preventDefault(); void save(new FormData(event.currentTarget)); }} className="salon-card grid gap-3" style={{ padding: 10, cursor: "default" }}>
            <input type="hidden" name="id" value={row.id} />
            <div className="flex items-center gap-3">
              <span className="pick-thumb" style={{ flexBasis: 64, height: 64 }}><ServiceArt name={row.name} tone={index} compact /></span>
              <div className="min-w-0 flex-1">
                <h3 className="m-0 truncate text-base">{row.name}</h3>
                <p className="m-0 text-[13px] font-semibold">{formatPrice(row.price_cents)}</p>
                <div className="mt-1 flex gap-1">
                  <span className={`status-pill ${row.active ? "is-confirmed" : "is-cancelled"}`}>{row.active ? "Attivo" : "Non attivo"}</span>
                  <span className="status-pill">{row.visible ? "Visibile" : "Nascosto"}</span>
                </div>
              </div>
            </div>
            <div className="grid gap-3 rounded-2xl bg-white p-3">
              <label className="field">Nome<input name="nome" defaultValue={row.name} /></label>
              <label className="field">Descrizione<textarea name="descrizione" defaultValue={row.description} /></label>
              <div className="grid grid-cols-2 gap-3">
                <label className="field">Durata (min)<input name="durata" type="number" defaultValue={row.duration_minutes} /></label>
                <label className="field">Preparazione (min)<input name="preparazione" type="number" defaultValue={row.prep_minutes} /></label>
                <label className="field">Intervallo dopo (min)<input name="intervallo" type="number" defaultValue={row.buffer_minutes} /></label>
                <label className="field">Ordine<input name="ordine" type="number" defaultValue={row.sort_order} /></label>
                <label className="field">Prezzo (€)<input name="prezzo" placeholder="Da concordare" defaultValue={row.price_cents == null ? "" : row.price_cents / 100} /></label>
                <label className="field">Colore in agenda<input name="colore" defaultValue={row.color} /></label>
              </div>
              <label className="toggle">Attivo<input name="attivo" type="checkbox" defaultChecked={row.active} /></label>
              <label className="toggle">Visibile alle clienti<input name="visibile" type="checkbox" defaultChecked={row.visible} /></label>
              <button className="btn btn-primary btn-block" type="submit">Salva</button>
            </div>
          </form>
        ))}
      </div>

      <form id="nuovo-servizio" onSubmit={(event) => { event.preventDefault(); void save(new FormData(event.currentTarget)); }} className="card mt-6 grid gap-3" style={{ borderStyle: "dashed", borderColor: "var(--accent)", borderWidth: 2 }}>
        <div className="card-title"><span className="tile-icon is-accent"><Plus size={20} /></span><h2>Nuovo trattamento</h2></div>
        <div className="field-grid cols-2">
          <label className="field">Nome<input name="nome" required /></label>
          <label className="field">Prezzo (€)<input name="prezzo" placeholder="Vuoto se da concordare" /></label>
        </div>
        <label className="field">Descrizione<textarea name="descrizione" required /></label>
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-5">
          <label className="field">Durata (min)<input name="durata" type="number" defaultValue={empty.durataMinuti} /></label>
          <label className="field">Preparazione (min)<input name="preparazione" type="number" defaultValue={0} /></label>
          <label className="field">Intervallo dopo (min)<input name="intervallo" type="number" defaultValue={0} /></label>
          <label className="field">Ordine<input name="ordine" type="number" defaultValue={10} /></label>
          <label className="field">Colore in agenda<input name="colore" defaultValue={empty.colore} /></label>
        </div>
        <div className="field-grid cols-2">
          <label className="toggle">Attivo<input name="attivo" type="checkbox" defaultChecked /></label>
          <label className="toggle">Visibile alle clienti<input name="visibile" type="checkbox" defaultChecked /></label>
        </div>
        <button className="btn btn-primary btn-block" type="submit">Aggiungi</button>
      </form>
    </section>
  );
}
