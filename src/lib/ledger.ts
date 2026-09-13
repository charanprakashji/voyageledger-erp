import { db } from "@/lib/db";
import { toDecimal } from "@/lib/accounting";
import Decimal from "decimal.js";

export interface DerivedLedgerTransaction {
  id: string;
  journalEntryId: string;
  entryNumber: string;
  entryDate: Date;
  referenceType: string | null;
  referenceId: string | null;
  description: string;
  accountCode: string;
  accountName: string;
  debitAFN: Decimal;
  creditAFN: Decimal;
  runningBalanceAFN: Decimal;
  currency: string;
  exchangeRate: Decimal;
  foreignDebit: Decimal;
  foreignCredit: Decimal;
}

export interface CustomerLedgerSummary {
  customerId: string;
  customerName: string;
  openingBalance: string;
  totalDebits: string;
  totalCredits: string;
  closingBalance: string;
  totalDebitsAFN: Decimal;
  totalCreditsAFN: Decimal;
  outstandingBalanceAFN: Decimal;
  transactions: {
    date: string;
    type: string;
    referenceNumber: string | null;
    description: string;
    debit: string;
    credit: string;
    runningBalance: string;
  }[];
}

export interface SupplierLedgerSummary {
  supplierId: string;
  supplierName: string;
  openingBalance: string;
  totalDebits: string;
  totalCredits: string;
  closingBalance: string;
  totalDebitsAFN: Decimal;
  totalCreditsAFN: Decimal;
  outstandingPayableAFN: Decimal;
  transactions: {
    date: string;
    type: string;
    referenceNumber: string | null;
    description: string;
    debit: string;
    credit: string;
    runningBalance: string;
  }[];
}

/**
 * Derives Customer Accounts Receivable Subsidiary Ledger dynamically
 * from POSTED General Ledger Journal Lines tagged with customerId.
 */
export async function getCustomerDerivedLedger(
  customerId: string,
  fromDate?: Date,
  toDate?: Date
): Promise<CustomerLedgerSummary> {
  const customer = await db.customer.findUnique({
    where: { id: customerId },
    select: { id: true, name: true },
  });

  if (!customer) {
    throw new Error(`Customer with ID ${customerId} not found.`);
  }

  // Calculate opening balance if fromDate is provided
  let openingBalance = new Decimal(0);
  if (fromDate) {
    const priorLines = await db.journalLine.findMany({
      where: {
        customerId,
        journalEntry: {
          status: "POSTED",
          entryDate: { lt: fromDate },
        },
      },
      select: { debit: true, credit: true },
    });
    for (const pl of priorLines) {
      openingBalance = openingBalance.plus(
        new Decimal(pl.debit.toString()).minus(new Decimal(pl.credit.toString()))
      );
    }
  }

  const whereClause: any = {
    customerId,
    journalEntry: {
      status: "POSTED",
      ...(fromDate || toDate
        ? {
            entryDate: {
              ...(fromDate ? { gte: fromDate } : {}),
              ...(toDate ? { lte: toDate } : {}),
            },
          }
        : {}),
    },
  };

  const lines = await db.journalLine.findMany({
    where: whereClause,
    include: {
      journalEntry: {
        select: {
          id: true,
          entryNumber: true,
          entryDate: true,
          referenceType: true,
          referenceId: true,
          description: true,
        },
      },
      account: {
        select: {
          code: true,
          name: true,
          accountType: true,
        },
      },
    },
    orderBy: [
      { journalEntry: { entryDate: "asc" } },
      { createdAt: "asc" },
    ],
  });

  let runningBalance = new Decimal(openingBalance);
  let totalDebits = new Decimal(0);
  let totalCredits = new Decimal(0);

  const formattedTransactions = lines.map((line) => {
    const debit = toDecimal(line.debit);
    const credit = toDecimal(line.credit);

    runningBalance = runningBalance.plus(debit).minus(credit);
    totalDebits = totalDebits.plus(debit);
    totalCredits = totalCredits.plus(credit);

    return {
      date: line.journalEntry.entryDate.toISOString().split("T")[0],
      type: line.journalEntry.referenceType || "JOURNAL",
      referenceNumber: line.journalEntry.referenceId || line.journalEntry.entryNumber,
      description: line.description || line.journalEntry.description,
      debit: debit.toFixed(2),
      credit: credit.toFixed(2),
      runningBalance: runningBalance.toFixed(2),
    };
  });

  return {
    customerId: customer.id,
    customerName: customer.name,
    openingBalance: openingBalance.toFixed(2),
    totalDebits: totalDebits.toFixed(2),
    totalCredits: totalCredits.toFixed(2),
    closingBalance: runningBalance.toFixed(2),
    totalDebitsAFN: totalDebits,
    totalCreditsAFN: totalCredits,
    outstandingBalanceAFN: runningBalance,
    transactions: formattedTransactions,
  };
}

