import Decimal from "decimal.js";
import {
  ACCOUNT_CODES,
  getCostAccountCodeForService,
  toDecimal,
  validateJournalEntryBalance,
  createReversalLines,
} from "./accounting";
import { assertPeriodOpen } from "@/app/actions/periods";
import {
  SupplierBillStatus,
  SupplierPaymentStatus,
  ServiceType,
} from "@prisma/client";

// Strict Decimal precision
Decimal.set({ precision: 28, rounding: Decimal.ROUND_HALF_UP });

export interface CalculatedSupplierBillLine {
  bookingServiceItemId?: string;
  serviceType: ServiceType;
  description: string;
  quantity: number;
  unitCostForeign: Decimal;
  unitCostBase: Decimal;
  discountForeign: Decimal;
  discountBase: Decimal;
  taxRate: Decimal;
  taxAmountForeign: Decimal;
  taxAmountBase: Decimal;
  isTaxRecoverable: boolean;
  totalAmountForeign: Decimal;
  totalAmountBase: Decimal;
  costAccountCode: string;
  costAccountId?: string;
  taxLiabilityAccountId?: string;
}

export interface CalculatedSupplierBillTotals {
  foreignSubTotal: Decimal;
  baseSubTotal: Decimal;
  discountAmount: Decimal;
  taxableAmount: Decimal;
  taxAmount: Decimal;
  grandTotal: Decimal;
  baseGrandTotal: Decimal;
  lines: CalculatedSupplierBillLine[];
}

/**
 * Calculates Supplier Bill line amounts with strict Decimal precision.
 */
export function calculateSupplierBillLine(input: {
  bookingServiceItemId?: string;
  serviceType?: ServiceType;
  description: string;
  quantity: number;
  unitCostForeign: number | string | Decimal;
  discountForeign?: number | string | Decimal;
  taxRate?: number | string | Decimal;
  isTaxRecoverable?: boolean;
  exchangeRate: number | string | Decimal;
  costAccountId?: string;
  taxLiabilityAccountId?: string;
  customCostMapping?: Record<string, string>;
}): CalculatedSupplierBillLine {
  const quantity = Math.max(1, input.quantity || 1);
  const exchangeRate = new Decimal(input.exchangeRate || 1);
  if (exchangeRate.lte(0)) {
    throw new Error("Exchange rate must be strictly positive");
  }

  const unitCostForeign = new Decimal(input.unitCostForeign || 0);
  if (unitCostForeign.lt(0)) {
    throw new Error("Unit cost cannot be negative");
  }

  const discountForeign = new Decimal(input.discountForeign || 0);
  if (discountForeign.lt(0)) {
    throw new Error("Discount cannot be negative");
  }

  const taxRate = new Decimal(input.taxRate || 0);
  if (taxRate.lt(0)) {
    throw new Error("Tax rate cannot be negative");
  }

  const unitCostBase = unitCostForeign.times(exchangeRate).toDecimalPlaces(2);
  const subtotalForeign = unitCostForeign.times(quantity);
  const subtotalBase = unitCostBase.times(quantity);
  const discountBase = discountForeign.times(exchangeRate).toDecimalPlaces(2);

  const taxableAmountForeign = subtotalForeign.minus(discountForeign);
  const taxableAmountBase = subtotalBase.minus(discountBase);

  const effectiveTaxRate = taxRate.gt(1) ? taxRate.dividedBy(100) : taxRate;
  const taxAmountForeign = taxableAmountForeign.times(effectiveTaxRate).toDecimalPlaces(2);
  const taxAmountBase = taxableAmountBase.times(effectiveTaxRate).toDecimalPlaces(2);

  const totalAmountForeign = taxableAmountForeign.plus(taxAmountForeign);
  const totalAmountBase = taxableAmountBase.plus(taxAmountBase);

  const serviceType = input.serviceType || ServiceType.OTHER;
  const costAccountCode = getCostAccountCodeForService(serviceType, input.customCostMapping);

  return {
    bookingServiceItemId: input.bookingServiceItemId,
    serviceType,
    description: input.description,
    quantity,
    unitCostForeign,
    unitCostBase,
    discountForeign,
    discountBase,
    taxRate,
    taxAmountForeign,
    taxAmountBase,
    isTaxRecoverable: Boolean(input.isTaxRecoverable),
    totalAmountForeign,
    totalAmountBase,
    costAccountCode,
    costAccountId: input.costAccountId,
    taxLiabilityAccountId: input.taxLiabilityAccountId,
  };
}

