import Decimal from "decimal.js";
import {
  ACCOUNT_CODES,
  getRevenueAccountCodeForService,
  toDecimal,
  validateJournalEntryBalance,
  createReversalLines,
} from "./accounting";
import { assertPeriodOpen } from "@/app/actions/periods";
import { PrismaClient, InvoiceStatus, ReceiptStatus, ServiceType } from "@prisma/client";

// Set strict Decimal precision
Decimal.set({ precision: 28, rounding: Decimal.ROUND_HALF_UP });

export interface CalculatedInvoiceLine {
  bookingServiceItemId?: string;
  serviceType: ServiceType;
  description: string;
  quantity: number;
  unitPriceForeign: Decimal;
  unitPriceBase: Decimal;
  discountForeign: Decimal;
  discountBase: Decimal;
  taxRate: Decimal;
  taxAmountForeign: Decimal;
  taxAmountBase: Decimal;
  taxableAmountForeign: Decimal;
  taxableAmountBase: Decimal;
  totalAmountForeign: Decimal;
  totalAmountBase: Decimal;
  revenueAccountCode: string;
  revenueAccountId?: string;
  taxLiabilityAccountId?: string;
}

export interface CalculatedInvoiceTotals {
  foreignSubTotal: Decimal;
  baseSubTotal: Decimal;
  discountAmount: Decimal;
  taxableAmount: Decimal;
  taxAmount: Decimal;
  grandTotal: Decimal;
  baseGrandTotal: Decimal;
  lines: CalculatedInvoiceLine[];
}

/**
 * Calculates line amounts and tax with strict Decimal precision.
 * Rejects negative prices.
 */
export function calculateInvoiceLine(input: {
  bookingServiceItemId?: string;
  serviceType?: ServiceType;
  description: string;
  quantity: number;
  unitPriceForeign: number | string | Decimal;
  discountForeign?: number | string | Decimal;
  taxRate?: number | string | Decimal;
  exchangeRate: number | string | Decimal;
  revenueAccountId?: string;
  taxLiabilityAccountId?: string;
}): CalculatedInvoiceLine {
  const quantity = Math.max(1, input.quantity || 1);
  const exchangeRate = new Decimal(input.exchangeRate || 1);
  if (exchangeRate.lte(0)) {
    throw new Error("Exchange rate must be strictly positive");
  }

  const unitPriceForeign = new Decimal(input.unitPriceForeign || 0);
  if (unitPriceForeign.lt(0)) {
    throw new Error("Unit price cannot be negative");
  }

  const discountForeign = new Decimal(input.discountForeign || 0);
  if (discountForeign.lt(0)) {
    throw new Error("Discount cannot be negative");
  }

  const taxRate = new Decimal(input.taxRate || 0);
  if (taxRate.lt(0)) {
    throw new Error("Tax rate cannot be negative");
  }

  const unitPriceBase = unitPriceForeign.times(exchangeRate).toDecimalPlaces(2);
  const subtotalForeign = unitPriceForeign.times(quantity);
  const subtotalBase = unitPriceBase.times(quantity);
  const discountBase = discountForeign.times(exchangeRate).toDecimalPlaces(2);

  const taxableAmountForeign = subtotalForeign.minus(discountForeign);
  const taxableAmountBase = subtotalBase.minus(discountBase);

  const effectiveTaxRate = taxRate.gt(1) ? taxRate.dividedBy(100) : taxRate;
  const taxAmountForeign = taxableAmountForeign.times(effectiveTaxRate).toDecimalPlaces(2);
  const taxAmountBase = taxableAmountBase.times(effectiveTaxRate).toDecimalPlaces(2);

  const totalAmountForeign = taxableAmountForeign.plus(taxAmountForeign);
  const totalAmountBase = taxableAmountBase.plus(taxAmountBase);

  const serviceType = input.serviceType || ServiceType.OTHER;
  const revenueAccountCode = getRevenueAccountCodeForService(serviceType);

  return {
    bookingServiceItemId: input.bookingServiceItemId,
    serviceType,
    description: input.description,
    quantity,
    unitPriceForeign,
    unitPriceBase,
    discountForeign,
    discountBase,
    taxRate,
    taxAmountForeign,
    taxAmountBase,
    taxableAmountForeign,
    taxableAmountBase,
    totalAmountForeign,
    totalAmountBase,
    revenueAccountCode,
    revenueAccountId: input.revenueAccountId,
    taxLiabilityAccountId: input.taxLiabilityAccountId,
  };
}

/**
 * Calculates aggregate invoice totals across all lines.
 */
