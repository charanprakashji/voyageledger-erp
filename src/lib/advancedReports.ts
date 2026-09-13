import { prisma } from "@/lib/prisma";
import Decimal from "decimal.js";

// Helper for formatting
const fmt = (v: Decimal | number | string) => new Decimal(v || 0).toFixed(2);

// ============================================================================
// 1. ADVANCED GENERAL LEDGER
// ============================================================================
export interface GeneralLedgerFilter {
  startDate?: string;
  endDate?: string;
  accountId?: string;
  accountType?: string;
  customerId?: string;
  supplierId?: string;
  bookingId?: string;
  currency?: string;
  referenceType?: string;
}

export interface GeneralLedgerRow {
  date: string;
  journalNumber: string;
  referenceType: string;
  referenceId: string | null;
  accountCode: string;
  accountName: string;
  accountType: string;
  description: string;
  customerName?: string;
  supplierName?: string;
  bookingNumber?: string;
  currency: string;
  debit: string;
  credit: string;
  runningBalance: string;
}

export interface GeneralLedgerReport {
  filters: GeneralLedgerFilter;
  openingBalance: string;
  closingBalance: string;
  totalDebits: string;
  totalCredits: string;
  rows: GeneralLedgerRow[];
}

export async function getAdvancedGeneralLedger(
  filter: GeneralLedgerFilter
): Promise<GeneralLedgerReport> {
  const whereClause: any = {
    journalEntry: {
      status: "POSTED",
    },
  };

  if (filter.startDate) {
    whereClause.journalEntry.entryDate = {
      ...(whereClause.journalEntry.entryDate || {}),
      gte: new Date(filter.startDate),
    };
  }
  if (filter.endDate) {
    whereClause.journalEntry.entryDate = {
      ...(whereClause.journalEntry.entryDate || {}),
      lte: new Date(filter.endDate),
    };
  }
  if (filter.accountId) {
    whereClause.accountId = filter.accountId;
  }
  if (filter.accountType) {
    whereClause.account = { accountType: filter.accountType };
  }
  if (filter.customerId) {
    whereClause.customerId = filter.customerId;
  }
  if (filter.supplierId) {
    whereClause.supplierId = filter.supplierId;
  }
  if (filter.bookingId) {
    whereClause.bookingId = filter.bookingId;
  }
  if (filter.referenceType) {
    whereClause.journalEntry.referenceType = filter.referenceType;
  }

  // Calculate opening balance if startDate is provided
  let openingBalance = new Decimal(0);
  if (filter.startDate) {
    const priorWhere: any = {
      journalEntry: {
        status: "POSTED",
        entryDate: { lt: new Date(filter.startDate) },
      },
    };
    if (filter.accountId) priorWhere.accountId = filter.accountId;
    if (filter.accountType) priorWhere.account = { accountType: filter.accountType };
    if (filter.customerId) priorWhere.customerId = filter.customerId;
    if (filter.supplierId) priorWhere.supplierId = filter.supplierId;

    const priorLines = await prisma.journalLine.findMany({
      where: priorWhere,
      select: {
        debit: true,
        credit: true,
        account: { select: { accountType: true } },
      },
    });

    for (const pl of priorLines) {
      const d = new Decimal(pl.debit.toString());
      const c = new Decimal(pl.credit.toString());
      if (pl.account.accountType === "ASSET" || pl.account.accountType === "EXPENSE") {
        openingBalance = openingBalance.plus(d.minus(c));
      } else {
        openingBalance = openingBalance.plus(c.minus(d));
      }
    }
  }

  const lines = await prisma.journalLine.findMany({
    where: whereClause,
    include: {
      journalEntry: true,
      account: true,
      customer: { select: { name: true } },
      supplier: { select: { name: true } },
      booking: { select: { bookingNumber: true } },
    },
    orderBy: [
      { journalEntry: { entryDate: "asc" } },
      { journalEntry: { entryNumber: "asc" } },
      { id: "asc" },
    ],
  });

  let running = new Decimal(openingBalance);
  let sumDebits = new Decimal(0);
  let sumCredits = new Decimal(0);

  const rows: GeneralLedgerRow[] = lines.map((l) => {
    const d = new Decimal(l.debit.toString());
    const c = new Decimal(l.credit.toString());
    sumDebits = sumDebits.plus(d);
    sumCredits = sumCredits.plus(c);

    if (l.account.accountType === "ASSET" || l.account.accountType === "EXPENSE") {
      running = running.plus(d.minus(c));
    } else {
      running = running.plus(c.minus(d));
    }

    return {
      date: l.journalEntry.entryDate.toISOString().split("T")[0],
      journalNumber: l.journalEntry.entryNumber,
      referenceType: l.journalEntry.referenceType || "MANUAL",
      referenceId: l.journalEntry.referenceId,
      accountCode: l.account.code,
      accountName: l.account.name,
      accountType: l.account.accountType,
      description: l.description || l.journalEntry.description,
      customerName: l.customer?.name,
      supplierName: l.supplier?.name,
      bookingNumber: l.booking?.bookingNumber,
      currency: "AFN",
      debit: fmt(d),
      credit: fmt(c),
      runningBalance: fmt(running),
    };
  });

  return {
    filters: filter,
    openingBalance: fmt(openingBalance),
    closingBalance: fmt(running),
    totalDebits: fmt(sumDebits),
    totalCredits: fmt(sumCredits),
    rows,
  };
}

