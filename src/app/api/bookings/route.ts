import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth";

export async function GET() {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json(
        { error: "UNAUTHORIZED: Authentication required." },
        { status: 401 }
      );
    }

    const bookings = await prisma.booking.findMany({
      select: {
        id: true,
        bookingNumber: true,
        customer: { select: { name: true } },
      },
      orderBy: { createdAt: "desc" },
      take: 100,
    });
    return NextResponse.json(bookings);
  } catch (err: any) {
    console.error("Error in GET /api/bookings:", err);
    return NextResponse.json(
      { error: "An unexpected server error occurred." },
      { status: 500 }
    );
  }
}
