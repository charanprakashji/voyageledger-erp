"use server";

import { requireRole } from "@/lib/auth";
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
  await requireRole([
    UserRole.ADMIN,
    UserRole.MANAGER,
    UserRole.ACCOUNTANT,
    UserRole.AUDITOR,
  ]);

  try {
    const report = await runAccountingReconciliation();
    return { success: true, data: report };
  } catch (error: any) {
    console.error("Error executing accounting reconciliation:", error);
    return { success: false, error: error.message || "Failed to execute reconciliation" };
  }
}

export async function fetchAdvancedGeneralLedger(filter: GeneralLedgerFilter) {
  await requireRole([
    UserRole.ADMIN,
    UserRole.MANAGER,
    UserRole.ACCOUNTANT,
    UserRole.AUDITOR,
  ]);

  try {
    const report = await getAdvancedGeneralLedger(filter);
    return { success: true, data: report };
  } catch (error: any) {
    console.error("Error fetching general ledger:", error);
    return { success: false, error: error.message || "Failed to generate general ledger" };
  }
}

export async function fetchArAging(asOfDate?: string) {
  await requireRole([
    UserRole.ADMIN,
    UserRole.MANAGER,
    UserRole.ACCOUNTANT,
    UserRole.AUDITOR,
  ]);

  try {
    const report = await getArAgingReport(asOfDate);
    return { success: true, data: report };
  } catch (error: any) {
    console.error("Error fetching AR aging:", error);
    return { success: false, error: error.message || "Failed to generate AR aging report" };
  }
}

export async function fetchApAging(asOfDate?: string) {
  await requireRole([
    UserRole.ADMIN,
    UserRole.MANAGER,
    UserRole.ACCOUNTANT,
    UserRole.AUDITOR,
  ]);

  try {
    const report = await getApAgingReport(asOfDate);
    return { success: true, data: report };
  } catch (error: any) {
    console.error("Error fetching AP aging:", error);
    return { success: false, error: error.message || "Failed to generate AP aging report" };
  }
}

export async function fetchCashBankReport(startDate?: string, endDate?: string) {
  await requireRole([
    UserRole.ADMIN,
    UserRole.MANAGER,
    UserRole.ACCOUNTANT,
    UserRole.AUDITOR,
  ]);

  try {
    const report = await getCashBankReport(startDate, endDate);
    return { success: true, data: report };
  } catch (error: any) {
    console.error("Error fetching Cash & Bank report:", error);
    return { success: false, error: error.message || "Failed to generate Cash & Bank report" };
  }
}

export async function fetchFxReport(startDate?: string, endDate?: string) {
  await requireRole([
    UserRole.ADMIN,
    UserRole.MANAGER,
    UserRole.ACCOUNTANT,
    UserRole.AUDITOR,
  ]);

  try {
    const report = await getFxReport(startDate, endDate);
    return { success: true, data: report };
  } catch (error: any) {
    console.error("Error fetching FX report:", error);
    return { success: false, error: error.message || "Failed to generate FX report" };
  }
}

export async function fetchTaxReport() {
  await requireRole([
    UserRole.ADMIN,
    UserRole.MANAGER,
    UserRole.ACCOUNTANT,
    UserRole.AUDITOR,
  ]);

  try {
    const report = await getTaxReport();
    return { success: true, data: report };
  } catch (error: any) {
    console.error("Error fetching Tax report:", error);
    return { success: false, error: error.message || "Failed to generate Tax report" };
  }
}

export async function fetchRevenueAnalysis() {
  await requireRole([
    UserRole.ADMIN,
    UserRole.MANAGER,
    UserRole.ACCOUNTANT,
    UserRole.AUDITOR,
  ]);

  try {
    const report = await getRevenueAnalysis();
    return { success: true, data: report };
  } catch (error: any) {
    console.error("Error fetching Revenue analysis:", error);
    return { success: false, error: error.message || "Failed to generate Revenue analysis" };
  }
}

