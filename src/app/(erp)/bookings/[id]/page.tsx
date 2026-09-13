import React from "react";
import { notFound } from "next/navigation";
import { getBookingById } from "@/app/actions/bookings";
import { BookingDetailView } from "@/components/bookings/BookingDetailView";
import { Header } from "@/components/layout/Header";

export const dynamic = "force-dynamic";

interface BookingPageProps {
  params: Promise<{ id: string }>;
}

export default async function BookingDetailPage({ params }: BookingPageProps) {
  const { id } = await params;
  const res = await getBookingById(id);

  if (!res.success || !res.data) {
    notFound();
  }

  return (
    <div>
      <Header title={`Booking File ${res.data.bookingNumber}`} userRole="ADMIN" />
      <div className="p-8">
        <BookingDetailView booking={res.data} />
      </div>
    </div>
  );
}
