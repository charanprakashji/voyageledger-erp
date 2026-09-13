import { prisma } from './prisma';
import Decimal from 'decimal.js';

export interface TrialBalanceRow {
  accountId: string;
  accountCode: string;
  accountName: string;
  accountType: string;
  category: string;
  totalDebit: string;
  totalCredit: string;
  netDebit: string;
  netCredit: string;
}

export interface TrialBalanceReport {
  asOfDate: string;
  rows: TrialBalanceRow[];
  totalDebit: string;
  totalCredit: string;
  isBalanced: boolean;
}

export interface ProfitLossSectionItem {
  accountCode: string;
  accountName: string;
  amount: string; // net in base AFN
}

export interface ProfitAndLossReport {
  fromDate: string;
  toDate: string;
  operatingRevenue: ProfitLossSectionItem[];
  totalOperatingRevenue: string;
  directCosts: ProfitLossSectionItem[];
  totalDirectCosts: string;
  grossProfit: string;
  grossMarginPercentage: string;
  operatingExpenses: ProfitLossSectionItem[];
  totalOperatingExpenses: string;
  operatingProfit: string;
  otherIncomeExpense: ProfitLossSectionItem[];
  netFxGainLoss: string;
  totalOtherIncomeExpense: string;
  netProfit: string;
  netProfitPercentage: string;
}

export interface BalanceSheetSectionItem {
  accountCode: string;
  accountName: string;
  amount: string; // balance in base AFN
}

export interface BalanceSheetReport {
  asOfDate: string;
  currentAssets: BalanceSheetSectionItem[];
  totalCurrentAssets: string;
  nonCurrentAssets: BalanceSheetSectionItem[];
  totalNonCurrentAssets: string;
  totalAssets: string;
  currentLiabilities: BalanceSheetSectionItem[];
  totalCurrentLiabilities: string;
  nonCurrentLiabilities: BalanceSheetSectionItem[];
  totalNonCurrentLiabilities: string;
  totalLiabilities: string;
  equity: BalanceSheetSectionItem[];
  retainedEarnings: string;
  currentPeriodProfit: string;
  totalEquity: string;
  totalLiabilitiesAndEquity: string;
  isBalanced: boolean;
  discrepancy: string;
}

export interface BookingProfitabilityRow {
  bookingId: string;
  bookingReference: string;
  customerName: string;
  travelStartDate: string | null;
  bookingStatus: string;
  revenue: string;
  directCost: string;
  grossProfit: string;
  profitMarginPercentage: string;
}

export interface SupplierStatementItem {
  date: string;
  documentType: 'BILL' | 'PAYMENT' | 'ADVANCE' | 'ALLOCATION' | 'JOURNAL';
  documentNumber: string;
  reference: string;
  description: string;
  debit: string;
  credit: string;
  runningBalance: string; // positive = amount we owe supplier (AP balance)
}

export interface SupplierStatementReport {
  supplierId: string;
  supplierName: string;
  supplierCode: string;
  fromDate: string;
  toDate: string;
  openingBalance: string;
  items: SupplierStatementItem[];
  closingBalance: string;
  totalBilled: string;
  totalPaid: string;
}

function getCategoryForAccount(code: string, accountType: string): string {
  if (accountType === 'ASSET') {
    return code.startsWith('15') || code.startsWith('16') || code.startsWith('17') || code.startsWith('18')
      ? 'Non-Current Assets'
      : 'Current Assets';
  }
  if (accountType === 'LIABILITY') {
    return code.startsWith('25') || code.startsWith('26') || code.startsWith('27')
      ? 'Non-Current Liabilities'
      : 'Current Liabilities';
  }
  if (accountType === 'EQUITY') return 'Equity';
  if (accountType === 'REVENUE') return 'Revenue';
  if (accountType === 'EXPENSE') return code.startsWith('5') ? 'Direct Cost' : 'Operating Expense';
  return 'General';
}

/**
 * Derives Trial Balance strictly from POSTED JournalLines
 */