/**
 * Calculates Supplier Bill summary totals.
 */
export function calculateSupplierBillSummary(
  lines: CalculatedSupplierBillLine[]
): CalculatedSupplierBillTotals {
  let foreignSubTotal = new Decimal(0);
  let baseSubTotal = new Decimal(0);
  let discountAmount = new Decimal(0);
  let taxableAmount = new Decimal(0);
  let taxAmount = new Decimal(0);
  let grandTotal = new Decimal(0);
  let baseGrandTotal = new Decimal(0);

  for (const line of lines) {
    foreignSubTotal = foreignSubTotal.plus(line.unitCostForeign.times(line.quantity));
    baseSubTotal = baseSubTotal.plus(line.unitCostBase.times(line.quantity));
    discountAmount = discountAmount.plus(line.discountForeign);
    taxableAmount = taxableAmount.plus(line.unitCostForeign.times(line.quantity).minus(line.discountForeign));
    taxAmount = taxAmount.plus(line.taxAmountForeign);
    grandTotal = grandTotal.plus(line.totalAmountForeign);
    baseGrandTotal = baseGrandTotal.plus(line.totalAmountBase);
  }

  return {
    foreignSubTotal,
    baseSubTotal,
    discountAmount,
    taxableAmount,
    taxAmount,
    grandTotal,
    baseGrandTotal,
    lines,
  };
}

