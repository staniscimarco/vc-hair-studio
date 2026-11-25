"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

export function SiteFooter() {
  const pathname = usePathname();
  if (pathname.startsWith("/admin")) return null;
  return (
    <footer className="mx-auto mt-16 flex w-full max-w-5xl flex-col gap-3 px-4 pb-28 text-sm text-ink/70 sm:flex-row sm:justify-between">
      <p>VC Hair Studio · Il pagamento si effettua in salone.</p>
      <nav className="flex gap-4">
        <Link href="/privacy">Informativa sulla privacy</Link>
        <Link href="/condizioni">Condizioni di prenotazione</Link>
      </nav>
    </footer>
  );
}
