"use server";

import prisma from "@/lib/prisma";
import { requireRole, handleActionError } from "@/lib/auth";
import { recordAuditLog } from "@/lib/audit";
import { UserRole, ShareholderStatus } from "@prisma/client";
import { safeRevalidatePath } from "@/lib/utils";
import Decimal from "decimal.js";

export interface ShareholderFilterParams {
  search?: string;
  status?: ShareholderStatus | "ALL";
  page?: number;
  limit?: number;
}

export interface CreateShareholderInput {
  name: string;
  code?: string;
  nationalId?: string;
  contactPerson?: string;
  email?: string;
  phone?: string;
  address?: string;
  sharePercentage?: number | string | Decimal;
  capitalContribution?: number | string | Decimal;
  currency?: string;
  status?: ShareholderStatus;
  notes?: string;
}

export interface UpdateShareholderInput extends Partial<CreateShareholderInput> {
  id: string;
}

/**
 * Fetch paginated list of shareholders
 * Access: ADMIN, MANAGER, ACCOUNTANT, AUDITOR (TRAVEL_AGENT disallowed)
 */
export async function getShareholders(params: ShareholderFilterParams = {}) {
  try {
    const currentUser = await requireRole([
      UserRole.ADMIN,
      UserRole.MANAGER,
      UserRole.ACCOUNTANT,
      UserRole.AUDITOR,
    ]);

    const { search, status, page = 1, limit = 20 } = params;
    const skip = (Math.max(1, page) - 1) * Math.min(100, Math.max(1, limit));
    const take = Math.min(100, Math.max(1, limit));

    const where: any = {};

    if (status && status !== "ALL") {
      where.status = status;
    }

    if (search && search.trim()) {
      const s = search.trim();
      where.OR = [
        { name: { contains: s, mode: "insensitive" } },
        { code: { contains: s, mode: "insensitive" } },
        { email: { contains: s, mode: "insensitive" } },
        { phone: { contains: s, mode: "insensitive" } },
        { nationalId: { contains: s, mode: "insensitive" } },
      ];
    }

    const [shareholders, totalCount] = await Promise.all([
      prisma.shareholder.findMany({
        where,
        orderBy: { createdAt: "desc" },
        skip,
        take,
      }),
      prisma.shareholder.count({ where }),
    ]);

    const isPrivileged = currentUser.role === UserRole.ADMIN || currentUser.role === UserRole.MANAGER;

    return {
      success: true,
      data: shareholders.map((sh) => ({
        ...sh,
        // Sensitive Tazkira / National ID: only fully exposed to ADMIN/MANAGER
        nationalId: isPrivileged
          ? sh.nationalId
          : sh.nationalId
          ? `${sh.nationalId.slice(0, 4)}****${sh.nationalId.slice(-4)}`
          : null,
        sharePercentage: Number(sh.sharePercentage),
        capitalContribution: Number(sh.capitalContribution),
      })),
      pagination: {
        total: totalCount,
        page,
        limit: take,
        totalPages: Math.ceil(totalCount / take),
      },
    };
  } catch (error: any) {
    const safeErr = handleActionError(error, "Failed to load shareholders");
    return {
      success: false,
      error: safeErr.error,
      data: [],
      pagination: { total: 0, page: 1, limit: 20, totalPages: 0 },
    };
  }
}

/**
 * Get single shareholder by ID
 * Access: ADMIN, MANAGER, ACCOUNTANT, AUDITOR (TRAVEL_AGENT disallowed)
 */
export async function getShareholderById(id: string) {
  try {
    const currentUser = await requireRole([
      UserRole.ADMIN,
      UserRole.MANAGER,
      UserRole.ACCOUNTANT,
      UserRole.AUDITOR,
    ]);

    if (!id || typeof id !== "string") {
      return { success: false, error: "Valid Shareholder ID is required" };
    }

    const shareholder = await prisma.shareholder.findUnique({
      where: { id },
    });

    if (!shareholder) {
      return { success: false, error: "Shareholder record not found" };
    }

    const auditLogs = await prisma.auditLog.findMany({
      where: { entityName: "Shareholder", entityId: id },
      include: { user: { select: { name: true, role: true } } },
      orderBy: { createdAt: "desc" },
    });

    const isPrivileged = currentUser.role === UserRole.ADMIN || currentUser.role === UserRole.MANAGER;

    return {
      success: true,
      data: {
        ...shareholder,
        nationalId: isPrivileged
          ? shareholder.nationalId
          : shareholder.nationalId
          ? `${shareholder.nationalId.slice(0, 4)}****${shareholder.nationalId.slice(-4)}`
          : null,
        sharePercentage: Number(shareholder.sharePercentage),
        capitalContribution: Number(shareholder.capitalContribution),
        auditLogs,
      },
    };
  } catch (error: any) {
    return handleActionError(error, "Failed to retrieve shareholder");
  }
}

/**
 * Generate unique shareholder sequence code (e.g. SH-001)
 */
async function generateShareholderCode(): Promise<string> {
  const count = await prisma.shareholder.count();
  const nextNum = count + 1;
  return `SH-${String(nextNum).padStart(3, "0")}`;
}

/**
 * Create a new Shareholder record
 */