export function calculateSupplierBillTotals(
  inputs: (Parameters<typeof calculateSupplierBillLine>[0])[]
): CalculatedSupplierBillTotals {
  const calculatedLines = inputs.map((input) => calculateSupplierBillLine(input));
  return calculateSupplierBillSummary(calculatedLines);
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
 * Resolves account ID by code with caching and fallback creation.
 */
async function getAccountIdByCode(
  tx: any,
  code: string,
  defaultName: string,
  accountType: any,
  normalBalance: any
): Promise<string> {
  let account = await tx.chartOfAccount.findUnique({
    where: { code },
  });

  if (!account) {
    account = await tx.chartOfAccount.create({
      data: {
        code,
        name: defaultName,
        accountType,
        normalBalance,
        isSystem: true,
      },
    });
  }

  return account.id;
}

/**
 * Posts an approved Supplier Bill to the General Ledger.
 * Journal:
 *  DR Direct Cost Account (50XX) -> Subtotal Base
 *  DR Recoverable Input Tax (1210) (if configured recoverable) -> Tax Base
 *  CR Accounts Payable (2010) -> Grand Total Base
 */
export async function postSupplierBillToGL(
  tx: any,
  billId: string,
  userId: string
) {
  const bill = await tx.supplierBill.findUnique({
    where: { id: billId },
    include: {
      supplier: true,
      lines: {
        include: {
          costAccount: true,
        },
      },
    },
  });

  if (!bill) {
    throw new Error(`Supplier Bill ${billId} not found`);
  }

  if (bill.status === SupplierBillStatus.POSTED) {
    throw new Error("Supplier Bill is already posted to the General Ledger");
  }

  if (bill.status === SupplierBillStatus.CANCELLED) {
    throw new Error("Cancelled supplier bill cannot be posted");
  }

  if (bill.journalEntryId) {
    throw new Error("Supplier Bill already has an attached Journal Entry reference");
  }

  // Check period
  await assertPeriodOpen(bill.billDate);

  const grandTotalBase = toDecimal(bill.baseGrandTotal);
  if (grandTotalBase.lte(0)) {
    throw new Error("Cannot post a supplier bill with zero or negative grand total");
  }

  // Resolve Accounts Payable Account (2010)
  const apAccountId = await getAccountIdByCode(
    tx,
    ACCOUNT_CODES.ACCOUNTS_PAYABLE,
    "Accounts Payable",
    "LIABILITY",
    "CREDIT"
  );

  const lines: any[] = [];

  // 1. DEBITS: Cost / Expense lines & Recoverable Input Tax
  for (const line of bill.lines) {
    const costAccountCode = line.costAccount?.code || getCostAccountCodeForService(line.serviceType);
    const lineCostAccountId = line.costAccountId || (await getAccountIdByCode(
      tx,
      costAccountCode,
      `${line.serviceType} Cost`,
      "EXPENSE",
      "DEBIT"
    ));

    const lineCostBase = toDecimal(line.unitCostBase).times(line.quantity).minus(toDecimal(line.discountBase));
    const lineTaxBase = toDecimal(line.taxAmountBase);

    if (line.isTaxRecoverable && lineTaxBase.gt(0)) {
      // Debit Cost Account
      lines.push({
        accountId: lineCostAccountId,
        debit: lineCostBase.toNumber(),
        credit: 0,
        currency: bill.currency,
        exchangeRate: Number(bill.exchangeRate),
        foreignDebit: toDecimal(line.unitCostForeign).times(line.quantity).minus(toDecimal(line.discountForeign)).toNumber(),
        foreignCredit: 0,
        description: `${bill.billNumber}: ${line.description}`,
        supplierId: bill.supplierId,
        bookingId: bill.bookingId,
      });

      // Debit Recoverable Input Tax (1210 Asset)
      const inputTaxAccountId = await getAccountIdByCode(
        tx,
        ACCOUNT_CODES.INPUT_TAX_RECOVERABLE,
        "Input Tax Recoverable",
        "ASSET",
        "DEBIT"
      );

      lines.push({
        accountId: inputTaxAccountId,
        debit: lineTaxBase.toNumber(),
        credit: 0,
        currency: bill.currency,
        exchangeRate: Number(bill.exchangeRate),
        foreignDebit: Number(line.taxAmountForeign),
        foreignCredit: 0,
        description: `Input Tax on Bill ${bill.billNumber}`,
        supplierId: bill.supplierId,
        bookingId: bill.bookingId,
      });
    } else {
      // Non-recoverable tax is included directly in the cost
      const totalLineCostBase = lineCostBase.plus(lineTaxBase);
      lines.push({
        accountId: lineCostAccountId,
        debit: totalLineCostBase.toNumber(),
        credit: 0,
        currency: bill.currency,
        exchangeRate: Number(bill.exchangeRate),
        foreignDebit: Number(line.totalAmountForeign),
        foreignCredit: 0,
        description: `${bill.billNumber}: ${line.description}`,
        supplierId: bill.supplierId,
        bookingId: bill.bookingId,
      });
    }
  }

  // 2. CREDIT: Accounts Payable (2010)
  lines.push({
    accountId: apAccountId,
    debit: 0,
    credit: grandTotalBase.toNumber(),
    currency: bill.currency,
    exchangeRate: Number(bill.exchangeRate),
    foreignDebit: 0,
    foreignCredit: Number(bill.grandTotal),
    description: `Supplier Bill ${bill.billNumber} from ${bill.supplier.name}`,
    supplierId: bill.supplierId,
    bookingId: bill.bookingId,
  });

  // Validate balanced double entry
  const balanceCheck = validateJournalEntryBalance(lines);
  if (!balanceCheck.isValid) {
    throw new Error(`Supplier Bill Journal Entry is unbalanced: ${balanceCheck.difference.toString()} AFN difference`);
  }

  const jeCount = await tx.journalEntry.count();
  const entryNumber = `JE-${new Date(bill.billDate).getFullYear()}-${String(jeCount + 1).padStart(5, "0")}`;

  const journalEntry = await tx.journalEntry.create({
    data: {
      entryNumber,
      entryDate: bill.billDate,
      description: `Supplier Bill ${bill.billNumber} - ${bill.supplier.name}`,
      referenceType: "SUPPLIER_BILL",
      referenceId: bill.id,
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
          bookingId: l.bookingId || null,
        })),
      },
    },
  });

  const updatedBill = await tx.supplierBill.update({
    where: { id: bill.id },
    data: {
      status: SupplierBillStatus.POSTED,
      postedAt: new Date(),
      postedById: userId,
      journalEntryId: journalEntry.id,
    },
  });

  return { bill: updatedBill, journalEntry };
}

