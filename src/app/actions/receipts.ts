"use server";

import prisma from "@/lib/prisma";
import { getCurrentUser, requireRole } from "@/lib/auth";
import { recordAuditLog } from "@/lib/audit";
import {
  generateDocumentNumber,
  postReceiptToGL,
  reverseReceiptGL,
  allocateCustomerAdvanceToInvoice,
  reverseAdvanceAllocationGL,
} from "@/lib/invoicing";
import { PaymentMethod, ReceiptStatus, UserRole } from "@prisma/client";
import { revalidatePath } from "next/cache";
import Decimal from "decimal.js";

export interface ReceiptAllocationInput {
  invoiceId: string;
  amountForeign: number | string;
}

export interface CreateReceiptInput {
  customerId: string;
  bookingId?: string;
  currency: string;
  exchangeRate: number | string;
  amount: number | string;
  paymentDate: string;
  paymentMethod: PaymentMethod;
  bankAccountId: string;
  bankReference?: string;
  notes?: string;
  status?: ReceiptStatus;
  allocations?: ReceiptAllocationInput[];
}

export async function getReceipts(params?: {
  search?: string;
  status?: ReceiptStatus;
  customerId?: string;
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
  if (params?.customerId) where.customerId = params.customerId;

  if (params?.search) {
    const s = params.search.trim();
    where.OR = [
      { receiptNumber: { contains: s, mode: "insensitive" } },
      { bankReference: { contains: s, mode: "insensitive" } },
      { customer: { name: { contains: s, mode: "insensitive" } } },
    ];
  }

  try {
    const [total, receipts] = await Promise.all([
      prisma.receipt.count({ where }),
      prisma.receipt.findMany({
        where,
        include: {
          customer: { select: { id: true, name: true, code: true, companyName: true } },
          bankAccount: { select: { id: true, code: true, name: true } },
          createdBy: { select: { id: true, name: true, role: true } },
          allocations: {
            include: {
              invoice: { select: { id: true, invoiceNumber: true, grandTotal: true, balanceDue: true } },
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
      data: receipts.map((r) => ({
        ...r,
        amount: Number(r.amount),
        baseAmount: Number(r.baseAmount),
        unallocatedAmount: Number(r.unallocatedAmount),
        unallocatedBase: Number(r.unallocatedBase),
        exchangeRate: Number(r.exchangeRate),
        allocations: r.allocations.map((a) => ({
          ...a,
          amountForeign: Number(a.amountForeign),
          amountBase: Number(a.amountBase),
          invoiceSettledBase: Number(a.invoiceSettledBase),
          fxGainLossAmount: Number(a.fxGainLossAmount),
        })),
      })),
      pagination: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      },
    };
  } catch (error: any) {
    console.error("Error fetching receipts:", error);
    return {
      success: false,
      error: error.message || "Failed to retrieve receipts",
      data: [],
      pagination: { total: 0, page: 1, limit, totalPages: 0 },
    };
  }
}

export async function getReceiptById(id: string) {
  await requireRole([
    UserRole.ADMIN,
    UserRole.MANAGER,
    UserRole.ACCOUNTANT,
    UserRole.TRAVEL_AGENT,
    UserRole.AUDITOR,
  ]);

  try {
    const receipt = await prisma.receipt.findUnique({
      where: { id },
      include: {
        customer: true,
        booking: { select: { id: true, bookingNumber: true, pnr: true } },
        bankAccount: true,
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
        allocations: {
          include: {
            invoice: true,
          },
        },
      },
    });

    if (!receipt) {
      return { success: false, error: "Receipt not found" };
    }

    return {
      success: true,
      data: {
        ...receipt,
        amount: Number(receipt.amount),
        baseAmount: Number(receipt.baseAmount),
        unallocatedAmount: Number(receipt.unallocatedAmount),
        unallocatedBase: Number(receipt.unallocatedBase),
        exchangeRate: Number(receipt.exchangeRate),
        allocations: receipt.allocations.map((a) => ({
          ...a,
          amountForeign: Number(a.amountForeign),
          amountBase: Number(a.amountBase),
          invoiceSettledBase: Number(a.invoiceSettledBase),
          fxGainLossAmount: Number(a.fxGainLossAmount),
        })),
      },
    };
  } catch (error: any) {
    console.error("Error retrieving receipt:", error);
    return { success: false, error: error.message || "Failed to load receipt" };
  }
}

export async function createReceipt(input: CreateReceiptInput) {
  const currentUser = await requireRole([
    UserRole.ADMIN,
    UserRole.MANAGER,
    UserRole.ACCOUNTANT,
    UserRole.TRAVEL_AGENT,
  ]);

  if (!input.customerId) {
    return { success: false, error: "Customer selection is required" };
  }

  const receiptAmount = new Decimal(input.amount || 0);
  if (receiptAmount.lte(0)) {
    return { success: false, error: "Receipt amount must be strictly greater than 0" };
  }

  const rate = new Decimal(input.exchangeRate || 1);
  if (rate.lte(0)) {
    return { success: false, error: "Exchange rate must be strictly positive" };
  }

  const baseAmount = receiptAmount.times(rate).toDecimalPlaces(2);

  try {
    const settings = await prisma.companySetting.findFirst();
    const prefix = settings?.receiptPrefix || "REC-";

    const count = await prisma.receipt.count();
    const receiptNumber = generateDocumentNumber(prefix, count + 1);

    // Validate allocations if provided
    let totalAllocatedForeign = new Decimal(0);
    const validatedAllocations: any[] = [];

    if (input.allocations && input.allocations.length > 0) {
      for (const alloc of input.allocations) {
        const allocForeign = new Decimal(alloc.amountForeign || 0);
        if (allocForeign.lte(0)) continue;

        const invoice = await prisma.invoice.findUnique({
          where: { id: alloc.invoiceId },
        });
        if (!invoice) {
          return { success: false, error: `Invoice ${alloc.invoiceId} not found` };
        }

        const allocBase = allocForeign.times(rate).toDecimalPlaces(2); // At receipt rate
        const invoiceSettledBase = allocForeign.times(invoice.exchangeRate).toDecimalPlaces(2); // At invoice rate
        const fxDiff = allocBase.minus(invoiceSettledBase);

        totalAllocatedForeign = totalAllocatedForeign.plus(allocForeign);
        validatedAllocations.push({
          invoiceId: alloc.invoiceId,
          amountForeign: allocForeign.toString(),
          amountBase: allocBase.toString(),
          invoiceSettledBase: invoiceSettledBase.toString(),
          fxGainLossAmount: fxDiff.toString(),
        });
      }

      if (totalAllocatedForeign.gt(receiptAmount)) {
        return {
          success: false,
          error: `Total invoice allocations (${totalAllocatedForeign}) cannot exceed the receipt amount (${receiptAmount})`,
        };
      }
    }

    const unallocatedForeign = receiptAmount.minus(totalAllocatedForeign);
    const unallocatedBase = unallocatedForeign.times(rate).toDecimalPlaces(2);
    const initialStatus = input.status || ReceiptStatus.DRAFT;

    const newReceipt = await prisma.$transaction(async (tx) => {
      const created = await tx.receipt.create({
        data: {
          receiptNumber,
          customerId: input.customerId,
          bookingId: input.bookingId || null,
          createdById: currentUser.id,
          paymentDate: new Date(input.paymentDate),
          paymentMethod: input.paymentMethod || PaymentMethod.CASH,
          status: initialStatus,
          currency: input.currency.toUpperCase(),
          exchangeRate: rate.toString(),
          amount: receiptAmount.toString(),
          baseAmount: baseAmount.toString(),
          unallocatedAmount: unallocatedForeign.toString(),
          unallocatedBase: unallocatedBase.toString(),
          bankAccountId: input.bankAccountId,
          bankReference: input.bankReference?.trim() || null,
          notes: input.notes?.trim() || null,
          allocations: {
            create: validatedAllocations.map((a) => ({
              invoiceId: a.invoiceId,
              amountForeign: a.amountForeign,
              amountBase: a.amountBase,
              invoiceSettledBase: a.invoiceSettledBase,
              fxGainLossAmount: a.fxGainLossAmount,
              allocatedById: currentUser.id,
            })),
          },
        },
      });

      if (initialStatus === ReceiptStatus.POSTED) {
        await postReceiptToGL(tx, created.id, currentUser.id);
      }

      return created;
    });

    await recordAuditLog({
      userId: currentUser.id,
      action: "CREATE",
      entityName: "Receipt",
      entityId: newReceipt.id,
      newValues: {
        receiptNumber: newReceipt.receiptNumber,
        amount: receiptAmount.toNumber(),
        baseAmountAFN: baseAmount.toNumber(),
        status: newReceipt.status,
      },
    });

    revalidatePath("/receipts");
    return { success: true, data: { id: newReceipt.id, receiptNumber: newReceipt.receiptNumber } };
  } catch (error: any) {
    console.error("Error creating receipt:", error);
    return { success: false, error: error.message || "Failed to create receipt" };
  }
}

export async function approveReceipt(id: string) {
  const currentUser = await requireRole([
    UserRole.ADMIN,
    UserRole.MANAGER,
    UserRole.ACCOUNTANT,
  ]);

  try {
    const receipt = await prisma.receipt.findUnique({
      where: { id },
      select: { id: true, status: true, receiptNumber: true },
    });

    if (!receipt) return { success: false, error: "Receipt not found" };
    if (receipt.status !== ReceiptStatus.DRAFT) {
      return { success: false, error: `Only Draft receipts can be approved (Current: ${receipt.status})` };
    }

    await prisma.receipt.update({
      where: { id },
      data: {
        status: ReceiptStatus.APPROVED,
        approvedAt: new Date(),
        approvedById: currentUser.id,
      },
    });

    await recordAuditLog({
      userId: currentUser.id,
      action: "UPDATE",
      entityName: "Receipt",
      entityId: id,
      newValues: { status: ReceiptStatus.APPROVED, approvedBy: currentUser.name },
    });

    revalidatePath(`/receipts/${id}`);
    revalidatePath("/receipts");
    return { success: true };
  } catch (error: any) {
    console.error("Error approving receipt:", error);
    return { success: false, error: error.message || "Failed to approve receipt" };
  }
}

export async function postReceipt(id: string) {
  const currentUser = await requireRole([
    UserRole.ADMIN,
    UserRole.MANAGER,
    UserRole.ACCOUNTANT,
  ]);

  try {
    const result = await prisma.$transaction(async (tx) => {
      return await postReceiptToGL(tx, id, currentUser.id);
    });

    await recordAuditLog({
      userId: currentUser.id,
      action: "UPDATE",
      entityName: "Receipt",
      entityId: id,
      newValues: {
        status: ReceiptStatus.POSTED,
        postedBy: currentUser.name,
        journalEntryId: result.journalEntry.id,
        entryNumber: result.journalEntry.entryNumber,
      },
    });

    revalidatePath(`/receipts/${id}`);
    revalidatePath("/receipts");
    revalidatePath("/invoices");
    revalidatePath("/customers");
    return { success: true, data: result };
  } catch (error: any) {
    console.error("Error posting receipt:", error);
    return { success: false, error: error.message || "Failed to post receipt to General Ledger" };
  }
}

export async function cancelReceipt(id: string, reason: string) {
  const currentUser = await requireRole([
    UserRole.ADMIN,
    UserRole.MANAGER,
    UserRole.ACCOUNTANT,
  ]);

  if (!reason || reason.trim().length < 5) {
    return { success: false, error: "Detailed cancellation reason is required (minimum 5 characters)" };
  }

  try {
    const receipt = await prisma.receipt.findUnique({
      where: { id },
      select: { id: true, status: true, receiptNumber: true, journalEntryId: true },
    });

    if (!receipt) return { success: false, error: "Receipt not found" };
    if (receipt.status === ReceiptStatus.CANCELLED) {
      return { success: false, error: "Receipt is already cancelled" };
    }

    if (receipt.status === ReceiptStatus.POSTED) {
      await prisma.$transaction(async (tx) => {
        await reverseReceiptGL(tx, id, reason.trim(), currentUser.id);
      });
    } else {
      await prisma.receipt.update({
        where: { id },
        data: {
          status: ReceiptStatus.CANCELLED,
          cancellationReason: reason.trim(),
          cancelledAt: new Date(),
          cancelledById: currentUser.id,
        },
      });
    }

    await recordAuditLog({
      userId: currentUser.id,
      action: "CANCEL",
      entityName: "Receipt",
      entityId: id,
      newValues: {
        status: ReceiptStatus.CANCELLED,
        cancellationReason: reason.trim(),
        cancelledBy: currentUser.name,
      },
    });

    revalidatePath(`/receipts/${id}`);
    revalidatePath("/receipts");
    revalidatePath("/invoices");
    revalidatePath("/customers");
    return { success: true };
  } catch (error: any) {
    console.error("Error cancelling receipt:", error);
    return { success: false, error: error.message || "Failed to cancel receipt" };
  }
}

export async function allocateCustomerAdvanceAction(input: {
  receiptId: string;
  invoiceId: string;
  amountForeign: number | string;
}) {
  const currentUser = await requireRole([
    UserRole.ADMIN,
    UserRole.MANAGER,
    UserRole.ACCOUNTANT,
  ]);

  try {
    const result = await prisma.$transaction(async (tx) => {
      return await allocateCustomerAdvanceToInvoice(tx, {
        receiptId: input.receiptId,
        invoiceId: input.invoiceId,
        amountToAllocateForeign: input.amountForeign,
        userId: currentUser.id,
      });
    });

    await recordAuditLog({
      userId: currentUser.id,
      action: "CREATE",
      entityName: "Receipt",
      entityId: result.allocation.id,
      newValues: {
        receiptId: input.receiptId,
        invoiceId: input.invoiceId,
        amount: input.amountForeign,
        journalEntryId: result.journalEntry.id,
      },
    });

    revalidatePath(`/receipts/${input.receiptId}`);
    revalidatePath(`/invoices/${input.invoiceId}`);
    revalidatePath("/invoices");
    revalidatePath("/receipts");
    revalidatePath("/customers");
    return { success: true, data: result };
  } catch (error: any) {
    console.error("Error allocating customer advance:", error);
    return { success: false, error: error.message || "Failed to allocate customer advance" };
  }
}

export async function reverseCustomerAdvanceAllocationAction(
  allocationId: string,
  reason: string
) {
  const currentUser = await requireRole([
    UserRole.ADMIN,
    UserRole.MANAGER,
    UserRole.ACCOUNTANT,
  ]);

  if (!reason || reason.trim().length < 5) {
    return { success: false, error: "Detailed cancellation reason is required (minimum 5 characters)" };
  }

  try {
    const result = await prisma.$transaction(async (tx) => {
      return await reverseAdvanceAllocationGL(tx, allocationId, reason.trim(), currentUser.id);
    });

    await recordAuditLog({
      userId: currentUser.id,
      action: "REVERSE",
      entityName: "Receipt",
      entityId: allocationId,
      newValues: {
        reason: reason.trim(),
        reversalEntryId: result.reversalEntry.id,
      },
    });

    revalidatePath("/invoices");
    revalidatePath("/receipts");
    revalidatePath("/customers");
    return { success: true, data: result };
  } catch (error: any) {
    console.error("Error reversing advance allocation:", error);
    return { success: false, error: error.message || "Failed to reverse advance allocation" };
  }
}
