"use client";

import React, { useState, useEffect } from "react";
import { fetchCashBankReport } from "@/app/actions/reports";
import { CashBankReport } from "@/lib/advancedReports";
import { convertToCsv, downloadCsvInBrowser } from "@/lib/exportUtils";

export default function CashBankPage() {
  const [loading, setLoading] = useState(true);
  const [report, setReport] = useState<CashBankReport | null>(null);
  const [error, setError] = useState<string | null>(null);

  const loadReport = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetchCashBankReport();
      if (res.success && res.data) {
        setReport(res.data);
      } else {
        setError(res.error || "Failed to load Cash & Bank report");
      }
    } catch (err: any) {
      setError(err.message || "An unexpected error occurred");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadReport();
  }, []);

  const handleExportCsv = () => {
    if (!report) return;
    const headers = [
      "Account Code",
      "Account Name",
      "Currency",
      "Opening Balance (AFN)",
      "Receipts / Inflows (AFN)",
      "Payments / Outflows (AFN)",
      "Expenses (AFN)",
      "Closing Balance (AFN)",
    ];
    const rows = report.accounts.map((a) => [
      a.accountCode,
      a.accountName,
      a.currency,
      a.openingBalanceBase,
      a.receiptsBase,
      a.paymentsBase,
      a.expensesBase,
      a.closingBalanceBase,
    ]);
    const csv = convertToCsv(headers, rows);
    downloadCsvInBrowser(`cash_bank_report_${report.asOfDate}`, csv);
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-start">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 tracking-tight">
            Cash & Bank Reconciliation Statement
          </h1>
          <p className="text-sm text-slate-500 mt-1">
            Liquidity breakdown across physical cash and corporate bank accounts in Afghanistan.
          </p>
        </div>

        <div className="flex gap-2">
          <button
            onClick={handleExportCsv}
            disabled={!report || loading}
            className="px-4 py-2 text-sm font-medium bg-white text-slate-700 border border-slate-300 rounded hover:bg-slate-50 disabled:opacity-50"
          >
            Export CSV
          </button>
        </div>
      </div>

      {error && (
        <div className="p-4 bg-rose-50 border border-rose-200 rounded text-rose-700 text-sm">
          {error}
        </div>
      )}

      {report && (
        <>
          {/* Liquidity Total Card */}
          <div className="p-6 bg-indigo-900 text-white rounded shadow-sm flex justify-between items-center">
            <div>
              <p className="text-xs font-semibold uppercase tracking-wider text-indigo-200">
                Total Net Liquidity Position (Base AFN)
              </p>
              <p className="text-3xl font-black font-mono mt-1">
                {report.totalCashAndBankBase} AFN
              </p>
            </div>
            <div className="text-right text-xs text-indigo-200">
              <p>As of: {report.asOfDate}</p>
              <p>Derived strictly from GL 1010 & 1020</p>
            </div>
          </div>

          {/* Accounts Breakdown Table */}
          <div className="bg-white rounded border border-slate-200 overflow-hidden">
            <div className="px-6 py-4 border-b border-slate-200 bg-slate-50 font-semibold text-sm text-slate-900">
              Cash & Bank Account Ledger Balances
            </div>
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="border-b border-slate-200 font-semibold text-slate-600 uppercase bg-slate-50">
                  <th className="py-3 px-4">Account Code</th>
                  <th className="py-3 px-4">Account Name</th>
                  <th className="py-3 px-4">Operating Currency</th>
                  <th className="py-3 px-4 text-right">Opening (AFN)</th>
                  <th className="py-3 px-4 text-right">Inflows (AFN)</th>
                  <th className="py-3 px-4 text-right">Payments (AFN)</th>
                  <th className="py-3 px-4 text-right">Expenses (AFN)</th>
                  <th className="py-3 px-4 text-right font-bold text-slate-900">Closing Balance (AFN)</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {report.accounts.map((acc) => (
                  <tr key={acc.accountId} className="hover:bg-slate-50/70">
                    <td className="py-3 px-4 font-mono font-bold text-slate-900">{acc.accountCode}</td>
                    <td className="py-3 px-4 font-medium text-slate-800">{acc.accountName}</td>
                    <td className="py-3 px-4">
                      <span className="bg-slate-100 text-slate-800 font-mono px-2 py-0.5 rounded font-bold">
                        {acc.currency}
                      </span>
                    </td>
                    <td className="py-3 px-4 text-right font-mono text-slate-600">{acc.openingBalanceBase}</td>
                    <td className="py-3 px-4 text-right font-mono text-emerald-600">+{acc.receiptsBase}</td>
                    <td className="py-3 px-4 text-right font-mono text-rose-600">-{acc.paymentsBase}</td>
                    <td className="py-3 px-4 text-right font-mono text-amber-600">-{acc.expensesBase}</td>
                    <td className="py-3 px-4 text-right font-mono font-black text-indigo-700">
                      {acc.closingBalanceBase}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}
    </div>
  );
}
