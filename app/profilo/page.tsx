"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { createBrowserSupabase } from "@/lib/supabase/browser";
import { profileSchema } from "@/lib/validators";

export default function ProfilePage() {
  const router = useRouter();
  const [profile, setProfile] = useState({ nome: "", cognome: "", telefono: "", email: "" });

  useEffect(() => {
    const supabase = createBrowserSupabase();
    if (!supabase) return;
    void supabase.auth.getUser().then(async ({ data }) => {
      if (!data.user) {
        router.push("/accesso?prossimo=/profilo");
        return;
      }
      const row = await supabase.from("profiles").select("first_name, last_name, phone, email").eq("id", data.user.id).single();
      setProfile({
        nome: row.data?.first_name ?? "",
        cognome: row.data?.last_name ?? "",
        telefono: row.data?.phone ?? "",
        email: row.data?.email ?? data.user.email ?? "",
      });
    });
  }, [router]);

  async function save(formData: FormData) {
    const supabase = createBrowserSupabase();
    if (!supabase) return;
    const parsed = profileSchema.safeParse({
      nome: formData.get("nome"),
      cognome: formData.get("cognome"),
      telefono: formData.get("telefono"),
    });
    if (!parsed.success) {
      toast.error(parsed.error.issues[0]?.message ?? "Controlla i dati.");
      return;
    }
    const { data } = await supabase.auth.getUser();
    if (!data.user) return;
    const { error } = await supabase
      .from("profiles")
      .update({ first_name: parsed.data.nome, last_name: parsed.data.cognome, phone: parsed.data.telefono })
      .eq("id", data.user.id);
    if (error) toast.error("Non è stato possibile aggiornare il profilo.");
    else toast.success("Profilo aggiornato.");
  }

  async function changePassword(formData: FormData) {
    const supabase = createBrowserSupabase();
    if (!supabase) return;
    const { error } = await supabase.auth.updateUser({ password: String(formData.get("password") ?? "") });
    if (error) toast.error("Non è stato possibile aggiornare la parola d'ordine.");
    else toast.success("Parola d'ordine aggiornata.");
  }

  async function requestDeletion() {
    const supabase = createBrowserSupabase();
    if (!supabase) return;
    const { data } = await supabase.auth.getUser();
    if (!data.user) return;
    const { error } = await supabase.from("profiles").update({ deletion_requested_at: new Date().toISOString() }).eq("id", data.user.id);
    if (error) toast.error("Non è stato possibile registrare la richiesta.");
    else toast.success("Richiesta di cancellazione registrata. Il salone la prenderà in carico.");
  }

  return (
    <section className="mx-auto grid max-w-xl gap-8 px-4 py-8">
      <h1 className="font-display text-5xl text-cocoa">Profilo personale</h1>
      <form action={save} className="grid gap-3 rounded-3xl bg-white p-5 shadow-[var(--shadow)]">
        <label className="grid gap-1 text-sm">Nome<input name="nome" defaultValue={profile.nome} key={profile.nome} className="rounded-2xl border border-line px-3 py-3" /></label>
        <label className="grid gap-1 text-sm">Cognome<input name="cognome" defaultValue={profile.cognome} key={profile.cognome} className="rounded-2xl border border-line px-3 py-3" /></label>
        <label className="grid gap-1 text-sm">Telefono<input name="telefono" defaultValue={profile.telefono} key={profile.telefono} className="rounded-2xl border border-line px-3 py-3" /></label>
        <p className="text-sm">E-mail: {profile.email}</p>
        <button className="rounded-full bg-cocoa px-4 py-3 text-cream" type="submit">Salva profilo</button>
      </form>
      <form action={changePassword} className="grid gap-3 rounded-3xl bg-white p-5">
        <label className="grid gap-1 text-sm">Nuova parola d&apos;ordine<input name="password" type="password" minLength={8} className="rounded-2xl border border-line px-3 py-3" required /></label>
        <button className="rounded-full border border-cocoa px-4 py-3" type="submit">Aggiorna parola d&apos;ordine</button>
      </form>
      <div className="flex flex-wrap gap-3 text-sm">
        <a className="underline" href="/api/profilo/esporta">Esporta i miei dati</a>
        <button className="underline" type="button" onClick={() => void requestDeletion()}>Richiedi la cancellazione dell&apos;account</button>
        <button
          className="underline"
          type="button"
          onClick={async () => {
            await createBrowserSupabase()?.auth.signOut();
            router.push("/");
            router.refresh();
          }}
        >
          Esci
        </button>
      </div>
    </section>
  );
}
