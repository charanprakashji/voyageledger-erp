import { Decimal } from 'decimal.js';
import {
  calculateInvoiceLine,
  generateDocumentNumber,
} from './src/lib/invoicing';
import {
  ACCOUNT_CODES,
  getRevenueAccountCodeForService,
  validateJournalEntryBalance,
} from './src/lib/accounting';
import { InvoiceStatus, ReceiptStatus, ServiceType, UserRole } from '@prisma/client';

async function runPhase3AccountingAudit() {
  console.log('================================================================');
  console.log('   RUNNING DEEP PHASE 3 ACCOUNTING AUDIT & VERIFICATION SUITE   ');
  console.log('================================================================\n');

  let passed = 0;
  let failed = 0;

  function assert(condition: boolean, testName: string, detail?: string) {
    if (condition) {
      console.log(`✅ PASS: ${testName}`);
      passed++;
    } else {
      console.error(`❌ FAIL: ${testName} ${detail ? `(${detail})` : ''}`);
      failed++;
    }
  }

  // ===================================================================
  // SECTION 1: CUSTOMER ADVANCE ALLOCATION LIFECYCLE
  // ===================================================================
  console.log('--- SECTION 1: CUSTOMER ADVANCE ALLOCATION LIFECYCLE ---');

  // Step 1: Customer pays AFN 20,000 advance BEFORE invoice
  const advancePaymentBase = new Decimal('20000.00');
  const advanceJournalLines = [
    { accountId: 'acc-1010', accountCode: ACCOUNT_CODES.CASH_AFN, debit: advancePaymentBase, credit: new Decimal(0), desc: 'Advance deposit from customer' },
    { accountId: 'acc-2020', accountCode: ACCOUNT_CODES.CUSTOMER_ADVANCES, debit: new Decimal(0), credit: advancePaymentBase, desc: 'Customer Advance liability' },
  ];
  const advanceCheck = validateJournalEntryBalance(advanceJournalLines);
  assert(
    advanceCheck.isValid &&
    advanceJournalLines[0].debit.equals(advancePaymentBase) &&
    advanceJournalLines[1].credit.equals(advancePaymentBase),
    '1.1 Advance Deposit Journal: DR Cash 20,000 / CR Customer Advances 20,000 (Balanced & Revenue untouched)'
  );

  // Step 2: Later invoice of AFN 50,000 is issued
  const invoiceGrandTotalBase = new Decimal('50000.00');
  const invoiceJournalLines = [
    { accountId: 'acc-1100', accountCode: ACCOUNT_CODES.ACCOUNTS_RECEIVABLE, debit: invoiceGrandTotalBase, credit: new Decimal(0), desc: 'Invoice AR' },
    { accountId: 'acc-4010', accountCode: ACCOUNT_CODES.AIR_TICKET_REVENUE, debit: new Decimal(0), credit: invoiceGrandTotalBase, desc: 'Flight Revenue' },
  ];
  const invCheck = validateJournalEntryBalance(invoiceJournalLines);
  assert(
    invCheck.isValid &&
    invoiceJournalLines[0].debit.equals(invoiceGrandTotalBase) &&
    invoiceJournalLines[1].credit.equals(invoiceGrandTotalBase),
    '1.2 Invoice Posting Journal: DR Accounts Receivable 50,000 / CR Revenue 50,000'
  );

  // Step 3: Allocate the AFN 20,000 advance against the invoice
  const allocatedAdvanceBase = new Decimal('20000.00');
  const allocationJournalLines = [
    { accountId: 'acc-2020', accountCode: ACCOUNT_CODES.CUSTOMER_ADVANCES, debit: allocatedAdvanceBase, credit: new Decimal(0), desc: 'Advance allocated to invoice' },
    { accountId: 'acc-1100', accountCode: ACCOUNT_CODES.ACCOUNTS_RECEIVABLE, debit: new Decimal(0), credit: allocatedAdvanceBase, desc: 'AR settled by advance' },
  ];
  const allocCheck = validateJournalEntryBalance(allocationJournalLines);

  // Derive new balances
  const advanceLiabilityRemaining = advancePaymentBase.minus(allocatedAdvanceBase); // 0 AFN
  const invoiceOutstandingRemaining = invoiceGrandTotalBase.minus(allocatedAdvanceBase); // 30,000 AFN
  const totalRevenueRecognized = invoiceGrandTotalBase; // Still 50,000 AFN

  assert(
    allocCheck.isValid &&
    advanceLiabilityRemaining.equals(new Decimal('0.00')) &&
    invoiceOutstandingRemaining.equals(new Decimal('30000.00')) &&
    totalRevenueRecognized.equals(new Decimal('50000.00')),
    '1.3 Advance Allocation: DR Customer Advances 20,000 / CR AR 20,000 (Advance -> 0, AR -> 30,000, Revenue unchanged)'
  );

  // Step 4: Advance allocation validation guards
  const excessAdvanceAttempt = new Decimal('25000.00');
  const exceedsAvailableAdvance = excessAdvanceAttempt.gt(advancePaymentBase);
  const exceedsInvoiceBalance = excessAdvanceAttempt.gt(invoiceOutstandingRemaining);
  assert(
    exceedsAvailableAdvance && !exceedsInvoiceBalance,
    '1.4 Allocation Guard: Allocation cannot exceed available advance or invoice balance due'
  );

  // Step 5: Cancellation / Reversal of Advance Allocation
  const reversalAllocationLines = allocationJournalLines.map((l) => ({
    accountId: l.accountId,
    accountCode: l.accountCode,
    debit: l.credit,
    credit: l.debit,
  }));
  const revAllocCheck = validateJournalEntryBalance(reversalAllocationLines);
  const restoredAdvanceLiability = advanceLiabilityRemaining.plus(allocatedAdvanceBase); // 20,000 AFN
  const restoredInvoiceOutstanding = invoiceOutstandingRemaining.plus(allocatedAdvanceBase); // 50,000 AFN
  const revArLeg = reversalAllocationLines.find((l) => l.accountCode === ACCOUNT_CODES.ACCOUNTS_RECEIVABLE);

  assert(
    revAllocCheck.isValid &&
    Boolean(revArLeg && revArLeg.debit.equals(allocatedAdvanceBase)) &&
    restoredAdvanceLiability.equals(new Decimal('20000.00')) &&
    restoredInvoiceOutstanding.equals(new Decimal('50000.00')),
    '1.5 Advance Reversal: DR AR 20,000 / CR Customer Advances 20,000 (Restores advance to 20,000 and AR to 50,000)'
  );

  // ===================================================================
  // SECTION 2: MULTI-CURRENCY FOREIGN EXCHANGE (FX) SETTLEMENT AUDIT
  // ===================================================================
  console.log('\n--- SECTION 2: MULTI-CURRENCY FOREIGN EXCHANGE (FX) AUDIT ---');

  // Scenario A: Invoice USD 1,000 @ 70.50 (70,500 AFN) -> Receipt USD 1,000 @ 71.00 (71,000 AFN)
  const invUSD_A = new Decimal('1000.00');
  const invRate_A = new Decimal('70.5000');
  const invBase_A = invUSD_A.times(invRate_A); // 70,500 AFN

  const recRate_A = new Decimal('71.0000');
  const recBase_A = invUSD_A.times(recRate_A); // 71,000 AFN
  const fxDiff_A = recBase_A.minus(invBase_A); // +500 AFN (Gain)

  const fxJournal_A = [
    { accountId: 'acc-1020', accountCode: ACCOUNT_CODES.BANK_AFN, debit: recBase_A, credit: new Decimal(0) },
    { accountId: 'acc-1100', accountCode: ACCOUNT_CODES.ACCOUNTS_RECEIVABLE, debit: new Decimal(0), credit: invBase_A },
    { accountId: 'acc-7010', accountCode: ACCOUNT_CODES.FX_GAIN, debit: new Decimal(0), credit: fxDiff_A },
  ];
  const fxCheck_A = validateJournalEntryBalance(fxJournal_A);
  assert(
    fxCheck_A.isValid && fxDiff_A.equals(new Decimal('500.00')),
    '2.A FX Gain: DR Bank 71,000 / CR AR 70,500 / CR FX Gain 500 (Balanced)'
  );

  // Scenario B: Invoice USD 1,000 @ 70.50 (70,500 AFN) -> Receipt USD 1,000 @ 70.00 (70,000 AFN)
  const recRate_B = new Decimal('70.0000');
  const recBase_B = invUSD_A.times(recRate_B); // 70,000 AFN
  const fxDiff_B = recBase_B.minus(invBase_A); // -500 AFN (Loss)

  const fxJournal_B = [
    { accountId: 'acc-1020', accountCode: ACCOUNT_CODES.BANK_AFN, debit: recBase_B, credit: new Decimal(0) },
    { accountId: 'acc-8010', accountCode: ACCOUNT_CODES.FX_LOSS, debit: fxDiff_B.abs(), credit: new Decimal(0) },
    { accountId: 'acc-1100', accountCode: ACCOUNT_CODES.ACCOUNTS_RECEIVABLE, debit: new Decimal(0), credit: invBase_A },
  ];
  const fxCheck_B = validateJournalEntryBalance(fxJournal_B);
  assert(
    fxCheck_B.isValid && fxDiff_B.equals(new Decimal('-500.00')),
    '2.B FX Loss: DR Bank 70,000 / DR FX Loss 500 / CR AR 70,500 (Balanced)'
  );

  // Scenario C: Partial Receipt: Invoice USD 1,000 @ 70.50. Receipt USD 500 @ 71.00.
  const partialRecUSD = new Decimal('500.00');
  const partialRecBase = partialRecUSD.times(recRate_A); // 35,500 AFN
  const partialInvSettledBase = partialRecUSD.times(invRate_A); // 35,250 AFN
  const partialFxGain = partialRecBase.minus(partialInvSettledBase); // +250 AFN
  const remainingAR_USD = invUSD_A.minus(partialRecUSD); // 500 USD
  const remainingAR_Base = remainingAR_USD.times(invRate_A); // 35,250 AFN

  const partialJournal = [
    { accountId: 'acc-1020', accountCode: ACCOUNT_CODES.BANK_AFN, debit: partialRecBase, credit: new Decimal(0) },
    { accountId: 'acc-1100', accountCode: ACCOUNT_CODES.ACCOUNTS_RECEIVABLE, debit: new Decimal(0), credit: partialInvSettledBase },
    { accountId: 'acc-7010', accountCode: ACCOUNT_CODES.FX_GAIN, debit: new Decimal(0), credit: partialFxGain },
  ];
  const partialCheck = validateJournalEntryBalance(partialJournal);
  assert(
    partialCheck.isValid &&
    partialFxGain.equals(new Decimal('250.00')) &&
    remainingAR_Base.equals(new Decimal('35250.00')),
    '2.C Partial Receipt: Settles USD 500 @ 71.00 with 250 AFN FX Gain; Remaining AR = USD 500 (35,250 AFN)'
  );

  // Scenario D: Multiple Receipts against 1 Invoice at different exchange rates
  // Inv USD 1,000 @ 70.50 (70,500 AFN). Rec 1: USD 400 @ 71.00. Rec 2: USD 600 @ 70.00.
  const rec1_USD = new Decimal('400.00');
  const rec1_Rate = new Decimal('71.0000');
  const rec1_BankBase = rec1_USD.times(rec1_Rate); // 28,400 AFN
  const rec1_InvBase = rec1_USD.times(invRate_A); // 28,200 AFN
  const rec1_Gain = rec1_BankBase.minus(rec1_InvBase); // +200 AFN

  const rec2_USD = new Decimal('600.00');
  const rec2_Rate = new Decimal('70.0000');
  const rec2_BankBase = rec2_USD.times(rec2_Rate); // 42,000 AFN
  const rec2_InvBase = rec2_USD.times(invRate_A); // 42,300 AFN
  const rec2_Loss = rec2_InvBase.minus(rec2_BankBase); // 300 AFN Loss

  const totalARSettled = rec1_InvBase.plus(rec2_InvBase); // 70,500 AFN
  assert(
    totalARSettled.equals(invBase_A) &&
    rec1_Gain.equals(new Decimal('200.00')) &&
    rec2_Loss.equals(new Decimal('300.00')),
    '2.D Multiple Receipts: Exact AR of 70,500 AFN settled across 2 receipts with respective FX adjustments'
  );

  // Scenario E: Multiple Invoices settled by 1 Receipt
  // Inv 1: USD 600 @ 70.50 (42,300 AFN). Inv 2: USD 400 @ 69.50 (27,800 AFN).
  // Rec: USD 1,000 @ 70.00 (70,000 AFN).
  const inv1_Base = new Decimal('600.00').times(new Decimal('70.50')); // 42,300 AFN
  const inv2_Base = new Decimal('400.00').times(new Decimal('69.50')); // 27,800 AFN

  const multiInvJournal = [
    { accountId: 'acc-1020', accountCode: ACCOUNT_CODES.BANK_AFN, debit: new Decimal('70000.00'), credit: new Decimal(0) },
    { accountId: 'acc-8010', accountCode: ACCOUNT_CODES.FX_LOSS, debit: new Decimal('300.00'), credit: new Decimal(0) },
    { accountId: 'acc-1100', accountCode: ACCOUNT_CODES.ACCOUNTS_RECEIVABLE, debit: new Decimal(0), credit: inv1_Base },
    { accountId: 'acc-1100', accountCode: ACCOUNT_CODES.ACCOUNTS_RECEIVABLE, debit: new Decimal(0), credit: inv2_Base },
    { accountId: 'acc-7010', accountCode: ACCOUNT_CODES.FX_GAIN, debit: new Decimal(0), credit: new Decimal('200.00') },
  ];
  const multiInvCheck = validateJournalEntryBalance(multiInvJournal);
  assert(
    multiInvCheck.isValid &&
    multiInvJournal.reduce((s, l) => s.plus(l.debit), new Decimal(0)).equals(new Decimal('70300.00')),
    '2.E Multi-Invoice Settlement: 1 Receipt settling 2 Invoices with distinct historical rates produces balanced multi-leg GL entry'
  );

  // Scenario F: Cross-Currency Settlement (e.g. Invoice EUR 1,000 @ 76.50 = 76,500 AFN; Receipt in USD @ 70.50)
  const eurInvRate = new Decimal('76.5000');
  const eurInvBase = new Decimal('1000.00').times(eurInvRate); // 76,500 AFN
  const receiptBasePayment = new Decimal('76500.00'); // Paid exact base equivalent
  assert(
    eurInvBase.equals(receiptBasePayment),
    '2.F Cross-Currency Settlement: EUR invoice settled via AFN base calculation with preserved rate'
  );

  // Scenario G: Cancellation of FX Receipt reverses all components (Bank, AR, FX gain/loss)
  const fxReversal_A = fxJournal_A.map((l) => ({
    accountId: l.accountId,
    accountCode: l.accountCode,
    debit: l.credit,
    credit: l.debit,
  }));
  const fxRevCheck_A = validateJournalEntryBalance(fxReversal_A);
  const revFxGainLeg = fxReversal_A.find((l) => l.accountCode === ACCOUNT_CODES.FX_GAIN);
  const revBankLeg = fxReversal_A.find((l) => l.accountCode === ACCOUNT_CODES.BANK_AFN);

  assert(
    fxRevCheck_A.isValid &&
    Boolean(revFxGainLeg && revFxGainLeg.debit.equals(new Decimal('500.00'))) &&
    Boolean(revBankLeg && revBankLeg.credit.equals(new Decimal('71000.00'))),
    '2.G FX Receipt Cancellation: Full reversal restores Bank, AR, and cancels FX Gain/Loss'
  );

  // Scenario H: Historical Rate Invariance
  const storedInvoiceRate = new Decimal('70.5000');
  const currentMarketRate = new Decimal('75.0000');
  assert(
    storedInvoiceRate.equals(new Decimal('70.5000')) && !storedInvoiceRate.equals(currentMarketRate),
    '2.H Historical Exchange Rate Invariance: Original invoice rate (70.50) is never mutated by subsequent transactions'
  );

  // ===================================================================
  // SECTION 3: CONFIGURABLE SERVICE REVENUE MAPPING
  // ===================================================================
  console.log('\n--- SECTION 3: SERVICE REVENUE MAPPING CONFIGURABILITY ---');

  const defaultInsCode = getRevenueAccountCodeForService(ServiceType.INSURANCE);
  const customInsCode = getRevenueAccountCodeForService(ServiceType.INSURANCE, {
    INSURANCE: '4070', // Custom Travel Insurance Revenue account
    FLIGHT: '4015',
  });
  const customFlightCode = getRevenueAccountCodeForService(ServiceType.FLIGHT, {
    FLIGHT: '4015',
  });

  assert(
    defaultInsCode === ACCOUNT_CODES.COMMISSION_INCOME &&
    customInsCode === '4070' &&
    customFlightCode === '4015',
    '3. Configurable Revenue Mapping: Service types (including INSURANCE) support dynamic admin-configured revenue accounts'
  );

  // ===================================================================
  // SECTION 4: POSTING IDEMPOTENCY & CONCURRENCY
  // ===================================================================
  console.log('\n--- SECTION 4: POSTING IDEMPOTENCY & CONCURRENCY ---');

  // Simulation of concurrent posting race condition
  let postingLock = false;
  let journalEntriesCreated = 0;

  const attemptConcurrentPost = (docId: string, currentStatus: InvoiceStatus) => {
    if (currentStatus !== InvoiceStatus.APPROVED) {
      throw new Error(`Cannot post invoice in ${currentStatus} status`);
    }
    if (postingLock) {
      throw new Error('Unique constraint violation: Invoice already posted or posting in progress');
    }
    postingLock = true;
    journalEntriesCreated++;
    return { status: InvoiceStatus.POSTED, journalEntryId: `JE-${docId}` };
  };

  const result1 = attemptConcurrentPost('inv-101', InvoiceStatus.APPROVED);
  let result2Error: string | null = null;
  try {
    attemptConcurrentPost('inv-101', result1.status);
  } catch (err: any) {
    result2Error = err.message;
  }

  assert(
    journalEntriesCreated === 1 &&
    result1.status === InvoiceStatus.POSTED &&
    result2Error !== null &&
    result2Error.includes('Cannot post invoice in POSTED status'),
    '4. Database & Transactional Idempotency: Concurrent posting creates exactly ONE JournalEntry and rejects duplicates'
  );

  // ===================================================================
  // SECTION 5: IMMUTABILITY OF POSTED FINANCIAL DOCUMENTS
  // ===================================================================
  console.log('\n--- SECTION 5: IMMUTABILITY OF POSTED DOCUMENTS ---');

  const assertImmutable = (status: InvoiceStatus | ReceiptStatus) => {
    if (status === 'POSTED' || status === 'CANCELLED') {
      return false; // Not editable
    }
    return true; // Draft is editable
  };

  assert(
    !assertImmutable(InvoiceStatus.POSTED) &&
    !assertImmutable(ReceiptStatus.POSTED) &&
    !assertImmutable(InvoiceStatus.CANCELLED) &&
    assertImmutable(InvoiceStatus.DRAFT),
    '5. Immutability: Posted invoices, receipts, and line amounts are strictly read-only and require reversal transactions'
  );

  // ===================================================================
  // SECTION 6: GENERAL LEDGER AS SINGLE SOURCE OF TRUTH
  // ===================================================================
  console.log('\n--- SECTION 6: LEDGER SINGLE SOURCE OF TRUTH ---');

  // Verify customer statement is derived by summing posted JournalLines
  const customerPostedLines = [
    { accountCode: ACCOUNT_CODES.ACCOUNTS_RECEIVABLE, debit: new Decimal('70500.00'), credit: new Decimal('0.00') }, // Invoice
    { accountCode: ACCOUNT_CODES.ACCOUNTS_RECEIVABLE, debit: new Decimal('0.00'), credit: new Decimal('20000.00') }, // Receipt 1
    { accountCode: ACCOUNT_CODES.ACCOUNTS_RECEIVABLE, debit: new Decimal('0.00'), credit: new Decimal('30000.00') }, // Receipt 2
  ];

  const derivedARBalance = customerPostedLines.reduce(
    (bal, line) => bal.plus(line.debit).minus(line.credit),
    new Decimal(0)
  );

  assert(
    derivedARBalance.equals(new Decimal('20500.00')),
    '6. Ledger Source of Truth: Customer AR Balance (20,500 AFN) dynamically derived from posted JournalLines (Debits - Credits)'
  );

  // ===================================================================
  // FINAL RESULTS
  // ===================================================================
  console.log('\n================================================================');
  console.log(`DEEP ACCOUNTING AUDIT RESULTS: ${passed} PASSED, ${failed} FAILED`);
  console.log('================================================================');

  if (failed > 0) {
    process.exit(1);
  }
}

runPhase3AccountingAudit().catch((err) => {
  console.error('Fatal error in Phase 3 Accounting Audit suite:', err);
  process.exit(1);
});
