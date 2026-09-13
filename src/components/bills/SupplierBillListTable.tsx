"use client";

import React, { useState } from "react";
import Link from "next/link";
import {
  FileText,
  Plus,
  Search,
  Filter,
  ArrowUpDown,
  CheckCircle,
  Clock,
  Ban,
  Building2,
} from "lucide-react";
import { SupplierBillStatus } from "@prisma/client";

interface SupplierBillListTableProps {
  initialData: any[];
  pagination: {
    total: number;
    page: number;
    limit: number;
    totalPages: number;
  };
  suppliers: { id: string; name: string; supplierCode: string }[];
}

export function SupplierBillListTable({
  initialData,
  pagination,
  suppliers,
}: SupplierBillListTableProps) {
  const [bills] = useState(initialData);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("ALL");
  const [supplierFilter, setSupplierFilter] = useState<string>("ALL");

  const filteredBills = bills.filter((bill) => {
    const matchSearch =
      search === "" ||
      bill.billNumber.toLowerCase().includes(search.toLowerCase()) ||
      bill.supplier?.name.toLowerCase().includes(search.toLowerCase()) ||
      (bill.supplierInvoiceNumber &&
        bill.supplierInvoiceNumber.toLowerCase().includes(search.toLowerCase()));

    const matchStatus =
      statusFilter === "ALL" || bill.status === statusFilter;

    const matchSupplier =
      supplierFilter === "ALL" || bill.supplierId === supplierFilter;

    return matchSearch && matchStatus && matchSupplier;
  });

  const getStatusBadge = (status: SupplierBillStatus) => {
    switch (status) {
      case "POSTED":
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800">
            <CheckCircle className="w-3.5 h-3.5" /> POSTED (GL)
          </span>
        );
      case "PAID":
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-blue-50 text-blue-700 dark:bg-blue-950/40 dark:text-blue-300 border border-blue-200 dark:border-blue-800">
            <CheckCircle className="w-3.5 h-3.5" /> PAID
          </span>
        );
      case "PARTIALLY_PAID":
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-amber-50 text-amber-700 dark:bg-amber-950/40 dark:text-amber-300 border border-amber-200 dark:border-amber-800">
            <Clock className="w-3.5 h-3.5" /> PARTIALLY PAID
          </span>
        );
      case "APPROVED":
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-purple-50 text-purple-700 dark:bg-purple-950/40 dark:text-purple-300 border border-purple-200 dark:border-purple-800">
            <Clock className="w-3.5 h-3.5" /> APPROVED
          </span>
        );
      case "DRAFT":
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300 border border-slate-300 dark:border-slate-700">
            <Clock className="w-3.5 h-3.5" /> DRAFT
          </span>
        );
      case "CANCELLED":
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-rose-50 text-rose-700 dark:bg-rose-950/40 dark:text-rose-300 border border-rose-200 dark:border-rose-800">
            <Ban className="w-3.5 h-3.5" /> CANCELLED
          </span>
        );
    }
  };

  return (
    <div className="space-y-6">
      {/* Header Actions */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold text-slate-900 dark:text-white">
            Supplier Bills & Accounts Payable
          </h2>
          <p className="text-sm text-slate-500 dark:text-slate-400">
            Manage vendor invoices, direct cost allocations, and AP postings.
          </p>
        </div>
        <Link
          href="/supplier-bills/new"
          className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-sm font-semibold rounded-lg shadow-sm transition-all shadow-blue-500/20"
        >
          <Plus className="w-4 h-4" /> New Supplier Bill
        </Link>
      </div>

      {/* Filters */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 bg-white dark:bg-slate-900 p-4 rounded-xl border border-slate-200 dark:border-slate-800 shadow-sm">
        <div className="relative">
          <Search className="w-4 h-4 absolute left-3 top-3 text-slate-400" />
          <input
            type="text"
            placeholder="Search bill number or supplier..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-9 pr-4 py-2 text-sm bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-700 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>

        <div className="flex items-center gap-2">
          <Filter className="w-4 h-4 text-slate-400" />
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="w-full py-2 px-3 text-sm bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-700 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            <option value="ALL">All Statuses</option>
            <option value="DRAFT">Draft</option>
            <option value="APPROVED">Approved</option>
            <option value="POSTED">Posted (GL)</option>
            <option value="PARTIALLY_PAID">Partially Paid</option>
            <option value="PAID">Paid</option>
            <option value="CANCELLED">Cancelled</option>
          </select>
        </div>

        <div className="flex items-center gap-2">
          <Building2 className="w-4 h-4 text-slate-400" />
          <select
            value={supplierFilter}
            onChange={(e) => setSupplierFilter(e.target.value)}
            className="w-full py-2 px-3 text-sm bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-700 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            <option value="ALL">All Suppliers</option>
            {suppliers.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name} ({s.supplierCode})
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Table */}
      <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="bg-slate-50 dark:bg-slate-950/60 text-slate-600 dark:text-slate-400 text-xs font-semibold uppercase tracking-wider border-b border-slate-200 dark:border-slate-800">
              <tr>
                <th className="px-6 py-4">Bill Number</th>
                <th className="px-6 py-4">Supplier</th>
                <th className="px-6 py-4">Issue Date</th>
                <th className="px-6 py-4">Due Date</th>
                <th className="px-6 py-4 text-right">Grand Total</th>
                <th className="px-6 py-4 text-right">Balance Due</th>
                <th className="px-6 py-4 text-center">Status</th>
                <th className="px-6 py-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200 dark:divide-slate-800">
              {filteredBills.length === 0 ? (
                <tr>
                  <td colSpan={8} className="px-6 py-12 text-center text-slate-500">
                    <FileText className="w-12 h-12 mx-auto text-slate-300 dark:text-slate-700 mb-3" />
                    <p className="text-base font-medium">No supplier bills found</p>
                    <p className="text-xs text-slate-400 mt-1">
                      Create a new bill or adjust search filters.
                    </p>
                  </td>
                </tr>
              ) : (
                filteredBills.map((bill) => (
                  <tr
                    key={bill.id}
                    className="hover:bg-slate-50/70 dark:hover:bg-slate-800/40 transition-colors"
                  >
                    <td className="px-6 py-4 font-mono font-semibold text-blue-600 dark:text-blue-400">
                      <Link href={`/supplier-bills/${bill.id}`} className="hover:underline">
                        {bill.billNumber}
                      </Link>
                      {bill.supplierInvoiceNumber && (
                        <div className="text-[11px] text-slate-400">
                          Ref: {bill.supplierInvoiceNumber}
                        </div>
                      )}
                    </td>
                    <td className="px-6 py-4 font-medium text-slate-900 dark:text-white">
                      {bill.supplier?.name}
                    </td>
                    <td className="px-6 py-4 text-slate-600 dark:text-slate-300">
                      {new Date(bill.issueDate).toLocaleDateString()}
                    </td>
                    <td className="px-6 py-4 text-slate-600 dark:text-slate-300">
                      {new Date(bill.dueDate).toLocaleDateString()}
                    </td>
                    <td className="px-6 py-4 text-right font-mono font-medium text-slate-900 dark:text-white">
                      {bill.currency} {Number(bill.grandTotal).toLocaleString("en-US", { minimumFractionDigits: 2 })}
                      {bill.currency !== "AFN" && (
                        <div className="text-[11px] text-slate-400">
                          AFN {Number(bill.baseGrandTotal).toLocaleString("en-US", { minimumFractionDigits: 2 })}
                        </div>
                      )}
                    </td>
                    <td className="px-6 py-4 text-right font-mono font-medium text-rose-600 dark:text-rose-400">
                      {bill.currency} {Number(bill.balanceDue).toLocaleString("en-US", { minimumFractionDigits: 2 })}
                    </td>
                    <td className="px-6 py-4 text-center">
                      {getStatusBadge(bill.status)}
                    </td>
                    <td className="px-6 py-4 text-right">
                      <Link
                        href={`/supplier-bills/${bill.id}`}
                        className="text-xs font-semibold px-3 py-1.5 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 dark:bg-slate-800 dark:hover:bg-slate-700 dark:text-slate-200 transition-colors"
                      >
                        View Details
                      </Link>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
