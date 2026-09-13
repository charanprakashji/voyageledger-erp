"use client";

import React, { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  Search,
  Plus,
  FileText,
  CheckCircle2,
  Clock,
  Ban,
  Eye,
  DollarSign,
  AlertCircle,
  Calendar,
} from "lucide-react";
import { InvoiceStatus } from "@prisma/client";
import { postInvoice, cancelInvoice } from "@/app/actions/invoices";

interface InvoiceListTableProps {
  initialData: any[];
  pagination: {
    total: number;
    page: number;
    limit: number;
    totalPages: number;
  };
  customers: Array<{ id: string; name: string; code: string }>;
}

export function InvoiceListTable({
  initialData,
  pagination,
  customers,
}: InvoiceListTableProps) {
  const router = useRouter();
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("ALL");
  const [customerFilter, setCustomerFilter] = useState<string>("ALL");
  const [selectedForCancel, setSelectedForCancel] = useState<any | null>(null);
  const [cancelReason, setCancelReason] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);

  const filteredInvoices = initialData.filter((inv) => {
    if (statusFilter !== "ALL" && inv.status !== statusFilter) return false;
    if (customerFilter !== "ALL" && inv.customerId !== customerFilter) return false;
    if (searchTerm) {
      const s = searchTerm.toLowerCase();
      const matchNum = inv.invoiceNumber?.toLowerCase().includes(s);
      const matchCust = inv.customer?.name?.toLowerCase().includes(s) || inv.customer?.companyName?.toLowerCase().includes(s);
      const matchBkg = inv.booking?.bookingNumber?.toLowerCase().includes(s);
      if (!matchNum && !matchCust && !matchBkg) return false;
    }
    return true;
  });

  const totalInvoiced = initialData.reduce((acc, inv) => acc + (inv.baseGrandTotal || 0), 0);
  const totalReceived = initialData.reduce((acc, inv) => acc + (inv.paidAmount * (inv.exchangeRate || 1)), 0);
  const totalOutstanding = initialData.reduce((acc, inv) => acc + (inv.balanceDue * (inv.exchangeRate || 1)), 0);

  const handlePost = async (id: string) => {
    setIsSubmitting(true);
    setActionError(null);
    try {
      const res = await postInvoice(id);
      if (res.success) {
        router.refresh();
      } else {
        setActionError(res.error || "Failed to post invoice");
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
      const res = await cancelInvoice(selectedForCancel.id, cancelReason);
      if (res.success) {
        setSelectedForCancel(null);
        setCancelReason("");
        router.refresh();
      } else {
        setActionError(res.error || "Failed to cancel invoice");
      }
    } catch (err: any) {
      setActionError(err.message || "An error occurred");
    } finally {
      setIsSubmitting(false);
    }
  };

  const getStatusBadge = (status: InvoiceStatus) => {
    switch (status) {
      case "POSTED":
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-blue-100 text-blue-800 dark:bg-blue-950/60 dark:text-blue-300">
            <CheckCircle2 className="w-3 h-3" /> POSTED (GL)
          </span>
        );
      case "PAID":
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-emerald-100 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300">
            <CheckCircle2 className="w-3 h-3" /> PAID
          </span>
        );
      case "PARTIALLY_PAID":
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-amber-100 text-amber-800 dark:bg-amber-950/60 dark:text-amber-300">
            PARTIAL
          </span>
        );
      case "APPROVED":
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-indigo-100 text-indigo-800 dark:bg-indigo-950/60 dark:text-indigo-300">
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
      {/* KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="p-4 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-sm">
          <p className="text-xs font-medium text-slate-500 uppercase tracking-wider">Total Invoiced (AFN)</p>
          <p className="text-2xl font-bold text-slate-900 dark:text-white mt-2 font-mono">
            {totalInvoiced.toLocaleString(undefined, { minimumFractionDigits: 2 })}
          </p>
        </div>

        <div className="p-4 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-sm">
          <p className="text-xs font-medium text-slate-500 uppercase tracking-wider">Settled Receipts (AFN)</p>
          <p className="text-2xl font-bold text-emerald-600 dark:text-emerald-400 mt-2 font-mono">
            {totalReceived.toLocaleString(undefined, { minimumFractionDigits: 2 })}
          </p>
        </div>

        <div className="p-4 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-sm">
          <p className="text-xs font-medium text-slate-500 uppercase tracking-wider">Outstanding Receivable (AFN)</p>
          <p className="text-2xl font-bold text-rose-600 dark:text-rose-400 mt-2 font-mono">
            {totalOutstanding.toLocaleString(undefined, { minimumFractionDigits: 2 })}
          </p>
        </div>
      </div>

      {actionError && (
        <div className="p-4 bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-900 text-rose-700 dark:text-rose-300 text-xs rounded-xl flex items-center gap-2">
          <AlertCircle className="w-4 h-4" /> {actionError}
        </div>
      )}

      {/* Filter and Action Bar */}
      <div className="p-4 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-sm flex flex-col md:flex-row gap-4 justify-between items-stretch md:items-center">
        <div className="relative flex-1 max-w-md">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            placeholder="Search invoice #, customer name, booking..."
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
            <option value="PARTIALLY_PAID">Partially Paid</option>
            <option value="PAID">Paid</option>
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
            href="/invoices/new"
            className="inline-flex items-center gap-2 px-4 py-2 text-sm font-semibold rounded-lg bg-blue-600 hover:bg-blue-700 text-white shadow-sm transition-colors"
          >
            <Plus className="w-4 h-4" /> Create Invoice
          </Link>
        </div>
      </div>

      {/* Table */}
      <div className="overflow-hidden rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm text-slate-600 dark:text-slate-300">
            <thead className="bg-slate-50 dark:bg-slate-800/60 text-xs uppercase font-semibold text-slate-500 dark:text-slate-400 border-b border-slate-200 dark:border-slate-800">
              <tr>
                <th className="px-4 py-3.5">Invoice #</th>
                <th className="px-4 py-3.5">Customer / Booking</th>
                <th className="px-4 py-3.5">Issue Date</th>
                <th className="px-4 py-3.5">Currency / Rate</th>
                <th className="px-4 py-3.5 text-right">Invoice Total</th>
                <th className="px-4 py-3.5 text-right">Base Total (AFN)</th>
                <th className="px-4 py-3.5 text-right">Balance Due</th>
                <th className="px-4 py-3.5 text-center">Status</th>
                <th className="px-4 py-3.5 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800 font-medium">
              {filteredInvoices.length === 0 ? (
                <tr>
                  <td colSpan={9} className="px-6 py-12 text-center text-slate-400">
                    <FileText className="w-8 h-8 mx-auto mb-2 text-slate-300 dark:text-slate-600" />
                    <p className="font-semibold text-slate-700 dark:text-slate-300">No invoices found</p>
                  </td>
                </tr>
              ) : (
                filteredInvoices.map((inv) => (
                  <tr key={inv.id} className="hover:bg-slate-50/60 dark:hover:bg-slate-800/30">
                    <td className="px-4 py-3.5">
                      <Link
                        href={`/invoices/${inv.id}`}
                        className="font-bold text-slate-900 dark:text-white hover:text-blue-600 font-mono"
                      >
                        {inv.invoiceNumber}
                      </Link>
                    </td>

                    <td className="px-4 py-3.5">
                      <div className="font-medium text-slate-900 dark:text-white">
                        {inv.customer?.name}
                      </div>
                      {inv.booking && (
                        <div className="text-xs text-slate-400 font-mono">
                          Booking: {inv.booking.bookingNumber}
                        </div>
                      )}
                    </td>

                    <td className="px-4 py-3.5 text-xs">
                      {new Date(inv.issueDate).toLocaleDateString()}
                    </td>

                    <td className="px-4 py-3.5 text-xs font-mono">
                      {inv.currency} @ {inv.exchangeRate}
                    </td>

                    <td className="px-4 py-3.5 text-right font-bold text-slate-900 dark:text-white font-mono">
                      {inv.currency} {inv.grandTotal.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                    </td>

                    <td className="px-4 py-3.5 text-right font-bold text-blue-600 dark:text-blue-400 font-mono">
                      {inv.baseGrandTotal.toLocaleString(undefined, { minimumFractionDigits: 2 })} AFN
                    </td>

                    <td className="px-4 py-3.5 text-right font-mono text-rose-600 dark:text-rose-400">
                      {inv.currency} {inv.balanceDue.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                    </td>

                    <td className="px-4 py-3.5 text-center">
                      {getStatusBadge(inv.status)}
                    </td>

                    <td className="px-4 py-3.5 text-right space-x-1">
                      <Link
                        href={`/invoices/${inv.id}`}
                        className="inline-flex p-1.5 text-slate-500 hover:text-blue-600 rounded"
                        title="View Invoice"
                      >
                        <Eye className="w-4 h-4" />
                      </Link>

                      {inv.status === "APPROVED" && (
                        <button
                          onClick={() => handlePost(inv.id)}
                          disabled={isSubmitting}
                          className="px-2 py-1 text-xs font-bold rounded bg-blue-600 hover:bg-blue-700 text-white"
                        >
                          Post GL
                        </button>
                      )}

                      {inv.status !== "CANCELLED" && (
                        <button
                          onClick={() => setSelectedForCancel(inv)}
                          className="inline-flex p-1.5 text-slate-400 hover:text-rose-600 rounded"
                          title="Cancel/Reverse Invoice"
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
              <Ban className="w-5 h-5" /> Cancel Invoice #{selectedForCancel.invoiceNumber}
            </h3>
            <p className="text-xs text-slate-500">
              If this invoice was posted to the General Ledger, an atomic reversal Journal Entry will be generated.
            </p>

            <div>
              <label className="block text-xs font-semibold mb-1">Reason *</label>
              <textarea
                rows={3}
                required
                value={cancelReason}
                onChange={(e) => setCancelReason(e.target.value)}
                placeholder="Detailed reason for cancellation/reversal..."
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
                {isSubmitting ? "Cancelling..." : "Confirm Cancellation & GL Reversal"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
