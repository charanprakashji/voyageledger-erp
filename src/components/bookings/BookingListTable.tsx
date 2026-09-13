"use client";

import React, { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  Search,
  Filter,
  Plus,
  Plane,
  Building,
  FileCheck,
  Car,
  Compass,
  Shield,
  Eye,
  Edit,
  XCircle,
  ChevronRight,
  TrendingUp,
  AlertCircle,
  Calendar,
  CheckCircle2,
  Clock,
  Ban,
} from "lucide-react";
import { BookingStatus, ServiceType } from "@prisma/client";
import { updateBookingStatus, cancelBooking } from "@/app/actions/bookings";

interface BookingListTableProps {
  initialData: any[];
  pagination: {
    total: number;
    page: number;
    limit: number;
    totalPages: number;
  };
  customers: Array<{ id: string; name: string; code: string }>;
  suppliers: Array<{ id: string; name: string; type: string }>;
}

export function BookingListTable({
  initialData,
  pagination,
  customers,
  suppliers,
}: BookingListTableProps) {
  const router = useRouter();
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("ALL");
  const [customerFilter, setCustomerFilter] = useState<string>("ALL");
  const [serviceTypeFilter, setServiceTypeFilter] = useState<string>("ALL");
  const [selectedBookingForCancel, setSelectedBookingForCancel] = useState<any | null>(null);
  const [cancellationReason, setCancellationReason] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);

  // Filter in-memory for instant feedback
  const filteredBookings = initialData.filter((b) => {
    if (statusFilter !== "ALL" && b.status !== statusFilter) return false;
    if (customerFilter !== "ALL" && b.customerId !== customerFilter) return false;
    if (serviceTypeFilter !== "ALL") {
      const hasService = b.serviceItems?.some((s: any) => s.serviceType === serviceTypeFilter);
      if (!hasService) return false;
    }
    if (searchTerm) {
      const s = searchTerm.toLowerCase();
      const matchNumber = b.bookingNumber?.toLowerCase().includes(s);
      const matchPnr = b.pnrOrRef?.toLowerCase().includes(s);
      const matchCustomer = b.customer?.name?.toLowerCase().includes(s) || b.customer?.companyName?.toLowerCase().includes(s);
      const matchPax = b.passengers?.some((p: any) =>
        p.firstName?.toLowerCase().includes(s) ||
        p.lastName?.toLowerCase().includes(s) ||
        p.passportNumber?.toLowerCase().includes(s)
      );
      if (!matchNumber && !matchPnr && !matchCustomer && !matchPax) return false;
    }
    return true;
  });

  // Calculate high-level metrics for dashboard header
  const totalBookings = initialData.length;
  const confirmedCount = initialData.filter((b) => ["CONFIRMED", "TICKETED", "COMPLETED", "PARTIALLY_PAID", "PAID"].includes(b.status)).length;
  const quotationCount = initialData.filter((b) => b.status === "QUOTATION" || b.status === "DRAFT").length;
  const totalGrossSelling = initialData.reduce((acc, b) => acc + (b.totalNetSelling || 0), 0);
  const totalGrossCost = initialData.reduce((acc, b) => acc + (b.totalCostPrice || 0), 0);
  const totalGrossMargin = totalGrossSelling - totalGrossCost;

  const handleCancelSubmit = async () => {
    if (!selectedBookingForCancel || !cancellationReason.trim()) return;
    setIsSubmitting(true);
    setActionError(null);
    try {
      const res = await cancelBooking(selectedBookingForCancel.id, cancellationReason);
      if (res.success) {
        setSelectedBookingForCancel(null);
        setCancellationReason("");
        router.refresh();
      } else {
        setActionError(res.error || "Failed to cancel booking");
      }
    } catch (err: any) {
      setActionError(err.message || "An error occurred");
    } finally {
      setIsSubmitting(false);
    }
  };

  const getServiceIcon = (type: string) => {
    switch (type) {
      case "FLIGHT": return <Plane className="w-3.5 h-3.5 text-sky-600" />;
      case "HOTEL": return <Building className="w-3.5 h-3.5 text-amber-600" />;
      case "VISA": return <FileCheck className="w-3.5 h-3.5 text-emerald-600" />;
      case "TRANSFER": return <Car className="w-3.5 h-3.5 text-purple-600" />;
      case "TOUR": return <Compass className="w-3.5 h-3.5 text-rose-600" />;
      default: return <Shield className="w-3.5 h-3.5 text-slate-500" />;
    }
  };

  const getStatusBadge = (status: BookingStatus) => {
    switch (status) {
      case "CONFIRMED":
      case "COMPLETED":
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold bg-emerald-100 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300">
            <CheckCircle2 className="w-3 h-3" /> {status}
          </span>
        );
      case "QUOTATION":
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold bg-blue-100 text-blue-800 dark:bg-blue-950/60 dark:text-blue-300">
            <Clock className="w-3 h-3" /> Quotation
          </span>
        );
      case "DRAFT":
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300">
            Draft
          </span>
        );
      case "CANCELLED":
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold bg-rose-100 text-rose-800 dark:bg-rose-950/60 dark:text-rose-300">
            <Ban className="w-3 h-3" /> Cancelled
          </span>
        );
      default:
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold bg-indigo-100 text-indigo-800 dark:bg-indigo-950/60 dark:text-indigo-300">
            {status}
          </span>
        );
    }
  };

  return (
    <div className="space-y-6">
      {/* KPI Cards Header */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="p-4 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-sm">
          <p className="text-xs font-medium text-slate-500 uppercase tracking-wider">Total Active Bookings</p>
          <div className="mt-2 flex items-baseline justify-between">
            <p className="text-2xl font-bold text-slate-900 dark:text-white">{totalBookings}</p>
            <span className="text-xs font-semibold text-emerald-600 bg-emerald-50 dark:bg-emerald-950/40 px-2 py-0.5 rounded-full">
              {confirmedCount} Confirmed
            </span>
          </div>
        </div>

        <div className="p-4 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-sm">
          <p className="text-xs font-medium text-slate-500 uppercase tracking-wider">Quotations & In-Progress</p>
          <div className="mt-2 flex items-baseline justify-between">
            <p className="text-2xl font-bold text-blue-600 dark:text-blue-400">{quotationCount}</p>
            <span className="text-xs text-slate-500">Pipeline quotes</span>
          </div>
        </div>

        <div className="p-4 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-sm">
          <p className="text-xs font-medium text-slate-500 uppercase tracking-wider">Gross Booking Sales (AFN)</p>
          <div className="mt-2 flex items-baseline justify-between">
            <p className="text-2xl font-bold text-slate-900 dark:text-white">
              {totalGrossSelling.toLocaleString(undefined, { minimumFractionDigits: 2 })}
            </p>
            <span className="text-xs text-slate-400">AFN</span>
          </div>
        </div>

        <div className="p-4 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-sm">
          <p className="text-xs font-medium text-slate-500 uppercase tracking-wider">Estimated Gross Profit</p>
          <div className="mt-2 flex items-baseline justify-between">
            <p className="text-2xl font-bold text-emerald-600 dark:text-emerald-400">
              {totalGrossMargin.toLocaleString(undefined, { minimumFractionDigits: 2 })} AFN
            </p>
            <div className="flex items-center text-xs font-semibold text-emerald-600">
              <TrendingUp className="w-3.5 h-3.5 mr-0.5" />
              {totalGrossSelling > 0
                ? `${((totalGrossMargin / totalGrossSelling) * 100).toFixed(1)}%`
                : "0%"}
            </div>
          </div>
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div className="p-4 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-sm space-y-4">
        <div className="flex flex-col md:flex-row gap-4 justify-between items-stretch md:items-center">
          <div className="relative flex-1 max-w-md">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder="Search by Booking #, PNR, Customer, Passenger, Passport..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-9 pr-4 py-2 text-sm rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/60 focus:outline-none focus:ring-2 focus:ring-blue-500 text-slate-900 dark:text-white placeholder-slate-400"
            />
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="px-3 py-2 text-sm rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-200"
            >
              <option value="ALL">All Statuses</option>
              <option value="DRAFT">Draft</option>
              <option value="QUOTATION">Quotation</option>
              <option value="CONFIRMED">Confirmed</option>
              <option value="TICKETED">Ticketed</option>
              <option value="COMPLETED">Completed</option>
              <option value="CANCELLED">Cancelled</option>
            </select>

            <select
              value={customerFilter}
              onChange={(e) => setCustomerFilter(e.target.value)}
              className="px-3 py-2 text-sm rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-200 max-w-[200px]"
            >
              <option value="ALL">All Customers</option>
              {customers.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.code} - {c.name}
                </option>
              ))}
            </select>

            <select
              value={serviceTypeFilter}
              onChange={(e) => setServiceTypeFilter(e.target.value)}
              className="px-3 py-2 text-sm rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-200"
            >
              <option value="ALL">All Services</option>
              <option value="FLIGHT">Flights</option>
              <option value="HOTEL">Hotels</option>
              <option value="VISA">Visas</option>
              <option value="TRANSFER">Transfers</option>
              <option value="TOUR">Tours</option>
            </select>

            <Link
              href="/bookings/new"
              className="inline-flex items-center gap-2 px-4 py-2 text-sm font-semibold rounded-lg bg-blue-600 hover:bg-blue-700 text-white shadow-sm transition-colors"
            >
              <Plus className="w-4 h-4" /> New Booking
            </Link>
          </div>
        </div>
      </div>

      {/* Bookings Table */}
      <div className="overflow-hidden rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm text-slate-600 dark:text-slate-300">
            <thead className="bg-slate-50 dark:bg-slate-800/60 text-xs uppercase font-semibold text-slate-500 dark:text-slate-400 border-b border-slate-200 dark:border-slate-800">
              <tr>
                <th className="px-4 py-3.5">Booking / PNR</th>
                <th className="px-4 py-3.5">Customer & Roster</th>
                <th className="px-4 py-3.5">Travel Dates</th>
                <th className="px-4 py-3.5">Services</th>
                <th className="px-4 py-3.5 text-right">Selling (AFN)</th>
                <th className="px-4 py-3.5 text-right">Cost (AFN)</th>
                <th className="px-4 py-3.5 text-right">Gross Profit</th>
                <th className="px-4 py-3.5 text-center">Status</th>
                <th className="px-4 py-3.5 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800/60 font-medium">
              {filteredBookings.length === 0 ? (
                <tr>
                  <td colSpan={9} className="px-6 py-12 text-center text-slate-400 dark:text-slate-500">
                    <AlertCircle className="w-8 h-8 mx-auto mb-2 text-slate-300 dark:text-slate-600" />
                    <p className="text-base font-semibold text-slate-700 dark:text-slate-300">No bookings found</p>
                    <p className="text-xs text-slate-400 mt-1">
                      {searchTerm || statusFilter !== "ALL"
                        ? "Try adjusting your search criteria or filters."
                        : "Create a new booking to start managing travel itineraries."}
                    </p>
                  </td>
                </tr>
              ) : (
                filteredBookings.map((b) => (
                  <tr
                    key={b.id}
                    className="hover:bg-slate-50/80 dark:hover:bg-slate-800/40 transition-colors"
                  >
                    <td className="px-4 py-3.5">
                      <div className="font-semibold text-slate-900 dark:text-white">
                        <Link href={`/bookings/${b.id}`} className="hover:text-blue-600 transition-colors">
                          {b.bookingNumber}
                        </Link>
                      </div>
                      {b.pnrOrRef && (
                        <div className="inline-flex items-center gap-1 mt-0.5 text-xs font-mono font-bold text-sky-700 dark:text-sky-400 bg-sky-50 dark:bg-sky-950/40 px-1.5 py-0.5 rounded">
                          PNR: {b.pnrOrRef}
                        </div>
                      )}
                    </td>

                    <td className="px-4 py-3.5">
                      <div className="font-medium text-slate-900 dark:text-white">
                        {b.customer?.name}
                      </div>
                      <div className="text-xs text-slate-400">
                        {b.passengers?.length || 1} Pax {b.leadPassenger ? `(${b.leadPassenger})` : ""}
                      </div>
                    </td>

                    <td className="px-4 py-3.5 text-xs text-slate-600 dark:text-slate-400">
                      <div className="flex items-center gap-1 text-slate-800 dark:text-slate-200 font-medium">
                        <Calendar className="w-3.5 h-3.5 text-slate-400" />
                        {new Date(b.travelStartDate).toLocaleDateString()}
                      </div>
                      {b.travelEndDate && (
                        <div className="text-[11px] text-slate-400 ml-4.5">
                          to {new Date(b.travelEndDate).toLocaleDateString()}
                        </div>
                      )}
                    </td>

                    <td className="px-4 py-3.5">
                      <div className="flex flex-wrap gap-1.5">
                        {b.serviceItems?.map((s: any, idx: number) => (
                          <span
                            key={idx}
                            title={`${s.serviceType}: ${s.description}`}
                            className="p-1 rounded bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700"
                          >
                            {getServiceIcon(s.serviceType)}
                          </span>
                        ))}
                      </div>
                    </td>

                    <td className="px-4 py-3.5 text-right font-bold text-slate-900 dark:text-white">
                      {b.totalNetSelling?.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                    </td>

                    <td className="px-4 py-3.5 text-right text-xs text-slate-600 dark:text-slate-400 font-mono">
                      {b.totalCostPrice?.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                    </td>

                    <td className="px-4 py-3.5 text-right">
                      <div className="font-semibold text-emerald-600 dark:text-emerald-400 font-mono">
                        {b.totalGrossMargin?.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                      </div>
                    </td>

                    <td className="px-4 py-3.5 text-center">
                      {getStatusBadge(b.status)}
                    </td>

                    <td className="px-4 py-3.5 text-right space-x-1">
                      <Link
                        href={`/bookings/${b.id}`}
                        className="inline-flex p-1.5 text-slate-500 hover:text-blue-600 hover:bg-slate-100 dark:hover:bg-slate-800 rounded transition-colors"
                        title="View Details"
                      >
                        <Eye className="w-4 h-4" />
                      </Link>
                      {b.status !== "CANCELLED" && (
                        <>
                          <Link
                            href={`/bookings/${b.id}/edit`}
                            className="inline-flex p-1.5 text-slate-500 hover:text-amber-600 hover:bg-slate-100 dark:hover:bg-slate-800 rounded transition-colors"
                            title="Edit Booking"
                          >
                            <Edit className="w-4 h-4" />
                          </Link>
                          <button
                            onClick={() => setSelectedBookingForCancel(b)}
                            className="inline-flex p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/40 rounded transition-colors"
                            title="Cancel Booking"
                          >
                            <XCircle className="w-4 h-4" />
                          </button>
                        </>
                      )}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Cancellation Modal Dialog */}
      {selectedBookingForCancel && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-sm p-4">
          <div className="w-full max-w-md bg-white dark:bg-slate-900 rounded-2xl shadow-xl border border-slate-200 dark:border-slate-800 p-6 space-y-4">
            <div className="flex items-center gap-3 text-rose-600">
              <Ban className="w-6 h-6" />
              <h3 className="text-lg font-bold text-slate-900 dark:text-white">
                Cancel Booking #{selectedBookingForCancel.bookingNumber}
              </h3>
            </div>

            <p className="text-sm text-slate-600 dark:text-slate-300">
              Please enter the official cancellation reason. The booking record and historical documents will be preserved, and the cancellation event will be audited.
            </p>

            {actionError && (
              <div className="p-3 bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-900 text-rose-700 dark:text-rose-300 text-xs rounded-lg">
                {actionError}
              </div>
            )}

            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 uppercase tracking-wider mb-1">
                Cancellation Reason *
              </label>
              <textarea
                rows={3}
                required
                placeholder="e.g. Passenger requested cancellation due to visa delay..."
                value={cancellationReason}
                onChange={(e) => setCancellationReason(e.target.value)}
                className="w-full px-3 py-2 text-sm rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-rose-500"
              />
            </div>

            <div className="flex justify-end gap-3 pt-2">
              <button
                type="button"
                onClick={() => {
                  setSelectedBookingForCancel(null);
                  setActionError(null);
                }}
                className="px-4 py-2 text-sm font-medium rounded-lg border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800"
              >
                Close
              </button>
              <button
                type="button"
                disabled={isSubmitting || cancellationReason.trim().length < 5}
                onClick={handleCancelSubmit}
                className="px-4 py-2 text-sm font-semibold rounded-lg bg-rose-600 hover:bg-rose-700 text-white disabled:opacity-50 transition-colors"
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