/**
 * Reverses a posted Supplier Bill.
 * Creates an exact reversing JournalEntry (DR 2010 AP / CR Costs & Tax).
 */
export async function reverseSupplierBillGL(
  tx: any,
  billId: string,
  reason: string,
  userId: string
) {
  const bill = await tx.supplierBill.findUnique({
    where: { id: billId },
    include: {
      journalEntry: {
        include: { lines: true },
      },
    },
  });

  if (!bill) {
    throw new Error("Supplier Bill not found");
  }

  if (bill.status !== SupplierBillStatus.POSTED && bill.status !== SupplierBillStatus.PARTIALLY_PAID) {
    throw new Error("Only posted supplier bills can be reversed");
  }

  if (toDecimal(bill.paidAmount).gt(0)) {
    throw new Error("Cannot cancel a supplier bill with recorded payments. Reverse payments first.");
  }

  if (!bill.journalEntry) {
    throw new Error("No posted journal entry found to reverse");
  }

  const reversalLines = createReversalLines(bill.journalEntry.lines);
  const jeCount = await tx.journalEntry.count();
  const entryNumber = `REV-${new Date().getFullYear()}-${String(jeCount + 1).padStart(5, "0")}`;

  const reversalEntry = await tx.journalEntry.create({
    data: {
      entryNumber,
      entryDate: new Date(),
      description: `Reversal of Supplier Bill ${bill.billNumber} - Reason: ${reason}`,
      referenceType: "REVERSAL",
      referenceId: bill.id,
      reversalOfId: bill.journalEntry.id,
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
          bookingId: l.bookingId || null,
        })),
      },
    },
  });

  const cancelledBill = await tx.supplierBill.update({
    where: { id: bill.id },
    data: {
      status: SupplierBillStatus.CANCELLED,
      cancellationReason: reason,
      cancelledAt: new Date(),
      cancelledById: userId,
    },
  });

  return { bill: cancelledBill, reversalEntry };
}

/**
 * Posts a Supplier Payment / Disbursement to the General Ledger.
 * Journal:
 *  DR Accounts Payable (2010) (for each settled bill at bill historical rate)
 *  DR Supplier Advances (1120) (for unallocated advance portion)
 *  CR Bank / Cash (1010/1020) (total disbursement at payment rate)
 *  DR/CR Realized FX Loss (8010) / FX Gain (7010)
 */