export function calculateInvoiceTotals(
  linesInput: Array<{
    bookingServiceItemId?: string;
    serviceType?: ServiceType;
    description: string;
    quantity: number;
    unitPriceForeign: number | string | Decimal;
    discountForeign?: number | string | Decimal;
    taxRate?: number | string | Decimal;
    exchangeRate: number | string | Decimal;
    revenueAccountId?: string;
    taxLiabilityAccountId?: string;
  }>
): CalculatedInvoiceTotals {
  let foreignSubTotal = new Decimal(0);
  let baseSubTotal = new Decimal(0);
  let discountAmount = new Decimal(0);
  let taxableAmount = new Decimal(0);
  let taxAmount = new Decimal(0);
  let grandTotal = new Decimal(0);
  let baseGrandTotal = new Decimal(0);

  const calculatedLines = linesInput.map((line) => {
    const calc = calculateInvoiceLine(line);
    foreignSubTotal = foreignSubTotal.plus(calc.unitPriceForeign.times(calc.quantity));
    baseSubTotal = baseSubTotal.plus(calc.unitPriceBase.times(calc.quantity));
    discountAmount = discountAmount.plus(calc.discountForeign);
    taxableAmount = taxableAmount.plus(calc.taxableAmountForeign);
    taxAmount = taxAmount.plus(calc.taxAmountForeign);
    grandTotal = grandTotal.plus(calc.totalAmountForeign);
    baseGrandTotal = baseGrandTotal.plus(calc.totalAmountBase);
    return calc;
  });

  return {
    foreignSubTotal: foreignSubTotal.toDecimalPlaces(2),
    baseSubTotal: baseSubTotal.toDecimalPlaces(2),
    discountAmount: discountAmount.toDecimalPlaces(2),
    taxableAmount: taxableAmount.toDecimalPlaces(2),
    taxAmount: taxAmount.toDecimalPlaces(2),
    grandTotal: grandTotal.toDecimalPlaces(2),
    baseGrandTotal: baseGrandTotal.toDecimalPlaces(2),
    lines: calculatedLines,
  };
}

/**
 * Generates document numbers using company prefix and padded sequence.
 */
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
 * Helper to lookup account ID by code (e.g. "1100" -> Account ID)
 */
export async function getAccountIdByCode(
  tx: any,
  code: string,
  fallbackName: string = "Standard Account",
  accountType: any = "ASSET",
  normalBalance: any = "DEBIT"
): Promise<string> {
  let account = await tx.chartOfAccount.findUnique({
    where: { code },
  });

  if (!account) {
    account = await tx.chartOfAccount.create({
      data: {
        code,
        name: fallbackName,
        accountType,
        normalBalance,
        isSystemAccount: true,
        currency: "AFN",
      },
    });
  }

  return account.id;
}

/**
 * Atomic General Ledger Posting for Invoices.
 * Creates:
 *  DR 1100 Accounts Receivable (Total Base AFN)
 *    CR 4000s Revenue Accounts (Service Line Base Amounts)
 *    CR 2030 Taxes Payable (If Tax Applicable)
 */
