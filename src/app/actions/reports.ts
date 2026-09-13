"use server";

import { requireRole, handleActionError } from "@/lib/auth";
import { UserRole } from "@prisma/client";
import {
  getTrialBalance,
  getProfitAndLoss,
  getBalanceSheet,
  getBookingProfitability,
  getSupplierDerivedLedger,
} from "@/lib/financialReports";
import { runAccountingReconciliation } from "@/lib/reconciliation";
import {
  getAdvancedGeneralLedger,
  getArAgingReport,
  getApAgingReport,
  getCashBankReport,
  getFxReport,
  getTaxReport,
  getRevenueAnalysis,
  getExpenseAnalysis,
  GeneralLedgerFilter,
} from "@/lib/advancedReports";
import { getCustomerDerivedLedger } from "@/lib/ledger";

export async function fetchReconciliationReport() {
  try {
    await requireRole([
      UserRole.ADMIN,
      UserRole.MANAGER,
      UserRole.ACCOUNTANT,
      UserRole.AUDITOR,
    ]);

    const report = await runAccountingReconciliation();
    return { success: true as const, data: report };
  } catch (error: any) {
    return handleActionError(error, "Failed to execute reconciliation");
  }
}

export async function fetchAdvancedGeneralLedger(filter: GeneralLedgerFilter) {
  try {
    await requireRole([
      UserRole.ADMIN,
      UserRole.MANAGER,
      UserRole.ACCOUNTANT,
      UserRole.AUDITOR,
    ]);

    const report = await getAdvancedGeneralLedger(filter);
    return { success: true as const, data: report };
  } catch (error: any) {
    return handleActionError(error, "Failed to generate general ledger");
  }
}

export async function fetchArAging(asOfDate?: string) {
  try {
    await requireRole([
      UserRole.ADMIN,
      UserRole.MANAGER,
      UserRole.ACCOUNTANT,
      UserRole.AUDITOR,
    ]);

    const report = await getArAgingReport(asOfDate);
    return { success: true as const, data: report };
  } catch (error: any) {
    return handleActionError(error, "Failed to generate AR aging report");
  }
}

export async function fetchApAging(asOfDate?: string) {
  try {
    await requireRole([
      UserRole.ADMIN,
      UserRole.MANAGER,
      UserRole.ACCOUNTANT,
      UserRole.AUDITOR,
    ]);

    const report = await getApAgingReport(asOfDate);
    return { success: true as const, data: report };
  } catch (error: any) {
    return handleActionError(error, "Failed to generate AP aging report");
  }
}

export async function fetchCashBankReport(startDate?: string, endDate?: string) {
  try {
    await requireRole([
      UserRole.ADMIN,
      UserRole.MANAGER,
      UserRole.ACCOUNTANT,
      UserRole.AUDITOR,
    ]);

    const report = await getCashBankReport(startDate, endDate);
    return { success: true as const, data: report };
  } catch (error: any) {
    return handleActionError(error, "Failed to generate Cash & Bank report");
  }
}

export async function fetchFxReport(startDate?: string, endDate?: string) {
  try {
    await requireRole([
      UserRole.ADMIN,
      UserRole.MANAGER,
      UserRole.ACCOUNTANT,
      UserRole.AUDITOR,
    ]);

    const report = await getFxReport(startDate, endDate);
    return { success: true as const, data: report };
  } catch (error: any) {
    return handleActionError(error, "Failed to generate FX report");
  }
}

export async function fetchTaxReport() {
  try {
    await requireRole([
      UserRole.ADMIN,
      UserRole.MANAGER,
      UserRole.ACCOUNTANT,
      UserRole.AUDITOR,
    ]);

    const report = await getTaxReport();
    return { success: true as const, data: report };
  } catch (error: any) {
    return handleActionError(error, "Failed to generate Tax report");
  }
}

