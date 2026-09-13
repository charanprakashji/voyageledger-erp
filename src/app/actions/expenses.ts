"use server";

import prisma from "@/lib/prisma";
import { requireRole, handleActionError } from "@/lib/auth";
import { recordAuditLog } from "@/lib/audit";
import {
  calculateExpenseTotals,
  generateDocumentNumber,
  postExpenseToGL,
  reverseExpenseGL,
} from "@/lib/expenses";
import { ExpenseStatus, PaymentMethod, UserRole } from "@prisma/client";
import { revalidatePath } from "next/cache";

export interface ExpenseLineInput {
  id?: string;
  expenseAccountId: string;
  description: string;
  amountForeign: number | string;
  taxRate?: number | string;
  taxAccountId?: string;
}

export interface CreateExpenseInput {
  expenseDate: string;
  paymentMethod: string;
  bankAccountId: string;
  supplierId?: string;
  currency: string;
  exchangeRate: number | string;
  referenceNumber?: string;
  notes?: string;
  status?: ExpenseStatus;
  lines: ExpenseLineInput[];
}

export async function getExpenses(params?: {
  search?: string;
  status?: ExpenseStatus;
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
      UserRole.AUDITOR,
    ]);

    const where: any = {};
    if (params?.status) where.status = params.status;
    if (params?.search) {
      const s = params.search.trim();
      where.OR = [
        { expenseNumber: { contains: s, mode: "insensitive" } },
        { referenceNumber: { contains: s, mode: "insensitive" } },
        { supplier: { name: { contains: s, mode: "insensitive" } } },
      ];
    }

    const [total, expenses] = await Promise.all([
      prisma.expense.count({ where }),
      prisma.expense.findMany({
        where,
        include: {
          supplier: { select: { id: true, name: true, code: true } },
          bankAccount: { select: { id: true, code: true, name: true } },
          createdBy: { select: { id: true, name: true, role: true } },
          lines: {
            include: {
              expenseAccount: { select: { id: true, code: true, name: true } },
            },
          },
        },
        orderBy: { expenseDate: "desc" },
        skip,
        take: limit,
      }),
    ]);

    return {
      success: true,
      data: expenses.map((e) => ({
        ...e,
        amountForeign: Number(e.amount),
        amountBase: Number(e.baseAmount),
        exchangeRate: Number(e.exchangeRate),
      })),
      pagination: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      },
    };
  } catch (error: any) {
    const safeErr = handleActionError(error, "Failed to retrieve expenses");
    return {
      success: false,
      error: safeErr.error,
      data: [],
      pagination: { total: 0, page: 1, limit, totalPages: 0 },
    };
  }
}

export async function getExpenseById(id: string) {
  try {
    await requireRole([
      UserRole.ADMIN,
      UserRole.MANAGER,
      UserRole.ACCOUNTANT,
      UserRole.AUDITOR,
    ]);

    const expense = await prisma.expense.findUnique({
      where: { id },
      include: {
        supplier: true,
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
        lines: {
          include: {
            expenseAccount: true,
          },
        },
      },
    });

    if (!expense) return { success: false, error: "Expense not found" };

    return {
      success: true,
      data: {
        ...expense,
        amountForeign: Number(expense.amount),
        amountBase: Number(expense.baseAmount),
        exchangeRate: Number(expense.exchangeRate),
        lines: expense.lines.map((l: any) => ({
          ...l,
          amountForeign: Number(l.amountForeign),
          amountBase: Number(l.amountBase),
        })),
      },
    };
  } catch (error: any) {
    return handleActionError(error, "Failed to load expense");
  }
}

