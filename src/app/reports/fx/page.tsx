"use client";

import React, { useState, useEffect } from "react";
import { fetchFxReport } from "@/app/actions/reports";
import { FxReport } from "@/lib/advancedReports";
import { convertToCsv, downloadCsvInBrowser } from "@/lib/exportUtils";

export default function FxReportPage() {
  const [loading, setLoading] = useState(true);
  const [report, setReport] = useState<FxReport | null>(null);
  const [error, setError] = useState<string | null>(null);

  const loadReport = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetchFxReport();
      if (res.success && res.data) {
        setReport(res.data);
      } else {
        setError(res.error || "Failed to load Foreign Exchange report");
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
      "Date",
      "Journal #",
      "Type",
      "Source Document",
      "Partner / Beneficiary",
      "Booking #",
      "Amount (AFN)",
      "Description",
    ];
    const rows = report.rows.map((r) => [
      r.date,
      r.journalNumber,
      r.fxType,
      r.sourceType,
      r.partnerName,
      r.bookingNumber || "",
      r.amountBase,
      r.description,
    ]);
    const csv = convertToCsv(headers, rows);
    downloadCsvInBrowser(`fx_realized_report_${new Date().toISOString().split("T")[0]}`, csv);
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-start">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 tracking-tight">
            Foreign Exchange (FX) Realized Gain / Loss Report
          </h1>
          <p className="text-sm text-slate-500 mt-1">
            Realized currency fluctuation gains (7010) and losses (8010) on multi-currency settlements.
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
            <div className="p-4 bg-emerald-50 border border-emerald-200 rounded">
              <p className="text-xs uppercase font-bold text-emerald-700">Total Realized FX Gains (7010)</p>
              <p className="text-2xl font-black font-mono text-emerald-800 mt-1">
                +{report.totalRealizedGain} AFN
              </p>
            </div>
            <div className="p-4 bg-rose-50 border border-rose-200 rounded">
              <p className="text-xs uppercase font-bold text-rose-700">Total Realized FX Losses (8010)</p>
              <p className="text-2xl font-black font-mono text-rose-800 mt-1">
                -{report.totalRealizedLoss} AFN
              </p>
            </div>
            <div className="p-4 bg-indigo-50 border border-indigo-200 rounded">
              <p className="text-xs uppercase font-bold text-indigo-700">Net FX Financial Impact</p>
              <p className="text-2xl font-black font-mono text-indigo-900 mt-1">
                {report.netFxImpact} AFN
              </p>
            </div>
          </div>

          {/* Transactions Table */}
          <div className="bg-white rounded border border-slate-200 overflow-x-auto">
            <div className="px-6 py-4 border-b border-slate-200 bg-slate-50 font-semibold text-sm text-slate-900">
              Realized FX Settlement Journal Entries
            </div>
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="border-b border-slate-200 font-semibold text-slate-600 uppercase bg-slate-50">
                  <th className="py-2.5 px-3">Date</th>
                  <th className="py-2.5 px-3">Journal #</th>
                  <th className="py-2.5 px-3">FX Classification</th>
                  <th className="py-2.5 px-3">Source Ref</th>
                  <th className="py-2.5 px-3">Partner / Booking</th>
                  <th className="py-2.5 px-3">Description</th>
                  <th className="py-2.5 px-3 text-right font-bold text-slate-900">Realized AFN</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {report.rows.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="py-6 text-center text-slate-400">
                      No realized FX gains or losses posted in the selected period.
                    </td>
                  </tr>
                ) : (
                  report.rows.map((row, idx) => (
                    <tr key={idx} className="hover:bg-slate-50/70">
                      <td className="py-2 px-3 font-mono">{row.date}</td>
                      <td className="py-2 px-3 font-mono font-semibold text-slate-900">
                        {row.journalNumber}
                      </td>
                      <td className="py-2 px-3">
                        <span
                          className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                            row.fxType === "GAIN"
                              ? "bg-emerald-100 text-emerald-800"
                              : "bg-rose-100 text-rose-800"
                          }`}
                        >
                          {row.fxType === "GAIN" ? "7010 FX GAIN" : "8010 FX LOSS"}
                        </span>
                      </td>
                      <td className="py-2 px-3 font-mono text-slate-600">{row.sourceType}</td>
                      <td className="py-2 px-3 text-slate-700">
                        {row.partnerName}
                        {row.bookingNumber && (
                          <span className="block text-[10px] font-mono text-indigo-600">
                            Ref: {row.bookingNumber}
                          </span>
                        )}
                      </td>
                      <td className="py-2 px-3 text-slate-500 max-w-xs truncate">{row.description}</td>
                      <td
                        className={`py-2 px-3 text-right font-mono font-bold ${
                          row.fxType === "GAIN" ? "text-emerald-700" : "text-rose-700"
                        }`}
                      >
                        {row.fxType === "GAIN" ? `+${row.amountBase}` : `-${row.amountBase}`}
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
