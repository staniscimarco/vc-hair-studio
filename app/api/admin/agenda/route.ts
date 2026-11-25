import { ensureDatabase } from "@/lib/server/schema";
import { NextResponse } from "next/server";
import { z } from "zod";
import { sameOrigin } from "@/lib/security/http";
import { cancelAppointment, createManualBooking, decideAppointment, rescheduleAppointment } from "@/lib/server/bookings";
import { notifyCustomerByAppointment, notifyCustomerProfile } from "@/lib/server/notices";
import { formatDateLong, formatTime } from "@/lib/format";
import { jsonError, requireAdmin } from "@/lib/server/guard";
import { loadService } from "@/lib/server/schedule";

export async function GET(request: Request) {
  try {
    await ensureDatabase().catch(() => undefined);
    const { admin } = await requireAdmin();
    const url = new URL(request.url);
    const from = url.searchParams.get("da");
    const to = url.searchParams.get("a");
    if (!from || !to) return NextResponse.json({ errore: "Intervallo non valido." }, { status: 400 });
    const [appointments, blocks] = await Promise.all([
      admin
        .from("appointments")
        .select("id, code, starts_at, ends_at, status, price_cents, amount_paid_cents, payment_status, payment_method, notes, source, customers(first_name, last_name, phone, address), services(name, color)")
        .lt("starts_at", to)
        .gt("ends_at", from),
      admin.from("blocked_slots").select("id, starts_at, ends_at, reason, notes").lt("starts_at", to).gt("ends_at", from),
    ]);
    return NextResponse.json({ appuntamenti: appointments.data ?? [], blocchi: blocks.data ?? [] });
  } catch (error) {
    return jsonError(error);
  }
}

const createSchema = z.object({
  clienteId: z.string().uuid().nullable(),
  nuovoCliente: z.object({
    nome: z.string().min(2),
    cognome: z.string().min(2),
    email: z.string().optional(),
    telefono: z.string().optional(),
  }).nullable(),
  servizioId: z.string().uuid(),
  inizio: z.string().datetime(),
  durataMinuti: z.number().int().min(15),
  prezzoCentesimi: z.number().int().min(0).nullable(),
  note: z.string().optional(),
});

export async function POST(request: Request) {
  try {
    if (!sameOrigin(request)) return NextResponse.json({ errore: "Richiesta non consentita." }, { status: 403 });
    const { admin, user } = await requireAdmin();
    const parsed = createSchema.safeParse(await request.json());
    if (!parsed.success) return NextResponse.json({ errore: "Controlla i dati dell'appuntamento." }, { status: 400 });
    let customerId = parsed.data.clienteId;
    if (!customerId && parsed.data.nuovoCliente) {
      const created = await admin.from("customers").insert({
        first_name: parsed.data.nuovoCliente.nome,
        last_name: parsed.data.nuovoCliente.cognome,
        email: parsed.data.nuovoCliente.email || null,
        phone: parsed.data.nuovoCliente.telefono || null,
      }).select("id").single();
      if (created.error || !created.data) return NextResponse.json({ errore: "Non è stato possibile creare la scheda cliente." }, { status: 500 });
      customerId = created.data.id;
    }
    if (!customerId) return NextResponse.json({ errore: "Seleziona o crea una cliente." }, { status: 400 });
    const service = await loadService(parsed.data.servizioId);
    const saved = await createManualBooking({
      actorId: user.id,
      customerId,
      service,
      start: new Date(parsed.data.inizio),
      durationMinutes: parsed.data.durataMinuti,
      priceCents: parsed.data.prezzoCentesimi,
      notes: parsed.data.note,
    });
    return NextResponse.json(saved);
  } catch (error) {
    return jsonError(error);
  }
}

const patchSchema = z.object({
  id: z.string().uuid(),
  inizio: z.string().datetime().optional(),
  stato: z.enum(["pending", "confirmed", "in_progress", "completed", "cancelled", "no_show"]).optional(),
  importoPagato: z.number().int().min(0).nullable().optional(),
  metodo: z.enum(["contanti", "carta", "altro"]).nullable().optional(),
  statoPagamento: z.enum(["da_pagare", "pagato", "parziale"]).optional(),
});

