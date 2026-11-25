import { createElement } from "react";
import { Brush, Crown, Droplets, Paintbrush, Scissors, Sparkles, Waves, Wind } from "lucide-react";
import type { LucideIcon } from "lucide-react";

const rules: [RegExp, LucideIcon][] = [
  [/tagli|frang|spunt|scal/i, Scissors],
  [/colo|tint|mech|balay|riflessi|shatush|degrad|schiar/i, Paintbrush],
  [/pieg|brushing|phon|styl/i, Wind],
  [/onde|ricci|perman|boccol/i, Waves],
  [/sposa|acconc|raccolt|cerimon/i, Crown],
  [/tratt|masch|cura|ricostr|cheratin|botox|lavagg|shampoo/i, Droplets],
  [/barb|trucco|make/i, Brush],
];

export function serviceIcon(name: string): LucideIcon {
  return rules.find(([pattern]) => pattern.test(name))?.[1] ?? Sparkles;
}

export function ServiceIcon({ name, size = 24, strokeWidth = 1.9 }: { name: string; size?: number; strokeWidth?: number }) {
  return createElement(serviceIcon(name), { size, strokeWidth, "aria-hidden": true });
}

export function shortDuration(minutes: number) {
  if (minutes < 60) return `${minutes} min`;
  const hours = Math.floor(minutes / 60);
  const rest = minutes % 60;
  return rest ? `${hours} h ${rest} min` : `${hours} h`;
}
