"use client";

import React, { useState, useEffect } from "react";
import { fetchReconciliationReport } from "@/app/actions/reports";
import { FullReconciliationReport } from "@/lib/reconciliation";
import { convertToCsv, downloadCsvInBrowser } from "@/lib/exportUtils";

export default function ReconciliationPage() {
  const [loading, setLoading] = useState(true);
  const [report, setReport] = useState<FullReconciliationReport | null>(null);
  const [error, setError] = useState<string | null>(null);

  const loadReconciliation = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetchReconciliationReport();
      if (res.success) {
        setReport(res.data);
      } else {
        setError(res.error || "Failed to load reconciliation audit");
      }
    } catch (err: any) {
      setError(err.message || "An unexpected error occurred");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadReconciliation();
  }, []);

  const handleExportCsv = () => {
    if (!report) return;
    const headers = [
      "Check Code",
      "Check Name",
      "Category",
      "Expected Value (AFN)",
      "Actual Value (AFN)",
      "Difference (AFN)",
      "Status",
      "Audit Details",
      "Timestamp",
    ];
    const rows = report.checks.map((c) => [
      c.checkCode,
      c.checkName,
      c.category,
      c.expectedValue,
      c.actualValue,
      c.difference,
      c.status,
      c.details,
      c.timestamp,
    ]);
    const csv = convertToCsv(headers, rows);
    downloadCsvInBrowser(`accounting_reconciliation_${new Date().toISOString().split("T")[0]}`, csv);
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-start">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 tracking-tight">
            Financial & Accounting Reconciliation Engine
          </h1>
          <p className="text-sm text-slate-500 mt-1">
            Real-time automated integrity verification across General Ledger and operational subledgers.
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
          <button
            onClick={loadReconciliation}
            disabled={loading}
            className="px-4 py-2 text-sm font-medium bg-indigo-600 text-white rounded hover:bg-indigo-700 disabled:opacity-50"
          >
            {loading ? "Auditing Books..." : "Run Reconciliation Audit"}
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
          {/* Status Header Cards */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div
              className={`p-4 rounded border ${
                report.overallStatus === "PASS"
                  ? "bg-emerald-50 border-emerald-200"
                  : "bg-rose-50 border-rose-200"
              }`}
            >
              <p className="text-xs font-semibold uppercase tracking-wider text-slate-600">
                System Accounting Health
              </p>
              <div className="flex items-center gap-2 mt-1">
                <span
                  className={`text-2xl font-black ${
                    report.overallStatus === "PASS" ? "text-emerald-700" : "text-rose-700"
                  }`}
                >
                  {report.overallStatus === "PASS" ? "100% BALANCED" : "RECONCILIATION ANOMALY"}
                </span>
              </div>
              <p className="text-xs text-slate-500 mt-1">
                Audit executed: {new Date(report.timestamp).toLocaleTimeString()}
              </p>
            </div>

            <div className="p-4 bg-white rounded border border-slate-200">
              <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">
                Total Checks Run
              </p>
              <p className="text-2xl font-bold text-slate-900 mt-1">{report.checks.length}</p>
              <p className="text-xs text-slate-500 mt-1">GL, Subledgers & Operations</p>
            </div>

            <div className="p-4 bg-white rounded border border-slate-200">
              <p className="text-xs font-semibold uppercase tracking-wider text-emerald-600">
                Checks Passed
              </p>
              <p className="text-2xl font-bold text-emerald-600 mt-1">{report.passedChecks}</p>
              <p className="text-xs text-slate-500 mt-1">Zero discrepancy found</p>
            </div>

            <div className="p-4 bg-white rounded border border-slate-200">
              <p className="text-xs font-semibold uppercase tracking-wider text-rose-600">
                Checks Failed
              </p>
              <p className="text-2xl font-bold text-rose-600 mt-1">{report.failedChecks}</p>
              <p className="text-xs text-slate-500 mt-1">Action required if &gt; 0</p>
            </div>
          </div>

          {/* Reconciliation Checks Table */}
          <div className="bg-white rounded border border-slate-200 overflow-hidden">
            <div className="px-6 py-4 border-b border-slate-200 bg-slate-50">
              <h2 className="text-base font-semibold text-slate-900">
                Detailed Reconciliation Matrix
              </h2>
            </div>

            <table className="w-full text-left border-collapse text-sm">
              <thead>
                <tr className="border-b border-slate-200 text-xs font-semibold text-slate-600 uppercase bg-slate-50">
                  <th className="py-3 px-4">Status</th>
                  <th className="py-3 px-4">Check Name</th>
                  <th className="py-3 px-4">Category</th>
                  <th className="py-3 px-4 text-right">Expected (AFN)</th>
                  <th className="py-3 px-4 text-right">Actual (AFN)</th>
                  <th className="py-3 px-4 text-right">Variance</th>
                  <th className="py-3 px-4">Audit Details</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {report.checks.map((check) => (
                  <tr key={check.checkCode} className="hover:bg-slate-50/70">
                    <td className="py-3 px-4">
                      <span
                        className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-bold ${
                          check.status === "PASS"
                            ? "bg-emerald-100 text-emerald-800 border border-emerald-300"
                            : "bg-rose-100 text-rose-800 border border-rose-300"
                        }`}
                      >
                        {check.status}
                      </span>
                    </td>
                    <td className="py-3 px-4 font-medium text-slate-900">{check.checkName}</td>
                    <td className="py-3 px-4 text-xs text-slate-500 font-mono">
                      {check.category}
                    </td>
                    <td className="py-3 px-4 text-right font-mono text-slate-700">
                      {check.expectedValue}
                    </td>
                    <td className="py-3 px-4 text-right font-mono text-slate-700">
                      {check.actualValue}
                    </td>
                    <td
                      className={`py-3 px-4 text-right font-mono font-semibold ${
                        check.difference !== "0.00" ? "text-rose-600" : "text-emerald-600"
                      }`}
                    >
                      {check.difference}
                    </td>
                    <td className="py-3 px-4 text-xs text-slate-600">{check.details}</td>
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