export async function PATCH(request: Request) {
  try {
    if (!sameOrigin(request)) return NextResponse.json({ errore: "Richiesta non consentita." }, { status: 403 });
    const { admin, user } = await requireAdmin();
    const parsed = patchSchema.safeParse(await request.json());
    if (!parsed.success) return NextResponse.json({ errore: "Dati non validi." }, { status: 400 });
    const current = await admin.from("appointments").select("status, starts_at, services(name)").eq("id", parsed.data.id).maybeSingle();
    if (!current.data) return NextResponse.json({ errore: "Appuntamento non trovato." }, { status: 404 });
    const serviceName = ((Array.isArray(current.data.services) ? current.data.services[0] : current.data.services) as { name?: string } | null)?.name ?? "Il tuo appuntamento";

    // Da "in attesa" a "confermato" o "annullato": stessa logica di Accetta/Rifiuta, con avviso alla cliente.
    if (current.data.status === "pending" && (parsed.data.stato === "confirmed" || parsed.data.stato === "cancelled") && !parsed.data.inizio) {
      await decideAppointment({ appointmentId: parsed.data.id, actorId: user.id, accept: parsed.data.stato === "confirmed" });
      return NextResponse.json({ ok: true });
    }

    if (parsed.data.inizio) {
      const moved = new Date(parsed.data.inizio);
      await rescheduleAppointment({
        appointmentId: parsed.data.id,
        actorId: user.id,
        asStaff: true,
        start: moved,
      });
      await notifyCustomerByAppointment(parsed.data.id, {
        title: "Appuntamento spostato",
        body: `${serviceName}: ora è ${formatDateLong(moved)} alle ${formatTime(moved)}. Ti aspettiamo!`,
        url: "/i-miei-appuntamenti",
      });
    }
    if (parsed.data.stato === "cancelled" && current.data.status !== "cancelled") {
      await cancelAppointment({ appointmentId: parsed.data.id, actorId: user.id, asStaff: true, reason: "Annullato dal salone" });
      const when = new Date(current.data.starts_at);
      await notifyCustomerByAppointment(parsed.data.id, {
        title: "Appuntamento annullato",
        body: `${serviceName} di ${formatDateLong(when)} alle ${formatTime(when)} è stato annullato dal salone. Scegli un nuovo orario quando vuoi.`,
        url: "/prenota",
      });
    }
    const update: Record<string, unknown> = {};
    if (parsed.data.stato && parsed.data.stato !== "cancelled") update.status = parsed.data.stato;
    if (parsed.data.importoPagato !== undefined) update.amount_paid_cents = parsed.data.importoPagato;
    if (parsed.data.metodo !== undefined) update.payment_method = parsed.data.metodo;
    if (parsed.data.statoPagamento) update.payment_status = parsed.data.statoPagamento;
    if (Object.keys(update).length) {
      const { error } = await admin.from("appointments").update(update).eq("id", parsed.data.id);
      if (error) return NextResponse.json({ errore: "Non è stato possibile aggiornare l'appuntamento." }, { status: 500 });
    }
    return NextResponse.json({ ok: true });
  } catch (error) {
    return jsonError(error);
  }
}

/** Elimina definitivamente un appuntamento (es. inserito per errore). Se era futuro, avvisa la cliente dopo l'eliminazione. */
export async function DELETE(request: Request) {
  try {
    if (!sameOrigin(request)) return NextResponse.json({ errore: "Richiesta non consentita." }, { status: 403 });
    await ensureDatabase().catch(() => undefined);
    const { admin } = await requireAdmin();
    const id = new URL(request.url).searchParams.get("id");
    if (!id) return NextResponse.json({ errore: "Appuntamento non indicato." }, { status: 400 });
    const current = await admin.from("appointments").select("status, starts_at, services(name), customers(profile_id)").eq("id", id).maybeSingle();
    if (!current.data) return NextResponse.json({ errore: "Appuntamento non trovato." }, { status: 404 });

    const { error } = await admin.from("appointments").delete().eq("id", id);
    if (error) {
      console.error("elimina-appuntamento", error.message);
      return NextResponse.json({ errore: "Non è stato possibile eliminare l'appuntamento." }, { status: 500 });
    }

    // Avviso solo a eliminazione riuscita, e solo per appuntamenti futuri non già annullati.
    const when = new Date(current.data.starts_at);
    const customer = (Array.isArray(current.data.customers) ? current.data.customers[0] : current.data.customers) as { profile_id?: string | null } | null;
    if (customer?.profile_id && when.getTime() > Date.now() && current.data.status !== "cancelled") {
      const serviceName = ((Array.isArray(current.data.services) ? current.data.services[0] : current.data.services) as { name?: string } | null)?.name ?? "Il tuo appuntamento";
      await notifyCustomerProfile(customer.profile_id, {
        title: "Appuntamento annullato",
        body: `${serviceName} di ${formatDateLong(when)} alle ${formatTime(when)} è stato annullato dal salone. Scegli un nuovo orario quando vuoi.`,
        url: "/prenota",
      });
    }
    return NextResponse.json({ ok: true });
  } catch (error) {
    return jsonError(error);
  }
}
