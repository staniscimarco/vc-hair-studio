import { readFileSync } from "node:fs";
import { join } from "node:path";
import { Client } from "pg";
import { createAdminSupabase } from "@/lib/supabase/admin";

function databaseUrls(): string[] {
  const values = ["POSTGRES_URL_NON_POOLING", "POSTGRES_URL"].flatMap((name) => {
    const value = process.env[name]?.trim();
    if (!value || value === "[SENSITIVE]") return [];
    return [value];
  });
  return values.flatMap((value) => {
    const relaxed = value
      .replace(/([?&])sslmode=[^&]*/g, "$1")
      .replace(/[?&]$/, "");
    const joiner = relaxed.includes("?") ? "&" : "?";
    const direct = `${relaxed}${joiner}uselibpqcompat=true&sslmode=require`;
    const session = direct.replace(":6543", ":5432");
    return session === direct ? [direct] : [session, direct];
  });
}

function safeDetail(error: unknown): string {
  const message = error instanceof Error ? error.message : "errore";
  return message.replace(/postgres(?:ql)?:\/\/\S+/gi, "[database]").slice(0, 180);
}

async function connect(): Promise<Client> {
  const urls = databaseUrls();
  let last: unknown;
  for (const connectionString of urls) {
    const client = new Client({ connectionString, ssl: { rejectUnauthorized: false } });
    try {
      await client.connect();
      return client;
    } catch (error) {
      last = error;
      console.error("schema-connessione", safeDetail(error));
      await client.end().catch(() => undefined);
    }
  }
  throw last ?? new Error("connessione assente");
}

export async function withDatabase<T>(run: (client: Client) => Promise<T>): Promise<T> {
  const client = await connect();
  try {
    return await run(client);
  } finally {
    await client.end().catch(() => undefined);
  }
}

let ready: Promise<void> | null = null;

export function ensureDatabase(): Promise<void> {
  if (databaseUrls().length === 0) return Promise.resolve();
  ready ??= applyIfNeeded().catch((error: unknown) => {
    ready = null;
    console.error("schema", safeDetail(error));
    throw new Error("Non è stato possibile preparare l'archivio del salone.");
  });
  return ready;
}

async function schemaAlreadyPresent(): Promise<boolean> {
  const admin = createAdminSupabase();
  if (!admin) return false;
  const probe = await admin.from("services").select("id").limit(1);
  if (!probe.error) return true;
  const missing = probe.error.code === "PGRST205" || probe.error.code === "42P01" || /schema cache|does not exist|Could not find the table/i.test(probe.error.message);
  if (!missing) throw new Error(safeDetail(probe.error));
  return false;
}

async function applyIfNeeded() {
  if (!(await schemaAlreadyPresent())) await applyBase();
  await applyExtras();
}

/** Migrazioni aggiuntive, applicate in ordine e registrate in public.schema_migrations. */
const EXTRA_MIGRATIONS = ["0002_promozioni_notifiche.sql", "0003_notifiche_anonime.sql", "0004_centro_notifiche.sql", "0005_approvazione_clienti.sql"];

async function pendingExtras(): Promise<string[]> {
  const admin = createAdminSupabase();
  if (!admin) return [];
  const { data, error } = await admin.from("schema_migrations").select("name");
  if (error) return EXTRA_MIGRATIONS;
  const done = new Set((data ?? []).map((row) => String(row.name)));
  return EXTRA_MIGRATIONS.filter((name) => !done.has(name));
}

/** Tutte le migrazioni aggiuntive sono idempotenti: rieseguirle non ha effetti collaterali. */
async function applyExtras() {
  const pending = await pendingExtras();
  if (!pending.length) return;
  await withDatabase(async (client) => {
    await client.query("select pg_advisory_lock(8042002)");
    try {
      await client.query(`
        create table if not exists public.schema_migrations (
          name text primary key,
          applied_at timestamptz not null default now()
        );
        alter table public.schema_migrations enable row level security;
      `);
      for (const name of pending) {
        const sql = readFileSync(join(process.cwd(), "supabase/migrations", name), "utf8");
        await client.query(sql);
        await client.query("insert into public.schema_migrations (name) values ($1) on conflict do nothing", [name]);
      }
      await client.query("notify pgrst, 'reload schema'");
    } finally {
      await client.query("select pg_advisory_unlock(8042002)");
    }
  });
}

async function applyBase() {
  await withDatabase(async (client) => {
    await client.query("select pg_advisory_lock(8042001)");
    try {
      const found = await client.query("select to_regclass('public.services') as name");
      if (found.rows[0]?.name) return;
      const partial = await client.query("select to_regclass('public.profiles') as name");
      if (partial.rows[0]?.name) {
        await client.query(`
          drop trigger if exists on_auth_user_created on auth.users;
          drop table if exists
            public.app_errors,
            public.rate_limits,
            public.audit_logs,
            public.email_logs,
            public.notification_outbox,
            public.notifications,
            public.push_subscriptions,
            public.appointment_history,
            public.occupancy,
            public.appointments,
            public.blocked_slots,
            public.availability_exceptions,
            public.recurrence_rules,
            public.working_hours,
            public.services,
            public.salon_settings,
            public.customers,
            public.profiles
          cascade
        `);
      }
      const sql = readFileSync(join(process.cwd(), "supabase/migrations/0001_init.sql"), "utf8");
      await client.query(sql);
      await client.query("notify pgrst, 'reload schema'");
    } finally {
      await client.query("select pg_advisory_unlock(8042001)");
    }
  });
}
