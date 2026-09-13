import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

export async function GET() {
  const startTime = Date.now();
  let dbStatus = "UNKNOWN";
  let dbLatencyMs = -1;
  let tableStats: Record<string, number> = {};
  let errorMessage: string | null = null;

  try {
    // 1. Basic raw query ping
    const pingStart = Date.now();
    await prisma.$queryRaw`SELECT 1 as ping`;
    dbLatencyMs = Date.now() - pingStart;
    dbStatus = "CONNECTED";

    // 2. Query basic non-sensitive counts to verify schema tables exist
    const [
      userCount,
      accountCount,
      periodCount,
      bookingCount,
      invoiceCount,
      journalCount,
    ] = await Promise.all([
      prisma.user.count().catch(() => -1),
      prisma.chartOfAccount.count().catch(() => -1),
      prisma.accountingPeriod.count().catch(() => -1),
      prisma.booking.count().catch(() => -1),
      prisma.invoice.count().catch(() => -1),
      prisma.journalEntry.count().catch(() => -1),
    ]);

    tableStats = {
      users: userCount,
      chartOfAccounts: accountCount,
      accountingPeriods: periodCount,
      bookings: bookingCount,
      invoices: invoiceCount,
      journalEntries: journalCount,
    };
  } catch (err: any) {
    dbStatus = "DISCONNECTED";
    errorMessage = err.message || "Failed to connect to database";
  }

  const totalTimeMs = Date.now() - startTime;
  const isHealthy = dbStatus === "CONNECTED" && errorMessage === null;

  // Explicitly report application environment via APP_ENV (e.g. 'staging', 'development', 'production')
  // Do NOT assume production merely because NODE_ENV=production is used for Next.js build
  const currentAppEnv =
    process.env.APP_ENV ||
    (process.env.NODE_ENV === "production" ? "production" : "development");

  const responsePayload = {
    status: isHealthy ? "HEALTHY" : "UNHEALTHY",
    timestamp: new Date().toISOString(),
    environment: currentAppEnv,
    nodeEnv: process.env.NODE_ENV || "development",
    uptimeSeconds: Math.floor(process.uptime()),
    database: {
      status: dbStatus,
      latencyMs: dbLatencyMs,
      provider: "postgresql",
      error: errorMessage,
      tableCounts: tableStats,
    },
    localization: {
      baseCurrency: process.env.NEXT_PUBLIC_DEFAULT_CURRENCY || "AFN",
      country: process.env.NEXT_PUBLIC_DEFAULT_COUNTRY || "Afghanistan",
    },
    totalResponseTimeMs: totalTimeMs,
  };

  return NextResponse.json(responsePayload, {
    status: isHealthy ? 200 : 503,
  });
}
