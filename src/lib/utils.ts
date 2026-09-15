import { type ClassValue, clsx } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatDate(date: Date | string | null | undefined): string {
  if (!date) return "-";
  const d = typeof date === "string" ? new Date(date) : date;
  return d.toLocaleDateString("en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

export function formatDateTime(date: Date | string | null | undefined): string {
  if (!date) return "-";
  const d = typeof date === "string" ? new Date(date) : date;
  return d.toLocaleDateString("en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

/**
 * Safely revalidates a Next.js path without throwing when invoked
 * in non-HTTP CLI test runners or background script contexts.
 */
export function safeRevalidatePath(path: string, type?: "page" | "layout"): void {
  try {
    // Dynamic require/import to prevent SSR issues
    const { revalidatePath } = require("next/cache");
    revalidatePath(path, type);
  } catch {
    // Gracefully no-op in automated test environments
  }
}
