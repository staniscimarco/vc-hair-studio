import { Suspense } from "react";
import { CalendarPlus } from "lucide-react";
import { SalonCalendar } from "@/components/admin/salon-calendar";
import { CalendarSubscribe } from "@/components/admin/calendar-subscribe";
import { HeroIconLink, TitleHero } from "@/components/ui/app-header";

export default async function CalendarPage({ searchParams }: { searchParams: Promise<{ date?: string; appointment?: string }> }) {
  const params = await searchParams;
  return (
    <section>
      <TitleHero
        title="Agenda"
        back="/admin"
        subtitle="Trascina un appuntamento per spostarlo, seleziona una fascia libera per inserirne uno."
        action={
          <HeroIconLink href="/admin/appuntamenti" label="Nuovo appuntamento" tone="white">
            <CalendarPlus size={20} strokeWidth={2} />
          </HeroIconLink>
        }
      />
      <div className="mt-5">
        <Suspense fallback={<div className="skeleton h-96" />}>
          <SalonCalendar focusDate={params.date} focusId={params.appointment} />
        </Suspense>
      </div>
      <div className="mt-6 max-w-xl">
        <CalendarSubscribe />
      </div>
    </section>
  );
}