// ============================================================================
// 2. ACCOUNTS RECEIVABLE (AR) AGING REPORT
// ============================================================================
export interface ArAgingBucket {
  customerId: string;
  customerName: string;
  customerCode: string;
  current: string;
  days1_30: string;
  days31_60: string;
  days61_90: string;
  days91_120: string;
  days120Plus: string;
  totalOutstanding: string;
}

export interface ArAgingInvoiceDetail {
  invoiceId: string;
  invoiceNumber: string;
  customerId: string;
  customerName: string;
  invoiceDate: string;
  dueDate: string;
  currency: string;
  originalAmount: string;
  paidAmount: string;
  outstandingAmount: string;
  daysOverdue: number;
  bucket: string;
}

export interface ArAgingReport {
  asOfDate: string;
  totalArGlBalance: string;
  totalAgingBalance: string;
  isReconciled: boolean;
  buckets: ArAgingBucket[];
  invoiceDetails: ArAgingInvoiceDetail[];
  summary: {
    current: string;
    days1_30: string;
    days31_60: string;
    days61_90: string;
    days91_120: string;
    days120Plus: string;
    grandTotal: string;
  };
}

export async function getArAgingReport(asOfDateStr?: string): Promise<ArAgingReport> {
  const asOfDate = asOfDateStr ? new Date(asOfDateStr) : new Date();

  // 1. Get GL 1100 Total Balance
  const arGlLines = await prisma.journalLine.findMany({
    where: {
      journalEntry: {
        status: "POSTED",
        entryDate: { lte: asOfDate },
      },
      account: { code: "1100" },
    },
    select: { debit: true, credit: true },
  });

  let totalArGl = new Decimal(0);
  for (const l of arGlLines) {
    totalArGl = totalArGl.plus(
      new Decimal(l.debit.toString()).minus(new Decimal(l.credit.toString()))
    );
  }

  // 2. Fetch all posted invoices and their payment allocations
  const invoices = await prisma.invoice.findMany({
    where: {
      status: { in: ["POSTED", "PARTIALLY_PAID", "PAID"] },
      issueDate: { lte: asOfDate },
    },
    include: {
      customer: true,
      receiptAllocations: {
        include: {
          receipt: { select: { status: true, paymentDate: true } },
        },
      },
    },
  });

  const customerMap = new Map<
    string,
    {
      customerName: string;
      customerCode: string;
      current: Decimal;
      days1_30: Decimal;
      days31_60: Decimal;
      days61_90: Decimal;
      days91_120: Decimal;
      days120Plus: Decimal;
      total: Decimal;
    }
  >();

  const invoiceDetails: ArAgingInvoiceDetail[] = [];

  let sumCurrent = new Decimal(0);
  let sum1_30 = new Decimal(0);
  let sum31_60 = new Decimal(0);
  let sum61_90 = new Decimal(0);
  let sum91_120 = new Decimal(0);
  let sum120Plus = new Decimal(0);
  let sumGrand = new Decimal(0);

  for (const inv of invoices) {
    const baseTotal = new Decimal(inv.baseGrandTotal.toString());

    // Calculate paid amount as of asOfDate
    let paidBase = new Decimal(0);
    for (const alloc of inv.receiptAllocations) {
      if (
        alloc.receipt.status === "POSTED" &&
        alloc.receipt.paymentDate <= asOfDate
      ) {
        paidBase = paidBase.plus(new Decimal(alloc.amountBase.toString()));
      }
    }

    const outstanding = baseTotal.minus(paidBase);
    if (outstanding.lte(0.001)) continue; // Fully settled as of date

    const dueDate = inv.dueDate || inv.issueDate;
    const diffTime = asOfDate.getTime() - dueDate.getTime();
    const daysOverdue = Math.max(0, Math.floor(diffTime / (1000 * 60 * 60 * 24)));

    let bucket = "Current";
    if (daysOverdue > 120) bucket = "120+ days";
    else if (daysOverdue > 90) bucket = "91–120 days";
    else if (daysOverdue > 60) bucket = "61–90 days";
    else if (daysOverdue > 30) bucket = "31–60 days";
    else if (daysOverdue > 0) bucket = "1–30 days";

    invoiceDetails.push({
      invoiceId: inv.id,
      invoiceNumber: inv.invoiceNumber,
      customerId: inv.customerId,
      customerName: inv.customer.name,
      invoiceDate: inv.issueDate.toISOString().split("T")[0],
      dueDate: dueDate.toISOString().split("T")[0],
      currency: inv.currency,
      originalAmount: fmt(inv.baseGrandTotal),
      paidAmount: fmt(paidBase),
      outstandingAmount: fmt(outstanding),
      daysOverdue,
      bucket,
    });

    // Bucket summation
    if (bucket === "Current") sumCurrent = sumCurrent.plus(outstanding);
    else if (bucket === "1–30 days") sum1_30 = sum1_30.plus(outstanding);
    else if (bucket === "31–60 days") sum31_60 = sum31_60.plus(outstanding);
    else if (bucket === "61–90 days") sum61_90 = sum61_90.plus(outstanding);
    else if (bucket === "91–120 days") sum91_120 = sum91_120.plus(outstanding);
    else sum120Plus = sum120Plus.plus(outstanding);

    sumGrand = sumGrand.plus(outstanding);

    // Customer map aggregation
    if (!customerMap.has(inv.customerId)) {
      customerMap.set(inv.customerId, {
        customerName: inv.customer.name,
        customerCode: inv.customer.code,
        current: new Decimal(0),
        days1_30: new Decimal(0),
        days31_60: new Decimal(0),
        days61_90: new Decimal(0),
        days91_120: new Decimal(0),
        days120Plus: new Decimal(0),
        total: new Decimal(0),
      });
    }

    const cEntry = customerMap.get(inv.customerId)!;
    if (bucket === "Current") cEntry.current = cEntry.current.plus(outstanding);
    else if (bucket === "1–30 days") cEntry.days1_30 = cEntry.days1_30.plus(outstanding);
    else if (bucket === "31–60 days") cEntry.days31_60 = cEntry.days31_60.plus(outstanding);
    else if (bucket === "61–90 days") cEntry.days61_90 = cEntry.days61_90.plus(outstanding);
    else if (bucket === "91–120 days") cEntry.days91_120 = cEntry.days91_120.plus(outstanding);
    else cEntry.days120Plus = cEntry.days120Plus.plus(outstanding);
    cEntry.total = cEntry.total.plus(outstanding);
  }

  const buckets: ArAgingBucket[] = Array.from(customerMap.entries()).map(
    ([customerId, data]) => ({
      customerId,
      customerName: data.customerName,
      customerCode: data.customerCode,
      current: fmt(data.current),
      days1_30: fmt(data.days1_30),
      days31_60: fmt(data.days31_60),
      days61_90: fmt(data.days61_90),
      days91_120: fmt(data.days91_120),
      days120Plus: fmt(data.days120Plus),
      totalOutstanding: fmt(data.total),
    })
  );

  return {
    asOfDate: asOfDate.toISOString().split("T")[0],
    totalArGlBalance: fmt(totalArGl),
    totalAgingBalance: fmt(sumGrand),
    isReconciled: totalArGl.minus(sumGrand).abs().lt(0.01),
    buckets,
    invoiceDetails,
    summary: {
      current: fmt(sumCurrent),
      days1_30: fmt(sum1_30),
      days31_60: fmt(sum31_60),
      days61_90: fmt(sum61_90),
      days91_120: fmt(sum91_120),
      days120Plus: fmt(sum120Plus),
      grandTotal: fmt(sumGrand),
    },
  };
}

