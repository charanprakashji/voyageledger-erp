"use client";

import React, { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  ArrowLeft,
  CheckCircle2,
  Clock,
  Ban,
  Printer,
  DollarSign,
  Shield,
  FileText,
  AlertCircle,
  Receipt,
  BookOpen,
} from "lucide-react";
import { InvoiceStatus } from "@prisma/client";
import { approveInvoice, postInvoice, cancelInvoice } from "@/app/actions/invoices";

interface InvoiceDetailViewProps {
  invoice: any;
}

export function InvoiceDetailView({ invoice }: InvoiceDetailViewProps) {
  const router = useRouter();
  const [isCancelling, setIsCancelling] = useState(false);
  const [cancelReason, setCancelReason] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);

  const handleApprove = async () => {
    setIsSubmitting(true);
    setActionError(null);
    try {
      const res = await approveInvoice(invoice.id);
      if (res.success) {
        router.refresh();
      } else {
        setActionError(res.error || "Failed to approve invoice");
      }
    } catch (err: any) {
      setActionError(err.message || "An error occurred");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handlePost = async () => {
    setIsSubmitting(true);
    setActionError(null);
    try {
      const res = await postInvoice(invoice.id);
      if (res.success) {
        router.refresh();
      } else {
        setActionError(res.error || "Failed to post invoice to General Ledger");
      }
    } catch (err: any) {
      setActionError(err.message || "An error occurred");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleCancelSubmit = async () => {
    if (!cancelReason.trim()) return;
    setIsSubmitting(true);
    setActionError(null);
    try {
      const res = await cancelInvoice(invoice.id, cancelReason);
      if (res.success) {
        setIsCancelling(false);
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
          <span className="inline-flex items-center gap-1 px-3 py-1 rounded-full text-xs font-bold bg-blue-100 text-blue-800 dark:bg-blue-950/60 dark:text-blue-300">
            <CheckCircle2 className="w-3.5 h-3.5" /> POSTED (GL)
          </span>
        );
      case "PAID":
        return (
          <span className="inline-flex items-center gap-1 px-3 py-1 rounded-full text-xs font-bold bg-emerald-100 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300">
            <CheckCircle2 className="w-3.5 h-3.5" /> PAID
          </span>
        );
      case "PARTIALLY_PAID":
        return (
          <span className="inline-flex items-center gap-1 px-3 py-1 rounded-full text-xs font-bold bg-amber-100 text-amber-800 dark:bg-amber-950/60 dark:text-amber-300">
            PARTIALLY PAID
          </span>
        );
      case "APPROVED":
        return (
          <span className="inline-flex items-center gap-1 px-3 py-1 rounded-full text-xs font-bold bg-indigo-100 text-indigo-800 dark:bg-indigo-950/60 dark:text-indigo-300">
            APPROVED
          </span>
        );
      case "DRAFT":
        return (
          <span className="inline-flex items-center gap-1 px-3 py-1 rounded-full text-xs font-bold bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300">
            DRAFT
          </span>
        );
      case "CANCELLED":
        return (
          <span className="inline-flex items-center gap-1 px-3 py-1 rounded-full text-xs font-bold bg-rose-100 text-rose-800 dark:bg-rose-950/60 dark:text-rose-300">
            <Ban className="w-3.5 h-3.5" /> CANCELLED
          </span>
        );
    }
  };

  return (
    <div className="space-y-8 max-w-7xl mx-auto pb-16">
      {/* Header Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-200 dark:border-slate-800 pb-5">
        <div className="flex items-center gap-3">
          <Link
            href="/invoices"
            className="p-1.5 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg transition-colors"
          >
            <ArrowLeft className="w-5 h-5" />
          </Link>
          <div>
            <div className="flex items-center gap-3">
              <h1 className="text-2xl font-bold text-slate-900 dark:text-white font-mono">
                {invoice.invoiceNumber}
              </h1>
              {getStatusBadge(invoice.status)}
            </div>
            <p className="text-xs text-slate-500 mt-1">
              Issued: {new Date(invoice.issueDate).toLocaleDateString()} | Due: {new Date(invoice.dueDate).toLocaleDateString()}
            </p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {invoice.status === "DRAFT" && (
            <button
              onClick={handleApprove}
              disabled={isSubmitting}
              className="px-4 py-2 text-xs font-bold rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white shadow-sm"
            >
              Approve Invoice
            </button>
          )}

          {invoice.status === "APPROVED" && (
            <button
              onClick={handlePost}
              disabled={isSubmitting}
              className="inline-flex items-center gap-1.5 px-5 py-2 text-xs font-bold rounded-lg bg-blue-600 hover:bg-blue-700 text-white shadow-sm"
            >
              <CheckCircle2 className="w-3.5 h-3.5" /> Post to General Ledger
            </button>
          )}

          {invoice.status !== "CANCELLED" && (
            <button
              onClick={() => setIsCancelling(true)}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold rounded-lg bg-rose-50 dark:bg-rose-950/40 text-rose-700 dark:text-rose-300 hover:bg-rose-100"
            >
              <Ban className="w-3.5 h-3.5" /> Cancel / Reverse
            </button>
          )}

          <button
            onClick={() => window.print()}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-300"
          >
            <Printer className="w-3.5 h-3.5" /> Print
          </button>
        </div>
      </div>

      {actionError && (
        <div className="p-4 bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-900 text-rose-700 dark:text-rose-300 text-sm rounded-xl flex items-center gap-3">
          <AlertCircle className="w-5 h-5 shrink-0" />
          <span>{actionError}</span>
        </div>
      )}

      {/* Linked General Ledger Journal Entry Card */}
      {invoice.journalEntry && (
        <div className="p-5 rounded-2xl border-2 border-blue-500/30 bg-blue-50/40 dark:bg-blue-950/20 space-y-3">
          <div className="flex items-center justify-between">
            <h3 className="text-xs font-bold text-blue-800 dark:text-blue-300 uppercase tracking-wider flex items-center gap-2">
              <Shield className="w-4 h-4 text-blue-600" />
              Posted to General Ledger — Journal #{invoice.journalEntry.entryNumber}
            </h3>
            <span className="text-xs font-mono text-slate-500">
              Posted on {new Date(invoice.journalEntry.postedAt || invoice.journalEntry.createdAt).toLocaleString()}
            </span>
          </div>

          <div className="overflow-x-auto rounded-xl border border-blue-200 dark:border-blue-900/60 bg-white dark:bg-slate-900">
            <table className="w-full text-xs text-left text-slate-600 dark:text-slate-300">
              <thead className="bg-slate-50 dark:bg-slate-800 text-slate-400 font-semibold border-b border-slate-100 dark:border-slate-800 uppercase">
                <tr>
                  <th className="px-3.5 py-2">GL Account</th>
                  <th className="px-3.5 py-2">Line Memo</th>
                  <th className="px-3.5 py-2 text-right">Debit (AFN)</th>
                  <th className="px-3.5 py-2 text-right">Credit (AFN)</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800 font-mono">
                {invoice.journalEntry.lines?.map((line: any) => (
                  <tr key={line.id}>
                    <td className="px-3.5 py-2 font-sans font-medium text-slate-900 dark:text-white">
                      {line.account?.code} - {line.account?.name}
                    </td>
                    <td className="px-3.5 py-2 font-sans text-slate-500">{line.description}</td>
                    <td className="px-3.5 py-2 text-right font-bold text-slate-900 dark:text-white">
                      {Number(line.debit) > 0 ? Number(line.debit).toLocaleString(undefined, { minimumFractionDigits: 2 }) : "—"}
                    </td>
                    <td className="px-3.5 py-2 text-right font-bold text-slate-900 dark:text-white">
                      {Number(line.credit) > 0 ? Number(line.credit).toLocaleString(undefined, { minimumFractionDigits: 2 }) : "—"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Invoice Overview & Financials Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="p-6 rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-sm space-y-4">
          <h2 className="text-sm font-bold text-slate-900 dark:text-white uppercase tracking-wider border-b border-slate-100 dark:border-slate-800 pb-2">
            Billed Customer
          </h2>

          <div className="space-y-2 text-sm">
            <Link
              href={`/customers/${invoice.customer?.id}`}
              className="font-bold text-blue-600 hover:underline block"
            >
              {invoice.customer?.name} ({invoice.customer?.code})
            </Link>
            {invoice.customer?.companyName && (
              <p className="text-xs text-slate-500">{invoice.customer.companyName}</p>
            )}
            <p className="text-xs text-slate-600 dark:text-slate-400">
              {invoice.customer?.address}, {invoice.customer?.city}, {invoice.customer?.country}
            </p>
            {invoice.customer?.taxNumber && (
              <p className="text-xs text-slate-500 font-mono">TIN: {invoice.customer.taxNumber}</p>
            )}

            {invoice.booking && (
              <div className="pt-3 border-t border-slate-100 dark:border-slate-800">
                <p className="text-xs text-slate-400">Linked Travel Booking</p>
                <Link
                  href={`/bookings/${invoice.booking.id}`}
                  className="font-mono font-bold text-blue-600 hover:underline text-xs"
                >
                  {invoice.booking.bookingNumber}
                </Link>
              </div>
            )}
          </div>
        </div>

        <div className="lg:col-span-2 p-6 rounded-2xl border-2 border-blue-500/20 bg-gradient-to-br from-slate-900 to-slate-950 text-white shadow-xl space-y-6">
          <div className="flex items-center justify-between border-b border-slate-800 pb-3">
            <h2 className="text-sm font-bold text-blue-400 uppercase tracking-wider flex items-center gap-2">
              <DollarSign className="w-4 h-4" /> Financial Breakdown
            </h2>
            <span className="text-xs text-slate-400 font-mono">
              1 {invoice.currency} = {invoice.exchangeRate} AFN
            </span>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            <div>
              <p className="text-xs text-slate-400">Foreign Subtotal</p>
              <p className="text-lg font-bold text-white font-mono mt-1">
                {invoice.currency} {invoice.foreignSubTotal.toLocaleString(undefined, { minimumFractionDigits: 2 })}
              </p>
            </div>

            <div>
              <p className="text-xs text-slate-400">Tax Amount</p>
              <p className="text-lg font-bold text-amber-400 font-mono mt-1">
                {invoice.currency} {invoice.taxAmount.toLocaleString(undefined, { minimumFractionDigits: 2 })}
              </p>
            </div>

            <div>
              <p className="text-xs text-slate-400">Grand Total ({invoice.currency})</p>
              <p className="text-2xl font-black text-blue-400 font-mono mt-1">
                {invoice.currency} {invoice.grandTotal.toLocaleString(undefined, { minimumFractionDigits: 2 })}
              </p>
            </div>

            <div className="p-3 rounded-xl bg-blue-950/40 border border-blue-800/40">
              <p className="text-xs font-semibold text-blue-300 uppercase tracking-wider">GL Base Total</p>
              <p className="text-2xl font-black text-emerald-400 font-mono mt-1">
                {invoice.baseGrandTotal.toLocaleString(undefined, { minimumFractionDigits: 2 })}{" "}
                <span className="text-xs font-normal text-slate-300">AFN</span>
              </p>
            </div>
          </div>

          <div className="p-4 rounded-xl bg-slate-800/40 border border-slate-700/60 flex items-center justify-between text-sm">
            <div>
              <p className="text-xs text-slate-400">Settled Receipts: <strong className="text-emerald-400 font-mono">{invoice.currency} {invoice.paidAmount.toLocaleString(undefined, { minimumFractionDigits: 2 })}</strong></p>
            </div>
            <div>
              <p className="text-xs text-slate-400">Balance Due: <strong className="text-rose-400 text-lg font-mono">{invoice.currency} {invoice.balanceDue.toLocaleString(undefined, { minimumFractionDigits: 2 })}</strong></p>
            </div>
          </div>
        </div>
      </div>

      {/* Lines Table */}
      <div className="p-6 rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-sm space-y-4">
        <h2 className="text-base font-bold text-slate-900 dark:text-white flex items-center gap-2">
          <FileText className="w-5 h-5 text-indigo-600" />
          Invoice Service Lines ({invoice.lines?.length || 0})
        </h2>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs text-slate-600 dark:text-slate-300">
            <thead className="bg-slate-50 dark:bg-slate-800 text-slate-400 font-semibold border-b border-slate-200 dark:border-slate-800 uppercase">
              <tr>
                <th className="px-4 py-3">#</th>
                <th className="px-4 py-3">Description</th>
                <th className="px-4 py-3">Service</th>
                <th className="px-4 py-3">Revenue Account</th>
                <th className="px-4 py-3 text-center">Qty</th>
                <th className="px-4 py-3 text-right">Unit Price ({invoice.currency})</th>
                <th className="px-4 py-3 text-right">Total ({invoice.currency})</th>
                <th className="px-4 py-3 text-right">Total (AFN)</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800 font-medium">
              {invoice.lines?.map((line: any, idx: number) => (
                <tr key={line.id || idx} className="hover:bg-slate-50/60 dark:hover:bg-slate-800/30">
                  <td className="px-4 py-3 font-bold text-slate-400">{idx + 1}</td>
                  <td className="px-4 py-3 font-bold text-slate-900 dark:text-white">
                    {line.description}
                  </td>
                  <td className="px-4 py-3">
                    <span className="px-2 py-0.5 rounded bg-blue-50 dark:bg-blue-950 text-blue-700 dark:text-blue-300 font-semibold">
                      {line.serviceType}
                    </span>
                  </td>
                  <td className="px-4 py-3 font-mono text-slate-500">
                    {line.revenueAccount ? `${line.revenueAccount.code} - ${line.revenueAccount.name}` : "—"}
                  </td>
                  <td className="px-4 py-3 text-center font-mono">{line.quantity}</td>
                  <td className="px-4 py-3 text-right font-mono text-slate-700 dark:text-slate-300">
                    {line.unitPriceForeign.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                  </td>
                  <td className="px-4 py-3 text-right font-mono font-bold text-slate-900 dark:text-white">
                    {line.totalAmountForeign.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                  </td>
                  <td className="px-4 py-3 text-right font-mono font-bold text-blue-600 dark:text-blue-400">
                    {line.totalAmountBase.toLocaleString(undefined, { minimumFractionDigits: 2 })} AFN
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Receipts Allocated */}
      {invoice.receiptAllocations && invoice.receiptAllocations.length > 0 && (
        <div className="p-6 rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-sm space-y-4">
          <h2 className="text-base font-bold text-slate-900 dark:text-white flex items-center gap-2">
            <Receipt className="w-5 h-5 text-emerald-600" />
            Payment Allocations & Receipts ({invoice.receiptAllocations.length})
          </h2>

          <div className="space-y-2">
            {invoice.receiptAllocations.map((alloc: any) => (
              <div
                key={alloc.id}
                className="p-3.5 rounded-xl border border-slate-100 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-800/30 flex items-center justify-between text-xs font-mono"
              >
                <div>
                  Receipt: <Link href={`/receipts/${alloc.receipt?.id}`} className="font-bold text-blue-600 hover:underline">{alloc.receipt?.receiptNumber}</Link>
                  <span className="text-slate-400 ml-2">Allocated on {new Date(alloc.allocatedAt).toLocaleDateString()}</span>
                </div>
                <div className="font-bold text-emerald-600">
                  {alloc.amountForeign.toLocaleString(undefined, { minimumFractionDigits: 2 })} ({alloc.amountBase.toLocaleString(undefined, { minimumFractionDigits: 2 })} AFN)
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Cancel Dialog */}
      {isCancelling && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-sm p-4">
          <div className="w-full max-w-md bg-white dark:bg-slate-900 rounded-2xl shadow-xl border border-slate-200 dark:border-slate-800 p-6 space-y-4">
            <h3 className="text-lg font-bold text-rose-600 flex items-center gap-2">
              <Ban className="w-5 h-5" /> Cancel Invoice #{invoice.invoiceNumber}
            </h3>
            <p className="text-xs text-slate-500">
              A cancellation reason is required. If posted to GL, a reversing entry will be recorded.
            </p>

            <div>
              <label className="block text-xs font-semibold mb-1">Reason *</label>
              <textarea
                rows={3}
                required
                value={cancelReason}
                onChange={(e) => setCancelReason(e.target.value)}
                placeholder="Cancellation reason..."
                className="w-full px-3 py-2 text-sm rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800"
              />
            </div>

            <div className="flex justify-end gap-3 pt-2">
              <button
                onClick={() => setIsCancelling(false)}
                className="px-4 py-2 text-xs font-medium rounded-lg border border-slate-200 dark:border-slate-700"
              >
                Close
              </button>
              <button
                disabled={isSubmitting || cancelReason.trim().length < 5}
                onClick={handleCancelSubmit}
                className="px-4 py-2 text-xs font-semibold rounded-lg bg-rose-600 hover:bg-rose-700 text-white disabled:opacity-50"
              >
                {isSubmitting ? "Cancelling..." : "Confirm Cancellation"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