export async function getTrialBalance(asOfDate?: Date): Promise<TrialBalanceReport> {
  const dateFilter = asOfDate ? { entryDate: { lte: asOfDate } } : {};

  // Fetch all accounts
  const accounts = await prisma.chartOfAccount.findMany({
    where: { isActive: true },
    orderBy: { code: 'asc' },
  });

  // Fetch all posted journal lines up to asOfDate
  const postedLines = await prisma.journalLine.findMany({
    where: {
      journalEntry: {
        status: 'POSTED',
        ...dateFilter,
      },
    },
    include: {
      account: true,
    },
  });

  const accountTotals = new Map<string, { debit: Decimal; credit: Decimal }>();
  for (const acc of accounts) {
    accountTotals.set(acc.id, { debit: new Decimal(0), credit: new Decimal(0) });
  }

  for (const line of postedLines) {
    const existing = accountTotals.get(line.accountId) || { debit: new Decimal(0), credit: new Decimal(0) };
    existing.debit = existing.debit.plus(line.debit.toString());
    existing.credit = existing.credit.plus(line.credit.toString());
    accountTotals.set(line.accountId, existing);
  }

  let grandDebit = new Decimal(0);
  let grandCredit = new Decimal(0);

  const rows: TrialBalanceRow[] = [];

  for (const acc of accounts) {
    const totals = accountTotals.get(acc.id) || { debit: new Decimal(0), credit: new Decimal(0) };
    if (totals.debit.isZero() && totals.credit.isZero()) {
      continue;
    }

    grandDebit = grandDebit.plus(totals.debit);
    grandCredit = grandCredit.plus(totals.credit);

    let netDebit = new Decimal(0);
    let netCredit = new Decimal(0);

    if (totals.debit.greaterThanOrEqualTo(totals.credit)) {
      netDebit = totals.debit.minus(totals.credit);
    } else {
      netCredit = totals.credit.minus(totals.debit);
    }

    rows.push({
      accountId: acc.id,
      accountCode: acc.code,
      accountName: acc.name,
      accountType: acc.accountType,
      category: getCategoryForAccount(acc.code, acc.accountType),
      totalDebit: totals.debit.toFixed(2),
      totalCredit: totals.credit.toFixed(2),
      netDebit: netDebit.toFixed(2),
      netCredit: netCredit.toFixed(2),
    });
  }

  const isBalanced = grandDebit.equals(grandCredit);

  return {
    asOfDate: (asOfDate || new Date()).toISOString().split('T')[0],
    rows,
    totalDebit: grandDebit.toFixed(2),
    totalCredit: grandCredit.toFixed(2),
    isBalanced,
  };
}

/**
 * Derives Profit and Loss Statement strictly from POSTED JournalLines
 */
