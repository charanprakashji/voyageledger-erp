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

    const accounts = await prisma.chartOfAccount.findMany({
      where: { isActive: true },
      select: {
        id: true,
        code: true,
        name: true,
        accountType: true,
        description: true,
      },
      orderBy: { code: "asc" },
    });
    return NextResponse.json(accounts);
  } catch (err: any) {
    console.error("Error in GET /api/chart-of-accounts:", err);
    return NextResponse.json(
      { error: "An unexpected server error occurred." },
      { status: 500 }
    );
  }
}
