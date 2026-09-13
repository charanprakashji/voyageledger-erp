import React from "react";
import { getChartOfAccountsTree } from "@/app/actions/chartOfAccounts";
import { FolderTree } from "lucide-react";
import { ChartOfAccountsClient } from "./ChartOfAccountsClient";

export const dynamic = "force-dynamic";

export default async function ChartOfAccountsPage() {
  let tree: any[] = [];
  try {
    tree = await getChartOfAccountsTree();
  } catch (err) {
    tree = [];
  }

  return (
    <div className="space-y-6 max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1">
            <FolderTree className="w-4 h-4 text-emerald-600" />
            <span>General Ledger</span>
          </div>
          <h1 className="text-2xl font-bold text-slate-900 dark:text-white tracking-tight">
            Chart of Accounts
          </h1>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
            Hierarchical General Ledger accounts structure for Afghanistan operations (Base Currency: AFN).
          </p>
        </div>
      </div>

      {/* Interactive Hierarchical Tree Client Component */}
      <ChartOfAccountsClient initialTree={tree} />
    </div>
  );
}