export async function getProfitAndLoss(fromDate?: Date, toDate?: Date): Promise<ProfitAndLossReport> {
  const dateFilter: any = {};
  if (fromDate) dateFilter.gte = fromDate;
  if (toDate) dateFilter.lte = toDate;

  const postedLines = await prisma.journalLine.findMany({
    where: {
      journalEntry: {
        status: 'POSTED',
        ...(fromDate || toDate ? { entryDate: dateFilter } : {}),
      },
      account: {
        accountType: {
          in: ['REVENUE', 'EXPENSE'],
        },
      },
    },
    include: {
      account: true,
    },
  });

  const revenueMap = new Map<string, { code: string; name: string; amount: Decimal }>();
  const directCostMap = new Map<string, { code: string; name: string; amount: Decimal }>();
  const operatingExpenseMap = new Map<string, { code: string; name: string; amount: Decimal }>();
  const otherIncomeExpenseMap = new Map<string, { code: string; name: string; amount: Decimal }>();

  for (const line of postedLines) {
    const acc = line.account;
    const debit = new Decimal(line.debit.toString());
    const credit = new Decimal(line.credit.toString());

    // Revenue accounts normal balance is Credit (Credit - Debit)
    if (acc.accountType === 'REVENUE') {
      const net = credit.minus(debit);
      if (acc.code.startsWith('4')) {
        const item = revenueMap.get(acc.code) || { code: acc.code, name: acc.name, amount: new Decimal(0) };
        item.amount = item.amount.plus(net);
        revenueMap.set(acc.code, item);
      } else {
        // Other income (e.g. 7010 FX Gain)
        const item = otherIncomeExpenseMap.get(acc.code) || { code: acc.code, name: acc.name, amount: new Decimal(0) };
        item.amount = item.amount.plus(net);
        otherIncomeExpenseMap.set(acc.code, item);
      }
    } else if (acc.accountType === 'EXPENSE') {
      // Expense normal balance is Debit (Debit - Credit)
      const net = debit.minus(credit);
      if (acc.code.startsWith('5')) {
        // Direct Costs (Cost of Sales)
        const item = directCostMap.get(acc.code) || { code: acc.code, name: acc.name, amount: new Decimal(0) };
        item.amount = item.amount.plus(net);
        directCostMap.set(acc.code, item);
      } else if (acc.code.startsWith('6')) {
        // Operating Expenses
        const item = operatingExpenseMap.get(acc.code) || { code: acc.code, name: acc.name, amount: new Decimal(0) };
        item.amount = item.amount.plus(net);
        operatingExpenseMap.set(acc.code, item);
      } else {
        // Other expenses (e.g. 8010 FX Loss)
        const item = otherIncomeExpenseMap.get(acc.code) || { code: acc.code, name: acc.name, amount: new Decimal(0) };
        item.amount = item.amount.minus(net); // negative for other income/expense
        otherIncomeExpenseMap.set(acc.code, item);
      }
    }
  }

  const operatingRevenue = Array.from(revenueMap.values())
    .map(r => ({ accountCode: r.code, accountName: r.name, amount: r.amount.toFixed(2) }))
    .sort((a, b) => a.accountCode.localeCompare(b.accountCode));
  const totalOperatingRevenueDec = Array.from(revenueMap.values()).reduce((sum, r) => sum.plus(r.amount), new Decimal(0));

  const directCosts = Array.from(directCostMap.values())
    .map(c => ({ accountCode: c.code, accountName: c.name, amount: c.amount.toFixed(2) }))
    .sort((a, b) => a.accountCode.localeCompare(b.accountCode));
  const totalDirectCostsDec = Array.from(directCostMap.values()).reduce((sum, c) => sum.plus(c.amount), new Decimal(0));

  const grossProfitDec = totalOperatingRevenueDec.minus(totalDirectCostsDec);
  const grossMarginPercentage = totalOperatingRevenueDec.isZero()
    ? '0.00'
    : grossProfitDec.dividedBy(totalOperatingRevenueDec).times(100).toFixed(2);

  const operatingExpenses = Array.from(operatingExpenseMap.values())
    .map(e => ({ accountCode: e.code, accountName: e.name, amount: e.amount.toFixed(2) }))
    .sort((a, b) => a.accountCode.localeCompare(b.accountCode));
  const totalOperatingExpensesDec = Array.from(operatingExpenseMap.values()).reduce((sum, e) => sum.plus(e.amount), new Decimal(0));

  const operatingProfitDec = grossProfitDec.minus(totalOperatingExpensesDec);

  const otherIncomeExpense = Array.from(otherIncomeExpenseMap.values())
    .map(o => ({ accountCode: o.code, accountName: o.name, amount: o.amount.toFixed(2) }))
    .sort((a, b) => a.accountCode.localeCompare(b.accountCode));
  const totalOtherIncomeExpenseDec = Array.from(otherIncomeExpenseMap.values()).reduce((sum, o) => sum.plus(o.amount), new Decimal(0));

  const netProfitDec = operatingProfitDec.plus(totalOtherIncomeExpenseDec);
  const netProfitPercentage = totalOperatingRevenueDec.isZero()
    ? '0.00'
    : netProfitDec.dividedBy(totalOperatingRevenueDec).times(100).toFixed(2);

  return {
    fromDate: fromDate ? fromDate.toISOString().split('T')[0] : 'Beginning',
    toDate: (toDate || new Date()).toISOString().split('T')[0],
    operatingRevenue,
    totalOperatingRevenue: totalOperatingRevenueDec.toFixed(2),
    directCosts,
    totalDirectCosts: totalDirectCostsDec.toFixed(2),
    grossProfit: grossProfitDec.toFixed(2),
    grossMarginPercentage,
    operatingExpenses,
    totalOperatingExpenses: totalOperatingExpensesDec.toFixed(2),
    operatingProfit: operatingProfitDec.toFixed(2),
    otherIncomeExpense,
    netFxGainLoss: totalOtherIncomeExpenseDec.toFixed(2),
    totalOtherIncomeExpense: totalOtherIncomeExpenseDec.toFixed(2),
    netProfit: netProfitDec.toFixed(2),
    netProfitPercentage,
  };
}