export async function createShareholder(input: CreateShareholderInput) {
  try {
    const currentUser = await requireRole([
      UserRole.ADMIN,
      UserRole.MANAGER,
    ]);

    if (!input.name || !input.name.trim()) {
      return { success: false, error: "Shareholder Name is required" };
    }

    const sharePercentageDec = new Decimal(input.sharePercentage || 0);
    if (sharePercentageDec.lt(0) || sharePercentageDec.gt(100)) {
      return { success: false, error: "Share percentage must be between 0.00% and 100.00%" };
    }

    const capitalDec = new Decimal(input.capitalContribution || 0);
    if (capitalDec.lt(0)) {
      return { success: false, error: "Capital contribution cannot be negative" };
    }

    let code = input.code?.trim().toUpperCase();
    if (!code) {
      code = await generateShareholderCode();
    } else {
      const existing = await prisma.shareholder.findUnique({ where: { code } });
      if (existing) {
        return { success: false, error: `Shareholder code '${code}' already exists` };
      }
    }

    const newShareholder = await prisma.shareholder.create({
      data: {
        code,
        name: input.name.trim(),
        nationalId: input.nationalId?.trim() || null,
        contactPerson: input.contactPerson?.trim() || null,
        email: input.email?.trim().toLowerCase() || null,
        phone: input.phone?.trim() || null,
        address: input.address?.trim() || null,
        sharePercentage: sharePercentageDec.toString(),
        capitalContribution: capitalDec.toString(),
        currency: input.currency || "AFN",
        status: input.status || ShareholderStatus.ACTIVE,
        notes: input.notes?.trim() || null,
      },
    });

    await recordAuditLog({
      userId: currentUser.id,
      action: "CREATE",
      entityName: "Shareholder",
      entityId: newShareholder.id,
      newValues: {
        code: newShareholder.code,
        name: newShareholder.name,
        sharePercentage: sharePercentageDec.toNumber(),
        capitalContribution: capitalDec.toNumber(),
        status: newShareholder.status,
      },
    });

    safeRevalidatePath("/shareholders");
    return { success: true, data: newShareholder };
  } catch (error: any) {
    return handleActionError(error, "Failed to create shareholder");
  }
}

/**
 * Update an existing Shareholder record
 */
export async function updateShareholder(input: UpdateShareholderInput) {
  try {
    const currentUser = await requireRole([
      UserRole.ADMIN,
      UserRole.MANAGER,
    ]);

    if (!input.id) {
      return { success: false, error: "Shareholder ID is required" };
    }

    const existing = await prisma.shareholder.findUnique({ where: { id: input.id } });
    if (!existing) {
      return { success: false, error: "Shareholder not found" };
    }

    const data: any = {};
    if (input.name !== undefined) {
      if (!input.name.trim()) return { success: false, error: "Shareholder Name cannot be empty" };
      data.name = input.name.trim();
    }
    if (input.nationalId !== undefined) data.nationalId = input.nationalId?.trim() || null;
    if (input.contactPerson !== undefined) data.contactPerson = input.contactPerson?.trim() || null;
    if (input.email !== undefined) data.email = input.email?.trim().toLowerCase() || null;
    if (input.phone !== undefined) data.phone = input.phone?.trim() || null;
    if (input.address !== undefined) data.address = input.address?.trim() || null;
    if (input.status !== undefined) data.status = input.status;
    if (input.notes !== undefined) data.notes = input.notes?.trim() || null;
    if (input.currency !== undefined) data.currency = input.currency;

    if (input.sharePercentage !== undefined) {
      const shareDec = new Decimal(input.sharePercentage || 0);
      if (shareDec.lt(0) || shareDec.gt(100)) {
        return { success: false, error: "Share percentage must be between 0.00% and 100.00%" };
      }
      data.sharePercentage = shareDec.toString();
    }

    if (input.capitalContribution !== undefined) {
      const capDec = new Decimal(input.capitalContribution || 0);
      if (capDec.lt(0)) {
        return { success: false, error: "Capital contribution cannot be negative" };
      }
      data.capitalContribution = capDec.toString();
    }

    const updated = await prisma.shareholder.update({
      where: { id: input.id },
      data,
    });

    await recordAuditLog({
      userId: currentUser.id,
      action: "UPDATE",
      entityName: "Shareholder",
      entityId: input.id,
      oldValues: {
        name: existing.name,
        sharePercentage: Number(existing.sharePercentage),
        capitalContribution: Number(existing.capitalContribution),
        status: existing.status,
      },
      newValues: {
        name: updated.name,
        sharePercentage: Number(updated.sharePercentage),
        capitalContribution: Number(updated.capitalContribution),
        status: updated.status,
      },
    });

    safeRevalidatePath("/shareholders");
    return { success: true, data: updated };
  } catch (error: any) {
    return handleActionError(error, "Failed to update shareholder");
  }
}

/**
 * Delete or deactivate a Shareholder record
 */
export async function deleteShareholder(id: string) {
  try {
    const currentUser = await requireRole([
      UserRole.ADMIN,
    ]);

    const existing = await prisma.shareholder.findUnique({ where: { id } });
    if (!existing) {
      return { success: false, error: "Shareholder not found" };
    }

    // Perform safe deletion
    await prisma.shareholder.delete({ where: { id } });

    await recordAuditLog({
      userId: currentUser.id,
      action: "DELETE",
      entityName: "Shareholder",
      entityId: id,
      oldValues: {
        code: existing.code,
        name: existing.name,
      },
    });

    safeRevalidatePath("/shareholders");
    return { success: true };
  } catch (error: any) {
    return handleActionError(error, "Failed to delete shareholder");
  }
}