export async function fetchRevenueAnalysis() {
  try {
    await requireRole([
      UserRole.ADMIN,
      UserRole.MANAGER,
      UserRole.ACCOUNTANT,
      UserRole.AUDITOR,
    ]);

    const report = await getRevenueAnalysis();
    return { success: true as const, data: report };
  } catch (error: any) {
    return handleActionError(error, "Failed to generate Revenue analysis");
  }
}

export async function fetchExpenseAnalysis() {
  try {
    await requireRole([
      UserRole.ADMIN,
      UserRole.MANAGER,
      UserRole.ACCOUNTANT,
      UserRole.AUDITOR,
    ]);

    const report = await getExpenseAnalysis();
    return { success: true as const, data: report };
  } catch (error: any) {
    return handleActionError(error, "Failed to generate Expense analysis");
  }
}

export async function fetchTrialBalance(asOfDate?: string) {
  try {
    await requireRole([
      UserRole.ADMIN,
      UserRole.MANAGER,
      UserRole.ACCOUNTANT,
      UserRole.AUDITOR,
    ]);

    const report = await getTrialBalance(asOfDate ? new Date(asOfDate) : undefined);
    return { success: true as const, data: report };
  } catch (error: any) {
    return handleActionError(error, "Failed to generate trial balance");
  }
}

export async function fetchProfitAndLoss(fromDate?: string, toDate?: string) {
  try {
    await requireRole([
      UserRole.ADMIN,
      UserRole.MANAGER,
      UserRole.ACCOUNTANT,
      UserRole.AUDITOR,
    ]);

    const report = await getProfitAndLoss(
      fromDate ? new Date(fromDate) : undefined,
      toDate ? new Date(toDate) : undefined
    );
    return { success: true as const, data: report };
  } catch (error: any) {
    return handleActionError(error, "Failed to generate profit and loss");
  }
}

export async function fetchBalanceSheet(asOfDate?: string) {
  try {
    await requireRole([
      UserRole.ADMIN,
      UserRole.MANAGER,
      UserRole.ACCOUNTANT,
      UserRole.AUDITOR,
    ]);

    const report = await getBalanceSheet(asOfDate ? new Date(asOfDate) : undefined);
    return { success: true as const, data: report };
  } catch (error: any) {
    return handleActionError(error, "Failed to generate balance sheet");
  }
}

export async function fetchBookingProfitability(bookingId?: string) {
  try {
    await requireRole([
      UserRole.ADMIN,
      UserRole.MANAGER,
      UserRole.ACCOUNTANT,
      UserRole.TRAVEL_AGENT,
      UserRole.AUDITOR,
    ]);

    const report = await getBookingProfitability(bookingId);
    return { success: true as const, data: report };
  } catch (error: any) {
    return handleActionError(error, "Failed to generate booking profitability");
  }
}

export async function fetchCustomerStatement(customerId: string, fromDate?: string, toDate?: string) {
  try {
    await requireRole([
      UserRole.ADMIN,
      UserRole.MANAGER,
      UserRole.ACCOUNTANT,
      UserRole.TRAVEL_AGENT,
      UserRole.AUDITOR,
    ]);

    const report = await getCustomerDerivedLedger(
      customerId,
      fromDate ? new Date(fromDate) : undefined,
      toDate ? new Date(toDate) : undefined
    );
    return { success: true as const, data: report };
  } catch (error: any) {
    return handleActionError(error, "Failed to generate customer statement");
  }
}

export async function fetchSupplierStatement(supplierId: string, fromDate?: string, toDate?: string) {
  try {
    await requireRole([
      UserRole.ADMIN,
      UserRole.MANAGER,
      UserRole.ACCOUNTANT,
      UserRole.TRAVEL_AGENT,
      UserRole.AUDITOR,
    ]);

    const report = await getSupplierDerivedLedger(
      supplierId,
      fromDate ? new Date(fromDate) : undefined,
      toDate ? new Date(toDate) : undefined
    );
    return { success: true as const, data: report };
  } catch (error: any) {
    return handleActionError(error, "Failed to generate supplier statement");
  }
}