export async function postInvoiceToGL(
  tx: any,
  invoiceId: string,
  userId: string
) {
  const invoice = await tx.invoice.findUnique({
    where: { id: invoiceId },
    include: {
      lines: {
        include: { revenueAccount: true, taxLiabilityAccount: true },
      },
      customer: true,
    },
  });

  if (!invoice) {
    throw new Error(`Invoice ${invoiceId} not found`);
  }

  if (invoice.status === InvoiceStatus.POSTED) {
    throw new Error("Invoice is already posted to the General Ledger");
  }

  if (invoice.status === InvoiceStatus.CANCELLED) {
    throw new Error("Cancelled invoice cannot be posted");
  }

  if (invoice.journalEntryId) {
    throw new Error("Invoice already has an attached Journal Entry reference");
  }

  // Check accounting period lock
  await assertPeriodOpen(invoice.issueDate);

  // Resolve Accounts Receivable Account (1100)
  const arAccountId = await getAccountIdByCode(
    tx,
    ACCOUNT_CODES.ACCOUNTS_RECEIVABLE,
    "Accounts Receivable",
    "ASSET",
    "DEBIT"
  );

  // Resolve Taxes Payable Account (2030)
  const taxesPayableAccountId = await getAccountIdByCode(
    tx,
    ACCOUNT_CODES.TAXES_PAYABLE,
    "Taxes Payable",
    "LIABILITY",
    "CREDIT"
  );

  const baseGrandTotal = toDecimal(invoice.baseGrandTotal);
  if (baseGrandTotal.lte(0)) {
    throw new Error("Cannot post an invoice with zero or negative total amount");
  }

  const lines: any[] = [];

  // 1. DEBIT Accounts Receivable (Total Invoice Base Amount)
  lines.push({
    accountId: arAccountId,
    debit: baseGrandTotal.toNumber(),
    credit: 0,
    currency: invoice.currency,
    exchangeRate: Number(invoice.exchangeRate),
    foreignDebit: Number(invoice.grandTotal),
    foreignCredit: 0,
    description: `Invoice ${invoice.invoiceNumber} - ${invoice.customer.name}`,
    customerId: invoice.customerId,
    bookingId: invoice.bookingId,
  });

  // 2. CREDIT Revenue Accounts (Per Line Item Base Amount)
  let totalTaxBase = new Decimal(0);

  for (const line of invoice.lines) {
    const lineTotalBase = toDecimal(line.totalAmountBase);
    const lineTaxBase = toDecimal(line.taxAmountBase);
    const lineRevenueBase = lineTotalBase.minus(lineTaxBase);

    totalTaxBase = totalTaxBase.plus(lineTaxBase);

    let revAccountId = line.revenueAccountId;
    if (!revAccountId) {
      const code = getRevenueAccountCodeForService(line.serviceType);
      revAccountId = await getAccountIdByCode(
        tx,
        code,
        `${line.serviceType} Revenue`,
        "REVENUE",
        "CREDIT"
      );
    }

    if (lineRevenueBase.gt(0)) {
      lines.push({
        accountId: revAccountId,
        debit: 0,
        credit: lineRevenueBase.toNumber(),
        currency: invoice.currency,
        exchangeRate: Number(invoice.exchangeRate),
        foreignDebit: 0,
        foreignCredit: Number(toDecimal(line.totalAmountForeign).minus(toDecimal(line.taxAmountForeign))),
        description: line.description || `${line.serviceType} Revenue`,
        customerId: invoice.customerId,
        bookingId: invoice.bookingId,
      });
    }
  }

  // 3. CREDIT Taxes Payable (If Tax > 0)
  if (totalTaxBase.gt(0)) {
    lines.push({
      accountId: taxesPayableAccountId,
      debit: 0,
      credit: totalTaxBase.toNumber(),
      currency: invoice.currency,
      exchangeRate: Number(invoice.exchangeRate),
      foreignDebit: 0,
      foreignCredit: Number(invoice.taxAmount),
      description: `Tax on Invoice ${invoice.invoiceNumber}`,
      customerId: invoice.customerId,
      bookingId: invoice.bookingId,
    });
  }

  // Validate Balanced Invariant (Sum DR == Sum CR)
  const balanceCheck = validateJournalEntryBalance(lines);
  if (!balanceCheck.isValid) {
    throw new Error(`Invoice Journal Entry is unbalanced: ${balanceCheck.difference.toString()} AFN difference`);
  }

  // Count journal entries for sequence number
  const jeCount = await tx.journalEntry.count();
  const entryNumber = `JE-${new Date(invoice.issueDate).getFullYear()}-${String(jeCount + 1).padStart(5, "0")}`;

  // Create Journal Entry
  const journalEntry = await tx.journalEntry.create({
    data: {
      entryNumber,
      entryDate: invoice.issueDate,
      description: `Invoice ${invoice.invoiceNumber} posting for ${invoice.customer.name}`,
      referenceType: "INVOICE",
      referenceId: invoice.id,
      status: "POSTED",
      createdById: userId,
      postedAt: new Date(),
      lines: {
        create: lines.map((l) => ({
          accountId: l.accountId,
          debit: l.debit.toString(),
          credit: l.credit.toString(),
          currency: l.currency,
          exchangeRate: l.exchangeRate.toString(),
          foreignDebit: l.foreignDebit.toString(),
          foreignCredit: l.foreignCredit.toString(),
          description: l.description,
          customerId: l.customerId || null,
          bookingId: l.bookingId || null,
        })),
      },
    },
  });

  // Update Invoice state
  const updatedInvoice = await tx.invoice.update({
    where: { id: invoice.id },
    data: {
      status: InvoiceStatus.POSTED,
      postedAt: new Date(),
      postedById: userId,
      journalEntryId: journalEntry.id,
    },
  });

  return { invoice: updatedInvoice, journalEntry };
}

/**
 * Atomic General Ledger Posting for Customer Receipts & Multi-Currency Allocations.
 * Handles:
 *  - Invoice Settlements (CR Accounts Receivable)
 *  - Customer Advances (CR Customer Advances if unallocated)
 *  - Foreign Exchange Differences (CR FX Gain 7010 or DR FX Loss 8010)
 */
