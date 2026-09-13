"use server";

import prisma from "@/lib/prisma";
import { requireRole } from "@/lib/auth";
import { recordAuditLog } from "@/lib/audit";
import {
  calculateSupplierBillTotals,
  generateDocumentNumber,
  postSupplierBillToGL,
  reverseSupplierBillGL,
  postSupplierPaymentToGL,
  reverseSupplierPaymentGL,
  allocateSupplierAdvanceToBill,
} from "@/lib/bills";
import { SupplierBillStatus, SupplierPaymentStatus, ServiceType, PaymentMethod, UserRole } from "@prisma/client";
import { revalidatePath } from "next/cache";

export interface SupplierBillLineInput {
  id?: string;
  bookingServiceItemId?: string;
  serviceType: ServiceType;
  description: string;
  quantity: number;
  unitCostForeign: number | string;
  discountForeign?: number | string;
  taxRate?: number | string;
  isTaxRecoverable?: boolean;
  costAccountId?: string;
  taxLiabilityAccountId?: string;
}

export interface CreateSupplierBillInput {
  supplierId: string;
  bookingId?: string;
  billNumber?: string;
  supplierInvoiceNumber?: string;
  currency: string;
  exchangeRate: number | string;
  issueDate?: string;
  billDate?: string;
  dueDate: string;
  notes?: string;
  status?: SupplierBillStatus;
  lines: SupplierBillLineInput[];
}

export async function getSupplierBills(params?: {
  search?: string;
  status?: SupplierBillStatus;
  supplierId?: string;
  bookingId?: string;
  page?: number;
  limit?: number;
}) {
  await requireRole([
    UserRole.ADMIN,
    UserRole.MANAGER,
    UserRole.ACCOUNTANT,
    UserRole.TRAVEL_AGENT,
    UserRole.AUDITOR,
  ]);

  const page = Math.max(1, params?.page || 1);
  const limit = Math.min(100, Math.max(1, params?.limit || 20));
  const skip = (page - 1) * limit;

  const where: any = {};
  if (params?.status) where.status = params.status;
  if (params?.supplierId) where.supplierId = params.supplierId;
  if (params?.bookingId) where.bookingId = params.bookingId;

  if (params?.search) {
    const s = params.search.trim();
    where.OR = [
      { billNumber: { contains: s, mode: "insensitive" } },
      { supplierInvoiceRef: { contains: s, mode: "insensitive" } },
      { supplier: { name: { contains: s, mode: "insensitive" } } },
      { supplier: { companyName: { contains: s, mode: "insensitive" } } },
    ];
  }

  try {
    const [total, bills] = await Promise.all([
      prisma.supplierBill.count({ where }),
      prisma.supplierBill.findMany({
        where,
        include: {
          supplier: { select: { id: true, name: true, code: true } },
          booking: { select: { id: true, bookingNumber: true, pnr: true } },
          createdBy: { select: { id: true, name: true, role: true } },
          lines: true,
        },
        orderBy: { billDate: "desc" },
        skip,
        take: limit,
      }),
    ]);

    return {
      success: true,
      data: bills.map((b) => ({
        ...b,
        foreignSubTotal: Number(b.foreignSubTotal),
        baseSubTotal: Number(b.baseSubTotal),
        taxAmount: Number(b.taxAmount),
        grandTotal: Number(b.grandTotal),
        paidAmount: Number(b.paidAmount),
        balanceDue: Number(b.balanceDue),
        baseGrandTotal: Number(b.baseGrandTotal),
        exchangeRate: Number(b.exchangeRate),
      })),
      pagination: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      },
    };
  } catch (error: any) {
    console.error("Error fetching supplier bills:", error);
    return {
      success: false,
      error: error.message || "Failed to retrieve supplier bills",
      data: [],
      pagination: { total: 0, page: 1, limit, totalPages: 0 },
    };
  }
}

