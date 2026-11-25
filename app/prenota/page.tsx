import { Suspense } from "react";
import { BookingWizard } from "@/components/booking/booking-wizard";

export default function BookingPage() {
  return (
    <Suspense fallback={<div className="app-screen h-80 animate-pulse rounded-[28px] bg-white" />}>
      <BookingWizard />
    </Suspense>
  );
}
