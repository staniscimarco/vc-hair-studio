import { NextResponse, type NextRequest } from "next/server";
import { createServerClient } from "@supabase/ssr";
import { safeNext } from "@/lib/security/http";
import { supabasePublishableKey, supabaseUrl } from "@/lib/supabase/env";

export async function proxy(request: NextRequest) {
  // Se Supabase rimanda alla pagina iniziale con il codice di Google (Site URL), completa comunque l'accesso.
  const oauthCode = request.nextUrl.searchParams.get("code");
  if (oauthCode && request.nextUrl.pathname !== "/auth/callback" && !request.nextUrl.pathname.startsWith("/api")) {
    const callback = request.nextUrl.clone();
    callback.pathname = "/auth/callback";
    callback.search = "";
    callback.searchParams.set("code", oauthCode);
    callback.searchParams.set("next", safeNext(request.nextUrl.searchParams.get("next") ?? request.nextUrl.pathname, "/"));
    return NextResponse.redirect(callback);
  }
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
