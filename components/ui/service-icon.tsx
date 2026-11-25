import { createElement, type ComponentType } from "react";
import {
  ColorBlowIcon,
  HairColorIcon,
  HairDryerIcon,
  HairLockIcon,
  ScissorsCombIcon,
  TreatmentIcon,
  type SalonIconProps,
} from "@/components/ui/salon-icons";

type Icon = ComponentType<SalonIconProps>;

const COLOR = /colo|tint|mech|balay|riflessi|shatush|degrad|schiar/i;
const BLOW = /pieg|brushing|phon|styl/i;

const rules: [(name: string) => boolean, Icon][] = [
  [(name) => COLOR.test(name) && BLOW.test(name), ColorBlowIcon],
  [(name) => /tagli|frang|spunt|scal/i.test(name), ScissorsCombIcon],
  [(name) => COLOR.test(name), HairColorIcon],
  [(name) => BLOW.test(name), HairDryerIcon],
  [(name) => /tratt|masch|cura|ricostr|cheratin|botox|lavagg|shampoo/i.test(name), TreatmentIcon],
];

export function serviceIcon(name: string): Icon {
  return rules.find(([match]) => match(name))?.[1] ?? HairLockIcon;
}

export function ServiceIcon({ name, size = 24, strokeWidth = 1.8 }: { name: string; size?: number; strokeWidth?: number }) {
  return createElement(serviceIcon(name), { size, strokeWidth });
}

/** Illustrazione per le card: sfumatura viola, cerchio bianco con l'icona e strumenti decorativi. */
export function ServiceArt({ name, tone = 0, compact = false }: { name: string; tone?: number; compact?: boolean }) {
  return (
    <span className={`service-art tone-${tone % 4} ${compact ? "is-compact" : ""}`} aria-hidden>
      <span className="art-deco deco-1"><ScissorsCombIcon size={compact ? 14 : 22} strokeWidth={1.6} /></span>
      <span className="art-deco deco-2"><HairDryerIcon size={compact ? 13 : 20} strokeWidth={1.6} /></span>
      <span className="art-deco deco-3"><HairLockIcon size={compact ? 12 : 18} strokeWidth={1.6} /></span>
      <span className="art-circle">
        <ServiceIcon name={name} size={compact ? 26 : 44} strokeWidth={compact ? 1.8 : 1.6} />
      </span>
    </span>
  );
}

export function shortDuration(minutes: number) {
  if (minutes < 60) return `${minutes} min`;
  const hours = Math.floor(minutes / 60);
  const rest = minutes % 60;
  return rest ? `${hours} h ${rest} min` : `${hours} h`;
}
