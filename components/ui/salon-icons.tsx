import type { SVGProps } from "react";

/**
 * Icone da parrucchiera disegnate su griglia 24×24, a tratto, nello stesso stile delle icone Lucide
 * (colore = currentColor), così si possono usare ovunque al posto di quelle generiche.
 */
export type SalonIconProps = Omit<SVGProps<SVGSVGElement>, "strokeWidth"> & { size?: number; strokeWidth?: number };

function Base({ size = 24, strokeWidth = 1.8, children, ...rest }: SalonIconProps) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={strokeWidth}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
      {...rest}
    >
      {children}
    </svg>
  );
}

/** Phon: piega. */
export function HairDryerIcon(props: SalonIconProps) {
  return (
    <Base {...props}>
      <path d="M2.5 8a5 5 0 0 1 5-5H14a2 2 0 0 1 2 2v6a2 2 0 0 1-2 2H7.5a5 5 0 0 1-5-5Z" />
      <circle cx="7.5" cy="8" r="2" />
      <path d="M16 5.5h3.2a1 1 0 0 1 1 1v3a1 1 0 0 1-1 1H16" />
      <path d="M9 13l1.1 7.2a1.4 1.4 0 0 0 1.4 1.3h.9a1.4 1.4 0 0 0 1.4-1.6L12.8 13" />
      <path d="M22 5.2v0M22.6 8v0M22 10.8v0" strokeWidth={2.4} />
    </Base>
  );
}

/** Forbici e pettine: taglio. */
export function ScissorsCombIcon(props: SalonIconProps) {
  return (
    <Base {...props}>
      <circle cx="4.6" cy="6.6" r="2.4" />
      <circle cx="4.6" cy="17.4" r="2.4" />
      <path d="M6.4 8.2 14 16.8" />
      <path d="M6.4 15.8 14 7.2" />
      <path d="M17 2.5h3.2a.8.8 0 0 1 .8.8v17.4a.8.8 0 0 1-.8.8H17Z" />
      <path d="M17 6h-1.6M17 9h-1.6M17 12h-1.6M17 15h-1.6M17 18h-1.6" />
    </Base>
  );
}

/** Ciotola e pennello: colore. */
export function HairColorIcon(props: SalonIconProps) {
  return (
    <Base {...props}>
      <path d="M2.5 12.5h13a6.5 6.5 0 0 1-13 0Z" />
      <path d="M5 15.4c1.4.9 2.8.9 4.2 0s2.8-.9 4.2 0" />
      <path d="M7 21.5h4" />
      <path d="M13.2 10.2 20.8 2.6" />
      <path d="M10.8 12.5 9.6 11.3a1 1 0 0 1 0-1.4l1.6-1.6a1 1 0 0 1 1.4 0l1.2 1.2" />
    </Base>
  );
}

/** Phon con goccia di colore: colore e piega. */
export function ColorBlowIcon(props: SalonIconProps) {
  return (
    <Base {...props}>
      <path d="M2 6.5A4 4 0 0 1 6 2.5h5a1.6 1.6 0 0 1 1.6 1.6v4.8A1.6 1.6 0 0 1 11 10.5H6a4 4 0 0 1-4-4Z" />
      <circle cx="6" cy="6.5" r="1.5" />
      <path d="M12.6 4.4h2.2a.8.8 0 0 1 .8.8v2.6a.8.8 0 0 1-.8.8h-2.2" />
      <path d="M7.2 10.5l.9 5.6a1.2 1.2 0 0 0 1.2 1h.5a1.2 1.2 0 0 0 1.2-1.4l-.8-5.2" />
      <path d="M18.5 11.5c-1.9 2.4-2.9 4.1-2.9 5.5a2.9 2.9 0 0 0 5.8 0c0-1.4-1-3.1-2.9-5.5Z" />
    </Base>
  );
}

/** Flacone e gocce: trattamenti. */
export function TreatmentIcon(props: SalonIconProps) {
  return (
    <Base {...props}>
      <path d="M9 2.5h4M10 2.5v3M12 2.5v3" />
      <path d="M8.5 8a2.5 2.5 0 0 1 2.5-2.5h0A2.5 2.5 0 0 1 13.5 8v0a3 3 0 0 1 2 2.8V19a2.5 2.5 0 0 1-2.5 2.5H9A2.5 2.5 0 0 1 6.5 19v-8.2a3 3 0 0 1 2-2.8Z" />
      <path d="M6.5 13h9" />
      <path d="M19.5 4.5c-.9 1.2-1.4 2-1.4 2.7a1.4 1.4 0 0 0 2.8 0c0-.7-.5-1.5-1.4-2.7Z" />
    </Base>
  );
}

/** Ciocca ondulata: acconciature, permanente e servizi generici. */
export function HairLockIcon(props: SalonIconProps) {
  return (
    <Base {...props}>
      <path d="M8 2.5c-3 3-3 6 0 9s3 6 0 9.5" />
      <path d="M12.5 2.5c-3 3-3 6 0 9s3 6 0 9.5" />
      <path d="M17 2.5c-3 3-3 6 0 9s3 6 0 9.5" />
    </Base>
  );
}
