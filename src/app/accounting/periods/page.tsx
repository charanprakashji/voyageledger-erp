import React from "react";
import { getAccountingPeriods } from "@/app/actions/periods";
import { CalendarDays } from "lucide-react";
import { PeriodsClient } from "./PeriodsClient";

export const dynamic = "force-dynamic";

export default async function AccountingPeriodsPage() {
  let periods: any[] = [];
  try {
    periods = await getAccountingPeriods();
  } catch (err) {
    // Database connection not initialized yet during pre-rendering
    periods = [];
  }

  return (
    <div className="space-y-6 max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1">
            <CalendarDays className="w-4 h-4 text-blue-600" />
            <span>General Ledger</span>
          </div>
          <h1 className="text-2xl font-bold text-slate-900 dark:text-white tracking-tight">
            Accounting Periods
          </h1>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
            Manage reporting windows and period locking. Financial journal postings are rejected in locked periods.
          </p>
        </div>
      </div>

      <PeriodsClient initialPeriods={periods} />
    </div>
  );
}