export async function getSupplierBillById(id: string) {
  await requireRole([
    UserRole.ADMIN,
    UserRole.MANAGER,
    UserRole.ACCOUNTANT,
    UserRole.TRAVEL_AGENT,
    UserRole.AUDITOR,
  ]);

  try {
    const bill = await prisma.supplierBill.findUnique({
      where: { id },
      include: {
        supplier: true,
        booking: {
          include: {
            passengers: true,
            serviceItems: true,
          },
        },
        createdBy: { select: { id: true, name: true, role: true } },
        approvedBy: { select: { id: true, name: true, role: true } },
        postedBy: { select: { id: true, name: true, role: true } },
        cancelledBy: { select: { id: true, name: true, role: true } },
        journalEntry: {
          include: {
            lines: {
              include: { account: true },
            },
          },
        },
        lines: {
          include: {
            costAccount: true,
          },
        },
        paymentAllocations: {
          include: {
            supplierPayment: true,
          },
        },
      },
    });

    if (!bill) {
      return { success: false, error: "Supplier Bill not found" };
    }

    return {
      success: true,
      data: {
        ...bill,
        foreignSubTotal: Number(bill.foreignSubTotal),
        baseSubTotal: Number(bill.baseSubTotal),
        taxAmount: Number(bill.taxAmount),
        grandTotal: Number(bill.grandTotal),
        paidAmount: Number(bill.paidAmount),
        balanceDue: Number(bill.balanceDue),
        baseGrandTotal: Number(bill.baseGrandTotal),
        exchangeRate: Number(bill.exchangeRate),
        lines: bill.lines.map((l) => ({
          ...l,
          unitCostForeign: Number(l.unitCostForeign),
          unitCostBase: Number(l.unitCostBase),
          taxRate: Number(l.taxRate),
          taxAmountForeign: Number(l.taxAmountForeign),
          taxAmountBase: Number(l.taxAmountBase),
          totalCostForeign: Number(l.totalAmountForeign),
          totalCostBase: Number(l.totalAmountBase),
        })),
        paymentAllocations: bill.paymentAllocations.map((a) => ({
          ...a,
          amountForeign: Number(a.amountForeign),
          amountBase: Number(a.amountBase),
          billSettledBase: Number(a.billSettledBase),
          fxGainLossAmount: Number(a.fxGainLossAmount),
        })),
        journalEntry: bill.journalEntry,
      },
    };
  } catch (error: any) {
    console.error("Error retrieving supplier bill:", error);
    return { success: false, error: error.message || "Failed to load supplier bill" };
  }
}

export async function createSupplierBill(input: CreateSupplierBillInput) {
  const currentUser = await requireRole([
    UserRole.ADMIN,
    UserRole.MANAGER,
    UserRole.ACCOUNTANT,
    UserRole.TRAVEL_AGENT,
  ]);

  if (!input.supplierId) {
    return { success: false, error: "Supplier is required" };
  }

  if (!input.lines || input.lines.length === 0) {
    return { success: false, error: "Supplier Bill must contain at least one line item" };
  }

  try {
    const prefix = "BIL-";

    const count = await prisma.supplierBill.count();
    const billNumber = input.billNumber || generateDocumentNumber(prefix, count + 1);

    const totals = calculateSupplierBillTotals(
      input.lines.map((l) => ({
        ...l,
        exchangeRate: input.exchangeRate,
      }))
    );

    const initialStatus = input.status || SupplierBillStatus.DRAFT;
    const billDateValue = input.billDate || input.issueDate || new Date().toISOString();

    const newBill = await prisma.$transaction(async (tx) => {
      const created = await tx.supplierBill.create({
        data: {
          billNumber,
          supplierInvoiceRef: input.supplierInvoiceNumber?.trim() || null,
          supplierId: input.supplierId,
          bookingId: input.bookingId || null,
          createdById: currentUser.id,
          billDate: new Date(billDateValue),
          dueDate: new Date(input.dueDate),
          status: initialStatus,
          currency: input.currency.toUpperCase(),
          exchangeRate: input.exchangeRate.toString(),
          foreignSubTotal: totals.foreignSubTotal.toString(),
          baseSubTotal: totals.baseSubTotal.toString(),
          taxAmount: totals.taxAmount.toString(),
          grandTotal: totals.grandTotal.toString(),
          paidAmount: "0.00",
          balanceDue: totals.grandTotal.toString(),
          baseGrandTotal: totals.baseGrandTotal.toString(),
          notes: input.notes?.trim() || null,
          lines: {
            create: totals.lines.map((l) => ({
              bookingServiceItemId: l.bookingServiceItemId || null,
              serviceType: l.serviceType,
              description: l.description.trim(),
              quantity: l.quantity,
              unitCostForeign: l.unitCostForeign.toString(),
              unitCostBase: l.unitCostBase.toString(),
              discountForeign: l.discountForeign.toString(),
              discountBase: l.discountBase.toString(),
              taxRate: l.taxRate.toString(),
              taxAmountForeign: l.taxAmountForeign.toString(),
              taxAmountBase: l.taxAmountBase.toString(),
              totalAmountForeign: l.totalAmountForeign.toString(),
              totalAmountBase: l.totalAmountBase.toString(),
              isTaxRecoverable: l.isTaxRecoverable,
              costAccountId: l.costAccountId!,
              taxLiabilityAccountId: l.taxLiabilityAccountId || null,
            })),
          },
        },
      });

      if (initialStatus === SupplierBillStatus.POSTED) {
        await postSupplierBillToGL(tx, created.id, currentUser.id);
      }

      return created;
    });

    await recordAuditLog({
      userId: currentUser.id,
      action: "CREATE",
      entityName: "SupplierBill",
      entityId: newBill.id,
      newValues: {
        billNumber: newBill.billNumber,
        grandTotal: totals.grandTotal.toNumber(),
        baseGrandTotalAFN: totals.baseGrandTotal.toNumber(),
        status: newBill.status,
      },
    });

    revalidatePath("/supplier-bills");
    return { success: true, data: { id: newBill.id, billNumber: newBill.billNumber } };
  } catch (error: any) {
    console.error("Error creating supplier bill:", error);
    return { success: false, error: error.message || "Failed to create supplier bill" };
  }
}

