import { NextResponse } from "next/server";
import { isAllowedPushEndpoint, sameOrigin } from "@/lib/security/http";
import { jsonError, requireAdmin } from "@/lib/server/guard";
import { sendNotification, setVapidDetails } from "web-push";

export async function GET() {
  try {
    const { admin, user } = await requireAdmin();
    const [devices, history] = await Promise.all([
      admin.from("push_subscriptions").select("id, endpoint, user_agent, created_at, disabled_at, fail_count").eq("profile_id", user.id),
      admin.from("notifications").select("id, title, body, url, read_at, created_at").order("created_at", { ascending: false }).limit(50),
    ]);
    return NextResponse.json({
      dispositivi: devices.data ?? [],
      storico: history.data ?? [],
      vapidConfigurato: Boolean(process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY && process.env.VAPID_PRIVATE_KEY),
      chiavePubblica: process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY ?? "",
    });
  } catch (error) {
    return jsonError(error);
  }
}

export async function POST(request: Request) {
  try {
    if (!sameOrigin(request)) return NextResponse.json({ errore: "Richiesta non consentita." }, { status: 403 });
    const { admin, user } = await requireAdmin();
    const body = await request.json();
    if (body.azione === "prova") {
      const payload = { title: "Prova VC Hair Studio", body: "Le notifiche del salone sono attive.", url: "/admin/calendario" };
      return NextResponse.json(await sendToAdmins(admin, payload));
    }
    if (body.azione === "rimuovi" && body.id) {
      await admin.from("push_subscriptions").delete().eq("id", body.id).eq("profile_id", user.id);
      return NextResponse.json({ ok: true });
    }
    if (body.azione === "letta" && body.id) {
      await admin.from("notifications").update({ read_at: new Date().toISOString() }).eq("id", body.id);
      return NextResponse.json({ ok: true });
    }
    const endpoint = String(body.endpoint ?? "");
    if (!isAllowedPushEndpoint(endpoint) || !body.keys?.p256dh || !body.keys?.auth) {
      return NextResponse.json({ errore: "Sottoscrizione non valida." }, { status: 400 });
    }
    const { error } = await admin.from("push_subscriptions").upsert({
      profile_id: user.id,
      endpoint,
      p256dh: body.keys.p256dh,
      auth_key: body.keys.auth,
      user_agent: request.headers.get("user-agent"),
      disabled_at: null,
    }, { onConflict: "endpoint" });
    if (error) return NextResponse.json({ errore: "Non è stato possibile salvare il dispositivo." }, { status: 500 });
    return NextResponse.json({ ok: true });
  } catch (error) {
    return jsonError(error);
  }
}

async function sendToAdmins(admin: Awaited<ReturnType<typeof requireAdmin>>["admin"], payload: object) {
  if (!process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY || !process.env.VAPID_PRIVATE_KEY || !process.env.VAPID_SUBJECT) {
    return { inviata: false, motivo: "Chiavi di notifica non configurate." };
  }
  setVapidDetails(process.env.VAPID_SUBJECT, process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY, process.env.VAPID_PRIVATE_KEY);
  const { data } = await admin.from("push_subscriptions").select("*").is("disabled_at", null);
  let sent = 0;
  for (const device of data ?? []) {
    try {
      await sendNotification({ endpoint: device.endpoint, keys: { p256dh: device.p256dh, auth: device.auth_key } }, JSON.stringify(payload));
      sent += 1;
      await admin.from("push_subscriptions").update({ last_success_at: new Date().toISOString(), fail_count: 0 }).eq("id", device.id);
    } catch (error) {
      const status = typeof error === "object" && error && "statusCode" in error ? Number(error.statusCode) : 0;
      if (status === 404 || status === 410) {
        await admin.from("push_subscriptions").update({ disabled_at: new Date().toISOString() }).eq("id", device.id);
      }
    }
  }
  return { inviata: sent > 0, dispositivi: sent };
}
