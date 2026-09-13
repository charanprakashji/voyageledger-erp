import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";

export async function GET() {
  try {
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
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
