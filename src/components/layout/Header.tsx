"use client";

import React, { useEffect, useState } from "react";
import { Search, Bell, Shield, LogOut } from "lucide-react";
import { logoutAction } from "@/app/actions/auth";

interface HeaderProps {
  title?: string;
  userRole?: string;
}

export function Header({ title, userRole }: HeaderProps = {}) {
  const [user, setUser] = useState<{ name: string; role: string } | null>({
    name: "System Administrator",
    role: userRole || "ADMIN",
  });

  return (
    <header className="h-16 px-8 border-b border-slate-200 bg-white/80 dark:border-slate-800 dark:bg-slate-900/80 backdrop-blur-md flex items-center justify-between sticky top-0 z-20">
      {/* Search Bar */}
      <div className="flex items-center gap-3 w-96">
        <div className="relative w-full">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            placeholder="Search customers, suppliers, accounts, periods..."
            className="w-full bg-slate-100 dark:bg-slate-800 border-none rounded-lg pl-9 pr-4 py-2 text-xs text-slate-900 dark:text-white placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500/50"
          />
        </div>
      </div>

      {/* Right Controls */}
      <div className="flex items-center gap-4">
        {/* Currency Badge */}
        <div className="hidden sm:flex items-center gap-1.5 px-2.5 py-1 bg-emerald-50 border border-emerald-200 dark:bg-emerald-950/40 dark:border-emerald-800/60 rounded-md text-emerald-700 dark:text-emerald-400 text-xs font-medium">
          <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse"></span>
          <span>Currency: AFN (؋)</span>
        </div>

        {/* Audit Status */}
        <div className="hidden md:flex items-center gap-1 px-2.5 py-1 bg-blue-50 border border-blue-200 dark:bg-blue-950/40 dark:border-blue-800/60 rounded-md text-blue-700 dark:text-blue-400 text-xs font-medium">
          <Shield className="w-3.5 h-3.5" />
          <span>General Ledger Core</span>
        </div>

        {/* User Profile & Logout */}
        <div className="flex items-center gap-3 pl-3 border-l border-slate-200 dark:border-slate-800">
          <div className="w-8 h-8 rounded-full bg-slate-200 dark:bg-slate-700 flex items-center justify-center font-bold text-xs text-slate-700 dark:text-slate-200">
            {user?.name.slice(0, 2).toUpperCase() || "AD"}
          </div>
          <div className="hidden sm:block text-left">
            <p className="text-xs font-semibold text-slate-900 dark:text-white leading-tight">
              {user?.name || "Administrator"}
            </p>
            <p className="text-[10px] text-blue-600 dark:text-blue-400 font-bold">
              {user?.role || "ADMIN"}
            </p>
          </div>

          <form action={logoutAction}>
            <button
              type="submit"
              title="Sign Out"
              className="p-1.5 rounded-lg text-slate-400 hover:text-rose-600 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
            >
              <LogOut className="w-4 h-4" />
            </button>
          </form>
        </div>
      </div>
    </header>
  );
}
