import { createAdminSupabase } from "@/lib/supabase/admin";
import { adminAuthEmail, adminPassword, adminUsername } from "@/lib/supabase/env";
import { ensureDatabase, withDatabase } from "@/lib/server/schema";

export function isAdminIdentifier(value: string): boolean {
  const user = adminUsername();
  return Boolean(user) && value.trim().toLowerCase() === user?.toLowerCase();
}

async function findUserId(email: string): Promise<string | null> {
  try {
    return await withDatabase(async (client) => {
      const found = await client.query("select id from auth.users where lower(email) = lower($1) limit 1", [email]);
      return (found.rows[0]?.id as string | undefined) ?? null;
    });
  } catch {
    const admin = createAdminSupabase();
    if (!admin) return null;
    const listed = await admin.auth.admin.listUsers({ page: 1, perPage: 200 });
    return listed.data.users.find((user) => user.email?.toLowerCase() === email.toLowerCase())?.id ?? null;
  }
}

async function promote(id: string) {
  const apply = async () => {
    await withDatabase((client) =>
      client.query(
        `update public.profiles
         set role = 'admin',
             first_name = case when first_name = '' then 'Amministratore' else first_name end
         where id = $1`,
        [id],
      ),
    );
  };
  try {
    await apply();
  } catch {
    const admin = createAdminSupabase();
    if (!admin) throw new Error("promozione assente");
    const { error } = await admin.from("profiles").update({ role: "admin", first_name: "Amministratore" }).eq("id", id);
    if (error) throw error;
  }
}

export async function prepareAdminLogin(password: string): Promise<{ ok: true; email: string } | { ok: false; status: number; errore: string }> {
  const email = adminAuthEmail();
  const expected = adminPassword();
  if (!email || expected === undefined) {
    return { ok: false, status: 503, errore: "L'accesso amministratore non è ancora configurato." };
  }
  await ensureDatabase();
  const admin = createAdminSupabase();
  if (!admin) return { ok: false, status: 503, errore: "L'accesso non è ancora configurato." };

  const existing = await findUserId(email);
  if (!existing) {
    if (password !== expected) return { ok: false, status: 401, errore: "E-mail o parola d'ordine non corrette." };
    const created = await admin.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: { first_name: "Amministratore", last_name: "Salone" },
    });
    if (created.error || !created.data.user) {
      return { ok: false, status: 500, errore: "Non è stato possibile preparare l'amministratore." };
    }
    await promote(created.data.user.id);
    return { ok: true, email };
  }

  if (password === expected) {
    const updated = await admin.auth.admin.updateUserById(existing, { password, email_confirm: true });
    if (updated.error) return { ok: false, status: 500, errore: "Non è stato possibile preparare l'amministratore." };
  }
  await promote(existing);
  return { ok: true, email };
}
