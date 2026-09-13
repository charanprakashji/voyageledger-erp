"use client";

import React from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard,
  PlaneTakeoff,
  Users,
  Building2,
  ReceiptText,
  CreditCard,
  FileText,
  BarChart3,
  UserCheck,
  Settings,
  ShieldCheck,
  ChevronRight,
  FolderTree,
  CalendarDays,
} from "lucide-react";
import { cn } from "@/lib/utils";

export interface NavItem {
  name: string;
  href: string;
  icon: React.ElementType;
  badge?: string;
  category: "core" | "accounting" | "admin";
}

const navigationItems: NavItem[] = [
  // Core Operations
  { name: "Dashboard", href: "/", icon: LayoutDashboard, category: "core" },
  { name: "Customers", href: "/customers", icon: Users, badge: "Master", category: "core" },
  { name: "Suppliers", href: "/suppliers", icon: Building2, badge: "Master", category: "core" },
  { name: "Bookings", href: "/bookings", icon: PlaneTakeoff, category: "core" },

  // Accounting & General Ledger
  { name: "Chart of Accounts", href: "/accounting/chart-of-accounts", icon: FolderTree, badge: "GL", category: "accounting" },
  { name: "Accounting Periods", href: "/accounting/periods", icon: CalendarDays, category: "accounting" },
  { name: "Reconciliation", href: "/accounting/reconciliation", icon: ShieldCheck, badge: "AUDIT", category: "accounting" },
  { name: "Invoices", href: "/invoices", icon: FileText, category: "accounting" },
  { name: "Receipts", href: "/receipts", icon: ReceiptText, category: "accounting" },
  { name: "Supplier Bills", href: "/supplier-bills", icon: FileText, category: "accounting" },
  { name: "Supplier Payments", href: "/supplier-payments", icon: CreditCard, category: "accounting" },
  { name: "Expenses", href: "/expenses", icon: CreditCard, category: "accounting" },
  { name: "Financial Reports", href: "/reports", icon: BarChart3, category: "accounting" },

  // System Administration
  { name: "Users & RBAC", href: "/users", icon: UserCheck, category: "admin" },
  { name: "Company Settings", href: "/settings", icon: Settings, category: "admin" },
];

export function Sidebar() {
  const pathname = usePathname();

  const renderSection = (category: "core" | "accounting" | "admin", label: string) => {
    const items = navigationItems.filter((item) => item.category === category);
    return (
      <div className="mb-6">
        <p className="px-3 text-xs font-semibold uppercase tracking-wider text-slate-400 dark:text-slate-500 mb-2">
          {label}
        </p>
        <div className="space-y-1">
          {items.map((item) => {
            const Icon = item.icon;
            const isActive =
              item.href === "/"
                ? pathname === "/"
                : pathname?.startsWith(item.href);

            return (
              <Link
                key={item.name}
                href={item.href}
                className={cn(
                  "group flex items-center justify-between px-3 py-2 text-sm font-medium rounded-lg transition-all duration-150",
                  isActive
                    ? "bg-blue-600 text-white shadow-sm shadow-blue-500/20"
                    : "text-slate-700 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800/60"
                )}
              >
                <div className="flex items-center gap-3">
                  <Icon
                    className={cn(
                      "w-4 h-4 transition-transform group-hover:scale-110",
                      isActive ? "text-white" : "text-slate-500 dark:text-slate-400"
                    )}
                  />
                  <span>{item.name}</span>
                </div>
                {item.badge ? (
                  <span
                    className={cn(
                      "text-[10px] font-semibold px-2 py-0.5 rounded-full uppercase tracking-wider",
                      isActive
                        ? "bg-blue-500/40 text-white"
                        : "bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300"
                    )}
                  >
                    {item.badge}
                  </span>
                ) : (
                  <ChevronRight
                    className={cn(
                      "w-3.5 h-3.5 opacity-0 group-hover:opacity-100 transition-opacity",
                      isActive ? "text-blue-200" : "text-slate-400"
                    )}
                  />
                )}
              </Link>
            );
          })}
        </div>
      </div>
    );
  };

  return (
    <aside className="w-64 border-r border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-900 flex flex-col h-screen sticky top-0">
      {/* Brand Header */}
      <div className="h-16 px-6 flex items-center justify-between border-b border-slate-200 dark:border-slate-800">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-lg bg-gradient-to-tr from-blue-600 to-indigo-600 flex items-center justify-center text-white font-bold text-sm shadow-md shadow-blue-500/20">
            VL
          </div>
          <div>
            <h1 className="text-sm font-bold tracking-tight text-slate-900 dark:text-white leading-none">
              VoyageLedger
            </h1>
            <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">
              Afghanistan ERP (AFN)
            </p>
          </div>
        </div>
      </div>

      {/* Navigation Groups */}
      <div className="flex-1 overflow-y-auto px-4 py-4 scrollbar-thin">
        {renderSection("core", "Operations & Masters")}
        {renderSection("accounting", "General Ledger & Accounting")}
        {renderSection("admin", "Administration")}
      </div>

      {/* System Status Footer */}
      <div className="p-4 border-t border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-950/30">
        <div className="flex items-center gap-2 text-xs text-slate-600 dark:text-slate-400">
          <ShieldCheck className="w-4 h-4 text-emerald-500" />
          <div className="truncate">
            <p className="font-medium text-slate-800 dark:text-slate-200 truncate">
              Base: AFN (Afghani)
            </p>
            <p className="text-[10px] text-slate-400">GL Double-Entry Core</p>
          </div>
        </div>
      </div>
    </aside>
  );
}