export async function createExpense(input: CreateExpenseInput) {
  try {
    const currentUser = await requireRole([
      UserRole.ADMIN,
      UserRole.MANAGER,
      UserRole.ACCOUNTANT,
    ]);

    if (!input.bankAccountId) return { success: false, error: "Bank/Cash account is required" };
    if (!input.lines || input.lines.length === 0) {
      return { success: false, error: "At least one expense line is required" };
    }

    const count = await prisma.expense.count();
    const expenseNumber = generateDocumentNumber("EXP-", count + 1);

    const totals = calculateExpenseTotals(input.lines, input.exchangeRate);
    const initialStatus = input.status || ExpenseStatus.DRAFT;

    const newExpense = await prisma.$transaction(async (tx) => {
      const created = await tx.expense.create({
        data: {
          expenseNumber,
          expenseDate: new Date(input.expenseDate),
          paymentMethod: (input.paymentMethod as PaymentMethod) || PaymentMethod.CASH,
          bankAccountId: input.bankAccountId,
          supplierId: input.supplierId || null,
          createdById: currentUser.id,
          currency: input.currency.toUpperCase(),
          exchangeRate: input.exchangeRate.toString(),
          amount: totals.amountForeign.toString(),
          baseAmount: totals.amountBase.toString(),
          status: initialStatus,
          referenceNumber: input.referenceNumber?.trim() || null,
          description: input.notes?.trim() || "Operating expense disbursement",
          lines: {
            create: totals.lines.map((l) => ({
              expenseAccountId: l.expenseAccountId,
              description: l.description.trim(),
              amountForeign: l.amountForeign.toString(),
              amountBase: l.amountBase.toString(),
            })),
          },
        },
      });

      if (initialStatus === ExpenseStatus.POSTED) {
        await postExpenseToGL(tx, created.id, currentUser.id);
      }

      return created;
    });

    await recordAuditLog({
      userId: currentUser.id,
      action: "CREATE",
      entityName: "Expense",
      entityId: newExpense.id,
      newValues: {
        expenseNumber: newExpense.expenseNumber,
        amountForeign: totals.amountForeign.toNumber(),
        amountBase: totals.amountBase.toNumber(),
        status: newExpense.status,
      },
    });

    revalidatePath("/expenses");
    return { success: true, data: { id: newExpense.id, expenseNumber: newExpense.expenseNumber } };
  } catch (error: any) {
    return handleActionError(error, "Failed to create expense");
  }
}

export async function approveExpense(id: string) {
  try {
    const currentUser = await requireRole([
      UserRole.ADMIN,
      UserRole.MANAGER,
      UserRole.ACCOUNTANT,
    ]);

    const expense = await prisma.expense.findUnique({
      where: { id },
      select: { id: true, status: true },
    });

    if (!expense) return { success: false, error: "Expense not found" };
    if (expense.status !== ExpenseStatus.DRAFT) {
      return { success: false, error: `Only Draft expenses can be approved (Current: ${expense.status})` };
    }

    await prisma.expense.update({
      where: { id },
      data: {
        status: ExpenseStatus.APPROVED,
        approvedAt: new Date(),
        approvedById: currentUser.id,
      },
    });

    await recordAuditLog({
      userId: currentUser.id,
      action: "UPDATE",
      entityName: "Expense",
      entityId: id,
      newValues: { status: ExpenseStatus.APPROVED, approvedBy: currentUser.name },
    });

    revalidatePath(`/expenses/${id}`);
    revalidatePath("/expenses");
    return { success: true };
  } catch (error: any) {
    return handleActionError(error, "Failed to approve expense");
  }
}

export async function postExpense(id: string) {
  try {
    const currentUser = await requireRole([
      UserRole.ADMIN,
      UserRole.MANAGER,
      UserRole.ACCOUNTANT,
    ]);

    const result = await prisma.$transaction(async (tx) => {
      return await postExpenseToGL(tx, id, currentUser.id);
    });

    revalidatePath(`/expenses/${id}`);
    revalidatePath("/expenses");
    return { success: true, data: result };
  } catch (error: any) {
    return handleActionError(error, "Failed to post expense to General Ledger");
  }
}

export async function cancelExpense(id: string, reason: string) {
  try {
    const currentUser = await requireRole([
      UserRole.ADMIN,
      UserRole.MANAGER,
      UserRole.ACCOUNTANT,
    ]);

    if (!reason || reason.trim().length < 5) {
      return { success: false, error: "Detailed cancellation reason is mandatory" };
    }

    const expense = await prisma.expense.findUnique({
      where: { id },
      select: { id: true, status: true },
    });

    if (!expense) return { success: false, error: "Expense not found" };
    if (expense.status === ExpenseStatus.CANCELLED) {
      return { success: false, error: "Expense is already cancelled" };
    }

    if (expense.status === ExpenseStatus.POSTED) {
      await prisma.$transaction(async (tx) => {
        await reverseExpenseGL(tx, id, reason.trim(), currentUser.id);
      });
    } else {
      await prisma.expense.update({
        where: { id },
        data: {
          status: ExpenseStatus.CANCELLED,
          cancellationReason: reason.trim(),
          cancelledAt: new Date(),
          cancelledById: currentUser.id,
        },
      });
    }

    revalidatePath(`/expenses/${id}`);
    revalidatePath("/expenses");
    return { success: true };
  } catch (error: any) {
    return handleActionError(error, "Failed to cancel expense");
  }
}
