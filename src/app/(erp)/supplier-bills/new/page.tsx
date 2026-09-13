"use client";

import React, { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Header } from "@/components/layout/Header";
import { createSupplierBill } from "@/app/actions/bills";
import { Plus, Trash2, ArrowLeft, Save, Send } from "lucide-react";
import Link from "next/link";
import { ServiceType, SupplierBillStatus } from "@prisma/client";

export default function NewSupplierBillPage() {
  const router = useRouter();
  const [suppliers, setSuppliers] = useState<any[]>([]);
  const [bookings, setBookings] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Form State
  const [supplierId, setSupplierId] = useState("");
  const [bookingId, setBookingId] = useState("");
  const [supplierInvoiceNumber, setSupplierInvoiceNumber] = useState("");
  const [issueDate, setIssueDate] = useState(new Date().toISOString().split("T")[0]);
  const [dueDate, setDueDate] = useState(
    new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().split("T")[0]
  );
  const [currency, setCurrency] = useState("USD");
  const [exchangeRate, setExchangeRate] = useState<number>(72.5);
  const [notes, setNotes] = useState("");

  const [lines, setLines] = useState<
    {
      serviceType: ServiceType;
      description: string;
      quantity: number;
      unitCostForeign: number;
      taxRate: number;
      isTaxRecoverable: boolean;
    }[]
  >([
    {
      serviceType: ServiceType.FLIGHT,
      description: "Flight Ticket - Ariana Afghan Airlines (KBL-DXB)",
      quantity: 1,
      unitCostForeign: 450,
      taxRate: 0,
      isTaxRecoverable: true,
    },
  ]);

  // Load suppliers and bookings
  useEffect(() => {
    fetch("/api/suppliers")
      .then((res) => (res.ok ? res.json() : []))
      .then((data) => setSuppliers(data))
      .catch(() => {});

    fetch("/api/bookings")
      .then((res) => (res.ok ? res.json() : []))
      .then((data) => setBookings(data))
      .catch(() => {});
  }, []);

  const addLine = () => {
    setLines([
      ...lines,
      {
        serviceType: ServiceType.HOTEL,
        description: "Hotel Reservation",
        quantity: 1,
        unitCostForeign: 100,
        taxRate: 0,
        isTaxRecoverable: true,
      },
    ]);
  };

  const removeLine = (index: number) => {
    if (lines.length === 1) return;
    setLines(lines.filter((_, idx) => idx !== index));
  };

  const updateLine = (index: number, field: string, val: any) => {
    const updated = [...lines];
    (updated[index] as any)[field] = val;
    setLines(updated);
  };

  const calculateSubtotal = () => {
    return lines.reduce((sum, l) => sum + (Number(l.quantity) || 0) * (Number(l.unitCostForeign) || 0), 0);
  };

  const calculateTax = () => {
    return lines.reduce((sum, l) => {
      const lineSub = (Number(l.quantity) || 0) * (Number(l.unitCostForeign) || 0);
      return sum + lineSub * ((Number(l.taxRate) || 0) / 100);
    }, 0);
  };

  const grandTotal = calculateSubtotal() + calculateTax();
  const baseGrandTotal = grandTotal * exchangeRate;

  const handleSubmit = async (targetStatus: SupplierBillStatus) => {
    setError(null);
    if (!supplierId) {
      setError("Please select a supplier");
      return;
    }
    if (lines.length === 0) {
      setError("Please add at least one line item");
      return;
    }

    setLoading(true);
    try {
      const res = await createSupplierBill({
        supplierId,
        bookingId: bookingId || undefined,
        supplierInvoiceNumber: supplierInvoiceNumber || undefined,
        currency,
        exchangeRate,
        issueDate,
        dueDate,
        notes,
        status: targetStatus,
        lines: lines.map((l) => ({
          serviceType: l.serviceType,
          description: l.description,
          quantity: Number(l.quantity),
          unitCostForeign: Number(l.unitCostForeign),
          taxRate: Number(l.taxRate),
          isTaxRecoverable: l.isTaxRecoverable,
        })),
      });

      if (res.success && res.data) {
        router.push(`/supplier-bills/${res.data.id}`);
      } else {
        setError(res.error || "Failed to create supplier bill");
      }
    } catch (err: any) {
      setError(err.message || "An unexpected error occurred");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div>
      <Header title="New Supplier Bill" userRole="ADMIN" />
      <div className="p-8 max-w-6xl mx-auto space-y-8">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Link
              href="/supplier-bills"
              className="p-2 rounded-lg border border-slate-300 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800"
            >
              <ArrowLeft className="w-4 h-4" />
            </Link>
            <div>
              <h2 className="text-xl font-bold text-slate-900 dark:text-white">Create Supplier Bill</h2>
              <p className="text-sm text-slate-500">Record vendor direct costs and AP liabilities</p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <button
              onClick={() => handleSubmit(SupplierBillStatus.DRAFT)}
              disabled={loading}
              className="inline-flex items-center gap-2 px-4 py-2 border border-slate-300 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg text-sm font-semibold transition-colors"
            >
              <Save className="w-4 h-4" /> Save Draft
            </button>
            <button
              onClick={() => handleSubmit(SupplierBillStatus.POSTED)}
              disabled={loading}
              className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-sm font-semibold shadow-sm shadow-blue-500/20 transition-colors"
            >
              <Send className="w-4 h-4" /> Save & Post (GL)
            </button>
          </div>
        </div>

        {error && (
          <div className="p-4 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 text-sm">
            {error}
          </div>
        )}

        {/* Bill Metadata */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 bg-white dark:bg-slate-900 p-6 rounded-xl border border-slate-200 dark:border-slate-800">
          <div>
            <label className="block text-xs font-semibold uppercase text-slate-500 mb-1">Supplier *</label>
            <select
              value={supplierId}
              onChange={(e) => setSupplierId(e.target.value)}
              className="w-full px-3 py-2 text-sm bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-700 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="">Select Supplier</option>
              {suppliers.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name} ({s.code})
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-xs font-semibold uppercase text-slate-500 mb-1">Related Booking (Optional)</label>
            <select
              value={bookingId}
              onChange={(e) => setBookingId(e.target.value)}
              className="w-full px-3 py-2 text-sm bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-700 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="">Select Booking (For Profitability Tracking)</option>
              {bookings.map((b) => (
                <option key={b.id} value={b.id}>
                  {b.bookingNumber} ({b.customer?.name})
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-xs font-semibold uppercase text-slate-500 mb-1">Supplier Invoice #</label>
            <input
              type="text"
              placeholder="e.g. INV-99824"
              value={supplierInvoiceNumber}
              onChange={(e) => setSupplierInvoiceNumber(e.target.value)}
              className="w-full px-3 py-2 text-sm bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-700 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold uppercase text-slate-500 mb-1">Issue Date</label>
            <input
              type="date"
              value={issueDate}
              onChange={(e) => setIssueDate(e.target.value)}
              className="w-full px-3 py-2 text-sm bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-700 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold uppercase text-slate-500 mb-1">Due Date</label>
            <input
              type="date"
              value={dueDate}
              onChange={(e) => setDueDate(e.target.value)}
              className="w-full px-3 py-2 text-sm bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-700 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold uppercase text-slate-500 mb-1">Currency</label>
              <select
                value={currency}
                onChange={(e) => {
                  setCurrency(e.target.value);
                  if (e.target.value === "AFN") setExchangeRate(1);
                }}
                className="w-full px-3 py-2 text-sm bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-700 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="USD">USD</option>
                <option value="AFN">AFN</option>
                <option value="EUR">EUR</option>
                <option value="AED">AED</option>
              </select>
            </div>
            <div>
              <label className="block text-xs font-semibold uppercase text-slate-500 mb-1">Exchange Rate (to AFN)</label>
              <input
                type="number"
                step="0.0001"
                value={exchangeRate}
                onChange={(e) => setExchangeRate(Number(e.target.value))}
                className="w-full px-3 py-2 text-sm bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-700 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
          </div>
        </div>

        {/* Line Items */}
        <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 p-6 space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-base font-bold text-slate-900 dark:text-white">Service Line Items & Direct Cost Accounts</h3>
            <button
              onClick={addLine}
              type="button"
              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold bg-blue-50 text-blue-600 dark:bg-blue-950/40 dark:text-blue-400 rounded-lg hover:bg-blue-100 transition-colors"
            >
              <Plus className="w-3.5 h-3.5" /> Add Service Line
            </button>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="bg-slate-50 dark:bg-slate-950/60 text-slate-600 dark:text-slate-400 text-xs font-semibold uppercase">
                <tr>
                  <th className="px-3 py-2">Service Type</th>
                  <th className="px-3 py-2">Description</th>
                  <th className="px-3 py-2 w-20">Qty</th>
                  <th className="px-3 py-2 w-28">Unit Cost</th>
                  <th className="px-3 py-2 w-24">Tax %</th>
                  <th className="px-3 py-2 w-28">Recoverable?</th>
                  <th className="px-3 py-2 text-right">Total ({currency})</th>
                  <th className="px-3 py-2 w-12 text-center"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200 dark:divide-slate-800">
                {lines.map((line, idx) => {
                  const lineTotal = (Number(line.quantity) || 0) * (Number(line.unitCostForeign) || 0);
                  const lineTax = lineTotal * ((Number(line.taxRate) || 0) / 100);
                  return (
                    <tr key={idx}>
                      <td className="px-3 py-3">
                        <select
                          value={line.serviceType}
                          onChange={(e) => updateLine(idx, "serviceType", e.target.value)}
                          className="w-full px-2 py-1.5 text-xs bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-700 rounded-lg"
                        >
                          <option value="FLIGHT">Flight (5010)</option>
                          <option value="HOTEL">Hotel (5020)</option>
                          <option value="VISA">Visa (5030)</option>
                          <option value="TRANSFER">Transfer (5040)</option>
                          <option value="TOUR">Tour (5050)</option>
                          <option value="OTHER">Other (5090)</option>
                        </select>
                      </td>
                      <td className="px-3 py-3">
                        <input
                          type="text"
                          value={line.description}
                          onChange={(e) => updateLine(idx, "description", e.target.value)}
                          className="w-full px-2 py-1.5 text-xs bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-700 rounded-lg"
                        />
                      </td>
                      <td className="px-3 py-3">
                        <input
                          type="number"
                          min="1"
                          value={line.quantity}
                          onChange={(e) => updateLine(idx, "quantity", Number(e.target.value))}
                          className="w-full px-2 py-1.5 text-xs bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-700 rounded-lg text-right"
                        />
                      </td>
                      <td className="px-3 py-3">
                        <input
                          type="number"
                          step="0.01"
                          value={line.unitCostForeign}
                          onChange={(e) => updateLine(idx, "unitCostForeign", Number(e.target.value))}
                          className="w-full px-2 py-1.5 text-xs bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-700 rounded-lg text-right"
                        />
                      </td>
                      <td className="px-3 py-3">
                        <input
                          type="number"
                          step="0.01"
                          value={line.taxRate}
                          onChange={(e) => updateLine(idx, "taxRate", Number(e.target.value))}
                          className="w-full px-2 py-1.5 text-xs bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-700 rounded-lg text-right"
                        />
                      </td>
                      <td className="px-3 py-3 text-center">
                        <input
                          type="checkbox"
                          checked={line.isTaxRecoverable}
                          onChange={(e) => updateLine(idx, "isTaxRecoverable", e.target.checked)}
                          className="w-4 h-4 rounded text-blue-600 focus:ring-blue-500"
                        />
                      </td>
                      <td className="px-3 py-3 text-right font-mono font-medium">
                        {(lineTotal + lineTax).toFixed(2)}
                      </td>
                      <td className="px-3 py-3 text-center">
                        <button
                          type="button"
                          onClick={() => removeLine(idx)}
                          className="text-slate-400 hover:text-rose-500"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {/* Totals Summary */}
          <div className="flex justify-end pt-4 border-t border-slate-200 dark:border-slate-800">
            <div className="w-72 space-y-2 text-sm">
              <div className="flex justify-between text-slate-600 dark:text-slate-400">
                <span>Subtotal ({currency})</span>
                <span className="font-mono">{calculateSubtotal().toFixed(2)}</span>
              </div>
              <div className="flex justify-between text-slate-600 dark:text-slate-400">
                <span>Tax ({currency})</span>
                <span className="font-mono">{calculateTax().toFixed(2)}</span>
              </div>
              <div className="flex justify-between text-base font-bold text-slate-900 dark:text-white pt-2 border-t border-slate-200 dark:border-slate-800">
                <span>Grand Total ({currency})</span>
                <span className="font-mono">{grandTotal.toFixed(2)}</span>
              </div>
              {currency !== "AFN" && (
                <div className="flex justify-between text-xs text-blue-600 dark:text-blue-400 font-semibold pt-1">
                  <span>Base Total (AFN @ {exchangeRate})</span>
                  <span className="font-mono">AFN {baseGrandTotal.toFixed(2)}</span>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