/**
 * Derives Supplier Accounts Payable Subsidiary Ledger dynamically
 * from POSTED General Ledger Journal Lines tagged with supplierId.
 */
export async function getSupplierDerivedLedger(
  supplierId: string,
  fromDate?: Date,
  toDate?: Date
): Promise<SupplierLedgerSummary> {
  const supplier = await db.supplier.findUnique({
    where: { id: supplierId },
    select: { id: true, name: true },
  });

  if (!supplier) {
    throw new Error(`Supplier with ID ${supplierId} not found.`);
  }

  let openingBalance = new Decimal(0);
  if (fromDate) {
    const priorLines = await db.journalLine.findMany({
      where: {
        supplierId,
        journalEntry: {
          status: "POSTED",
          entryDate: { lt: fromDate },
        },
      },
      select: { debit: true, credit: true },
    });
    for (const pl of priorLines) {
      openingBalance = openingBalance.plus(
        new Decimal(pl.credit.toString()).minus(new Decimal(pl.debit.toString()))
      );
    }
  }

  const whereClause: any = {
    supplierId,
    journalEntry: {
      status: "POSTED",
      ...(fromDate || toDate
        ? {
            entryDate: {
              ...(fromDate ? { gte: fromDate } : {}),
              ...(toDate ? { lte: toDate } : {}),
            },
          }
        : {}),
    },
  };

  const lines = await db.journalLine.findMany({
    where: whereClause,
    include: {
      journalEntry: {
        select: {
          id: true,
          entryNumber: true,
          entryDate: true,
          referenceType: true,
          referenceId: true,
          description: true,
        },
      },
      account: {
        select: {
          code: true,
          name: true,
          accountType: true,
        },
      },
    },
    orderBy: [
      { journalEntry: { entryDate: "asc" } },
      { createdAt: "asc" },
    ],
  });

  let runningPayable = new Decimal(openingBalance);
  let totalDebits = new Decimal(0);
  let totalCredits = new Decimal(0);

  const formattedTransactions = lines.map((line) => {
    const debit = toDecimal(line.debit);
    const credit = toDecimal(line.credit);

    runningPayable = runningPayable.plus(credit).minus(debit);
    totalDebits = totalDebits.plus(debit);
    totalCredits = totalCredits.plus(credit);

    return {
      date: line.journalEntry.entryDate.toISOString().split("T")[0],
      type: line.journalEntry.referenceType || "JOURNAL",
      referenceNumber: line.journalEntry.referenceId || line.journalEntry.entryNumber,
      description: line.description || line.journalEntry.description,
      debit: debit.toFixed(2),
      credit: credit.toFixed(2),
      runningBalance: runningPayable.toFixed(2),
    };
  });

  return {
    supplierId: supplier.id,
    supplierName: supplier.name,
    openingBalance: openingBalance.toFixed(2),
    totalDebits: totalDebits.toFixed(2),
    totalCredits: totalCredits.toFixed(2),
    closingBalance: runningPayable.toFixed(2),
    totalDebitsAFN: totalDebits,
    totalCreditsAFN: totalCredits,
    outstandingPayableAFN: runningPayable,
    transactions: formattedTransactions,
  };
}
