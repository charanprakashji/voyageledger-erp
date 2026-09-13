import React from "react";
import { Header } from "@/components/layout/Header";
import Link from "next/link";
import {
  Scale,
  TrendingUp,
  Landmark,
  PieChart,
  Building2,
  Users,
  ChevronRight,
  ShieldCheck,
  BookOpen,
  CalendarClock,
  Coins,
  Receipt,
  BarChart,
  DollarSign,
} from "lucide-react";

export const dynamic = "force-dynamic";

export default function ReportsHubPage() {
  const coreReports = [
    {
      title: "General Ledger Explorer",
      description: "Complete chronological audit trail with multi-dimensional filtering and running balance calculations.",
      href: "/reports/general-ledger",
      icon: BookOpen,
      color: "from-blue-600 to-indigo-600",
      badge: "Full Audit",
    },
    {
      title: "Trial Balance",
      description: "Complete list of all active ledger accounts with debit/credit balances and balance equality check.",
      href: "/reports/trial-balance",
      icon: Scale,
      color: "from-cyan-600 to-blue-600",
      badge: "Core GL",
    },
    {
      title: "Profit & Loss (P&L)",
      description: "Operating revenues, direct service costs, gross margin, operating expenses, and net profit in AFN.",
      href: "/reports/profit-loss",
      icon: TrendingUp,
      color: "from-emerald-600 to-teal-600",
      badge: "Income Statement",
    },
    {
      title: "Balance Sheet",
      description: "Financial position: Assets = Liabilities + Equity with automated current period earnings reconciliation.",
      href: "/reports/balance-sheet",
      icon: Landmark,
      color: "from-indigo-600 to-purple-600",
      badge: "Position Statement",
    },
  ];

  const operationalReports = [
    {
      title: "Accounts Receivable (AR) Aging",
      description: "Outstanding customer invoice balances categorized into 30/60/90/120+ day aging buckets.",
      href: "/reports/ar-aging",
      icon: CalendarClock,
      color: "from-amber-600 to-orange-600",
      badge: "Receivables",
    },
    {
      title: "Accounts Payable (AP) Aging",
      description: "Outstanding supplier bill payables grouped by due date aging intervals, reconciled to GL 2010.",
      href: "/reports/ap-aging",
      icon: CalendarClock,
      color: "from-rose-600 to-pink-600",
      badge: "Payables",
    },
    {
      title: "Booking Profitability",
      description: "Realized gross profit and margin percentage per travel booking derived strictly from posted GL entries.",
      href: "/reports/booking-profitability",
      icon: PieChart,
      color: "from-emerald-600 to-green-600",
      badge: "Costing",
    },
    {
      title: "Customer Statement",
      description: "Detailed running ledger of customer invoices, receipts, advance allocations, and balances.",
      href: "/reports/customer-statement",
      icon: Users,
      color: "from-blue-600 to-cyan-600",
      badge: "AR Ledger",
    },
    {
      title: "Supplier Statement",
      description: "Detailed chronological transaction ledger for airline, hotel, and visa suppliers derived from GL journal lines.",
      href: "/reports/supplier-statement",
      icon: Building2,
      color: "from-purple-600 to-indigo-600",
      badge: "AP Ledger",
    },
  ];

  const analysisReports = [
    {
      title: "Cash & Bank Statement",
      description: "Liquidity breakdown across physical cash and corporate bank accounts with multi-currency tracking.",
      href: "/reports/cash-bank",
      icon: Coins,
      color: "from-teal-600 to-emerald-600",
      badge: "Liquidity",
    },
    {
      title: "Foreign Exchange (FX) Report",
      description: "Realized currency fluctuation gains (7010) and losses (8010) across multi-currency settlements.",
      href: "/reports/fx",
      icon: DollarSign,
      color: "from-amber-600 to-yellow-600",
      badge: "Realized FX",
    },
    {
      title: "Tax Audit & Compliance",
      description: "Configurable Afghan sales output tax liability (2030) vs recoverable input tax asset (1210).",
      href: "/reports/tax",
      icon: Receipt,
      color: "from-red-600 to-rose-600",
      badge: "Tax Audit",
    },
    {
      title: "Revenue Analysis",
      description: "Realized revenue streams categorized by service line, customer volume, and sales agents.",
      href: "/reports/revenue-analysis",
      icon: BarChart,
      color: "from-blue-600 to-teal-600",
      badge: "Sales Analytics",
    },
    {
      title: "Expense & Cost Analysis",
      description: "Comprehensive breakdown of direct service costs (5xxx) vs operating overheads (6xxx).",
      href: "/reports/expense-analysis",
      icon: TrendingUp,
      color: "from-orange-600 to-red-600",
      badge: "Cost Analytics",
    },
  ];

  const renderSection = (title: string, subtitle: string, items: typeof coreReports) => (
    <div className="space-y-4">
      <div>
        <h3 className="text-lg font-bold text-slate-900">{title}</h3>
        <p className="text-xs text-slate-500">{subtitle}</p>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
        {items.map((r) => {
          const Icon = r.icon;
          return (
            <Link
              key={r.title}
              href={r.href}
              className="group bg-white p-5 rounded-xl border border-slate-200 hover:border-indigo-500 hover:shadow-md transition-all flex flex-col justify-between"
            >
              <div>
                <div className="flex items-start justify-between mb-3">
                  <div className={`w-10 h-10 rounded-lg bg-gradient-to-tr ${r.color} flex items-center justify-center text-white shadow-sm`}>
                    <Icon className="w-5 h-5" />
                  </div>
                  <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-slate-100 text-slate-700">
                    {r.badge}
                  </span>
                </div>
                <h4 className="text-base font-bold text-slate-900 group-hover:text-indigo-600 transition-colors flex items-center gap-1">
                  {r.title}
                  <ChevronRight className="w-3.5 h-3.5 opacity-0 group-hover:opacity-100 transition-opacity transform group-hover:translate-x-0.5" />
                </h4>
                <p className="text-xs text-slate-500 mt-1.5 leading-relaxed">
                  {r.description}
                </p>
              </div>
            </Link>
          );
        })}
      </div>
    </div>
  );

  return (
    <div>
      <Header title="Financial Statements & Reports Catalog" userRole="ADMIN" />
      <div className="p-8 max-w-7xl mx-auto space-y-10">
        <div className="flex items-center justify-between pb-6 border-b border-slate-200">
          <div>
            <h2 className="text-2xl font-bold text-slate-900">
              Executive Financial Reporting Hub
            </h2>
            <p className="text-sm text-slate-500 mt-1">
              Derived dynamically from POSTED double-entry General Ledger transactions.
            </p>
          </div>
          <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-emerald-50 text-emerald-700 border border-emerald-200 text-xs font-semibold">
            <ShieldCheck className="w-4 h-4" /> Single Source of Truth: GL
          </div>
        </div>

        {renderSection("Core Financial Statements", "Primary statutory and GAAP financial statements", coreReports)}
        {renderSection("Subsidiary & Operational Ledgers", "Customer, supplier, aging, and booking profitability analysis", operationalReports)}
        {renderSection("Treasury, Tax & Analytics", "Liquidity, FX gains/losses, Afghan tax audit, and overheads", analysisReports)}
      </div>
    </div>
  );
}
