"use server";

import { db } from "@/lib/db";
import { requireRole } from "@/lib/auth";
import { recordAuditLog } from "@/lib/audit";
import { getSupplierDerivedLedger } from "@/lib/ledger";
import { revalidatePath } from "next/cache";
import { SupplierType } from "@prisma/client";

export interface SupplierFilterParams {
  query?: string;
  type?: SupplierType | "ALL";
  isActive?: boolean;
  page?: number;
  limit?: number;
}

export async function getSuppliers(params: SupplierFilterParams = {}) {
  const { query, type, isActive, page = 1, limit = 20 } = params;
  const skip = (page - 1) * limit;

  const whereClause: any = {};

  if (query) {
    whereClause.OR = [
      { name: { contains: query, mode: "insensitive" } },
      { code: { contains: query, mode: "insensitive" } },
      { contactPerson: { contains: query, mode: "insensitive" } },
      { phone: { contains: query, mode: "insensitive" } },
      { email: { contains: query, mode: "insensitive" } },
    ];
  }

  if (type && type !== "ALL") {
    whereClause.type = type;
  }

  if (isActive !== undefined) {
    whereClause.isActive = isActive;
  }

  const [suppliers, totalCount] = await Promise.all([
    db.supplier.findMany({
      where: whereClause,
      orderBy: { createdAt: "desc" },
      skip,
      take: limit,
      include: {
        _count: {
          select: {
            serviceItems: true,
            expenses: true,
            journalLines: true,
          },
        },
      },
    }),
    db.supplier.count({ where: whereClause }),
  ]);

  return {
    suppliers,
    totalCount,
    totalPages: Math.ceil(totalCount / limit),
    currentPage: page,
  };
}

export async function getSupplierById(id: string) {
  const supplier = await db.supplier.findUnique({
    where: { id },
    include: {
      serviceItems: {
        take: 5,
        orderBy: { createdAt: "desc" },
        select: {
          id: true,
          serviceType: true,
          description: true,
          costPrice: true,
          sellPrice: true,
          status: true,
          createdAt: true,
        },
      },
      expenses: {
        take: 5,
        orderBy: { createdAt: "desc" },
        select: {
          id: true,
          expenseNumber: true,
          expenseDate: true,
          amount: true,
          currency: true,
          description: true,
          status: true,
        },
      },
    },
  });

  if (!supplier) return null;

  // Derive live General Ledger accounts payable sub-ledger balance and transactions
  const ledgerSummary = await getSupplierDerivedLedger(id);

  return {
    ...supplier,
    ledgerSummary,
  };
}

export async function createSupplier(formData: FormData) {
  const user = await requireRole(["ADMIN", "MANAGER", "ACCOUNTANT"]);

  const name = formData.get("name")?.toString().trim();
  const code = formData.get("code")?.toString().trim().toUpperCase();
  const type = (formData.get("type")?.toString() || "OTHER") as SupplierType;
  const contactPerson = formData.get("contactPerson")?.toString().trim() || null;
  const email = formData.get("email")?.toString().trim().toLowerCase() || null;
  const phone = formData.get("phone")?.toString().trim() || null;
  const address = formData.get("address")?.toString().trim() || null;
  const province = formData.get("province")?.toString().trim() || null;
  const district = formData.get("district")?.toString().trim() || null;
  const city = formData.get("city")?.toString().trim() || null;
  const country = formData.get("country")?.toString().trim() || "Afghanistan";
  const taxNumber = formData.get("taxNumber")?.toString().trim() || null;
  const taxRegistrationNumber = formData.get("taxRegistrationNumber")?.toString().trim() || null;
  const taxCategory = formData.get("taxCategory")?.toString().trim() || null;
  const currency = formData.get("currency")?.toString() || "USD";
  const bankDetails = formData.get("bankDetails")?.toString().trim() || null;
  const paymentTermsDays = parseInt(formData.get("paymentTermsDays")?.toString() || "15", 10);
  const notes = formData.get("notes")?.toString().trim() || null;

  if (!name || !code) {
    return { success: false, error: "Supplier Name and Code are required." };
  }

  const existing = await db.supplier.findUnique({ where: { code } });
  if (existing) {
    return { success: false, error: `Supplier code '${code}' already exists.` };
  }

  const supplier = await db.supplier.create({
    data: {
      code,
      name,
      type,
      contactPerson,
      email,
      phone,
      address,
      province,
      district,
      city,
      country,
      taxNumber,
      taxRegistrationNumber,
      taxCategory,
      currency,
      bankDetails,
      paymentTermsDays,
      notes,
      isActive: true,
    },
  });

  await recordAuditLog({
    userId: user.id,
    action: "CREATE",
    entityName: "Supplier",
    entityId: supplier.id,
    newValues: supplier,
  });

  revalidatePath("/suppliers");
  return { success: true, supplier };
}

