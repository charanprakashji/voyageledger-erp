import React from "react";
import prisma from "@/lib/prisma";
import { getSupplierBillById, approveSupplierBill, postSupplierBill, cancelSupplierBill } from "@/app/actions/bills";
import {
  FileText,
  ArrowLeft,
  CheckCircle,
  Clock,
  Ban,
  Building2,
  Calendar,
  DollarSign,
  ShieldCheck,
  Send,
  Check,
  XCircle,
} from "lucide-react";
import Link from "next/link";
import { notFound } from "next/navigation";

export const dynamic = "force-dynamic";

interface SupplierBillDetailPageProps {
  params: Promise<{ id: string }>;
}

export default async function SupplierBillDetailPage({ params }: SupplierBillDetailPageProps) {
  const { id } = await params;
  const res = await getSupplierBillById(id);

  if (!res.success || !res.data) {
    notFound();
  }

  const bill = res.data;

  return (
    <div className="max-w-6xl mx-auto space-y-8">
      {/* Top bar */}
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <Link
              href="/supplier-bills"
              className="p-2 rounded-lg border border-slate-300 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800"
            >
              <ArrowLeft className="w-4 h-4" />
            </Link>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-2xl font-bold font-mono text-slate-900 dark:text-white">
                  {bill.billNumber}
                </h2>
                <span
                  className={`px-2.5 py-0.5 rounded-full text-xs font-semibold uppercase ${
                    bill.status === "POSTED"
                      ? "bg-emerald-100 text-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-300"
                      : bill.status === "APPROVED"
                      ? "bg-purple-100 text-purple-800 dark:bg-purple-950/40 dark:text-purple-300"
                      : bill.status === "PAID"
                      ? "bg-blue-100 text-blue-800 dark:bg-blue-950/40 dark:text-blue-300"
                      : bill.status === "CANCELLED"
                      ? "bg-rose-100 text-rose-800 dark:bg-rose-950/40 dark:text-rose-300"
                      : "bg-slate-100 text-slate-800 dark:bg-slate-800 dark:text-slate-300"
                  }`}
                >
                  {bill.status}
                </span>
              </div>
              <p className="text-xs text-slate-500 mt-0.5">
                Created on {new Date(bill.createdAt).toLocaleString()} by {bill.createdBy?.name}
              </p>
            </div>
          </div>

          {/* Lifecycle Action Buttons */}
          <div className="flex items-center gap-2">
            {bill.status === "DRAFT" && (
              <form
                action={async () => {
                  "use server";
                  await approveSupplierBill(bill.id);
                }}
              >
                <button
                  type="submit"
                  className="inline-flex items-center gap-2 px-3.5 py-2 bg-purple-600 hover:bg-purple-700 text-white text-xs font-semibold rounded-lg shadow-sm"
                >
                  <Check className="w-4 h-4" /> Approve Bill
                </button>
              </form>
            )}

            {(bill.status === "DRAFT" || bill.status === "APPROVED") && (
              <form
                action={async () => {
                  "use server";
                  await postSupplierBill(bill.id);
                }}
              >
                <button
                  type="submit"
                  className="inline-flex items-center gap-2 px-3.5 py-2 bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold rounded-lg shadow-sm shadow-blue-500/20"
                >
                  <Send className="w-4 h-4" /> Post to General Ledger
                </button>
              </form>
            )}

            {bill.status !== "CANCELLED" && bill.status !== "PAID" && (
              <form
                action={async () => {
                  "use server";
                  await cancelSupplierBill(bill.id, "User requested cancellation via detail view");
                }}
              >
                <button
                  type="submit"
                  className="inline-flex items-center gap-2 px-3.5 py-2 border border-rose-200 dark:border-rose-800 text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/30 text-xs font-semibold rounded-lg"
                >
                  <XCircle className="w-4 h-4" /> Cancel Bill
                </button>
              </form>
            )}
          </div>
        </div>

        {/* Metadata Grid */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6 bg-white dark:bg-slate-900 p-6 rounded-xl border border-slate-200 dark:border-slate-800">
          <div>
            <span className="text-xs uppercase text-slate-400 font-semibold block mb-1">Supplier</span>
            <p className="text-base font-semibold text-slate-900 dark:text-white">
              {bill.supplier?.name}
            </p>
            <p className="text-xs text-slate-500">{bill.supplier?.code}</p>
          </div>

          <div>
            <span className="text-xs uppercase text-slate-400 font-semibold block mb-1">Dates</span>
            <p className="text-sm text-slate-700 dark:text-slate-300">
              Bill Date: <span className="font-medium">{new Date(bill.billDate).toLocaleDateString()}</span>
            </p>
            <p className="text-sm text-slate-700 dark:text-slate-300">
              Due: <span className="font-medium">{new Date(bill.dueDate).toLocaleDateString()}</span>
            </p>
          </div>

          <div>
            <span className="text-xs uppercase text-slate-400 font-semibold block mb-1">Currency & FX</span>
            <p className="text-sm font-semibold text-slate-900 dark:text-white">
              {bill.currency}
            </p>
            <p className="text-xs text-slate-500">
              1 {bill.currency} = {bill.exchangeRate} AFN
            </p>
          </div>

          <div>
            <span className="text-xs uppercase text-slate-400 font-semibold block mb-1">Balance Due</span>
            <p className="text-xl font-bold font-mono text-rose-600 dark:text-rose-400">
              {bill.currency} {bill.balanceDue.toLocaleString("en-US", { minimumFractionDigits: 2 })}
            </p>
            <p className="text-xs text-slate-500">
              Paid: {bill.currency} {bill.paidAmount.toLocaleString("en-US", { minimumFractionDigits: 2 })}
            </p>
          </div>
        </div>

        {/* Line Items */}
        <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 p-6 space-y-4">
          <h3 className="text-base font-bold text-slate-900 dark:text-white">Direct Cost Breakdown</h3>
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="bg-slate-50 dark:bg-slate-950/60 text-slate-600 dark:text-slate-400 text-xs font-semibold uppercase">
                <tr>
                  <th className="px-4 py-3">Service</th>
                  <th className="px-4 py-3">Description</th>
                  <th className="px-4 py-3">Cost Account</th>
                  <th className="px-4 py-3 text-right">Qty</th>
                  <th className="px-4 py-3 text-right">Unit Cost</th>
                  <th className="px-4 py-3 text-right">Tax Rate</th>
                  <th className="px-4 py-3 text-right">Total ({bill.currency})</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200 dark:divide-slate-800">
                {bill.lines.map((line: any) => (
                  <tr key={line.id}>
                    <td className="px-4 py-3 font-semibold text-xs text-slate-700 dark:text-slate-300">
                      {line.serviceType}
                    </td>
                    <td className="px-4 py-3 text-slate-900 dark:text-white">
                      {line.description}
                    </td>
                    <td className="px-4 py-3 text-xs text-slate-500 font-mono">
                      {line.costAccount?.code} - {line.costAccount?.name}
                    </td>
                    <td className="px-4 py-3 text-right font-mono">{line.quantity}</td>
                    <td className="px-4 py-3 text-right font-mono">
                      {line.unitCostForeign.toFixed(2)}
                    </td>
                    <td className="px-4 py-3 text-right font-mono">
                      {line.taxRate}%
                    </td>
                    <td className="px-4 py-3 text-right font-mono font-medium">
                      {line.totalCostForeign.toFixed(2)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="flex justify-end pt-4 border-t border-slate-200 dark:border-slate-800">
            <div className="w-72 space-y-2 text-sm">
              <div className="flex justify-between text-slate-600 dark:text-slate-400">
                <span>Foreign Subtotal ({bill.currency})</span>
                <span className="font-mono">{bill.foreignSubTotal.toFixed(2)}</span>
              </div>
              <div className="flex justify-between text-slate-600 dark:text-slate-400">
                <span>Tax Amount ({bill.currency})</span>
                <span className="font-mono">{bill.taxAmount.toFixed(2)}</span>
              </div>
              <div className="flex justify-between text-base font-bold text-slate-900 dark:text-white pt-2 border-t border-slate-200 dark:border-slate-800">
                <span>Grand Total ({bill.currency})</span>
                <span className="font-mono">{bill.grandTotal.toFixed(2)}</span>
              </div>
              {bill.currency !== "AFN" && (
                <div className="flex justify-between text-xs text-blue-600 dark:text-blue-400 font-semibold pt-1">
                  <span>Base Total (AFN)</span>
                  <span className="font-mono">AFN {bill.baseGrandTotal.toFixed(2)}</span>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* General Ledger Journal Entry */}
        {bill.journalEntry && (
          <div className="bg-white dark:bg-slate-900 rounded-xl border border-blue-200 dark:border-blue-900/50 p-6 space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <ShieldCheck className="w-5 h-5 text-emerald-500" />
                <h3 className="text-base font-bold text-slate-900 dark:text-white">
                  General Ledger Double-Entry Audit (Posted)
                </h3>
              </div>
              <span className="font-mono text-xs px-2.5 py-1 bg-blue-50 text-blue-700 dark:bg-blue-950/40 dark:text-blue-300 rounded-md font-semibold">
                Journal Entry #{bill.journalEntry.entryNumber}
              </span>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead className="bg-slate-50 dark:bg-slate-950/60 text-slate-600 dark:text-slate-400 text-xs font-semibold uppercase">
                  <tr>
                    <th className="px-4 py-2">Account Code</th>
                    <th className="px-4 py-2">Account Name</th>
                    <th className="px-4 py-2">Type</th>
                    <th className="px-4 py-2 text-right">Debit (AFN)</th>
                    <th className="px-4 py-2 text-right">Credit (AFN)</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200 dark:divide-slate-800 font-mono text-xs">
                  {bill.journalEntry.lines.map((line: any) => (
                    <tr key={line.id}>
                      <td className="px-4 py-2 font-semibold text-blue-600 dark:text-blue-400">
                        {line.account.code}
                      </td>
                      <td className="px-4 py-2 text-slate-900 dark:text-white font-sans">
                        {line.account.name}
                      </td>
                      <td className="px-4 py-2 text-slate-500 font-sans">{line.account.type}</td>
                      <td className="px-4 py-2 text-right font-bold">
                        {Number(line.debit) > 0 ? Number(line.debit).toFixed(2) : "-"}
                      </td>
                      <td className="px-4 py-2 text-right font-bold">
                        {Number(line.credit) > 0 ? Number(line.credit).toFixed(2) : "-"}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>
    );
}
