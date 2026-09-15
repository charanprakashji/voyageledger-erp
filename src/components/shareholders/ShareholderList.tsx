"use client";

import React, { useState } from "react";
import {
  Users,
  Plus,
  Search,
  Edit2,
  Trash2,
  AlertCircle,
  CheckCircle,
  XCircle,
  PieChart,
  DollarSign,
  Building,
  Save,
} from "lucide-react";
import { ShareholderStatus } from "@prisma/client";
import {
  createShareholder,
  updateShareholder,
  deleteShareholder,
  CreateShareholderInput,
  UpdateShareholderInput,
} from "@/app/actions/shareholders";
import { useRouter } from "next/navigation";

interface ShareholderListProps {
  initialData: any[];
  pagination: {
    total: number;
    page: number;
    limit: number;
    totalPages: number;
  };
}

export function ShareholderList({ initialData, pagination }: ShareholderListProps) {
  const router = useRouter();
  const [shareholders, setShareholders] = useState<any[]>(initialData);
  const [searchQuery, setSearchQuery] = useState("");
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingShareholder, setEditingShareholder] = useState<any | null>(null);

  // Form State
  const [formData, setFormData] = useState<CreateShareholderInput>({
    name: "",
    code: "",
    nationalId: "",
    contactPerson: "",
    email: "",
    phone: "",
    address: "",
    sharePercentage: 0,
    capitalContribution: 0,
    currency: "AFN",
    status: ShareholderStatus.ACTIVE,
    notes: "",
  });

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [feedback, setFeedback] = useState<{ type: "success" | "error"; message: string } | null>(null);

  // Totals
  const totalSharePercentage = shareholders.reduce((acc, s) => acc + Number(s.sharePercentage || 0), 0);
  const totalCapitalContribution = shareholders.reduce((acc, s) => acc + Number(s.capitalContribution || 0), 0);

  const handleOpenCreate = () => {
    setEditingShareholder(null);
    setFormData({
      name: "",
      code: "",
      nationalId: "",
      contactPerson: "",
      email: "",
      phone: "",
      address: "",
      sharePercentage: 0,
      capitalContribution: 0,
      currency: "AFN",
      status: ShareholderStatus.ACTIVE,
      notes: "",
    });
    setFeedback(null);
    setIsModalOpen(true);
  };

  const handleOpenEdit = (sh: any) => {
    setEditingShareholder(sh);
    setFormData({
      name: sh.name,
      code: sh.code,
      nationalId: sh.nationalId || "",
      contactPerson: sh.contactPerson || "",
      email: sh.email || "",
      phone: sh.phone || "",
      address: sh.address || "",
      sharePercentage: Number(sh.sharePercentage || 0),
      capitalContribution: Number(sh.capitalContribution || 0),
      currency: sh.currency || "AFN",
      status: sh.status,
      notes: sh.notes || "",
    });
    setFeedback(null);
    setIsModalOpen(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    setFeedback(null);

    try {
      if (editingShareholder) {
        const res = await updateShareholder({
          ...formData,
          id: editingShareholder.id,
        });
        if (res.success && res.data) {
          setShareholders((prev) =>
            prev.map((s) => (s.id === editingShareholder.id ? { ...s, ...res.data } : s))
          );
          setIsModalOpen(false);
          router.refresh();
        } else {
          setFeedback({ type: "error", message: res.error || "Failed to update shareholder." });
        }
      } else {
        const res = await createShareholder(formData);
        if (res.success && res.data) {
          setShareholders([res.data, ...shareholders]);
          setIsModalOpen(false);
          router.refresh();
        } else {
          setFeedback({ type: "error", message: res.error || "Failed to create shareholder." });
        }
      }
    } catch (err: any) {
      setFeedback({ type: "error", message: err.message || "An error occurred." });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDelete = async (id: string, name: string) => {
    if (!confirm(`Are you sure you want to delete shareholder '${name}'?`)) return;

    try {
      const res = await deleteShareholder(id);
      if (res.success) {
        setShareholders(shareholders.filter((s) => s.id !== id));
        router.refresh();
      } else {
        alert(res.error || "Failed to delete shareholder");
      }
    } catch (err: any) {
      alert(err.message || "An error occurred");
    }
  };

  const filteredShareholders = shareholders.filter((s) => {
    if (!searchQuery.trim()) return true;
    const q = searchQuery.toLowerCase();
    return (
      s.name.toLowerCase().includes(q) ||
      s.code.toLowerCase().includes(q) ||
      (s.email && s.email.toLowerCase().includes(q)) ||
      (s.phone && s.phone.includes(q))
    );
  });

  return (
    <div className="space-y-6">
      {/* Top Summary Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-5">
        <div className="p-5 rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-sm flex items-center gap-4">
          <div className="p-3 rounded-xl bg-blue-50 dark:bg-blue-950/50 text-blue-600">
            <Users className="w-6 h-6" />
          </div>
          <div>
            <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Total Shareholders</p>
            <p className="text-2xl font-bold text-slate-900 dark:text-white mt-0.5">{shareholders.length}</p>
          </div>
        </div>

        <div className="p-5 rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-sm flex items-center gap-4">
          <div className="p-3 rounded-xl bg-emerald-50 dark:bg-emerald-950/50 text-emerald-600">
            <PieChart className="w-6 h-6" />
          </div>
          <div>
            <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Allocated Shares</p>
            <p className="text-2xl font-bold text-emerald-600 dark:text-emerald-400 mt-0.5">
              {totalSharePercentage.toFixed(2)}%
            </p>
          </div>
        </div>

        <div className="p-5 rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-sm flex items-center gap-4">
          <div className="p-3 rounded-xl bg-purple-50 dark:bg-purple-950/50 text-purple-600">
            <DollarSign className="w-6 h-6" />
          </div>
          <div>
            <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Total Capital (AFN)</p>
            <p className="text-2xl font-bold text-purple-600 dark:text-purple-400 mt-0.5 font-mono">
              {totalCapitalContribution.toLocaleString(undefined, { minimumFractionDigits: 2 })}
            </p>
          </div>
        </div>
      </div>

      {/* Action Header & Search */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="relative flex-1 max-w-md">
          <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-3" />
          <input
            type="text"
            placeholder="Search shareholders by name, code, contact..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-10 pr-4 py-2 text-sm rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>

        <button
          type="button"
          onClick={handleOpenCreate}
          className="inline-flex items-center gap-2 px-5 py-2.5 text-sm font-bold rounded-xl bg-blue-600 hover:bg-blue-700 text-white shadow-md shadow-blue-500/20 transition-colors"
        >
          <Plus className="w-4 h-4" /> Add Shareholder
        </button>
      </div>

      {/* Shareholders Table */}
      <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-50 dark:bg-slate-800/60 border-b border-slate-200 dark:border-slate-800 text-slate-500 uppercase font-semibold">
              <tr>
                <th className="px-5 py-3.5">Code</th>
                <th className="px-5 py-3.5">Shareholder Name</th>
                <th className="px-5 py-3.5">Contact / Email</th>
                <th className="px-5 py-3.5 text-right">Share %</th>
                <th className="px-5 py-3.5 text-right">Capital Contribution</th>
                <th className="px-5 py-3.5 text-center">Status</th>
                <th className="px-5 py-3.5 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800/60">
              {filteredShareholders.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-5 py-8 text-center text-slate-400">
                    No shareholders found. Click "Add Shareholder" to create one.
                  </td>
                </tr>
              ) : (
                filteredShareholders.map((sh) => (
                  <tr key={sh.id} className="hover:bg-slate-50/60 dark:hover:bg-slate-800/40 transition-colors">
                    <td className="px-5 py-3.5 font-mono font-bold text-slate-900 dark:text-white">{sh.code}</td>
                    <td className="px-5 py-3.5">
                      <p className="font-bold text-slate-900 dark:text-white text-sm">{sh.name}</p>
                      {sh.nationalId && (
                        <p className="text-[11px] text-slate-400 font-mono">Tazkira: {sh.nationalId}</p>
                      )}
                    </td>
                    <td className="px-5 py-3.5 text-slate-600 dark:text-slate-400">
                      {sh.email && <p>{sh.email}</p>}
                      {sh.phone && <p className="font-mono text-[11px] text-slate-400">{sh.phone}</p>}
                    </td>
                    <td className="px-5 py-3.5 text-right font-bold text-emerald-600 dark:text-emerald-400 text-sm">
                      {Number(sh.sharePercentage).toFixed(2)}%
                    </td>
                    <td className="px-5 py-3.5 text-right font-mono font-semibold text-slate-900 dark:text-white">
                      {Number(sh.capitalContribution).toLocaleString(undefined, { minimumFractionDigits: 2 })} {sh.currency || "AFN"}
                    </td>
                    <td className="px-5 py-3.5 text-center">
                      <span
                        className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase ${
                          sh.status === "ACTIVE"
                            ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-300"
                            : "bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300"
                        }`}
                      >
                        {sh.status}
                      </span>
                    </td>
                    <td className="px-5 py-3.5 text-right">
                      <div className="flex items-center justify-end gap-2">
                        <button
                          type="button"
                          onClick={() => handleOpenEdit(sh)}
                          className="p-1.5 text-slate-400 hover:text-blue-600 transition-colors"
                          title="Edit Shareholder"
                        >
                          <Edit2 className="w-4 h-4" />
                        </button>
                        <button
                          type="button"
                          onClick={() => handleDelete(sh.id, sh.name)}
                          className="p-1.5 text-slate-400 hover:text-rose-600 transition-colors"
                          title="Delete Shareholder"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* CREATE / EDIT MODAL */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl max-w-lg w-full p-6 space-y-5 shadow-2xl">
            <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-3">
              <h3 className="text-base font-bold text-slate-900 dark:text-white flex items-center gap-2">
                <Users className="w-5 h-5 text-blue-600" />
                {editingShareholder ? `Edit Shareholder (${formData.code})` : "New Shareholder Registration"}
              </h3>
              <button
                type="button"
                onClick={() => setIsModalOpen(false)}
                className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
              >
                ✕
              </button>
            </div>

            {feedback && (
              <div
                className={`p-3 text-xs rounded-xl flex items-center gap-2 ${
                  feedback.type === "error"
                    ? "bg-rose-50 text-rose-700 border border-rose-200"
                    : "bg-emerald-50 text-emerald-700 border border-emerald-200"
                }`}
              >
                <AlertCircle className="w-4 h-4 shrink-0" />
                <span>{feedback.message}</span>
              </div>
            )}

            <form onSubmit={handleSubmit} className="space-y-4 text-xs">
              <div className="grid grid-cols-2 gap-3">
                <div className="col-span-2">
                  <label className="font-semibold text-slate-700 dark:text-slate-300">Shareholder Full Name *</label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. Haji Mohammad Qasim"
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    className="mt-1 w-full px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 font-medium"
                  />
                </div>

                <div>
                  <label className="font-semibold text-slate-700 dark:text-slate-300">Shareholder Code</label>
                  <input
                    type="text"
                    placeholder="Auto-generated (e.g. SH-001)"
                    value={formData.code || ""}
                    onChange={(e) => setFormData({ ...formData, code: e.target.value })}
                    className="mt-1 w-full px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 font-mono uppercase"
                  />
                </div>

                <div>
                  <label className="font-semibold text-slate-700 dark:text-slate-300">Tazkira / National ID</label>
                  <input
                    type="text"
                    placeholder="e.g. 1402-998811"
                    value={formData.nationalId || ""}
                    onChange={(e) => setFormData({ ...formData, nationalId: e.target.value })}
                    className="mt-1 w-full px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 font-mono"
                  />
                </div>

                <div>
                  <label className="font-semibold text-slate-700 dark:text-slate-300">Share Ownership (%)</label>
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    max="100"
                    required
                    value={formData.sharePercentage !== undefined ? String(formData.sharePercentage) : ""}
                    onChange={(e) => setFormData({ ...formData, sharePercentage: parseFloat(e.target.value) || 0 })}
                    className="mt-1 w-full px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 font-bold text-emerald-600"
                  />
                </div>

                <div>
                  <label className="font-semibold text-slate-700 dark:text-slate-300">Capital Contribution (AFN)</label>
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    required
                    value={formData.capitalContribution !== undefined ? String(formData.capitalContribution) : ""}
                    onChange={(e) => setFormData({ ...formData, capitalContribution: parseFloat(e.target.value) || 0 })}
                    className="mt-1 w-full px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 font-mono font-bold"
                  />
                </div>

                <div>
                  <label className="font-semibold text-slate-700 dark:text-slate-300">Phone</label>
                  <input
                    type="text"
                    placeholder="+93 700 123 456"
                    value={formData.phone || ""}
                    onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                    className="mt-1 w-full px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 font-mono"
                  />
                </div>

                <div>
                  <label className="font-semibold text-slate-700 dark:text-slate-300">Email</label>
                  <input
                    type="email"
                    placeholder="shareholder@voyageledger.af"
                    value={formData.email || ""}
                    onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                    className="mt-1 w-full px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800"
                  />
                </div>

                <div className="col-span-2">
                  <label className="font-semibold text-slate-700 dark:text-slate-300">Status</label>
                  <select
                    value={formData.status}
                    onChange={(e) => setFormData({ ...formData, status: e.target.value as ShareholderStatus })}
                    className="mt-1 w-full px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 font-semibold"
                  >
                    <option value="ACTIVE">ACTIVE</option>
                    <option value="INACTIVE">INACTIVE</option>
                  </select>
                </div>
              </div>

              <div className="flex justify-end gap-2 pt-3 border-t border-slate-100 dark:border-slate-800">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="px-4 py-2 rounded-lg border border-slate-200 text-slate-700 dark:text-slate-300"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="px-6 py-2 rounded-lg bg-blue-600 hover:bg-blue-700 text-white font-bold disabled:opacity-50"
                >
                  {isSubmitting ? "Saving..." : editingShareholder ? "Update Shareholder" : "Save Shareholder"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
