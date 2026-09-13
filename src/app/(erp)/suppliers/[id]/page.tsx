import React from "react";
import Link from "next/link";
import { notFound } from "next/navigation";
import { getSupplierById } from "@/app/actions/suppliers";
import { Badge } from "@/components/ui/Badge";
import { formatCurrency, formatDate } from "@/lib/accounting";
import {
  ArrowLeft,
  Edit,
  Building2,
  Phone,
  Mail,
  Scale,
  ReceiptText,
  DollarSign,
  FileText,
} from "lucide-react";

export const dynamic = "force-dynamic";

interface SupplierDetailPageProps {
  params: Promise<{ id: string }>;
}

export default async function SupplierDetailPage({ params }: SupplierDetailPageProps) {
  const { id } = await params;
  let supplier: any = null;

  try {
    supplier = await getSupplierById(id);
  } catch (err) {
    supplier = null;
  }

  if (!supplier) {
    notFound();
  }

  const { ledgerSummary } = supplier;

  return (
    <div className="max-w-7xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div className="flex items-center gap-3">
          <Link
            href="/suppliers"
            className="p-2 rounded-xl border border-slate-200 dark:border-slate-800 hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-500 transition-colors"
          >
            <ArrowLeft className="w-4 h-4" />
          </Link>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-xl font-bold text-slate-900 dark:text-white">
                {supplier.name}
              </h1>
              <Badge variant={supplier.isActive ? "success" : "danger"}>
                {supplier.isActive ? "Active" : "Inactive"}
              </Badge>
              <Badge variant="info">{supplier.type.replace("_", " ")}</Badge>
            </div>
            <p className="text-xs text-slate-400 mt-0.5">
              Code: <span className="font-semibold text-slate-600 dark:text-slate-300">{supplier.code}</span>
              {" • Currency: "}<span className="font-semibold text-slate-600 dark:text-slate-300">{supplier.currency}</span>
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <Link
            href={`/suppliers/${supplier.id}/edit`}
            className="inline-flex items-center gap-1.5 px-4 py-2 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 text-xs font-semibold rounded-xl transition-colors"
          >
            <Edit className="w-3.5 h-3.5" />
            <span>Edit Supplier</span>
          </Link>
        </div>
      </div>

      {/* Financial Overview Cards (Derived from General Ledger) */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="p-5 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold uppercase tracking-wider text-slate-500">
              Outstanding Payable (AP)
            </span>
            <div className="p-2 rounded-lg bg-rose-50 dark:bg-rose-950/40 text-rose-600 dark:text-rose-400">
              <Scale className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-3">
            <p className="text-2xl font-bold text-slate-900 dark:text-white">
              {formatCurrency(ledgerSummary?.outstandingPayableAFN || 0, "AFN")}
            </p>
            <p className="text-[11px] text-slate-400 mt-0.5">
              Derived from General Ledger (2010 AP)
            </p>
          </div>
        </div>

        <div className="p-5 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold uppercase tracking-wider text-slate-500">
              Settlement Terms
            </span>
            <div className="p-2 rounded-lg bg-purple-50 dark:bg-purple-950/40 text-purple-600 dark:text-purple-400">
              <Building2 className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-3">
            <p className="text-2xl font-bold text-slate-900 dark:text-white">
              {supplier.paymentTermsDays} Days
            </p>
            <p className="text-[11px] text-slate-400 mt-0.5">
              Settlement Currency: {supplier.currency}
            </p>
          </div>
        </div>

        <div className="p-5 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold uppercase tracking-wider text-slate-500">
              Total Costs & Disbursements
            </span>
            <div className="p-2 rounded-lg bg-emerald-50 dark:bg-emerald-950/40 text-emerald-600 dark:text-emerald-400">
              <ReceiptText className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-3 text-xs space-y-1">
            <div className="flex justify-between">
              <span className="text-slate-400">Total Billed Costs (Credits):</span>
              <span className="font-semibold text-slate-900 dark:text-white">
                {formatCurrency(ledgerSummary?.totalCreditsAFN || 0, "AFN")}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-400">Total Paid (Debits):</span>
              <span className="font-semibold text-emerald-600 dark:text-emerald-400">
                {formatCurrency(ledgerSummary?.totalDebitsAFN || 0, "AFN")}
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Details & Subsidiary Ledger */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left Column */}
        <div className="space-y-6">
          <div className="p-5 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-sm space-y-4 text-xs">
            <h3 className="font-bold text-sm text-slate-900 dark:text-white pb-2 border-b border-slate-100 dark:border-slate-800">
              Supplier Details
            </h3>

            <div className="space-y-2.5">
              <div>
                <span className="text-slate-400 block text-[11px]">Contact Person</span>
                <span className="font-medium text-slate-800 dark:text-slate-200">
                  {supplier.contactPerson || "-"}
                </span>
              </div>

              <div>
                <span className="text-slate-400 block text-[11px]">Phone Number</span>
                <span className="font-medium text-slate-800 dark:text-slate-200">
                  {supplier.phone || "-"}
                </span>
              </div>

              <div>
                <span className="text-slate-400 block text-[11px]">Email Address</span>
                <span className="font-medium text-slate-800 dark:text-slate-200">
                  {supplier.email || "-"}
                </span>
              </div>

              <div>
                <span className="text-slate-400 block text-[11px]">Tax Identification (TIN)</span>
                <span className="font-medium text-slate-800 dark:text-slate-200">
                  {supplier.taxNumber || "Not registered"}
                </span>
              </div>

              <div>
                <span className="text-slate-400 block text-[11px]">Bank / Hawala Details</span>
                <p className="font-medium text-slate-800 dark:text-slate-200 whitespace-pre-wrap">
                  {supplier.bankDetails || "None provided"}
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* Right Column: Derived Accounts Payable Subsidiary Ledger */}
        <div className="lg:col-span-2 space-y-6">
          <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-sm overflow-hidden">
            <div className="p-4 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between">
              <div>
                <h3 className="font-bold text-sm text-slate-900 dark:text-white">
                  Accounts Payable Subsidiary Ledger
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
                    <th className="py-2.5 px-3 text-right">Debit / Paid (AFN)</th>
                    <th className="py-2.5 px-3 text-right">Credit / Cost (AFN)</th>
                    <th className="py-2.5 px-3 text-right">Balance Payable (AFN)</th>
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
                          Supplier service bookings and expense disbursements will record double-entry entries here.
                        </p>
                      </td>
                    </tr>
                  ) : (
                    ledgerSummary.transactions.map((tx: any) => (
                      <tr key={tx.id} className="hover:bg-slate-50/60 dark:hover:bg-slate-800/40">
                        <td className="py-2.5 px-3 text-slate-500 whitespace-nowrap">
                          {formatDate(tx.entryDate)}
                        </td>
                        <td className="py-2.5 px-3 font-semibold text-purple-600">
                          {tx.entryNumber}
                        </td>
                        <td className="py-2.5 px-3 text-slate-700 dark:text-slate-300">
                          {tx.description}
                        </td>
                        <td className="py-2.5 px-3 text-right font-medium text-emerald-600 dark:text-emerald-400">
                          {tx.debitAFN.isZero() ? "-" : formatCurrency(tx.debitAFN, "AFN")}
                        </td>
                        <td className="py-2.5 px-3 text-right font-medium text-slate-900 dark:text-white">
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
