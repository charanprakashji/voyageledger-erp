"use client";

import React, { useState, useEffect } from "react";
import { fetchCustomerStatement } from "@/app/actions/reports";
import { convertToCsv, downloadCsvInBrowser } from "@/lib/exportUtils";

interface CustomerSummary {
  id: string;
  name: string;
  code: string;
}

export default function CustomerStatementPage() {
  const [customers, setCustomers] = useState<CustomerSummary[]>([]);
  const [selectedCustomerId, setSelectedCustomerId] = useState("");
  const [fromDate, setFromDate] = useState("");
  const [toDate, setToDate] = useState("");
  const [loading, setLoading] = useState(false);
  const [statement, setStatement] = useState<any | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/bookings")
      .then((res) => res.json())
      .then((data) => {
        if (data.customers) {
          setCustomers(data.customers);
          if (data.customers.length > 0) {
            setSelectedCustomerId(data.customers[0].id);
          }
        }
      })
      .catch((err) => console.error("Error fetching customers:", err));
  }, []);

  const loadStatement = async () => {
    if (!selectedCustomerId) return;
    setLoading(true);
    setError(null);
    try {
      const res = await fetchCustomerStatement(selectedCustomerId, fromDate || undefined, toDate || undefined);
      if (res.success && res.data) {
        setStatement(res.data);
      } else {
        setError(res.error || "Failed to load customer statement");
      }
    } catch (err: any) {
      setError(err.message || "An unexpected error occurred");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (selectedCustomerId) {
      loadStatement();
    }
  }, [selectedCustomerId]);

  const handleExportCsv = () => {
    if (!statement) return;
    const headers = ["Date", "Type", "Ref / Doc #", "Description", "Debit (AFN)", "Credit (AFN)", "Running Balance (AFN)"];
    const rows = statement.transactions.map((t: any) => [
      t.date,
      t.type,
      t.referenceNumber || "",
      t.description,
      t.debit,
      t.credit,
      t.runningBalance,
    ]);
    const csv = convertToCsv(headers, rows);
    downloadCsvInBrowser(`customer_statement_${statement.customerName}_${new Date().toISOString().split("T")[0]}`, csv);
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-start">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 tracking-tight">
            Customer Statement of Account
          </h1>
          <p className="text-sm text-slate-500 mt-1">
            Running ledger of customer invoices, receipts, advance allocations, and receivables balance.
          </p>
        </div>

        <div className="flex gap-2">
          <button
            onClick={handleExportCsv}
            disabled={!statement || loading}
            className="px-4 py-2 text-sm font-medium bg-white text-slate-700 border border-slate-300 rounded hover:bg-slate-50 disabled:opacity-50"
          >
            Export CSV
          </button>
        </div>
      </div>

      {/* Filter Bar */}
      <div className="p-4 bg-white rounded border border-slate-200 grid grid-cols-1 md:grid-cols-4 gap-3 items-end">
        <div>
          <label className="block text-xs font-semibold text-slate-600 mb-1">Select Customer</label>
          <select
            value={selectedCustomerId}
            onChange={(e) => setSelectedCustomerId(e.target.value)}
            className="w-full text-xs border border-slate-300 rounded px-2.5 py-1.5"
          >
            {customers.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name} ({c.code})
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="block text-xs font-semibold text-slate-600 mb-1">From Date</label>
          <input
            type="date"
            value={fromDate}
            onChange={(e) => setFromDate(e.target.value)}
            className="w-full text-xs border border-slate-300 rounded px-2.5 py-1.5"
          />
        </div>
        <div>
          <label className="block text-xs font-semibold text-slate-600 mb-1">To Date</label>
          <input
            type="date"
            value={toDate}
            onChange={(e) => setToDate(e.target.value)}
            className="w-full text-xs border border-slate-300 rounded px-2.5 py-1.5"
          />
        </div>
        <div>
          <button
            onClick={loadStatement}
            disabled={loading}
            className="w-full py-1.5 px-3 bg-indigo-600 text-white text-xs font-semibold rounded hover:bg-indigo-700 disabled:opacity-50"
          >
            {loading ? "Loading..." : "Generate Statement"}
          </button>
        </div>
      </div>

      {error && (
        <div className="p-4 bg-rose-50 border border-rose-200 rounded text-rose-700 text-sm">
          {error}
        </div>
      )}

      {statement && (
        <>
          {/* Summary Row */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div className="p-3 bg-slate-50 border border-slate-200 rounded">
              <p className="text-xs text-slate-500 uppercase font-semibold">Opening Balance</p>
              <p className="text-lg font-mono font-bold text-slate-800">{statement.openingBalance} AFN</p>
            </div>
            <div className="p-3 bg-slate-50 border border-slate-200 rounded">
              <p className="text-xs text-slate-500 uppercase font-semibold">Total Invoiced (Debit)</p>
              <p className="text-lg font-mono font-bold text-slate-800">{statement.totalDebits} AFN</p>
            </div>
            <div className="p-3 bg-slate-50 border border-slate-200 rounded">
              <p className="text-xs text-slate-500 uppercase font-semibold">Total Paid (Credit)</p>
              <p className="text-lg font-mono font-bold text-slate-800">{statement.totalCredits} AFN</p>
            </div>
            <div className="p-3 bg-slate-50 border border-slate-200 rounded">
              <p className="text-xs text-slate-500 uppercase font-semibold">Closing Balance Due</p>
              <p className="text-lg font-mono font-bold text-indigo-700">{statement.closingBalance} AFN</p>
            </div>
          </div>

          {/* Statement Table */}
          <div className="bg-white rounded border border-slate-200 overflow-x-auto">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="border-b border-slate-200 font-semibold text-slate-600 uppercase bg-slate-50">
                  <th className="py-2.5 px-3">Date</th>
                  <th className="py-2.5 px-3">Document Type</th>
                  <th className="py-2.5 px-3">Reference #</th>
                  <th className="py-2.5 px-3">Description</th>
                  <th className="py-2.5 px-3 text-right">Debit (AFN)</th>
                  <th className="py-2.5 px-3 text-right">Credit (AFN)</th>
                  <th className="py-2.5 px-3 text-right font-bold text-slate-900">Running Balance (AFN)</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {statement.transactions.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="py-6 text-center text-slate-400">
                      No posted transactions found for this customer.
                    </td>
                  </tr>
                ) : (
                  statement.transactions.map((tx: any, idx: number) => (
                    <tr key={idx} className="hover:bg-slate-50/70">
                      <td className="py-2 px-3 font-mono">{tx.date}</td>
                      <td className="py-2 px-3">
                        <span className="bg-slate-100 text-slate-700 px-1.5 py-0.5 rounded font-mono text-[10px]">
                          {tx.type}
                        </span>
                      </td>
                      <td className="py-2 px-3 font-mono font-semibold text-slate-900">
                        {tx.referenceNumber || "-"}
                      </td>
                      <td className="py-2 px-3 text-slate-600">{tx.description}</td>
                      <td className="py-2 px-3 text-right font-mono font-medium text-slate-800">
                        {tx.debit !== "0.00" ? tx.debit : "-"}
                      </td>
                      <td className="py-2 px-3 text-right font-mono font-medium text-slate-800">
                        {tx.credit !== "0.00" ? tx.credit : "-"}
                      </td>
                      <td className="py-2 px-3 text-right font-mono font-bold text-slate-900">
                        {tx.runningBalance}
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
