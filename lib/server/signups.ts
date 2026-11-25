import "server-only";
import { createAdminSupabase } from "@/lib/supabase/admin";
import { dispatchNow } from "@/lib/server/dispatch";
import { sendToSubscriptions } from "@/lib/server/push";

/**
 * Approvazione delle nuove registrazioni (contro lo spam).
 * Se la colonna approved_at non esiste ancora (migrazione non applicata) tutti risultano approvati.
 */
export async function isApproved(userId: string): Promise<boolean> {
  const admin = createAdminSupabase();
  if (!admin) return true;
  const { data, error } = await admin.from("profiles").select("role, approved_at").eq("id", userId).maybeSingle();
  if (error || !data) return true;
  const row = data as { role?: string; approved_at?: string | null };
  return row.role === "admin" || Boolean(row.approved_at);
}

/** Avvisa l'amministratrice delle nuove registrazioni non ancora segnalate (una volta sola per persona). */
export async function notifyPendingSignups() {
  const admin = createAdminSupabase();
  if (!admin) return 0;
  const { data, error } = await admin
    .from("profiles")
    .select("id, first_name, last_name, email")
    .eq("role", "customer")
    .is("approved_at", null)
    .is("signup_notified_at", null)
    .limit(20);
  if (error || !data?.length) return 0;
  for (const row of data) {
    // Segna subito come segnalata: due richieste in parallelo non generano doppioni.
    const claimed = await admin
      .from("profiles")
      .update({ signup_notified_at: new Date().toISOString() })
      .eq("id", row.id)
      .is("signup_notified_at", null)
      .select("id")
      .maybeSingle();
    if (!claimed.data) continue;
    const name = `${row.first_name ?? ""} ${row.last_name ?? ""}`.trim() || "Nuova cliente";
    const payload = {
      title: "Nuova registrazione",
      body: `${name}${row.email ? ` (${row.email})` : ""} vuole registrarsi. Tocca per approvare o eliminare.`,
      url: signupUrl(row.id),
      tag: `registrazione-${row.id}`,
    };
    const notice = await admin
      .from("notifications")
      .insert({ event: "signup", title: payload.title, body: payload.body, url: payload.url })
      .select("id")
      .single();
    if (notice.data) {
      await admin.from("notification_outbox").insert({ notification_id: notice.data.id, payload, status: "pending" });
    }
  }
  await dispatchNow();
  return data.length;
}

function signupUrl(profileId: string) {
  return `/admin/clienti?stato=attesa&profilo=${profileId}`;
}

/** La notifica di registrazione all'amministratrice risulta gestita (letta). */
async function markSignupHandled(profileId: string) {
  const admin = createAdminSupabase();
  if (!admin) return;
  await admin.from("notifications").update({ read_at: new Date().toISOString() }).eq("event", "signup").eq("url", signupUrl(profileId)).is("read_at", null);
}

/** Approva la cliente: da ora può prenotare. Riceve una notifica nel suo centro e sul telefono. */
export async function approveProfile(profileId: string): Promise<{ ok: boolean; dispositivi: number }> {
  const admin = createAdminSupabase();
  if (!admin) return { ok: false, dispositivi: 0 };
  const { data, error } = await admin
    .from("profiles")
    .update({ approved_at: new Date().toISOString() })
    .eq("id", profileId)
    .is("approved_at", null)
    .select("id")
    .maybeSingle();
  if (error || !data) return { ok: false, dispositivi: 0 };
  const payload = {
    title: "Il tuo profilo è attivo ✨",
    body: "Benvenuta da VC Hair Studio! Ora puoi prenotare il tuo appuntamento quando vuoi.",
    url: "/prenota",
  };
  await admin.from("customer_notifications").insert({ profile_id: profileId, ...payload });
  const devices = await admin.from("push_subscriptions").select("id, endpoint, p256dh, auth_key").eq("profile_id", profileId).is("disabled_at", null);
  const sent = await sendToSubscriptions(admin, devices.data ?? [], { ...payload, tag: `profilo-${profileId}` });
  // Anche un'e-mail: arriva pure a chi non ha attivato le notifiche.
  const profile = await admin.from("profiles").select("email").eq("id", profileId).maybeSingle();
  if (profile.data?.email) {
    await admin.from("email_logs").insert({
      kind: "profilo_approvato",
      to_email: profile.data.email,
      subject: "Il tuo profilo VC Hair Studio è attivo: ora puoi prenotare",
      status: "pending",
      dedupe_key: `approvato:${profileId}`,
    });
    await dispatchNow();
  }
  await markSignupHandled(profileId);
  return { ok: true, dispositivi: sent };
}

/**
 * Elimina una registrazione: cancella l'accesso (anche quello creato con Google) e la scheda cliente.
 * La persona potrà registrarsi di nuovo da zero. Non elimina chi ha già appuntamenti.
 */
export async function deleteRegistration(customerId: string): Promise<{ ok: boolean; errore?: string }> {
  const admin = createAdminSupabase();
  if (!admin) return { ok: false, errore: "Il salone non è ancora collegato." };
  const customer = await admin.from("customers").select("id, profile_id").eq("id", customerId).maybeSingle();
  if (!customer.data) return { ok: false, errore: "Cliente non trovata." };
  const appointments = await admin.from("appointments").select("id", { count: "exact", head: true }).eq("customer_id", customerId);
  if ((appointments.count ?? 0) > 0) {
    return { ok: false, errore: "Ha già degli appuntamenti: usa Archivia o Anonimizza invece di eliminarla." };
  }
  const profileId = customer.data.profile_id as string | null;
  if (profileId) {
    const profile = await admin.from("profiles").select("role").eq("id", profileId).maybeSingle();
    if (profile.data?.role === "admin") return { ok: false, errore: "Non si può eliminare un amministratore da qui." };
    await markSignupHandled(profileId);
    await admin.from("customer_notifications").delete().eq("profile_id", profileId);
    await admin.from("push_subscriptions").delete().eq("profile_id", profileId);
  }
  const removed = await admin.from("customers").delete().eq("id", customerId);
  if (removed.error) return { ok: false, errore: "Non è stato possibile eliminare la scheda." };
  if (profileId) {
    // Cancella l'utente di autenticazione (e le identità Google collegate): il profilo sparisce a cascata.
    const { error } = await admin.auth.admin.deleteUser(profileId);
    if (error) return { ok: false, errore: "Scheda eliminata, ma non è stato possibile cancellare l'accesso." };
  }
  return { ok: true };
}