export async function postReceiptToGL(
  tx: any,
  receiptId: string,
  userId: string
) {
  const receipt = await tx.receipt.findUnique({
    where: { id: receiptId },
    include: {
      customer: true,
      allocations: {
        include: { invoice: true },
      },
    },
  });

  if (!receipt) {
    throw new Error(`Receipt ${receiptId} not found`);
  }

  if (receipt.status === ReceiptStatus.POSTED) {
    throw new Error("Receipt is already posted to the General Ledger");
  }

  if (receipt.status === ReceiptStatus.CANCELLED) {
    throw new Error("Cancelled receipt cannot be posted");
  }

  if (receipt.journalEntryId) {
    throw new Error("Receipt already has an attached Journal Entry reference");
  }

  // Check period
  await assertPeriodOpen(receipt.paymentDate);

  const receiptBaseAmount = toDecimal(receipt.baseAmount);
  if (receiptBaseAmount.lte(0)) {
    throw new Error("Cannot post a receipt with zero or negative amount");
  }

  // Resolve System Accounts
  const arAccountId = await getAccountIdByCode(
    tx,
    ACCOUNT_CODES.ACCOUNTS_RECEIVABLE,
    "Accounts Receivable",
    "ASSET",
    "DEBIT"
  );
  const advancesAccountId = await getAccountIdByCode(
    tx,
    ACCOUNT_CODES.CUSTOMER_ADVANCES,
    "Customer Advances",
    "LIABILITY",
    "CREDIT"
  );
  const fxGainAccountId = await getAccountIdByCode(
    tx,
    ACCOUNT_CODES.FX_GAIN,
    "Foreign Exchange Gain",
    "REVENUE",
    "CREDIT"
  );
  const fxLossAccountId = await getAccountIdByCode(
    tx,
    ACCOUNT_CODES.FX_LOSS,
    "Foreign Exchange Loss",
    "EXPENSE",
    "DEBIT"
  );

  const lines: any[] = [];

  // 1. DEBIT Bank/Cash Account (Receipt total base amount)
  lines.push({
    accountId: receipt.bankAccountId,
    debit: receiptBaseAmount.toNumber(),
    credit: 0,
    currency: receipt.currency,
    exchangeRate: Number(receipt.exchangeRate),
    foreignDebit: Number(receipt.amount),
    foreignCredit: 0,
    description: `Receipt ${receipt.receiptNumber} - ${receipt.customer.name}`,
    customerId: receipt.customerId,
    bookingId: receipt.bookingId,
  });

  // 2. CREDIT Allocations & FX Gain/Loss calculation
  let totalAllocatedForeign = new Decimal(0);
  let totalAllocatedBase = new Decimal(0);

  for (const alloc of receipt.allocations) {
    const allocAmountForeign = toDecimal(alloc.amountForeign);
    const allocAmountBase = toDecimal(alloc.amountBase); // At receipt rate
    const invoiceSettledBase = toDecimal(alloc.invoiceSettledBase); // At invoice historical rate
    const fxDiff = allocAmountBase.minus(invoiceSettledBase); // Positive = Gain, Negative = Loss

    totalAllocatedForeign = totalAllocatedForeign.plus(allocAmountForeign);
    totalAllocatedBase = totalAllocatedBase.plus(allocAmountBase);

    // Credit AR with the exact historical invoice amount cleared
    lines.push({
      accountId: arAccountId,
      debit: 0,
      credit: invoiceSettledBase.toNumber(),
      currency: alloc.invoice.currency,
      exchangeRate: Number(alloc.invoice.exchangeRate),
      foreignDebit: 0,
      foreignCredit: Number(allocAmountForeign),
      description: `Payment against Invoice ${alloc.invoice.invoiceNumber}`,
      customerId: receipt.customerId,
      bookingId: alloc.invoice.bookingId || receipt.bookingId,
    });

    // Handle FX Difference
    if (fxDiff.gt(0)) {
      // Receipt base value > Invoice historical base value => FX Gain (Credit)
      lines.push({
        accountId: fxGainAccountId,
        debit: 0,
        credit: fxDiff.toNumber(),
        currency: "AFN",
        exchangeRate: 1,
        foreignDebit: 0,
        foreignCredit: fxDiff.toNumber(),
        description: `FX Gain on settlement of Invoice ${alloc.invoice.invoiceNumber}`,
        customerId: receipt.customerId,
      });
    } else if (fxDiff.lt(0)) {
      // Receipt base value < Invoice historical base value => FX Loss (Debit)
      lines.push({
        accountId: fxLossAccountId,
        debit: fxDiff.abs().toNumber(),
        credit: 0,
        currency: "AFN",
        exchangeRate: 1,
        foreignDebit: fxDiff.abs().toNumber(),
        foreignCredit: 0,
        description: `FX Loss on settlement of Invoice ${alloc.invoice.invoiceNumber}`,
        customerId: receipt.customerId,
      });
    }

    // Update the invoice paidAmount and balanceDue
    const newPaidAmount = toDecimal(alloc.invoice.paidAmount).plus(allocAmountForeign);
    const newBalanceDue = toDecimal(alloc.invoice.grandTotal).minus(newPaidAmount);
    const newStatus = newBalanceDue.lte(0)
      ? InvoiceStatus.PAID
      : InvoiceStatus.PARTIALLY_PAID;

    await tx.invoice.update({
      where: { id: alloc.invoiceId },
      data: {
        paidAmount: newPaidAmount.toString(),
        balanceDue: newBalanceDue.toString(),
        status: newStatus,
      },
    });
  }

  // 3. CREDIT Customer Advances for any unallocated portion
  const unallocatedForeign = toDecimal(receipt.amount).minus(totalAllocatedForeign);
  const unallocatedBase = unallocatedForeign.times(receipt.exchangeRate).toDecimalPlaces(2);

  if (unallocatedBase.gt(0)) {
    lines.push({
      accountId: advancesAccountId,
      debit: 0,
      credit: unallocatedBase.toNumber(),
      currency: receipt.currency,
      exchangeRate: Number(receipt.exchangeRate),
      foreignDebit: 0,
      foreignCredit: unallocatedForeign.toNumber(),
      description: `Advance Deposit from ${receipt.customer.name}`,
      customerId: receipt.customerId,
      bookingId: receipt.bookingId,
    });
  }

  // Validate balanced double-entry
  const balanceCheck = validateJournalEntryBalance(lines);
  if (!balanceCheck.isValid) {
    throw new Error(`Receipt Journal Entry is unbalanced: ${balanceCheck.difference.toString()} AFN difference`);
  }

  // Sequence number for Journal Entry
  const jeCount = await tx.journalEntry.count();
  const entryNumber = `JE-${new Date(receipt.paymentDate).getFullYear()}-${String(jeCount + 1).padStart(5, "0")}`;

  const journalEntry = await tx.journalEntry.create({
    data: {
      entryNumber,
      entryDate: receipt.paymentDate,
      description: `Receipt ${receipt.receiptNumber} payment from ${receipt.customer.name}`,
      referenceType: "RECEIPT",
      referenceId: receipt.id,
      status: "POSTED",
      createdById: userId,
      postedAt: new Date(),
      lines: {
        create: lines.map((l) => ({
          accountId: l.accountId,
          debit: l.debit.toString(),
          credit: l.credit.toString(),
          currency: l.currency,
          exchangeRate: l.exchangeRate.toString(),
          foreignDebit: l.foreignDebit.toString(),
          foreignCredit: l.foreignCredit.toString(),
          description: l.description,
          customerId: l.customerId || null,
          bookingId: l.bookingId || null,
        })),
      },
    },
  });

  // Update Receipt
  const updatedReceipt = await tx.receipt.update({
    where: { id: receipt.id },
    data: {
      status: ReceiptStatus.POSTED,
      postedAt: new Date(),
      postedById: userId,
      journalEntryId: journalEntry.id,
      unallocatedAmount: unallocatedForeign.toString(),
      unallocatedBase: unallocatedBase.toString(),
    },
  });

  return { receipt: updatedReceipt, journalEntry };
}