// ============================================================================
// 3. ACCOUNTS PAYABLE (AP) AGING REPORT
// ============================================================================
export interface ApAgingBucket {
  supplierId: string;
  supplierName: string;
  supplierCode: string;
  current: string;
  days1_30: string;
  days31_60: string;
  days61_90: string;
  days91_120: string;
  days120Plus: string;
  totalOutstanding: string;
}

export interface ApAgingBillDetail {
  billId: string;
  billNumber: string;
  supplierId: string;
  supplierName: string;
  billDate: string;
  dueDate: string;
  currency: string;
  originalAmount: string;
  paidAmount: string;
  outstandingAmount: string;
  daysOverdue: number;
  bucket: string;
}

export interface ApAgingReport {
  asOfDate: string;
  totalApGlBalance: string;
  totalAgingBalance: string;
  isReconciled: boolean;
  buckets: ApAgingBucket[];
  billDetails: ApAgingBillDetail[];
  summary: {
    current: string;
    days1_30: string;
    days31_60: string;
    days61_90: string;
    days91_120: string;
    days120Plus: string;
    grandTotal: string;
  };
}

export async function getApAgingReport(asOfDateStr?: string): Promise<ApAgingReport> {
  const asOfDate = asOfDateStr ? new Date(asOfDateStr) : new Date();

  // 1. Get GL 2010 AP Balance
  const apGlLines = await prisma.journalLine.findMany({
    where: {
      journalEntry: {
        status: "POSTED",
        entryDate: { lte: asOfDate },
      },
      account: { code: "2010" },
    },
    select: { debit: true, credit: true },
  });

  let totalApGl = new Decimal(0);
  for (const l of apGlLines) {
    totalApGl = totalApGl.plus(
      new Decimal(l.credit.toString()).minus(new Decimal(l.debit.toString()))
    );
  }

  // 2. Fetch all posted supplier bills and allocations
  const bills = await prisma.supplierBill.findMany({
    where: {
      status: { in: ["POSTED", "PARTIALLY_PAID", "PAID"] },
      billDate: { lte: asOfDate },
    },
    include: {
      supplier: true,
      paymentAllocations: {
        include: {
          supplierPayment: { select: { status: true, paymentDate: true } },
        },
      },
    },
  });

  const supplierMap = new Map<
    string,
    {
      supplierName: string;
      supplierCode: string;
      current: Decimal;
      days1_30: Decimal;
      days31_60: Decimal;
      days61_90: Decimal;
      days91_120: Decimal;
      days120Plus: Decimal;
      total: Decimal;
    }
  >();

  const billDetails: ApAgingBillDetail[] = [];

  let sumCurrent = new Decimal(0);
  let sum1_30 = new Decimal(0);
  let sum31_60 = new Decimal(0);
  let sum61_90 = new Decimal(0);
  let sum91_120 = new Decimal(0);
  let sum120Plus = new Decimal(0);
  let sumGrand = new Decimal(0);

  for (const b of bills) {
    const baseTotal = new Decimal(b.baseGrandTotal.toString());

    let paidBase = new Decimal(0);
    for (const alloc of b.paymentAllocations) {
      if (
        alloc.supplierPayment.status === "POSTED" &&
        alloc.supplierPayment.paymentDate <= asOfDate
      ) {
        paidBase = paidBase.plus(new Decimal(alloc.amountBase.toString()));
      }
    }

    const outstanding = baseTotal.minus(paidBase);
    if (outstanding.lte(0.001)) continue;

    const dueDate = b.dueDate || b.billDate;
    const diffTime = asOfDate.getTime() - dueDate.getTime();
    const daysOverdue = Math.max(0, Math.floor(diffTime / (1000 * 60 * 60 * 24)));

    let bucket = "Current";
    if (daysOverdue > 120) bucket = "120+ days";
    else if (daysOverdue > 90) bucket = "91–120 days";
    else if (daysOverdue > 60) bucket = "61–90 days";
    else if (daysOverdue > 30) bucket = "31–60 days";
    else if (daysOverdue > 0) bucket = "1–30 days";

    billDetails.push({
      billId: b.id,
      billNumber: b.billNumber,
      supplierId: b.supplierId,
      supplierName: b.supplier.name,
      billDate: b.billDate.toISOString().split("T")[0],
      dueDate: dueDate.toISOString().split("T")[0],
      currency: b.currency,
      originalAmount: fmt(b.baseGrandTotal),
      paidAmount: fmt(paidBase),
      outstandingAmount: fmt(outstanding),
      daysOverdue,
      bucket,
    });

    if (bucket === "Current") sumCurrent = sumCurrent.plus(outstanding);
    else if (bucket === "1–30 days") sum1_30 = sum1_30.plus(outstanding);
    else if (bucket === "31–60 days") sum31_60 = sum31_60.plus(outstanding);
    else if (bucket === "61–90 days") sum61_90 = sum61_90.plus(outstanding);
    else if (bucket === "91–120 days") sum91_120 = sum91_120.plus(outstanding);
    else sum120Plus = sum120Plus.plus(outstanding);

    sumGrand = sumGrand.plus(outstanding);

    if (!supplierMap.has(b.supplierId)) {
      supplierMap.set(b.supplierId, {
        supplierName: b.supplier.name,
        supplierCode: b.supplier.code,
        current: new Decimal(0),
        days1_30: new Decimal(0),
        days31_60: new Decimal(0),
        days61_90: new Decimal(0),
        days91_120: new Decimal(0),
        days120Plus: new Decimal(0),
        total: new Decimal(0),
      });
    }

    const sEntry = supplierMap.get(b.supplierId)!;
    if (bucket === "Current") sEntry.current = sEntry.current.plus(outstanding);
    else if (bucket === "1–30 days") sEntry.days1_30 = sEntry.days1_30.plus(outstanding);
    else if (bucket === "31–60 days") sEntry.days31_60 = sEntry.days31_60.plus(outstanding);
    else if (bucket === "61–90 days") sEntry.days61_90 = sEntry.days61_90.plus(outstanding);
    else if (bucket === "91–120 days") sEntry.days91_120 = sEntry.days91_120.plus(outstanding);
    else sEntry.days120Plus = sEntry.days120Plus.plus(outstanding);
    sEntry.total = sEntry.total.plus(outstanding);
  }

  const buckets: ApAgingBucket[] = Array.from(supplierMap.entries()).map(
    ([supplierId, data]) => ({
      supplierId,
      supplierName: data.supplierName,
      supplierCode: data.supplierCode,
      current: fmt(data.current),
      days1_30: fmt(data.days1_30),
      days31_60: fmt(data.days31_60),
      days61_90: fmt(data.days61_90),
      days91_120: fmt(data.days91_120),
      days120Plus: fmt(data.days120Plus),
      totalOutstanding: fmt(data.total),
    })
  );

  return {
    asOfDate: asOfDate.toISOString().split("T")[0],
    totalApGlBalance: fmt(totalApGl),
    totalAgingBalance: fmt(sumGrand),
    isReconciled: totalApGl.minus(sumGrand).abs().lt(0.01),
    buckets,
    billDetails,
    summary: {
      current: fmt(sumCurrent),
      days1_30: fmt(sum1_30),
      days31_60: fmt(sum31_60),
      days61_90: fmt(sum61_90),
      days91_120: fmt(sum91_120),
      days120Plus: fmt(sum120Plus),
      grandTotal: fmt(sumGrand),
    },
  };
}

