"use client";

import React, { useState, useEffect } from "react";
import { fetchRevenueAnalysis } from "@/app/actions/reports";
import { RevenueAnalysisReport } from "@/lib/advancedReports";
import { convertToCsv, downloadCsvInBrowser } from "@/lib/exportUtils";

export default function RevenueAnalysisPage() {
  const [loading, setLoading] = useState(true);
  const [report, setReport] = useState<RevenueAnalysisReport | null>(null);
  const [error, setError] = useState<string | null>(null);

  const loadReport = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetchRevenueAnalysis();
      if (res.success && res.data) {
        setReport(res.data);
      } else {
        setError(res.error || "Failed to load Revenue analysis");
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
    const headers = ["Service / Revenue Stream", "Realized Revenue (AFN)"];
    const rows = report.byServiceType.map((s) => [s.serviceType, s.amount]);
    const csv = convertToCsv(headers, rows);
    downloadCsvInBrowser(`revenue_analysis_${new Date().toISOString().split("T")[0]}`, csv);
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-start">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 tracking-tight">
            Revenue & Sales Analysis
          </h1>
          <p className="text-sm text-slate-500 mt-1">
            Realized travel revenue breakdowns derived from posted General Ledger lines.
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
          {/* Total Card */}
          <div className="p-6 bg-slate-900 text-white rounded flex justify-between items-center">
            <div>
              <p className="text-xs uppercase tracking-wider text-slate-400 font-semibold">
                Total Realized Operating Revenue (4xxx)
              </p>
              <p className="text-3xl font-black font-mono mt-1 text-emerald-400">
                {report.totalRevenue} AFN
              </p>
            </div>
            <div className="text-right text-xs text-slate-400">
              <p>Strictly posted invoice journals</p>
              <p>Zero unposted estimates</p>
            </div>
          </div>

          {/* Breakdown Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* By Service Type */}
            <div className="bg-white rounded border border-slate-200 overflow-hidden">
              <div className="px-6 py-4 border-b border-slate-200 bg-slate-50 font-semibold text-sm text-slate-900">
                Revenue by Service Line
              </div>
              <table className="w-full text-left border-collapse text-xs">
                <thead>
                  <tr className="border-b border-slate-200 font-semibold text-slate-600 uppercase bg-slate-50">
                    <th className="py-2.5 px-4">Service Type</th>
                    <th className="py-2.5 px-4 text-right">Revenue (AFN)</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {report.byServiceType.map((st, idx) => (
                    <tr key={idx} className="hover:bg-slate-50/70">
                      <td className="py-2.5 px-4 font-medium text-slate-800">{st.serviceType}</td>
                      <td className="py-2.5 px-4 text-right font-mono font-bold text-slate-900">
                        {st.amount}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* By Customer */}
            <div className="bg-white rounded border border-slate-200 overflow-hidden">
              <div className="px-6 py-4 border-b border-slate-200 bg-slate-50 font-semibold text-sm text-slate-900">
                Top Customers by Revenue Contribution
              </div>
              <table className="w-full text-left border-collapse text-xs">
                <thead>
                  <tr className="border-b border-slate-200 font-semibold text-slate-600 uppercase bg-slate-50">
                    <th className="py-2.5 px-4">Customer</th>
                    <th className="py-2.5 px-4 text-right">Share %</th>
                    <th className="py-2.5 px-4 text-right">Revenue (AFN)</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {report.byCustomer.map((c, idx) => (
                    <tr key={idx} className="hover:bg-slate-50/70">
                      <td className="py-2.5 px-4 font-medium text-slate-800">{c.customerName}</td>
                      <td className="py-2.5 px-4 text-right font-mono text-slate-500">{c.percentage}%</td>
                      <td className="py-2.5 px-4 text-right font-mono font-bold text-slate-900">
                        {c.amount}
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