/**
 * Reverses a posted invoice and cancels it non-destructively.
 */
export async function reverseInvoiceGL(
  tx: any,
  invoiceId: string,
  reason: string,
  userId: string
) {
  const invoice = await tx.invoice.findUnique({
    where: { id: invoiceId },
    include: { journalEntry: { include: { lines: true } } },
  });

  if (!invoice) {
    throw new Error("Invoice not found");
  }

  if (invoice.status !== InvoiceStatus.POSTED && invoice.status !== InvoiceStatus.PARTIALLY_PAID) {
    throw new Error("Only posted invoices can be reversed");
  }

  if (!invoice.journalEntry) {
    throw new Error("No posted journal entry found to reverse");
  }

  // Create inverted reversal lines
  const reversalLines = createReversalLines(invoice.journalEntry.lines);

  const jeCount = await tx.journalEntry.count();
  const entryNumber = `REV-${new Date().getFullYear()}-${String(jeCount + 1).padStart(5, "0")}`;

  const reversalEntry = await tx.journalEntry.create({
    data: {
      entryNumber,
      entryDate: new Date(),
      description: `Reversal of Invoice ${invoice.invoiceNumber} - Reason: ${reason}`,
      referenceType: "REVERSAL",
      referenceId: invoice.id,
      reversalOfId: invoice.journalEntry.id,
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
          customerId: l.customerId || null,
          bookingId: l.bookingId || null,
        })),
      },
    },
  });

  const cancelledInvoice = await tx.invoice.update({
    where: { id: invoice.id },
    data: {
      status: InvoiceStatus.CANCELLED,
      cancellationReason: reason,
      cancelledAt: new Date(),
      cancelledById: userId,
    },
  });

  return { invoice: cancelledInvoice, reversalEntry };
}

/**
 * Reverses a posted receipt, restoring any settled invoices.
 */
