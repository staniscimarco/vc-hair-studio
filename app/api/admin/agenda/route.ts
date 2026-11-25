import { NextResponse } from "next/server";
import { z } from "zod";
import { sameOrigin } from "@/lib/security/http";
import { createManualBooking, rescheduleAppointment } from "@/lib/server/bookings";
import { jsonError, requireAdmin } from "@/lib/server/guard";
import { loadService } from "@/lib/server/schedule";

export async function GET(request: Request) {
  try {
    const { admin } = await requireAdmin();
    const url = new URL(request.url);
    const from = url.searchParams.get("da");
    const to = url.searchParams.get("a");
    if (!from || !to) return NextResponse.json({ errore: "Intervallo non valido." }, { status: 400 });
    const [appointments, blocks] = await Promise.all([
      admin
        .from("appointments")
        .select("id, code, starts_at, ends_at, status, price_cents, amount_paid_cents, payment_status, payment_method, notes, source, customers(first_name, last_name, phone), services(name, color)")
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
  stato: z.enum(["confirmed", "in_progress", "completed", "cancelled", "no_show"]).optional(),
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
    if (parsed.data.inizio) {
      await rescheduleAppointment({
        appointmentId: parsed.data.id,
        actorId: user.id,
        asStaff: true,
        start: new Date(parsed.data.inizio),
      });
    }
    const update: Record<string, unknown> = {};
    if (parsed.data.stato) update.status = parsed.data.stato;
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
