import { NextResponse } from "next/server";
import { CITY, POSTAL_CODE } from "@/lib/validators";

/**
 * Suggerimenti delle vie di Brindisi mentre si scrive l'indirizzo.
 * Usa Photon (OpenStreetMap, gratuito): la richiesta parte dal nostro server con solo il testo digitato.
 */
const BRINDISI_BBOX = "17.85,40.57,18.05,40.70";

type Feature = { properties?: { name?: string; street?: string; postcode?: string; city?: string } };

export async function GET(request: Request) {
  const q = (new URL(request.url).searchParams.get("q") ?? "").trim().slice(0, 80);
  // Il numero civico non serve per cercare la via.
  const street = q.replace(/[\s,]+\d+[a-zA-Z]?\s*$/, "").trim();
  if (street.length < 3) return NextResponse.json({ vie: [] });
  try {
    const url = `https://photon.komoot.io/api/?q=${encodeURIComponent(`${street} ${CITY}`)}&limit=12&layer=street&bbox=${BRINDISI_BBOX}`;
    const response = await fetch(url, {
      headers: { "user-agent": "vc-hair-studio (prenotazioni salone)" },
      signal: AbortSignal.timeout(4000),
      next: { revalidate: 86_400 },
    });
    if (!response.ok) return NextResponse.json({ vie: [] });
    const body = (await response.json()) as { features?: Feature[] };
    const names = new Set<string>();
    for (const feature of body.features ?? []) {
      const props = feature.properties ?? {};
      const inBrindisi = props.postcode === POSTAL_CODE || props.city === CITY;
      const name = (props.name || props.street || "").trim();
      if (inBrindisi && name) names.add(name);
      if (names.size >= 6) break;
    }
    return NextResponse.json({ vie: [...names] });
  } catch {
    return NextResponse.json({ vie: [] });
  }
}