export async function reverseReceiptGL(
  tx: any,
  receiptId: string,
  reason: string,
  userId: string
) {
  const receipt = await tx.receipt.findUnique({
    where: { id: receiptId },
    include: {
      journalEntry: { include: { lines: true } },
      allocations: { include: { invoice: true } },
    },
  });

  if (!receipt) {
    throw new Error("Receipt not found");
  }

  if (receipt.status !== ReceiptStatus.POSTED) {
    throw new Error("Only posted receipts can be reversed");
  }

  if (!receipt.journalEntry) {
    throw new Error("No posted journal entry found to reverse");
  }

  // Restore settled invoices
  for (const alloc of receipt.allocations) {
    const restoredPaid = toDecimal(alloc.invoice.paidAmount).minus(toDecimal(alloc.amountForeign));
    const restoredBalance = toDecimal(alloc.invoice.grandTotal).minus(restoredPaid);
    const restoredStatus = restoredPaid.gt(0) ? InvoiceStatus.PARTIALLY_PAID : InvoiceStatus.POSTED;

    await tx.invoice.update({
      where: { id: alloc.invoiceId },
      data: {
        paidAmount: restoredPaid.toString(),
        balanceDue: restoredBalance.toString(),
        status: restoredStatus,
      },
    });
  }

  const reversalLines = createReversalLines(receipt.journalEntry.lines);
  const jeCount = await tx.journalEntry.count();
  const entryNumber = `REV-${new Date().getFullYear()}-${String(jeCount + 1).padStart(5, "0")}`;

  const reversalEntry = await tx.journalEntry.create({
    data: {
      entryNumber,
      entryDate: new Date(),
      description: `Reversal of Receipt ${receipt.receiptNumber} - Reason: ${reason}`,
      referenceType: "REVERSAL",
      referenceId: receipt.id,
      reversalOfId: receipt.journalEntry.id,
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
          customerId: l.customerId || null,
          bookingId: l.bookingId || null,
        })),
      },
    },
  });

  const cancelledReceipt = await tx.receipt.update({
    where: { id: receipt.id },
    data: {
      status: ReceiptStatus.CANCELLED,
      cancellationReason: reason,
      cancelledAt: new Date(),
      cancelledById: userId,
    },
  });

  return { receipt: cancelledReceipt, reversalEntry };
}

/**
 * Allocates an unallocated Customer Advance (from a posted Receipt) to a posted Invoice.
 * Generates an atomic, balanced JournalEntry:
 *  DR 2020 Customer Advances (Decreases Liability)
 *  CR 1100 Accounts Receivable (Decreases Customer AR)
 *
 * Invariants:
 *  - amountToAllocate <= receipt.unallocatedAmount
 *  - amountToAllocate <= invoice.balanceDue
 *  - Both receipt and invoice must belong to the same customer (or authorized group)
 *  - Both receipt and invoice must be POSTED
 *  - Revenue is NEVER affected
 *  - Atomic & fully reversible
 */