export async function approveSupplierBill(id: string) {
  const currentUser = await requireRole([
    UserRole.ADMIN,
    UserRole.MANAGER,
    UserRole.ACCOUNTANT,
  ]);

  try {
    const bill = await prisma.supplierBill.findUnique({
      where: { id },
      select: { id: true, status: true, billNumber: true },
    });

    if (!bill) return { success: false, error: "Supplier Bill not found" };
    if (bill.status !== SupplierBillStatus.DRAFT) {
      return { success: false, error: `Only Draft bills can be approved (Current: ${bill.status})` };
    }

    await prisma.supplierBill.update({
      where: { id },
      data: {
        status: SupplierBillStatus.APPROVED,
        approvedAt: new Date(),
        approvedById: currentUser.id,
      },
    });

    await recordAuditLog({
      userId: currentUser.id,
      action: "UPDATE",
      entityName: "SupplierBill",
      entityId: id,
      newValues: { status: SupplierBillStatus.APPROVED, approvedBy: currentUser.name },
    });

    revalidatePath(`/supplier-bills/${id}`);
    revalidatePath("/supplier-bills");
    return { success: true };
  } catch (error: any) {
    console.error("Error approving supplier bill:", error);
    return { success: false, error: error.message || "Failed to approve supplier bill" };
  }
}

export async function postSupplierBill(id: string) {
  const currentUser = await requireRole([
    UserRole.ADMIN,
    UserRole.MANAGER,
    UserRole.ACCOUNTANT,
  ]);

  try {
    const result = await prisma.$transaction(async (tx) => {
      return await postSupplierBillToGL(tx, id, currentUser.id);
    });

    await recordAuditLog({
      userId: currentUser.id,
      action: "UPDATE",
      entityName: "SupplierBill",
      entityId: id,
      newValues: {
        status: SupplierBillStatus.POSTED,
        postedBy: currentUser.name,
        journalEntryId: result.journalEntry.id,
        entryNumber: result.journalEntry.entryNumber,
      },
    });

    revalidatePath(`/supplier-bills/${id}`);
    revalidatePath("/supplier-bills");
    revalidatePath("/suppliers");
    return { success: true, data: result };
  } catch (error: any) {
    console.error("Error posting supplier bill:", error);
    return { success: false, error: error.message || "Failed to post supplier bill to General Ledger" };
  }
}

export async function cancelSupplierBill(id: string, reason: string) {
  const currentUser = await requireRole([
    UserRole.ADMIN,
    UserRole.MANAGER,
    UserRole.ACCOUNTANT,
  ]);

  if (!reason || reason.trim().length < 5) {
    return { success: false, error: "Detailed cancellation reason is mandatory (minimum 5 characters)" };
  }

  try {
    const bill = await prisma.supplierBill.findUnique({
      where: { id },
      select: { id: true, status: true, billNumber: true },
    });

    if (!bill) return { success: false, error: "Supplier Bill not found" };
    if (bill.status === SupplierBillStatus.CANCELLED) {
      return { success: false, error: "Supplier Bill is already cancelled" };
    }

    if (bill.status === SupplierBillStatus.POSTED || bill.status === SupplierBillStatus.PARTIALLY_PAID) {
      await prisma.$transaction(async (tx) => {
        await reverseSupplierBillGL(tx, id, reason.trim(), currentUser.id);
      });
    } else {
      await prisma.supplierBill.update({
        where: { id },
        data: {
          status: SupplierBillStatus.CANCELLED,
          cancellationReason: reason.trim(),
          cancelledAt: new Date(),
          cancelledById: currentUser.id,
        },
      });
    }

    await recordAuditLog({
      userId: currentUser.id,
      action: "CANCEL",
      entityName: "SupplierBill",
      entityId: id,
      newValues: {
        status: SupplierBillStatus.CANCELLED,
        cancellationReason: reason.trim(),
        cancelledBy: currentUser.name,
      },
    });

    revalidatePath(`/supplier-bills/${id}`);
    revalidatePath("/supplier-bills");
    revalidatePath("/suppliers");
    return { success: true };
  } catch (error: any) {
    console.error("Error cancelling supplier bill:", error);
    return { success: false, error: error.message || "Failed to cancel supplier bill" };
  }
}

