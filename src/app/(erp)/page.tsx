import React from "react";
import Link from "next/link";
import {
  PlaneTakeoff,
  Users,
  Building2,
  FileText,
  ReceiptText,
  CreditCard,
  BarChart3,
  ShieldCheck,
  Scale,
  DollarSign,
  TrendingUp,
  FolderTree,
  ChevronRight,
  ArrowUpRight,
} from "lucide-react";
import { prisma } from "@/lib/prisma";
import Decimal from "decimal.js";

export const dynamic = "force-dynamic";

export default async function DashboardPage() {
  // Compute live General Ledger metrics dynamically from POSTED journal lines
  const postedLines = await prisma.journalLine.findMany({
    where: {
      journalEntry: {
        status: "POSTED",
      },
    },
    include: {
      account: true,
    },
  });

  let totalAr = new Decimal(0);
  let totalAp = new Decimal(0);
  let totalRevenue = new Decimal(0);
  let totalDirectCost = new Decimal(0);
  let totalOpex = new Decimal(0);
  let totalCashBank = new Decimal(0);

  for (const l of postedLines) {
    const d = new Decimal(l.debit.toString());
    const c = new Decimal(l.credit.toString());

    if (l.account.code === "1100") {
      totalAr = totalAr.plus(d.minus(c));
    } else if (l.account.code === "2010") {
      totalAp = totalAp.plus(c.minus(d));
    } else if (l.account.code === "1010" || l.account.code === "1020") {
      totalCashBank = totalCashBank.plus(d.minus(c));
    } else if (l.account.accountType === "REVENUE") {
      totalRevenue = totalRevenue.plus(c.minus(d));
    } else if (l.account.accountType === "EXPENSE") {
      if (l.account.code.startsWith("5")) {
        totalDirectCost = totalDirectCost.plus(d.minus(c));
      } else {
        totalOpex = totalOpex.plus(d.minus(c));
      }
    }
  }

  const grossProfit = totalRevenue.minus(totalDirectCost);
  const netProfit = grossProfit.minus(totalOpex);

  const [bookingCount, customerCount, supplierCount] = await Promise.all([
    prisma.booking.count(),
    prisma.customer.count(),
    prisma.supplier.count(),
  ]);

  const quickLinks = [
    { title: "Bookings", href: "/bookings", icon: PlaneTakeoff, count: `${bookingCount} Bookings` },
    { title: "Customers", href: "/customers", icon: Users, count: `${customerCount} Accounts` },
    { title: "Suppliers", href: "/suppliers", icon: Building2, count: `${supplierCount} Partners` },
    { title: "Invoices", href: "/invoices", icon: FileText, count: "AR Billing" },
    { title: "Receipts", href: "/receipts", icon: ReceiptText, count: "Collections" },
    { title: "Supplier Bills", href: "/supplier-bills", icon: FileText, count: "AP Payables" },
    { title: "Supplier Payments", href: "/supplier-payments", icon: CreditCard, count: "Disbursements" },
    { title: "Operating Expenses", href: "/expenses", icon: CreditCard, count: "Overheads" },
    { title: "Reconciliation", href: "/accounting/reconciliation", icon: ShieldCheck, count: "Audit Health" },
    { title: "Financial Reports", href: "/reports", icon: BarChart3, count: "Statements" },
  ];

  const fmt = (n: Decimal) => n.toFixed(2);

  return (
    <div className="space-y-8 max-w-7xl mx-auto">
      {/* Executive Banner */}
      <div className="p-6 rounded-2xl bg-gradient-to-r from-slate-900 via-indigo-950 to-slate-900 text-white shadow-xl border border-indigo-900/40 flex flex-col lg:flex-row lg:items-center lg:justify-between gap-6">
        <div className="space-y-2">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-indigo-500/20 text-indigo-300 border border-indigo-400/30 text-xs font-semibold">
            <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse"></span>
            Afghanistan ERP • General Ledger Live
          </div>
          <h1 className="text-2xl font-bold tracking-tight">
            VoyageLedger Executive Management Dashboard
          </h1>
          <p className="text-sm text-slate-300 max-w-2xl leading-relaxed">
            Internal Travel Management & Accounting ERP with AFN base reporting, multi-currency conversion, and dynamic double-entry audit trails.
          </p>
        </div>

        <div className="flex flex-col sm:flex-row gap-3 text-xs font-mono">
          <div className="p-3 bg-white/10 rounded-xl border border-white/10 text-center">
            <p className="text-slate-400 text-[10px] uppercase font-bold">Base Currency</p>
            <p className="text-emerald-400 font-bold text-sm">AFN (Afghani)</p>
          </div>
          <div className="p-3 bg-white/10 rounded-xl border border-white/10 text-center">
            <p className="text-slate-400 text-[10px] uppercase font-bold">GL Single Source</p>
            <p className="text-indigo-300 font-bold text-sm">100% POSTED</p>
          </div>
        </div>
      </div>

      {/* Live Financial Statement KPIs */}
      <div>
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-base font-bold text-slate-900">
            Real-Time General Ledger Financial Metrics
          </h2>
          <span className="text-xs text-slate-500 font-mono">Precision: SQL NUMERIC(15,2)</span>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="p-5 bg-white rounded-xl border border-slate-200 shadow-sm">
            <div className="flex justify-between items-start">
              <div>
                <p className="text-xs font-bold text-slate-500 uppercase">Realized Revenue (4xxx)</p>
                <p className="text-2xl font-mono font-bold text-slate-900 mt-1">
                  {fmt(totalRevenue)} AFN
                </p>
                <p className="text-xs text-emerald-600 font-medium mt-1">Posted Customer Invoices</p>
              </div>
              <div className="p-2 rounded-lg bg-emerald-50 text-emerald-600">
                <TrendingUp className="w-5 h-5" />
              </div>
            </div>
          </div>

          <div className="p-5 bg-white rounded-xl border border-slate-200 shadow-sm">
            <div className="flex justify-between items-start">
              <div>
                <p className="text-xs font-bold text-slate-500 uppercase">Gross Profit (Margin)</p>
                <p className="text-2xl font-mono font-bold text-indigo-700 mt-1">
                  {fmt(grossProfit)} AFN
                </p>
                <p className="text-xs text-slate-500 mt-1">
                  Direct Costs: {fmt(totalDirectCost)} AFN
                </p>
              </div>
              <div className="p-2 rounded-lg bg-indigo-50 text-indigo-600">
                <Scale className="w-5 h-5" />
              </div>
            </div>
          </div>

          <div className="p-5 bg-white rounded-xl border border-slate-200 shadow-sm">
            <div className="flex justify-between items-start">
              <div>
                <p className="text-xs font-bold text-slate-500 uppercase">Accounts Receivable (1110)</p>
                <p className="text-2xl font-mono font-bold text-blue-600 mt-1">
                  {fmt(totalAr)} AFN
                </p>
                <p className="text-xs text-slate-500 mt-1">Customer Outstanding</p>
              </div>
              <div className="p-2 rounded-lg bg-blue-50 text-blue-600">
                <FileText className="w-5 h-5" />
              </div>
            </div>
          </div>

          <div className="p-5 bg-white rounded-xl border border-slate-200 shadow-sm">
            <div className="flex justify-between items-start">
              <div>
                <p className="text-xs font-bold text-slate-500 uppercase">Accounts Payable (2010)</p>
                <p className="text-2xl font-mono font-bold text-rose-600 mt-1">
                  {fmt(totalAp)} AFN
                </p>
                <p className="text-xs text-slate-500 mt-1">Supplier Outstanding</p>
              </div>
              <div className="p-2 rounded-lg bg-rose-50 text-rose-600">
                <Building2 className="w-5 h-5" />
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Quick Navigation Modules */}
      <div>
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-base font-bold text-slate-900">Operational & Financial Modules</h2>
          <Link
            href="/accounting/reconciliation"
            className="text-xs font-bold text-indigo-600 hover:text-indigo-800 flex items-center gap-1"
          >
            Audit Books & Reconciliation <ArrowUpRight className="w-3.5 h-3.5" />
          </Link>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
          {quickLinks.map((ql) => {
            const Icon = ql.icon;
            return (
              <Link
                key={ql.title}
                href={ql.href}
                className="group p-4 bg-white rounded-xl border border-slate-200 hover:border-indigo-500 hover:shadow-sm transition-all flex flex-col justify-between"
              >
                <div className="flex items-center justify-between mb-2">
                  <div className="w-8 h-8 rounded-lg bg-slate-100 flex items-center justify-center text-slate-700 group-hover:bg-indigo-600 group-hover:text-white transition-colors">
                    <Icon className="w-4 h-4" />
                  </div>
                  <ChevronRight className="w-4 h-4 text-slate-300 group-hover:text-indigo-600 transition-colors" />
                </div>
                <div>
                  <h3 className="text-xs font-bold text-slate-900 group-hover:text-indigo-600 transition-colors">
                    {ql.title}
                  </h3>
                  <p className="text-[11px] text-slate-400 mt-0.5">{ql.count}</p>
                </div>
              </Link>
            );
          })}
        </div>
      </div>
    </div>
  );
}