export async function allocateCustomerAdvanceToInvoice(
  tx: any,
  input: {
    receiptId: string;
    invoiceId: string;
    amountToAllocateForeign: number | string | Decimal;
    userId: string;
  }
) {
  const { receiptId, invoiceId, userId } = input;
  const amountToAllocate = toDecimal(input.amountToAllocateForeign);

  if (amountToAllocate.lte(0)) {
    throw new Error("Allocation amount must be strictly greater than zero");
  }

  const receipt = await tx.receipt.findUnique({
    where: { id: receiptId },
    include: { customer: true },
  });

  if (!receipt) {
    throw new Error(`Receipt ${receiptId} not found`);
  }

  if (receipt.status !== ReceiptStatus.POSTED) {
    throw new Error("Only POSTED receipts can have advances allocated");
  }

  const invoice = await tx.invoice.findUnique({
    where: { id: invoiceId },
    include: { customer: true },
  });

  if (!invoice) {
    throw new Error(`Invoice ${invoiceId} not found`);
  }

  if (invoice.status !== InvoiceStatus.POSTED && invoice.status !== InvoiceStatus.PARTIALLY_PAID) {
    throw new Error("Advances can only be allocated to POSTED or PARTIALLY_PAID invoices");
  }

  if (receipt.customerId !== invoice.customerId) {
    throw new Error("Advance allocation requires matching customer between receipt and invoice");
  }

  const availableAdvance = toDecimal(receipt.unallocatedAmount);
  if (amountToAllocate.gt(availableAdvance)) {
    throw new Error(
      `Allocation amount (${amountToAllocate.toFixed(2)} ${receipt.currency}) exceeds available advance balance (${availableAdvance.toFixed(2)} ${receipt.currency})`
    );
  }

  const invoiceBalanceDue = toDecimal(invoice.balanceDue);
  if (amountToAllocate.gt(invoiceBalanceDue)) {
    throw new Error(
      `Allocation amount (${amountToAllocate.toFixed(2)} ${invoice.currency}) exceeds invoice outstanding balance (${invoiceBalanceDue.toFixed(2)} ${invoice.currency})`
    );
  }

  // Check period
  await assertPeriodOpen(new Date());

  // Resolve System Accounts
  const arAccountId = await getAccountIdByCode(
    tx,
    ACCOUNT_CODES.ACCOUNTS_RECEIVABLE,
    "Accounts Receivable",
    "ASSET",
    "DEBIT"
  );
  const advancesAccountId = await getAccountIdByCode(
    tx,
    ACCOUNT_CODES.CUSTOMER_ADVANCES,
    "Customer Advances",
    "LIABILITY",
    "CREDIT"
  );

  // Base AFN equivalent: Advance liability was recorded at receipt.exchangeRate
  const amountBase = amountToAllocate.times(receipt.exchangeRate).toDecimalPlaces(2);
  const invoiceSettledBase = amountToAllocate.times(invoice.exchangeRate).toDecimalPlaces(2);
  const fxDiff = amountBase.minus(invoiceSettledBase);

  const lines: any[] = [];

  // 1. DR Customer Advances (2020) - Decreasing liability
  lines.push({
    accountId: advancesAccountId,
    debit: amountBase.toNumber(),
    credit: 0,
    currency: receipt.currency,
    exchangeRate: Number(receipt.exchangeRate),
    foreignDebit: amountToAllocate.toNumber(),
    foreignCredit: 0,
    description: `Advance Allocation from ${receipt.receiptNumber} to ${invoice.invoiceNumber}`,
    customerId: invoice.customerId,
    bookingId: invoice.bookingId || receipt.bookingId,
  });

  // 2. CR Accounts Receivable (1100) - Decreasing customer receivable
  lines.push({
    accountId: arAccountId,
    debit: 0,
    credit: invoiceSettledBase.toNumber(),
    currency: invoice.currency,
    exchangeRate: Number(invoice.exchangeRate),
    foreignDebit: 0,
    foreignCredit: amountToAllocate.toNumber(),
    description: `Advance Allocation from ${receipt.receiptNumber} to ${invoice.invoiceNumber}`,
    customerId: invoice.customerId,
    bookingId: invoice.bookingId || receipt.bookingId,
  });

  // 3. FX Difference if exchange rate of advance deposit differs from invoice rate
  if (fxDiff.gt(0)) {
    const fxGainAccountId = await getAccountIdByCode(
      tx,
      ACCOUNT_CODES.FX_GAIN,
      "Foreign Exchange Gain",
      "REVENUE",
      "CREDIT"
    );
    lines.push({
      accountId: fxGainAccountId,
      debit: 0,
      credit: fxDiff.toNumber(),
      currency: "AFN",
      exchangeRate: 1,
      foreignDebit: 0,
      foreignCredit: fxDiff.toNumber(),
      description: `FX Gain on Advance Allocation ${receipt.receiptNumber} -> ${invoice.invoiceNumber}`,
      customerId: invoice.customerId,
    });
  } else if (fxDiff.lt(0)) {
    const fxLossAccountId = await getAccountIdByCode(
      tx,
      ACCOUNT_CODES.FX_LOSS,
      "Foreign Exchange Loss",
      "EXPENSE",
      "DEBIT"
    );
    lines.push({
      accountId: fxLossAccountId,
      debit: fxDiff.abs().toNumber(),
      credit: 0,
      currency: "AFN",
      exchangeRate: 1,
      foreignDebit: fxDiff.abs().toNumber(),
      foreignCredit: 0,
      description: `FX Loss on Advance Allocation ${receipt.receiptNumber} -> ${invoice.invoiceNumber}`,
      customerId: invoice.customerId,
    });
  }

  // Validate balanced double entry
  const balanceCheck = validateJournalEntryBalance(lines);
  if (!balanceCheck.isValid) {
    throw new Error(`Advance Allocation Journal is unbalanced: ${balanceCheck.difference.toString()} AFN difference`);
  }

  const jeCount = await tx.journalEntry.count();
  const entryNumber = `JE-${new Date().getFullYear()}-${String(jeCount + 1).padStart(5, "0")}`;

  const journalEntry = await tx.journalEntry.create({
    data: {
      entryNumber,
      entryDate: new Date(),
      description: `Customer Advance Allocation: Receipt ${receipt.receiptNumber} applied to Invoice ${invoice.invoiceNumber}`,
      referenceType: "ADVANCE_ALLOCATION",
      referenceId: invoice.id,
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
          customerId: l.customerId || null,
          bookingId: l.bookingId || null,
        })),
      },
    },
  });

  // Create allocation record
  const allocation = await tx.receiptAllocation.create({
    data: {
      receiptId: receipt.id,
      invoiceId: invoice.id,
      amountForeign: amountToAllocate.toString(),
      amountBase: amountBase.toString(),
      invoiceSettledBase: invoiceSettledBase.toString(),
      fxGainLossAmount: fxDiff.toString(),
      allocatedById: userId,
    },
  });

  // Update receipt unallocatedAmount
  const newUnallocatedForeign = availableAdvance.minus(amountToAllocate);
  const newUnallocatedBase = newUnallocatedForeign.times(receipt.exchangeRate).toDecimalPlaces(2);
  await tx.receipt.update({
    where: { id: receipt.id },
    data: {
      unallocatedAmount: newUnallocatedForeign.toString(),
      unallocatedBase: newUnallocatedBase.toString(),
    },
  });

  // Update invoice paidAmount and balanceDue
  const newPaidAmount = toDecimal(invoice.paidAmount).plus(amountToAllocate);
  const newBalanceDue = toDecimal(invoice.grandTotal).minus(newPaidAmount);
  const newStatus = newBalanceDue.lte(0) ? InvoiceStatus.PAID : InvoiceStatus.PARTIALLY_PAID;

  const updatedInvoice = await tx.invoice.update({
    where: { id: invoice.id },
    data: {
      paidAmount: newPaidAmount.toString(),
      balanceDue: newBalanceDue.toString(),
      status: newStatus,
    },
  });

  return {
    allocation,
    journalEntry,
    invoice: updatedInvoice,
  };
}

