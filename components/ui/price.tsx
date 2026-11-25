import { formatPrice } from "@/lib/format";

export type PublicPromo = {
  titolo: string;
  sottotitolo: string;
  badge: string;
  sconto: number;
  servizi: string[];
  al: string;
};

export function promoFor(promo: PublicPromo | null | undefined, serviceId: string) {
  if (!promo || promo.sconto <= 0) return null;
  return promo.servizi.length === 0 || promo.servizi.includes(serviceId) ? promo : null;
}

export function applyDiscount(cents: number | null, percent: number) {
  if (cents == null) return null;
  return Math.round((cents * (100 - percent)) / 100);
}

/** Prezzo con eventuale sconto: prezzo pieno barrato e prezzo promozionale in evidenza. */
export function Price({ cents, promo, serviceId, className = "" }: { cents: number | null; promo?: PublicPromo | null; serviceId: string; className?: string }) {
  if (cents == null) return <span className={className}>Da concordare</span>;
  const active = promoFor(promo, serviceId);
  if (!active) return <span className={className}>{formatPrice(cents)}</span>;
  return (
    <span className={`price-promo ${className}`}>
      <s>{formatPrice(cents)}</s>
      <strong>{formatPrice(applyDiscount(cents, active.sconto))}</strong>
    </span>
  );
}
