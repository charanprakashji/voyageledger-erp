import Decimal from "decimal.js";
import { formatDate, formatDateTime } from "./utils";

export { formatDate, formatDateTime };

// Set precision for accounting
Decimal.set({ precision: 20, rounding: Decimal.ROUND_HALF_UP });

export type AccountCategory = "ASSET" | "LIABILITY" | "EQUITY" | "REVENUE" | "EXPENSE";
export type NormalBalanceType = "DEBIT" | "CREDIT";

/**
 * Initial standard Chart of Accounts for Afghanistan-based Travel Business.
 * Primary base operating currency: AFN (Afghan Afghani).
 */
export const DEFAULT_CHART_OF_ACCOUNTS = [
  // 1000 - ASSETS
  { code: "1000", name: "Assets", accountType: "ASSET" as const, normalBalance: "DEBIT" as const, parentCode: null, isSystem: true },
  { code: "1010", name: "Cash (AFN)", accountType: "ASSET" as const, normalBalance: "DEBIT" as const, parentCode: "1000", isSystem: true },
  { code: "1020", name: "Bank (AFN)", accountType: "ASSET" as const, normalBalance: "DEBIT" as const, parentCode: "1000", isSystem: true },
  { code: "1030", name: "Foreign Currency Bank/Cash (USD / EUR / AED)", accountType: "ASSET" as const, normalBalance: "DEBIT" as const, parentCode: "1000", isSystem: true },
  { code: "1100", name: "Accounts Receivable", accountType: "ASSET" as const, normalBalance: "DEBIT" as const, parentCode: "1000", isSystem: true },

  // 2000 - LIABILITIES
  { code: "2000", name: "Liabilities", accountType: "LIABILITY" as const, normalBalance: "CREDIT" as const, parentCode: null, isSystem: true },
  { code: "2010", name: "Accounts Payable", accountType: "LIABILITY" as const, normalBalance: "CREDIT" as const, parentCode: "2000", isSystem: true },
  { code: "2020", name: "Customer Advances", accountType: "LIABILITY" as const, normalBalance: "CREDIT" as const, parentCode: "2000", isSystem: true },
  { code: "2030", name: "Taxes Payable", accountType: "LIABILITY" as const, normalBalance: "CREDIT" as const, parentCode: "2000", isSystem: true },

  // 3000 - EQUITY
  { code: "3000", name: "Equity", accountType: "EQUITY" as const, normalBalance: "CREDIT" as const, parentCode: null, isSystem: true },
  { code: "3010", name: "Owner Capital", accountType: "EQUITY" as const, normalBalance: "CREDIT" as const, parentCode: "3000", isSystem: true },
  { code: "3020", name: "Retained Earnings", accountType: "EQUITY" as const, normalBalance: "CREDIT" as const, parentCode: "3000", isSystem: true },

  // 4000 - REVENUE
  { code: "4000", name: "Revenue", accountType: "REVENUE" as const, normalBalance: "CREDIT" as const, parentCode: null, isSystem: true },
  { code: "4010", name: "Air Ticket Revenue", accountType: "REVENUE" as const, normalBalance: "CREDIT" as const, parentCode: "4000", isSystem: true },
  { code: "4020", name: "Hotel Revenue", accountType: "REVENUE" as const, normalBalance: "CREDIT" as const, parentCode: "4000", isSystem: true },
  { code: "4030", name: "Tour Package Revenue", accountType: "REVENUE" as const, normalBalance: "CREDIT" as const, parentCode: "4000", isSystem: true },
  { code: "4040", name: "Visa Service Revenue", accountType: "REVENUE" as const, normalBalance: "CREDIT" as const, parentCode: "4000", isSystem: true },
  { code: "4050", name: "Transport Revenue", accountType: "REVENUE" as const, normalBalance: "CREDIT" as const, parentCode: "4000", isSystem: true },
  { code: "4060", name: "Commission Income", accountType: "REVENUE" as const, normalBalance: "CREDIT" as const, parentCode: "4000", isSystem: true },
  { code: "4090", name: "Other Travel Revenue", accountType: "REVENUE" as const, normalBalance: "CREDIT" as const, parentCode: "4000", isSystem: true },

  // 5000 - DIRECT COST OF SERVICES
  { code: "5000", name: "Direct Cost of Services", accountType: "EXPENSE" as const, normalBalance: "DEBIT" as const, parentCode: null, isSystem: true },
  { code: "5010", name: "Airline/Supplier Cost", accountType: "EXPENSE" as const, normalBalance: "DEBIT" as const, parentCode: "5000", isSystem: true },
  { code: "5020", name: "Hotel/DMC Cost", accountType: "EXPENSE" as const, normalBalance: "DEBIT" as const, parentCode: "5000", isSystem: true },
  { code: "5030", name: "Visa Provider Cost", accountType: "EXPENSE" as const, normalBalance: "DEBIT" as const, parentCode: "5000", isSystem: true },
  { code: "5040", name: "Transport Cost", accountType: "EXPENSE" as const, normalBalance: "DEBIT" as const, parentCode: "5000", isSystem: true },
  { code: "5050", name: "Tour/Guide Cost", accountType: "EXPENSE" as const, normalBalance: "DEBIT" as const, parentCode: "5000", isSystem: true },

  // 6000 - OPERATING EXPENSES
  { code: "6000", name: "Operating Expenses", accountType: "EXPENSE" as const, normalBalance: "DEBIT" as const, parentCode: null, isSystem: true },
  { code: "6010", name: "Rent", accountType: "EXPENSE" as const, normalBalance: "DEBIT" as const, parentCode: "6000", isSystem: true },
  { code: "6020", name: "Salaries", accountType: "EXPENSE" as const, normalBalance: "DEBIT" as const, parentCode: "6000", isSystem: true },
  { code: "6030", name: "Bank Charges", accountType: "EXPENSE" as const, normalBalance: "DEBIT" as const, parentCode: "6000", isSystem: true },
  { code: "6040", name: "Software", accountType: "EXPENSE" as const, normalBalance: "DEBIT" as const, parentCode: "6000", isSystem: true },
  { code: "6050", name: "Office Expenses", accountType: "EXPENSE" as const, normalBalance: "DEBIT" as const, parentCode: "6000", isSystem: true },
  { code: "6090", name: "Other Operating Expenses", accountType: "EXPENSE" as const, normalBalance: "DEBIT" as const, parentCode: "6000", isSystem: true },

  // 7000 - OTHER INCOME & FX GAINS
  { code: "7000", name: "Other Income & FX Gains", accountType: "REVENUE" as const, normalBalance: "CREDIT" as const, parentCode: null, isSystem: true },
  { code: "7010", name: "Foreign Exchange Gain", accountType: "REVENUE" as const, normalBalance: "CREDIT" as const, parentCode: "7000", isSystem: true },

  // 8000 - OTHER EXPENSES & FX LOSSES
  { code: "8000", name: "Other Expenses & FX Losses", accountType: "EXPENSE" as const, normalBalance: "DEBIT" as const, parentCode: null, isSystem: true },
  { code: "8010", name: "Foreign Exchange Loss", accountType: "EXPENSE" as const, normalBalance: "DEBIT" as const, parentCode: "8000", isSystem: true },
];

