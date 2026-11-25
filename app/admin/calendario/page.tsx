import { Suspense } from "react";
import { SalonCalendar } from "@/components/admin/salon-calendar";

export default async function CalendarPage({ searchParams }: { searchParams: Promise<{ date?: string; appointment?: string }> }) {
  const params = await searchParams;
  return (
    <section>
      <h1 className="mb-4 font-display text-5xl text-cocoa">Calendario</h1>
      <Suspense fallback={<div className="h-96 animate-pulse rounded-3xl bg-blush-soft" />}>
        <SalonCalendar focusDate={params.date} focusId={params.appointment} />
      </Suspense>
    </section>
  );
}
