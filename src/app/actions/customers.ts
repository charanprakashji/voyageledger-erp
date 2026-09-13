"use server";

import { db } from "@/lib/db";
import { requireRole, handleActionError } from "@/lib/auth";
import { recordAuditLog } from "@/lib/audit";
import { getCustomerDerivedLedger } from "@/lib/ledger";
import { revalidatePath } from "next/cache";
import { CustomerType } from "@prisma/client";
import Decimal from "decimal.js";

export interface CustomerFilterParams {
  query?: string;
  type?: CustomerType | "ALL";
  isActive?: boolean;
  page?: number;
  limit?: number;
}

export async function getCustomers(params: CustomerFilterParams = {}) {
  try {
    await requireRole(["ADMIN", "MANAGER", "ACCOUNTANT", "TRAVEL_AGENT"]);

    const { query, type, isActive, page = 1, limit = 20 } = params;
    const skip = (page - 1) * limit;

    const whereClause: any = {};

    if (query) {
      whereClause.OR = [
        { name: { contains: query, mode: "insensitive" } },
        { code: { contains: query, mode: "insensitive" } },
        { companyName: { contains: query, mode: "insensitive" } },
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

    const [customers, totalCount] = await Promise.all([
      db.customer.findMany({
        where: whereClause,
        orderBy: { createdAt: "desc" },
        skip,
        take: limit,
        include: {
          _count: {
            select: {
              bookings: true,
              invoices: true,
              journalLines: true,
            },
          },
        },
      }),
      db.customer.count({ where: whereClause }),
    ]);

    return {
      customers,
      totalCount,
      totalPages: Math.ceil(totalCount / limit),
      currentPage: page,
    };
  } catch (err) {
    console.error("Error in getCustomers:", err);
    return {
      customers: [],
      totalCount: 0,
      totalPages: 0,
      currentPage: 1,
      error: "Failed to load customers.",
    };
  }
}

export async function getCustomerById(id: string) {
  try {
    await requireRole(["ADMIN", "MANAGER", "ACCOUNTANT", "TRAVEL_AGENT"]);

    const customer = await db.customer.findUnique({
      where: { id },
      include: {
        bookings: {
          take: 5,
          orderBy: { createdAt: "desc" },
          select: {
            id: true,
            bookingNumber: true,
            leadPassenger: true,
            destination: true,
            status: true,
            totalSellPrice: true,
            createdAt: true,
          },
        },
        invoices: {
          take: 5,
          orderBy: { createdAt: "desc" },
          select: {
            id: true,
            invoiceNumber: true,
            issueDate: true,
            grandTotal: true,
            paidAmount: true,
            balanceDue: true,
            status: true,
          },
        },
      },
    });

    if (!customer) return null;

    // Derive live General Ledger sub-ledger balance and transactions
    const ledgerSummary = await getCustomerDerivedLedger(id);

    return {
      ...customer,
      ledgerSummary,
    };
  } catch (err) {
    console.error(`Error in getCustomerById(${id}):`, err);
    return null;
  }
}

export async function createCustomer(formData: FormData) {
  try {
    const user = await requireRole(["ADMIN", "MANAGER", "ACCOUNTANT", "TRAVEL_AGENT"]);

    const name = formData.get("name")?.toString().trim();
    const code = formData.get("code")?.toString().trim().toUpperCase();
    const type = (formData.get("type")?.toString() || "INDIVIDUAL") as CustomerType;
    const companyName = formData.get("companyName")?.toString().trim() || null;
    const contactPerson = formData.get("contactPerson")?.toString().trim() || null;
    const email = formData.get("email")?.toString().trim().toLowerCase() || null;
    const phone = formData.get("phone")?.toString().trim() || null;
    const alternatePhone = formData.get("alternatePhone")?.toString().trim() || null;
    const address = formData.get("address")?.toString().trim() || null;
    const province = formData.get("province")?.toString().trim() || "Kabul";
    const district = formData.get("district")?.toString().trim() || null;
    const city = formData.get("city")?.toString().trim() || "Kabul";
    const postalCode = formData.get("postalCode")?.toString().trim() || null;
    const taxNumber = formData.get("taxNumber")?.toString().trim() || null;
    const taxRegistrationNumber = formData.get("taxRegistrationNumber")?.toString().trim() || null;
    const taxCategory = formData.get("taxCategory")?.toString().trim() || null;
    const creditLimitInput = formData.get("creditLimit")?.toString() || "0";
    const paymentTermsDays = parseInt(formData.get("paymentTermsDays")?.toString() || "30", 10);
    const notes = formData.get("notes")?.toString().trim() || null;
    const defaultCurrency = formData.get("defaultCurrency")?.toString() || "AFN";

    if (!name || !code) {
      return { success: false, error: "Customer Name and Code are required." };
    }

    // Check unique code
    const existing = await db.customer.findUnique({
      where: { code },
    });

    if (existing) {
      return { success: false, error: `Customer code '${code}' already exists.` };
    }

    const creditLimit = new Decimal(creditLimitInput);

    const customer = await db.customer.create({
      data: {
        code,
        type,
        name,
        companyName,
        contactPerson,
        email,
        phone,
        alternatePhone,
        address,
        province,
        district,
        city,
        postalCode,
        taxNumber,
        taxRegistrationNumber,
        taxCategory,
        creditLimit,
        paymentTermsDays,
        defaultCurrency,
        notes,
        isActive: true,
      },
    });

    await recordAuditLog({
      userId: user.id,
      action: "CREATE",
      entityName: "Customer",
      entityId: customer.id,
      newValues: customer,
    });

    revalidatePath("/customers");
    return { success: true, customer };
  } catch (err) {
    return handleActionError(err, "Failed to create customer.");
  }
}

export async function updateCustomer(id: string, formData: FormData) {
  try {
    const user = await requireRole(["ADMIN", "MANAGER", "ACCOUNTANT", "TRAVEL_AGENT"]);

    const name = formData.get("name")?.toString().trim();
    const type = (formData.get("type")?.toString() || "INDIVIDUAL") as CustomerType;
    const companyName = formData.get("companyName")?.toString().trim() || null;
    const contactPerson = formData.get("contactPerson")?.toString().trim() || null;
    const email = formData.get("email")?.toString().trim().toLowerCase() || null;
    const phone = formData.get("phone")?.toString().trim() || null;
    const alternatePhone = formData.get("alternatePhone")?.toString().trim() || null;
    const address = formData.get("address")?.toString().trim() || null;
    const province = formData.get("province")?.toString().trim() || "Kabul";
    const district = formData.get("district")?.toString().trim() || null;
    const city = formData.get("city")?.toString().trim() || "Kabul";
    const postalCode = formData.get("postalCode")?.toString().trim() || null;
    const taxNumber = formData.get("taxNumber")?.toString().trim() || null;
    const taxRegistrationNumber = formData.get("taxRegistrationNumber")?.toString().trim() || null;
    const taxCategory = formData.get("taxCategory")?.toString().trim() || null;
    const creditLimitInput = formData.get("creditLimit")?.toString() || "0";
    const paymentTermsDays = parseInt(formData.get("paymentTermsDays")?.toString() || "30", 10);
    const notes = formData.get("notes")?.toString().trim() || null;
    const isActive = formData.get("isActive") === "true";

    if (!name) {
      return { success: false, error: "Customer Name is required." };
    }

    const existing = await db.customer.findUnique({ where: { id } });
    if (!existing) {
      return { success: false, error: "Customer not found." };
    }

    const creditLimit = new Decimal(creditLimitInput);

    const updated = await db.customer.update({
      where: { id },
      data: {
        type,
        name,
        companyName,
        contactPerson,
        email,
        phone,
        alternatePhone,
        address,
        province,
        district,
        city,
        postalCode,
        taxNumber,
        taxRegistrationNumber,
        taxCategory,
        creditLimit,
        paymentTermsDays,
        notes,
        isActive,
      },
    });

    await recordAuditLog({
      userId: user.id,
      action: "UPDATE",
      entityName: "Customer",
      entityId: id,
      oldValues: existing,
      newValues: updated,
    });

    revalidatePath("/customers");
    revalidatePath(`/customers/${id}`);
    return { success: true, customer: updated };
  } catch (err) {
    return handleActionError(err, "Failed to update customer.");
  }
}

/**
 * Safe Customer Deletion:
 * Enforces rule: Never allow permanent deletion of customers with financial or booking history.
 */
export async function deleteCustomer(id: string) {
  try {
    const user = await requireRole(["ADMIN", "MANAGER"]);

    const existing = await db.customer.findUnique({
      where: { id },
      include: {
        _count: {
          select: {
            journalLines: true,
            bookings: true,
            invoices: true,
            receipts: true,
          },
        },
      },
    });

    if (!existing) {
      return { success: false, error: "Customer not found." };
    }

    const hasFinancialHistory =
      existing._count.journalLines > 0 ||
      existing._count.invoices > 0 ||
      existing._count.receipts > 0 ||
      existing._count.bookings > 0;

    if (hasFinancialHistory) {
      return {
        success: false,
        error: `Cannot permanently delete customer '${existing.name}' because they have associated financial or booking records (${existing._count.journalLines} journal entries, ${existing._count.bookings} bookings). Deactivate the customer instead to preserve financial auditability.`,
      };
    }

    await db.customer.delete({ where: { id } });

    await recordAuditLog({
      userId: user.id,
      action: "DELETE",
      entityName: "Customer",
      entityId: id,
      oldValues: existing,
    });

    revalidatePath("/customers");
    return { success: true };
  } catch (err) {
    return handleActionError(err, "Failed to delete customer.");
  }
}