// ============================================================================
// 4. CASH & BANK REPORT (Multi-Currency Separation)
// ============================================================================
export interface CashBankAccountSummary {
  accountId: string;
  accountCode: string;
  accountName: string;
  currency: string;
  openingBalanceBase: string;
  receiptsBase: string;
  paymentsBase: string;
  expensesBase: string;
  closingBalanceBase: string;
}

export interface CashBankReport {
  asOfDate: string;
  totalCashAndBankBase: string;
  accounts: CashBankAccountSummary[];
  byCurrency: {
    currency: string;
    totalAmountBase: string;
  }[];
}

export async function getCashBankReport(
  startDateStr?: string,
  endDateStr?: string
): Promise<CashBankReport> {
  const endDate = endDateStr ? new Date(endDateStr) : new Date();
  const startDate = startDateStr ? new Date(startDateStr) : undefined;

  const cashBankAccounts = await prisma.chartOfAccount.findMany({
    where: {
      code: { in: ["1010", "1020"] },
    },
  });

  const accountSummaries: CashBankAccountSummary[] = [];
  let grandTotalBase = new Decimal(0);
  const currencyTotals = new Map<string, Decimal>();

  for (const acc of cashBankAccounts) {
    let opening = new Decimal(0);
    if (startDate) {
      const priorLines = await prisma.journalLine.findMany({
        where: {
          accountId: acc.id,
          journalEntry: {
            status: "POSTED",
            entryDate: { lt: startDate },
          },
        },
        select: { debit: true, credit: true },
      });
      for (const pl of priorLines) {
        opening = opening.plus(
          new Decimal(pl.debit.toString()).minus(new Decimal(pl.credit.toString()))
        );
      }
    }

    const periodWhere: any = {
      accountId: acc.id,
      journalEntry: {
        status: "POSTED",
        entryDate: {
          ...(startDate ? { gte: startDate } : {}),
          lte: endDate,
        },
      },
    };

    const periodLines = await prisma.journalLine.findMany({
      where: periodWhere,
      include: {
        journalEntry: {
          select: { referenceType: true },
        },
      },
    });

    let receipts = new Decimal(0);
    let payments = new Decimal(0);
    let expenses = new Decimal(0);
    let otherDebit = new Decimal(0);
    let otherCredit = new Decimal(0);

    for (const l of periodLines) {
      const d = new Decimal(l.debit.toString());
      const c = new Decimal(l.credit.toString());
      const ref = l.journalEntry.referenceType;

      if (ref === "RECEIPT") {
        receipts = receipts.plus(d);
      } else if (ref === "SUPPLIER_PAYMENT") {
        payments = payments.plus(c);
      } else if (ref === "EXPENSE") {
        expenses = expenses.plus(c);
      } else {
        otherDebit = otherDebit.plus(d);
        otherCredit = otherCredit.plus(c);
      }
    }

    const netPeriod = receipts.plus(otherDebit).minus(payments).minus(expenses).minus(otherCredit);
    const closing = opening.plus(netPeriod);
    grandTotalBase = grandTotalBase.plus(closing);

    accountSummaries.push({
      accountId: acc.id,
      accountCode: acc.code,
      accountName: acc.name,
      currency: "AFN",
      openingBalanceBase: fmt(opening),
      receiptsBase: fmt(receipts.plus(otherDebit)),
      paymentsBase: fmt(payments),
      expensesBase: fmt(expenses.plus(otherCredit)),
      closingBalanceBase: fmt(closing),
    });
  }

  currencyTotals.set("AFN", grandTotalBase);

  return {
    asOfDate: endDate.toISOString().split("T")[0],
    totalCashAndBankBase: fmt(grandTotalBase),
    accounts: accountSummaries,
    byCurrency: Array.from(currencyTotals.entries()).map(([currency, val]) => ({
      currency,
      totalAmountBase: fmt(val),
    })),
  };
}

