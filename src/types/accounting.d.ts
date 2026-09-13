export type UserRole =
  | "ADMIN"
  | "MANAGER"
  | "ACCOUNTANT"
  | "TRAVEL_AGENT"
  | "AUDITOR";

export type AccountType =
  | "ASSET"
  | "LIABILITY"
  | "EQUITY"
  | "REVENUE"
  | "EXPENSE";

export type NormalBalance = "DEBIT" | "CREDIT";

export type JournalStatus = "DRAFT" | "POSTED" | "REVERSED";

export type BookingStatus =
  | "DRAFT"
  | "CONFIRMED"
  | "TICKETED"
  | "CANCELLED"
  | "COMPLETED";

export type ServiceType =
  | "FLIGHT"
  | "HOTEL"
  | "VISA"
  | "TRANSFER"
  | "TOUR"
  | "INSURANCE"
  | "OTHER";

export type InvoiceStatus =
  | "DRAFT"
  | "UNPAID"
  | "PARTIALLY_PAID"
  | "PAID"
  | "CANCELLED"
  | "REVERSED";

export type PaymentMethod =
  | "CASH"
  | "BANK_TRANSFER"
  | "CREDIT_CARD"
  | "CHEQUE"
  | "HAWALA_TRANSFER"
  | "EXCHANGE_OFFICE"
  | "OTHER";

export interface ChartOfAccountNode {
  id: string;
  code: string;
  name: string;
  accountType: AccountType;
  normalBalance: NormalBalance;
  parentAccountId?: string | null;
  currency: string;
  description?: string | null;
  isActive: boolean;
  isSystemAccount: boolean;
  children?: ChartOfAccountNode[];
}

export interface TaxConfigurationDTO {
  id: string;
  taxCode: string;
  taxName: string;
  percentage: string; // Serialized Decimal e.g. "4.00"
  isActive: boolean;
  effectiveFrom: string;
  effectiveTo?: string | null;
  applicableServiceTypes: string[];
  liabilityAccountId?: string | null;
  description?: string | null;
}

export interface JournalLineDTO {
  id?: string;
  accountId: string;
  accountCode?: string;
  accountName?: string;
  debit: string; // In base currency AFN
  credit: string; // In base currency AFN
  currency?: string; // e.g. "USD", "EUR", "AFN"
  exchangeRate?: string; // Rate to AFN
  foreignDebit?: string;
  foreignCredit?: string;
  description?: string;
  customerId?: string;
  supplierId?: string;
  bookingId?: string;
}

export interface JournalEntryDTO {
  id: string;
  entryNumber: string;
  entryDate: string;
  description: string;
  referenceType?: string | null;
  referenceId?: string | null;
  status: JournalStatus;
  periodId?: string | null;
  createdById: string;
  postedAt?: string | null;
  reversalOfId?: string | null;
  lines: JournalLineDTO[];
}

export interface TrialBalanceRow {
  accountCode: string;
  accountName: string;
  accountType: AccountType;
  debitBalance: string; // AFN
  creditBalance: string; // AFN
}

export interface FinancialMetricCard {
  title: string;
  amount: string;
  changePercent?: string;
  isPositive?: boolean;
  subtext?: string;
  iconName: string;
}
