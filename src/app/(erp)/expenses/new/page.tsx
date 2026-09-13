"use client";

import React, { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Header } from "@/components/layout/Header";
import { createExpense } from "@/app/actions/expenses";
import { Plus, Trash2, ArrowLeft, Save, Send } from "lucide-react";
import Link from "next/link";
import { ExpenseStatus } from "@prisma/client";

export default function NewExpensePage() {
  const router = useRouter();
  const [bankAccounts, setBankAccounts] = useState<any[]>([]);
  const [expenseAccounts, setExpenseAccounts] = useState<any[]>([]);
  const [suppliers, setSuppliers] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [expenseDate, setExpenseDate] = useState(new Date().toISOString().split("T")[0]);
  const [paymentMethod, setPaymentMethod] = useState("CASH");
  const [bankAccountId, setBankAccountId] = useState("");
  const [supplierId, setSupplierId] = useState("");
  const [currency, setCurrency] = useState("AFN");
  const [exchangeRate, setExchangeRate] = useState<number>(1);
  const [referenceNumber, setReferenceNumber] = useState("");
  const [notes, setNotes] = useState("");

  const [lines, setLines] = useState<
    {
      expenseAccountId: string;
      description: string;
      amountForeign: number;
      taxRate: number;
    }[]
  >([
    {
      expenseAccountId: "",
      description: "Office Utilities & Internet",
      amountForeign: 4500,
      taxRate: 0,
    },
  ]);

  useEffect(() => {
    fetch("/api/suppliers")
      .then((res) => (res.ok ? res.json() : []))
      .then((data) => setSuppliers(data))
      .catch(() => {});

    fetch("/api/chart-of-accounts")
      .then((res) => (res.ok ? res.json() : []))
      .then((accounts: any[]) => {
        const banks = accounts.filter((a) => a.code.startsWith("1010") || a.code.startsWith("1020"));
        setBankAccounts(banks);
        if (banks.length > 0) setBankAccountId(banks[0].id);

        const exp = accounts.filter((a) => a.code.startsWith("6"));
        setExpenseAccounts(exp);
        if (exp.length > 0) {
          setLines([
            {
              expenseAccountId: exp[0].id,
              description: "Office Utilities & Internet",
              amountForeign: 4500,
              taxRate: 0,
            },
          ]);
        }
      })
      .catch(() => {});
  }, []);

  const addLine = () => {
    setLines([
      ...lines,
      {
        expenseAccountId: expenseAccounts[0]?.id || "",
        description: "Miscellaneous Expense",
        amountForeign: 1000,
        taxRate: 0,
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

  const totalAmount = lines.reduce((sum, l) => sum + (Number(l.amountForeign) || 0), 0);
  const totalBase = totalAmount * exchangeRate;

  const handleSubmit = async (targetStatus: ExpenseStatus) => {
    setError(null);
    if (!bankAccountId) {
      setError("Please select a bank or cash account");
      return;
    }
    if (lines.some((l) => !l.expenseAccountId)) {
      setError("Please select an expense account for all lines");
      return;
    }

    setLoading(true);
    try {
      const res = await createExpense({
        expenseDate,
        paymentMethod,
        bankAccountId,
        supplierId: supplierId || undefined,
        currency,
        exchangeRate,
        referenceNumber,
        notes,
        status: targetStatus,
        lines: lines.map((l) => ({
          expenseAccountId: l.expenseAccountId,
          description: l.description,
          amountForeign: Number(l.amountForeign),
          taxRate: Number(l.taxRate),
        })),
      });

      if (res.success) {
        router.push("/expenses");
      } else {
        setError(res.error || "Failed to record expense");
      }
    } catch (err: any) {
      setError(err.message || "An unexpected error occurred");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div>
      <Header title="Record Operating Expense" userRole="ADMIN" />
      <div className="p-8 max-w-5xl mx-auto space-y-8">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Link
              href="/expenses"
              className="p-2 rounded-lg border border-slate-300 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800"
            >
              <ArrowLeft className="w-4 h-4" />
            </Link>
            <div>
              <h2 className="text-xl font-bold text-slate-900 dark:text-white">Record Operating Expense</h2>
              <p className="text-sm text-slate-500">Post direct overhead and administrative costs to General Ledger</p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <button
              onClick={() => handleSubmit(ExpenseStatus.DRAFT)}
              disabled={loading}
              className="inline-flex items-center gap-2 px-4 py-2 border border-slate-300 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg text-sm font-semibold transition-colors"
            >
              <Save className="w-4 h-4" /> Save Draft
            </button>
            <button
              onClick={() => handleSubmit(ExpenseStatus.POSTED)}
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
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div>
              <label className="block text-xs font-semibold uppercase text-slate-500 mb-1">Expense Date</label>
              <input
                type="date"
                value={expenseDate}
                onChange={(e) => setExpenseDate(e.target.value)}
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
                <option value="CASH">Cash on Hand</option>
                <option value="BANK_TRANSFER">Bank Wire / Transfer</option>
                <option value="HAWALA">Hawala</option>
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
              <label className="block text-xs font-semibold uppercase text-slate-500 mb-1">Payee / Vendor (Optional)</label>
              <select
                value={supplierId}
                onChange={(e) => setSupplierId(e.target.value)}
                className="w-full px-3 py-2 text-sm bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-700 rounded-lg"
              >
                <option value="">Direct / One-Off Payee</option>
                {suppliers.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name} ({s.code})
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-xs font-semibold uppercase text-slate-500 mb-1">Reference / Receipt #</label>
              <input
                type="text"
                placeholder="e.g. BILL-441"
                value={referenceNumber}
                onChange={(e) => setReferenceNumber(e.target.value)}
                className="w-full px-3 py-2 text-sm bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-700 rounded-lg"
              />
            </div>

            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="block text-xs font-semibold uppercase text-slate-500 mb-1">Currency</label>
                <select
                  value={currency}
                  onChange={(e) => {
                    setCurrency(e.target.value);
                    if (e.target.value === "AFN") setExchangeRate(1);
                  }}
                  className="w-full px-3 py-2 text-sm bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-700 rounded-lg"
                >
                  <option value="AFN">AFN</option>
                  <option value="USD">USD</option>
                  <option value="EUR">EUR</option>
                </select>
              </div>
              <div>
                <label className="block text-xs font-semibold uppercase text-slate-500 mb-1">FX Rate</label>
                <input
                  type="number"
                  step="0.0001"
                  value={exchangeRate}
                  onChange={(e) => setExchangeRate(Number(e.target.value))}
                  className="w-full px-3 py-2 text-sm bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-700 rounded-lg"
                />
              </div>
            </div>
          </div>
        </div>

        {/* Expense Line Items */}
        <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 p-6 space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-base font-bold text-slate-900 dark:text-white">Expense Distribution</h3>
            <button
              onClick={addLine}
              type="button"
              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold bg-blue-50 text-blue-600 dark:bg-blue-950/40 dark:text-blue-400 rounded-lg hover:bg-blue-100 transition-colors"
            >
              <Plus className="w-3.5 h-3.5" /> Add Expense Line
            </button>
          </div>

          <table className="w-full text-left text-sm">
            <thead className="bg-slate-50 dark:bg-slate-950/60 text-slate-600 dark:text-slate-400 text-xs font-semibold uppercase">
              <tr>
                <th className="px-3 py-2">Expense Account (GL 6xxx)</th>
                <th className="px-3 py-2">Description</th>
                <th className="px-3 py-2 text-right w-36">Amount ({currency})</th>
                <th className="px-3 py-2 w-12 text-center"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200 dark:divide-slate-800">
              {lines.map((line, idx) => (
                <tr key={idx}>
                  <td className="px-3 py-3 w-72">
                    <select
                      value={line.expenseAccountId}
                      onChange={(e) => updateLine(idx, "expenseAccountId", e.target.value)}
                      className="w-full px-2 py-1.5 text-xs bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-700 rounded-lg"
                    >
                      {expenseAccounts.map((acc) => (
                        <option key={acc.id} value={acc.id}>
                          {acc.code} - {acc.name}
                        </option>
                      ))}
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
                      step="0.01"
                      value={line.amountForeign}
                      onChange={(e) => updateLine(idx, "amountForeign", Number(e.target.value))}
                      className="w-full px-2 py-1.5 text-xs bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-700 rounded-lg text-right font-mono"
                    />
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
              ))}
            </tbody>
          </table>

          <div className="flex justify-end pt-4 border-t border-slate-200 dark:border-slate-800">
            <div className="w-72 space-y-2 text-sm">
              <div className="flex justify-between text-base font-bold text-slate-900 dark:text-white">
                <span>Total Expense ({currency})</span>
                <span className="font-mono">{totalAmount.toFixed(2)}</span>
              </div>
              {currency !== "AFN" && (
                <div className="flex justify-between text-xs text-blue-600 dark:text-blue-400 font-semibold pt-1">
                  <span>Base Total (AFN)</span>
                  <span className="font-mono">AFN {totalBase.toFixed(2)}</span>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