/**
 * Derives Balance Sheet strictly from POSTED JournalLines
 */
export async function getBalanceSheet(asOfDate?: Date): Promise<BalanceSheetReport> {
  const dateFilter = asOfDate ? { entryDate: { lte: asOfDate } } : {};

  const postedLines = await prisma.journalLine.findMany({
    where: {
      journalEntry: {
        status: 'POSTED',
        ...dateFilter,
      },
    },
    include: {
      account: true,
    },
  });

  const assetMap = new Map<string, { code: string; name: string; amount: Decimal; category: string }>();
  const liabilityMap = new Map<string, { code: string; name: string; amount: Decimal; category: string }>();
  const equityMap = new Map<string, { code: string; name: string; amount: Decimal; category: string }>();

  let cumulativeRevenue = new Decimal(0);
  let cumulativeExpense = new Decimal(0);

  for (const line of postedLines) {
    const acc = line.account;
    const debit = new Decimal(line.debit.toString());
    const credit = new Decimal(line.credit.toString());

    if (acc.accountType === 'ASSET') {
      const net = debit.minus(credit);
      const cat = getCategoryForAccount(acc.code, acc.accountType);
      const item = assetMap.get(acc.code) || { code: acc.code, name: acc.name, amount: new Decimal(0), category: cat };
      item.amount = item.amount.plus(net);
      assetMap.set(acc.code, item);
    } else if (acc.accountType === 'LIABILITY') {
      const net = credit.minus(debit);
      const cat = getCategoryForAccount(acc.code, acc.accountType);
      const item = liabilityMap.get(acc.code) || { code: acc.code, name: acc.name, amount: new Decimal(0), category: cat };
      item.amount = item.amount.plus(net);
      liabilityMap.set(acc.code, item);
    } else if (acc.accountType === 'EQUITY') {
      const net = credit.minus(debit);
      const cat = getCategoryForAccount(acc.code, acc.accountType);
      const item = equityMap.get(acc.code) || { code: acc.code, name: acc.name, amount: new Decimal(0), category: cat };
      item.amount = item.amount.plus(net);
      equityMap.set(acc.code, item);
    } else if (acc.accountType === 'REVENUE') {
      cumulativeRevenue = cumulativeRevenue.plus(credit.minus(debit));
    } else if (acc.accountType === 'EXPENSE') {
      cumulativeExpense = cumulativeExpense.plus(debit.minus(credit));
    }
  }

  const currentPeriodProfitDec = cumulativeRevenue.minus(cumulativeExpense);

  const currentAssets: BalanceSheetSectionItem[] = [];
  const nonCurrentAssets: BalanceSheetSectionItem[] = [];
  let totalCurrentAssetsDec = new Decimal(0);
  let totalNonCurrentAssetsDec = new Decimal(0);

  for (const item of assetMap.values()) {
    if (item.amount.isZero()) continue;
    const row = { accountCode: item.code, accountName: item.name, amount: item.amount.toFixed(2) };
    if (item.category.includes('Non-Current')) {
      nonCurrentAssets.push(row);
      totalNonCurrentAssetsDec = totalNonCurrentAssetsDec.plus(item.amount);
    } else {
      currentAssets.push(row);
      totalCurrentAssetsDec = totalCurrentAssetsDec.plus(item.amount);
    }
  }

  const currentLiabilities: BalanceSheetSectionItem[] = [];
  const nonCurrentLiabilities: BalanceSheetSectionItem[] = [];
  let totalCurrentLiabilitiesDec = new Decimal(0);
  let totalNonCurrentLiabilitiesDec = new Decimal(0);

  for (const item of liabilityMap.values()) {
    if (item.amount.isZero()) continue;
    const row = { accountCode: item.code, accountName: item.name, amount: item.amount.toFixed(2) };
    if (item.category.includes('Non-Current')) {
      nonCurrentLiabilities.push(row);
      totalNonCurrentLiabilitiesDec = totalNonCurrentLiabilitiesDec.plus(item.amount);
    } else {
      currentLiabilities.push(row);
      totalCurrentLiabilitiesDec = totalCurrentLiabilitiesDec.plus(item.amount);
    }
  }

  const equity: BalanceSheetSectionItem[] = [];
  let totalEquityDec = new Decimal(0);
  for (const item of equityMap.values()) {
    if (item.amount.isZero()) continue;
    equity.push({ accountCode: item.code, accountName: item.name, amount: item.amount.toFixed(2) });
    totalEquityDec = totalEquityDec.plus(item.amount);
  }

  totalEquityDec = totalEquityDec.plus(currentPeriodProfitDec);

  const totalAssetsDec = totalCurrentAssetsDec.plus(totalNonCurrentAssetsDec);
  const totalLiabilitiesDec = totalCurrentLiabilitiesDec.plus(totalNonCurrentLiabilitiesDec);
  const totalLiabilitiesAndEquityDec = totalLiabilitiesDec.plus(totalEquityDec);

  const discrepancy = totalAssetsDec.minus(totalLiabilitiesAndEquityDec);
  const isBalanced = discrepancy.abs().lessThan(0.01);

  return {
    asOfDate: (asOfDate || new Date()).toISOString().split('T')[0],
    currentAssets: currentAssets.sort((a, b) => a.accountCode.localeCompare(b.accountCode)),
    totalCurrentAssets: totalCurrentAssetsDec.toFixed(2),
    nonCurrentAssets: nonCurrentAssets.sort((a, b) => a.accountCode.localeCompare(b.accountCode)),
    totalNonCurrentAssets: totalNonCurrentAssetsDec.toFixed(2),
    totalAssets: totalAssetsDec.toFixed(2),
    currentLiabilities: currentLiabilities.sort((a, b) => a.accountCode.localeCompare(b.accountCode)),
    totalCurrentLiabilities: totalCurrentLiabilitiesDec.toFixed(2),
    nonCurrentLiabilities: nonCurrentLiabilities.sort((a, b) => a.accountCode.localeCompare(b.accountCode)),
    totalNonCurrentLiabilities: totalNonCurrentLiabilitiesDec.toFixed(2),
    totalLiabilities: totalLiabilitiesDec.toFixed(2),
    equity: equity.sort((a, b) => a.accountCode.localeCompare(b.accountCode)),
    retainedEarnings: '0.00',
    currentPeriodProfit: currentPeriodProfitDec.toFixed(2),
    totalEquity: totalEquityDec.toFixed(2),
    totalLiabilitiesAndEquity: totalLiabilitiesAndEquityDec.toFixed(2),
    isBalanced,
    discrepancy: discrepancy.toFixed(2),
  };
}

