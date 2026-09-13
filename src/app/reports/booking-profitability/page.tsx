import React from "react";
import { getBookingProfitability } from "@/lib/financialReports";
import { Header } from "@/components/layout/Header";
import { PieChart, ArrowLeft, PlaneTakeoff } from "lucide-react";
import Link from "next/link";

export const dynamic = "force-dynamic";

export default async function BookingProfitabilityPage() {
  const reports = await getBookingProfitability();

  return (
    <div>
      <Header title="Booking Profitability Analysis" userRole="ADMIN" />
      <div className="p-8 max-w-6xl mx-auto space-y-6">
        <div className="flex items-center gap-3">
          <Link
            href="/reports"
            className="p-2 rounded-lg border border-slate-300 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800"
          >
            <ArrowLeft className="w-4 h-4" />
          </Link>
          <div>
            <h2 className="text-xl font-bold text-slate-900 dark:text-white">Booking Profitability Report</h2>
            <p className="text-sm text-slate-500">
              Operational gross profit derived directly from posted revenue and direct cost journal lines.
            </p>
          </div>
        </div>

        <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 shadow-sm overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="bg-slate-50 dark:bg-slate-950/60 text-slate-600 dark:text-slate-400 text-xs font-semibold uppercase tracking-wider border-b border-slate-200 dark:border-slate-800">
                <tr>
                  <th className="px-6 py-4">Booking Ref</th>
                  <th className="px-6 py-4">Customer</th>
                  <th className="px-6 py-4">Travel Date</th>
                  <th className="px-6 py-4 text-right">Revenue (AFN)</th>
                  <th className="px-6 py-4 text-right">Direct Cost (AFN)</th>
                  <th className="px-6 py-4 text-right">Gross Profit (AFN)</th>
                  <th className="px-6 py-4 text-right">Margin %</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200 dark:divide-slate-800">
                {reports.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="px-6 py-12 text-center text-slate-500">
                      <PlaneTakeoff className="w-12 h-12 mx-auto text-slate-300 dark:text-slate-700 mb-3" />
                      <p className="text-base font-medium">No posted booking financial transactions found</p>
                    </td>
                  </tr>
                ) : (
                  reports.map((row) => (
                    <tr key={row.bookingId} className="hover:bg-slate-50/70 dark:hover:bg-slate-800/40">
                      <td className="px-6 py-4 font-mono font-semibold text-blue-600 dark:text-blue-400">
                        <Link href={`/bookings/${row.bookingId}`} className="hover:underline">
                          {row.bookingReference}
                        </Link>
                      </td>
                      <td className="px-6 py-4 font-medium text-slate-900 dark:text-white">
                        {row.customerName}
                      </td>
                      <td className="px-6 py-4 text-slate-600 dark:text-slate-300">
                        {row.travelStartDate || "N/A"}
                      </td>
                      <td className="px-6 py-4 text-right font-mono font-medium text-slate-900 dark:text-white">
                        {Number(row.revenue).toLocaleString("en-US", { minimumFractionDigits: 2 })}
                      </td>
                      <td className="px-6 py-4 text-right font-mono font-medium text-rose-600 dark:text-rose-400">
                        {Number(row.directCost).toLocaleString("en-US", { minimumFractionDigits: 2 })}
                      </td>
                      <td className="px-6 py-4 text-right font-mono font-bold text-emerald-600 dark:text-emerald-400">
                        {Number(row.grossProfit).toLocaleString("en-US", { minimumFractionDigits: 2 })}
                      </td>
                      <td className="px-6 py-4 text-right font-mono font-semibold">
                        <span className={`px-2 py-0.5 rounded text-xs ${
                          Number(row.profitMarginPercentage) >= 15
                            ? "bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300"
                            : Number(row.profitMarginPercentage) >= 0
                            ? "bg-amber-50 text-amber-700 dark:bg-amber-950/40 dark:text-amber-300"
                            : "bg-rose-50 text-rose-700 dark:bg-rose-950/40 dark:text-rose-300"
                        }`}>
                          {row.profitMarginPercentage}%
                        </span>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}
