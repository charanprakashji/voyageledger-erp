"use client";

import React, { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import {
  ArrowLeft,
  Save,
  Plus,
  Trash2,
  DollarSign,
  AlertCircle,
  FileText,
  Layers,
  Percent,
} from "lucide-react";
import { InvoiceStatus, ServiceType } from "@prisma/client";
import { createInvoice, InvoiceLineInput } from "@/app/actions/invoices";
import { calculateInvoiceTotals } from "@/lib/invoicing";

interface InvoiceFormProps {
  customers: Array<{ id: string; name: string; code: string; companyName?: string | null; defaultCurrency?: string }>;
  bookings: Array<{
    id: string;
    bookingNumber: string;
    customerId: string;
    currency: string;
    serviceItems: Array<{
      id: string;
      serviceType: ServiceType;
      description: string;
      sellPriceForeign: number;
      currency: string;
      exchangeRate: number;
    }>;
  }>;
  chartOfAccounts: Array<{ id: string; code: string; name: string; accountType: string }>;
  taxConfigurations: Array<{ id: string; taxCode: string; taxName: string; percentage: number; liabilityAccountId?: string | null }>;
  defaultCurrencies?: string[];
}

export function InvoiceForm({
  customers,
  bookings,
  chartOfAccounts,
  taxConfigurations,
  defaultCurrencies = ["AFN", "USD", "EUR", "AED", "GBP"],
}: InvoiceFormProps) {
  const router = useRouter();

  const [customerId, setCustomerId] = useState(customers[0]?.id || "");
  const [bookingId, setBookingId] = useState<string>("");
  const [currency, setCurrency] = useState("USD");
  const [exchangeRate, setExchangeRate] = useState<number>(70.5);
  const [issueDate, setIssueDate] = useState(new Date().toISOString().split("T")[0]);
  const [dueDate, setDueDate] = useState(
    new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().split("T")[0]
  );
  const [paymentTerms, setPaymentTerms] = useState("Net 30 Days");
  const [notes, setNotes] = useState("");
  const [terms, setTerms] = useState("Payment due within 30 days. Remit in designated currency or AFN equivalent.");
  const [status, setStatus] = useState<InvoiceStatus>(InvoiceStatus.APPROVED);

  // Revenue accounts filter
  const revenueAccounts = chartOfAccounts.filter((a) => a.accountType === "REVENUE");

  // Default Tax
  const defaultTax = taxConfigurations[0];

  const [lines, setLines] = useState<InvoiceLineInput[]>([
    {
      serviceType: ServiceType.FLIGHT,
      description: "Airline Passenger Ticket",
      quantity: 1,
      unitPriceForeign: 500,
      discountForeign: 0,
      taxRate: defaultTax ? defaultTax.percentage / 100 : 0,
      revenueAccountId: revenueAccounts[0]?.id || chartOfAccounts[0]?.id,
      taxLiabilityAccountId: defaultTax?.liabilityAccountId || undefined,
    },
  ]);

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // When customer changes, filter bookings
  const availableBookings = bookings.filter((b) => !customerId || b.customerId === customerId);

  // If a booking is selected, import its service items
  const handleBookingSelect = (bkgId: string) => {
    setBookingId(bkgId);
    if (!bkgId) return;

    const bkg = bookings.find((b) => b.id === bkgId);
    if (bkg && bkg.serviceItems?.length > 0) {
      setCurrency(bkg.currency || "USD");
      const importedLines: InvoiceLineInput[] = bkg.serviceItems.map((item) => {
        const matchingRev = revenueAccounts.find((r) => r.name.toLowerCase().includes(item.serviceType.toLowerCase())) || revenueAccounts[0];
        return {
          bookingServiceItemId: item.id,
          serviceType: item.serviceType,
          description: item.description || `${item.serviceType} Reservation`,
          quantity: 1,
          unitPriceForeign: item.sellPriceForeign || 0,
          discountForeign: 0,
          taxRate: defaultTax ? defaultTax.percentage / 100 : 0,
          revenueAccountId: matchingRev?.id || revenueAccounts[0]?.id,
          taxLiabilityAccountId: defaultTax?.liabilityAccountId || undefined,
        };
      });
      setLines(importedLines);
    }
  };

  const handleCurrencyChange = (newCurr: string) => {
    setCurrency(newCurr);
    if (newCurr === "USD") setExchangeRate(70.5);
    else if (newCurr === "EUR") setExchangeRate(77.2);
    else if (newCurr === "AED") setExchangeRate(19.2);
    else if (newCurr === "GBP") setExchangeRate(91.5);
    else if (newCurr === "AFN") setExchangeRate(1.0);
  };

  const addLine = () => {
    setLines([
      ...lines,
      {
        serviceType: ServiceType.OTHER,
        description: "Travel Service Item",
        quantity: 1,
        unitPriceForeign: 0,
        discountForeign: 0,
        taxRate: defaultTax ? defaultTax.percentage / 100 : 0,
        revenueAccountId: revenueAccounts[0]?.id || chartOfAccounts[0]?.id,
        taxLiabilityAccountId: defaultTax?.liabilityAccountId || undefined,
      },
    ]);
  };

  const removeLine = (idx: number) => {
    if (lines.length === 1) return;
    setLines(lines.filter((_, i) => i !== idx));
  };

  const updateLine = (idx: number, field: keyof InvoiceLineInput, value: any) => {
    const updated = [...lines];
    updated[idx] = { ...updated[idx], [field]: value };
    setLines(updated);
  };

  const totals = React.useMemo(() => {
    try {
      return calculateInvoiceTotals(
        lines.map((l) => ({ ...l, exchangeRate }))
      );
    } catch {
      return null;
    }
  }, [lines, exchangeRate]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    setErrorMessage(null);

    if (!customerId) {
      setErrorMessage("Please select a customer for the invoice");
      setIsSubmitting(false);
      return;
    }

    const invalidLine = lines.some((l) => Number(l.unitPriceForeign) < 0 || !l.description.trim());
    if (invalidLine) {
      setErrorMessage("All invoice lines must have a valid description and non-negative price");
      setIsSubmitting(false);
      return;
    }

    try {
      const res = await createInvoice({
        customerId,
        bookingId: bookingId || undefined,
        currency,
        exchangeRate,
        issueDate,
        dueDate,
        paymentTerms,
        notes,
        terms,
        status,
        lines,
      });

      if (res.success) {
        router.push(`/invoices/${res.data?.id}`);
        router.refresh();
      } else {
        setErrorMessage(res.error || "Failed to create invoice");
      }
    } catch (err: any) {
      setErrorMessage(err.message || "An unexpected error occurred");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-8 max-w-7xl mx-auto pb-16">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-200 dark:border-slate-800 pb-5">
        <div className="flex items-center gap-3">
          <Link
            href="/invoices"
            className="p-1.5 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg transition-colors"
          >
            <ArrowLeft className="w-5 h-5" />
          </Link>
          <div>
            <h1 className="text-2xl font-bold text-slate-900 dark:text-white">
              Create Customer Invoice
            </h1>
            <p className="text-xs text-slate-500 mt-0.5">
              Multi-Currency Billing with Direct General Ledger Double-Entry Posting
            </p>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <Link
            href="/invoices"
            className="px-4 py-2 text-sm font-medium rounded-lg border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800"
          >
            Cancel
          </Link>
          <button
            type="submit"
            disabled={isSubmitting}
            className="inline-flex items-center gap-2 px-6 py-2 text-sm font-bold rounded-lg bg-blue-600 hover:bg-blue-700 text-white shadow-sm transition-colors"
          >
            <Save className="w-4 h-4" />
            {isSubmitting ? "Generating..." : "Save Invoice"}
          </button>
        </div>
      </div>

      {errorMessage && (
        <div className="p-4 bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-900 text-rose-700 dark:text-rose-300 text-sm rounded-xl flex items-center gap-3">
          <AlertCircle className="w-5 h-5 shrink-0" />
          <span>{errorMessage}</span>
        </div>
      )}

      {/* Header Profile */}
      <div className="p-6 rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-sm space-y-6">
        <h2 className="text-base font-bold text-slate-900 dark:text-white flex items-center gap-2">
          <Layers className="w-5 h-5 text-blue-600" />
          Invoice & Billing Settings
        </h2>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
          <div>
            <label className="block text-xs font-semibold uppercase tracking-wider mb-1.5 text-slate-700 dark:text-slate-300">
              Customer *
            </label>
            <select
              value={customerId}
              onChange={(e) => setCustomerId(e.target.value)}
              required
              className="w-full px-3.5 py-2 text-sm rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white font-medium"
            >
              {customers.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.code} - {c.name} {c.companyName ? `(${c.companyName})` : ""}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-xs font-semibold uppercase tracking-wider mb-1.5 text-slate-700 dark:text-slate-300">
              Link Travel Booking (Optional)
            </label>
            <select
              value={bookingId}
              onChange={(e) => handleBookingSelect(e.target.value)}
              className="w-full px-3.5 py-2 text-sm rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white font-mono"
            >
              <option value="">-- Standalone Invoice (No Booking) --</option>
              {availableBookings.map((b) => (
                <option key={b.id} value={b.id}>
                  {b.bookingNumber} ({b.serviceItems?.length || 0} services)
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-xs font-semibold uppercase tracking-wider mb-1.5 text-slate-700 dark:text-slate-300">
              Initial Status
            </label>
            <select
              value={status}
              onChange={(e) => setStatus(e.target.value as InvoiceStatus)}
              className="w-full px-3.5 py-2 text-sm rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white font-bold"
            >
              <option value="APPROVED">APPROVED (Ready for Post)</option>
              <option value="POSTED">POSTED (Immediate GL Entry)</option>
              <option value="DRAFT">DRAFT</option>
            </select>
          </div>

          <div>
            <label className="block text-xs font-semibold uppercase tracking-wider mb-1.5 text-slate-700 dark:text-slate-300">
              Invoice Currency
            </label>
            <select
              value={currency}
              onChange={(e) => handleCurrencyChange(e.target.value)}
              className="w-full px-3.5 py-2 text-sm rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white font-bold"
            >
              {defaultCurrencies.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-xs font-semibold uppercase tracking-wider mb-1.5 text-slate-700 dark:text-slate-300">
              Exchange Rate (AFN per {currency}) *
            </label>
            <input
              type="number"
              step="0.0001"
              required
              min="0.0001"
              value={exchangeRate}
              onChange={(e) => setExchangeRate(parseFloat(e.target.value) || 1)}
              className="w-full px-3.5 py-2 text-sm rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white font-mono font-bold"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold uppercase tracking-wider mb-1.5 text-slate-700 dark:text-slate-300">
              Issue Date *
            </label>
            <input
              type="date"
              required
              value={issueDate}
              onChange={(e) => setIssueDate(e.target.value)}
              className="w-full px-3.5 py-2 text-sm rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold uppercase tracking-wider mb-1.5 text-slate-700 dark:text-slate-300">
              Due Date *
            </label>
            <input
              type="date"
              required
              value={dueDate}
              onChange={(e) => setDueDate(e.target.value)}
              className="w-full px-3.5 py-2 text-sm rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold uppercase tracking-wider mb-1.5 text-slate-700 dark:text-slate-300">
              Payment Terms
            </label>
            <input
              type="text"
              value={paymentTerms}
              onChange={(e) => setPaymentTerms(e.target.value)}
              className="w-full px-3.5 py-2 text-sm rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white"
            />
          </div>
        </div>
      </div>

      {/* Line Items Builder */}
      <div className="p-6 rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-sm space-y-6">
        <div className="flex items-center justify-between">
          <h2 className="text-base font-bold text-slate-900 dark:text-white flex items-center gap-2">
            <FileText className="w-5 h-5 text-indigo-600" />
            Invoice Line Items & Revenue Mapping ({lines.length})
          </h2>
          <button
            type="button"
            onClick={addLine}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-lg bg-indigo-50 dark:bg-indigo-950/40 text-indigo-700 dark:text-indigo-300 hover:bg-indigo-100"
          >
            <Plus className="w-3.5 h-3.5" /> Add Line
          </button>
        </div>

        <div className="space-y-4">
          {lines.map((line, idx) => (
            <div
              key={idx}
              className="p-4 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-800/30 space-y-3"
            >
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-indigo-700 dark:text-indigo-400">
                  Line #{idx + 1}
                </span>
                {lines.length > 1 && (
                  <button
                    type="button"
                    onClick={() => removeLine(idx)}
                    className="text-slate-400 hover:text-rose-600 transition-colors"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                )}
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-7 gap-3 text-xs">
                <div>
                  <label className="font-semibold text-slate-600 dark:text-slate-400">Service</label>
                  <select
                    value={line.serviceType}
                    onChange={(e) => updateLine(idx, "serviceType", e.target.value as ServiceType)}
                    className="mt-1 w-full px-2.5 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800"
                  >
                    <option value="FLIGHT">Flight</option>
                    <option value="HOTEL">Hotel</option>
                    <option value="VISA">Visa</option>
                    <option value="TRANSFER">Transfer</option>
                    <option value="TOUR">Tour</option>
                    <option value="INSURANCE">Insurance</option>
                    <option value="OTHER">Other</option>
                  </select>
                </div>

                <div className="lg:col-span-2">
                  <label className="font-semibold text-slate-600 dark:text-slate-400">Description *</label>
                  <input
                    type="text"
                    required
                    value={line.description}
                    onChange={(e) => updateLine(idx, "description", e.target.value)}
                    className="mt-1 w-full px-2.5 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 font-medium"
                  />
                </div>

                <div>
                  <label className="font-semibold text-slate-600 dark:text-slate-400">Revenue GL Account</label>
                  <select
                    value={line.revenueAccountId}
                    onChange={(e) => updateLine(idx, "revenueAccountId", e.target.value)}
                    className="mt-1 w-full px-2.5 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800"
                  >
                    {revenueAccounts.map((acc) => (
                      <option key={acc.id} value={acc.id}>
                        {acc.code} - {acc.name}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="font-semibold text-slate-600 dark:text-slate-400">Qty</label>
                  <input
                    type="number"
                    min="1"
                    required
                    value={line.quantity}
                    onChange={(e) => updateLine(idx, "quantity", parseInt(e.target.value) || 1)}
                    className="mt-1 w-full px-2.5 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800"
                  />
                </div>

                <div>
                  <label className="font-semibold text-slate-600 dark:text-slate-400">Price ({currency})</label>
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    required
                    value={line.unitPriceForeign as any}
                    onChange={(e) => updateLine(idx, "unitPriceForeign", parseFloat(e.target.value) || 0)}
                    className="mt-1 w-full px-2.5 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 font-mono font-bold text-blue-600"
                  />
                </div>

                <div>
                  <label className="font-semibold text-slate-600 dark:text-slate-400">Tax Rate %</label>
                  <input
                    type="number"
                    step="0.001"
                    min="0"
                    value={Number(line.taxRate) * 100}
                    onChange={(e) => updateLine(idx, "taxRate", (parseFloat(e.target.value) || 0) / 100)}
                    className="mt-1 w-full px-2.5 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 font-mono"
                  />
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Financial Summary Card */}
      {totals && (
        <div className="p-6 rounded-2xl border-2 border-blue-500/20 bg-gradient-to-br from-slate-900 to-slate-950 text-white shadow-xl space-y-4">
          <div className="flex items-center justify-between border-b border-slate-800 pb-3">
            <h3 className="text-sm font-bold uppercase tracking-wider text-blue-400 flex items-center gap-2">
              <DollarSign className="w-4 h-4" /> Invoice Financial Calculation Summary
            </h3>
            <span className="text-xs text-slate-400 font-mono">Rate: 1 {currency} = {exchangeRate} AFN</span>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            <div>
              <p className="text-xs text-slate-400">Foreign Subtotal</p>
              <p className="text-lg font-bold text-white mt-1 font-mono">
                {currency} {totals.foreignSubTotal.toNumber().toLocaleString(undefined, { minimumFractionDigits: 2 })}
              </p>
            </div>

            <div>
              <p className="text-xs text-slate-400">Tax Amount</p>
              <p className="text-lg font-bold text-amber-400 mt-1 font-mono">
                {currency} {totals.taxAmount.toNumber().toLocaleString(undefined, { minimumFractionDigits: 2 })}
              </p>
            </div>

            <div>
              <p className="text-xs text-slate-400">Invoice Grand Total</p>
              <p className="text-2xl font-black text-blue-400 mt-1 font-mono">
                {currency} {totals.grandTotal.toNumber().toLocaleString(undefined, { minimumFractionDigits: 2 })}
              </p>
            </div>

            <div className="p-3 rounded-xl bg-blue-950/40 border border-blue-800/40">
              <p className="text-xs font-semibold text-blue-300 uppercase tracking-wider">General Ledger Base Value</p>
              <p className="text-2xl font-black text-emerald-400 mt-1 font-mono">
                {totals.baseGrandTotal.toNumber().toLocaleString(undefined, { minimumFractionDigits: 2 })}{" "}
                <span className="text-xs font-normal text-slate-300">AFN</span>
              </p>
            </div>
          </div>
        </div>
      )}

      <div className="flex justify-end gap-3 pt-4">
        <Link
          href="/invoices"
          className="px-6 py-2.5 text-sm font-medium rounded-lg border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300"
        >
          Cancel
        </Link>
        <button
          type="submit"
          disabled={isSubmitting}
          className="px-8 py-2.5 text-sm font-bold rounded-lg bg-blue-600 hover:bg-blue-700 text-white shadow-md transition-colors"
        >
          {isSubmitting ? "Generating..." : "Save Invoice Document"}
        </button>
      </div>
    </form>
  );
}
