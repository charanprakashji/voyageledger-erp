"use server";

import prisma from "@/lib/prisma";
import { getCurrentUser, requireRole, handleActionError } from "@/lib/auth";
import { recordAuditLog } from "@/lib/audit";
import {
  calculateInvoiceTotals,
  generateDocumentNumber,
  postInvoiceToGL,
  reverseInvoiceGL,
} from "@/lib/invoicing";
import { InvoiceStatus, ServiceType, UserRole } from "@prisma/client";
import { revalidatePath } from "next/cache";

export interface InvoiceLineInput {
  id?: string;
  bookingServiceItemId?: string;
  serviceType: ServiceType;
  description: string;
  quantity: number;
  unitPriceForeign: number | string;
  discountForeign?: number | string;
  taxRate?: number | string;
  revenueAccountId?: string;
  taxLiabilityAccountId?: string;
}

export interface CreateInvoiceInput {
  customerId: string;
  bookingId?: string;
  currency: string;
  exchangeRate: number | string;
  issueDate: string;
  dueDate: string;
  paymentTerms?: string;
  notes?: string;
  terms?: string;
  status?: InvoiceStatus;
  lines: InvoiceLineInput[];
}

export async function getInvoices(params?: {
  search?: string;
  status?: InvoiceStatus;
  customerId?: string;
  bookingId?: string;
  page?: number;
  limit?: number;
}) {
  const page = Math.max(1, params?.page || 1);
  const limit = Math.min(100, Math.max(1, params?.limit || 20));
  const skip = (page - 1) * limit;

  try {
    await requireRole([
      UserRole.ADMIN,
      UserRole.MANAGER,
      UserRole.ACCOUNTANT,
      UserRole.TRAVEL_AGENT,
      UserRole.AUDITOR,
    ]);

    const where: any = {};
    if (params?.status) where.status = params.status;
    if (params?.customerId) where.customerId = params.customerId;
    if (params?.bookingId) where.bookingId = params.bookingId;

    if (params?.search) {
      const s = params.search.trim();
      where.OR = [
        { invoiceNumber: { contains: s, mode: "insensitive" } },
        { customer: { name: { contains: s, mode: "insensitive" } } },
        { customer: { companyName: { contains: s, mode: "insensitive" } } },
      ];
    }

    const [total, invoices] = await Promise.all([
      prisma.invoice.count({ where }),
      prisma.invoice.findMany({
        where,
        include: {
          customer: { select: { id: true, name: true, code: true, companyName: true } },
          booking: { select: { id: true, bookingNumber: true, pnr: true } },
          createdBy: { select: { id: true, name: true, role: true } },
          lines: true,
        },
        orderBy: { issueDate: "desc" },
        skip,
        take: limit,
      }),
    ]);

    return {
      success: true,
      data: invoices.map((inv) => ({
        ...inv,
        foreignSubTotal: Number(inv.foreignSubTotal),
        baseSubTotal: Number(inv.baseSubTotal),
        discountAmount: Number(inv.discountAmount),
        taxableAmount: Number(inv.taxableAmount),
        taxAmount: Number(inv.taxAmount),
        grandTotal: Number(inv.grandTotal),
        paidAmount: Number(inv.paidAmount),
        balanceDue: Number(inv.balanceDue),
        baseGrandTotal: Number(inv.baseGrandTotal),
        exchangeRate: Number(inv.exchangeRate),
      })),
      pagination: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      },
    };
  } catch (error: any) {
    const safeErr = handleActionError(error, "Failed to retrieve invoices");
    return {
      success: false,
      error: safeErr.error,
      data: [],
      pagination: { total: 0, page: 1, limit, totalPages: 0 },
    };
  }
}