export async function postSupplierPaymentToGL(
  tx: any,
  paymentId: string,
  userId: string
) {
  const payment = await tx.supplierPayment.findUnique({
    where: { id: paymentId },
    include: {
      supplier: true,
      allocations: {
        include: { supplierBill: true },
      },
    },
  });

  if (!payment) {
    throw new Error(`Supplier Payment ${paymentId} not found`);
  }

  if (payment.status === SupplierPaymentStatus.POSTED) {
    throw new Error("Supplier Payment is already posted to the General Ledger");
  }

  if (payment.status === SupplierPaymentStatus.CANCELLED) {
    throw new Error("Cancelled supplier payment cannot be posted");
  }

  if (payment.journalEntryId) {
    throw new Error("Supplier Payment already has an attached Journal Entry reference");
  }

  // Check period
  await assertPeriodOpen(payment.paymentDate);

  const paymentBaseAmount = toDecimal(payment.baseAmount);
  if (paymentBaseAmount.lte(0)) {
    throw new Error("Cannot post a supplier payment with zero or negative amount");
  }

  // Resolve System Accounts
  const apAccountId = await getAccountIdByCode(
    tx,
    ACCOUNT_CODES.ACCOUNTS_PAYABLE,
    "Accounts Payable",
    "LIABILITY",
    "CREDIT"
  );
  const supplierAdvancesAccountId = await getAccountIdByCode(
    tx,
    ACCOUNT_CODES.SUPPLIER_ADVANCES,
    "Supplier Advances",
    "ASSET",
    "DEBIT"
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

  // 1. CREDIT: Bank/Cash Account (Disbursement)
  lines.push({
    accountId: payment.bankAccountId,
    debit: 0,
    credit: paymentBaseAmount.toNumber(),
    currency: payment.currency,
    exchangeRate: Number(payment.exchangeRate),
    foreignDebit: 0,
    foreignCredit: Number(payment.amount),
    description: `Supplier Payment ${payment.paymentNumber} to ${payment.supplier.name}`,
    supplierId: payment.supplierId,
    bookingId: payment.bookingId,
  });

  // 2. DEBITS: Bill Settlements & FX Calculation
  let totalAllocatedForeign = new Decimal(0);

  for (const alloc of payment.allocations) {
    if (!alloc.supplierBill) continue;

    const allocForeign = toDecimal(alloc.amountForeign);
    const allocBase = toDecimal(alloc.amountBase); // At payment rate
    const billSettledBase = toDecimal(alloc.billSettledBase); // At bill rate
    // On payment/disbursement:
    // If payment base < bill settled base => paid less base AFN to clear liability => FX Gain (Credit)
    // If payment base > bill settled base => paid more base AFN to clear liability => FX Loss (Debit)
    const fxDiff = billSettledBase.minus(allocBase);

    totalAllocatedForeign = totalAllocatedForeign.plus(allocForeign);

    // Debit AP with exact bill historical base amount relieved
    lines.push({
      accountId: apAccountId,
      debit: billSettledBase.toNumber(),
      credit: 0,
      currency: alloc.supplierBill.currency,
      exchangeRate: Number(alloc.supplierBill.exchangeRate),
      foreignDebit: Number(allocForeign),
      foreignCredit: 0,
      description: `Payment against Bill ${alloc.supplierBill.billNumber}`,
      supplierId: payment.supplierId,
      bookingId: alloc.supplierBill.bookingId || payment.bookingId,
    });

    if (fxDiff.gt(0)) {
      // Gain on supplier settlement (Credit)
      lines.push({
        accountId: fxGainAccountId,
        debit: 0,
        credit: fxDiff.toNumber(),
        currency: "AFN",
        exchangeRate: 1,
        foreignDebit: 0,
        foreignCredit: fxDiff.toNumber(),
        description: `FX Gain on settlement of Supplier Bill ${alloc.supplierBill.billNumber}`,
        supplierId: payment.supplierId,
      });
    } else if (fxDiff.lt(0)) {
      // Loss on supplier settlement (Debit)
      lines.push({
        accountId: fxLossAccountId,
        debit: fxDiff.abs().toNumber(),
        credit: 0,
        currency: "AFN",
        exchangeRate: 1,
        foreignDebit: fxDiff.abs().toNumber(),
        foreignCredit: 0,
        description: `FX Loss on settlement of Supplier Bill ${alloc.supplierBill.billNumber}`,
        supplierId: payment.supplierId,
      });
    }

    // Update bill paidAmount & balanceDue
    const newPaidAmount = toDecimal(alloc.supplierBill.paidAmount).plus(allocForeign);
    const newBalanceDue = toDecimal(alloc.supplierBill.grandTotal).minus(newPaidAmount);
    const newStatus = newBalanceDue.lte(0)
      ? SupplierBillStatus.PAID
      : SupplierBillStatus.PARTIALLY_PAID;

    await tx.supplierBill.update({
      where: { id: alloc.supplierBillId! },
      data: {
        paidAmount: newPaidAmount.toString(),
        balanceDue: newBalanceDue.toString(),
        status: newStatus,
      },
    });
  }

  // 3. DEBIT: Supplier Advances for unallocated portion
  const unallocatedForeign = toDecimal(payment.amount).minus(totalAllocatedForeign);
  const unallocatedBase = unallocatedForeign.times(payment.exchangeRate).toDecimalPlaces(2);

  if (unallocatedBase.gt(0)) {
    lines.push({
      accountId: supplierAdvancesAccountId,
      debit: unallocatedBase.toNumber(),
      credit: 0,
      currency: payment.currency,
      exchangeRate: Number(payment.exchangeRate),
      foreignDebit: unallocatedForeign.toNumber(),
      foreignCredit: 0,
      description: `Advance Payment to Supplier ${payment.supplier.name}`,
      supplierId: payment.supplierId,
      bookingId: payment.bookingId,
    });
  }

  // Validate balanced double-entry
  const balanceCheck = validateJournalEntryBalance(lines);
  if (!balanceCheck.isValid) {
    throw new Error(`Supplier Payment Journal is unbalanced: ${balanceCheck.difference.toString()} AFN difference`);
  }

  const jeCount = await tx.journalEntry.count();
  const entryNumber = `JE-${new Date(payment.paymentDate).getFullYear()}-${String(jeCount + 1).padStart(5, "0")}`;

  const journalEntry = await tx.journalEntry.create({
    data: {
      entryNumber,
      entryDate: payment.paymentDate,
      description: `Supplier Payment ${payment.paymentNumber} to ${payment.supplier.name}`,
      referenceType: "SUPPLIER_PAYMENT",
      referenceId: payment.id,
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
          bookingId: l.bookingId || null,
        })),
      },
    },
  });

  const updatedPayment = await tx.supplierPayment.update({
    where: { id: payment.id },
    data: {
      status: SupplierPaymentStatus.POSTED,
      postedAt: new Date(),
      postedById: userId,
      journalEntryId: journalEntry.id,
      unallocatedAmount: unallocatedForeign.toString(),
      unallocatedBase: unallocatedBase.toString(),
    },
  });

  return { payment: updatedPayment, journalEntry };
}

