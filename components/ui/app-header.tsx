"use client";

import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowLeft, ChevronsRight, Search, SlidersHorizontal } from "lucide-react";
import type { ReactNode } from "react";

/** Saluto in base all'ora del giorno, come "Good Morning" nel riferimento. */
export function greeting(date = new Date()) {
  const hour = date.getHours();
  if (hour < 13) return "Buongiorno";
  if (hour < 18) return "Buon pomeriggio";
  return "Buonasera";
}

export function todayLabel(date = new Date()) {
  return new Intl.DateTimeFormat("it-IT", { weekday: "long", day: "numeric", month: "long", year: "numeric" }).format(date);
}

/** Header viola con avatar, saluto e pulsanti circolari (schermata Home). */
export function GreetingHero({
  title,
  subtitle,
  avatar,
  actions,
  children,
}: {
  title: string;
  subtitle?: string;
  avatar?: ReactNode;
  actions?: ReactNode;
  children?: ReactNode;
}) {
  return (
    <header className="hero">
      <div className="hero-row">
        <div className="hero-user">
          <span className="hero-avatar">
            {avatar ?? <Image src="/brand/vale.png" alt="" width={56} height={56} priority unoptimized />}
          </span>
          <div className="hero-greeting">
            <h1>{title}</h1>
            {subtitle ? <p>{subtitle}</p> : null}
          </div>
        </div>
        {actions ? <div className="hero-actions">{actions}</div> : null}
      </div>
      {children}
    </header>
  );
}

/** Header viola con freccia indietro, titolo centrato e azione a destra (schermata Appointment). */
export function TitleHero({
  title,
  back,
  action,
  subtitle,
  children,
}: {
  title: string;
  back?: string | true | (() => void);
  action?: ReactNode;
  subtitle?: string;
  children?: ReactNode;
}) {
  return (
    <header className="hero">
      <div className="hero-title">
        {typeof back === "function" ? (
          <button className="icon-btn is-white" type="button" aria-label="Indietro" onClick={back}>
            <ArrowLeft size={20} strokeWidth={2} />
          </button>
        ) : back ? (
          <BackButton href={back === true ? undefined : back} />
        ) : (
          <span />
        )}
        <h1>{title}</h1>
        {action ?? <span />}
      </div>
      {subtitle ? <p className="hero-sub">{subtitle}</p> : null}
      {children}
    </header>
  );
}

function BackButton({ href }: { href?: string }) {
  const router = useRouter();
  if (href) {
    return (
      <Link className="icon-btn is-white" href={href} aria-label="Indietro">
        <ArrowLeft size={20} strokeWidth={2} />
      </Link>
    );
  }
  return (
    <button className="icon-btn is-white" type="button" aria-label="Indietro" onClick={() => router.back()}>
      <ArrowLeft size={20} strokeWidth={2} />
    </button>
  );
}

export function HeroIconLink({
  href,
  label,
  children,
  tone = "accent",
  dot = false,
}: {
  href: string;
  label: string;
  children: ReactNode;
  tone?: "accent" | "white";
  dot?: boolean;
}) {
  return (
    <Link href={href} aria-label={label} title={label} className={`icon-btn ${tone === "white" ? "is-white" : ""}`}>
      {children}
      {dot ? <span className="dot" aria-hidden /> : null}
    </Link>
  );
}

/** Barra di ricerca bianca con pulsante filtri lilla. */
export function SearchBar({
  placeholder,
  value,
  onChange,
  onSubmit,
  filterHref,
  filterLabel = "Filtri",
}: {
  placeholder: string;
  value: string;
  onChange: (value: string) => void;
  onSubmit?: () => void;
  filterHref?: string;
  filterLabel?: string;
}) {
  return (
    <form
      className="search-row"
      role="search"
      onSubmit={(event) => {
        event.preventDefault();
        onSubmit?.();
      }}
    >
      <label className="search-field">
        <Search size={18} strokeWidth={2} aria-hidden />
        <span className="sr-only">{placeholder}</span>
        <input type="search" value={value} placeholder={placeholder} onChange={(event) => onChange(event.target.value)} />
      </label>
      {filterHref ? (
        <Link className="icon-btn" href={filterHref} aria-label={filterLabel} title={filterLabel} style={{ width: 48, height: 48 }}>
          <SlidersHorizontal size={19} strokeWidth={2} />
        </Link>
      ) : (
        <button className="icon-btn" type="submit" aria-label={filterLabel} title={filterLabel} style={{ width: 48, height: 48 }}>
          <SlidersHorizontal size={19} strokeWidth={2} />
        </button>
      )}
    </form>
  );
}

export function SectionHead({
  title,
  subtitle,
  href,
  linkLabel = "Vedi tutti",
  id,
  action,
}: {
  title: string;
  subtitle?: string;
  href?: string;
  linkLabel?: string;
  id?: string;
  action?: ReactNode;
}) {
  return (
    <div className="section-head">
      <div>
        <h2 id={id}>{title}</h2>
        {subtitle ? <p>{subtitle}</p> : null}
      </div>
      {href ? (
        <Link className="see-all" href={href}>
          {linkLabel} <ChevronsRight size={16} strokeWidth={2.2} />
        </Link>
      ) : null}
      {action}
    </div>
  );
}
