import React from "react";
import prisma from "@/lib/prisma";
import { getSupplierDerivedLedger } from "@/lib/financialReports";
import { Header } from "@/components/layout/Header";
import { Building2, ArrowLeft, FileText, CheckCircle } from "lucide-react";
import Link from "next/link";

export const dynamic = "force-dynamic";

interface SupplierStatementPageProps {
  searchParams: Promise<{ supplierId?: string }>;
}

export default async function SupplierStatementPage({ searchParams }: SupplierStatementPageProps) {
  const params = await searchParams;
  const suppliers = await prisma.supplier.findMany({
    where: { isActive: true },
    select: { id: true, name: true, code: true },
    orderBy: { name: "asc" },
  });

  const selectedSupplierId = params.supplierId || (suppliers.length > 0 ? suppliers[0].id : null);
  let report = null;

  if (selectedSupplierId) {
    try {
      report = await getSupplierDerivedLedger(selectedSupplierId);
    } catch (e) {
      console.error("Error generating supplier statement:", e);
    }
  }

  return (
    <div>
      <Header title="Supplier Statement & AP Ledger" userRole="ADMIN" />
      <div className="p-8 max-w-6xl mx-auto space-y-6">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <Link
              href="/reports"
              className="p-2 rounded-lg border border-slate-300 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800"
            >
              <ArrowLeft className="w-4 h-4" />
            </Link>
            <div>
              <h2 className="text-xl font-bold text-slate-900 dark:text-white">Supplier Subsidiary Ledger</h2>
              <p className="text-sm text-slate-500">Derived strictly from AP (2010) and Advance (1120) GL postings</p>
            </div>
          </div>

          {/* Supplier Selector */}
          <form method="GET" className="flex items-center gap-2">
            <select
              name="supplierId"
              defaultValue={selectedSupplierId || ""}
              className="px-3 py-2 text-sm bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-lg"
            >
              {suppliers.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name} ({s.code})
                </option>
              ))}
            </select>
            <button
              type="submit"
              className="px-3 py-2 text-xs font-semibold bg-blue-600 text-white rounded-lg hover:bg-blue-700"
            >
              View Statement
            </button>
          </form>
        </div>

        {report && (
          <div className="space-y-6">
            {/* Summary Cards */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <div className="bg-white dark:bg-slate-900 p-6 rounded-xl border border-slate-200 dark:border-slate-800">
                <span className="text-xs uppercase text-slate-400 font-semibold block">Total Billed (AP Credit)</span>
                <p className="text-2xl font-bold font-mono text-slate-900 dark:text-white mt-1">
                  AFN {Number(report.totalBilled).toLocaleString("en-US", { minimumFractionDigits: 2 })}
                </p>
              </div>
              <div className="bg-white dark:bg-slate-900 p-6 rounded-xl border border-slate-200 dark:border-slate-800">
                <span className="text-xs uppercase text-slate-400 font-semibold block">Total Paid (AP Debit)</span>
                <p className="text-2xl font-bold font-mono text-emerald-600 mt-1">
                  AFN {Number(report.totalPaid).toLocaleString("en-US", { minimumFractionDigits: 2 })}
                </p>
              </div>
              <div className="bg-white dark:bg-slate-900 p-6 rounded-xl border border-slate-200 dark:border-slate-800">
                <span className="text-xs uppercase text-slate-400 font-semibold block">Outstanding AP Balance</span>
                <p className="text-2xl font-bold font-mono text-rose-600 mt-1">
                  AFN {Number(report.closingBalance).toLocaleString("en-US", { minimumFractionDigits: 2 })}
                </p>
              </div>
            </div>

            {/* Statement Table */}
            <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 shadow-sm overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-left text-sm">
                  <thead className="bg-slate-50 dark:bg-slate-950/60 text-slate-600 dark:text-slate-400 text-xs font-semibold uppercase tracking-wider border-b border-slate-200 dark:border-slate-800">
                    <tr>
                      <th className="px-6 py-4">Date</th>
                      <th className="px-6 py-4">Doc Type</th>
                      <th className="px-6 py-4">Entry / Ref</th>
                      <th className="px-6 py-4">Description</th>
                      <th className="px-6 py-4 text-right">Debit (Paid)</th>
                      <th className="px-6 py-4 text-right">Credit (Billed)</th>
                      <th className="px-6 py-4 text-right">Balance Due</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-200 dark:divide-slate-800 font-mono text-xs">
                    {report.items.length === 0 ? (
                      <tr>
                        <td colSpan={7} className="px-6 py-12 text-center text-slate-500 font-sans">
                          No transactions found for this supplier.
                        </td>
                      </tr>
                    ) : (
                      report.items.map((item, idx) => (
                        <tr key={idx} className="hover:bg-slate-50/70 dark:hover:bg-slate-800/40">
                          <td className="px-6 py-3 font-sans text-slate-600 dark:text-slate-400">
                            {item.date}
                          </td>
                          <td className="px-6 py-3 font-sans font-semibold">
                            <span className="px-2 py-0.5 rounded text-[11px] bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300">
                              {item.documentType}
                            </span>
                          </td>
                          <td className="px-6 py-3 text-blue-600 dark:text-blue-400 font-semibold">
                            {item.documentNumber}
                          </td>
                          <td className="px-6 py-3 font-sans text-slate-900 dark:text-white">
                            {item.description}
                          </td>
                          <td className="px-6 py-3 text-right font-medium text-emerald-600">
                            {Number(item.debit) > 0 ? Number(item.debit).toLocaleString("en-US", { minimumFractionDigits: 2 }) : "-"}
                          </td>
                          <td className="px-6 py-3 text-right font-medium text-slate-900 dark:text-white">
                            {Number(item.credit) > 0 ? Number(item.credit).toLocaleString("en-US", { minimumFractionDigits: 2 }) : "-"}
                          </td>
                          <td className="px-6 py-3 text-right font-bold text-rose-600">
                            AFN {Number(item.runningBalance).toLocaleString("en-US", { minimumFractionDigits: 2 })}
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
