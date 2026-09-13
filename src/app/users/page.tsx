import React from "react";
import { getUsers } from "@/app/actions/users";
import { UserCheck } from "lucide-react";
import { UsersClient } from "./UsersClient";

export const dynamic = "force-dynamic";

export default async function UsersPage() {
  let users: any[] = [];
  try {
    users = await getUsers();
  } catch (err) {
    users = [];
  }

  return (
    <div className="space-y-6 max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1">
            <UserCheck className="w-4 h-4 text-blue-600" />
            <span>Administration</span>
          </div>
          <h1 className="text-2xl font-bold text-slate-900 dark:text-white tracking-tight">
            Users & Role-Based Access Control (RBAC)
          </h1>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
            Manage system access for Admins, Managers, Accountants, Travel Agents, and Auditors.
          </p>
        </div>
      </div>

      <UsersClient initialUsers={users} />
    </div>
  );
}