export async function getInvoiceById(id: string) {
  try {
    await requireRole([
      UserRole.ADMIN,
      UserRole.MANAGER,
      UserRole.ACCOUNTANT,
      UserRole.TRAVEL_AGENT,
      UserRole.AUDITOR,
    ]);

    const invoice = await prisma.invoice.findUnique({
      where: { id },
      include: {
        customer: true,
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
            revenueAccount: true,
            taxLiabilityAccount: true,
          },
        },
        receiptAllocations: {
          include: {
            receipt: true,
          },
        },
      },
    });

    if (!invoice) {
      return { success: false, error: "Invoice not found" };
    }

    return {
      success: true,
      data: {
        ...invoice,
        foreignSubTotal: Number(invoice.foreignSubTotal),
        baseSubTotal: Number(invoice.baseSubTotal),
        discountAmount: Number(invoice.discountAmount),
        taxableAmount: Number(invoice.taxableAmount),
        taxAmount: Number(invoice.taxAmount),
        grandTotal: Number(invoice.grandTotal),
        paidAmount: Number(invoice.paidAmount),
        balanceDue: Number(invoice.balanceDue),
        baseGrandTotal: Number(invoice.baseGrandTotal),
        exchangeRate: Number(invoice.exchangeRate),
        lines: invoice.lines.map((l) => ({
          ...l,
          unitPriceForeign: Number(l.unitPriceForeign),
          unitPriceBase: Number(l.unitPriceBase),
          discountForeign: Number(l.discountForeign),
          discountBase: Number(l.discountBase),
          taxRate: Number(l.taxRate),
          taxAmountForeign: Number(l.taxAmountForeign),
          taxAmountBase: Number(l.taxAmountBase),
          totalAmountForeign: Number(l.totalAmountForeign),
          totalAmountBase: Number(l.totalAmountBase),
        })),
        receiptAllocations: invoice.receiptAllocations.map((a) => ({
          ...a,
          amountForeign: Number(a.amountForeign),
          amountBase: Number(a.amountBase),
          invoiceSettledBase: Number(a.invoiceSettledBase),
          fxGainLossAmount: Number(a.fxGainLossAmount),
        })),
      },
    };
  } catch (error: any) {
    return handleActionError(error, "Failed to load invoice");
  }
}

export async function createInvoice(input: CreateInvoiceInput) {
  try {
    const currentUser = await requireRole([
      UserRole.ADMIN,
      UserRole.MANAGER,
      UserRole.ACCOUNTANT,
      UserRole.TRAVEL_AGENT,
    ]);

    if (!input.customerId) {
      return { success: false, error: "Customer is required" };
    }

    if (!input.lines || input.lines.length === 0) {
      return { success: false, error: "Invoice must contain at least one line item" };
    }

    const settings = await prisma.companySetting.findFirst();
    const prefix = settings?.invoicePrefix || "INV-";

    // Concurrency safe document sequence
    const count = await prisma.invoice.count();
    const invoiceNumber = generateDocumentNumber(prefix, count + 1);

    const totals = calculateInvoiceTotals(
      input.lines.map((l) => ({
        ...l,
        exchangeRate: input.exchangeRate,
      }))
    );

    const initialStatus = input.status || InvoiceStatus.DRAFT;

    const newInvoice = await prisma.$transaction(async (tx) => {
      const created = await tx.invoice.create({
        data: {
          invoiceNumber,
          customerId: input.customerId,
          bookingId: input.bookingId || null,
          createdById: currentUser.id,
          issueDate: new Date(input.issueDate),
          dueDate: new Date(input.dueDate),
          status: initialStatus,
          currency: input.currency.toUpperCase(),
          exchangeRate: input.exchangeRate.toString(),
          foreignSubTotal: totals.foreignSubTotal.toString(),
          baseSubTotal: totals.baseSubTotal.toString(),
          discountAmount: totals.discountAmount.toString(),
          taxableAmount: totals.taxableAmount.toString(),
          taxAmount: totals.taxAmount.toString(),
          grandTotal: totals.grandTotal.toString(),
          paidAmount: "0.00",
          balanceDue: totals.grandTotal.toString(),
          baseGrandTotal: totals.baseGrandTotal.toString(),
          paymentTerms: input.paymentTerms || "Net 30 Days",
          notes: input.notes?.trim() || null,
          terms: input.terms?.trim() || null,
          lines: {
            create: totals.lines.map((l) => ({
              bookingServiceItemId: l.bookingServiceItemId || null,
              serviceType: l.serviceType,
              description: l.description.trim(),
              quantity: l.quantity,
              unitPriceForeign: l.unitPriceForeign.toString(),
              unitPriceBase: l.unitPriceBase.toString(),
              discountForeign: l.discountForeign.toString(),
              discountBase: l.discountBase.toString(),
              taxRate: l.taxRate.toString(),
              taxAmountForeign: l.taxAmountForeign.toString(),
              taxAmountBase: l.taxAmountBase.toString(),
              totalAmountForeign: l.totalAmountForeign.toString(),
              totalAmountBase: l.totalAmountBase.toString(),
              revenueAccountId: l.revenueAccountId!,
              taxLiabilityAccountId: l.taxLiabilityAccountId || null,
            })),
          },
        },
      });

      // If created directly in POSTED status (e.g. by Accountant/Admin)
      if (initialStatus === InvoiceStatus.POSTED) {
        await postInvoiceToGL(tx, created.id, currentUser.id);
      }

      return created;
    });

    await recordAuditLog({
      userId: currentUser.id,
      action: "CREATE",
      entityName: "Invoice",
      entityId: newInvoice.id,
      newValues: {
        invoiceNumber: newInvoice.invoiceNumber,
        grandTotal: totals.grandTotal.toNumber(),
        baseGrandTotalAFN: totals.baseGrandTotal.toNumber(),
        status: newInvoice.status,
      },
    });

    revalidatePath("/invoices");
    return { success: true as const, data: { id: newInvoice.id, invoiceNumber: newInvoice.invoiceNumber } };
  } catch (error: any) {
    return handleActionError(error, "Failed to create invoice");
  }
}

