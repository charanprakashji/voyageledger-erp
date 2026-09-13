"use client";

import React, { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { createSupplier } from "@/app/actions/suppliers";
import { ArrowLeft, Loader2, Building2, AlertCircle, Save } from "lucide-react";

export default function NewSupplierPage() {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    setIsSubmitting(true);

    try {
      const formData = new FormData(e.currentTarget);
      const result = await createSupplier(formData);

      if (result.success) {
        router.push(`/suppliers/${result.supplier!.id}`);
        router.refresh();
      } else {
        const errorMsg = result.error || "Failed to create supplier.";
        setError(errorMsg);
        if (errorMsg.includes("UNAUTHORIZED")) {
          router.push("/login?redirect=/suppliers/new");
        }
      }
    } catch (err: any) {
      const msg = err?.message || "An unexpected error occurred while saving the supplier.";
      setError(msg);
      if (msg.includes("UNAUTHORIZED")) {
        router.push("/login?redirect=/suppliers/new");
      }
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <div className="flex items-center gap-4">
        <Link
          href="/suppliers"
          className="p-2 rounded-xl border border-slate-200 dark:border-slate-800 hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-500 transition-colors"
        >
          <ArrowLeft className="w-4 h-4" />
        </Link>
        <div>
          <h1 className="text-xl font-bold text-slate-900 dark:text-white tracking-tight">
            Register New Supplier / Partner
          </h1>
          <p className="text-xs text-slate-500">
            Airlines, DMCs, consolidators, hotel partners, and transport providers.
          </p>
        </div>
      </div>

      {error && (
        <div className="p-4 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-500 text-xs flex items-center gap-3">
          <AlertCircle className="w-4 h-4 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      <form
        onSubmit={handleSubmit}
        className="p-6 rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-sm space-y-6"
      >
        {/* Section 1: Basic Identity */}
        <div>
          <h3 className="text-sm font-bold text-slate-900 dark:text-white mb-4 pb-2 border-b border-slate-100 dark:border-slate-800 flex items-center gap-2">
            <Building2 className="w-4 h-4 text-purple-600" />
            <span>Supplier Identity</span>
          </h3>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                Supplier Code <span className="text-rose-500">*</span>
              </label>
              <input
                name="code"
                required
                placeholder="e.g. SUP-KAM"
                className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg px-3 py-2 text-xs text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-purple-500"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                Supplier Type <span className="text-rose-500">*</span>
              </label>
              <select
                name="type"
                defaultValue="AIRLINE"
                className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg px-3 py-2 text-xs text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-purple-500"
              >
                <option value="AIRLINE">Airline (e.g. Kam Air, Ariana, Emirates)</option>
                <option value="HOTEL">Hotel / Resort Partner</option>
                <option value="DMC">DMC / Ground Handling Partner</option>
                <option value="VISA_PROVIDER">Visa Processing Partner</option>
                <option value="TRANSPORT">Ground Transport / Car Rental</option>
                <option value="TOUR_OPERATOR">Tour / Excursion Operator</option>
                <option value="BUS_OPERATOR">Bus / Coach Operator</option>
                <option value="TRAIN">Rail / Train Partner</option>
                <option value="OTHER">Other Provider</option>
              </select>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                Supplier / Company Name <span className="text-rose-500">*</span>
              </label>
              <input
                name="name"
                required
                placeholder="e.g. Kam Air Airlines"
                className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg px-3 py-2 text-xs text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-purple-500"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                Contact Person
              </label>
              <input
                name="contactPerson"
                placeholder="e.g. Account Manager"
                className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg px-3 py-2 text-xs text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-purple-500"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                Phone Number
              </label>
              <input
                name="phone"
                placeholder="+93 79 123 4567"
                className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg px-3 py-2 text-xs text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-purple-500"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                Email Address
              </label>
              <input
                name="email"
                type="email"
                placeholder="agency-support@kamair.com"
                className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg px-3 py-2 text-xs text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-purple-500"
              />
            </div>
          </div>
        </div>

        {/* Section 2: Financial & Currency Terms */}
        <div>
          <h3 className="text-sm font-bold text-slate-900 dark:text-white mb-4 pb-2 border-b border-slate-100 dark:border-slate-800">
            Financial & Settlement Terms
          </h3>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                Default Currency
              </label>
              <select
                name="currency"
                defaultValue="USD"
                className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg px-3 py-2 text-xs text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-purple-500"
              >
                <option value="USD">USD ($)</option>
                <option value="AFN">AFN (؋)</option>
                <option value="AED">AED (د.إ)</option>
                <option value="EUR">EUR (€)</option>
              </select>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                Payment Terms (Days)
              </label>
              <input
                name="paymentTermsDays"
                type="number"
                defaultValue="15"
                className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg px-3 py-2 text-xs text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-purple-500"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                Tax Identification Number (TIN)
              </label>
              <input
                name="taxNumber"
                placeholder="e.g. TIN-8829103"
                className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg px-3 py-2 text-xs text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-purple-500"
              />
            </div>

            <div className="sm:col-span-3">
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                Bank / Hawala Disbursement Details
              </label>
              <textarea
                name="bankDetails"
                rows={2}
                placeholder="e.g. Bank: Afghanistan International Bank (AIB) / Account: 001-12345-USD / Hawala: Sarafi Market, Kabul Branch"
                className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg px-3 py-2 text-xs text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-purple-500"
              />
            </div>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="pt-4 border-t border-slate-100 dark:border-slate-800 flex justify-end gap-3">
          <Link
            href="/suppliers"
            className="px-4 py-2 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 text-xs font-semibold rounded-xl transition-colors"
          >
            Cancel
          </Link>
          <button
            type="submit"
            disabled={isSubmitting}
            className="inline-flex items-center gap-2 px-5 py-2 bg-purple-600 hover:bg-purple-500 text-white text-xs font-semibold rounded-xl shadow-sm shadow-purple-500/20 transition-all disabled:opacity-50"
          >
            {isSubmitting ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                <span>Saving Supplier...</span>
              </>
            ) : (
              <>
                <Save className="w-4 h-4" />
                <span>Save Supplier</span>
              </>
            )}
          </button>
        </div>
      </form>
    </div>
  );
}