export async function updateSupplier(id: string, formData: FormData) {
  const user = await requireRole(["ADMIN", "MANAGER", "ACCOUNTANT"]);

  const name = formData.get("name")?.toString().trim();
  const type = (formData.get("type")?.toString() || "OTHER") as SupplierType;
  const contactPerson = formData.get("contactPerson")?.toString().trim() || null;
  const email = formData.get("email")?.toString().trim().toLowerCase() || null;
  const phone = formData.get("phone")?.toString().trim() || null;
  const address = formData.get("address")?.toString().trim() || null;
  const province = formData.get("province")?.toString().trim() || null;
  const district = formData.get("district")?.toString().trim() || null;
  const city = formData.get("city")?.toString().trim() || null;
  const country = formData.get("country")?.toString().trim() || "Afghanistan";
  const taxNumber = formData.get("taxNumber")?.toString().trim() || null;
  const taxRegistrationNumber = formData.get("taxRegistrationNumber")?.toString().trim() || null;
  const taxCategory = formData.get("taxCategory")?.toString().trim() || null;
  const currency = formData.get("currency")?.toString() || "USD";
  const bankDetails = formData.get("bankDetails")?.toString().trim() || null;
  const paymentTermsDays = parseInt(formData.get("paymentTermsDays")?.toString() || "15", 10);
  const notes = formData.get("notes")?.toString().trim() || null;
  const isActive = formData.get("isActive") === "true";

  if (!name) {
    return { success: false, error: "Supplier Name is required." };
  }

  const existing = await db.supplier.findUnique({ where: { id } });
  if (!existing) {
    return { success: false, error: "Supplier not found." };
  }

  const updated = await db.supplier.update({
    where: { id },
    data: {
      name,
      type,
      contactPerson,
      email,
      phone,
      address,
      province,
      district,
      city,
      country,
      taxNumber,
      taxRegistrationNumber,
      taxCategory,
      currency,
      bankDetails,
      paymentTermsDays,
      notes,
      isActive,
    },
  });

  await recordAuditLog({
    userId: user.id,
    action: "UPDATE",
    entityName: "Supplier",
    entityId: id,
    oldValues: existing,
    newValues: updated,
  });

  revalidatePath("/suppliers");
  revalidatePath(`/suppliers/${id}`);
  return { success: true, supplier: updated };
}

/**
 * Safe Supplier Deletion:
 * Enforces rule: Never allow permanent deletion of suppliers with financial history.
 */
export async function deleteSupplier(id: string) {
  const user = await requireRole(["ADMIN", "MANAGER"]);

  const existing = await db.supplier.findUnique({
    where: { id },
    include: {
      _count: {
        select: {
          journalLines: true,
          serviceItems: true,
          expenses: true,
        },
      },
    },
  });

  if (!existing) {
    return { success: false, error: "Supplier not found." };
  }

  const hasFinancialHistory =
    existing._count.journalLines > 0 ||
    existing._count.serviceItems > 0 ||
    existing._count.expenses > 0;

  if (hasFinancialHistory) {
    return {
      success: false,
      error: `Cannot permanently delete supplier '${existing.name}' because they have associated financial or booking records (${existing._count.journalLines} journal lines, ${existing._count.serviceItems} booking service items). Deactivate the supplier instead to preserve financial auditability.`,
    };
  }

  await db.supplier.delete({ where: { id } });

  await recordAuditLog({
    userId: user.id,
    action: "DELETE",
    entityName: "Supplier",
    entityId: id,
    oldValues: existing,
  });

  revalidatePath("/suppliers");
  return { success: true };
}
