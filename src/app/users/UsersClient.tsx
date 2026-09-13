"use client";

import React, { useState } from "react";
import { useRouter } from "next/navigation";
import { createUser, updateUserStatus, updateUserRole } from "@/app/actions/users";
import { Badge } from "@/components/ui/Badge";
import { Modal } from "@/components/ui/Modal";
import { formatDate, formatDateTime } from "@/lib/accounting";
import {
  UserCheck,
  Plus,
  Shield,
  Loader2,
  Save,
  AlertCircle,
  Mail,
  Phone,
  UserX,
} from "lucide-react";
import { UserRole, UserStatus } from "@prisma/client";

interface UsersClientProps {
  initialUsers: any[];
}

export function UsersClient({ initialUsers }: UsersClientProps) {
  const router = useRouter();
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [actionLoadingId, setActionLoadingId] = useState<string | null>(null);

  async function handleCreate(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    setIsSubmitting(true);

    const formData = new FormData(e.currentTarget);
    const res = await createUser(formData);

    if (res.success) {
      setIsAddModalOpen(false);
      router.refresh();
    } else {
      setError(res.error || "Failed to create user.");
    }
    setIsSubmitting(false);
  }

  async function handleStatusToggle(userId: string, currentStatus: UserStatus) {
    const nextStatus: UserStatus = currentStatus === "ACTIVE" ? "INACTIVE" : "ACTIVE";
    setActionLoadingId(userId);

    const res = await updateUserStatus(userId, nextStatus);
    if (res.success) {
      router.refresh();
    } else {
      alert(res.error || "Failed to update user status.");
    }
    setActionLoadingId(null);
  }

  async function handleRoleChange(userId: string, role: UserRole) {
    setActionLoadingId(userId);
    const res = await updateUserRole(userId, role);
    if (res.success) {
      router.refresh();
    } else {
      alert(res.error || "Failed to update user role.");
    }
    setActionLoadingId(null);
  }

  return (
    <div className="space-y-4">
      {/* Action Bar */}
      <div className="flex items-center justify-between p-4 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-sm">
        <div className="flex items-center gap-2 text-xs text-slate-500">
          <Shield className="w-4 h-4 text-blue-500" />
          <span>Server-Side Authorization Enforced Across All Protect Actions</span>
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
          <span>Add New User</span>
        </button>
      </div>

      {/* Users Table */}
      <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-50 dark:bg-slate-800/60 border-b border-slate-200 dark:border-slate-800 text-slate-500 uppercase tracking-wider text-[11px] font-semibold">
              <tr>
                <th className="py-3 px-4">User Name & Email</th>
                <th className="py-3 px-4">Role (RBAC)</th>
                <th className="py-3 px-4">Phone</th>
                <th className="py-3 px-4">Status</th>
                <th className="py-3 px-4">Created</th>
                <th className="py-3 px-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
              {initialUsers.length === 0 ? (
                <tr>
                  <td colSpan={6} className="py-12 text-center text-slate-400">
                    <UserCheck className="w-8 h-8 mx-auto mb-2 opacity-40" />
                    <p className="font-semibold text-slate-600 dark:text-slate-300">
                      No users loaded
                    </p>
                    <p className="text-xs text-slate-400 mt-0.5">
                      Ensure you are authenticated as an Administrator to view system users.
                    </p>
                  </td>
                </tr>
              ) : (
                initialUsers.map((u) => (
                  <tr
                    key={u.id}
                    className="hover:bg-slate-50/80 dark:hover:bg-slate-800/40 transition-colors"
                  >
                    <td className="py-3.5 px-4 font-medium">
                      <div className="flex items-center gap-2.5">
                        <div className="w-8 h-8 rounded-full bg-slate-200 dark:bg-slate-700 flex items-center justify-center font-bold text-xs text-slate-700 dark:text-slate-200">
                          {u.name.slice(0, 2).toUpperCase()}
                        </div>
                        <div>
                          <p className="font-bold text-slate-900 dark:text-white">{u.name}</p>
                          <p className="text-[11px] text-slate-400">{u.email}</p>
                        </div>
                      </div>
                    </td>

                    <td className="py-3.5 px-4">
                      <select
                        value={u.role}
                        disabled={actionLoadingId === u.id}
                        onChange={(e) => handleRoleChange(u.id, e.target.value as UserRole)}
                        className="bg-slate-100 dark:bg-slate-800 border-none rounded-lg px-2 py-1 text-xs font-semibold text-slate-800 dark:text-slate-200 focus:ring-2 focus:ring-blue-500"
                      >
                        <option value="ADMIN">ADMIN</option>
                        <option value="MANAGER">MANAGER</option>
                        <option value="ACCOUNTANT">ACCOUNTANT</option>
                        <option value="TRAVEL_AGENT">TRAVEL_AGENT</option>
                        <option value="AUDITOR">AUDITOR</option>
                      </select>
                    </td>

                    <td className="py-3.5 px-4 text-slate-600 dark:text-slate-300">
                      {u.phone || "-"}
                    </td>

                    <td className="py-3.5 px-4">
                      <Badge variant={u.status === "ACTIVE" ? "success" : "danger"}>
                        {u.status}
                      </Badge>
                    </td>

                    <td className="py-3.5 px-4 text-slate-400 text-[11px]">
                      {formatDate(u.createdAt)}
                    </td>

                    <td className="py-3.5 px-4 text-right">
                      <button
                        type="button"
                        disabled={actionLoadingId === u.id}
                        onClick={() => handleStatusToggle(u.id, u.status)}
                        className={`px-3 py-1 text-xs font-semibold rounded-lg transition-colors disabled:opacity-50 ${
                          u.status === "ACTIVE"
                            ? "bg-rose-50 dark:bg-rose-950/40 text-rose-700 dark:text-rose-400 hover:bg-rose-100"
                            : "bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-400 hover:bg-emerald-100"
                        }`}
                      >
                        {actionLoadingId === u.id ? (
                          <Loader2 className="w-3 h-3 animate-spin inline" />
                        ) : u.status === "ACTIVE" ? (
                          "Deactivate"
                        ) : (
                          "Activate"
                        )}
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Add User Modal */}
      <Modal
        isOpen={isAddModalOpen}
        onClose={() => setIsAddModalOpen(false)}
        title="Create New System User"
        description="Add staff members and assign RBAC roles."
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
              Full Name <span className="text-rose-500">*</span>
            </label>
            <input
              name="name"
              required
              placeholder="e.g. Farhad Rahimi"
              className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg px-3 py-2 text-xs text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
              Email Address <span className="text-rose-500">*</span>
            </label>
            <input
              name="email"
              type="email"
              required
              placeholder="farhad@voyageledger.af"
              className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg px-3 py-2 text-xs text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
              Initial Password <span className="text-rose-500">*</span>
            </label>
            <input
              name="password"
              type="password"
              required
              placeholder="••••••••"
              className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg px-3 py-2 text-xs text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                Role (RBAC) <span className="text-rose-500">*</span>
              </label>
              <select
                name="role"
                defaultValue="TRAVEL_AGENT"
                className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg px-3 py-2 text-xs text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="ADMIN">ADMIN</option>
                <option value="MANAGER">MANAGER</option>
                <option value="ACCOUNTANT">ACCOUNTANT</option>
                <option value="TRAVEL_AGENT">TRAVEL_AGENT</option>
                <option value="AUDITOR">AUDITOR</option>
              </select>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                Phone Number
              </label>
              <input
                name="phone"
                placeholder="+93 70 000 0000"
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
              <span>Create User</span>
            </button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
