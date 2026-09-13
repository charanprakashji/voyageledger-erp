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

    const suppliers = await prisma.supplier.findMany({
      where: { isActive: true },
      select: { id: true, name: true, code: true, currency: true },
      orderBy: { name: "asc" },
    });
    return NextResponse.json(suppliers);
  } catch (err: any) {
    console.error("Error in GET /api/suppliers:", err);
    return NextResponse.json(
      { error: "An unexpected server error occurred." },
      { status: 500 }
    );
  }
}