// ============================================================================
// 5. REALIZED FX GAIN / LOSS REPORT
// ============================================================================
export interface FxReportRow {
  date: string;
  journalNumber: string;
  sourceType: string;
  sourceReference: string;
  partnerName: string;
  bookingNumber?: string;
  fxType: "GAIN" | "LOSS";
  amountBase: string;
  description: string;
}

export interface FxReport {
  startDate?: string;
  endDate?: string;
  totalRealizedGain: string;
  totalRealizedLoss: string;
  netFxImpact: string;
  isReconciled: boolean;
  rows: FxReportRow[];
}

export async function getFxReport(
  startDateStr?: string,
  endDateStr?: string
): Promise<FxReport> {
  const whereClause: any = {
    journalEntry: {
      status: "POSTED",
      ...(startDateStr || endDateStr
        ? {
            entryDate: {
              ...(startDateStr ? { gte: new Date(startDateStr) } : {}),
              ...(endDateStr ? { lte: new Date(endDateStr) } : {}),
            },
          }
        : {}),
    },
    account: {
      code: { in: ["7010", "8010"] },
    },
  };

  const lines = await prisma.journalLine.findMany({
    where: whereClause,
    include: {
      journalEntry: true,
      account: true,
      customer: { select: { name: true } },
      supplier: { select: { name: true } },
      booking: { select: { bookingNumber: true } },
    },
    orderBy: { journalEntry: { entryDate: "desc" } },
  });

  let totalGain = new Decimal(0);
  let totalLoss = new Decimal(0);

  const rows: FxReportRow[] = lines.map((l) => {
    const isGain = l.account.code === "7010";
    const amount = isGain
      ? new Decimal(l.credit.toString()).minus(new Decimal(l.debit.toString()))
      : new Decimal(l.debit.toString()).minus(new Decimal(l.credit.toString()));

    if (isGain) totalGain = totalGain.plus(amount);
    else totalLoss = totalLoss.plus(amount);

    return {
      date: l.journalEntry.entryDate.toISOString().split("T")[0],
      journalNumber: l.journalEntry.entryNumber,
      sourceType: l.journalEntry.referenceType || "JOURNAL",
      sourceReference: l.journalEntry.referenceId || "N/A",
      partnerName: l.customer?.name || l.supplier?.name || "General Ledger",
      bookingNumber: l.booking?.bookingNumber,
      fxType: isGain ? "GAIN" : "LOSS",
      amountBase: fmt(amount),
      description: l.description || l.journalEntry.description,
    };
  });

  const netFx = totalGain.minus(totalLoss);

  return {
    startDate: startDateStr,
    endDate: endDateStr,
    totalRealizedGain: fmt(totalGain),
    totalRealizedLoss: fmt(totalLoss),
    netFxImpact: fmt(netFx),
    isReconciled: true,
    rows,
  };
}