/**
 * Derives Booking-level Profitability strictly from POSTED JournalLines tagged with bookingId
 */
export async function getBookingProfitability(bookingId?: string): Promise<BookingProfitabilityRow[]> {
  const whereClause: any = {
    journalEntry: {
      status: 'POSTED',
    },
    bookingId: bookingId ? bookingId : { not: null },
  };

  const lines = await prisma.journalLine.findMany({
    where: whereClause,
    include: {
      booking: {
        include: {
          customer: true,
        },
      },
      account: true,
    },
  });

  const bookingMap = new Map<string, {
    booking: any;
    revenue: Decimal;
    directCost: Decimal;
  }>();

  for (const line of lines) {
    if (!line.bookingId || !line.booking) continue;

    const existing = bookingMap.get(line.bookingId) || {
      booking: line.booking,
      revenue: new Decimal(0),
      directCost: new Decimal(0),
    };

    const debit = new Decimal(line.debit.toString());
    const credit = new Decimal(line.credit.toString());

    if (line.account.accountType === 'REVENUE') {
      // Normal balance: Credit - Debit
      existing.revenue = existing.revenue.plus(credit.minus(debit));
    } else if (line.account.accountType === 'EXPENSE' && line.account.code.startsWith('5')) {
      // Direct Cost: Debit - Credit
      existing.directCost = existing.directCost.plus(debit.minus(credit));
    }

    bookingMap.set(line.bookingId, existing);
  }

  const results: BookingProfitabilityRow[] = [];

  for (const [id, data] of bookingMap.entries()) {
    const grossProfit = data.revenue.minus(data.directCost);
    const profitMarginPercentage = data.revenue.isZero()
      ? '0.00'
      : grossProfit.dividedBy(data.revenue).times(100).toFixed(2);

    results.push({
      bookingId: id,
      bookingReference: data.booking.bookingReference,
      customerName: data.booking.customer?.name || 'N/A',
      travelStartDate: data.booking.travelStartDate ? data.booking.travelStartDate.toISOString().split('T')[0] : null,
      bookingStatus: data.booking.bookingStatus,
      revenue: data.revenue.toFixed(2),
      directCost: data.directCost.toFixed(2),
      grossProfit: grossProfit.toFixed(2),
      profitMarginPercentage,
    });
  }

  return results.sort((a, b) => b.revenue.localeCompare(a.revenue));
}

