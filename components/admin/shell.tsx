"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import { Bell, CalendarDays, House, Plus, Settings, Users } from "lucide-react";

const items = [
  { href: "/admin", label: "Home", icon: House },
  { href: "/admin/calendario", label: "Calendario", icon: CalendarDays },
  { href: "/admin/clienti", label: "Clienti", icon: Users },
  { href: "/admin/notifiche", label: "Notifiche", icon: Bell },
  { href: "/admin/impostazioni", label: "Impostazioni", icon: Settings },
];

export function AdminShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  return (
    <div className="app-screen">
      {children}
      <button className="fab" type="button" aria-label="Azioni rapide" onClick={() => setOpen(true)}>
        <Plus />
      </button>
      {open ? (
        <>
          <button className="sheet-scrim" type="button" aria-label="Chiudi azioni" onClick={() => setOpen(false)} />
          <div className="sheet-panel" role="dialog" aria-label="Azioni rapide">
            <div className="sheet-handle" />
            <p className="field-caption">Azioni rapide</p>
            <div className="mt-3 grid gap-2">
              <Link className="service-card" href="/admin/appuntamenti" onClick={() => setOpen(false)}>Nuovo appuntamento</Link>
              <Link className="service-card" href="/admin/disponibilita" onClick={() => setOpen(false)}>Blocca disponibilità</Link>
              <Link className="service-card" href="/admin/servizi" onClick={() => setOpen(false)}>Trattamenti</Link>
            </div>
          </div>
        </>
      ) : null}
      <nav className="tabbar" aria-label="Navigazione amministratore">
        {items.map((item) => {
          const current = item.href === "/admin" ? pathname === "/admin" : pathname.startsWith(item.href);
          const Icon = item.icon;
          return (
            <Link key={item.href} href={item.href} aria-current={current ? "page" : undefined}>
              <Icon size={18} strokeWidth={1.75} />
              {item.label}
            </Link>
          );
        })}
      </nav>
    </div>
  );
}