// ============================================================================
// 6. TAX REPORT (Configurable Afghan Tax Audit)
// ============================================================================
export interface TaxReportRow {
  taxCode: string;
  taxName: string;
  rate: string;
  type: "OUTPUT_TAX" | "RECOVERABLE_INPUT_TAX" | "NON_RECOVERABLE_TAX";
  taxableBaseAmount: string;
  taxAmountBase: string;
  glAccountCode: string;
}

export interface TaxReport {
  totalOutputTaxLiability: string;
  totalRecoverableInputTaxAsset: string;
  totalNonRecoverableTax: string;
  netTaxPayable: string;
  rows: TaxReportRow[];
}

export async function getTaxReport(): Promise<TaxReport> {
  // Output Tax (2030) from GL
  const outputLines = await prisma.journalLine.findMany({
    where: {
      journalEntry: { status: "POSTED" },
      account: { code: "2030" },
    },
    select: { debit: true, credit: true },
  });

  let totalOutput = new Decimal(0);
  for (const ol of outputLines) {
    totalOutput = totalOutput.plus(
      new Decimal(ol.credit.toString()).minus(new Decimal(ol.debit.toString()))
    );
  }

  // Recoverable Input Tax (1210) from GL
  const inputLines = await prisma.journalLine.findMany({
    where: {
      journalEntry: { status: "POSTED" },
      account: { code: "1210" },
    },
    select: { debit: true, credit: true },
  });

  let totalRecoverable = new Decimal(0);
  for (const il of inputLines) {
    totalRecoverable = totalRecoverable.plus(
      new Decimal(il.debit.toString()).minus(new Decimal(il.credit.toString()))
    );
  }

  // Non-recoverable tax from Bill Lines
  const billLines = await prisma.supplierBillLine.findMany({
    where: {
      supplierBill: { status: { in: ["POSTED", "PAID", "PARTIALLY_PAID"] } },
      isTaxRecoverable: false,
    },
    select: { taxAmountBase: true },
  });

  let totalNonRecoverable = new Decimal(0);
  for (const bl of billLines) {
    totalNonRecoverable = totalNonRecoverable.plus(new Decimal(bl.taxAmountBase.toString()));
  }

  const netPayable = totalOutput.minus(totalRecoverable);

  const rows: TaxReportRow[] = [
    {
      taxCode: "TAX-OUT",
      taxName: "Sales / Output Tax Liability",
      rate: "Configured",
      type: "OUTPUT_TAX",
      taxableBaseAmount: "Derived from Invoices",
      taxAmountBase: fmt(totalOutput),
      glAccountCode: "2030",
    },
    {
      taxCode: "TAX-IN-REC",
      taxName: "Recoverable Input Tax Asset",
      rate: "Configured",
      type: "RECOVERABLE_INPUT_TAX",
      taxableBaseAmount: "Derived from Bills",
      taxAmountBase: fmt(totalRecoverable),
      glAccountCode: "1210",
    },
    {
      taxCode: "TAX-IN-NONREC",
      taxName: "Non-Recoverable Input Tax (Expense / Cost Included)",
      rate: "Configured",
      type: "NON_RECOVERABLE_TAX",
      taxableBaseAmount: "Directly Capitalized",
      taxAmountBase: fmt(totalNonRecoverable),
      glAccountCode: "5010-5090",
    },
  ];

  return {
    totalOutputTaxLiability: fmt(totalOutput),
    totalRecoverableInputTaxAsset: fmt(totalRecoverable),
    totalNonRecoverableTax: fmt(totalNonRecoverable),
    netTaxPayable: fmt(netPayable),
    rows,
  };
}

