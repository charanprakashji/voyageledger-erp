import { UserRole } from "@prisma/client";

export interface SessionUser {
  id: string;
  email: string;
  name: string;
  role: UserRole;
  status: "ACTIVE" | "INACTIVE" | "SUSPENDED";
}

export const SESSION_COOKIE_NAME = "voyage_ledger_session";
export const SESSION_MAX_AGE_MS = 7 * 24 * 60 * 60 * 1000; // 7 days

/**
 * Validates and sanitizes redirect paths to strictly prevent Open Redirect attacks.
 * Rejects protocol-relative URLs (//), Windows backslash separators (/\\), external schemes (http:, https:, javascript:), etc.
 */
export function sanitizeRedirectUrl(url?: string | null): string {
  if (!url || typeof url !== "string") return "/";
  const trimmed = url.trim();
  if (
    !trimmed.startsWith("/") ||
    trimmed.startsWith("//") ||
    trimmed.startsWith("/\\") ||
    trimmed.includes("\\") ||
    trimmed.includes("://") ||
    trimmed.toLowerCase().startsWith("/javascript:") ||
    trimmed.toLowerCase().startsWith("/data:")
  ) {
    return "/";
  }
  return trimmed;
}
