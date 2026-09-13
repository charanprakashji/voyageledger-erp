import React from "react";
import prisma from "@/lib/prisma";
import { getBookings } from "@/app/actions/bookings";
import { BookingListTable } from "@/components/bookings/BookingListTable";
import { Header } from "@/components/layout/Header";

export const dynamic = "force-dynamic";

export default async function BookingsPage() {
  let bookings: any[] = [];
  let pagination = { total: 0, page: 1, limit: 20, totalPages: 0 };
  let customers: any[] = [];
  let suppliers: any[] = [];

  try {
    const [bookingRes, customerList, supplierList] = await Promise.all([
      getBookings({ limit: 50 }),
      prisma.customer.findMany({
        where: { isActive: true },
        select: { id: true, name: true, code: true },
        orderBy: { name: "asc" },
      }),
      prisma.supplier.findMany({
        where: { isActive: true },
        select: { id: true, name: true, type: true },
        orderBy: { name: "asc" },
      }),
    ]);

    if (bookingRes.success) {
      bookings = bookingRes.data;
      pagination = bookingRes.pagination;
    }
    customers = customerList;
    suppliers = supplierList;
  } catch (err) {
    console.error("Error loading bookings page:", err);
  }

  return (
    <div>
      <Header title="Travel Bookings & Operations" userRole="ADMIN" />
      <div className="p-8">
        <BookingListTable
          initialData={bookings}
          pagination={pagination}
          customers={customers}
          suppliers={suppliers}
        />
      </div>
    </div>
  );
}