export const ACCOUNT_CODES = {
  CASH_AFN: "1010",
  BANK_AFN: "1020",
  FX_VAULT: "1030",
  ACCOUNTS_RECEIVABLE: "1100",
  SUPPLIER_ADVANCES: "1120",
  INPUT_TAX_RECOVERABLE: "1210",
  ACCOUNTS_PAYABLE: "2010",
  CUSTOMER_ADVANCES: "2020",
  TAXES_PAYABLE: "2030",
  AIR_TICKET_REVENUE: "4010",
  HOTEL_REVENUE: "4020",
  TOUR_PACKAGE_REVENUE: "4030",
  VISA_SERVICE_REVENUE: "4040",
  TRANSPORT_REVENUE: "4050",
  COMMISSION_INCOME: "4060",
  OTHER_REVENUE: "4090",
  COST_AIRLINE: "5010",
  COST_HOTEL: "5020",
  COST_VISA: "5030",
  COST_TRANSPORT: "5040",
  COST_TOUR: "5050",
  COST_OTHER: "5090",
  EXPENSE_RENT: "6010",
  EXPENSE_SALARIES: "6020",
  EXPENSE_BANK_FEES: "6030",
  EXPENSE_SOFTWARE: "6040",
  EXPENSE_OFFICE: "6050",
  EXPENSE_OTHER: "6090",
  FX_GAIN: "7010",
  FX_LOSS: "8010",
} as const;

export function getFxGainAccountCode(customMapping?: Record<string, string>): string {
  return customMapping?.["FX_GAIN"] || ACCOUNT_CODES.FX_GAIN;
}

export function getFxLossAccountCode(customMapping?: Record<string, string>): string {
  return customMapping?.["FX_LOSS"] || ACCOUNT_CODES.FX_LOSS;
}

