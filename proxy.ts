import { NextResponse, type NextRequest } from "next/server";
import { createServerClient } from "@supabase/ssr";
import { safeNext } from "@/lib/security/http";
import { supabasePublishableKey, supabaseUrl } from "@/lib/supabase/env";

export async function proxy(request: NextRequest) {
  const url = supabaseUrl();
  const key = supabasePublishableKey();
  if (!url || !key) return NextResponse.next();

  let response = NextResponse.next({ request });
  const supabase = createServerClient(url, key, {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesToSet) {
        cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
        response = NextResponse.next({ request });
        cookiesToSet.forEach(({ name, value, options }) => response.cookies.set(name, value, options));
      },
    },
  });
  const { data } = await supabase.auth.getUser();
  if (request.nextUrl.pathname.startsWith("/admin") && !data.user) {
    const redirectUrl = request.nextUrl.clone();
    redirectUrl.pathname = "/accesso";
    redirectUrl.searchParams.set("prossimo", safeNext(`${request.nextUrl.pathname}${request.nextUrl.search}`));
    return NextResponse.redirect(redirectUrl);
  }
  return response;
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|brand|icons|sw.js|offline.html|.*\\.(?:png|svg|ico|css|js)$).*)"],
};
