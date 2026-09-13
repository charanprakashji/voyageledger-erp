"use client";

import React, { useState, useEffect } from "react";
import { fetchTaxReport } from "@/app/actions/reports";
import { TaxReport } from "@/lib/advancedReports";
import { convertToCsv, downloadCsvInBrowser } from "@/lib/exportUtils";

export default function TaxReportPage() {
  const [loading, setLoading] = useState(true);
  const [report, setReport] = useState<TaxReport | null>(null);
  const [error, setError] = useState<string | null>(null);

  const loadReport = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetchTaxReport();
      if (res.success) {
        setReport(res.data);
      } else {
        setError(res.error || "Failed to load Tax report");
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
      "Tax Code",
      "Tax Name",
      "Classification",
      "GL Account Code",
      "Tax Rate",
      "Tax Amount (AFN)",
    ];
    const rows = report.rows.map((r) => [
      r.taxCode,
      r.taxName,
      r.type,
      r.glAccountCode,
      r.rate,
      r.taxAmountBase,
    ]);
    const csv = convertToCsv(headers, rows);
    downloadCsvInBrowser(`tax_audit_report_${new Date().toISOString().split("T")[0]}`, csv);
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-start">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 tracking-tight">
            Tax Audit & Compliance Report
          </h1>
          <p className="text-sm text-slate-500 mt-1">
            Configurable Afghan sales and input tax reconciliation across General Ledger accounts.
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
          {/* Tax Summary Cards */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div className="p-4 bg-white border border-slate-200 rounded">
              <p className="text-xs uppercase font-bold text-slate-500">
                Output Tax Liability (2030)
              </p>
              <p className="text-2xl font-black font-mono text-slate-900 mt-1">
                {report.totalOutputTaxLiability} AFN
              </p>
              <p className="text-xs text-slate-400 mt-1">Collected on Invoices</p>
            </div>

            <div className="p-4 bg-white border border-slate-200 rounded">
              <p className="text-xs uppercase font-bold text-slate-500">
                Recoverable Input Tax Asset (1210)
              </p>
              <p className="text-2xl font-black font-mono text-emerald-700 mt-1">
                {report.totalRecoverableInputTaxAsset} AFN
              </p>
              <p className="text-xs text-slate-400 mt-1">Paid on Supplier Bills</p>
            </div>

            <div className="p-4 bg-white border border-slate-200 rounded">
              <p className="text-xs uppercase font-bold text-slate-500">
                Non-Recoverable Tax
              </p>
              <p className="text-2xl font-black font-mono text-amber-700 mt-1">
                {report.totalNonRecoverableTax} AFN
              </p>
              <p className="text-xs text-slate-400 mt-1">Direct Cost Capitalized</p>
            </div>

            <div className="p-4 bg-indigo-50 border border-indigo-200 rounded">
              <p className="text-xs uppercase font-bold text-indigo-700">
                Net Tax Payable / (Credit)
              </p>
              <p className="text-2xl font-black font-mono text-indigo-900 mt-1">
                {report.netTaxPayable} AFN
              </p>
              <p className="text-xs text-indigo-500 mt-1">Output minus Input Asset</p>
            </div>
          </div>

          {/* Tax Breakdown Table */}
          <div className="bg-white rounded border border-slate-200 overflow-hidden">
            <div className="px-6 py-4 border-b border-slate-200 bg-slate-50 font-semibold text-sm text-slate-900">
              Tax Ledger Breakdown & Reconciliation
            </div>
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="border-b border-slate-200 font-semibold text-slate-600 uppercase bg-slate-50">
                  <th className="py-3 px-4">Tax Code</th>
                  <th className="py-3 px-4">Tax Description</th>
                  <th className="py-3 px-4">Accounting Treatment</th>
                  <th className="py-3 px-4">GL Account</th>
                  <th className="py-3 px-4">Basis</th>
                  <th className="py-3 px-4 text-right font-bold text-slate-900">Tax Amount (AFN)</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {report.rows.map((row, idx) => (
                  <tr key={idx} className="hover:bg-slate-50/70">
                    <td className="py-3 px-4 font-mono font-bold text-slate-900">{row.taxCode}</td>
                    <td className="py-3 px-4 font-medium text-slate-800">{row.taxName}</td>
                    <td className="py-3 px-4">
                      <span
                        className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                          row.type === "OUTPUT_TAX"
                            ? "bg-slate-100 text-slate-800 border border-slate-300"
                            : row.type === "RECOVERABLE_INPUT_TAX"
                            ? "bg-emerald-100 text-emerald-800 border border-emerald-300"
                            : "bg-amber-100 text-amber-800 border border-amber-300"
                        }`}
                      >
                        {row.type}
                      </span>
                    </td>
                    <td className="py-3 px-4 font-mono font-bold text-indigo-600">
                      {row.glAccountCode}
                    </td>
                    <td className="py-3 px-4 text-slate-500">{row.taxableBaseAmount}</td>
                    <td className="py-3 px-4 text-right font-mono font-black text-slate-900">
                      {row.taxAmountBase}
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
