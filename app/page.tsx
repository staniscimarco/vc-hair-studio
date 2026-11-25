import { Suspense } from "react";
import { BookingWizard } from "@/components/booking/booking-wizard";

export default function HomePage() {
  return (
    <Suspense fallback={<div className="mx-auto h-80 max-w-5xl animate-pulse px-4" />}>
      <BookingWizard />
    </Suspense>
  );
}
