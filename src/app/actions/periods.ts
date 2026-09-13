"use server";

import { db } from "@/lib/db";
import { requireRole } from "@/lib/auth";
import { recordAuditLog } from "@/lib/audit";
import { revalidatePath } from "next/cache";

export async function getAccountingPeriods() {
  return db.accountingPeriod.findMany({
    orderBy: { startDate: "desc" },
    include: {
      lockedBy: {
        select: { id: true, name: true, email: true },
      },
      _count: {
        select: {
          journals: true,
        },
      },
    },
  });
}

/**
 * Validates that an accounting entry date does not fall into a locked accounting period.
 * Throws an error if the period is locked.
 */
export async function assertPeriodOpen(entryDate: Date): Promise<void> {
  const lockedPeriod = await db.accountingPeriod.findFirst({
    where: {
      isLocked: true,
      startDate: { lte: entryDate },
      endDate: { gte: entryDate },
    },
  });

  if (lockedPeriod) {
    throw new Error(
      `ACCOUNTING PERIOD LOCKED: The date ${entryDate.toISOString().split("T")[0]} belongs to locked period '${lockedPeriod.name}' (${lockedPeriod.financialYear}). Financial entries cannot be posted into locked periods.`
    );
  }
}

export async function createAccountingPeriod(formData: FormData) {
  const user = await requireRole(["ADMIN", "ACCOUNTANT"]);

  const name = formData.get("name")?.toString().trim();
  const financialYear = formData.get("financialYear")?.toString().trim();
  const startDateStr = formData.get("startDate")?.toString();
  const endDateStr = formData.get("endDate")?.toString();

  if (!name || !financialYear || !startDateStr || !endDateStr) {
    return { success: false, error: "Name, Financial Year, Start Date, and End Date are required." };
  }

  const startDate = new Date(startDateStr);
  const endDate = new Date(endDateStr);

  if (startDate >= endDate) {
    return { success: false, error: "Start Date must be before End Date." };
  }

  const period = await db.accountingPeriod.create({
    data: {
      name,
      financialYear,
      startDate,
      endDate,
      isLocked: false,
    },
  });

  await recordAuditLog({
    userId: user.id,
    action: "CREATE",
    entityName: "AccountingPeriod",
    entityId: period.id,
    newValues: period,
  });

  revalidatePath("/accounting/periods");
  return { success: true, period };
}

/**
 * Locks an accounting period to prevent further journal entries.
 */
export async function lockAccountingPeriod(periodId: string) {
  const user = await requireRole(["ADMIN", "MANAGER", "ACCOUNTANT"]);

  const existing = await db.accountingPeriod.findUnique({ where: { id: periodId } });
  if (!existing) {
    return { success: false, error: "Accounting Period not found." };
  }

  if (existing.isLocked) {
    return { success: false, error: "Accounting Period is already locked." };
  }

  const updated = await db.accountingPeriod.update({
    where: { id: periodId },
    data: {
      isLocked: true,
      lockedAt: new Date(),
      lockedById: user.id,
    },
  });

  await recordAuditLog({
    userId: user.id,
    action: "LOCK_PERIOD",
    entityName: "AccountingPeriod",
    entityId: periodId,
    oldValues: existing,
    newValues: updated,
  });

  revalidatePath("/accounting/periods");
  return { success: true, period: updated };
}

/**
 * Unlocks an accounting period.
 * CRITICAL RULE: Strictly ONLY `ADMIN` role is authorized to unlock an accounting period!
 */
export async function unlockAccountingPeriod(periodId: string) {
  const user = await requireRole(["ADMIN"]); // Only ADMIN!

  const existing = await db.accountingPeriod.findUnique({ where: { id: periodId } });
  if (!existing) {
    return { success: false, error: "Accounting Period not found." };
  }

  if (!existing.isLocked) {
    return { success: false, error: "Accounting Period is not locked." };
  }

  const updated = await db.accountingPeriod.update({
    where: { id: periodId },
    data: {
      isLocked: false,
      lockedAt: null,
      lockedById: null,
    },
  });

  await recordAuditLog({
    userId: user.id,
    action: "UNLOCK_PERIOD",
    entityName: "AccountingPeriod",
    entityId: periodId,
    oldValues: existing,
    newValues: updated,
  });

  revalidatePath("/accounting/periods");
  return { success: true, period: updated };
}
