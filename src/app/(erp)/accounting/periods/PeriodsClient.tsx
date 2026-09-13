"use client";

import React, { useState } from "react";
import { useRouter } from "next/navigation";
import {
  createAccountingPeriod,
  lockAccountingPeriod,
  unlockAccountingPeriod,
} from "@/app/actions/periods";
import { Badge } from "@/components/ui/Badge";
import { Modal } from "@/components/ui/Modal";
import { formatDate, formatDateTime } from "@/lib/accounting";
import {
  CalendarDays,
  Plus,
  Lock,
  Unlock,
  Loader2,
  Save,
  AlertCircle,
  ShieldCheck,
  FileText,
} from "lucide-react";

interface PeriodsClientProps {
  initialPeriods: any[];
}

export function PeriodsClient({ initialPeriods }: PeriodsClientProps) {
  const router = useRouter();
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [actionLoadingId, setActionLoadingId] = useState<string | null>(null);

  async function handleCreate(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    setIsSubmitting(true);

    try {
      const formData = new FormData(e.currentTarget);
      const res = await createAccountingPeriod(formData);

      if (res.success) {
        setIsAddModalOpen(false);
        router.refresh();
      } else {
        setError(res.error || "Failed to create accounting period.");
      }
    } catch (err: any) {
      setError(err?.message || "An unexpected error occurred.");
    } finally {
      setIsSubmitting(false);
    }
  }

  async function handleLock(periodId: string) {
    if (!window.confirm("Are you sure you want to lock this accounting period? No further journal entries can be posted.")) {
      return;
    }

    setActionLoadingId(periodId);
    try {
      const res = await lockAccountingPeriod(periodId);
      if (res.success) {
        router.refresh();
      } else {
        alert(res.error || "Failed to lock period.");
      }
    } catch (err: any) {
      alert(err?.message || "An unexpected error occurred.");
    } finally {
      setActionLoadingId(null);
    }
  }

  async function handleUnlock(periodId: string) {
    if (!window.confirm("Unlock this accounting period? Note: Strictly ADMIN role authorization is required.")) {
      return;
    }

    setActionLoadingId(periodId);
    try {
      const res = await unlockAccountingPeriod(periodId);
      if (res.success) {
        router.refresh();
      } else {
        alert(res.error || "Failed to unlock period (Requires ADMIN role).");
      }
    } catch (err: any) {
      alert(err?.message || "An unexpected error occurred.");
    } finally {
      setActionLoadingId(null);
    }
  }

  return (
    <div className="space-y-4">
      {/* Top Action Bar */}
      <div className="flex items-center justify-between p-4 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-sm">
        <div className="flex items-center gap-2 text-xs text-slate-500">
          <ShieldCheck className="w-4 h-4 text-blue-500" />
          <span>Period Locking Guard Active: Only <strong>ADMIN</strong> may unlock locked accounting periods.</span>
        </div>

        <button
          type="button"
          onClick={() => {
            setError(null);
            setIsAddModalOpen(true);
          }}
          className="inline-flex items-center gap-1.5 px-3.5 py-2 bg-blue-600 hover:bg-blue-500 text-white text-xs font-semibold rounded-xl shadow-sm shadow-blue-500/20 transition-colors"
        >
          <Plus className="w-3.5 h-3.5" />
          <span>New Period</span>
        </button>
      </div>

      {/* Periods Table */}
      <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-50 dark:bg-slate-800/60 border-b border-slate-200 dark:border-slate-800 text-slate-500 uppercase tracking-wider text-[11px] font-semibold">
              <tr>
                <th className="py-3 px-4">Period Name</th>
                <th className="py-3 px-4">Financial Year</th>
                <th className="py-3 px-4">Start Date</th>
                <th className="py-3 px-4">End Date</th>
                <th className="py-3 px-4">Status</th>
                <th className="py-3 px-4">Locked Info</th>
                <th className="py-3 px-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
              {initialPeriods.length === 0 ? (
                <tr>
                  <td colSpan={7} className="py-12 text-center text-slate-400">
                    <CalendarDays className="w-8 h-8 mx-auto mb-2 opacity-40" />
                    <p className="font-semibold text-slate-600 dark:text-slate-300">
                      No accounting periods defined yet
                    </p>
                    <p className="text-xs text-slate-400 mt-0.5">
                      Click 'New Period' to establish monthly, quarterly, or annual fiscal periods.
                    </p>
                  </td>
                </tr>
              ) : (
                initialPeriods.map((period) => (
                  <tr
                    key={period.id}
                    className="hover:bg-slate-50/80 dark:hover:bg-slate-800/40 transition-colors"
                  >
                    <td className="py-3.5 px-4 font-bold text-slate-900 dark:text-white">
                      <div className="flex items-center gap-2">
                        {period.isLocked ? (
                          <Lock className="w-3.5 h-3.5 text-rose-500" />
                        ) : (
                          <Unlock className="w-3.5 h-3.5 text-emerald-500" />
                        )}
                        <span>{period.name}</span>
                      </div>
                    </td>

                    <td className="py-3.5 px-4 font-semibold text-slate-700 dark:text-slate-300">
                      {period.financialYear}
                    </td>

                    <td className="py-3.5 px-4 text-slate-600 dark:text-slate-400 whitespace-nowrap">
                      {formatDate(period.startDate)}
                    </td>

                    <td className="py-3.5 px-4 text-slate-600 dark:text-slate-400 whitespace-nowrap">
                      {formatDate(period.endDate)}
                    </td>

                    <td className="py-3.5 px-4">
                      <Badge variant={period.isLocked ? "danger" : "success"}>
                        {period.isLocked ? "Locked / Closed" : "Open for Postings"}
                      </Badge>
                    </td>

                    <td className="py-3.5 px-4 text-slate-500 text-[11px]">
                      {period.isLocked ? (
                        <div>
                          <p className="text-slate-700 dark:text-slate-300 font-medium">
                            {period.lockedBy?.name || "System Admin"}
                          </p>
                          <p className="text-slate-400">{formatDateTime(period.lockedAt)}</p>
                        </div>
                      ) : (
                        "-"
                      )}
                    </td>

                    <td className="py-3.5 px-4 text-right">
                      {period.isLocked ? (
                        <button
                          type="button"
                          disabled={actionLoadingId === period.id}
                          onClick={() => handleUnlock(period.id)}
                          className="inline-flex items-center gap-1 px-3 py-1 bg-amber-50 dark:bg-amber-950/40 text-amber-700 dark:text-amber-400 hover:bg-amber-100 border border-amber-200 dark:border-amber-800 rounded-lg text-xs font-semibold transition-colors disabled:opacity-50"
                        >
                          {actionLoadingId === period.id ? (
                            <Loader2 className="w-3 h-3 animate-spin" />
                          ) : (
                            <Unlock className="w-3 h-3" />
                          )}
                          <span>Unlock (Admin)</span>
                        </button>
                      ) : (
                        <button
                          type="button"
                          disabled={actionLoadingId === period.id}
                          onClick={() => handleLock(period.id)}
                          className="inline-flex items-center gap-1 px-3 py-1 bg-rose-50 dark:bg-rose-950/40 text-rose-700 dark:text-rose-400 hover:bg-rose-100 border border-rose-200 dark:border-rose-800 rounded-lg text-xs font-semibold transition-colors disabled:opacity-50"
                        >
                          {actionLoadingId === period.id ? (
                            <Loader2 className="w-3 h-3 animate-spin" />
                          ) : (
                            <Lock className="w-3 h-3" />
                          )}
                          <span>Lock Period</span>
                        </button>
                      )}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* New Accounting Period Modal */}
      <Modal
        isOpen={isAddModalOpen}
        onClose={() => setIsAddModalOpen(false)}
        title="Create New Accounting Period"
        description="Establish a fiscal period for General Ledger reporting and locking."
      >
        <form onSubmit={handleCreate} className="space-y-4">
          {error && (
            <div className="p-3 rounded-lg bg-rose-500/10 border border-rose-500/30 text-rose-500 text-xs flex items-center gap-2">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          <div>
            <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
              Period Name <span className="text-rose-500">*</span>
            </label>
            <input
              name="name"
              required
              placeholder="e.g. September 2026 or Mizan 1405"
              className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg px-3 py-2 text-xs text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
              Financial Year <span className="text-rose-500">*</span>
            </label>
            <input
              name="financialYear"
              required
              defaultValue="2026"
              placeholder="e.g. 2026 or 1405"
              className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg px-3 py-2 text-xs text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                Start Date <span className="text-rose-500">*</span>
              </label>
              <input
                name="startDate"
                type="date"
                required
                className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg px-3 py-2 text-xs text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                End Date <span className="text-rose-500">*</span>
              </label>
              <input
                name="endDate"
                type="date"
                required
                className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg px-3 py-2 text-xs text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
          </div>

          <div className="pt-3 border-t border-slate-100 dark:border-slate-800 flex justify-end gap-2">
            <button
              type="button"
              onClick={() => setIsAddModalOpen(false)}
              className="px-3 py-1.5 rounded-lg bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 text-xs font-semibold text-slate-600 dark:text-slate-300"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className="px-4 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-500 text-xs font-semibold text-white flex items-center gap-1.5 disabled:opacity-50"
            >
              {isSubmitting ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Save className="w-3.5 h-3.5" />}
              <span>Create Period</span>
            </button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
