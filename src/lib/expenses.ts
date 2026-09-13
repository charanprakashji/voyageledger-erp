import Decimal from "decimal.js";
import {
  toDecimal,
  validateJournalEntryBalance,
  createReversalLines,
} from "./accounting";
import { assertPeriodOpen } from "@/app/actions/periods";
import { ExpenseStatus, PaymentMethod } from "@prisma/client";

// Set precision
Decimal.set({ precision: 28, rounding: Decimal.ROUND_HALF_UP });

export interface ExpenseLineInput {
  expenseAccountId: string;
  description: string;
  amountForeign: number | string | Decimal;
  taxRate?: number | string | Decimal;
  taxAccountId?: string;
}

export function generateDocumentNumber(
  prefix: string,
  sequence: number,
  year: number = new Date().getFullYear()
): string {
  const cleanPrefix = prefix.replace(/-+$/, "");
  const pad = String(sequence).padStart(6, "0");
  return `${cleanPrefix}-${year}-${pad}`;
}

/**
 * Calculates total and base amounts for an Expense Voucher.
 */
export function calculateExpenseTotals(
  lines: ExpenseLineInput[],
  exchangeRate: number | string | Decimal
): {
  totalAmountForeign: Decimal;
  totalAmountBase: Decimal;
  amountForeign: Decimal;
  amountBase: Decimal;
  calculatedLines: Array<{
    expenseAccountId: string;
    description: string;
    amountForeign: Decimal;
    amountBase: Decimal;
  }>;
  lines: Array<{
    expenseAccountId: string;
    description: string;
    amountForeign: Decimal;
    amountBase: Decimal;
  }>;
} {
  const rate = new Decimal(exchangeRate || 1);
  if (rate.lte(0)) {
    throw new Error("Exchange rate must be strictly positive");
  }

  let totalAmountForeign = new Decimal(0);
  let totalAmountBase = new Decimal(0);

  const calculatedLines = lines.map((line) => {
    const amountForeign = toDecimal(line.amountForeign);
    if (amountForeign.lte(0)) {
      throw new Error("Expense line amount must be strictly greater than zero");
    }
    const amountBase = amountForeign.times(rate).toDecimalPlaces(2);

    totalAmountForeign = totalAmountForeign.plus(amountForeign);
    totalAmountBase = totalAmountBase.plus(amountBase);

    return {
      expenseAccountId: line.expenseAccountId,
      description: line.description,
      amountForeign,
      amountBase,
    };
  });

  return {
    totalAmountForeign,
    totalAmountBase,
    amountForeign: totalAmountForeign,
    amountBase: totalAmountBase,
    calculatedLines,
    lines: calculatedLines,
  };
}

/**
 * Posts an approved Direct Expense Voucher to the General Ledger.
 * Journal:
 *  DR 60XX Operating Expense Accounts (for each line item)
 *  CR 1010/1020 Bank / Cash Account (for total base amount)
 */
