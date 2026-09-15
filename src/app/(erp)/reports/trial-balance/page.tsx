import React from "react";
import { getTrialBalance } from "@/lib/financialReports";
import { Scale, CheckCircle, AlertTriangle, ArrowLeft } from "lucide-react";
import Link from "next/link";

export const dynamic = "force-dynamic";

export default async function TrialBalancePage() {
  const report = await getTrialBalance();

  return (
    <div className="max-w-6xl mx-auto space-y-6">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <Link
              href="/reports"
              className="p-2 rounded-lg border border-slate-300 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800"
            >
              <ArrowLeft className="w-4 h-4" />
            </Link>
            <div>
              <h2 className="text-xl font-bold text-slate-900 dark:text-white">General Ledger Trial Balance</h2>
              <p className="text-sm text-slate-500">As of {report.asOfDate} • Base Currency: AFN</p>
            </div>
          </div>

          <div>
            {report.isBalanced ? (
              <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800 text-xs font-semibold">
                <CheckCircle className="w-4 h-4" /> Trial Balance is Equal & Balanced
              </span>
            ) : (
              <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-rose-50 text-rose-700 dark:bg-rose-950/40 dark:text-rose-300 border border-rose-200 dark:border-rose-800 text-xs font-semibold">
                <AlertTriangle className="w-4 h-4" /> Discrepancy Detected
              </span>
            )}
          </div>
        </div>

        <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 shadow-sm overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="bg-slate-50 dark:bg-slate-950/60 text-slate-600 dark:text-slate-400 text-xs font-semibold uppercase tracking-wider border-b border-slate-200 dark:border-slate-800">
                <tr>
                  <th className="px-6 py-4">Account Code</th>
                  <th className="px-6 py-4">Account Name</th>
                  <th className="px-6 py-4">Category</th>
                  <th className="px-6 py-4 text-right">Debit Balance (AFN)</th>
                  <th className="px-6 py-4 text-right">Credit Balance (AFN)</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200 dark:divide-slate-800 font-mono text-xs">
                {report.rows.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="px-6 py-12 text-center text-slate-500 font-sans">
                      No posted journal transactions found in the General Ledger.
                    </td>
                  </tr>
                ) : (
                  report.rows.map((row) => (
                    <tr key={row.accountId} className="hover:bg-slate-50/70 dark:hover:bg-slate-800/40">
                      <td className="px-6 py-3 font-semibold text-blue-600 dark:text-blue-400">
                        {row.accountCode}
                      </td>
                      <td className="px-6 py-3 font-sans text-slate-900 dark:text-white font-medium">
                        {row.accountName}
                      </td>
                      <td className="px-6 py-3 font-sans text-slate-500 text-[11px]">
                        {row.category} ({row.accountType})
                      </td>
                      <td className="px-6 py-3 text-right font-medium">
                        {Number(row.netDebit) > 0 ? Number(row.netDebit).toLocaleString("en-US", { minimumFractionDigits: 2 }) : "-"}
                      </td>
                      <td className="px-6 py-3 text-right font-medium">
                        {Number(row.netCredit) > 0 ? Number(row.netCredit).toLocaleString("en-US", { minimumFractionDigits: 2 }) : "-"}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
              <tfoot className="bg-slate-50/80 dark:bg-slate-950/80 border-t-2 border-slate-300 dark:border-slate-700 font-mono text-xs font-bold text-slate-900 dark:text-white">
                <tr>
                  <td colSpan={3} className="px-6 py-4 font-sans uppercase">
                    Grand Total
                  </td>
                  <td className="px-6 py-4 text-right text-blue-600 dark:text-blue-400 text-sm">
                    AFN {Number(report.totalDebit).toLocaleString("en-US", { minimumFractionDigits: 2 })}
                  </td>
                  <td className="px-6 py-4 text-right text-blue-600 dark:text-blue-400 text-sm">
                    AFN {Number(report.totalCredit).toLocaleString("en-US", { minimumFractionDigits: 2 })}
                  </td>
                </tr>
              </tfoot>
            </table>
          </div>
        </div>
      </div>
  );
}
