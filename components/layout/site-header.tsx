"use client";

import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";

type Session = { autenticato: boolean; ruolo: "customer" | "admin" | null; nome: string };

export function SiteHeader() {
  const pathname = usePathname();
  const [session, setSession] = useState<Session | null>(null);
  useEffect(() => {
    void fetch("/api/sessione")
      .then((response) => response.json())
      .then(setSession)
      .catch(() => setSession({ autenticato: false, ruolo: null, nome: "" }));
  }, [pathname]);

  if (pathname.startsWith("/admin")) return null;

  return (
    <header className="mx-auto flex w-full max-w-5xl items-center justify-between gap-4 px-4 py-4">
      <Link href="/" className="flex items-center gap-3">
        <Image src="/brand/vale.png" alt="VC Hair Studio" width={72} height={72} priority unoptimized />
        <span className="font-display text-2xl leading-none text-cocoa">VC Hair Studio</span>
      </Link>
      <nav className="flex items-center gap-2 text-sm">
        {session?.ruolo === "admin" ? (
          <Link className="rounded-full px-3 py-2 hover:bg-blush-soft" href="/admin/calendario">
            Agenda
          </Link>
        ) : null}
        <Link className="rounded-full px-3 py-2 hover:bg-blush-soft" href="/i-miei-appuntamenti">
          I miei appuntamenti
        </Link>
        {session?.autenticato ? (
          <Link className="rounded-full bg-cocoa px-4 py-2 text-cream" href="/profilo">
            Profilo
          </Link>
        ) : (
          <Link className="rounded-full bg-cocoa px-4 py-2 text-cream" href="/accesso">
            Accedi
          </Link>
        )}
      </nav>
    </header>
  );
}
