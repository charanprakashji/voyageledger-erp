import React from "react";
import { notFound } from "next/navigation";
import prisma from "@/lib/prisma";
import { getBookingById } from "@/app/actions/bookings";
import { BookingForm } from "@/components/bookings/BookingForm";
import { Header } from "@/components/layout/Header";

export const dynamic = "force-dynamic";

interface BookingEditPageProps {
  params: Promise<{ id: string }>;
}

export default async function BookingEditPage({ params }: BookingEditPageProps) {
  const { id } = await params;

  const [bookingRes, customerList, supplierList, userList, settings] = await Promise.all([
    getBookingById(id),
    prisma.customer.findMany({
      where: { isActive: true },
      select: { id: true, name: true, code: true, companyName: true, defaultCurrency: true },
      orderBy: { name: "asc" },
    }),
    prisma.supplier.findMany({
      where: { isActive: true },
      select: { id: true, name: true, code: true, type: true, currency: true },
      orderBy: { name: "asc" },
    }),
    prisma.user.findMany({
      where: { status: "ACTIVE" },
      select: { id: true, name: true, email: true, role: true },
      orderBy: { name: "asc" },
    }),
    prisma.companySetting.findFirst({
      select: { supportedCurrencies: true },
    }),
  ]);

  if (!bookingRes.success || !bookingRes.data) {
    notFound();
  }

  const currencies = settings?.supportedCurrencies?.length
    ? settings.supportedCurrencies
    : ["AFN", "USD", "EUR", "AED", "GBP"];

  return (
    <div>
      <Header title={`Edit Booking ${bookingRes.data.bookingNumber}`} userRole="ADMIN" />
      <div className="p-8">
        <BookingForm
          initialData={bookingRes.data}
          customers={customerList}
          suppliers={supplierList}
          employees={userList}
          defaultCurrencies={currencies}
        />
      </div>
    </div>
  );
}
