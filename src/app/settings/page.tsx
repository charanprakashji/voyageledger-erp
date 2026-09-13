import React from "react";
import { getCompanySettings } from "@/app/actions/settings";
import { db } from "@/lib/db";
import { formatDateTime } from "@/lib/accounting";
import { Badge } from "@/components/ui/Badge";
import {
  Settings,
  Clock,
} from "lucide-react";
import { SettingsForm } from "./SettingsForm";

export const dynamic = "force-dynamic";

export default async function SettingsPage() {
  let settings: any = {
    companyName: "Ariana Horizon Travel & Tourism",
    province: "Kabul",
    city: "Kabul",
    country: "Afghanistan",
    defaultCurrency: "AFN",
    supportedCurrencies: ["AFN", "USD", "EUR", "AED"],
    invoicePrefix: "INV-",
    receiptPrefix: "RCT-",
  };
  let auditLogs: any[] = [];

  try {
    const [fetchedSettings, fetchedLogs] = await Promise.all([
      getCompanySettings(),
      db.auditLog.findMany({
        take: 15,
        orderBy: { createdAt: "desc" },
        include: {
          user: {
            select: { name: true, email: true, role: true },
          },
        },
      }),
    ]);
    if (fetchedSettings) settings = fetchedSettings;
    if (fetchedLogs) auditLogs = fetchedLogs;
  } catch (err) {
    // Graceful fallback when DB not connected
  }

  return (
    <div className="space-y-6 max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1">
            <Settings className="w-4 h-4 text-slate-600 dark:text-slate-400" />
            <span>Administration</span>
          </div>
          <h1 className="text-2xl font-bold text-slate-900 dark:text-white tracking-tight">
            Company Settings & System Profile
          </h1>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
            Configure Afghanistan business identity, currency defaults, and review immutable audit logs.
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left 2 Cols: Settings Form */}
        <div className="lg:col-span-2">
          <SettingsForm initialSettings={settings} />
        </div>

        {/* Right Col: Live Audit Log Stream */}
        <div className="space-y-6">
          <div className="p-5 rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-sm space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-slate-800">
              <div className="flex items-center gap-2">
                <Clock className="w-4 h-4 text-blue-500" />
                <h3 className="font-bold text-sm text-slate-900 dark:text-white">
                  Audit Trail Stream
                </h3>
              </div>
              <Badge variant="info">Immutable</Badge>
            </div>

            <div className="space-y-3">
              {auditLogs.length === 0 ? (
                <p className="text-xs text-slate-400 py-4 text-center">
                  No audit logs recorded yet.
                </p>
              ) : (
                auditLogs.map((log) => (
                  <div
                    key={log.id}
                    className="p-3 rounded-xl bg-slate-50 dark:bg-slate-800/50 border border-slate-100 dark:border-slate-800 text-xs space-y-1"
                  >
                    <div className="flex items-center justify-between">
                      <span className="font-bold text-slate-800 dark:text-slate-200">
                        {log.action} {log.entityName}
                      </span>
                      <span className="text-[10px] text-slate-400">
                        {formatDateTime(log.createdAt)}
                      </span>
                    </div>
                    <p className="text-[11px] text-slate-500">
                      By: <span className="font-medium text-slate-700 dark:text-slate-300">{log.user?.name || "System"}</span>{" "}
                      {log.user?.role ? `(${log.user.role})` : ""}
                    </p>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