/**
 * Reverses an advance allocation, restoring the customer advance liability and invoice balance.
 */
export async function reverseAdvanceAllocationGL(
  tx: any,
  allocationId: string,
  reason: string,
  userId: string
) {
  const allocation = await tx.receiptAllocation.findUnique({
    where: { id: allocationId },
    include: {
      receipt: true,
      invoice: true,
    },
  });

  if (!allocation) {
    throw new Error(`Receipt allocation ${allocationId} not found`);
  }

  // Find the advance allocation JournalEntry
  const originalJE = await tx.journalEntry.findFirst({
    where: {
      referenceType: "ADVANCE_ALLOCATION",
      referenceId: allocation.invoiceId,
      status: "POSTED",
      reversalOfId: null,
    },
    include: { lines: true },
    orderBy: { createdAt: "desc" },
  });

  if (!originalJE) {
    throw new Error("No posted advance allocation journal entry found to reverse");
  }

  const reversalLines = createReversalLines(originalJE.lines);
  const jeCount = await tx.journalEntry.count();
  const entryNumber = `REV-${new Date().getFullYear()}-${String(jeCount + 1).padStart(5, "0")}`;

  const reversalEntry = await tx.journalEntry.create({
    data: {
      entryNumber,
      entryDate: new Date(),
      description: `Reversal of Advance Allocation (${allocation.receipt.receiptNumber} -> ${allocation.invoice.invoiceNumber}) - Reason: ${reason}`,
      referenceType: "REVERSAL",
      referenceId: allocation.id,
      reversalOfId: originalJE.id,
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
          customerId: l.customerId || null,
          bookingId: l.bookingId || null,
        })),
      },
    },
  });

  // Restore receipt unallocated balance
  const allocAmountForeign = toDecimal(allocation.amountForeign);
  const restoredUnallocatedForeign = toDecimal(allocation.receipt.unallocatedAmount).plus(allocAmountForeign);
  const restoredUnallocatedBase = restoredUnallocatedForeign.times(allocation.receipt.exchangeRate).toDecimalPlaces(2);

  await tx.receipt.update({
    where: { id: allocation.receiptId },
    data: {
      unallocatedAmount: restoredUnallocatedForeign.toString(),
      unallocatedBase: restoredUnallocatedBase.toString(),
    },
  });

  // Restore invoice balance
  const restoredPaidAmount = toDecimal(allocation.invoice.paidAmount).minus(allocAmountForeign);
  const restoredBalanceDue = toDecimal(allocation.invoice.grandTotal).minus(restoredPaidAmount);
  const restoredStatus = restoredPaidAmount.gt(0) ? InvoiceStatus.PARTIALLY_PAID : InvoiceStatus.POSTED;

  const restoredInvoice = await tx.invoice.update({
    where: { id: allocation.invoiceId },
    data: {
      paidAmount: restoredPaidAmount.toString(),
      balanceDue: restoredBalanceDue.toString(),
      status: restoredStatus,
    },
  });

  // Delete/cleanup the allocation record
  await tx.receiptAllocation.delete({
    where: { id: allocation.id },
  });

  return {
    reversalEntry,
    invoice: restoredInvoice,
  };
}