/**
 * Reverses a posted Supplier Payment, restoring any settled bills.
 */
export async function reverseSupplierPaymentGL(
  tx: any,
  paymentId: string,
  reason: string,
  userId: string
) {
  const payment = await tx.supplierPayment.findUnique({
    where: { id: paymentId },
    include: {
      journalEntry: { include: { lines: true } },
      allocations: { include: { supplierBill: true } },
    },
  });

  if (!payment) {
    throw new Error("Supplier Payment not found");
  }

  if (payment.status !== SupplierPaymentStatus.POSTED) {
    throw new Error("Only posted supplier payments can be reversed");
  }

  if (!payment.journalEntry) {
    throw new Error("No posted journal entry found to reverse");
  }

  // Restore settled bills
  for (const alloc of payment.allocations) {
    if (!alloc.supplierBill) continue;

    const restoredPaid = toDecimal(alloc.supplierBill.paidAmount).minus(toDecimal(alloc.amountForeign));
    const restoredBalance = toDecimal(alloc.supplierBill.grandTotal).minus(restoredPaid);
    const restoredStatus = restoredPaid.gt(0)
      ? SupplierBillStatus.PARTIALLY_PAID
      : SupplierBillStatus.POSTED;

    await tx.supplierBill.update({
      where: { id: alloc.supplierBillId! },
      data: {
        paidAmount: restoredPaid.toString(),
        balanceDue: restoredBalance.toString(),
        status: restoredStatus,
      },
    });
  }

  const reversalLines = createReversalLines(payment.journalEntry.lines);
  const jeCount = await tx.journalEntry.count();
  const entryNumber = `REV-${new Date().getFullYear()}-${String(jeCount + 1).padStart(5, "0")}`;

  const reversalEntry = await tx.journalEntry.create({
    data: {
      entryNumber,
      entryDate: new Date(),
      description: `Reversal of Supplier Payment ${payment.paymentNumber} - Reason: ${reason}`,
      referenceType: "REVERSAL",
      referenceId: payment.id,
      reversalOfId: payment.journalEntry.id,
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
          bookingId: l.bookingId || null,
        })),
      },
    },
  });

  const cancelledPayment = await tx.supplierPayment.update({
    where: { id: payment.id },
    data: {
      status: SupplierPaymentStatus.CANCELLED,
      cancellationReason: reason,
      cancelledAt: new Date(),
      cancelledById: userId,
    },
  });

  return { payment: cancelledPayment, reversalEntry };
}

