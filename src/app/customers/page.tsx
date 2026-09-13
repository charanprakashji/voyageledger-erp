import React from "react";
import Link from "next/link";
import { getCustomers } from "@/app/actions/customers";
import { Badge } from "@/components/ui/Badge";
import { formatCurrency } from "@/lib/accounting";
import {
  Users,
  Plus,
  Search,
  Building2,
  Phone,
  Mail,
  ChevronRight,
  Filter,
  UserCheck,
} from "lucide-react";
import { CustomerType } from "@prisma/client";

export const dynamic = "force-dynamic";

interface CustomersPageProps {
  searchParams: Promise<{
    query?: string;
    type?: string;
    page?: string;
  }>;
}

export default async function CustomersPage({ searchParams }: CustomersPageProps) {
  const resolvedParams = await searchParams;
  const query = resolvedParams.query || "";
  const type = (resolvedParams.type as CustomerType) || "ALL";
  const page = parseInt(resolvedParams.page || "1", 10);

  let customers: any[] = [];
  let totalCount = 0;
  let totalPages = 1;
  let currentPage = 1;

  try {
    const res = await getCustomers({
      query,
      type,
      page,
      limit: 15,
    });
    customers = res.customers;
    totalCount = res.totalCount;
    totalPages = res.totalPages;
    currentPage = res.currentPage;
  } catch (err) {
    // Graceful fallback during static generation / disconnected DB
    customers = [];
  }

  return (
    <div className="space-y-6 max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1">
            <Users className="w-4 h-4 text-blue-600" />
            <span>Master Data</span>
          </div>
          <h1 className="text-2xl font-bold text-slate-900 dark:text-white tracking-tight">
            Customer Master
          </h1>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
            Manage corporate and retail clients, credit limits, TIN, and derived accounts receivable.
          </p>
        </div>

        <Link
          href="/customers/new"
          className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white text-xs font-semibold rounded-xl shadow-sm shadow-blue-500/20 transition-colors"
        >
          <Plus className="w-4 h-4" />
          <span>New Customer</span>
        </Link>
      </div>

      {/* Filter & Search Toolbar */}
      <div className="p-4 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-sm flex flex-col md:flex-row gap-4 justify-between items-center">
        <form className="relative w-full md:w-96 flex gap-2">
          <div className="relative w-full">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              name="query"
              defaultValue={query}
              type="text"
              placeholder="Search by name, code, TIN, phone..."
              className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg pl-9 pr-4 py-2 text-xs text-slate-900 dark:text-white placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500/50"
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
          {(["ALL", "INDIVIDUAL", "CORPORATE", "TRAVEL_AGENCY", "NGO", "EMBASSY"] as const).map(
            (t) => (
              <Link
                key={t}
                href={`/customers?type=${t}&query=${query}`}
                className={`px-2.5 py-1 text-xs font-medium rounded-lg transition-colors ${
                  type === t
                    ? "bg-blue-600 text-white"
                    : "bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-700"
                }`}
              >
                {t === "ALL" ? "All Types" : t.replace("_", " ")}
              </Link>
            )
          )}
        </div>
      </div>

      {/* Customers Data Table */}
      <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-50 dark:bg-slate-800/60 border-b border-slate-200 dark:border-slate-800 text-slate-500 uppercase tracking-wider text-[11px] font-semibold">
              <tr>
                <th className="py-3 px-4">Code & Name</th>
                <th className="py-3 px-4">Type</th>
                <th className="py-3 px-4">Location (Afghanistan)</th>
                <th className="py-3 px-4">Contact</th>
                <th className="py-3 px-4">Credit Limit</th>
                <th className="py-3 px-4">Terms</th>
                <th className="py-3 px-4">Status</th>
                <th className="py-3 px-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
              {customers.length === 0 ? (
                <tr>
                  <td colSpan={8} className="py-12 text-center text-slate-400">
                    <UserCheck className="w-8 h-8 mx-auto mb-2 opacity-40" />
                    <p className="font-semibold text-slate-600 dark:text-slate-300">
                      No customers found
                    </p>
                    <p className="text-xs text-slate-400 mt-0.5">
                      {query
                        ? "Try clearing your search query."
                        : "Click 'New Customer' to register your first client."}
                    </p>
                  </td>
                </tr>
              ) : (
                customers.map((cust) => (
                  <tr
                    key={cust.id}
                    className="hover:bg-slate-50/80 dark:hover:bg-slate-800/40 transition-colors"
                  >
                    <td className="py-3.5 px-4 font-medium">
                      <div className="flex items-center gap-2">
                        <div className="w-7 h-7 rounded-lg bg-blue-50 text-blue-600 dark:bg-blue-950/40 dark:text-blue-400 font-bold text-[11px] flex items-center justify-center">
                          {cust.code.slice(0, 3)}
                        </div>
                        <div>
                          <Link
                            href={`/customers/${cust.id}`}
                            className="font-bold text-slate-900 dark:text-white hover:text-blue-600 transition-colors"
                          >
                            {cust.name}
                          </Link>
                          <p className="text-[11px] text-slate-400">
                            {cust.code} {cust.companyName ? `• ${cust.companyName}` : ""}
                          </p>
                        </div>
                      </div>
                    </td>

                    <td className="py-3.5 px-4">
                      <Badge variant="neutral">{cust.type.replace("_", " ")}</Badge>
                    </td>

                    <td className="py-3.5 px-4 text-slate-600 dark:text-slate-300">
                      <p className="font-medium">{cust.city || cust.province}</p>
                      <p className="text-[11px] text-slate-400">
                        {cust.province}, {cust.country}
                      </p>
                    </td>

                    <td className="py-3.5 px-4 text-slate-600 dark:text-slate-300">
                      {cust.phone && (
                        <p className="flex items-center gap-1 text-[11px]">
                          <Phone className="w-3 h-3 text-slate-400" />
                          <span>{cust.phone}</span>
                        </p>
                      )}
                      {cust.email && (
                        <p className="flex items-center gap-1 text-[11px] text-slate-400">
                          <Mail className="w-3 h-3 text-slate-400" />
                          <span>{cust.email}</span>
                        </p>
                      )}
                    </td>

                    <td className="py-3.5 px-4 font-semibold text-slate-900 dark:text-slate-100">
                      {formatCurrency(cust.creditLimit, cust.defaultCurrency)}
                    </td>

                    <td className="py-3.5 px-4 text-slate-600 dark:text-slate-400">
                      {cust.paymentTermsDays} Days
                    </td>

                    <td className="py-3.5 px-4">
                      <Badge variant={cust.isActive ? "success" : "danger"}>
                        {cust.isActive ? "Active" : "Inactive"}
                      </Badge>
                    </td>

                    <td className="py-3.5 px-4 text-right">
                      <Link
                        href={`/customers/${cust.id}`}
                        className="inline-flex items-center gap-1 text-xs font-semibold text-blue-600 hover:text-blue-500 transition-colors"
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
              Showing {customers.length} of {totalCount} customers
            </p>
            <div className="flex gap-1">
              {Array.from({ length: totalPages }, (_, i) => i + 1).map((p) => (
                <Link
                  key={p}
                  href={`/customers?page=${p}&query=${query}&type=${type}`}
                  className={`px-3 py-1 rounded-md font-medium ${
                    currentPage === p
                      ? "bg-blue-600 text-white"
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
