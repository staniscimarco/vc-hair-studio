import "server-only";
import { romeDate } from "@/lib/availability/time";
import { createAdminSupabase } from "@/lib/supabase/admin";

export type Promotion = {
  id: string;
  titolo: string;
  sottotitolo: string;
  badge: string;
  sconto: number;
  servizi: string[];
  dal: string;
  al: string;
  attiva: boolean;
};

export function mapPromotion(row: Record<string, unknown>): Promotion {
  return {
    id: String(row.id),
    titolo: String(row.title ?? ""),
    sottotitolo: String(row.subtitle ?? ""),
    badge: String(row.badge ?? ""),
    sconto: Number(row.discount_percent ?? 0),
    servizi: (row.service_ids as string[] | null) ?? [],
    dal: String(row.starts_on),
    al: String(row.ends_on),
    attiva: Boolean(row.active),
  };
}

/** La promozione in corso oggi (la più vantaggiosa), oppure null. Non fallisce se la tabella manca. */
export async function currentPromotion(today = romeDate(new Date())): Promise<Promotion | null> {
  const admin = createAdminSupabase();
  if (!admin) return null;
  const { data, error } = await admin
    .from("promotions")
    .select("*")
    .eq("active", true)
    .lte("starts_on", today)
    .gte("ends_on", today)
    .order("discount_percent", { ascending: false })
    .limit(1);
  if (error || !data?.length) return null;
  return mapPromotion(data[0]);
}

export function promotionApplies(promo: Promotion | null, serviceId: string) {
  return Boolean(promo && promo.sconto > 0 && (promo.servizi.length === 0 || promo.servizi.includes(serviceId)));
}

export function discountedPrice(cents: number | null, percent: number) {
  if (cents == null || percent <= 0) return cents;
  return Math.round((cents * (100 - percent)) / 100);
}