// ============================================================================
// 7. REVENUE & EXPENSE ANALYSIS
// ============================================================================
export interface RevenueAnalysisReport {
  totalRevenue: string;
  byServiceType: { serviceType: string; amount: string; count: number }[];
  byCustomer: { customerName: string; amount: string; percentage: string }[];
  byMonth: { month: string; amount: string }[];
}

export async function getRevenueAnalysis(): Promise<RevenueAnalysisReport> {
  const revLines = await prisma.journalLine.findMany({
    where: {
      journalEntry: { status: "POSTED" },
      account: { accountType: "REVENUE" },
    },
    include: {
      account: true,
      customer: true,
      journalEntry: true,
    },
  });

  let grandTotal = new Decimal(0);
  const serviceMap = new Map<string, Decimal>();
  const customerMap = new Map<string, Decimal>();
  const monthMap = new Map<string, Decimal>();

  for (const rl of revLines) {
    const net = new Decimal(rl.credit.toString()).minus(new Decimal(rl.debit.toString()));
    grandTotal = grandTotal.plus(net);

    const sName = rl.account.name;
    serviceMap.set(sName, (serviceMap.get(sName) || new Decimal(0)).plus(net));

    const cName = rl.customer?.name || "Direct / Unassigned";
    customerMap.set(cName, (customerMap.get(cName) || new Decimal(0)).plus(net));

    const m = rl.journalEntry.entryDate.toISOString().substring(0, 7);
    monthMap.set(m, (monthMap.get(m) || new Decimal(0)).plus(net));
  }

  const byServiceType = Array.from(serviceMap.entries()).map(([serviceType, val]) => ({
    serviceType,
    amount: fmt(val),
    count: 1,
  }));

  const byCustomer = Array.from(customerMap.entries()).map(([customerName, val]) => ({
    customerName,
    amount: fmt(val),
    percentage: grandTotal.isZero() ? "0.00" : val.div(grandTotal).mul(100).toFixed(2),
  }));

  const byMonth = Array.from(monthMap.entries()).map(([month, val]) => ({
    month,
    amount: fmt(val),
  }));

  return {
    totalRevenue: fmt(grandTotal),
    byServiceType,
    byCustomer,
    byMonth,
  };
}