export async function postExpenseToGL(
  tx: any,
  expenseId: string,
  userId: string
) {
  const expense = await tx.expense.findUnique({
    where: { id: expenseId },
    include: {
      lines: {
        include: {
          expenseAccount: true,
        },
      },
      bankAccount: true,
      supplier: true,
    },
  });

  if (!expense) {
    throw new Error(`Expense ${expenseId} not found`);
  }

  if (expense.status === ExpenseStatus.POSTED) {
    throw new Error("Expense is already posted to the General Ledger");
  }

  if (expense.status === ExpenseStatus.CANCELLED) {
    throw new Error("Cancelled expense cannot be posted");
  }

  if (expense.journalEntryId) {
    throw new Error("Expense already has an attached Journal Entry reference");
  }

  // Check period
  await assertPeriodOpen(expense.expenseDate);

  const totalBase = toDecimal(expense.baseAmount);
  if (totalBase.lte(0)) {
    throw new Error("Cannot post an expense with zero or negative total amount");
  }

  const lines: any[] = [];

  // 1. DEBITS: Operating Expense lines
  for (const line of expense.lines) {
    const lineBase = toDecimal(line.amountBase);
    lines.push({
      accountId: line.expenseAccountId,
      debit: lineBase.toNumber(),
      credit: 0,
      currency: expense.currency,
      exchangeRate: Number(expense.exchangeRate),
      foreignDebit: Number(line.amountForeign),
      foreignCredit: 0,
      description: `${expense.expenseNumber}: ${line.description}`,
      supplierId: expense.supplierId,
    });
  }

  // 2. CREDIT: Bank/Cash Account
  lines.push({
    accountId: expense.bankAccountId,
    debit: 0,
    credit: totalBase.toNumber(),
    currency: expense.currency,
    exchangeRate: Number(expense.exchangeRate),
    foreignDebit: 0,
    foreignCredit: Number(expense.amount),
    description: `Expense Payment ${expense.expenseNumber} - ${expense.payee || expense.description}`,
    supplierId: expense.supplierId,
  });

  const balanceCheck = validateJournalEntryBalance(lines);
  if (!balanceCheck.isValid) {
    throw new Error(`Expense Journal Entry is unbalanced: ${balanceCheck.difference.toString()} AFN difference`);
  }

  const jeCount = await tx.journalEntry.count();
  const entryNumber = `JE-${new Date(expense.expenseDate).getFullYear()}-${String(jeCount + 1).padStart(5, "0")}`;

  const journalEntry = await tx.journalEntry.create({
    data: {
      entryNumber,
      entryDate: expense.expenseDate,
      description: `Expense ${expense.expenseNumber} - ${expense.description}`,
      referenceType: "EXPENSE",
      referenceId: expense.id,
      status: "POSTED",
      createdById: userId,
      postedAt: new Date(),
      lines: {
        create: lines.map((l) => ({
          accountId: l.accountId,
          debit: l.debit.toString(),
          credit: l.credit.toString(),
          currency: l.currency,
          exchangeRate: (l.exchangeRate || 1).toString(),
          foreignDebit: toDecimal(l.foreignDebit).toString(),
          foreignCredit: toDecimal(l.foreignCredit).toString(),
          description: l.description,
          supplierId: l.supplierId || null,
        })),
      },
    },
  });

  const updatedExpense = await tx.expense.update({
    where: { id: expense.id },
    data: {
      status: ExpenseStatus.POSTED,
      postedAt: new Date(),
      postedById: userId,
      journalEntryId: journalEntry.id,
    },
  });

  return { expense: updatedExpense, journalEntry };
}

/**
 * Reverses a posted Expense voucher.
 * Creates an exact reversing JournalEntry (DR Bank/Cash / CR Expense Accounts).
 */
export async function reverseExpenseGL(
  tx: any,
  expenseId: string,
  reason: string,
  userId: string
) {
  const expense = await tx.expense.findUnique({
    where: { id: expenseId },
    include: {
      journalEntry: {
        include: { lines: true },
      },
    },
  });

  if (!expense) {
    throw new Error("Expense voucher not found");
  }

  if (expense.status !== ExpenseStatus.POSTED) {
    throw new Error("Only posted expenses can be reversed");
  }

  if (!expense.journalEntry) {
    throw new Error("No posted journal entry found to reverse");
  }

  const reversalLines = createReversalLines(expense.journalEntry.lines);
  const jeCount = await tx.journalEntry.count();
  const entryNumber = `REV-${new Date().getFullYear()}-${String(jeCount + 1).padStart(5, "0")}`;

  const reversalEntry = await tx.journalEntry.create({
    data: {
      entryNumber,
      entryDate: new Date(),
      description: `Reversal of Expense ${expense.expenseNumber} - Reason: ${reason}`,
      referenceType: "REVERSAL",
      referenceId: expense.id,
      reversalOfId: expense.journalEntry.id,
      status: "POSTED",
      createdById: userId,
      postedAt: new Date(),
      lines: {
        create: reversalLines.map((l) => ({
          accountId: l.accountId,
          debit: l.debit.toString(),
          credit: l.credit.toString(),
          currency: l.currency || "AFN",
          exchangeRate: (l.exchangeRate || 1).toString(),
          foreignDebit: toDecimal(l.foreignDebit).toString(),
          foreignCredit: toDecimal(l.foreignCredit).toString(),
          description: l.description,
          supplierId: l.supplierId || null,
        })),
      },
    },
  });

  const cancelledExpense = await tx.expense.update({
    where: { id: expense.id },
    data: {
      status: ExpenseStatus.CANCELLED,
      cancellationReason: reason,
      cancelledAt: new Date(),
      cancelledById: userId,
    },
  });

  return { expense: cancelledExpense, reversalEntry };
}
