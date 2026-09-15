import React from "react";
import { getProfitAndLoss } from "@/lib/financialReports";
import { TrendingUp, ArrowLeft, DollarSign } from "lucide-react";
import Link from "next/link";

export const dynamic = "force-dynamic";

export default async function ProfitLossPage() {
  const report = await getProfitAndLoss();

  return (
    <div className="max-w-5xl mx-auto space-y-6">
        <div className="flex items-center gap-3">
          <Link
            href="/reports"
            className="p-2 rounded-lg border border-slate-300 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800"
          >
            <ArrowLeft className="w-4 h-4" />
          </Link>
          <div>
            <h2 className="text-xl font-bold text-slate-900 dark:text-white">Income Statement (P&L)</h2>
            <p className="text-sm text-slate-500">Period: {report.fromDate} to {report.toDate} • Base Currency: AFN</p>
          </div>
        </div>

        {/* Executive Summary Cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="bg-white dark:bg-slate-900 p-6 rounded-xl border border-slate-200 dark:border-slate-800">
            <span className="text-xs uppercase text-slate-400 font-semibold block">Total Revenue</span>
            <p className="text-2xl font-bold font-mono text-emerald-600 mt-1">
              AFN {Number(report.totalOperatingRevenue).toLocaleString("en-US", { minimumFractionDigits: 2 })}
            </p>
          </div>
          <div className="bg-white dark:bg-slate-900 p-6 rounded-xl border border-slate-200 dark:border-slate-800">
            <span className="text-xs uppercase text-slate-400 font-semibold block">Gross Profit</span>
            <p className="text-2xl font-bold font-mono text-blue-600 mt-1">
              AFN {Number(report.grossProfit).toLocaleString("en-US", { minimumFractionDigits: 2 })}
            </p>
            <p className="text-xs text-slate-500 mt-1">Margin: {report.grossMarginPercentage}%</p>
          </div>
          <div className="bg-white dark:bg-slate-900 p-6 rounded-xl border border-slate-200 dark:border-slate-800">
            <span className="text-xs uppercase text-slate-400 font-semibold block">Net Profit / (Loss)</span>
            <p className={`text-2xl font-bold font-mono mt-1 ${Number(report.netProfit) >= 0 ? "text-emerald-600" : "text-rose-600"}`}>
              AFN {Number(report.netProfit).toLocaleString("en-US", { minimumFractionDigits: 2 })}
            </p>
            <p className="text-xs text-slate-500 mt-1">Net Margin: {report.netProfitPercentage}%</p>
          </div>
        </div>

        {/* Detailed Breakdown */}
        <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 shadow-sm p-6 space-y-6">
          {/* Operating Revenue Section */}
          <div>
            <div className="flex justify-between items-center pb-2 border-b border-slate-200 dark:border-slate-800 font-bold text-sm text-slate-900 dark:text-white">
              <span>Operating Revenue (4xxx)</span>
              <span className="font-mono text-emerald-600">AFN {Number(report.totalOperatingRevenue).toFixed(2)}</span>
            </div>
            <div className="divide-y divide-slate-100 dark:divide-slate-800/60 py-2">
              {report.operatingRevenue.length === 0 ? (
                <p className="text-xs text-slate-400 py-2">No operating revenues recorded</p>
              ) : (
                report.operatingRevenue.map((item) => (
                  <div key={item.accountCode} className="flex justify-between py-2 text-xs">
                    <span className="text-slate-700 dark:text-slate-300">
                      {item.accountCode} - {item.accountName}
                    </span>
                    <span className="font-mono">{Number(item.amount).toFixed(2)}</span>
                  </div>
                ))
              )}
            </div>
          </div>

          {/* Direct Costs Section */}
          <div>
            <div className="flex justify-between items-center pb-2 border-b border-slate-200 dark:border-slate-800 font-bold text-sm text-slate-900 dark:text-white">
              <span>Direct Service Costs (Cost of Sales 5xxx)</span>
              <span className="font-mono text-rose-600">(AFN {Number(report.totalDirectCosts).toFixed(2)})</span>
            </div>
            <div className="divide-y divide-slate-100 dark:divide-slate-800/60 py-2">
              {report.directCosts.length === 0 ? (
                <p className="text-xs text-slate-400 py-2">No direct service costs recorded</p>
              ) : (
                report.directCosts.map((item) => (
                  <div key={item.accountCode} className="flex justify-between py-2 text-xs">
                    <span className="text-slate-700 dark:text-slate-300">
                      {item.accountCode} - {item.accountName}
                    </span>
                    <span className="font-mono">{Number(item.amount).toFixed(2)}</span>
                  </div>
                ))
              )}
            </div>
          </div>

          {/* Gross Profit Bar */}
          <div className="flex justify-between items-center p-3 bg-blue-50/50 dark:bg-blue-950/20 rounded-lg text-sm font-bold text-blue-900 dark:text-blue-200">
            <span>GROSS PROFIT</span>
            <span className="font-mono">AFN {Number(report.grossProfit).toFixed(2)}</span>
          </div>

          {/* Operating Expenses Section */}
          <div>
            <div className="flex justify-between items-center pb-2 border-b border-slate-200 dark:border-slate-800 font-bold text-sm text-slate-900 dark:text-white">
              <span>Operating & Administrative Expenses (6xxx)</span>
              <span className="font-mono text-rose-600">(AFN {Number(report.totalOperatingExpenses).toFixed(2)})</span>
            </div>
            <div className="divide-y divide-slate-100 dark:divide-slate-800/60 py-2">
              {report.operatingExpenses.length === 0 ? (
                <p className="text-xs text-slate-400 py-2">No operating expenses recorded</p>
              ) : (
                report.operatingExpenses.map((item) => (
                  <div key={item.accountCode} className="flex justify-between py-2 text-xs">
                    <span className="text-slate-700 dark:text-slate-300">
                      {item.accountCode} - {item.accountName}
                    </span>
                    <span className="font-mono">{Number(item.amount).toFixed(2)}</span>
                  </div>
                ))
              )}
            </div>
          </div>

          {/* Other Income & FX Gain/Loss */}
          {report.otherIncomeExpense.length > 0 && (
            <div>
              <div className="flex justify-between items-center pb-2 border-b border-slate-200 dark:border-slate-800 font-bold text-sm text-slate-900 dark:text-white">
                <span>Other Income & Realized FX (7xxx / 8xxx)</span>
                <span className="font-mono">AFN {Number(report.totalOtherIncomeExpense).toFixed(2)}</span>
              </div>
              <div className="divide-y divide-slate-100 dark:divide-slate-800/60 py-2">
                {report.otherIncomeExpense.map((item) => (
                  <div key={item.accountCode} className="flex justify-between py-2 text-xs">
                    <span className="text-slate-700 dark:text-slate-300">
                      {item.accountCode} - {item.accountName}
                    </span>
                    <span className="font-mono">{Number(item.amount).toFixed(2)}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Net Profit Summary */}
          <div className="flex justify-between items-center p-4 bg-slate-100 dark:bg-slate-800 rounded-xl text-base font-bold text-slate-900 dark:text-white border-t-2 border-slate-300 dark:border-slate-700">
            <span>NET PROFIT / (LOSS)</span>
            <span className={`font-mono text-lg ${Number(report.netProfit) >= 0 ? "text-emerald-600" : "text-rose-600"}`}>
              AFN {Number(report.netProfit).toFixed(2)}
            </span>
          </div>
        </div>
      </div>
  );
}
