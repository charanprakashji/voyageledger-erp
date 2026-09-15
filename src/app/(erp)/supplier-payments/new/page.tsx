"use client";

import React, { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { createSupplierPayment } from "@/app/actions/bills";
import { ArrowLeft, Save, Send } from "lucide-react";
import Link from "next/link";
import { SupplierPaymentStatus } from "@prisma/client";

export default function NewSupplierPaymentPage() {
  const router = useRouter();
  const [suppliers, setSuppliers] = useState<any[]>([]);
  const [bankAccounts, setBankAccounts] = useState<any[]>([]);
  const [unpaidBills, setUnpaidBills] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [supplierId, setSupplierId] = useState("");
  const [paymentDate, setPaymentDate] = useState(new Date().toISOString().split("T")[0]);
  const [paymentMethod, setPaymentMethod] = useState("BANK_TRANSFER");
  const [bankAccountId, setBankAccountId] = useState("");
  const [currency, setCurrency] = useState("USD");
  const [exchangeRate, setExchangeRate] = useState<number>(72.5);
  const [amountForeign, setAmountForeign] = useState<number>(0);
  const [referenceNumber, setReferenceNumber] = useState("");
  const [isAdvance, setIsAdvance] = useState(false);
  const [notes, setNotes] = useState("");

  const [selectedBillId, setSelectedBillId] = useState<string>("");

  useEffect(() => {
    fetch("/api/suppliers")
      .then((res) => (res.ok ? res.json() : []))
      .then((data) => setSuppliers(data))
      .catch(() => {});

    fetch("/api/chart-of-accounts")
      .then((res) => (res.ok ? res.json() : []))
      .then((accounts: any[]) => {
        const banks = accounts.filter(
          (a) => a.code.startsWith("1010") || a.code.startsWith("1020") || a.type === "ASSET"
        );
        setBankAccounts(banks);
        if (banks.length > 0) setBankAccountId(banks[0].id);
      })
      .catch(() => {});
  }, []);

  const handleSubmit = async (targetStatus: SupplierPaymentStatus) => {
    setError(null);
    if (!supplierId) {
      setError("Please select a supplier");
      return;
    }
    if (!bankAccountId) {
      setError("Please select a bank/cash account");
      return;
    }
    if (amountForeign <= 0) {
      setError("Please enter a valid payment amount");
      return;
    }

    setLoading(true);
    try {
      const allocations =
        !isAdvance && selectedBillId
          ? [
              {
                supplierBillId: selectedBillId,
                amountForeign: amountForeign,
              },
            ]
          : undefined;

      const res = await createSupplierPayment({
        supplierId,
        paymentDate,
        paymentMethod,
        bankAccountId,
        currency,
        exchangeRate,
        amountForeign,
        referenceNumber,
        isAdvance,
        notes,
        status: targetStatus,
        allocations,
      });

      if (res.success) {
        router.push("/supplier-payments");
      } else {
        setError(res.error || "Failed to record supplier payment");
      }
    } catch (err: any) {
      setError(err.message || "An unexpected error occurred");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="max-w-4xl mx-auto space-y-8">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
            <Link
              href="/supplier-payments"
              className="p-2 rounded-lg border border-slate-300 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800"
            >
              <ArrowLeft className="w-4 h-4" />
            </Link>
            <div>
              <h2 className="text-xl font-bold text-slate-900 dark:text-white">Record Outgoing Payment</h2>
              <p className="text-sm text-slate-500">Pay an AP bill or record a pre-bill supplier advance</p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <button
              onClick={() => handleSubmit(SupplierPaymentStatus.DRAFT)}
              disabled={loading}
              className="inline-flex items-center gap-2 px-4 py-2 border border-slate-300 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg text-sm font-semibold transition-colors"
            >
              <Save className="w-4 h-4" /> Save Draft
            </button>
            <button
              onClick={() => handleSubmit(SupplierPaymentStatus.POSTED)}
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

        <div className="bg-white dark:bg-slate-900 p-6 rounded-xl border border-slate-200 dark:border-slate-800 space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <label className="block text-xs font-semibold uppercase text-slate-500 mb-1">Supplier *</label>
              <select
                value={supplierId}
                onChange={(e) => setSupplierId(e.target.value)}
                className="w-full px-3 py-2 text-sm bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-700 rounded-lg"
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
              <label className="block text-xs font-semibold uppercase text-slate-500 mb-1">Payment Type</label>
              <div className="flex items-center gap-6 mt-2">
                <label className="inline-flex items-center gap-2 text-sm cursor-pointer">
                  <input
                    type="radio"
                    name="isAdvance"
                    checked={!isAdvance}
                    onChange={() => setIsAdvance(false)}
                    className="text-blue-600 focus:ring-blue-500"
                  />
                  <span>Bill Payment (Settles AP)</span>
                </label>
                <label className="inline-flex items-center gap-2 text-sm cursor-pointer">
                  <input
                    type="radio"
                    name="isAdvance"
                    checked={isAdvance}
                    onChange={() => setIsAdvance(true)}
                    className="text-blue-600 focus:ring-blue-500"
                  />
                  <span>Supplier Advance (Asset 1120)</span>
                </label>
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold uppercase text-slate-500 mb-1">Payment Date</label>
              <input
                type="date"
                value={paymentDate}
                onChange={(e) => setPaymentDate(e.target.value)}
                className="w-full px-3 py-2 text-sm bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-700 rounded-lg"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold uppercase text-slate-500 mb-1">Payment Method</label>
              <select
                value={paymentMethod}
                onChange={(e) => setPaymentMethod(e.target.value)}
                className="w-full px-3 py-2 text-sm bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-700 rounded-lg"
              >
                <option value="BANK_TRANSFER">Bank Wire / Transfer</option>
                <option value="HAWALA">Hawala (Traditional Exchange)</option>
                <option value="CASH">Cash on Hand</option>
                <option value="CREDIT_CARD">Credit Card</option>
              </select>
            </div>

            <div>
              <label className="block text-xs font-semibold uppercase text-slate-500 mb-1">Bank / Cash Account *</label>
              <select
                value={bankAccountId}
                onChange={(e) => setBankAccountId(e.target.value)}
                className="w-full px-3 py-2 text-sm bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-700 rounded-lg"
              >
                {bankAccounts.map((b) => (
                  <option key={b.id} value={b.id}>
                    {b.code} - {b.name}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-xs font-semibold uppercase text-slate-500 mb-1">Reference / Cheque #</label>
              <input
                type="text"
                placeholder="e.g. TXN-884912"
                value={referenceNumber}
                onChange={(e) => setReferenceNumber(e.target.value)}
                className="w-full px-3 py-2 text-sm bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-700 rounded-lg"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold uppercase text-slate-500 mb-1">Currency & Exchange Rate</label>
              <div className="grid grid-cols-2 gap-2">
                <select
                  value={currency}
                  onChange={(e) => {
                    setCurrency(e.target.value);
                    if (e.target.value === "AFN") setExchangeRate(1);
                  }}
                  className="w-full px-3 py-2 text-sm bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-700 rounded-lg"
                >
                  <option value="USD">USD</option>
                  <option value="AFN">AFN</option>
                  <option value="EUR">EUR</option>
                  <option value="AED">AED</option>
                </select>
                <input
                  type="number"
                  step="0.0001"
                  value={exchangeRate}
                  onChange={(e) => setExchangeRate(Number(e.target.value))}
                  placeholder="Rate to AFN"
                  className="w-full px-3 py-2 text-sm bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-700 rounded-lg"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold uppercase text-slate-500 mb-1">Payment Amount ({currency}) *</label>
              <input
                type="number"
                step="0.01"
                value={amountForeign}
                onChange={(e) => setAmountForeign(Number(e.target.value))}
                className="w-full px-3 py-2 text-sm bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-700 rounded-lg font-mono font-bold text-blue-600"
              />
              {currency !== "AFN" && (
                <p className="text-xs text-slate-400 mt-1">
                  Base Equivalent: AFN {(amountForeign * exchangeRate).toFixed(2)}
                </p>
              )}
            </div>
          </div>
        </div>
      </div>
  );
}
