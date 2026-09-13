"use client";

import React, { useState, useEffect } from "react";
import { fetchAdvancedGeneralLedger } from "@/app/actions/reports";
import { GeneralLedgerReport, GeneralLedgerRow } from "@/lib/advancedReports";
import { convertToCsv, downloadCsvInBrowser } from "@/lib/exportUtils";

export default function GeneralLedgerPage() {
  const [loading, setLoading] = useState(true);
  const [report, setReport] = useState<GeneralLedgerReport | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Filters
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [accountType, setAccountType] = useState("");
  const [referenceType, setReferenceType] = useState("");

  const loadGl = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetchAdvancedGeneralLedger({
        startDate: startDate || undefined,
        endDate: endDate || undefined,
        accountType: accountType || undefined,
        referenceType: referenceType || undefined,
      });
      if (res.success) {
        setReport(res.data);
      } else {
        setError(res.error || "Failed to load General Ledger");
      }
    } catch (err: any) {
      setError(err.message || "An unexpected error occurred");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadGl();
  }, []);

  const handleExportCsv = () => {
    if (!report) return;
    const headers = [
      "Date",
      "Journal #",
      "Account Code",
      "Account Name",
      "Type",
      "Ref Type",
      "Description",
      "Customer/Supplier",
      "Booking #",
      "Debit (AFN)",
      "Credit (AFN)",
      "Running Balance (AFN)",
    ];
    const rows = report.rows.map((r) => [
      r.date,
      r.journalNumber,
      r.accountCode,
      r.accountName,
      r.accountType,
      r.referenceType,
      r.description,
      r.customerName || r.supplierName || "",
      r.bookingNumber || "",
      r.debit,
      r.credit,
      r.runningBalance,
    ]);
    const csv = convertToCsv(headers, rows);
    downloadCsvInBrowser(`general_ledger_${new Date().toISOString().split("T")[0]}`, csv);
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-start">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 tracking-tight">
            General Ledger Explorer
          </h1>
          <p className="text-sm text-slate-500 mt-1">
            Complete historical audit trail of all posted double-entry journal transactions.
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

      {/* Filter Bar */}
      <div className="p-4 bg-white rounded border border-slate-200 grid grid-cols-1 md:grid-cols-5 gap-3 items-end">
        <div>
          <label className="block text-xs font-semibold text-slate-600 mb-1">Start Date</label>
          <input
            type="date"
            value={startDate}
            onChange={(e) => setStartDate(e.target.value)}
            className="w-full text-xs border border-slate-300 rounded px-2.5 py-1.5"
          />
        </div>
        <div>
          <label className="block text-xs font-semibold text-slate-600 mb-1">End Date</label>
          <input
            type="date"
            value={endDate}
            onChange={(e) => setEndDate(e.target.value)}
            className="w-full text-xs border border-slate-300 rounded px-2.5 py-1.5"
          />
        </div>
        <div>
          <label className="block text-xs font-semibold text-slate-600 mb-1">Account Type</label>
          <select
            value={accountType}
            onChange={(e) => setAccountType(e.target.value)}
            className="w-full text-xs border border-slate-300 rounded px-2.5 py-1.5"
          >
            <option value="">All Account Types</option>
            <option value="ASSET">ASSET</option>
            <option value="LIABILITY">LIABILITY</option>
            <option value="EQUITY">EQUITY</option>
            <option value="REVENUE">REVENUE</option>
            <option value="EXPENSE">EXPENSE</option>
          </select>
        </div>
        <div>
          <label className="block text-xs font-semibold text-slate-600 mb-1">Source Type</label>
          <select
            value={referenceType}
            onChange={(e) => setReferenceType(e.target.value)}
            className="w-full text-xs border border-slate-300 rounded px-2.5 py-1.5"
          >
            <option value="">All Source Types</option>
            <option value="INVOICE">INVOICE</option>
            <option value="RECEIPT">RECEIPT</option>
            <option value="SUPPLIER_BILL">SUPPLIER_BILL</option>
            <option value="SUPPLIER_PAYMENT">SUPPLIER_PAYMENT</option>
            <option value="EXPENSE">EXPENSE</option>
            <option value="MANUAL">MANUAL</option>
          </select>
        </div>
        <div>
          <button
            onClick={loadGl}
            disabled={loading}
            className="w-full py-1.5 px-3 bg-indigo-600 text-white text-xs font-semibold rounded hover:bg-indigo-700 disabled:opacity-50"
          >
            {loading ? "Loading..." : "Filter Ledger"}
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
          {/* Summary Row */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div className="p-3 bg-slate-50 border border-slate-200 rounded">
              <p className="text-xs text-slate-500 uppercase font-semibold">Opening Balance</p>
              <p className="text-lg font-mono font-bold text-slate-800">{report.openingBalance} AFN</p>
            </div>
            <div className="p-3 bg-slate-50 border border-slate-200 rounded">
              <p className="text-xs text-slate-500 uppercase font-semibold">Total Debits</p>
              <p className="text-lg font-mono font-bold text-slate-800">{report.totalDebits} AFN</p>
            </div>
            <div className="p-3 bg-slate-50 border border-slate-200 rounded">
              <p className="text-xs text-slate-500 uppercase font-semibold">Total Credits</p>
              <p className="text-lg font-mono font-bold text-slate-800">{report.totalCredits} AFN</p>
            </div>
            <div className="p-3 bg-slate-50 border border-slate-200 rounded">
              <p className="text-xs text-slate-500 uppercase font-semibold">Closing Balance</p>
              <p className="text-lg font-mono font-bold text-indigo-700">{report.closingBalance} AFN</p>
            </div>
          </div>

          {/* Ledger Table */}
          <div className="bg-white rounded border border-slate-200 overflow-x-auto">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="border-b border-slate-200 font-semibold text-slate-600 uppercase bg-slate-50">
                  <th className="py-2.5 px-3">Date</th>
                  <th className="py-2.5 px-3">Journal #</th>
                  <th className="py-2.5 px-3">Account</th>
                  <th className="py-2.5 px-3">Type</th>
                  <th className="py-2.5 px-3">Ref</th>
                  <th className="py-2.5 px-3">Party / Booking</th>
                  <th className="py-2.5 px-3">Description</th>
                  <th className="py-2.5 px-3 text-right">Debit (AFN)</th>
                  <th className="py-2.5 px-3 text-right">Credit (AFN)</th>
                  <th className="py-2.5 px-3 text-right">Balance (AFN)</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {report.rows.length === 0 ? (
                  <tr>
                    <td colSpan={10} className="py-6 text-center text-slate-400">
                      No posted journal lines found for selected criteria.
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
                        <span className="font-mono font-bold text-slate-800">{row.accountCode}</span>{" "}
                        <span className="text-slate-500">{row.accountName}</span>
                      </td>
                      <td className="py-2 px-3 font-mono text-[10px] text-slate-500">
                        {row.accountType}
                      </td>
                      <td className="py-2 px-3">
                        <span className="bg-slate-100 text-slate-700 px-1.5 py-0.5 rounded font-mono text-[10px]">
                          {row.referenceType}
                        </span>
                      </td>
                      <td className="py-2 px-3 text-slate-700">
                        {row.customerName || row.supplierName || ""}
                        {row.bookingNumber && (
                          <span className="block text-[10px] font-mono text-indigo-600">
                            Ref: {row.bookingNumber}
                          </span>
                        )}
                      </td>
                      <td className="py-2 px-3 text-slate-600 max-w-xs truncate">
                        {row.description}
                      </td>
                      <td className="py-2 px-3 text-right font-mono font-medium text-slate-800">
                        {row.debit !== "0.00" ? row.debit : "-"}
                      </td>
                      <td className="py-2 px-3 text-right font-mono font-medium text-slate-800">
                        {row.credit !== "0.00" ? row.credit : "-"}
                      </td>
                      <td className="py-2 px-3 text-right font-mono font-bold text-slate-900">
                        {row.runningBalance}
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
