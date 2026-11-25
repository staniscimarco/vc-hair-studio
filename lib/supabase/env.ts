function read(name: string): string | undefined {
  const value = process.env[name]?.trim();
  if (!value || value === "[SENSITIVE]") return undefined;
  return value;
}

export function supabaseUrl(): string | undefined {
  return read("SUPABASE_URL") ?? read("NEXT_PUBLIC_SUPABASE_URL");
}

export function supabasePublishableKey(): string | undefined {
  return (
    read("SUPABASE_PUBLISHABLE_KEY") ??
    read("NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY") ??
    read("NEXT_PUBLIC_SUPABASE_ANON_KEY") ??
    read("SUPABASE_ANON_KEY")
  );
}

export function supabaseServiceRoleKey(): string | undefined {
  return read("SUPABASE_SERVICE_ROLE_KEY") ?? read("SUPABASE_SECRET_KEY");
}

export function isSupabaseConfigured(): boolean {
  return Boolean(supabaseUrl() && supabasePublishableKey());
}

export function isServiceRoleConfigured(): boolean {
  return Boolean(supabaseUrl() && supabaseServiceRoleKey());
}

export function adminUsername(): string | undefined {
  return read("user_admin") ?? read("USER_ADMIN");
}

export function adminPassword(): string | undefined {
  const value = process.env.password_admin ?? process.env.PASSWORD_ADMIN;
  if (!value || value === "[SENSITIVE]") return undefined;
  return value;
}

export function adminAuthEmail(): string | undefined {
  const user = adminUsername();
  if (!user) return undefined;
  if (user.includes("@")) return user.toLowerCase();
  return `${user.toLowerCase()}@vchair.vercel.app`;
}

export function appUrl(): string {
  return read("NEXT_PUBLIC_APP_URL")?.replace(/\/$/, "") || "http://localhost:3000";
}
