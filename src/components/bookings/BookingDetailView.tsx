"use client";

import React, { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  ArrowLeft,
  Plane,
  Building,
  FileCheck,
  Car,
  Compass,
  Users,
  Calendar,
  DollarSign,
  TrendingUp,
  FileText,
  Clock,
  CheckCircle2,
  Ban,
  Upload,
  ChevronDown,
  ChevronUp,
  Shield,
  Edit,
  Printer,
  History,
  AlertCircle,
  ExternalLink,
} from "lucide-react";
import { BookingStatus, ServiceType } from "@prisma/client";
import { updateBookingStatus, cancelBooking } from "@/app/actions/bookings";
import { attachDocument } from "@/app/actions/documents";

function formatDate(dateStr?: string | Date | null): string {
  if (!dateStr) return "—";
  try {
    const d = typeof dateStr === "string" ? new Date(dateStr) : dateStr;
    if (isNaN(d.getTime())) return "—";
    return d.toISOString().split("T")[0];
  } catch {
    return "—";
  }
}

interface BookingDetailViewProps {
  booking: any;
  currentUserRole?: string;
}

export function BookingDetailView({ booking, currentUserRole }: BookingDetailViewProps) {
  const router = useRouter();
  const [expandedServices, setExpandedServices] = useState<Record<string, boolean>>({
    [booking.serviceItems?.[0]?.id || "0"]: true,
  });

  const [isCancelling, setIsCancelling] = useState(false);
  const [cancellationReason, setCancellationReason] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);

  // Document upload state
  const [isAttachingDoc, setIsAttachingDoc] = useState(false);
  const [docName, setDocName] = useState("");
  const [docType, setDocType] = useState("application/pdf");
  const [docGcsPath, setDocGcsPath] = useState("");

  const toggleServiceExpand = (id: string) => {
    setExpandedServices((prev) => ({ ...prev, [id]: !prev[id] }));
  };

  const handleStatusChange = async (newStatus: BookingStatus) => {
    setIsSubmitting(true);
    setActionError(null);
    try {
      const res = await updateBookingStatus(booking.id, newStatus);
      if (res.success) {
        router.refresh();
      } else {
        setActionError(res.error || "Failed to update status");
      }
    } catch (err: any) {
      setActionError(err.message || "An error occurred");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleCancelSubmit = async () => {
    if (!cancellationReason.trim()) return;
    setIsSubmitting(true);
    setActionError(null);
    try {
      const res = await cancelBooking(booking.id, cancellationReason);
      if (res.success) {
        setIsCancelling(false);
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

  const handleAttachDoc = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!docName.trim() || !docGcsPath.trim()) return;
    setIsSubmitting(true);
    try {
      const res = await attachDocument({
        bookingId: booking.id,
        entityType: "BOOKING",
        entityId: booking.id,
        fileName: docName.trim(),
        fileSize: 1024 * 150, // Standard payload size
        mimeType: docType,
        gcsPath: docGcsPath.trim(),
      });
      if (res.success) {
        setIsAttachingDoc(false);
        setDocName("");
        setDocGcsPath("");
        router.refresh();
      } else {
        setActionError(res.error || "Failed to attach document");
      }
    } catch (err: any) {
      setActionError(err.message || "Failed to upload document");
    } finally {
      setIsSubmitting(false);
    }
  };

  const getStatusBadge = (status: BookingStatus) => {
    switch (status) {
      case "CONFIRMED":
      case "COMPLETED":
        return (
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-emerald-100 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300">
            <CheckCircle2 className="w-3.5 h-3.5" /> {status}
          </span>
        );
      case "QUOTATION":
        return (
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-blue-100 text-blue-800 dark:bg-blue-950/60 dark:text-blue-300">
            <Clock className="w-3.5 h-3.5" /> QUOTATION
          </span>
        );
      case "DRAFT":
        return (
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300">
            DRAFT
          </span>
        );
      case "CANCELLED":
        return (
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-rose-100 text-rose-800 dark:bg-rose-950/60 dark:text-rose-300">
            <Ban className="w-3.5 h-3.5" /> CANCELLED
          </span>
        );
      default:
        return (
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-indigo-100 text-indigo-800 dark:bg-indigo-950/60 dark:text-indigo-300">
            {status}
          </span>
        );
    }
  };

  const getServiceIcon = (type: string) => {
    switch (type) {
      case "FLIGHT": return <Plane className="w-4 h-4 text-sky-600" />;
      case "HOTEL": return <Building className="w-4 h-4 text-amber-600" />;
      case "VISA": return <FileCheck className="w-4 h-4 text-emerald-600" />;
      case "TRANSFER": return <Car className="w-4 h-4 text-purple-600" />;
      case "TOUR": return <Compass className="w-4 h-4 text-rose-600" />;
      default: return <Shield className="w-4 h-4 text-slate-500" />;
    }
  };

  const marginPercentage =
    booking.totalNetSelling > 0
      ? ((booking.totalGrossMargin / booking.totalNetSelling) * 100).toFixed(1)
      : "0.0";

  return (
    <div className="space-y-8 max-w-7xl mx-auto pb-16">
      {/* Top Header & Action Controls */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-slate-200 dark:border-slate-800 pb-5">
        <div className="flex items-center gap-3">
          <Link
            href="/bookings"
            className="p-1.5 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg transition-colors"
          >
            <ArrowLeft className="w-5 h-5" />
          </Link>
          <div>
            <div className="flex items-center gap-3">
              <h1 className="text-2xl font-bold text-slate-900 dark:text-white font-mono">
                {booking.bookingNumber}
              </h1>
              {getStatusBadge(booking.status)}
              {booking.pnrOrRef && (
                <span className="px-2.5 py-0.5 rounded text-xs font-mono font-bold bg-sky-100 dark:bg-sky-950/60 text-sky-800 dark:text-sky-300">
                  PNR: {booking.pnrOrRef}
                </span>
              )}
            </div>
            <p className="text-xs text-slate-500 mt-1">
              Created on {formatDate(booking.createdAt)} by {booking.createdBy?.name || "System"}
            </p>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex flex-wrap items-center gap-2">
          {booking.status === "QUOTATION" && (
            <button
              onClick={() => handleStatusChange(BookingStatus.CONFIRMED)}
              disabled={isSubmitting}
              className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-bold rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white shadow-sm transition-colors"
            >
              <CheckCircle2 className="w-3.5 h-3.5" /> Convert to Confirmed
            </button>
          )}

          {booking.status !== "CANCELLED" && (
            <button
              onClick={() => setIsCancelling(true)}
              disabled={isSubmitting}
              className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-semibold rounded-lg border border-rose-200 dark:border-rose-900 text-rose-600 dark:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/40 transition-colors"
            >
              <Ban className="w-3.5 h-3.5" /> Cancel Booking
            </button>
          )}

          <Link
            href={`/bookings/${booking.id}/edit`}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold rounded-lg border border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors"
          >
            <Edit className="w-3.5 h-3.5" /> Edit Booking
          </Link>

          <button
            onClick={() => window.print()}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold rounded-lg border border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors"
          >
            <Printer className="w-3.5 h-3.5" /> Print Voucher
          </button>
        </div>
      </div>

      {actionError && (
        <div className="p-4 bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-900 text-rose-700 dark:text-rose-300 text-xs rounded-xl flex items-center gap-2">
          <AlertCircle className="w-4 h-4 shrink-0 text-rose-600" />
          <span>{actionError}</span>
        </div>
      )}

      {/* Main Two-Column Layout */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
        {/* Left Column (Details, Services, Passengers) */}
        <div className="lg:col-span-8 space-y-8">
          {/* SECTION 1: MASTER SUMMARY CARD */}
          <div className="p-6 rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-sm space-y-4">
            <h2 className="text-sm font-bold uppercase tracking-wider text-slate-500">
              General Information
            </h2>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 text-xs">
              <div>
                <p className="text-slate-400">Customer</p>
                <p className="font-bold text-sm text-slate-900 dark:text-white mt-0.5">
                  {booking.customer?.name}
                </p>
                <p className="text-slate-400 text-[11px] font-mono">{booking.customer?.code}</p>
              </div>
              <div>
                <p className="text-slate-400">Lead Passenger</p>
                <p className="font-semibold text-slate-800 dark:text-slate-200 mt-0.5">
                  {booking.leadPassenger || "—"}
                </p>
              </div>
              <div>
                <p className="text-slate-400">Sales Agent / Handler</p>
                <p className="font-semibold text-slate-800 dark:text-slate-200 mt-0.5">
                  {booking.createdBy?.name || "System"}
                </p>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3 pt-2">
              <div>
                <p className="text-xs text-slate-400">Travel Start Date</p>
                <p className="font-semibold text-slate-800 dark:text-slate-200 mt-0.5">
                  {formatDate(booking.travelStartDate)}
                </p>
              </div>
              <div>
                <p className="text-xs text-slate-400">Return Date</p>
                <p className="font-semibold text-slate-800 dark:text-slate-200 mt-0.5">
                  {booking.travelEndDate ? formatDate(booking.travelEndDate) : "One Way / Open"}
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Cancellation Notice Banner */}
      {booking.status === "CANCELLED" && (
        <div className="p-4 rounded-xl bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-900 space-y-1">
          <div className="flex items-center gap-2 text-rose-800 dark:text-rose-300 font-bold text-sm">
            <Ban className="w-4 h-4" /> This booking was cancelled
          </div>
          <p className="text-xs text-rose-700 dark:text-rose-400">
            <strong>Reason:</strong> {booking.cancellationReason || "No reason specified"}
          </p>
          <p className="text-[11px] text-rose-500">
            Cancelled on {booking.cancelledAt ? new Date(booking.cancelledAt).toLocaleString() : ""} by{" "}
            {booking.cancelledBy?.name || "Staff"}
          </p>
        </div>
      )}

      {/* SECTION 1: MASTER SUMMARY & FINANCIAL OVERVIEW */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Customer & Itinerary Details Card */}
        <div className="p-6 rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-sm space-y-4">
          <h2 className="text-sm font-bold text-slate-900 dark:text-white uppercase tracking-wider flex items-center gap-2 border-b border-slate-100 dark:border-slate-800 pb-2">
            <Users className="w-4 h-4 text-blue-600" /> Customer & Itinerary Profile
          </h2>

          <div className="space-y-3 text-sm">
            <div>
              <p className="text-xs text-slate-400">Billing Customer</p>
              <Link
                href={`/customers/${booking.customer?.id}`}
                className="font-bold text-blue-600 hover:underline flex items-center gap-1 mt-0.5"
              >
                {booking.customer?.name} ({booking.customer?.code})
              </Link>
              {booking.customer?.companyName && (
                <p className="text-xs text-slate-500">{booking.customer.companyName}</p>
              )}
            </div>

            <div className="grid grid-cols-2 gap-3 pt-2">
              <div>
                <p className="text-xs text-slate-400">Travel Start Date</p>
                <p className="font-semibold text-slate-800 dark:text-slate-200 mt-0.5">
                  {formatDate(booking.travelStartDate)}
                </p>
              </div>
              <div>
                <p className="text-xs text-slate-400">Return Date</p>
                <p className="font-semibold text-slate-800 dark:text-slate-200 mt-0.5">
                  {booking.travelEndDate ? formatDate(booking.travelEndDate) : "One Way / Open"}
                </p>
              </div>
            </div>

            {booking.destination && (
              <div>
                <p className="text-xs text-slate-400">Destination Route</p>
                <p className="font-semibold text-slate-800 dark:text-slate-200 mt-0.5">
                  {booking.destination}
                </p>
              </div>
            )}

            {booking.salesAgent && (
              <div>
                <p className="text-xs text-slate-400">Sales Consultant</p>
                <p className="font-medium text-slate-700 dark:text-slate-300 mt-0.5">
                  {booking.salesAgent}
                </p>
              </div>
            )}

            {booking.notes && (
              <div className="p-2.5 rounded-lg bg-slate-50 dark:bg-slate-800/60 text-xs text-slate-600 dark:text-slate-300 border border-slate-200 dark:border-slate-700">
                <strong>Notes:</strong> {booking.notes}
              </div>
            )}
          </div>
        </div>

        {/* Financial Breakdown Card (AFN Base) */}
        <div className="lg:col-span-2 p-6 rounded-2xl border-2 border-blue-500/20 bg-gradient-to-br from-slate-900 to-slate-950 text-white shadow-lg space-y-6">
          <div className="flex items-center justify-between border-b border-slate-800 pb-3">
            <h2 className="text-sm font-bold text-blue-400 uppercase tracking-wider flex items-center gap-2">
              <DollarSign className="w-4 h-4" /> Operational Financial Summary (AFN Base)
            </h2>
            <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300">
              {marginPercentage}% Gross Margin
            </span>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 text-center sm:text-left">
            <div>
              <p className="text-xs text-slate-400">Gross Selling</p>
              <p className="text-lg font-bold text-white font-mono mt-1">
                {booking.totalSellPrice.toLocaleString(undefined, { minimumFractionDigits: 2 })}
              </p>
              <span className="text-[10px] text-slate-500">AFN</span>
            </div>

            <div>
              <p className="text-xs text-slate-400">Discounts</p>
              <p className="text-lg font-bold text-amber-400 font-mono mt-1">
                {booking.totalDiscount.toLocaleString(undefined, { minimumFractionDigits: 2 })}
              </p>
              <span className="text-[10px] text-slate-500">AFN</span>
            </div>

            <div>
              <p className="text-xs text-slate-400">Net Selling (Client Total)</p>
              <p className="text-xl font-extrabold text-blue-400 font-mono mt-1">
                {booking.totalNetSelling.toLocaleString(undefined, { minimumFractionDigits: 2 })}
              </p>
              <span className="text-[10px] text-slate-500">AFN</span>
            </div>

            <div>
              <p className="text-xs text-slate-400">Supplier Direct Cost</p>
              <p className="text-lg font-bold text-rose-400 font-mono mt-1">
                {booking.totalCostPrice.toLocaleString(undefined, { minimumFractionDigits: 2 })}
              </p>
              <span className="text-[10px] text-slate-500">AFN</span>
            </div>
          </div>

          <div className="p-4 rounded-xl bg-emerald-950/40 border border-emerald-800/50 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <p className="text-xs font-semibold text-emerald-400 uppercase tracking-wider">
                Booking Gross Profit (Net Selling - Cost)
              </p>
              <p className="text-xs text-slate-400 mt-0.5">
                Derived directly from operational services. GL accounting posting occurs during Invoicing.
              </p>
            </div>
            <div className="text-right">
              <p className="text-2xl font-black text-emerald-300 font-mono">
                {booking.totalGrossMargin.toLocaleString(undefined, { minimumFractionDigits: 2 })}{" "}
                <span className="text-xs font-normal text-emerald-400">AFN</span>
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* SECTION 2: PASSENGERS ROSTER */}
      <div className="p-6 rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-sm space-y-4">
        <h2 className="text-base font-bold text-slate-900 dark:text-white flex items-center gap-2">
          <Users className="w-5 h-5 text-indigo-600" />
          Passenger Manifest & Identification ({booking.passengers?.length || 0})
        </h2>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs text-slate-600 dark:text-slate-300">
            <thead className="bg-slate-50 dark:bg-slate-800/60 uppercase font-semibold text-slate-400 border-b border-slate-200 dark:border-slate-800">
              <tr>
                <th className="px-4 py-3">#</th>
                <th className="px-4 py-3">Passenger Name</th>
                <th className="px-4 py-3">Gender / DOB</th>
                <th className="px-4 py-3">Passport Number</th>
                <th className="px-4 py-3">Expiry / Country</th>
                <th className="px-4 py-3">Visa Number</th>
                <th className="px-4 py-3">Contact</th>
                <th className="px-4 py-3">Requirements</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800 font-medium">
              {booking.passengers?.map((pax: any, idx: number) => (
                <tr key={pax.id || idx} className="hover:bg-slate-50/60 dark:hover:bg-slate-800/30">
                  <td className="px-4 py-3 font-bold text-slate-400">{idx + 1}</td>
                  <td className="px-4 py-3">
                    <div className="font-bold text-slate-900 dark:text-white">
                      {pax.title} {pax.firstName} {pax.middleName ? `${pax.middleName} ` : ""}{pax.lastName}
                    </div>
                    <div className="text-[11px] text-slate-400">{pax.nationality}</div>
                  </td>
                  <td className="px-4 py-3">
                    <div>{pax.gender || "—"}</div>
                    <div className="text-[11px] text-slate-400">
                      {pax.dateOfBirth ? formatDate(pax.dateOfBirth) : "—"}
                    </div>
                  </td>
                  <td className="px-4 py-3 font-mono font-bold text-slate-900 dark:text-slate-100 uppercase">
                    {pax.passportNumber || "—"}
                  </td>
                  <td className="px-4 py-3">
                    <div>{pax.passportExpiryDate ? formatDate(pax.passportExpiryDate) : "—"}</div>
                    <div className="text-[11px] text-slate-400">{pax.passportIssuingCountry || "Afghanistan"}</div>
                  </td>
                  <td className="px-4 py-3 font-mono">
                    {pax.visaNumber || "—"}
                  </td>
                  <td className="px-4 py-3">
                    <div>{pax.phone || "—"}</div>
                    <div className="text-[11px] text-slate-400">{pax.email || ""}</div>
                  </td>
                  <td className="px-4 py-3 text-slate-500">
                    {pax.specialRequirements || "Standard"}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* SECTION 3: DETAILED TRAVEL SERVICES ITINERARY */}
      <div className="space-y-4">
        <h2 className="text-base font-bold text-slate-900 dark:text-white flex items-center gap-2">
          <Plane className="w-5 h-5 text-sky-600" />
          Travel Service Items ({booking.serviceItems?.length || 0})
        </h2>

        <div className="space-y-4">
          {booking.serviceItems?.map((item: any, idx: number) => {
            const isExpanded = expandedServices[item.id] !== false;

            return (
              <div
                key={item.id || idx}
                className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-sm overflow-hidden"
              >
                {/* Accordion Header */}
                <div
                  onClick={() => toggleServiceExpand(item.id)}
                  className="p-5 flex items-center justify-between cursor-pointer hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors border-b border-slate-100 dark:border-slate-800"
                >
                  <div className="flex items-center gap-3">
                    <div className="p-2 rounded-xl bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700">
                      {getServiceIcon(item.serviceType)}
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-bold px-2 py-0.5 rounded bg-blue-100 text-blue-800 dark:bg-blue-950/60 dark:text-blue-300">
                          {item.serviceType}
                        </span>
                        <h3 className="font-bold text-slate-900 dark:text-white text-sm">
                          {item.description}
                        </h3>
                      </div>
                      <p className="text-xs text-slate-400 mt-0.5">
                        Supplier: <strong className="text-slate-700 dark:text-slate-300">{item.supplier?.name}</strong> | Qty: {item.quantity}
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center gap-6">
                    <div className="text-right">
                      <p className="text-xs text-slate-400">Net Selling</p>
                      <p className="font-bold text-slate-900 dark:text-white font-mono text-sm">
                        {item.netSellingBase?.toLocaleString(undefined, { minimumFractionDigits: 2 })} AFN
                      </p>
                    </div>

                    <div className="text-right">
                      <p className="text-xs text-slate-400">Direct Cost</p>
                      <p className="font-bold text-rose-600 dark:text-rose-400 font-mono text-sm">
                        {item.costPrice?.toLocaleString(undefined, { minimumFractionDigits: 2 })} AFN
                      </p>
                    </div>

                    <div className="text-right">
                      <p className="text-xs text-slate-400">Margin</p>
                      <p className="font-bold text-emerald-600 dark:text-emerald-400 font-mono text-sm">
                        {item.marginAmount?.toLocaleString(undefined, { minimumFractionDigits: 2 })} AFN
                      </p>
                    </div>

                    <button type="button" className="text-slate-400">
                      {isExpanded ? <ChevronUp className="w-5 h-5" /> : <ChevronDown className="w-5 h-5" />}
                    </button>
                  </div>
                </div>

                {/* Accordion Body */}
                {isExpanded && (
                  <div className="p-5 bg-slate-50/50 dark:bg-slate-800/20 space-y-4">
                    {/* Multi-Currency Price Ledger Grid */}
                    <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-6 gap-3 text-xs p-3.5 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 font-mono">
                      <div>
                        <span className="text-slate-400 block font-sans">Currency & Rate</span>
                        <span className="font-bold text-slate-900 dark:text-white">
                          {item.currency} @ {item.exchangeRate} AFN
                        </span>
                      </div>
                      <div>
                        <span className="text-slate-400 block font-sans">Foreign Unit Cost</span>
                        <span className="font-semibold text-rose-600">
                          {item.currency} {item.costPriceForeign?.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                        </span>
                      </div>
                      <div>
                        <span className="text-slate-400 block font-sans">Foreign Unit Sell</span>
                        <span className="font-semibold text-blue-600">
                          {item.currency} {item.sellPriceForeign?.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                        </span>
                      </div>
                      <div>
                        <span className="text-slate-400 block font-sans">Base Cost (AFN)</span>
                        <span className="font-bold text-slate-900 dark:text-white">
                          {item.costPrice?.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                        </span>
                      </div>
                      <div>
                        <span className="text-slate-400 block font-sans">Base Net Sell (AFN)</span>
                        <span className="font-bold text-slate-900 dark:text-white">
                          {item.netSellingBase?.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                        </span>
                      </div>
                      <div>
                        <span className="text-slate-400 block font-sans">Gross Profit (AFN)</span>
                        <span className="font-bold text-emerald-600">
                          {item.marginAmount?.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                        </span>
                      </div>
                    </div>

                    {/* Flight Segments List */}
                    {item.flightSegments && item.flightSegments.length > 0 && (
                      <div className="space-y-2">
                        <h4 className="text-xs font-bold text-sky-800 dark:text-sky-300 uppercase tracking-wider flex items-center gap-1.5">
                          <Plane className="w-3.5 h-3.5" /> Flight Segments Itinerary
                        </h4>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                          {item.flightSegments.map((f: any, fIdx: number) => (
                            <div
                              key={f.id || fIdx}
                              className="p-3.5 rounded-xl border border-sky-100 dark:border-sky-900/40 bg-white dark:bg-slate-900 space-y-2"
                            >
                              <div className="flex items-center justify-between text-xs">
                                <span className="font-bold text-slate-900 dark:text-white">
                                  {f.airline} ({f.flightNumber})
                                </span>
                                <span className="px-2 py-0.5 rounded text-[10px] font-semibold bg-sky-50 dark:bg-sky-950 text-sky-700 dark:text-sky-300">
                                  {f.cabinClass} Class
                                </span>
                              </div>

                              <div className="flex items-center justify-between py-1 border-y border-slate-100 dark:border-slate-800 text-sm font-semibold">
                                <div className="text-left">
                                  <p className="text-slate-900 dark:text-white font-bold">{f.departureAirport}</p>
                                  <p className="text-[11px] text-slate-400 font-normal">
                                    {f.departureDateTime ? new Date(f.departureDateTime).toLocaleString() : "TBD"}
                                  </p>
                                </div>
                                <div className="px-3 text-sky-500 font-mono text-xs">✈ ───▶</div>
                                <div className="text-right">
                                  <p className="text-slate-900 dark:text-white font-bold">{f.arrivalAirport}</p>
                                  <p className="text-[11px] text-slate-400 font-normal">
                                    {f.arrivalDateTime ? new Date(f.arrivalDateTime).toLocaleString() : "TBD"}
                                  </p>
                                </div>
                              </div>

                              <div className="flex items-center justify-between text-[11px] text-slate-500">
                                <span>Baggage: {f.baggageAllowance || "30 KG"}</span>
                                <span>PNR: {f.pnr || "—"}</span>
                                <span>{f.isRefundable ? "Refundable" : "Non-Refundable"}</span>
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Hotel Details */}
                    {item.hotelDetail && (
                      <div className="p-4 rounded-xl border border-amber-100 dark:border-amber-900/40 bg-white dark:bg-slate-900 space-y-2">
                        <h4 className="text-xs font-bold text-amber-800 dark:text-amber-300 uppercase tracking-wider flex items-center gap-1.5">
                          <Building className="w-3.5 h-3.5" /> Hotel Accommodation Voucher Details
                        </h4>
                        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
                          <div>
                            <span className="text-slate-400 block">Hotel & City</span>
                            <span className="font-bold text-slate-900 dark:text-white">
                              {item.hotelDetail.hotelName}, {item.hotelDetail.city}
                            </span>
                          </div>
                          <div>
                            <span className="text-slate-400 block">Check-in / Check-out</span>
                            <span className="font-semibold text-slate-800 dark:text-slate-200">
                              {formatDate(item.hotelDetail.checkInDate)} to{" "}
                              {formatDate(item.hotelDetail.checkOutDate)}
                            </span>
                          </div>
                          <div>
                            <span className="text-slate-400 block">Rooms & Nights</span>
                            <span className="font-bold text-amber-600">
                              {item.hotelDetail.roomsCount} Room(s), {item.hotelDetail.nightsCount} Night(s)
                            </span>
                          </div>
                          <div>
                            <span className="text-slate-400 block">Meal Plan</span>
                            <span className="font-semibold text-slate-800 dark:text-slate-200">
                              {item.hotelDetail.mealPlan}
                            </span>
                          </div>
                        </div>
                      </div>
                    )}

                    {/* Visa Details */}
                    {item.visaDetail && (
                      <div className="p-4 rounded-xl border border-emerald-100 dark:border-emerald-900/40 bg-white dark:bg-slate-900 space-y-2">
                        <h4 className="text-xs font-bold text-emerald-800 dark:text-emerald-300 uppercase tracking-wider flex items-center gap-1.5">
                          <FileCheck className="w-3.5 h-3.5" /> Visa Application File
                        </h4>
                        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
                          <div>
                            <span className="text-slate-400 block">Destination</span>
                            <span className="font-bold text-slate-900 dark:text-white">
                              {item.visaDetail.destinationCountry}
                            </span>
                          </div>
                          <div>
                            <span className="text-slate-400 block">Visa Type</span>
                            <span className="font-semibold text-slate-800 dark:text-slate-200">
                              {item.visaDetail.visaType}
                            </span>
                          </div>
                          <div>
                            <span className="text-slate-400 block">Application #</span>
                            <span className="font-mono font-bold text-slate-800 dark:text-slate-200">
                              {item.visaDetail.applicationNumber || "—"}
                            </span>
                          </div>
                          <div>
                            <span className="text-slate-400 block">Status</span>
                            <span className="font-bold text-emerald-600 uppercase">
                              {item.visaDetail.visaStatus}
                            </span>
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* SECTION 4: DOCUMENTS & GCS ATTACHMENTS */}
      <div className="p-6 rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-sm space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-base font-bold text-slate-900 dark:text-white flex items-center gap-2">
            <FileText className="w-5 h-5 text-purple-600" />
            Document Attachments ({booking.documents?.length || 0})
          </h2>
          <button
            onClick={() => setIsAttachingDoc(true)}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-lg bg-purple-50 dark:bg-purple-950/40 text-purple-700 dark:text-purple-300 hover:bg-purple-100 transition-colors"
          >
            <Upload className="w-3.5 h-3.5" /> Attach Document
          </button>
        </div>

        {booking.documents?.length === 0 ? (
          <p className="text-xs text-slate-400 py-4 text-center">
            No passport copies, vouchers, or ticket attachments registered for this booking yet.
          </p>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {booking.documents?.map((doc: any) => (
              <div
                key={doc.id}
                className="p-3.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-800/30 flex items-center justify-between"
              >
                <div className="truncate mr-3">
                  <p className="text-xs font-bold text-slate-900 dark:text-white truncate">
                    {doc.fileName}
                  </p>
                  <p className="text-[10px] text-slate-400 truncate mt-0.5">
                    {doc.gcsPath}
                  </p>
                </div>
                <span className="p-2 text-purple-600 bg-purple-50 dark:bg-purple-950 rounded-lg">
                  <FileText className="w-4 h-4" />
                </span>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* SECTION 5: AUDIT LOGS & ACTIVITY STREAM */}
      <div className="p-6 rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-sm space-y-4">
        <h2 className="text-base font-bold text-slate-900 dark:text-white flex items-center gap-2">
          <History className="w-5 h-5 text-slate-600" />
          Booking History & Audit Trail ({booking.auditLogs?.length || 0})
        </h2>

        <div className="space-y-3">
          {booking.auditLogs?.length === 0 ? (
            <p className="text-xs text-slate-400 py-2">No historical mutations recorded yet.</p>
          ) : (
            booking.auditLogs?.map((log: any) => (
              <div
                key={log.id}
                className="p-3 rounded-xl border border-slate-100 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-800/30 flex items-center justify-between text-xs"
              >
                <div>
                  <span className="font-bold text-slate-800 dark:text-slate-200">
                    {log.action}
                  </span>{" "}
                  by <strong className="text-blue-600">{log.user?.name || "System"}</strong>
                  {log.newValues && (
                    <div className="text-[11px] text-slate-400 font-mono mt-0.5">
                      {JSON.stringify(log.newValues)}
                    </div>
                  )}
                </div>
                <span className="text-[11px] text-slate-400">
                  {new Date(log.createdAt).toLocaleString()}
                </span>
              </div>
            ))
          )}
        </div>
      </div>

      {/* Cancel Modal */}
      {isCancelling && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-sm p-4">
          <div className="w-full max-w-md bg-white dark:bg-slate-900 rounded-2xl shadow-xl border border-slate-200 dark:border-slate-800 p-6 space-y-4">
            <h3 className="text-lg font-bold text-slate-900 dark:text-white flex items-center gap-2 text-rose-600">
              <Ban className="w-5 h-5" /> Cancel Booking #{booking.bookingNumber}
            </h3>
            <p className="text-xs text-slate-500">
              Cancellation is permanent but preserves the entire booking and audit trail. Please specify the reason.
            </p>

            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 uppercase tracking-wider mb-1">
                Reason for Cancellation *
              </label>
              <textarea
                rows={3}
                required
                value={cancellationReason}
                onChange={(e) => setCancellationReason(e.target.value)}
                placeholder="Detailed reason..."
                className="w-full px-3 py-2 text-sm rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800"
              />
            </div>

            <div className="flex justify-end gap-3 pt-2">
              <button
                type="button"
                onClick={() => setIsCancelling(false)}
                className="px-4 py-2 text-xs font-medium rounded-lg border border-slate-200 dark:border-slate-700"
              >
                Close
              </button>
              <button
                type="button"
                disabled={isSubmitting || cancellationReason.trim().length < 5}
                onClick={handleCancelSubmit}
                className="px-4 py-2 text-xs font-semibold rounded-lg bg-rose-600 hover:bg-rose-700 text-white disabled:opacity-50"
              >
                {isSubmitting ? "Cancelling..." : "Confirm Cancellation"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Attach Document Modal */}
      {isAttachingDoc && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-sm p-4">
          <form
            onSubmit={handleAttachDoc}
            className="w-full max-w-md bg-white dark:bg-slate-900 rounded-2xl shadow-xl border border-slate-200 dark:border-slate-800 p-6 space-y-4"
          >
            <h3 className="text-lg font-bold text-slate-900 dark:text-white flex items-center gap-2 text-purple-600">
              <Upload className="w-5 h-5" /> Attach Document to Booking
            </h3>

            <div className="space-y-3 text-xs">
              <div>
                <label className="block font-semibold mb-1">Document Title *</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Pax Passport Copies, Hotel Voucher, Kam Air Ticket"
                  value={docName}
                  onChange={(e) => setDocName(e.target.value)}
                  className="w-full px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800"
                />
              </div>

              <div>
                <label className="block font-semibold mb-1">MIME Type</label>
                <select
                  value={docType}
                  onChange={(e) => setDocType(e.target.value)}
                  className="w-full px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800"
                >
                  <option value="application/pdf">PDF Document (.pdf)</option>
                  <option value="image/jpeg">JPEG Image (.jpg)</option>
                  <option value="image/png">PNG Image (.png)</option>
                </select>
              </div>

              <div>
                <label className="block font-semibold mb-1">Google Cloud Storage Path (GCS) *</label>
                <input
                  type="text"
                  required
                  placeholder="gs://travel-accounting-2026-docs/bookings/BKG-2026-0001/doc.pdf"
                  value={docGcsPath}
                  onChange={(e) => setDocGcsPath(e.target.value)}
                  className="w-full px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 font-mono"
                />
              </div>
            </div>

            <div className="flex justify-end gap-3 pt-2">
              <button
                type="button"
                onClick={() => setIsAttachingDoc(false)}
                className="px-4 py-2 text-xs font-medium rounded-lg border border-slate-200 dark:border-slate-700"
              >
                Close
              </button>
              <button
                type="submit"
                disabled={isSubmitting}
                className="px-4 py-2 text-xs font-semibold rounded-lg bg-purple-600 hover:bg-purple-700 text-white disabled:opacity-50"
              >
                {isSubmitting ? "Attaching..." : "Save Attachment"}
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}