// Supplier Payments Actions
export interface CreateSupplierPaymentInput {
  supplierId: string;
  paymentMethod: string;
  paymentDate: string;
  currency: string;
  exchangeRate: number | string;
  amountForeign: number | string;
  bankAccountId: string;
  referenceNumber?: string;
  notes?: string;
  isAdvance?: boolean;
  status?: SupplierPaymentStatus;
  allocations?: {
    supplierBillId: string;
    amountForeign: number | string;
  }[];
}

export async function getSupplierPayments(params?: {
  supplierId?: string;
  status?: SupplierPaymentStatus;
  page?: number;
  limit?: number;
}) {
  await requireRole([
    UserRole.ADMIN,
    UserRole.MANAGER,
    UserRole.ACCOUNTANT,
    UserRole.TRAVEL_AGENT,
    UserRole.AUDITOR,
  ]);

  const page = Math.max(1, params?.page || 1);
  const limit = Math.min(100, Math.max(1, params?.limit || 20));
  const skip = (page - 1) * limit;

  const where: any = {};
  if (params?.status) where.status = params.status;
  if (params?.supplierId) where.supplierId = params.supplierId;

  try {
    const [total, payments] = await Promise.all([
      prisma.supplierPayment.count({ where }),
      prisma.supplierPayment.findMany({
        where,
        include: {
          supplier: { select: { id: true, name: true, code: true } },
          bankAccount: { select: { id: true, code: true, name: true } },
          createdBy: { select: { id: true, name: true, role: true } },
          allocations: {
            include: {
              supplierBill: { select: { id: true, billNumber: true } },
            },
          },
        },
        orderBy: { paymentDate: "desc" },
        skip,
        take: limit,
      }),
    ]);

    return {
      success: true,
      data: payments.map((p) => ({
        ...p,
        amountForeign: Number(p.amount),
        amountBase: Number(p.baseAmount),
        exchangeRate: Number(p.exchangeRate),
        unallocatedAmount: Number(p.unallocatedAmount),
      })),
      pagination: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      },
    };
  } catch (error: any) {
    console.error("Error fetching supplier payments:", error);
    return {
      success: false,
      error: error.message || "Failed to retrieve supplier payments",
      data: [],
      pagination: { total: 0, page: 1, limit, totalPages: 0 },
    };
  }
}

export async function createSupplierPayment(input: CreateSupplierPaymentInput) {
  const currentUser = await requireRole([
    UserRole.ADMIN,
    UserRole.MANAGER,
    UserRole.ACCOUNTANT,
  ]);

  if (!input.supplierId) return { success: false, error: "Supplier is required" };
  if (!input.bankAccountId) return { success: false, error: "Bank/Cash account is required" };
  if (!input.amountForeign || Number(input.amountForeign) <= 0) {
    return { success: false, error: "Valid payment amount is required" };
  }

  try {
    const count = await prisma.supplierPayment.count();
    const paymentNumber = generateDocumentNumber("PAY-", count + 1);

    const exchangeRate = Number(input.exchangeRate) || 1;
    const amountForeign = Number(input.amountForeign);
    const amountBase = amountForeign * exchangeRate;

    const initialStatus = input.status || SupplierPaymentStatus.DRAFT;

    const newPayment = await prisma.$transaction(async (tx) => {
      const created = await tx.supplierPayment.create({
        data: {
          paymentNumber,
          supplierId: input.supplierId,
          createdById: currentUser.id,
          bankAccountId: input.bankAccountId,
          paymentDate: new Date(input.paymentDate),
          paymentMethod: (input.paymentMethod as PaymentMethod) || PaymentMethod.BANK_TRANSFER,
          bankReference: input.referenceNumber?.trim() || null,
          status: initialStatus,
          currency: input.currency.toUpperCase(),
          exchangeRate: exchangeRate.toString(),
          amount: amountForeign.toString(),
          baseAmount: amountBase.toString(),
          unallocatedAmount: amountForeign.toString(),
          notes: input.notes?.trim() || null,
          allocations: input.allocations && input.allocations.length > 0 ? {
            create: input.allocations.map((a) => ({
              supplierBillId: a.supplierBillId,
              amountForeign: a.amountForeign.toString(),
              amountBase: (Number(a.amountForeign) * exchangeRate).toString(),
              billSettledBase: (Number(a.amountForeign) * exchangeRate).toString(),
            })),
          } : undefined,
        },
      });

      if (initialStatus === SupplierPaymentStatus.POSTED) {
        await postSupplierPaymentToGL(tx, created.id, currentUser.id);
      }

      return created;
    });

    await recordAuditLog({
      userId: currentUser.id,
      action: "CREATE",
      entityName: "SupplierPayment",
      entityId: newPayment.id,
      newValues: {
        paymentNumber: newPayment.paymentNumber,
        amountForeign,
        amountBase,
        status: newPayment.status,
      },
    });

    revalidatePath("/supplier-payments");
    revalidatePath("/supplier-bills");
    return { success: true, data: { id: newPayment.id, paymentNumber: newPayment.paymentNumber } };
  } catch (error: any) {
    console.error("Error creating supplier payment:", error);
    return { success: false, error: error.message || "Failed to create supplier payment" };
  }
}

