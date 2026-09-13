"use client";

import React, { useState } from "react";
import { AccountTreeNode, createAccount, updateAccount, deleteAccount } from "@/app/actions/chartOfAccounts";
import { Badge } from "@/components/ui/Badge";
import { Modal } from "@/components/ui/Modal";
import {
  FolderTree,
  Plus,
  Shield,
  Edit,
  Trash2,
  ChevronDown,
  ChevronRight,
  Loader2,
  Save,
  AlertCircle,
  Folder,
  FileText,
} from "lucide-react";
import { useRouter } from "next/navigation";
import { AccountType, NormalBalance } from "@prisma/client";

interface ChartOfAccountsClientProps {
  initialTree: AccountTreeNode[];
}

export function ChartOfAccountsClient({ initialTree }: ChartOfAccountsClientProps) {
  const router = useRouter();
  const [selectedParentId, setSelectedParentId] = useState<string | null>(null);
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [activeAccount, setActiveAccount] = useState<AccountTreeNode | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Flattened account list for parent dropdown selection
  const flatAccounts: { id: string; code: string; name: string }[] = [];
  function flatten(nodes: AccountTreeNode[]) {
    for (const n of nodes) {
      flatAccounts.push({ id: n.id, code: n.code, name: n.name });
      if (n.children?.length) flatten(n.children);
    }
  }
  flatten(initialTree);

  async function handleCreate(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    setIsSubmitting(true);

    const formData = new FormData(e.currentTarget);
    const res = await createAccount(formData);

    if (res.success) {
      setIsAddModalOpen(false);
      router.refresh();
    } else {
      setError(res.error || "Failed to create account.");
    }
    setIsSubmitting(false);
  }

  async function handleUpdate(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!activeAccount) return;
    setError(null);
    setIsSubmitting(true);

    const formData = new FormData(e.currentTarget);
    const res = await updateAccount(activeAccount.id, formData);

    if (res.success) {
      setIsEditModalOpen(false);
      router.refresh();
    } else {
      setError(res.error || "Failed to update account.");
    }
    setIsSubmitting(false);
  }

  async function handleDelete(account: AccountTreeNode) {
    if (
      !window.confirm(
        `Are you sure you want to delete account ${account.code} - ${account.name}?`
      )
    ) {
      return;
    }

    const res = await deleteAccount(account.id);
    if (res.success) {
      router.refresh();
    } else {
      alert(res.error || "Failed to delete account.");
    }
  }

  function renderAccountNode(node: AccountTreeNode, depth = 0) {
    const hasChildren = node.children && node.children.length > 0;

    return (
      <div key={node.id} className="group">
        <div
          className={`flex items-center justify-between py-2.5 px-4 rounded-lg hover:bg-slate-50 dark:hover:bg-slate-800/60 transition-colors border-l-2 ${
            node.isSystemAccount ? "border-l-blue-500" : "border-l-transparent"
          }`}
          style={{ paddingLeft: `${Math.max(16, depth * 28 + 16)}px` }}
        >
          {/* Left: Code, Name, Badges */}
          <div className="flex items-center gap-2.5">
            {hasChildren ? (
              <Folder className="w-4 h-4 text-amber-500 shrink-0" />
            ) : (
              <FileText className="w-4 h-4 text-slate-400 shrink-0" />
            )}

            <span className="font-mono font-bold text-xs text-slate-900 dark:text-white">
              {node.code}
            </span>

            <span className="font-medium text-xs text-slate-800 dark:text-slate-200">
              {node.name}
            </span>

            {node.isSystemAccount && (
              <span
                title="System Core Account (Protected)"
                className="inline-flex items-center gap-0.5 text-[10px] font-semibold px-1.5 py-0.2 rounded bg-blue-100 dark:bg-blue-950/60 text-blue-700 dark:text-blue-300"
              >
                <Shield className="w-2.5 h-2.5" />
                <span>System</span>
              </span>
            )}

            {!node.isActive && (
              <span className="text-[10px] font-semibold px-1.5 py-0.2 rounded bg-rose-100 text-rose-700 dark:bg-rose-950/40 dark:text-rose-300">
                Inactive
              </span>
            )}
          </div>

          {/* Right: Account Type, Normal Balance, Actions */}
          <div className="flex items-center gap-3">
            <span className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider px-2 py-0.5 rounded bg-slate-100 dark:bg-slate-800">
              {node.accountType}
            </span>

            <span className="text-[11px] font-mono font-bold text-slate-400">
              {node.normalBalance}
            </span>

            <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
              <button
                type="button"
                onClick={() => {
                  setSelectedParentId(node.id);
                  setError(null);
                  setIsAddModalOpen(true);
                }}
                title="Add Sub-Account"
                className="p-1 rounded text-slate-400 hover:text-blue-600 hover:bg-slate-200 dark:hover:bg-slate-700"
              >
                <Plus className="w-3.5 h-3.5" />
              </button>

              <button
                type="button"
                onClick={() => {
                  setActiveAccount(node);
                  setError(null);
                  setIsEditModalOpen(true);
                }}
                title="Edit Account"
                className="p-1 rounded text-slate-400 hover:text-emerald-600 hover:bg-slate-200 dark:hover:bg-slate-700"
              >
                <Edit className="w-3.5 h-3.5" />
              </button>

              {!node.isSystemAccount && (
                <button
                  type="button"
                  onClick={() => handleDelete(node)}
                  title="Delete Account"
                  className="p-1 rounded text-slate-400 hover:text-rose-600 hover:bg-slate-200 dark:hover:bg-slate-700"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              )}
            </div>
          </div>
        </div>

        {/* Render Child Sub-Accounts */}
        {hasChildren && (
          <div className="space-y-0.5">
            {node.children.map((child) => renderAccountNode(child, depth + 1))}
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Top Action Bar */}
      <div className="flex items-center justify-between p-4 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-sm">
        <div className="flex items-center gap-2 text-xs text-slate-500">
          <span className="w-2 h-2 rounded-full bg-emerald-500"></span>
          <span>General Ledger Currency: <strong>AFN (Afghan Afghani)</strong></span>
          <span className="text-slate-300 dark:text-slate-700">•</span>
          <span>Single Source of Financial Truth</span>
        </div>

        <button
          type="button"
          onClick={() => {
            setSelectedParentId(null);
            setError(null);
            setIsAddModalOpen(true);
          }}
          className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-semibold rounded-lg shadow-sm shadow-emerald-500/20 transition-colors"
        >
          <Plus className="w-3.5 h-3.5" />
          <span>Add Account</span>
        </button>
      </div>

      {/* Tree View Container */}
      <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-sm p-4 divide-y divide-slate-100 dark:divide-slate-800">
        {initialTree.map((rootNode) => renderAccountNode(rootNode, 0))}
      </div>

      {/* Add Account Modal */}
      <Modal
        isOpen={isAddModalOpen}
        onClose={() => setIsAddModalOpen(false)}
        title="Add New General Ledger Account"
        description="Define an account in the Afghanistan Chart of Accounts hierarchy."
      >
        <form onSubmit={handleCreate} className="space-y-4">
          {error && (
            <div className="p-3 rounded-lg bg-rose-500/10 border border-rose-500/30 text-rose-500 text-xs flex items-center gap-2">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                Account Code <span className="text-rose-500">*</span>
              </label>
              <input
                name="code"
                required
                placeholder="e.g. 1040"
                className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg px-3 py-2 text-xs text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-emerald-500"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                Account Name <span className="text-rose-500">*</span>
              </label>
              <input
                name="name"
                required
                placeholder="e.g. Petty Cash Kabul"
                className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg px-3 py-2 text-xs text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-emerald-500"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                Account Type <span className="text-rose-500">*</span>
              </label>
              <select
                name="accountType"
                defaultValue="ASSET"
                className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg px-3 py-2 text-xs text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-emerald-500"
              >
                <option value="ASSET">ASSET</option>
                <option value="LIABILITY">LIABILITY</option>
                <option value="EQUITY">EQUITY</option>
                <option value="REVENUE">REVENUE</option>
                <option value="EXPENSE">EXPENSE</option>
              </select>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                Normal Balance <span className="text-rose-500">*</span>
              </label>
              <select
                name="normalBalance"
                defaultValue="DEBIT"
                className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg px-3 py-2 text-xs text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-emerald-500"
              >
                <option value="DEBIT">DEBIT (DR)</option>
                <option value="CREDIT">CREDIT (CR)</option>
              </select>
            </div>

            <div className="col-span-2">
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                Parent Account (Hierarchy)
              </label>
              <select
                name="parentAccountId"
                defaultValue={selectedParentId || ""}
                className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg px-3 py-2 text-xs text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-emerald-500"
              >
                <option value="">-- No Parent (Root Level Category) --</option>
                {flatAccounts.map((acc) => (
                  <option key={acc.id} value={acc.id}>
                    {acc.code} - {acc.name}
                  </option>
                ))}
              </select>
            </div>

            <div className="col-span-2">
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                Description
              </label>
              <input
                name="description"
                placeholder="Optional purpose of this account"
                className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg px-3 py-2 text-xs text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-emerald-500"
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
              className="px-4 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-xs font-semibold text-white flex items-center gap-1.5 disabled:opacity-50"
            >
              {isSubmitting ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Save className="w-3.5 h-3.5" />}
              <span>Save Account</span>
            </button>
          </div>
        </form>
      </Modal>

      {/* Edit Account Modal */}
      <Modal
        isOpen={isEditModalOpen}
        onClose={() => setIsEditModalOpen(false)}
        title={`Edit Account: ${activeAccount?.code}`}
        description="Update account title, parent link, and active status."
      >
        <form onSubmit={handleUpdate} className="space-y-4">
          {error && (
            <div className="p-3 rounded-lg bg-rose-500/10 border border-rose-500/30 text-rose-500 text-xs flex items-center gap-2">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          <div>
            <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
              Account Name <span className="text-rose-500">*</span>
            </label>
            <input
              name="name"
              required
              defaultValue={activeAccount?.name}
              className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg px-3 py-2 text-xs text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-emerald-500"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
              Parent Account
            </label>
            <select
              name="parentAccountId"
              defaultValue={activeAccount?.parentAccountId || ""}
              className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg px-3 py-2 text-xs text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-emerald-500"
            >
              <option value="">-- No Parent (Root Level) --</option>
              {flatAccounts
                .filter((a) => a.id !== activeAccount?.id)
                .map((acc) => (
                  <option key={acc.id} value={acc.id}>
                    {acc.code} - {acc.name}
                  </option>
                ))}
            </select>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
              Description
            </label>
            <input
              name="description"
              defaultValue={activeAccount?.description || ""}
              className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg px-3 py-2 text-xs text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-emerald-500"
            />
          </div>

          <div className="flex items-center gap-2 pt-2">
            <input
              type="checkbox"
              name="isActive"
              value="true"
              id="accountIsActive"
              defaultChecked={activeAccount?.isActive}
              className="rounded border-slate-300 text-emerald-600 focus:ring-emerald-500"
            />
            <label htmlFor="accountIsActive" className="text-xs font-semibold text-slate-700 dark:text-slate-300">
              Account is Active
            </label>
          </div>

          <div className="pt-3 border-t border-slate-100 dark:border-slate-800 flex justify-end gap-2">
            <button
              type="button"
              onClick={() => setIsEditModalOpen(false)}
              className="px-3 py-1.5 rounded-lg bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 text-xs font-semibold text-slate-600 dark:text-slate-300"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className="px-4 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-xs font-semibold text-white flex items-center gap-1.5 disabled:opacity-50"
            >
              {isSubmitting ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Save className="w-3.5 h-3.5" />}
              <span>Save Changes</span>
            </button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