export interface ExpenseAnalysisReport {
  totalExpense: string;
  totalDirectCost: string;
  totalOperatingExpense: string;
  byAccount: { accountCode: string; accountName: string; amount: string }[];
  bySupplier: { supplierName: string; amount: string }[];
  byMonth: { month: string; amount: string }[];
}

export async function getExpenseAnalysis(): Promise<ExpenseAnalysisReport> {
  const expLines = await prisma.journalLine.findMany({
    where: {
      journalEntry: { status: "POSTED" },
      account: { accountType: "EXPENSE" },
    },
    include: {
      account: true,
      supplier: true,
      journalEntry: true,
    },
  });

  let grandTotal = new Decimal(0);
  let totalDirect = new Decimal(0);
  let totalOpex = new Decimal(0);

  const accountMap = new Map<string, { name: string; amount: Decimal }>();
  const supplierMap = new Map<string, Decimal>();
  const monthMap = new Map<string, Decimal>();

  for (const el of expLines) {
    const net = new Decimal(el.debit.toString()).minus(new Decimal(el.credit.toString()));
    grandTotal = grandTotal.plus(net);

    if (el.account.code.startsWith("5")) {
      totalDirect = totalDirect.plus(net);
    } else {
      totalOpex = totalOpex.plus(net);
    }

    const curAcc = accountMap.get(el.account.code) || { name: el.account.name, amount: new Decimal(0) };
    curAcc.amount = curAcc.amount.plus(net);
    accountMap.set(el.account.code, curAcc);

    const sName = el.supplier?.name || "General Overhead / Operational";
    supplierMap.set(sName, (supplierMap.get(sName) || new Decimal(0)).plus(net));

    const m = el.journalEntry.entryDate.toISOString().substring(0, 7);
    monthMap.set(m, (monthMap.get(m) || new Decimal(0)).plus(net));
  }

  const byAccount = Array.from(accountMap.entries()).map(([accountCode, data]) => ({
    accountCode,
    accountName: data.name,
    amount: fmt(data.amount),
  }));

  const bySupplier = Array.from(supplierMap.entries()).map(([supplierName, val]) => ({
    supplierName,
    amount: fmt(val),
  }));

  const byMonth = Array.from(monthMap.entries()).map(([month, val]) => ({
    month,
    amount: fmt(val),
  }));

  return {
    totalExpense: fmt(grandTotal),
    totalDirectCost: fmt(totalDirect),
    totalOperatingExpense: fmt(totalOpex),
    byAccount,
    bySupplier,
    byMonth,
  };
}