export async function approveInvoice(id: string) {
  try {
    const currentUser = await requireRole([
      UserRole.ADMIN,
      UserRole.MANAGER,
      UserRole.ACCOUNTANT,
    ]);

    const invoice = await prisma.invoice.findUnique({
      where: { id },
      select: { id: true, status: true, invoiceNumber: true },
    });

    if (!invoice) return { success: false, error: "Invoice not found" };
    if (invoice.status !== InvoiceStatus.DRAFT) {
      return { success: false, error: `Only Draft invoices can be approved (Current: ${invoice.status})` };
    }

    await prisma.invoice.update({
      where: { id },
      data: {
        status: InvoiceStatus.APPROVED,
        approvedAt: new Date(),
        approvedById: currentUser.id,
      },
    });

    await recordAuditLog({
      userId: currentUser.id,
      action: "UPDATE",
      entityName: "Invoice",
      entityId: id,
      newValues: { status: InvoiceStatus.APPROVED, approvedBy: currentUser.name },
    });

    revalidatePath(`/invoices/${id}`);
    revalidatePath("/invoices");
    return { success: true as const };
  } catch (error: any) {
    return handleActionError(error, "Failed to approve invoice");
  }
}

export async function postInvoice(id: string) {
  try {
    const currentUser = await requireRole([
      UserRole.ADMIN,
      UserRole.MANAGER,
      UserRole.ACCOUNTANT,
    ]);

    const result = await prisma.$transaction(async (tx) => {
      return await postInvoiceToGL(tx, id, currentUser.id);
    });

    await recordAuditLog({
      userId: currentUser.id,
      action: "UPDATE",
      entityName: "Invoice",
      entityId: id,
      newValues: {
        status: InvoiceStatus.POSTED,
        postedBy: currentUser.name,
        journalEntryId: result.journalEntry.id,
        entryNumber: result.journalEntry.entryNumber,
      },
    });

    revalidatePath(`/invoices/${id}`);
    revalidatePath("/invoices");
    revalidatePath("/customers");
    return { success: true as const, data: result };
  } catch (error: any) {
    return handleActionError(error, "Failed to post invoice to General Ledger");
  }
}

export async function cancelInvoice(id: string, reason: string) {
  try {
    const currentUser = await requireRole([
      UserRole.ADMIN,
      UserRole.MANAGER,
      UserRole.ACCOUNTANT,
    ]);

    if (!reason || reason.trim().length < 5) {
      return { success: false, error: "Detailed cancellation reason is mandatory (minimum 5 characters)" };
    }

    const invoice = await prisma.invoice.findUnique({
      where: { id },
      select: { id: true, status: true, invoiceNumber: true, journalEntryId: true },
    });

    if (!invoice) return { success: false, error: "Invoice not found" };
    if (invoice.status === InvoiceStatus.CANCELLED) {
      return { success: false, error: "Invoice is already cancelled" };
    }

    if (invoice.status === InvoiceStatus.POSTED || invoice.status === InvoiceStatus.PARTIALLY_PAID) {
      // Must execute General Ledger Reversal Entry
      await prisma.$transaction(async (tx) => {
        await reverseInvoiceGL(tx, id, reason.trim(), currentUser.id);
      });
    } else {
      // Draft / Approved can be cancelled directly
      await prisma.invoice.update({
        where: { id },
        data: {
          status: InvoiceStatus.CANCELLED,
          cancellationReason: reason.trim(),
          cancelledAt: new Date(),
          cancelledById: currentUser.id,
        },
      });
    }

    await recordAuditLog({
      userId: currentUser.id,
      action: "CANCEL",
      entityName: "Invoice",
      entityId: id,
      newValues: {
        status: InvoiceStatus.CANCELLED,
        cancellationReason: reason.trim(),
        cancelledBy: currentUser.name,
      },
    });

    revalidatePath(`/invoices/${id}`);
    revalidatePath("/invoices");
    revalidatePath("/customers");
    return { success: true as const };
  } catch (error: any) {
    return handleActionError(error, "Failed to cancel invoice");
  }
}
