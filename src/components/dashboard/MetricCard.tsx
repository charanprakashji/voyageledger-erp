import React from "react";
import { LucideIcon, TrendingUp, TrendingDown } from "lucide-react";
import { cn } from "@/lib/utils";

interface MetricCardProps {
  title: string;
  amount: string;
  change?: string;
  isPositive?: boolean;
  subtext: string;
  icon: LucideIcon;
  variant?: "blue" | "emerald" | "amber" | "indigo" | "rose";
}

const variantStyles = {
  blue: "bg-blue-50 text-blue-600 dark:bg-blue-950/40 dark:text-blue-400",
  emerald: "bg-emerald-50 text-emerald-600 dark:bg-emerald-950/40 dark:text-emerald-400",
  amber: "bg-amber-50 text-amber-600 dark:bg-amber-950/40 dark:text-amber-400",
  indigo: "bg-indigo-50 text-indigo-600 dark:bg-indigo-950/40 dark:text-indigo-400",
  rose: "bg-rose-50 text-rose-600 dark:bg-rose-950/40 dark:text-rose-400",
};

export function MetricCard({
  title,
  amount,
  change,
  isPositive = true,
  subtext,
  icon: Icon,
  variant = "blue",
}: MetricCardProps) {
  return (
    <div className="p-5 rounded-xl border border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-900 shadow-sm transition-all hover:shadow-md">
      <div className="flex items-center justify-between">
        <p className="text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">
          {title}
        </p>
        <div className={cn("p-2 rounded-lg", variantStyles[variant])}>
          <Icon className="w-4 h-4" />
        </div>
      </div>

      <div className="mt-4 flex items-baseline gap-2">
        <h3 className="text-2xl font-bold tracking-tight text-slate-900 dark:text-white">
          {amount}
        </h3>
        {change && (
          <span
            className={cn(
              "flex items-center text-xs font-medium",
              isPositive
                ? "text-emerald-600 dark:text-emerald-400"
                : "text-rose-600 dark:text-rose-400"
            )}
          >
            {isPositive ? (
              <TrendingUp className="w-3 h-3 mr-0.5" />
            ) : (
              <TrendingDown className="w-3 h-3 mr-0.5" />
            )}
            {change}
          </span>
        )}
      </div>

      <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">{subtext}</p>
    </div>
  );
}