/**
 * Allocates an unallocated Supplier Advance to a posted Supplier Bill.
 * Journal:
 *  DR 2010 Accounts Payable (Relieving AP liability)
 *  CR 1120 Supplier Advances (Relieving Advance asset)
 */
export async function allocateSupplierAdvanceToBill(
  tx: any,
  input: {
    paymentId: string;
    billId: string;
    amountToAllocateForeign: number | string | Decimal;
    userId: string;
  }
) {
  const { paymentId, billId, userId } = input;
  const amountToAllocate = toDecimal(input.amountToAllocateForeign);

  if (amountToAllocate.lte(0)) {
    throw new Error("Allocation amount must be strictly greater than zero");
  }

  const payment = await tx.supplierPayment.findUnique({
    where: { id: paymentId },
    include: { supplier: true },
  });

  if (!payment) {
    throw new Error(`Supplier Payment ${paymentId} not found`);
  }

  if (payment.status !== SupplierPaymentStatus.POSTED) {
    throw new Error("Only POSTED supplier payments can have advances allocated");
  }

  const bill = await tx.supplierBill.findUnique({
    where: { id: billId },
    include: { supplier: true },
  });

  if (!bill) {
    throw new Error(`Supplier Bill ${billId} not found`);
  }

  if (bill.status !== SupplierBillStatus.POSTED && bill.status !== SupplierBillStatus.PARTIALLY_PAID) {
    throw new Error("Advances can only be allocated to POSTED or PARTIALLY_PAID supplier bills");
  }

  if (payment.supplierId !== bill.supplierId) {
    throw new Error("Advance allocation requires matching supplier between payment and bill");
  }

  const availableAdvance = toDecimal(payment.unallocatedAmount);
  if (amountToAllocate.gt(availableAdvance)) {
    throw new Error(
      `Allocation amount (${amountToAllocate.toFixed(2)} ${payment.currency}) exceeds available advance (${availableAdvance.toFixed(2)} ${payment.currency})`
    );
  }

  const billBalanceDue = toDecimal(bill.balanceDue);
  if (amountToAllocate.gt(billBalanceDue)) {
    throw new Error(
      `Allocation amount (${amountToAllocate.toFixed(2)} ${bill.currency}) exceeds bill balance due (${billBalanceDue.toFixed(2)} ${bill.currency})`
    );
  }

  // Check period
  await assertPeriodOpen(new Date());

  const apAccountId = await getAccountIdByCode(
    tx,
    ACCOUNT_CODES.ACCOUNTS_PAYABLE,
    "Accounts Payable",
    "LIABILITY",
    "CREDIT"
  );
  const supplierAdvancesAccountId = await getAccountIdByCode(
    tx,
    ACCOUNT_CODES.SUPPLIER_ADVANCES,
    "Supplier Advances",
    "ASSET",
    "DEBIT"
  );

  const amountBase = amountToAllocate.times(payment.exchangeRate).toDecimalPlaces(2);
  const billSettledBase = amountToAllocate.times(bill.exchangeRate).toDecimalPlaces(2);
  const fxDiff = billSettledBase.minus(amountBase);

  const lines: any[] = [];

  // 1. DR Accounts Payable (2010) - Relieving AP
  lines.push({
    accountId: apAccountId,
    debit: billSettledBase.toNumber(),
    credit: 0,
    currency: bill.currency,
    exchangeRate: Number(bill.exchangeRate),
    foreignDebit: amountToAllocate.toNumber(),
    foreignCredit: 0,
    description: `Advance Allocation from ${payment.paymentNumber} to ${bill.billNumber}`,
    supplierId: bill.supplierId,
    bookingId: bill.bookingId || payment.bookingId,
  });

  // 2. CR Supplier Advances (1120) - Relieving advance asset
  lines.push({
    accountId: supplierAdvancesAccountId,
    debit: 0,
    credit: amountBase.toNumber(),
    currency: payment.currency,
    exchangeRate: Number(payment.exchangeRate),
    foreignDebit: 0,
    foreignCredit: amountToAllocate.toNumber(),
    description: `Advance Allocation from ${payment.paymentNumber} to ${bill.billNumber}`,
    supplierId: bill.supplierId,
    bookingId: bill.bookingId || payment.bookingId,
  });

  // 3. FX Difference
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
      description: `FX Gain on Advance Allocation ${payment.paymentNumber} -> ${bill.billNumber}`,
      supplierId: bill.supplierId,
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
      description: `FX Loss on Advance Allocation ${payment.paymentNumber} -> ${bill.billNumber}`,
      supplierId: bill.supplierId,
    });
  }

  const balanceCheck = validateJournalEntryBalance(lines);
  if (!balanceCheck.isValid) {
    throw new Error(`Supplier Advance Allocation Journal is unbalanced: ${balanceCheck.difference.toString()} AFN difference`);
  }

  const jeCount = await tx.journalEntry.count();
  const entryNumber = `JE-${new Date().getFullYear()}-${String(jeCount + 1).padStart(5, "0")}`;

  const journalEntry = await tx.journalEntry.create({
    data: {
      entryNumber,
      entryDate: new Date(),
      description: `Supplier Advance Allocation: Payment ${payment.paymentNumber} applied to Bill ${bill.billNumber}`,
      referenceType: "ADVANCE_ALLOCATION",
      referenceId: bill.id,
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
          bookingId: l.bookingId || null,
        })),
      },
    },
  });

  const allocation = await tx.supplierPaymentAllocation.create({
    data: {
      supplierPaymentId: payment.id,
      supplierBillId: bill.id,
      amountForeign: amountToAllocate.toString(),
      amountBase: amountBase.toString(),
      billSettledBase: billSettledBase.toString(),
      fxGainLossAmount: fxDiff.toString(),
      allocatedById: userId,
    },
  });

  // Update payment unallocated amounts
  const newUnallocatedForeign = availableAdvance.minus(amountToAllocate);
  const newUnallocatedBase = newUnallocatedForeign.times(payment.exchangeRate).toDecimalPlaces(2);
  await tx.supplierPayment.update({
    where: { id: payment.id },
    data: {
      unallocatedAmount: newUnallocatedForeign.toString(),
      unallocatedBase: newUnallocatedBase.toString(),
    },
  });

  // Update bill paidAmount & balanceDue
  const newPaidAmount = toDecimal(bill.paidAmount).plus(amountToAllocate);
  const newBalanceDue = toDecimal(bill.grandTotal).minus(newPaidAmount);
  const newStatus = newBalanceDue.lte(0)
    ? SupplierBillStatus.PAID
    : SupplierBillStatus.PARTIALLY_PAID;

  const updatedBill = await tx.supplierBill.update({
    where: { id: bill.id },
    data: {
      paidAmount: newPaidAmount.toString(),
      balanceDue: newBalanceDue.toString(),
      status: newStatus,
    },
  });

  return { allocation, journalEntry, bill: updatedBill };
}
