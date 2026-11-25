"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const items = [
  { href: "/admin", label: "Panoramica" },
  { href: "/admin/calendario", label: "Calendario" },
  { href: "/admin/appuntamenti", label: "Appuntamenti" },
  { href: "/admin/clienti", label: "Clienti" },
  { href: "/admin/servizi", label: "Servizi" },
  { href: "/admin/disponibilita", label: "Disponibilità" },
  { href: "/admin/notifiche", label: "Notifiche" },
  { href: "/admin/impostazioni", label: "Impostazioni" },
];

export function AdminShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  return (
    <div className="mx-auto grid min-h-screen max-w-6xl md:grid-cols-[220px_1fr]">
      <aside className="hidden border-r border-line p-4 md:block">
        <p className="font-display text-3xl text-cocoa">Agenda</p>
        <nav className="mt-6 grid gap-1">
          {items.map((item) => (
            <Link key={item.href} href={item.href} className={`rounded-2xl px-3 py-2 ${pathname === item.href ? "bg-cocoa text-cream" : "hover:bg-blush-soft"}`}>
              {item.label}
            </Link>
          ))}
        </nav>
      </aside>
      <div className="px-4 py-6 pb-28">{children}</div>
      <nav className="fixed inset-x-0 bottom-0 z-30 grid grid-cols-5 border-t border-line bg-white/95 text-center text-xs md:hidden">
        {items.slice(0, 4).map((item) => (
          <Link key={item.href} href={item.href} className="px-1 py-3">{item.label}</Link>
        ))}
        <Link href="/admin/impostazioni" className="px-1 py-3">Altro</Link>
      </nav>
    </div>
  );
}