export function getRevenueAccountCodeForService(
  serviceType: string,
  customMapping?: Record<string, string>
): string {
  const normalized = serviceType?.toUpperCase();
  if (customMapping && customMapping[normalized]) {
    return customMapping[normalized];
  }

  switch (normalized) {
    case "FLIGHT":
      return ACCOUNT_CODES.AIR_TICKET_REVENUE;
    case "HOTEL":
      return ACCOUNT_CODES.HOTEL_REVENUE;
    case "TOUR":
      return ACCOUNT_CODES.TOUR_PACKAGE_REVENUE;
    case "VISA":
      return ACCOUNT_CODES.VISA_SERVICE_REVENUE;
    case "TRANSFER":
    case "TRANSPORT":
    case "BUS":
    case "TRAIN":
    case "CAR_RENTAL":
      return ACCOUNT_CODES.TRANSPORT_REVENUE;
    case "INSURANCE":
      // Configurable fallback: Defaults to commission/insurance income or custom configured code
      return customMapping?.["INSURANCE"] || ACCOUNT_CODES.COMMISSION_INCOME;
    default:
      return customMapping?.["OTHER"] || ACCOUNT_CODES.OTHER_REVENUE;
  }
}

export function getCostAccountCodeForService(
  serviceType: string,
  customMapping?: Record<string, string>
): string {
  const normalized = serviceType?.toUpperCase();
  if (customMapping && customMapping[normalized]) {
    return customMapping[normalized];
  }

  switch (normalized) {
    case "FLIGHT":
      return ACCOUNT_CODES.COST_AIRLINE;
    case "HOTEL":
      return ACCOUNT_CODES.COST_HOTEL;
    case "VISA":
      return ACCOUNT_CODES.COST_VISA;
    case "TRANSFER":
    case "TRANSPORT":
    case "BUS":
    case "TRAIN":
    case "CAR_RENTAL":
      return ACCOUNT_CODES.COST_TRANSPORT;
    case "TOUR":
      return ACCOUNT_CODES.COST_TOUR;
    default:
      return customMapping?.["OTHER"] || ACCOUNT_CODES.COST_OTHER;
  }
}

/**
 * Converts any number, string, or Decimal to a safe Decimal instance.
 */
export function toDecimal(value: number | string | Decimal | null | undefined): Decimal {
  if (value === null || value === undefined || value === "") {
    return new Decimal(0);
  }
  return new Decimal(value);
}

/**
 * Formats a monetary amount into standard accounting currency format.
 * Default base currency: AFN (Afghan Afghani).
 */
