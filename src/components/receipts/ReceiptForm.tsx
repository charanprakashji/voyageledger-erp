"use client";

import React, { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import {
  ArrowLeft,
  Save,
  DollarSign,
  AlertCircle,
  Receipt,
  Layers,
  CreditCard,
} from "lucide-react";
import { PaymentMethod, ReceiptStatus } from "@prisma/client";
import { createReceipt } from "@/app/actions/receipts";
import Decimal from "decimal.js";

interface ReceiptFormProps {
  customers: Array<{ id: string; name: string; code: string; companyName?: string | null }>;
  invoices: Array<{
    id: string;
    invoiceNumber: string;
    customerId: string;
    currency: string;
    exchangeRate: number;
    grandTotal: number;
    paidAmount: number;
    balanceDue: number;
    status: string;
  }>;
  bankAccounts: Array<{ id: string; code: string; name: string; currency: string }>;
  defaultCurrencies?: string[];
}

export function ReceiptForm({
  customers,
  invoices,
  bankAccounts,
  defaultCurrencies = ["AFN", "USD", "EUR", "AED", "GBP"],
}: ReceiptFormProps) {
  const router = useRouter();

  const [customerId, setCustomerId] = useState(customers[0]?.id || "");
  const [bankAccountId, setBankAccountId] = useState(bankAccounts[0]?.id || "");
  const [currency, setCurrency] = useState("USD");
  const [exchangeRate, setExchangeRate] = useState<number>(70.5);
  const [amount, setAmount] = useState<number>(500);
  const [paymentDate, setPaymentDate] = useState(new Date().toISOString().split("T")[0]);
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>(PaymentMethod.CASH);
  const [bankReference, setBankReference] = useState("");
  const [notes, setNotes] = useState("");
  const [status, setStatus] = useState<ReceiptStatus>(ReceiptStatus.APPROVED);

  // Invoices available for this customer
  const customerInvoices = invoices.filter(
    (inv) => inv.customerId === customerId && inv.balanceDue > 0 && inv.status !== "CANCELLED" && inv.status !== "DRAFT"
  );

  const [allocations, setAllocations] = useState<Record<string, number>>({});
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const handleCurrencyChange = (newCurr: string) => {
    setCurrency(newCurr);
    if (newCurr === "USD") setExchangeRate(70.5);
    else if (newCurr === "EUR") setExchangeRate(77.2);
    else if (newCurr === "AED") setExchangeRate(19.2);
    else if (newCurr === "GBP") setExchangeRate(91.5);
    else if (newCurr === "AFN") setExchangeRate(1.0);
  };

  const handleAllocationChange = (invoiceId: string, value: number) => {
    setAllocations((prev) => ({
      ...prev,
      [invoiceId]: Math.max(0, value || 0),
    }));
  };

  const autoAllocate = () => {
    let remaining = amount;
    const newAlloc: Record<string, number> = {};
    for (const inv of customerInvoices) {
      if (remaining <= 0) break;
      const allocAmount = Math.min(remaining, inv.balanceDue);
      newAlloc[inv.id] = allocAmount;
      remaining -= allocAmount;
    }
    setAllocations(newAlloc);
  };

  const totalAllocated = Object.values(allocations).reduce((acc, v) => acc + v, 0);
  const unallocatedAdvance = Math.max(0, amount - totalAllocated);
  const baseAmountAFN = amount * exchangeRate;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    setErrorMessage(null);

    if (!customerId) {
      setErrorMessage("Please select a customer");
      setIsSubmitting(false);
      return;
    }

    if (amount <= 0) {
      setErrorMessage("Receipt amount must be strictly greater than 0");
      setIsSubmitting(false);
      return;
    }

    if (totalAllocated > amount) {
      setErrorMessage(`Total invoice allocations (${totalAllocated}) exceed the received amount (${amount})`);
      setIsSubmitting(false);
      return;
    }

    const allocationPayload = Object.entries(allocations)
      .filter(([_, val]) => val > 0)
      .map(([invId, val]) => ({
        invoiceId: invId,
        amountForeign: val,
      }));

    try {
      const res = await createReceipt({
        customerId,
        currency,
        exchangeRate,
        amount,
        paymentDate,
        paymentMethod,
        bankAccountId,
        bankReference,
        notes,
        status,
        allocations: allocationPayload,
      });

      if (res.success) {
        router.push(`/receipts/${res.data?.id}`);
        router.refresh();
      } else {
        setErrorMessage(res.error || "Failed to create receipt");
      }
    } catch (err: any) {
      setErrorMessage(err.message || "An error occurred");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-8 max-w-7xl mx-auto pb-16">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-200 dark:border-slate-800 pb-5">
        <div className="flex items-center gap-3">
          <Link
            href="/receipts"
            className="p-1.5 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg transition-colors"
          >
            <ArrowLeft className="w-5 h-5" />
          </Link>
          <div>
            <h1 className="text-2xl font-bold text-slate-900 dark:text-white">
              Customer Payment Receipt
            </h1>
            <p className="text-xs text-slate-500 mt-0.5">
              Invoice Settlements, Customer Advances & FX Gain/Loss Reconciliation
            </p>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <Link
            href="/receipts"
            className="px-4 py-2 text-sm font-medium rounded-lg border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300"
          >
            Cancel
          </Link>
          <button
            type="submit"
            disabled={isSubmitting}
            className="inline-flex items-center gap-2 px-6 py-2 text-sm font-bold rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white shadow-sm transition-colors"
          >
            <Save className="w-4 h-4" />
            {isSubmitting ? "Processing..." : "Save Receipt"}
          </button>
        </div>
      </div>

      {errorMessage && (
        <div className="p-4 bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-900 text-rose-700 dark:text-rose-300 text-sm rounded-xl flex items-center gap-3">
          <AlertCircle className="w-5 h-5 shrink-0" />
          <span>{errorMessage}</span>
        </div>
      )}

      {/* Payment Details */}
      <div className="p-6 rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-sm space-y-6">
        <h2 className="text-base font-bold text-slate-900 dark:text-white flex items-center gap-2">
          <Layers className="w-5 h-5 text-emerald-600" />
          Receipt & Deposit Header
        </h2>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
          <div>
            <label className="block text-xs font-semibold uppercase tracking-wider mb-1.5 text-slate-700 dark:text-slate-300">
              Customer *
            </label>
            <select
              value={customerId}
              onChange={(e) => {
                setCustomerId(e.target.value);
                setAllocations({});
              }}
              required
              className="w-full px-3.5 py-2 text-sm rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white font-medium"
            >
              {customers.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.code} - {c.name}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-xs font-semibold uppercase tracking-wider mb-1.5 text-slate-700 dark:text-slate-300">
              Deposited To (Bank Vault / Cash) *
            </label>
            <select
              value={bankAccountId}
              onChange={(e) => setBankAccountId(e.target.value)}
              required
              className="w-full px-3.5 py-2 text-sm rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white font-medium"
            >
              {bankAccounts.map((acc) => (
                <option key={acc.id} value={acc.id}>
                  {acc.code} - {acc.name} ({acc.currency})
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-xs font-semibold uppercase tracking-wider mb-1.5 text-slate-700 dark:text-slate-300">
              Payment Method
            </label>
            <select
              value={paymentMethod}
              onChange={(e) => setPaymentMethod(e.target.value as PaymentMethod)}
              className="w-full px-3.5 py-2 text-sm rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white font-medium"
            >
              <option value="CASH">CASH</option>
              <option value="BANK_TRANSFER">BANK TRANSFER</option>
              <option value="HAWALA_TRANSFER">HAWALA TRANSFER (SARAF)</option>
              <option value="CREDIT_CARD">CREDIT CARD</option>
              <option value="CHEQUE">CHEQUE</option>
              <option value="EXCHANGE_OFFICE">EXCHANGE OFFICE</option>
            </select>
          </div>

          <div>
            <label className="block text-xs font-semibold uppercase tracking-wider mb-1.5 text-slate-700 dark:text-slate-300">
              Payment Currency
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
              Amount Received ({currency}) *
            </label>
            <input
              type="number"
              step="0.01"
              required
              min="0.01"
              value={amount}
              onChange={(e) => setAmount(parseFloat(e.target.value) || 0)}
              className="w-full px-3.5 py-2 text-sm rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white font-mono font-bold text-emerald-600"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold uppercase tracking-wider mb-1.5 text-slate-700 dark:text-slate-300">
              Payment Date *
            </label>
            <input
              type="date"
              required
              value={paymentDate}
              onChange={(e) => setPaymentDate(e.target.value)}
              className="w-full px-3.5 py-2 text-sm rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold uppercase tracking-wider mb-1.5 text-slate-700 dark:text-slate-300">
              Transaction / Reference #
            </label>
            <input
              type="text"
              placeholder="e.g. Saraf receipt #, Cheque #, Wire ref"
              value={bankReference}
              onChange={(e) => setBankReference(e.target.value)}
              className="w-full px-3.5 py-2 text-sm rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white font-mono"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold uppercase tracking-wider mb-1.5 text-slate-700 dark:text-slate-300">
              Initial Status
            </label>
            <select
              value={status}
              onChange={(e) => setStatus(e.target.value as ReceiptStatus)}
              className="w-full px-3.5 py-2 text-sm rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white font-bold"
            >
              <option value="APPROVED">APPROVED (Ready to Post)</option>
              <option value="POSTED">POSTED (Immediate GL Entry)</option>
              <option value="DRAFT">DRAFT</option>
            </select>
          </div>
        </div>
      </div>

      {/* Invoice Allocation Grid */}
      <div className="p-6 rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-sm space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-base font-bold text-slate-900 dark:text-white flex items-center gap-2">
              <CreditCard className="w-5 h-5 text-indigo-600" />
              Invoice Allocation ({customerInvoices.length} Unpaid Invoices Available)
            </h2>
            <p className="text-xs text-slate-500 mt-0.5">
              Allocate receipt amounts against specific customer invoices. Any unallocated amount will be automatically recorded as a <strong>Customer Advance</strong> liability.
            </p>
          </div>

          {customerInvoices.length > 0 && (
            <button
              type="button"
              onClick={autoAllocate}
              className="px-3 py-1.5 text-xs font-bold rounded-lg bg-indigo-50 dark:bg-indigo-950/40 text-indigo-700 dark:text-indigo-300 hover:bg-indigo-100"
            >
              Auto-Allocate FIFO
            </button>
          )}
        </div>

        {customerInvoices.length === 0 ? (
          <div className="p-4 rounded-xl bg-blue-50 dark:bg-blue-950/30 border border-blue-200 dark:border-blue-900 text-xs text-blue-800 dark:text-blue-300">
            No unpaid invoices found for this customer. Entire received amount will be credited to <strong>2020 Customer Advances</strong>.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs text-slate-600 dark:text-slate-300">
              <thead className="bg-slate-50 dark:bg-slate-800 text-slate-400 font-semibold border-b border-slate-200 dark:border-slate-800 uppercase">
                <tr>
                  <th className="px-4 py-3">Invoice #</th>
                  <th className="px-4 py-3">Invoice Currency</th>
                  <th className="px-4 py-3 text-right">Grand Total</th>
                  <th className="px-4 py-3 text-right">Balance Due</th>
                  <th className="px-4 py-3 text-right">Allocate Amount ({currency})</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800 font-medium">
                {customerInvoices.map((inv) => (
                  <tr key={inv.id} className="hover:bg-slate-50/60 dark:hover:bg-slate-800/30">
                    <td className="px-4 py-3 font-mono font-bold text-slate-900 dark:text-white">
                      {inv.invoiceNumber}
                    </td>
                    <td className="px-4 py-3 font-mono">
                      {inv.currency} @ {inv.exchangeRate}
                    </td>
                    <td className="px-4 py-3 text-right font-mono">
                      {inv.currency} {inv.grandTotal.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                    </td>
                    <td className="px-4 py-3 text-right font-mono font-bold text-rose-600">
                      {inv.currency} {inv.balanceDue.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                    </td>
                    <td className="px-4 py-3 text-right">
                      <input
                        type="number"
                        step="0.01"
                        min="0"
                        max={inv.balanceDue}
                        value={allocations[inv.id] || 0}
                        onChange={(e) => handleAllocationChange(inv.id, parseFloat(e.target.value) || 0)}
                        className="w-32 px-2.5 py-1 text-right rounded border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 font-mono font-bold text-blue-600"
                      />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Allocation Summary Card */}
      <div className="p-6 rounded-2xl border-2 border-emerald-500/20 bg-gradient-to-br from-slate-900 to-slate-950 text-white shadow-xl space-y-4">
        <h3 className="text-sm font-bold uppercase tracking-wider text-emerald-400 flex items-center gap-2">
          <DollarSign className="w-4 h-4" /> Receipt Settlement & Advance Summary
        </h3>

        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          <div>
            <p className="text-xs text-slate-400">Total Received</p>
            <p className="text-xl font-bold text-white mt-1 font-mono">
              {currency} {amount.toLocaleString(undefined, { minimumFractionDigits: 2 })}
            </p>
            <span className="text-[10px] text-slate-400 font-mono">({baseAmountAFN.toLocaleString(undefined, { minimumFractionDigits: 2 })} AFN)</span>
          </div>

          <div>
            <p className="text-xs text-slate-400">Allocated to Invoices</p>
            <p className="text-xl font-bold text-emerald-400 mt-1 font-mono">
              {currency} {totalAllocated.toLocaleString(undefined, { minimumFractionDigits: 2 })}
            </p>
            <span className="text-[10px] text-slate-400">Clears AR Receivable</span>
          </div>

          <div>
            <p className="text-xs text-slate-400">Retained Customer Advance</p>
            <p className="text-2xl font-black text-blue-400 mt-1 font-mono">
              {currency} {unallocatedAdvance.toLocaleString(undefined, { minimumFractionDigits: 2 })}
            </p>
            <span className="text-[10px] text-slate-400">Credits 2020 Customer Advances</span>
          </div>

          <div className="p-3 rounded-xl bg-emerald-950/40 border border-emerald-800/40">
            <p className="text-xs font-semibold text-emerald-300 uppercase tracking-wider">Debit Bank Deposit</p>
            <p className="text-xl font-black text-emerald-300 mt-1 font-mono">
              {baseAmountAFN.toLocaleString(undefined, { minimumFractionDigits: 2 })}{" "}
              <span className="text-xs font-normal text-slate-300">AFN</span>
            </p>
          </div>
        </div>
      </div>

      <div className="flex justify-end gap-3 pt-4">
        <Link
          href="/receipts"
          className="px-6 py-2.5 text-sm font-medium rounded-lg border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300"
        >
          Cancel
        </Link>
        <button
          type="submit"
          disabled={isSubmitting}
          className="px-8 py-2.5 text-sm font-bold rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white shadow-md transition-colors"
        >
          {isSubmitting ? "Processing..." : "Save Customer Receipt"}
        </button>
      </div>
    </form>
  );
}
