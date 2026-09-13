"use client";

import React, { useState, useEffect } from "react";
import { fetchArAging } from "@/app/actions/reports";
import { ArAgingReport } from "@/lib/advancedReports";
import { convertToCsv, downloadCsvInBrowser } from "@/lib/exportUtils";

export default function ArAgingPage() {
  const [loading, setLoading] = useState(true);
  const [report, setReport] = useState<ArAgingReport | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [asOfDate, setAsOfDate] = useState("");

  const loadAging = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetchArAging(asOfDate || undefined);
      if (res.success && res.data) {
        setReport(res.data);
      } else {
        setError(res.error || "Failed to load AR aging report");
      }
    } catch (err: any) {
      setError(err.message || "An unexpected error occurred");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadAging();
  }, []);

  const handleExportCsv = () => {
    if (!report) return;
    const headers = [
      "Customer Code",
      "Customer Name",
      "Current (AFN)",
      "1-30 Days (AFN)",
      "31-60 Days (AFN)",
      "61-90 Days (AFN)",
      "91-120 Days (AFN)",
      "120+ Days (AFN)",
      "Total Outstanding (AFN)",
    ];
    const rows = report.buckets.map((b) => [
      b.customerCode,
      b.customerName,
      b.current,
      b.days1_30,
      b.days31_60,
      b.days61_90,
      b.days91_120,
      b.days120Plus,
      b.totalOutstanding,
    ]);
    const csv = convertToCsv(headers, rows);
    downloadCsvInBrowser(`ar_aging_${report.asOfDate}`, csv);
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-start">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 tracking-tight">
            Accounts Receivable (AR) Aging Report
          </h1>
          <p className="text-sm text-slate-500 mt-1">
            Breakdown of outstanding customer invoices grouped by overdue aging intervals.
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

      {/* Date Filter & Reconciliation Status */}
      <div className="flex flex-wrap justify-between items-center bg-white p-4 rounded border border-slate-200 gap-4">
        <div className="flex items-center gap-3">
          <label className="text-xs font-semibold text-slate-700">As of Date:</label>
          <input
            type="date"
            value={asOfDate}
            onChange={(e) => setAsOfDate(e.target.value)}
            className="text-xs border border-slate-300 rounded px-2.5 py-1.5"
          />
          <button
            onClick={loadAging}
            disabled={loading}
            className="px-3 py-1.5 bg-indigo-600 text-white text-xs font-semibold rounded hover:bg-indigo-700 disabled:opacity-50"
          >
            {loading ? "Calculating..." : "Apply Date"}
          </button>
        </div>

        {report && (
          <div className="flex items-center gap-4 text-xs font-mono">
            <div>
              <span className="text-slate-500">Aging Total:</span>{" "}
              <span className="font-bold text-slate-900">{report.totalAgingBalance} AFN</span>
            </div>
            <div>
              <span className="text-slate-500">GL 1100 Balance:</span>{" "}
              <span className="font-bold text-slate-900">{report.totalArGlBalance} AFN</span>
            </div>
            <div>
              <span
                className={`px-2 py-0.5 rounded text-[11px] font-bold ${
                  report.isReconciled
                    ? "bg-emerald-100 text-emerald-800"
                    : "bg-rose-100 text-rose-800"
                }`}
              >
                {report.isReconciled ? "RECONCILED TO GL" : "VARIANCE DETECTED"}
              </span>
            </div>
          </div>
        )}
      </div>

      {error && (
        <div className="p-4 bg-rose-50 border border-rose-200 rounded text-rose-700 text-sm">
          {error}
        </div>
      )}

      {report && (
        <>
          {/* Summary Buckets */}
          <div className="grid grid-cols-2 md:grid-cols-7 gap-3 text-center">
            <div className="p-3 bg-slate-50 border border-slate-200 rounded">
              <p className="text-[10px] uppercase font-bold text-slate-500">Current</p>
              <p className="text-sm font-mono font-bold text-slate-800 mt-1">
                {report.summary.current}
              </p>
            </div>
            <div className="p-3 bg-slate-50 border border-slate-200 rounded">
              <p className="text-[10px] uppercase font-bold text-slate-500">1–30 Days</p>
              <p className="text-sm font-mono font-bold text-slate-800 mt-1">
                {report.summary.days1_30}
              </p>
            </div>
            <div className="p-3 bg-slate-50 border border-slate-200 rounded">
              <p className="text-[10px] uppercase font-bold text-slate-500">31–60 Days</p>
              <p className="text-sm font-mono font-bold text-slate-800 mt-1">
                {report.summary.days31_60}
              </p>
            </div>
            <div className="p-3 bg-slate-50 border border-slate-200 rounded">
              <p className="text-[10px] uppercase font-bold text-slate-500">61–90 Days</p>
              <p className="text-sm font-mono font-bold text-slate-800 mt-1">
                {report.summary.days61_90}
              </p>
            </div>
            <div className="p-3 bg-slate-50 border border-slate-200 rounded">
              <p className="text-[10px] uppercase font-bold text-slate-500">91–120 Days</p>
              <p className="text-sm font-mono font-bold text-slate-800 mt-1">
                {report.summary.days91_120}
              </p>
            </div>
            <div className="p-3 bg-slate-50 border border-slate-200 rounded">
              <p className="text-[10px] uppercase font-bold text-slate-500">120+ Days</p>
              <p className="text-sm font-mono font-bold text-rose-600 mt-1">
                {report.summary.days120Plus}
              </p>
            </div>
            <div className="p-3 bg-indigo-50 border border-indigo-200 rounded col-span-2 md:col-span-1">
              <p className="text-[10px] uppercase font-bold text-indigo-700">Grand Total</p>
              <p className="text-sm font-mono font-bold text-indigo-700 mt-1">
                {report.summary.grandTotal}
              </p>
            </div>
          </div>

          {/* Customer Summary Table */}
          <div className="bg-white rounded border border-slate-200 overflow-x-auto">
            <div className="px-4 py-3 border-b border-slate-200 bg-slate-50 font-semibold text-xs text-slate-700">
              Customer Balances by Aging Bucket
            </div>
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="border-b border-slate-200 font-semibold text-slate-600 uppercase bg-slate-50">
                  <th className="py-2.5 px-3">Customer</th>
                  <th className="py-2.5 px-3 text-right">Current</th>
                  <th className="py-2.5 px-3 text-right">1–30 d</th>
                  <th className="py-2.5 px-3 text-right">31–60 d</th>
                  <th className="py-2.5 px-3 text-right">61–90 d</th>
                  <th className="py-2.5 px-3 text-right">91–120 d</th>
                  <th className="py-2.5 px-3 text-right">120+ d</th>
                  <th className="py-2.5 px-3 text-right font-bold text-slate-900">Total (AFN)</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {report.buckets.length === 0 ? (
                  <tr>
                    <td colSpan={8} className="py-6 text-center text-slate-400">
                      No overdue or outstanding customer receivables.
                    </td>
                  </tr>
                ) : (
                  report.buckets.map((b) => (
                    <tr key={b.customerId} className="hover:bg-slate-50/70">
                      <td className="py-2 px-3">
                        <span className="font-semibold text-slate-900">{b.customerName}</span>{" "}
                        <span className="font-mono text-slate-400">({b.customerCode})</span>
                      </td>
                      <td className="py-2 px-3 text-right font-mono text-slate-700">{b.current}</td>
                      <td className="py-2 px-3 text-right font-mono text-slate-700">{b.days1_30}</td>
                      <td className="py-2 px-3 text-right font-mono text-slate-700">{b.days31_60}</td>
                      <td className="py-2 px-3 text-right font-mono text-slate-700">{b.days61_90}</td>
                      <td className="py-2 px-3 text-right font-mono text-slate-700">{b.days91_120}</td>
                      <td className="py-2 px-3 text-right font-mono text-rose-600">{b.days120Plus}</td>
                      <td className="py-2 px-3 text-right font-mono font-bold text-slate-900">
                        {b.totalOutstanding}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </>
      )}
    </div>
  );
}
