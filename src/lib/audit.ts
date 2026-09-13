import { db } from "@/lib/db";
import { Prisma } from "@prisma/client";

export interface AuditLogPayload {
  userId?: string | null;
  action:
    | "CREATE"
    | "UPDATE"
    | "DELETE"
    | "CANCEL"
    | "REVERSE"
    | "LOGIN"
    | "LOGOUT"
    | "LOCK_PERIOD"
    | "UNLOCK_PERIOD"
    | "EXPORT"
    | "CONVERT_QUOTATION"
    | "STATUS_CHANGE"
    | "UPLOAD_DOCUMENT";
  entityName:
    | "User"
    | "CompanySetting"
    | "Customer"
    | "Supplier"
    | "ChartOfAccount"
    | "AccountingPeriod"
    | "TaxConfiguration"
    | "JournalEntry"
    | "Booking"
    | "Passenger"
    | "BookingServiceItem"
    | "DocumentAttachment"
    | "Invoice"
    | "Receipt"
    | "SupplierBill"
    | "SupplierPayment"
    | "Expense";
  entityId: string;
  oldValues?: Record<string, unknown> | null;
  newValues?: Record<string, unknown> | null;
  ipAddress?: string;
  userAgent?: string;
}

// Sensitive field keys that must never appear in audit logs
const SENSITIVE_KEYS = new Set([
  "password",
  "passwordHash",
  "token",
  "secret",
  "key",
  "accessToken",
  "refreshToken",
  "apiKey",
  "credentials",
]);

/**
 * Recursively sanitizes data payloads before persisting to audit logs.
 */
function sanitizePayload(obj: unknown): unknown {
  if (obj === null || obj === undefined) return obj;

  if (Array.isArray(obj)) {
    return obj.map(sanitizePayload);
  }

  if (typeof obj === "object") {
    const sanitized: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(obj as Record<string, unknown>)) {
      if (SENSITIVE_KEYS.has(key)) {
        sanitized[key] = "[REDACTED]";
      } else if (typeof value === "object" && value !== null) {
        sanitized[key] = sanitizePayload(value);
      } else {
        sanitized[key] = value;
      }
    }
    return sanitized;
  }

  return obj;
}

/**
 * Records an immutable audit log entry in PostgreSQL.
 */
export async function recordAuditLog(payload: AuditLogPayload): Promise<void> {
  try {
    const sanitizedOld = payload.oldValues
      ? (sanitizePayload(payload.oldValues) as Prisma.InputJsonValue)
      : undefined;

    const sanitizedNew = payload.newValues
      ? (sanitizePayload(payload.newValues) as Prisma.InputJsonValue)
      : undefined;

    await db.auditLog.create({
      data: {
        userId: payload.userId || null,
        action: payload.action,
        entityName: payload.entityName,
        entityId: payload.entityId,
        oldValues: sanitizedOld,
        newValues: sanitizedNew,
        ipAddress: payload.ipAddress,
        userAgent: payload.userAgent,
      },
    });
  } catch (error) {
    // Non-blocking catch to ensure audit logging errors do not crash critical business transactions
    console.error("Failed to record audit log:", error);
  }
}
