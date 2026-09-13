import React from "react";
import prisma from "@/lib/prisma";
import { getSupplierPayments } from "@/app/actions/bills";
import { Header } from "@/components/layout/Header";
import { CreditCard, Plus, CheckCircle, Clock, Ban } from "lucide-react";
import Link from "next/link";

export const dynamic = "force-dynamic";

export default async function SupplierPaymentsPage() {
  let payments: any[] = [];
  try {
    const res = await getSupplierPayments({ limit: 50 });
    if (res.success) {
      payments = res.data;
    }
  } catch (err) {
    console.error("Error loading supplier payments:", err);
  }

  return (
    <div>
      <Header title="Supplier Payments & Disbursements" userRole="ADMIN" />
      <div className="p-8 space-y-6">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div>
            <h2 className="text-xl font-bold text-slate-900 dark:text-white">
              Supplier Payments & Outgoing Disbursements
            </h2>
            <p className="text-sm text-slate-500 dark:text-slate-400">
              Record AP bill settlements, supplier advances, and FX gain/loss entries.
            </p>
          </div>
          <Link
            href="/supplier-payments/new"
            className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-sm font-semibold rounded-lg shadow-sm transition-all shadow-blue-500/20"
          >
            <Plus className="w-4 h-4" /> New Payment / Advance
          </Link>
        </div>

        <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 shadow-sm overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="bg-slate-50 dark:bg-slate-950/60 text-slate-600 dark:text-slate-400 text-xs font-semibold uppercase tracking-wider border-b border-slate-200 dark:border-slate-800">
                <tr>
                  <th className="px-6 py-4">Payment #</th>
                  <th className="px-6 py-4">Supplier</th>
                  <th className="px-6 py-4">Date</th>
                  <th className="px-6 py-4">Method & Account</th>
                  <th className="px-6 py-4">Type</th>
                  <th className="px-6 py-4 text-right">Amount</th>
                  <th className="px-6 py-4 text-center">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200 dark:divide-slate-800">
                {payments.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="px-6 py-12 text-center text-slate-500">
                      <CreditCard className="w-12 h-12 mx-auto text-slate-300 dark:text-slate-700 mb-3" />
                      <p className="text-base font-medium">No supplier payments found</p>
                    </td>
                  </tr>
                ) : (
                  payments.map((p) => (
                    <tr key={p.id} className="hover:bg-slate-50/70 dark:hover:bg-slate-800/40">
                      <td className="px-6 py-4 font-mono font-semibold text-blue-600 dark:text-blue-400">
                        {p.paymentNumber}
                      </td>
                      <td className="px-6 py-4 font-medium text-slate-900 dark:text-white">
                        {p.supplier?.name}
                      </td>
                      <td className="px-6 py-4 text-slate-600 dark:text-slate-300">
                        {new Date(p.paymentDate).toLocaleDateString()}
                      </td>
                      <td className="px-6 py-4 text-slate-600 dark:text-slate-300">
                        <span className="font-semibold">{p.paymentMethod}</span> ({p.bankAccount?.code})
                      </td>
                      <td className="px-6 py-4">
                        {p.isAdvance ? (
                          <span className="px-2 py-0.5 rounded text-xs font-semibold bg-amber-50 text-amber-700 dark:bg-amber-950/40 dark:text-amber-300 border border-amber-200 dark:border-amber-800">
                            Supplier Advance
                          </span>
                        ) : (
                          <span className="px-2 py-0.5 rounded text-xs font-semibold bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300">
                            Bill Settlement
                          </span>
                        )}
                      </td>
                      <td className="px-6 py-4 text-right font-mono font-medium text-slate-900 dark:text-white">
                        {p.currency} {Number(p.amountForeign).toLocaleString("en-US", { minimumFractionDigits: 2 })}
                        {p.currency !== "AFN" && (
                          <div className="text-[11px] text-slate-400">
                            AFN {Number(p.amountBase).toLocaleString("en-US", { minimumFractionDigits: 2 })}
                          </div>
                        )}
                      </td>
                      <td className="px-6 py-4 text-center">
                        {p.status === "POSTED" ? (
                          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200">
                            <CheckCircle className="w-3.5 h-3.5" /> POSTED (GL)
                          </span>
                        ) : p.status === "DRAFT" ? (
                          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-slate-100 text-slate-700">
                            <Clock className="w-3.5 h-3.5" /> DRAFT
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-rose-50 text-rose-700">
                            <Ban className="w-3.5 h-3.5" /> CANCELLED
                          </span>
                        )}
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
  );
}
