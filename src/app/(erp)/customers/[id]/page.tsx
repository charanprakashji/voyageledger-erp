import React from "react";
import Link from "next/link";
import { notFound } from "next/navigation";
import { getCustomerById } from "@/app/actions/customers";
import { Badge } from "@/components/ui/Badge";
import { formatCurrency, formatDate } from "@/lib/accounting";
import {
  ArrowLeft,
  Edit,
  DollarSign,
  CreditCard,
  ReceiptText,
  FileText,
} from "lucide-react";

export const dynamic = "force-dynamic";

interface CustomerDetailPageProps {
  params: Promise<{ id: string }>;
}

export default async function CustomerDetailPage({ params }: CustomerDetailPageProps) {
  const { id } = await params;
  let customer: any = null;

  try {
    customer = await getCustomerById(id);
  } catch (err) {
    customer = null;
  }

  if (!customer) {
    notFound();
  }

  const { ledgerSummary } = customer;

  return (
    <div className="max-w-7xl mx-auto space-y-6">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div className="flex items-center gap-3">
          <Link
            href="/customers"
            className="p-2 rounded-xl border border-slate-200 dark:border-slate-800 hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-500 transition-colors"
          >
            <ArrowLeft className="w-4 h-4" />
          </Link>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-xl font-bold text-slate-900 dark:text-white">
                {customer.name}
              </h1>
              <Badge variant={customer.isActive ? "success" : "danger"}>
                {customer.isActive ? "Active" : "Inactive"}
              </Badge>
              <Badge variant="neutral">{customer.type.replace("_", " ")}</Badge>
            </div>
            <p className="text-xs text-slate-400 mt-0.5">
              Code: <span className="font-semibold text-slate-600 dark:text-slate-300">{customer.code}</span>
              {customer.companyName && ` • Company: ${customer.companyName}`}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <Link
            href={`/customers/${customer.id}/edit`}
            className="inline-flex items-center gap-1.5 px-4 py-2 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 text-xs font-semibold rounded-xl transition-colors"
          >
            <Edit className="w-3.5 h-3.5" />
            <span>Edit Profile</span>
          </Link>
        </div>
      </div>

      {/* Financial Overview Cards (Derived from General Ledger) */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="p-5 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold uppercase tracking-wider text-slate-500">
              Outstanding Receivable (AR)
            </span>
            <div className="p-2 rounded-lg bg-blue-50 dark:bg-blue-950/40 text-blue-600 dark:text-blue-400">
              <DollarSign className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-3">
            <p className="text-2xl font-bold text-slate-900 dark:text-white">
              {formatCurrency(ledgerSummary?.outstandingBalanceAFN || 0, "AFN")}
            </p>
            <p className="text-[11px] text-slate-400 mt-0.5">
              Derived from General Ledger (1100 AR)
            </p>
          </div>
        </div>

        <div className="p-5 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold uppercase tracking-wider text-slate-500">
              Credit Limit
            </span>
            <div className="p-2 rounded-lg bg-indigo-50 dark:bg-indigo-950/40 text-indigo-600 dark:text-indigo-400">
              <CreditCard className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-3">
            <p className="text-2xl font-bold text-slate-900 dark:text-white">
              {formatCurrency(customer.creditLimit, customer.defaultCurrency)}
            </p>
            <p className="text-[11px] text-slate-400 mt-0.5">
              Terms: {customer.paymentTermsDays} Days
            </p>
          </div>
        </div>

        <div className="p-5 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold uppercase tracking-wider text-slate-500">
              Total Billed & Paid
            </span>
            <div className="p-2 rounded-lg bg-emerald-50 dark:bg-emerald-950/40 text-emerald-600 dark:text-emerald-400">
              <ReceiptText className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-3 text-xs space-y-1">
            <div className="flex justify-between">
              <span className="text-slate-400">Total Invoiced (Debits):</span>
              <span className="font-semibold text-slate-900 dark:text-white">
                {formatCurrency(ledgerSummary?.totalDebitsAFN || 0, "AFN")}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-400">Total Received (Credits):</span>
              <span className="font-semibold text-emerald-600 dark:text-emerald-400">
                {formatCurrency(ledgerSummary?.totalCreditsAFN || 0, "AFN")}
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Grid: Profile Info & GL Subsidiary Ledger */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left Column: Customer Details */}
        <div className="space-y-6">
          <div className="p-5 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-sm space-y-4 text-xs">
            <h3 className="font-bold text-sm text-slate-900 dark:text-white pb-2 border-b border-slate-100 dark:border-slate-800">
              Customer Information
            </h3>

            <div className="space-y-2.5">
              <div>
                <span className="text-slate-400 block text-[11px]">Contact Person</span>
                <span className="font-medium text-slate-800 dark:text-slate-200">
                  {customer.contactPerson || "-"}
                </span>
              </div>

              <div>
                <span className="text-slate-400 block text-[11px]">Primary Phone</span>
                <span className="font-medium text-slate-800 dark:text-slate-200">
                  {customer.phone || "-"}
                </span>
              </div>

              <div>
                <span className="text-slate-400 block text-[11px]">Email Address</span>
                <span className="font-medium text-slate-800 dark:text-slate-200">
                  {customer.email || "-"}
                </span>
              </div>

              <div>
                <span className="text-slate-400 block text-[11px]">Afghanistan Location</span>
                <span className="font-medium text-slate-800 dark:text-slate-200">
                  {customer.district ? `${customer.district}, ` : ""}
                  {customer.city || customer.province}, {customer.province},{" "}
                  {customer.country}
                </span>
              </div>

              <div>
                <span className="text-slate-400 block text-[11px]">Tax ID (TIN)</span>
                <span className="font-medium text-slate-800 dark:text-slate-200">
                  {customer.taxNumber || "Not registered"}
                </span>
              </div>

              <div>
                <span className="text-slate-400 block text-[11px]">Customer Since</span>
                <span className="font-medium text-slate-800 dark:text-slate-200">
                  {formatDate(customer.createdAt)}
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* Right Column: Derived Accounts Receivable Subsidiary Ledger */}
        <div className="lg:col-span-2 space-y-6">
          <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-sm overflow-hidden">
            <div className="p-4 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between">
              <div>
                <h3 className="font-bold text-sm text-slate-900 dark:text-white">
                  Accounts Receivable Subsidiary Ledger
                </h3>
                <p className="text-[11px] text-slate-400">
                  Derived dynamically from POSTED General Ledger journal entries (Single Source of Truth)
                </p>
              </div>
              <Badge variant="info">GL Derived</Badge>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-50 dark:bg-slate-800/60 border-b border-slate-200 dark:border-slate-800 text-slate-500 uppercase tracking-wider text-[11px] font-semibold">
                  <tr>
                    <th className="py-2.5 px-3">Date</th>
                    <th className="py-2.5 px-3">Entry #</th>
                    <th className="py-2.5 px-3">Description</th>
                    <th className="py-2.5 px-3 text-right">Debit (AFN)</th>
                    <th className="py-2.5 px-3 text-right">Credit (AFN)</th>
                    <th className="py-2.5 px-3 text-right">Balance (AFN)</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                  {!ledgerSummary || ledgerSummary.transactions.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="py-8 text-center text-slate-400">
                        <FileText className="w-6 h-6 mx-auto mb-1 opacity-40" />
                        <p className="font-medium text-slate-600 dark:text-slate-300">
                          No accounting transactions posted yet
                        </p>
                        <p className="text-[11px] text-slate-400 mt-0.5">
                          Invoices and receipts will dynamically record double-entry transactions here.
                        </p>
                      </td>
                    </tr>
                  ) : (
                    ledgerSummary.transactions.map((tx: any) => (
                      <tr key={tx.id} className="hover:bg-slate-50/60 dark:hover:bg-slate-800/40">
                        <td className="py-2.5 px-3 text-slate-500 whitespace-nowrap">
                          {formatDate(tx.entryDate)}
                        </td>
                        <td className="py-2.5 px-3 font-semibold text-blue-600">
                          {tx.entryNumber}
                        </td>
                        <td className="py-2.5 px-3 text-slate-700 dark:text-slate-300">
                          {tx.description}
                        </td>
                        <td className="py-2.5 px-3 text-right font-medium text-slate-900 dark:text-white">
                          {tx.debitAFN.isZero() ? "-" : formatCurrency(tx.debitAFN, "AFN")}
                        </td>
                        <td className="py-2.5 px-3 text-right font-medium text-emerald-600 dark:text-emerald-400">
                          {tx.creditAFN.isZero() ? "-" : formatCurrency(tx.creditAFN, "AFN")}
                        </td>
                        <td className="py-2.5 px-3 text-right font-bold text-slate-900 dark:text-white">
                          {formatCurrency(tx.runningBalanceAFN, "AFN")}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
