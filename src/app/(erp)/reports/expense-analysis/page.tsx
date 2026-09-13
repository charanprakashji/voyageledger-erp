"use client";

import React, { useState, useEffect } from "react";
import { fetchExpenseAnalysis } from "@/app/actions/reports";
import { ExpenseAnalysisReport } from "@/lib/advancedReports";
import { convertToCsv, downloadCsvInBrowser } from "@/lib/exportUtils";

export default function ExpenseAnalysisPage() {
  const [loading, setLoading] = useState(true);
  const [report, setReport] = useState<ExpenseAnalysisReport | null>(null);
  const [error, setError] = useState<string | null>(null);

  const loadReport = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetchExpenseAnalysis();
      if (res.success) {
        setReport(res.data);
      } else {
        setError(res.error || "Failed to load Expense analysis");
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
    const headers = ["Account Code", "Expense Account", "Amount (AFN)"];
    const rows = report.byAccount.map((a) => [a.accountCode, a.accountName, a.amount]);
    const csv = convertToCsv(headers, rows);
    downloadCsvInBrowser(`expense_analysis_${new Date().toISOString().split("T")[0]}`, csv);
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-start">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 tracking-tight">
            Expense & Cost Analysis
          </h1>
          <p className="text-sm text-slate-500 mt-1">
            Direct travel service costs (5xxx) and operating overheads (6xxx) analysis.
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
          {/* Summary Cards */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="p-4 bg-white border border-slate-200 rounded">
              <p className="text-xs uppercase font-bold text-slate-500">Total Direct Costs (5xxx)</p>
              <p className="text-2xl font-black font-mono text-slate-900 mt-1">
                {report.totalDirectCost} AFN
              </p>
              <p className="text-xs text-slate-400 mt-1">Airlines, Hotels, Visas, Transport</p>
            </div>

            <div className="p-4 bg-white border border-slate-200 rounded">
              <p className="text-xs uppercase font-bold text-slate-500">Total Operating Expenses (6xxx)</p>
              <p className="text-2xl font-black font-mono text-slate-900 mt-1">
                {report.totalOperatingExpense} AFN
              </p>
              <p className="text-xs text-slate-400 mt-1">Rent, Salaries, Utilities, IT</p>
            </div>

            <div className="p-4 bg-slate-900 text-white rounded">
              <p className="text-xs uppercase font-bold text-slate-400">Total Company Outflows</p>
              <p className="text-2xl font-black font-mono text-rose-400 mt-1">
                {report.totalExpense} AFN
              </p>
              <p className="text-xs text-slate-400 mt-1">All posted cost & expense lines</p>
            </div>
          </div>

          {/* Breakdown Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* By Account */}
            <div className="bg-white rounded border border-slate-200 overflow-hidden">
              <div className="px-6 py-4 border-b border-slate-200 bg-slate-50 font-semibold text-sm text-slate-900">
                Expense Breakdown by General Ledger Account
              </div>
              <table className="w-full text-left border-collapse text-xs">
                <thead>
                  <tr className="border-b border-slate-200 font-semibold text-slate-600 uppercase bg-slate-50">
                    <th className="py-2.5 px-4">Code</th>
                    <th className="py-2.5 px-4">Account Name</th>
                    <th className="py-2.5 px-4 text-right">Amount (AFN)</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {report.byAccount.map((acc, idx) => (
                    <tr key={idx} className="hover:bg-slate-50/70">
                      <td className="py-2.5 px-4 font-mono font-bold text-slate-900">{acc.accountCode}</td>
                      <td className="py-2.5 px-4 font-medium text-slate-800">{acc.accountName}</td>
                      <td className="py-2.5 px-4 text-right font-mono font-bold text-slate-900">
                        {acc.amount}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* By Supplier */}
            <div className="bg-white rounded border border-slate-200 overflow-hidden">
              <div className="px-6 py-4 border-b border-slate-200 bg-slate-50 font-semibold text-sm text-slate-900">
                Direct Costs by Supplier
              </div>
              <table className="w-full text-left border-collapse text-xs">
                <thead>
                  <tr className="border-b border-slate-200 font-semibold text-slate-600 uppercase bg-slate-50">
                    <th className="py-2.5 px-4">Supplier / Entity</th>
                    <th className="py-2.5 px-4 text-right">Amount (AFN)</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {report.bySupplier.map((s, idx) => (
                    <tr key={idx} className="hover:bg-slate-50/70">
                      <td className="py-2.5 px-4 font-medium text-slate-800">{s.supplierName}</td>
                      <td className="py-2.5 px-4 text-right font-mono font-bold text-slate-900">
                        {s.amount}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
