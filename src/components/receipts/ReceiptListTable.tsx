"use client";

import React, { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  Search,
  Plus,
  Receipt as ReceiptIcon,
  CheckCircle2,
  Ban,
  Eye,
  AlertCircle,
} from "lucide-react";
import { ReceiptStatus } from "@prisma/client";
import { postReceipt, cancelReceipt } from "@/app/actions/receipts";

interface ReceiptListTableProps {
  initialData: any[];
  pagination: {
    total: number;
    page: number;
    limit: number;
    totalPages: number;
  };
  customers: Array<{ id: string; name: string; code: string }>;
}

export function ReceiptListTable({
  initialData,
  pagination,
  customers,
}: ReceiptListTableProps) {
  const router = useRouter();
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("ALL");
  const [customerFilter, setCustomerFilter] = useState<string>("ALL");
  const [selectedForCancel, setSelectedForCancel] = useState<any | null>(null);
  const [cancelReason, setCancelReason] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);

  const filteredReceipts = initialData.filter((r) => {
    if (statusFilter !== "ALL" && r.status !== statusFilter) return false;
    if (customerFilter !== "ALL" && r.customerId !== customerFilter) return false;
    if (searchTerm) {
      const s = searchTerm.toLowerCase();
      const matchNum = r.receiptNumber?.toLowerCase().includes(s);
      const matchCust = r.customer?.name?.toLowerCase().includes(s) || r.customer?.companyName?.toLowerCase().includes(s);
      const matchRef = r.bankReference?.toLowerCase().includes(s);
      if (!matchNum && !matchCust && !matchRef) return false;
    }
    return true;
  });

  const totalReceiptsAmount = initialData.reduce((acc, r) => acc + (r.baseAmount || 0), 0);
  const totalUnallocated = initialData.reduce((acc, r) => acc + (r.unallocatedBase || 0), 0);

  const handlePost = async (id: string) => {
    setIsSubmitting(true);
    setActionError(null);
    try {
      const res = await postReceipt(id);
      if (res.success) {
        router.refresh();
      } else {
        setActionError(res.error || "Failed to post receipt");
      }
    } catch (err: any) {
      setActionError(err.message || "An error occurred");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleCancelSubmit = async () => {
    if (!selectedForCancel || !cancelReason.trim()) return;
    setIsSubmitting(true);
    setActionError(null);
    try {
      const res = await cancelReceipt(selectedForCancel.id, cancelReason);
      if (res.success) {
        setSelectedForCancel(null);
        setCancelReason("");
        router.refresh();
      } else {
        setActionError(res.error || "Failed to cancel receipt");
      }
    } catch (err: any) {
      setActionError(err.message || "An error occurred");
    } finally {
      setIsSubmitting(false);
    }
  };

  const getStatusBadge = (status: ReceiptStatus) => {
    switch (status) {
      case "POSTED":
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-emerald-100 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300">
            <CheckCircle2 className="w-3 h-3" /> POSTED (GL)
          </span>
        );
      case "APPROVED":
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-blue-100 text-blue-800 dark:bg-blue-950/60 dark:text-blue-300">
            APPROVED
          </span>
        );
      case "DRAFT":
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300">
            DRAFT
          </span>
        );
      case "CANCELLED":
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-rose-100 text-rose-800 dark:bg-rose-950/60 dark:text-rose-300">
            <Ban className="w-3 h-3" /> CANCELLED
          </span>
        );
    }
  };

  return (
    <div className="space-y-6">
      {/* Metrics */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="p-4 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-sm">
          <p className="text-xs font-medium text-slate-500 uppercase tracking-wider">Total Received (AFN Base)</p>
          <p className="text-2xl font-bold text-emerald-600 dark:text-emerald-400 mt-2 font-mono">
            {totalReceiptsAmount.toLocaleString(undefined, { minimumFractionDigits: 2 })}
          </p>
        </div>

        <div className="p-4 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-sm">
          <p className="text-xs font-medium text-slate-500 uppercase tracking-wider">Retained Customer Advances (AFN)</p>
          <p className="text-2xl font-bold text-blue-600 dark:text-blue-400 mt-2 font-mono">
            {totalUnallocated.toLocaleString(undefined, { minimumFractionDigits: 2 })}
          </p>
        </div>

        <div className="p-4 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-sm">
          <p className="text-xs font-medium text-slate-500 uppercase tracking-wider">Receipt Count</p>
          <p className="text-2xl font-bold text-slate-900 dark:text-white mt-2 font-mono">
            {initialData.length}
          </p>
        </div>
      </div>

      {actionError && (
        <div className="p-4 bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-900 text-rose-700 dark:text-rose-300 text-xs rounded-xl flex items-center gap-2">
          <AlertCircle className="w-4 h-4" /> {actionError}
        </div>
      )}

      {/* Filter Bar */}
      <div className="p-4 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-sm flex flex-col md:flex-row gap-4 justify-between items-stretch md:items-center">
        <div className="relative flex-1 max-w-md">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            placeholder="Search receipt #, customer name, ref..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-9 pr-4 py-2 text-sm rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/60 focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="px-3 py-2 text-sm rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800"
          >
            <option value="ALL">All Statuses</option>
            <option value="DRAFT">Draft</option>
            <option value="APPROVED">Approved</option>
            <option value="POSTED">Posted (GL)</option>
            <option value="CANCELLED">Cancelled</option>
          </select>

          <select
            value={customerFilter}
            onChange={(e) => setCustomerFilter(e.target.value)}
            className="px-3 py-2 text-sm rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 max-w-[200px]"
          >
            <option value="ALL">All Customers</option>
            {customers.map((c) => (
              <option key={c.id} value={c.id}>
                {c.code} - {c.name}
              </option>
            ))}
          </select>

          <Link
            href="/receipts/new"
            className="inline-flex items-center gap-2 px-4 py-2 text-sm font-semibold rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white shadow-sm transition-colors"
          >
            <Plus className="w-4 h-4" /> Receive Payment
          </Link>
        </div>
      </div>

      {/* Table */}
      <div className="overflow-hidden rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm text-slate-600 dark:text-slate-300">
            <thead className="bg-slate-50 dark:bg-slate-800/60 text-xs uppercase font-semibold text-slate-500 dark:text-slate-400 border-b border-slate-200 dark:border-slate-800">
              <tr>
                <th className="px-4 py-3.5">Receipt #</th>
                <th className="px-4 py-3.5">Customer</th>
                <th className="px-4 py-3.5">Payment Date</th>
                <th className="px-4 py-3.5">Method & Bank Vault</th>
                <th className="px-4 py-3.5 text-right">Amount</th>
                <th className="px-4 py-3.5 text-right">Base Amount (AFN)</th>
                <th className="px-4 py-3.5 text-right">Advance / Unallocated</th>
                <th className="px-4 py-3.5 text-center">Status</th>
                <th className="px-4 py-3.5 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800 font-medium">
              {filteredReceipts.length === 0 ? (
                <tr>
                  <td colSpan={9} className="px-6 py-12 text-center text-slate-400">
                    <ReceiptIcon className="w-8 h-8 mx-auto mb-2 text-slate-300 dark:text-slate-600" />
                    <p className="font-semibold text-slate-700 dark:text-slate-300">No receipts found</p>
                  </td>
                </tr>
              ) : (
                filteredReceipts.map((r) => (
                  <tr key={r.id} className="hover:bg-slate-50/60 dark:hover:bg-slate-800/30">
                    <td className="px-4 py-3.5">
                      <Link
                        href={`/receipts/${r.id}`}
                        className="font-bold text-slate-900 dark:text-white hover:text-emerald-600 font-mono"
                      >
                        {r.receiptNumber}
                      </Link>
                    </td>

                    <td className="px-4 py-3.5">
                      <div className="font-medium text-slate-900 dark:text-white">
                        {r.customer?.name}
                      </div>
                    </td>

                    <td className="px-4 py-3.5 text-xs">
                      {new Date(r.paymentDate).toLocaleDateString()}
                    </td>

                    <td className="px-4 py-3.5 text-xs">
                      <div className="font-semibold text-slate-800 dark:text-slate-200">
                        {r.paymentMethod}
                      </div>
                      <div className="text-[11px] text-slate-400 font-mono">
                        {r.bankAccount ? `${r.bankAccount.code} - ${r.bankAccount.name}` : ""}
                      </div>
                    </td>

                    <td className="px-4 py-3.5 text-right font-bold text-slate-900 dark:text-white font-mono">
                      {r.currency} {r.amount.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                    </td>

                    <td className="px-4 py-3.5 text-right font-bold text-emerald-600 dark:text-emerald-400 font-mono">
                      {r.baseAmount.toLocaleString(undefined, { minimumFractionDigits: 2 })} AFN
                    </td>

                    <td className="px-4 py-3.5 text-right font-mono text-blue-600 dark:text-blue-400">
                      {r.unallocatedAmount > 0 ? `${r.currency} ${r.unallocatedAmount.toLocaleString(undefined, { minimumFractionDigits: 2 })}` : "—"}
                    </td>

                    <td className="px-4 py-3.5 text-center">
                      {getStatusBadge(r.status)}
                    </td>

                    <td className="px-4 py-3.5 text-right space-x-1">
                      <Link
                        href={`/receipts/${r.id}`}
                        className="inline-flex p-1.5 text-slate-500 hover:text-emerald-600 rounded"
                        title="View Receipt"
                      >
                        <Eye className="w-4 h-4" />
                      </Link>

                      {r.status === "APPROVED" && (
                        <button
                          onClick={() => handlePost(r.id)}
                          disabled={isSubmitting}
                          className="px-2 py-1 text-xs font-bold rounded bg-emerald-600 hover:bg-emerald-700 text-white"
                        >
                          Post GL
                        </button>
                      )}

                      {r.status !== "CANCELLED" && (
                        <button
                          onClick={() => setSelectedForCancel(r)}
                          className="inline-flex p-1.5 text-slate-400 hover:text-rose-600 rounded"
                          title="Cancel/Reverse Receipt"
                        >
                          <Ban className="w-4 h-4" />
                        </button>
                      )}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Cancellation Dialog */}
      {selectedForCancel && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-sm p-4">
          <div className="w-full max-w-md bg-white dark:bg-slate-900 rounded-2xl shadow-xl border border-slate-200 dark:border-slate-800 p-6 space-y-4">
            <h3 className="text-lg font-bold text-rose-600 flex items-center gap-2">
              <Ban className="w-5 h-5" /> Cancel Receipt #{selectedForCancel.receiptNumber}
            </h3>
            <p className="text-xs text-slate-500">
              Cancelling a posted receipt reverses the GL entry and re-opens any settled customer invoices.
            </p>

            <div>
              <label className="block text-xs font-semibold mb-1">Reason *</label>
              <textarea
                rows={3}
                required
                value={cancelReason}
                onChange={(e) => setCancelReason(e.target.value)}
                placeholder="Reason for payment reversal..."
                className="w-full px-3 py-2 text-sm rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800"
              />
            </div>

            <div className="flex justify-end gap-3 pt-2">
              <button
                onClick={() => setSelectedForCancel(null)}
                className="px-4 py-2 text-xs font-medium rounded-lg border border-slate-200 dark:border-slate-700"
              >
                Close
              </button>
              <button
                disabled={isSubmitting || cancelReason.trim().length < 5}
                onClick={handleCancelSubmit}
                className="px-4 py-2 text-xs font-semibold rounded-lg bg-rose-600 hover:bg-rose-700 text-white disabled:opacity-50"
              >
                {isSubmitting ? "Reversing..." : "Confirm Cancellation & Reversal"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