export async function postSupplierPayment(id: string) {
  const currentUser = await requireRole([
    UserRole.ADMIN,
    UserRole.MANAGER,
    UserRole.ACCOUNTANT,
  ]);

  try {
    const result = await prisma.$transaction(async (tx) => {
      return await postSupplierPaymentToGL(tx, id, currentUser.id);
    });

    await recordAuditLog({
      userId: currentUser.id,
      action: "UPDATE",
      entityName: "SupplierPayment",
      entityId: id,
      newValues: {
        status: SupplierPaymentStatus.POSTED,
        postedBy: currentUser.name,
        journalEntryId: result.journalEntry.id,
        entryNumber: result.journalEntry.entryNumber,
      },
    });

    revalidatePath(`/supplier-payments/${id}`);
    revalidatePath("/supplier-payments");
    revalidatePath("/supplier-bills");
    revalidatePath("/suppliers");
    return { success: true, data: result };
  } catch (error: any) {
    console.error("Error posting supplier payment:", error);
    return { success: false, error: error.message || "Failed to post supplier payment to General Ledger" };
  }
}

export async function cancelSupplierPayment(id: string, reason: string) {
  const currentUser = await requireRole([
    UserRole.ADMIN,
    UserRole.MANAGER,
    UserRole.ACCOUNTANT,
  ]);

  if (!reason || reason.trim().length < 5) {
    return { success: false, error: "Detailed cancellation reason is mandatory" };
  }

  try {
    const payment = await prisma.supplierPayment.findUnique({
      where: { id },
      select: { id: true, status: true },
    });

    if (!payment) return { success: false, error: "Supplier payment not found" };
    if (payment.status === SupplierPaymentStatus.CANCELLED) {
      return { success: false, error: "Payment is already cancelled" };
    }

    if (payment.status === SupplierPaymentStatus.POSTED) {
      await prisma.$transaction(async (tx) => {
        await reverseSupplierPaymentGL(tx, id, reason.trim(), currentUser.id);
      });
    } else {
      await prisma.supplierPayment.update({
        where: { id },
        data: {
          status: SupplierPaymentStatus.CANCELLED,
          cancellationReason: reason.trim(),
          cancelledAt: new Date(),
          cancelledById: currentUser.id,
        },
      });
    }

    revalidatePath("/supplier-payments");
    revalidatePath("/supplier-bills");
    return { success: true };
  } catch (error: any) {
    console.error("Error cancelling supplier payment:", error);
    return { success: false, error: error.message || "Failed to cancel supplier payment" };
  }
}

export async function allocateSupplierAdvance(
  supplierPaymentId: string,
  supplierBillId: string,
  amountForeign: number | string
) {
  const currentUser = await requireRole([
    UserRole.ADMIN,
    UserRole.MANAGER,
    UserRole.ACCOUNTANT,
  ]);

  try {
    const result = await prisma.$transaction(async (tx) => {
      return await allocateSupplierAdvanceToBill(tx, {
        paymentId: supplierPaymentId,
        billId: supplierBillId,
        amountToAllocateForeign: amountForeign,
        userId: currentUser.id,
      });
    });

    revalidatePath("/supplier-payments");
    revalidatePath("/supplier-bills");
    revalidatePath("/suppliers");
    return { success: true, data: result };
  } catch (error: any) {
    console.error("Error allocating supplier advance:", error);
    return { success: false, error: error.message || "Failed to allocate supplier advance" };
  }
}
