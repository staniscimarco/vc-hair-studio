"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { CalendarDays, House, Sparkles, UserRound } from "lucide-react";

const items = [
  { href: "/", label: "Home", icon: House },
  { href: "/prenota", label: "Prenota", icon: Sparkles },
  { href: "/i-miei-appuntamenti", label: "Appuntamenti", icon: CalendarDays },
  { href: "/profilo", label: "Profilo", icon: UserRound },
];

export function CustomerTabBar() {
  const pathname = usePathname();
  if (pathname.startsWith("/admin")) return null;
  return (
    <nav className="tabbar" aria-label="Navigazione">
      {items.map((item) => {
        const current = item.href === "/" ? pathname === "/" : pathname.startsWith(item.href);
        const Icon = item.icon;
        return (
          <Link key={item.href} href={item.href} aria-current={current ? "page" : undefined}>
            <Icon size={18} strokeWidth={1.75} />
            {item.label}
          </Link>
        );
      })}
    </nav>
  );
}
