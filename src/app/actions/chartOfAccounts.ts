"use server";

import { db } from "@/lib/db";
import { requireRole, handleActionError } from "@/lib/auth";
import { recordAuditLog } from "@/lib/audit";
import { DEFAULT_CHART_OF_ACCOUNTS } from "@/lib/accounting";
import { revalidatePath } from "next/cache";
import { AccountType, NormalBalance } from "@prisma/client";

export interface AccountTreeNode {
  id: string;
  code: string;
  name: string;
  accountType: AccountType;
  normalBalance: NormalBalance;
  parentAccountId: string | null;
  currency: string;
  description: string | null;
  isActive: boolean;
  isSystemAccount: boolean;
  journalLineCount: number;
  children: AccountTreeNode[];
}

/**
 * Seeds standard initial Chart of Accounts if table is empty.
 */
export async function seedStandardCOA(): Promise<void> {
  const count = await db.chartOfAccount.count();
  if (count > 0) return;

  // First pass: create parent accounts (where parentCode is null)
  const codeToIdMap = new Map<string, string>();

  for (const item of DEFAULT_CHART_OF_ACCOUNTS) {
    if (!item.parentCode) {
      const created = await db.chartOfAccount.create({
        data: {
          code: item.code,
          name: item.name,
          accountType: item.accountType,
          normalBalance: item.normalBalance,
          isSystem: true,
          isActive: true,
          currency: "AFN",
        },
      });
      codeToIdMap.set(item.code, created.id);
    }
  }

  // Second pass: create child accounts linked to parent IDs
  for (const item of DEFAULT_CHART_OF_ACCOUNTS) {
    if (item.parentCode) {
      const parentId = codeToIdMap.get(item.parentCode) || null;
      const created = await db.chartOfAccount.create({
        data: {
          code: item.code,
          name: item.name,
          accountType: item.accountType,
          normalBalance: item.normalBalance,
          parentAccountId: parentId,
          isSystem: true,
          isActive: true,
          currency: "AFN",
        },
      });
      codeToIdMap.set(item.code, created.id);
    }
  }
}

/**
 * Retrieves Chart of Accounts organized into a hierarchical tree.
 */
export async function getChartOfAccountsTree(): Promise<AccountTreeNode[]> {
  try {
    await requireRole(["ADMIN", "MANAGER", "ACCOUNTANT", "AUDITOR"]);
    await seedStandardCOA();

    const allAccounts = await db.chartOfAccount.findMany({
      orderBy: { code: "asc" },
      include: {
        _count: {
          select: {
            journalLines: true,
          },
        },
      },
    });

    const nodeMap = new Map<string, AccountTreeNode>();

    for (const acc of allAccounts) {
      nodeMap.set(acc.id, {
        id: acc.id,
        code: acc.code,
        name: acc.name,
        accountType: acc.accountType,
        normalBalance: acc.normalBalance,
        parentAccountId: acc.parentAccountId,
        currency: acc.currency,
        description: acc.description,
        isActive: acc.isActive,
        isSystemAccount: acc.isSystem,
        journalLineCount: acc._count.journalLines,
        children: [],
      });
    }

    const rootNodes: AccountTreeNode[] = [];

    for (const node of nodeMap.values()) {
      if (node.parentAccountId && nodeMap.has(node.parentAccountId)) {
        nodeMap.get(node.parentAccountId)!.children.push(node);
      } else {
        rootNodes.push(node);
      }
    }

    return rootNodes;
  } catch (err) {
    console.error("Error in getChartOfAccountsTree:", err);
    return [];
  }
}

