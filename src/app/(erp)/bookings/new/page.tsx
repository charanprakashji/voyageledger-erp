import React from "react";
import prisma from "@/lib/prisma";
import { BookingForm } from "@/components/bookings/BookingForm";
import { Header } from "@/components/layout/Header";

export const dynamic = "force-dynamic";

export default async function NewBookingPage() {
  let customers: any[] = [];
  let suppliers: any[] = [];
  let employees: any[] = [];
  let currencies = ["AFN", "USD", "EUR", "AED", "GBP"];

  try {
    const [customerList, supplierList, userList, settings] = await Promise.all([
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

    customers = customerList;
    suppliers = supplierList;
    employees = userList;
    if (settings?.supportedCurrencies?.length) {
      currencies = settings.supportedCurrencies;
    }
  } catch (err) {
    console.error("Error loading new booking dependencies:", err);
  }

  return (
    <div>
      <Header title="New Travel Booking" userRole="ADMIN" />
      <div className="p-8">
        <BookingForm
          customers={customers}
          suppliers={suppliers}
          employees={employees}
          defaultCurrencies={currencies}
        />
      </div>
    </div>
  );
}