export async function fetchExpenseAnalysis() {
  await requireRole([
    UserRole.ADMIN,
    UserRole.MANAGER,
    UserRole.ACCOUNTANT,
    UserRole.AUDITOR,
  ]);

  try {
    const report = await getExpenseAnalysis();
    return { success: true, data: report };
  } catch (error: any) {
    console.error("Error fetching Expense analysis:", error);
    return { success: false, error: error.message || "Failed to generate Expense analysis" };
  }
}

export async function fetchTrialBalance(asOfDate?: string) {
  await requireRole([
    UserRole.ADMIN,
    UserRole.MANAGER,
    UserRole.ACCOUNTANT,
    UserRole.AUDITOR,
  ]);

  try {
    const report = await getTrialBalance(asOfDate ? new Date(asOfDate) : undefined);
    return { success: true, data: report };
  } catch (error: any) {
    console.error("Error fetching trial balance:", error);
    return { success: false, error: error.message || "Failed to generate trial balance" };
  }
}

export async function fetchProfitAndLoss(fromDate?: string, toDate?: string) {
  await requireRole([
    UserRole.ADMIN,
    UserRole.MANAGER,
    UserRole.ACCOUNTANT,
    UserRole.AUDITOR,
  ]);

  try {
    const report = await getProfitAndLoss(
      fromDate ? new Date(fromDate) : undefined,
      toDate ? new Date(toDate) : undefined
    );
    return { success: true, data: report };
  } catch (error: any) {
    console.error("Error fetching profit and loss:", error);
    return { success: false, error: error.message || "Failed to generate profit and loss" };
  }
}

export async function fetchBalanceSheet(asOfDate?: string) {
  await requireRole([
    UserRole.ADMIN,
    UserRole.MANAGER,
    UserRole.ACCOUNTANT,
    UserRole.AUDITOR,
  ]);

  try {
    const report = await getBalanceSheet(asOfDate ? new Date(asOfDate) : undefined);
    return { success: true, data: report };
  } catch (error: any) {
    console.error("Error fetching balance sheet:", error);
    return { success: false, error: error.message || "Failed to generate balance sheet" };
  }
}

export async function fetchBookingProfitability(bookingId?: string) {
  await requireRole([
    UserRole.ADMIN,
    UserRole.MANAGER,
    UserRole.ACCOUNTANT,
    UserRole.TRAVEL_AGENT,
    UserRole.AUDITOR,
  ]);

  try {
    const report = await getBookingProfitability(bookingId);
    return { success: true, data: report };
  } catch (error: any) {
    console.error("Error fetching booking profitability:", error);
    return { success: false, error: error.message || "Failed to generate booking profitability" };
  }
}

export async function fetchCustomerStatement(customerId: string, fromDate?: string, toDate?: string) {
  await requireRole([
    UserRole.ADMIN,
    UserRole.MANAGER,
    UserRole.ACCOUNTANT,
    UserRole.TRAVEL_AGENT,
    UserRole.AUDITOR,
  ]);

  try {
    const report = await getCustomerDerivedLedger(
      customerId,
      fromDate ? new Date(fromDate) : undefined,
      toDate ? new Date(toDate) : undefined
    );
    return { success: true, data: report };
  } catch (error: any) {
    console.error("Error fetching customer statement:", error);
    return { success: false, error: error.message || "Failed to generate customer statement" };
  }
}

export async function fetchSupplierStatement(supplierId: string, fromDate?: string, toDate?: string) {
  await requireRole([
    UserRole.ADMIN,
    UserRole.MANAGER,
    UserRole.ACCOUNTANT,
    UserRole.TRAVEL_AGENT,
    UserRole.AUDITOR,
  ]);

  try {
    const report = await getSupplierDerivedLedger(
      supplierId,
      fromDate ? new Date(fromDate) : undefined,
      toDate ? new Date(toDate) : undefined
    );
    return { success: true, data: report };
  } catch (error: any) {
    console.error("Error fetching supplier statement:", error);
    return { success: false, error: error.message || "Failed to generate supplier statement" };
  }
}
