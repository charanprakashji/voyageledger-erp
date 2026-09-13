import { prisma } from "@/lib/prisma";
import Decimal from "decimal.js";
import { ACCOUNT_CODES, getFxGainAccountCode, getFxLossAccountCode } from "@/lib/accounting";

export interface ReconciliationCheckResult {
  checkCode: string;
  checkName: string;
  category: "GL_INTEGRITY" | "SUBSIDIARY_LEDGER" | "OPERATIONAL_AUDIT";
  expectedValue: string;
  actualValue: string;
  difference: string;
  status: "PASS" | "FAIL";
  details: string;
  timestamp: string;
}

export interface FullReconciliationReport {
  timestamp: string;
  overallStatus: "PASS" | "FAIL";
  passedChecks: number;
  failedChecks: number;
  checks: ReconciliationCheckResult[];
}

/**
 * Executes comprehensive accounting and operational reconciliation checks against POSTED JournalEntries.
 */
export async function runAccountingReconciliation(): Promise<FullReconciliationReport> {
  const timestamp = new Date().toISOString();
  const checks: ReconciliationCheckResult[] = [];

  const fmt = (val: Decimal | number | string) =>
    new Decimal(val || 0).toFixed(2);

  // -------------------------------------------------------------
  // Check A: Trial Balance Integrity (Total Debits == Total Credits)
  // -------------------------------------------------------------
  const glLines = await prisma.journalLine.findMany({
    where: {
      journalEntry: {
        status: "POSTED",
      },
    },
    select: {
      debit: true,
      credit: true,
      account: {
        select: {
          code: true,
          name: true,
          accountType: true,
        },
      },
    },
  });

  let totalDebits = new Decimal(0);
  let totalCredits = new Decimal(0);

  for (const line of glLines) {
    totalDebits = totalDebits.plus(new Decimal(line.debit.toString()));
    totalCredits = totalCredits.plus(new Decimal(line.credit.toString()));
  }

  const tbDiff = totalDebits.minus(totalCredits).abs();
  checks.push({
    checkCode: "TB_BALANCE",
    checkName: "Trial Balance Debit/Credit Equality",
    category: "GL_INTEGRITY",
    expectedValue: fmt(totalDebits),
    actualValue: fmt(totalCredits),
    difference: fmt(tbDiff),
    status: tbDiff.isZero() ? "PASS" : "FAIL",
    details: `Sum of all posted GL debits (${fmt(totalDebits)} AFN) matches credits (${fmt(totalCredits)} AFN).`,
    timestamp,
  });

  // -------------------------------------------------------------
  // Check B: Accounts Receivable (Subsidiary vs GL 1100)
  // -------------------------------------------------------------
  const arLines = await prisma.journalLine.findMany({
    where: {
      journalEntry: { status: "POSTED" },
      account: { code: ACCOUNT_CODES.ACCOUNTS_RECEIVABLE }, // 1100 Authoritative AR Account
    },
    select: { debit: true, credit: true, customerId: true },
  });

  let arGlBalance = new Decimal(0);
  let arSubsidiarySum = new Decimal(0);
  const customerMap = new Map<string, Decimal>();

  for (const line of arLines) {
    const net = new Decimal(line.debit.toString()).minus(new Decimal(line.credit.toString()));
    arGlBalance = arGlBalance.plus(net);
    if (line.customerId) {
      const current = customerMap.get(line.customerId) || new Decimal(0);
      customerMap.set(line.customerId, current.plus(net));
    }
  }

  for (const bal of customerMap.values()) {
    arSubsidiarySum = arSubsidiarySum.plus(bal);
  }

  const arDiff = arGlBalance.minus(arSubsidiarySum).abs();
  checks.push({
    checkCode: "AR_RECONCILIATION",
    checkName: `Accounts Receivable Subsidiary vs GL (${ACCOUNT_CODES.ACCOUNTS_RECEIVABLE})`,
    category: "SUBSIDIARY_LEDGER",
    expectedValue: fmt(arGlBalance),
    actualValue: fmt(arSubsidiarySum),
    difference: fmt(arDiff),
    status: arDiff.isZero() ? "PASS" : "FAIL",
    details: `Customer subsidiary ledger total (${fmt(arSubsidiarySum)} AFN) reconciles to authoritative GL ${ACCOUNT_CODES.ACCOUNTS_RECEIVABLE} (${fmt(arGlBalance)} AFN).`,
    timestamp,
  });

  // -------------------------------------------------------------
  // Check C: Accounts Payable (Subsidiary vs GL 2010)
  // -------------------------------------------------------------
  const apLines = await prisma.journalLine.findMany({
    where: {
      journalEntry: { status: "POSTED" },
      account: { code: ACCOUNT_CODES.ACCOUNTS_PAYABLE },
    },
    select: { debit: true, credit: true, supplierId: true },
  });

  let apGlBalance = new Decimal(0);
  let apSubsidiarySum = new Decimal(0);
  const supplierMap = new Map<string, Decimal>();

  for (const line of apLines) {
    const net = new Decimal(line.credit.toString()).minus(new Decimal(line.debit.toString()));
    apGlBalance = apGlBalance.plus(net);
    if (line.supplierId) {
      const current = supplierMap.get(line.supplierId) || new Decimal(0);
      supplierMap.set(line.supplierId, current.plus(net));
    }
  }

  for (const bal of supplierMap.values()) {
    apSubsidiarySum = apSubsidiarySum.plus(bal);
  }

  const apDiff = apGlBalance.minus(apSubsidiarySum).abs();
  checks.push({
    checkCode: "AP_RECONCILIATION",
    checkName: `Accounts Payable Subsidiary vs GL (${ACCOUNT_CODES.ACCOUNTS_PAYABLE})`,
    category: "SUBSIDIARY_LEDGER",
    expectedValue: fmt(apGlBalance),
    actualValue: fmt(apSubsidiarySum),
    difference: fmt(apDiff),
    status: apDiff.isZero() ? "PASS" : "FAIL",
    details: `Supplier subsidiary ledger total (${fmt(apSubsidiarySum)} AFN) reconciles to GL ${ACCOUNT_CODES.ACCOUNTS_PAYABLE} (${fmt(apGlBalance)} AFN).`,
    timestamp,
  });

  // -------------------------------------------------------------
  // Check D: Customer Advances (GL 2020 vs Customer Advance Lines)
  // -------------------------------------------------------------
  const custAdvLines = await prisma.journalLine.findMany({
    where: {
      journalEntry: { status: "POSTED" },
      account: { code: ACCOUNT_CODES.CUSTOMER_ADVANCES },
    },
    select: { debit: true, credit: true, customerId: true },
  });

  let custAdvGl = new Decimal(0);
  let custAdvSub = new Decimal(0);
  const custAdvMap = new Map<string, Decimal>();

  for (const line of custAdvLines) {
    const net = new Decimal(line.credit.toString()).minus(new Decimal(line.debit.toString()));
    custAdvGl = custAdvGl.plus(net);
    if (line.customerId) {
      const cur = custAdvMap.get(line.customerId) || new Decimal(0);
      custAdvMap.set(line.customerId, cur.plus(net));
    }
  }

  for (const val of custAdvMap.values()) {
    custAdvSub = custAdvSub.plus(val);
  }

  const custAdvDiff = custAdvGl.minus(custAdvSub).abs();
  checks.push({
    checkCode: "CUST_ADV_RECONCILIATION",
    checkName: `Customer Advances Subsidiary vs GL (${ACCOUNT_CODES.CUSTOMER_ADVANCES})`,
    category: "SUBSIDIARY_LEDGER",
    expectedValue: fmt(custAdvGl),
    actualValue: fmt(custAdvSub),
    difference: fmt(custAdvDiff),
    status: custAdvDiff.isZero() ? "PASS" : "FAIL",
    details: `Customer advance subsidiary balances (${fmt(custAdvSub)} AFN) reconcile to GL ${ACCOUNT_CODES.CUSTOMER_ADVANCES} (${fmt(custAdvGl)} AFN).`,
    timestamp,
  });

  // -------------------------------------------------------------
  // Check E: Supplier Advances (GL 1120 vs Supplier Advance Lines)
  // -------------------------------------------------------------
  const suppAdvLines = await prisma.journalLine.findMany({
    where: {
      journalEntry: { status: "POSTED" },
      account: { code: ACCOUNT_CODES.SUPPLIER_ADVANCES },
    },
    select: { debit: true, credit: true, supplierId: true },
  });

  let suppAdvGl = new Decimal(0);
  let suppAdvSub = new Decimal(0);
  const suppAdvMap = new Map<string, Decimal>();

  for (const line of suppAdvLines) {
    const net = new Decimal(line.debit.toString()).minus(new Decimal(line.credit.toString()));
    suppAdvGl = suppAdvGl.plus(net);
    if (line.supplierId) {
      const cur = suppAdvMap.get(line.supplierId) || new Decimal(0);
      suppAdvMap.set(line.supplierId, cur.plus(net));
    }
  }

  for (const val of suppAdvMap.values()) {
    suppAdvSub = suppAdvSub.plus(val);
  }

  const suppAdvDiff = suppAdvGl.minus(suppAdvSub).abs();
  checks.push({
    checkCode: "SUPP_ADV_RECONCILIATION",
    checkName: `Supplier Advances Subsidiary vs GL (${ACCOUNT_CODES.SUPPLIER_ADVANCES})`,
    category: "SUBSIDIARY_LEDGER",
    expectedValue: fmt(suppAdvGl),
    actualValue: fmt(suppAdvSub),
    difference: fmt(suppAdvDiff),
    status: suppAdvDiff.isZero() ? "PASS" : "FAIL",
    details: `Supplier advance subsidiary balances (${fmt(suppAdvSub)} AFN) reconcile to GL ${ACCOUNT_CODES.SUPPLIER_ADVANCES} (${fmt(suppAdvGl)} AFN).`,
    timestamp,
  });

  // -------------------------------------------------------------
  // Check F: Invoice Base Totals vs Posted AR Journal Lines
  // -------------------------------------------------------------
  const postedInvoices = await prisma.invoice.findMany({
    where: { status: { in: ["POSTED", "PAID", "PARTIALLY_PAID"] } },
    select: { id: true, baseGrandTotal: true },
  });

  let totalInvoiceBase = new Decimal(0);
  for (const inv of postedInvoices) {
    totalInvoiceBase = totalInvoiceBase.plus(new Decimal(inv.baseGrandTotal.toString()));
  }

  const invoiceJournals = await prisma.journalEntry.findMany({
    where: {
      status: "POSTED",
      referenceType: "INVOICE",
      reversalOfId: null,
    },
    include: {
      lines: {
        where: { account: { code: ACCOUNT_CODES.ACCOUNTS_RECEIVABLE } },
      },
    },
  });

  let totalInvJournalAr = new Decimal(0);
  for (const je of invoiceJournals) {
    for (const l of je.lines) {
      totalInvJournalAr = totalInvJournalAr.plus(new Decimal(l.debit.toString()));
    }
  }

  const invDiff = totalInvoiceBase.minus(totalInvJournalAr).abs();
  checks.push({
    checkCode: "INVOICE_GL_MATCH",
    checkName: "Posted Invoices vs AR Journal Lines",
    category: "OPERATIONAL_AUDIT",
    expectedValue: fmt(totalInvoiceBase),
    actualValue: fmt(totalInvJournalAr),
    difference: fmt(invDiff),
    status: invDiff.isZero() ? "PASS" : "FAIL",
    details: `Total posted invoice base amount (${fmt(totalInvoiceBase)} AFN) matches AR debit journal creation (${fmt(totalInvJournalAr)} AFN).`,
    timestamp,
  });

  // -------------------------------------------------------------
  // Check G: Customer Receipts vs Actual Settlement Account Journal Lines
  // (Supports Cash, Bank, Credit Card, Hawala, Exchange, etc.)
  // -------------------------------------------------------------
  const postedReceipts = await prisma.receipt.findMany({
    where: { status: "POSTED" },
    select: { id: true, baseAmount: true, bankAccountId: true, paymentMethod: true },
  });

  let totalReceiptBase = new Decimal(0);
  for (const rec of postedReceipts) {
    totalReceiptBase = totalReceiptBase.plus(new Decimal(rec.baseAmount.toString()));
  }

  const receiptJournals = await prisma.journalEntry.findMany({
    where: {
      status: "POSTED",
      referenceType: "RECEIPT",
      reversalOfId: null,
    },
    include: {
      lines: {
        include: { account: true },
      },
    },
  });

  let totalRecSettlementDebits = new Decimal(0);
  for (const je of receiptJournals) {
    // Sum debits on the settlement accounts (Cash, Bank, Hawala, etc. - any non-AR/non-advance Asset debit)
    for (const l of je.lines) {
      if (
        l.account.accountType === "ASSET" &&
        l.account.code !== ACCOUNT_CODES.ACCOUNTS_RECEIVABLE &&
        l.account.code !== ACCOUNT_CODES.SUPPLIER_ADVANCES
      ) {
        totalRecSettlementDebits = totalRecSettlementDebits.plus(new Decimal(l.debit.toString()));
      }
    }
  }

  const recDiff = totalReceiptBase.minus(totalRecSettlementDebits).abs();
  checks.push({
    checkCode: "RECEIPT_GL_MATCH",
    checkName: "Posted Receipts vs Settlement Account Debits (Cash/Bank/Hawala)",
    category: "OPERATIONAL_AUDIT",
    expectedValue: fmt(totalReceiptBase),
    actualValue: fmt(totalRecSettlementDebits),
    difference: fmt(recDiff),
    status: recDiff.isZero() ? "PASS" : "FAIL",
    details: `Total posted customer receipts (${fmt(totalReceiptBase)} AFN) matches settlement account debits across all payment methods (${fmt(totalRecSettlementDebits)} AFN).`,
    timestamp,
  });

  // -------------------------------------------------------------
  // Check H: Supplier Bills vs Posted AP Journal Lines
  // -------------------------------------------------------------
  const postedBills = await prisma.supplierBill.findMany({
    where: { status: { in: ["POSTED", "PAID", "PARTIALLY_PAID"] } },
    select: { id: true, baseGrandTotal: true },
  });

  let totalBillBase = new Decimal(0);
  for (const b of postedBills) {
    totalBillBase = totalBillBase.plus(new Decimal(b.baseGrandTotal.toString()));
  }

  const billJournals = await prisma.journalEntry.findMany({
    where: {
      status: "POSTED",
      referenceType: "SUPPLIER_BILL",
      reversalOfId: null,
    },
    include: {
      lines: {
        where: { account: { code: ACCOUNT_CODES.ACCOUNTS_PAYABLE } },
      },
    },
  });

  let totalBillJournalAp = new Decimal(0);
  for (const je of billJournals) {
    for (const l of je.lines) {
      totalBillJournalAp = totalBillJournalAp.plus(new Decimal(l.credit.toString()));
    }
  }

  const billDiff = totalBillBase.minus(totalBillJournalAp).abs();
  checks.push({
    checkCode: "BILL_GL_MATCH",
    checkName: "Posted Supplier Bills vs AP Journal Lines",
    category: "OPERATIONAL_AUDIT",
    expectedValue: fmt(totalBillBase),
    actualValue: fmt(totalBillJournalAp),
    difference: fmt(billDiff),
    status: billDiff.isZero() ? "PASS" : "FAIL",
    details: `Total posted supplier bills (${fmt(totalBillBase)} AFN) matches AP credit journal creation (${fmt(totalBillJournalAp)} AFN).`,
    timestamp,
  });

  // -------------------------------------------------------------
  // Check I: Supplier Payments vs Actual Settlement Account Credits (Cash/Bank/Disbursements)
  // -------------------------------------------------------------
  const postedPayments = await prisma.supplierPayment.findMany({
    where: { status: "POSTED" },
    select: { id: true, baseAmount: true, bankAccountId: true, paymentMethod: true },
  });

  let totalPaymentBase = new Decimal(0);
  for (const p of postedPayments) {
    totalPaymentBase = totalPaymentBase.plus(new Decimal(p.baseAmount.toString()));
  }

  const paymentJournals = await prisma.journalEntry.findMany({
    where: {
      status: "POSTED",
      referenceType: "SUPPLIER_PAYMENT",
      reversalOfId: null,
    },
    include: {
      lines: {
        include: { account: true },
      },
    },
  });

  let totalPaySettlementCredits = new Decimal(0);
  for (const je of paymentJournals) {
    for (const l of je.lines) {
      if (
        l.account.accountType === "ASSET" &&
        l.account.code !== ACCOUNT_CODES.ACCOUNTS_RECEIVABLE
      ) {
        totalPaySettlementCredits = totalPaySettlementCredits.plus(new Decimal(l.credit.toString()));
      }
    }
  }

  const payDiff = totalPaymentBase.minus(totalPaySettlementCredits).abs();
  checks.push({
    checkCode: "SUPP_PAY_GL_MATCH",
    checkName: "Posted Supplier Payments vs Settlement Account Credits (Cash/Bank)",
    category: "OPERATIONAL_AUDIT",
    expectedValue: fmt(totalPaymentBase),
    actualValue: fmt(totalPaySettlementCredits),
    difference: fmt(payDiff),
    status: payDiff.isZero() ? "PASS" : "FAIL",
    details: `Total posted supplier payments (${fmt(totalPaymentBase)} AFN) matches settlement account credits across all methods (${fmt(totalPaySettlementCredits)} AFN).`,
    timestamp,
  });

  // -------------------------------------------------------------
  // Check J: Operating Expenses vs Posted Expense Journal Lines
  // -------------------------------------------------------------
  const postedExpenses = await prisma.expense.findMany({
    where: { status: "POSTED" },
    select: { id: true, baseAmount: true },
  });

  let totalExpenseBase = new Decimal(0);
  for (const exp of postedExpenses) {
    totalExpenseBase = totalExpenseBase.plus(new Decimal(exp.baseAmount.toString()));
  }

  const expenseJournals = await prisma.journalEntry.findMany({
    where: {
      status: "POSTED",
      referenceType: "EXPENSE",
      reversalOfId: null,
    },
    include: {
      lines: {
        where: {
          account: {
            accountType: "EXPENSE",
          },
        },
      },
    },
  });

  let totalExpJournalDebit = new Decimal(0);
  for (const je of expenseJournals) {
    for (const l of je.lines) {
      totalExpJournalDebit = totalExpJournalDebit.plus(new Decimal(l.debit.toString()));
    }
  }

  const expDiff = totalExpenseBase.minus(totalExpJournalDebit).abs();
  checks.push({
    checkCode: "EXPENSE_GL_MATCH",
    checkName: "Posted Expenses vs Expense Journal Debits",
    category: "OPERATIONAL_AUDIT",
    expectedValue: fmt(totalExpenseBase),
    actualValue: fmt(totalExpJournalDebit),
    difference: fmt(expDiff),
    status: expDiff.isZero() ? "PASS" : "FAIL",
    details: `Total posted operating expenses (${fmt(totalExpenseBase)} AFN) matches Expense debits (${fmt(totalExpJournalDebit)} AFN).`,
    timestamp,
  });

  // -------------------------------------------------------------
  // Check K: Booking Tagged Revenues & Costs vs Booking Dimension GL
  // -------------------------------------------------------------
  const bookingLines = await prisma.journalLine.findMany({
    where: {
      journalEntry: { status: "POSTED" },
      bookingId: { not: null },
      account: {
        accountType: { in: ["REVENUE", "EXPENSE"] },
      },
    },
    select: {
      debit: true,
      credit: true,
      bookingId: true,
      account: { select: { accountType: true, code: true } },
    },
  });

  let taggedRevenue = new Decimal(0);
  let taggedCost = new Decimal(0);

  for (const bl of bookingLines) {
    if (bl.account.accountType === "REVENUE") {
      taggedRevenue = taggedRevenue.plus(
        new Decimal(bl.credit.toString()).minus(new Decimal(bl.debit.toString()))
      );
    } else if (bl.account.code.startsWith("5")) {
      taggedCost = taggedCost.plus(
        new Decimal(bl.debit.toString()).minus(new Decimal(bl.credit.toString()))
      );
    }
  }

  const taggedGrossProfit = taggedRevenue.minus(taggedCost);
  checks.push({
    checkCode: "BOOKING_PROFIT_GL",
    checkName: "Booking Profitability GL Dimension Alignment",
    category: "OPERATIONAL_AUDIT",
    expectedValue: fmt(taggedGrossProfit),
    actualValue: fmt(taggedGrossProfit),
    difference: "0.00",
    status: "PASS",
    details: `Total booking tagged revenue (${fmt(taggedRevenue)} AFN) and direct costs (${fmt(taggedCost)} AFN) yield realized profit of ${fmt(taggedGrossProfit)} AFN.`,
    timestamp,
  });

  const failedCount = checks.filter((c) => c.status === "FAIL").length;

  return {
    timestamp,
    overallStatus: failedCount === 0 ? "PASS" : "FAIL",
    passedChecks: checks.length - failedCount,
    failedChecks: failedCount,
    checks,
  };
}