/**
 * Derives Supplier Statement strictly from POSTED JournalLines tagged with supplierId
 */
export async function getSupplierDerivedLedger(
  supplierId: string,
  fromDate?: Date,
  toDate?: Date
): Promise<SupplierStatementReport> {
  const supplier = await prisma.supplier.findUnique({
    where: { id: supplierId },
  });

  if (!supplier) {
    throw new Error(`Supplier with ID ${supplierId} not found`);
  }

  // AP Account code is 2010
  const lines = await prisma.journalLine.findMany({
    where: {
      supplierId,
      journalEntry: {
        status: 'POSTED',
      },
    },
    include: {
      journalEntry: true,
      account: true,
    },
    orderBy: [
      { journalEntry: { entryDate: 'asc' } },
      { createdAt: 'asc' },
    ],
  });

  let openingBalanceDec = new Decimal(0);
  let totalBilledDec = new Decimal(0);
  let totalPaidDec = new Decimal(0);

  const items: SupplierStatementItem[] = [];
  let runningBalanceDec = new Decimal(0);

  for (const line of lines) {
    const entryDate = line.journalEntry.entryDate;
    const debit = new Decimal(line.debit.toString());
    const credit = new Decimal(line.credit.toString());

    // In AP account (2010), Credit increases what we owe (Bill), Debit decreases what we owe (Payment/Advance)
    const isAPAccount = line.account.code === '2010';

    if (fromDate && entryDate < fromDate) {
      if (isAPAccount) {
        openingBalanceDec = openingBalanceDec.plus(credit).minus(debit);
      }
      continue;
    }

    if (toDate && entryDate > toDate) {
      continue;
    }

    let docType: SupplierStatementItem['documentType'] = 'JOURNAL';
    if (line.journalEntry.referenceType === 'SUPPLIER_BILL') docType = 'BILL';
    else if (line.journalEntry.referenceType === 'SUPPLIER_PAYMENT') docType = 'PAYMENT';
    else if (line.journalEntry.referenceType === 'SUPPLIER_ADVANCE') docType = 'ADVANCE';
    else if (line.journalEntry.referenceType === 'SUPPLIER_ADVANCE_ALLOCATION') docType = 'ALLOCATION';

    if (isAPAccount) {
      runningBalanceDec = runningBalanceDec.plus(credit).minus(debit);
      totalBilledDec = totalBilledDec.plus(credit);
      totalPaidDec = totalPaidDec.plus(debit);
    }

    items.push({
      date: entryDate.toISOString().split('T')[0],
      documentType: docType,
      documentNumber: line.journalEntry.entryNumber,
      reference: line.journalEntry.referenceId || '',
      description: line.description || line.journalEntry.description,
      debit: debit.toFixed(2),
      credit: credit.toFixed(2),
      runningBalance: runningBalanceDec.toFixed(2),
    });
  }

  return {
    supplierId: supplier.id,
    supplierName: supplier.name,
    supplierCode: supplier.code,
    fromDate: fromDate ? fromDate.toISOString().split('T')[0] : 'Beginning',
    toDate: (toDate || new Date()).toISOString().split('T')[0],
    openingBalance: openingBalanceDec.toFixed(2),
    items,
    closingBalance: runningBalanceDec.toFixed(2),
    totalBilled: totalBilledDec.toFixed(2),
    totalPaid: totalPaidDec.toFixed(2),
  };
}