export function formatCurrency(
  amount: number | string | Decimal | null | undefined,
  currency: string = "AFN",
  locale: string = "en-US"
): string {
  const dec = toDecimal(amount);
  const num = dec.toNumber();

  try {
    return new Intl.NumberFormat(locale, {
      style: "currency",
      currency: currency,
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(num);
  } catch {
    return `${currency} ${num.toLocaleString(locale, {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    })}`;
  }
}

/**
 * Multi-Currency conversion helper:
 * Converts foreign currency amount into base currency (AFN) using the specified exchange rate.
 * Base Amount = Foreign Amount * Exchange Rate
 */
export function toBaseCurrency(
  foreignAmount: number | string | Decimal,
  exchangeRate: number | string | Decimal = 1
): Decimal {
  const amount = toDecimal(foreignAmount);
  const rate = toDecimal(exchangeRate);
  return amount.times(rate).toDecimalPlaces(2);
}

export interface JournalLineInput {
  accountId: string;
  debit: number | string | Decimal; // In base currency AFN
  credit: number | string | Decimal; // In base currency AFN
  currency?: string;
  exchangeRate?: number | string | Decimal;
  foreignDebit?: number | string | Decimal;
  foreignCredit?: number | string | Decimal;
  description?: string;
  customerId?: string;
  supplierId?: string;
  bookingId?: string;
}

/**
 * Validates the core Double-Entry Accounting Invariant on Base Currency (AFN):
 * SUM(debit) MUST EQUAL SUM(credit)
 * AND entry must have at least 2 lines.
 */
export function validateJournalEntryBalance(lines: JournalLineInput[]): {
  isValid: boolean;
  totalDebits: Decimal;
  totalCredits: Decimal;
  difference: Decimal;
  errorMessage?: string;
} {
  if (!lines || lines.length < 2) {
    return {
      isValid: false,
      totalDebits: new Decimal(0),
      totalCredits: new Decimal(0),
      difference: new Decimal(0),
      errorMessage: "A journal entry must contain at least two lines.",
    };
  }

  let totalDebits = new Decimal(0);
  let totalCredits = new Decimal(0);

  for (const line of lines) {
    const debit = toDecimal(line.debit);
    const credit = toDecimal(line.credit);

    if (debit.lt(0) || credit.lt(0)) {
      return {
        isValid: false,
        totalDebits,
        totalCredits,
        difference: totalDebits.minus(totalCredits),
        errorMessage: "Debit and credit amounts cannot be negative.",
      };
    }

    if (debit.gt(0) && credit.gt(0)) {
      return {
        isValid: false,
        totalDebits,
        totalCredits,
        difference: totalDebits.minus(totalCredits),
        errorMessage: "A journal line cannot have both a debit and a credit amount.",
      };
    }

    if (debit.isZero() && credit.isZero()) {
      return {
        isValid: false,
        totalDebits,
        totalCredits,
        difference: totalDebits.minus(totalCredits),
        errorMessage: "A journal line must have either a debit or a credit amount greater than 0.",
      };
    }

    totalDebits = totalDebits.plus(debit);
    totalCredits = totalCredits.plus(credit);
  }

  const difference = totalDebits.minus(totalCredits).abs();
  const isBalanced = difference.isZero();

  return {
    isValid: isBalanced,
    totalDebits: totalDebits.toDecimalPlaces(2),
    totalCredits: totalCredits.toDecimalPlaces(2),
    difference: difference.toDecimalPlaces(2),
    errorMessage: isBalanced
      ? undefined
      : `Accounting Invariant Violated: Total Debits (${totalDebits.toFixed(2)} AFN) != Total Credits (${totalCredits.toFixed(2)} AFN). Difference: ${difference.toFixed(2)} AFN`,
  };
}

/**
 * Creates an exact offsetting reversal for a posted Journal Entry.
 * Debits become Credits, Credits become Debits.
 */
export function createReversalLines(lines: {
  accountId: string;
  debit: number | string | Decimal;
  credit: number | string | Decimal;
  currency?: string;
  exchangeRate?: number | string | Decimal;
  foreignDebit?: number | string | Decimal;
  foreignCredit?: number | string | Decimal;
  description?: string | null;
  customerId?: string | null;
  supplierId?: string | null;
  bookingId?: string | null;
}[]): JournalLineInput[] {
  return lines.map((line) => ({
    accountId: line.accountId,
    debit: toDecimal(line.credit),
    credit: toDecimal(line.debit),
    currency: line.currency || "AFN",
    exchangeRate: line.exchangeRate || 1,
    foreignDebit: toDecimal(line.foreignCredit),
    foreignCredit: toDecimal(line.foreignDebit),
    description: `Reversal of: ${line.description || "Original Entry"}`,
    customerId: line.customerId || undefined,
    supplierId: line.supplierId || undefined,
    bookingId: line.bookingId || undefined,
  }));
}

/**
 * Calculates line-item markup / gross profit margin.
 */
export function calculateMargin(
  sellPrice: number | string | Decimal,
  costPrice: number | string | Decimal
): {
  marginAmount: Decimal;
  marginPercent: Decimal;
} {
  const sell = toDecimal(sellPrice);
  const cost = toDecimal(costPrice);
  const marginAmount = sell.minus(cost);
  const marginPercent = sell.isZero()
    ? new Decimal(0)
    : marginAmount.dividedBy(sell).times(100);

  return {
    marginAmount,
    marginPercent: marginPercent.toDecimalPlaces(2),
  };
}

/**
 * Computes Tax & Grand Total accurately without floating-point errors.
 */
export function calculateInvoiceTotals(
  subTotal: number | string | Decimal,
  taxPercent: number | string | Decimal = 0,
  discountAmount: number | string | Decimal = 0,
  exchangeRate: number | string | Decimal = 1
): {
  subTotal: Decimal;
  taxAmount: Decimal;
  discountAmount: Decimal;
  grandTotal: Decimal;
  baseGrandTotal: Decimal;
} {
  const sub = toDecimal(subTotal);
  const taxPct = toDecimal(taxPercent);
  const discount = toDecimal(discountAmount);
  const rate = toDecimal(exchangeRate);

  const taxableAmount = Decimal.max(0, sub.minus(discount));
  const taxAmount = taxableAmount.times(taxPct).dividedBy(100).toDecimalPlaces(2);
  const grandTotal = taxableAmount.plus(taxAmount).toDecimalPlaces(2);
  const baseGrandTotal = grandTotal.times(rate).toDecimalPlaces(2);

  return {
    subTotal: sub.toDecimalPlaces(2),
    taxAmount,
    discountAmount: discount.toDecimalPlaces(2),
    grandTotal,
    baseGrandTotal,
  };
}

/**
 * Computes new running balance for subsidiary ledger entries.
 */
export function computeNewLedgerBalance(
  previousBalance: number | string | Decimal,
  debitAmount: number | string | Decimal,
  creditAmount: number | string | Decimal,
  accountType: "CUSTOMER" | "SUPPLIER"
): Decimal {
  const prev = toDecimal(previousBalance);
  const debit = toDecimal(debitAmount);
  const credit = toDecimal(creditAmount);

  if (accountType === "CUSTOMER") {
    // For customers (Receivable): Debit increases balance, Credit reduces balance
    return prev.plus(debit).minus(credit).toDecimalPlaces(2);
  } else {
    // For suppliers (Payable): Credit increases balance, Debit reduces balance
    return prev.plus(credit).minus(debit).toDecimalPlaces(2);
  }
}
