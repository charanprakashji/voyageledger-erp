import React from "react";
import { notFound } from "next/navigation";
import { getBookingById } from "@/app/actions/bookings";
import { BookingDetailView } from "@/components/bookings/BookingDetailView";

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

  return <BookingDetailView booking={res.data} />;
}
