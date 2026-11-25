"use client";

import { useEffect, useState } from "react";
import { toast } from "sonner";
import { formatPrice } from "@/lib/format";

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
  colore: "#E8B4B8",
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
    <section className="grid gap-6">
      <h1 className="font-display text-5xl text-cocoa">Servizi</h1>
      {rows.map((row) => (
        <form key={row.id} action={save} className="grid gap-2 rounded-3xl bg-white p-4">
          <input type="hidden" name="id" value={row.id} />
          <input name="nome" defaultValue={row.name} className="rounded-2xl border border-line px-3 py-2" />
          <textarea name="descrizione" defaultValue={row.description} className="rounded-2xl border border-line px-3 py-2" />
          <div className="grid grid-cols-2 gap-2">
            <input name="durata" type="number" defaultValue={row.duration_minutes} className="rounded-2xl border border-line px-3 py-2" />
            <input name="preparazione" type="number" defaultValue={row.prep_minutes} className="rounded-2xl border border-line px-3 py-2" />
            <input name="intervallo" type="number" defaultValue={row.buffer_minutes} className="rounded-2xl border border-line px-3 py-2" />
            <input name="ordine" type="number" defaultValue={row.sort_order} className="rounded-2xl border border-line px-3 py-2" />
          </div>
          <input name="prezzo" placeholder="Prezzo in euro" defaultValue={row.price_cents == null ? "" : row.price_cents / 100} className="rounded-2xl border border-line px-3 py-2" />
          <p className="text-sm">{formatPrice(row.price_cents)}</p>
          <input name="colore" defaultValue={row.color} className="rounded-2xl border border-line px-3 py-2" />
          <label><input name="attivo" type="checkbox" defaultChecked={row.active} /> Attivo</label>
          <label><input name="visibile" type="checkbox" defaultChecked={row.visible} /> Visibile</label>
          <button className="rounded-full bg-cocoa px-4 py-2 text-cream" type="submit">Salva</button>
        </form>
      ))}
      <form action={save} className="grid gap-2 rounded-3xl border border-dashed border-rose p-4">
        <h2 className="font-display text-3xl">Nuovo trattamento</h2>
        <input name="nome" placeholder="Nome" required className="rounded-2xl border border-line px-3 py-2" />
        <textarea name="descrizione" placeholder="Descrizione" required className="rounded-2xl border border-line px-3 py-2" />
        <input name="durata" type="number" defaultValue={empty.durataMinuti} className="rounded-2xl border border-line px-3 py-2" />
        <input name="preparazione" type="number" defaultValue={0} className="rounded-2xl border border-line px-3 py-2" />
        <input name="intervallo" type="number" defaultValue={0} className="rounded-2xl border border-line px-3 py-2" />
        <input name="ordine" type="number" defaultValue={10} className="rounded-2xl border border-line px-3 py-2" />
        <input name="prezzo" placeholder="Prezzo in euro, vuoto se da concordare" className="rounded-2xl border border-line px-3 py-2" />
        <input name="colore" defaultValue="#E8B4B8" className="rounded-2xl border border-line px-3 py-2" />
        <label><input name="attivo" type="checkbox" defaultChecked /> Attivo</label>
        <label><input name="visibile" type="checkbox" defaultChecked /> Visibile</label>
        <button className="rounded-full bg-cocoa px-4 py-2 text-cream" type="submit">Aggiungi</button>
      </form>
    </section>
  );
}
