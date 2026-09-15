import React from "react";
import Link from "next/link";
import { getSuppliers } from "@/app/actions/suppliers";
import { Badge } from "@/components/ui/Badge";
import {
  Building2,
  Plus,
  Search,
  Phone,
  Mail,
  ChevronRight,
  Filter,
} from "lucide-react";
import { SupplierType } from "@prisma/client";

export const dynamic = "force-dynamic";

interface SuppliersPageProps {
  searchParams: Promise<{
    query?: string;
    type?: string;
    page?: string;
  }>;
}

export default async function SuppliersPage({ searchParams }: SuppliersPageProps) {
  const resolvedParams = await searchParams;
  const query = resolvedParams.query || "";
  const type = (resolvedParams.type as SupplierType) || "ALL";
  const page = parseInt(resolvedParams.page || "1", 10);

  let suppliers: any[] = [];
  let totalCount = 0;
  let totalPages = 1;
  let currentPage = 1;

  try {
    const res = await getSuppliers({
      query,
      type,
      page,
      limit: 15,
    });
    suppliers = res.suppliers;
    totalCount = res.totalCount;
    totalPages = res.totalPages;
    currentPage = res.currentPage;
  } catch (err) {
    suppliers = [];
  }

  return (
    <div className="space-y-6 max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1">
            <Building2 className="w-4 h-4 text-purple-600" />
            <span>Master Data</span>
          </div>
          <h1 className="text-2xl font-bold text-slate-900 dark:text-white tracking-tight">
            Supplier Master
          </h1>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
            Airlines, DMCs, consolidators, hotel partners, multi-currency terms, and derived accounts payable.
          </p>
        </div>

        <Link
          href="/suppliers/new"
          className="inline-flex items-center gap-2 px-4 py-2 bg-purple-600 hover:bg-purple-500 text-white text-xs font-semibold rounded-xl shadow-sm shadow-purple-500/20 transition-colors"
        >
          <Plus className="w-4 h-4" />
          <span>New Supplier</span>
        </Link>
      </div>

      {/* Search & Filter Toolbar */}
      <div className="p-4 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-sm flex flex-col md:flex-row gap-4 justify-between items-center">
        <form className="relative w-full md:w-96 flex gap-2">
          <div className="relative w-full">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              name="query"
              defaultValue={query}
              type="text"
              placeholder="Search by name, code, contact, phone..."
              className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg pl-9 pr-4 py-2 text-xs text-slate-900 dark:text-white placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-purple-500/50"
            />
          </div>
          <button
            type="submit"
            className="px-3 py-2 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 text-xs font-medium rounded-lg transition-colors"
          >
            Search
          </button>
        </form>

        <div className="flex items-center gap-2 w-full md:w-auto overflow-x-auto">
          <Filter className="w-4 h-4 text-slate-400" />
          {(["ALL", "AIRLINE", "HOTEL", "DMC", "VISA_PROVIDER", "TRANSPORT_COMPANY", "INSURANCE_PROVIDER", "OTHER"] as const).map(
            (t) => (
              <Link
                key={t}
                href={`/suppliers?type=${t}&query=${query}`}
                className={`px-2.5 py-1 text-xs font-medium rounded-lg transition-colors ${
                  type === t
                    ? "bg-purple-600 text-white"
                    : "bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-700"
                }`}
              >
                {t === "ALL" ? "All Suppliers" : t.replace("_", " ")}
              </Link>
            )
          )}
        </div>
      </div>

      {/* Suppliers Table */}
      <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-50 dark:bg-slate-800/60 border-b border-slate-200 dark:border-slate-800 text-slate-500 uppercase tracking-wider text-[11px] font-semibold">
              <tr>
                <th className="py-3 px-4">Code & Name</th>
                <th className="py-3 px-4">Supplier Type</th>
                <th className="py-3 px-4">Currency</th>
                <th className="py-3 px-4">Contact Person</th>
                <th className="py-3 px-4">Phone / Email</th>
                <th className="py-3 px-4">Payment Terms</th>
                <th className="py-3 px-4">Status</th>
                <th className="py-3 px-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
              {suppliers.length === 0 ? (
                <tr>
                  <td colSpan={8} className="py-12 text-center text-slate-400">
                    <Building2 className="w-8 h-8 mx-auto mb-2 opacity-40" />
                    <p className="font-semibold text-slate-600 dark:text-slate-300">
                      No suppliers found
                    </p>
                    <p className="text-xs text-slate-400 mt-0.5">
                      {query
                        ? "Try adjusting your search criteria."
                        : "Click 'New Supplier' to register airlines, DMCs, or hotel partners."}
                    </p>
                  </td>
                </tr>
              ) : (
                suppliers.map((sup) => (
                  <tr
                    key={sup.id}
                    className="hover:bg-slate-50/80 dark:hover:bg-slate-800/40 transition-colors"
                  >
                    <td className="py-3.5 px-4 font-medium">
                      <div className="flex items-center gap-2">
                        <div className="w-7 h-7 rounded-lg bg-purple-50 text-purple-600 dark:bg-purple-950/40 dark:text-purple-400 font-bold text-[11px] flex items-center justify-center">
                          {sup.code.slice(0, 3)}
                        </div>
                        <div>
                          <Link
                            href={`/suppliers/${sup.id}`}
                            className="font-bold text-slate-900 dark:text-white hover:text-purple-600 transition-colors"
                          >
                            {sup.name}
                          </Link>
                          <p className="text-[11px] text-slate-400">{sup.code}</p>
                        </div>
                      </div>
                    </td>

                    <td className="py-3.5 px-4">
                      <Badge variant="info">{sup.type.replace("_", " ")}</Badge>
                    </td>

                    <td className="py-3.5 px-4 font-semibold text-slate-900 dark:text-white">
                      <span className="px-2 py-0.5 rounded bg-slate-100 dark:bg-slate-800 text-[11px]">
                        {sup.currency}
                      </span>
                    </td>

                    <td className="py-3.5 px-4 text-slate-700 dark:text-slate-300">
                      {sup.contactPerson || "-"}
                    </td>

                    <td className="py-3.5 px-4 text-slate-600 dark:text-slate-400">
                      {sup.phone && (
                        <p className="flex items-center gap-1 text-[11px]">
                          <Phone className="w-3 h-3 text-slate-400" />
                          <span>{sup.phone}</span>
                        </p>
                      )}
                      {sup.email && (
                        <p className="flex items-center gap-1 text-[11px]">
                          <Mail className="w-3 h-3 text-slate-400" />
                          <span>{sup.email}</span>
                        </p>
                      )}
                    </td>

                    <td className="py-3.5 px-4 text-slate-600 dark:text-slate-400">
                      {sup.paymentTermsDays} Days
                    </td>

                    <td className="py-3.5 px-4">
                      <Badge variant={sup.isActive ? "success" : "danger"}>
                        {sup.isActive ? "Active" : "Inactive"}
                      </Badge>
                    </td>

                    <td className="py-3.5 px-4 text-right">
                      <Link
                        href={`/suppliers/${sup.id}`}
                        className="inline-flex items-center gap-1 text-xs font-semibold text-purple-600 hover:text-purple-500 transition-colors"
                      >
                        <span>View Ledger</span>
                        <ChevronRight className="w-3.5 h-3.5" />
                      </Link>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination Footer */}
        {totalPages > 1 && (
          <div className="p-4 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between text-xs text-slate-500">
            <p>
              Showing {suppliers.length} of {totalCount} suppliers
            </p>
            <div className="flex gap-1">
              {Array.from({ length: totalPages }, (_, i) => i + 1).map((p) => (
                <Link
                  key={p}
                  href={`/suppliers?page=${p}&query=${query}&type=${type}`}
                  className={`px-3 py-1 rounded-md font-medium ${
                    currentPage === p
                      ? "bg-purple-600 text-white"
                      : "bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:text-slate-400"
                  }`}
                >
                  {p}
                </Link>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