export async function createAccount(formData: FormData) {
  try {
    const user = await requireRole(["ADMIN", "ACCOUNTANT"]);

    const code = formData.get("code")?.toString().trim();
    const name = formData.get("name")?.toString().trim();
    const accountType = formData.get("accountType")?.toString() as AccountType;
    const normalBalance = formData.get("normalBalance")?.toString() as NormalBalance;
    const parentAccountId = formData.get("parentAccountId")?.toString().trim() || null;
    const currency = formData.get("currency")?.toString().trim() || "AFN";
    const description = formData.get("description")?.toString().trim() || null;

    if (!code || !name || !accountType || !normalBalance) {
      return { success: false, error: "Code, Name, Account Type, and Normal Balance are required." };
    }

    const existing = await db.chartOfAccount.findUnique({ where: { code } });
    if (existing) {
      return { success: false, error: `Account code '${code}' already exists.` };
    }

    const account = await db.chartOfAccount.create({
      data: {
        code,
        name,
        accountType,
        normalBalance,
        parentAccountId,
        currency,
        description,
        isSystem: false,
        isActive: true,
      },
    });

    await recordAuditLog({
      userId: user.id,
      action: "CREATE",
      entityName: "ChartOfAccount",
      entityId: account.id,
      newValues: account,
    });

    revalidatePath("/accounting/chart-of-accounts");
    return { success: true, account };
  } catch (err) {
    return handleActionError(err, "Failed to create account.");
  }
}

export async function updateAccount(id: string, formData: FormData) {
  try {
    const user = await requireRole(["ADMIN", "ACCOUNTANT"]);

    const name = formData.get("name")?.toString().trim();
    const parentAccountId = formData.get("parentAccountId")?.toString().trim() || null;
    const description = formData.get("description")?.toString().trim() || null;
    const isActive = formData.get("isActive") === "true";

    if (!name) {
      return { success: false, error: "Account Name is required." };
    }

    const existing = await db.chartOfAccount.findUnique({ where: { id } });
    if (!existing) {
      return { success: false, error: "Account not found." };
    }

    // Prevent setting self as parent
    if (parentAccountId === id) {
      return { success: false, error: "An account cannot be its own parent." };
    }

    const updated = await db.chartOfAccount.update({
      where: { id },
      data: {
        name,
        parentAccountId,
        description,
        isActive,
      },
    });

    await recordAuditLog({
      userId: user.id,
      action: "UPDATE",
      entityName: "ChartOfAccount",
      entityId: id,
      oldValues: existing,
      newValues: updated,
    });

    revalidatePath("/accounting/chart-of-accounts");
    return { success: true, account: updated };
  } catch (err) {
    return handleActionError(err, "Failed to update account.");
  }
}

/**
 * Safe Account Deletion / Deactivation:
 * 1. Never allow deletion of System Accounts (`isSystemAccount: true`).
 * 2. Never allow deletion of accounts with journal history.
 */
export async function deleteAccount(id: string) {
  try {
    const user = await requireRole(["ADMIN"]);

    const existing = await db.chartOfAccount.findUnique({
      where: { id },
      include: {
        _count: {
          select: {
            journalLines: true,
            subAccounts: true,
          },
        },
      },
    });

    if (!existing) {
      return { success: false, error: "Account not found." };
    }

    if (existing.isSystem) {
      return {
        success: false,
        error: `Cannot delete system account '${existing.code} - ${existing.name}'. Core system accounts are protected.`,
      };
    }

    if (existing._count.subAccounts > 0) {
      return {
        success: false,
        error: `Cannot delete account '${existing.code}' because it has ${existing._count.subAccounts} child sub-accounts. Please reassign or delete child accounts first.`,
      };
    }

    if (existing._count.journalLines > 0) {
      return {
        success: false,
        error: `Cannot permanently delete account '${existing.code} - ${existing.name}' because it contains ${existing._count.journalLines} posted journal lines. Deactivate the account instead to protect General Ledger auditability.`,
      };
    }

    await db.chartOfAccount.delete({ where: { id } });

    await recordAuditLog({
      userId: user.id,
      action: "DELETE",
      entityName: "ChartOfAccount",
      entityId: id,
      oldValues: existing,
    });

    revalidatePath("/accounting/chart-of-accounts");
    return { success: true };
  } catch (err) {
    return handleActionError(err, "Failed to delete account.");
  }
}
