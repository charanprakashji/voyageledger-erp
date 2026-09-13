import React from "react";
import { getBalanceSheet } from "@/lib/financialReports";
import { Header } from "@/components/layout/Header";
import { Landmark, ArrowLeft, CheckCircle, AlertTriangle } from "lucide-react";
import Link from "next/link";

export const dynamic = "force-dynamic";

export default async function BalanceSheetPage() {
  const report = await getBalanceSheet();

  return (
    <div>
      <Header title="Balance Sheet" userRole="ADMIN" />
      <div className="p-8 max-w-5xl mx-auto space-y-6">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <Link
              href="/reports"
              className="p-2 rounded-lg border border-slate-300 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800"
            >
              <ArrowLeft className="w-4 h-4" />
            </Link>
            <div>
              <h2 className="text-xl font-bold text-slate-900 dark:text-white">Statement of Financial Position</h2>
              <p className="text-sm text-slate-500">As of {report.asOfDate} • Base Currency: AFN</p>
            </div>
          </div>

          <div>
            {report.isBalanced ? (
              <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800 text-xs font-semibold">
                <CheckCircle className="w-4 h-4" /> Balanced: Assets = Liabilities + Equity
              </span>
            ) : (
              <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-rose-50 text-rose-700 dark:bg-rose-950/40 dark:text-rose-300 border border-rose-200 dark:border-rose-800 text-xs font-semibold">
                <AlertTriangle className="w-4 h-4" /> Discrepancy: AFN {report.discrepancy}
              </span>
            )}
          </div>
        </div>

        {/* Summary Balance Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="bg-white dark:bg-slate-900 p-6 rounded-xl border border-slate-200 dark:border-slate-800">
            <span className="text-xs uppercase text-slate-400 font-semibold block">Total Assets</span>
            <p className="text-2xl font-bold font-mono text-blue-600 mt-1">
              AFN {Number(report.totalAssets).toLocaleString("en-US", { minimumFractionDigits: 2 })}
            </p>
          </div>
          <div className="bg-white dark:bg-slate-900 p-6 rounded-xl border border-slate-200 dark:border-slate-800">
            <span className="text-xs uppercase text-slate-400 font-semibold block">Total Liabilities & Equity</span>
            <p className="text-2xl font-bold font-mono text-indigo-600 mt-1">
              AFN {Number(report.totalLiabilitiesAndEquity).toLocaleString("en-US", { minimumFractionDigits: 2 })}
            </p>
          </div>
        </div>

        {/* Assets Section */}
        <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 shadow-sm p-6 space-y-4">
          <h3 className="text-base font-bold text-slate-900 dark:text-white uppercase tracking-wider pb-2 border-b border-slate-200 dark:border-slate-800">
            ASSETS
          </h3>

          <div className="space-y-4">
            <div>
              <p className="text-xs font-semibold uppercase text-slate-400 mb-2">Current Assets (1xxx)</p>
              <div className="divide-y divide-slate-100 dark:divide-slate-800/60">
                {report.currentAssets.map((a) => (
                  <div key={a.accountCode} className="flex justify-between py-2 text-xs">
                    <span className="text-slate-700 dark:text-slate-300">
                      {a.accountCode} - {a.accountName}
                    </span>
                    <span className="font-mono font-medium">{Number(a.amount).toFixed(2)}</span>
                  </div>
                ))}
              </div>
            </div>

            <div className="flex justify-between items-center p-3 bg-slate-50 dark:bg-slate-800/50 rounded-lg text-sm font-bold">
              <span>TOTAL ASSETS</span>
              <span className="font-mono text-blue-600 dark:text-blue-400">
                AFN {Number(report.totalAssets).toFixed(2)}
              </span>
            </div>
          </div>
        </div>

        {/* Liabilities & Equity Section */}
        <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 shadow-sm p-6 space-y-6">
          <h3 className="text-base font-bold text-slate-900 dark:text-white uppercase tracking-wider pb-2 border-b border-slate-200 dark:border-slate-800">
            LIABILITIES & EQUITY
          </h3>

          <div className="space-y-4">
            <div>
              <p className="text-xs font-semibold uppercase text-slate-400 mb-2">Current Liabilities (2xxx)</p>
              <div className="divide-y divide-slate-100 dark:divide-slate-800/60">
                {report.currentLiabilities.length === 0 ? (
                  <p className="text-xs text-slate-400 py-2">No current liabilities recorded</p>
                ) : (
                  report.currentLiabilities.map((l) => (
                    <div key={l.accountCode} className="flex justify-between py-2 text-xs">
                      <span className="text-slate-700 dark:text-slate-300">
                        {l.accountCode} - {l.accountName}
                      </span>
                      <span className="font-mono font-medium">{Number(l.amount).toFixed(2)}</span>
                    </div>
                  ))
                )}
              </div>
              <div className="flex justify-between py-2 text-xs font-bold border-t border-slate-200 dark:border-slate-800">
                <span>Total Liabilities</span>
                <span className="font-mono">{Number(report.totalLiabilities).toFixed(2)}</span>
              </div>
            </div>

            <div>
              <p className="text-xs font-semibold uppercase text-slate-400 mb-2">Equity & Retained Earnings (3xxx)</p>
              <div className="divide-y divide-slate-100 dark:divide-slate-800/60">
                {report.equity.map((e) => (
                  <div key={e.accountCode} className="flex justify-between py-2 text-xs">
                    <span className="text-slate-700 dark:text-slate-300">
                      {e.accountCode} - {e.accountName}
                    </span>
                    <span className="font-mono font-medium">{Number(e.amount).toFixed(2)}</span>
                  </div>
                ))}
                <div className="flex justify-between py-2 text-xs">
                  <span className="text-slate-700 dark:text-slate-300 font-medium">
                    Current Period Operating Profit / (Loss)
                  </span>
                  <span className="font-mono font-semibold text-emerald-600">
                    {Number(report.currentPeriodProfit).toFixed(2)}
                  </span>
                </div>
              </div>
              <div className="flex justify-between py-2 text-xs font-bold border-t border-slate-200 dark:border-slate-800">
                <span>Total Equity</span>
                <span className="font-mono">{Number(report.totalEquity).toFixed(2)}</span>
              </div>
            </div>

            <div className="flex justify-between items-center p-3 bg-slate-50 dark:bg-slate-800/50 rounded-lg text-sm font-bold">
              <span>TOTAL LIABILITIES & EQUITY</span>
              <span className="font-mono text-indigo-600 dark:text-indigo-400">
                AFN {Number(report.totalLiabilitiesAndEquity).toFixed(2)}
              </span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
