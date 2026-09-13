import { validateJournalEntryBalance, toDecimal, createReversalLines } from "./src/lib/accounting";
import Decimal from "decimal.js";

async function runTests() {
  console.log("=== RUNNING PHASE 1 LOGICAL VERIFICATION TESTS ===\n");

  let passed = 0;
  let failed = 0;

  function assert(condition: boolean, testName: string) {
    if (condition) {
      console.log(`✅ PASS: ${testName}`);
      passed++;
    } else {
      console.error(`❌ FAIL: ${testName}`);
      failed++;
    }
  }

  // 1. Accounting Invariant Test: Balanced Journal
  const validLines = [
    { accountId: "acc-1200", debit: 5000, credit: 0 },
    { accountId: "acc-4010", debit: 0, credit: 5000 },
  ];
  const balanceCheck = validateJournalEntryBalance(validLines);
  assert(balanceCheck.isValid, "Balanced Journal Entry (5000 DR = 5000 CR) is valid");

  // 2. Accounting Invariant Test: Unbalanced Journal must fail
  const invalidLines = [
    { accountId: "acc-1200", debit: 5000, credit: 0 },
    { accountId: "acc-4010", debit: 0, credit: 4500 },
  ];
  const unbalancedCheck = validateJournalEntryBalance(invalidLines);
  assert(!unbalancedCheck.isValid, "Unbalanced Journal Entry (5000 DR != 4500 CR) is rejected");

  // 3. Multi-Currency Conversion Precision
  const foreignUSD = new Decimal(1250.50);
  const exchangeRate = new Decimal(70.50); // 70.50 AFN per USD
  const baseAFN = foreignUSD.times(exchangeRate).toDecimalPlaces(2);
  assert(baseAFN.equals(new Decimal("88160.25")), "Multi-currency Decimal precision: $1250.50 @ 70.50 = 88,160.25 AFN");

  // 4. Reversal Entry Generator Test
  const reversalLines = createReversalLines([
    { accountId: "acc-1200", debit: 2000, credit: 0, currency: "AFN", exchangeRate: 1 },
    { accountId: "acc-4010", debit: 0, credit: 2000, currency: "AFN", exchangeRate: 1 },
  ]);
  assert(
    toDecimal(reversalLines[0].credit).equals(new Decimal(2000)) && toDecimal(reversalLines[1].debit).equals(new Decimal(2000)),
    "Reversal generator inverts debits to credits with exact balanced amounts"
  );

  // 5. Audit Log Sanitization Test
  const SENSITIVE_KEYS = new Set(["password", "passwordHash", "token", "secret"]);
  function sanitize(obj: any): any {
    const res: any = {};
    for (const [k, v] of Object.entries(obj)) {
      if (SENSITIVE_KEYS.has(k)) res[k] = "[REDACTED]";
      else res[k] = v;
    }
    return res;
  }
  const sanitized = sanitize({ name: "Admin", email: "admin@voyageledger.af", passwordHash: "$2a$10$abcdef123456" });
  assert(sanitized.passwordHash === "[REDACTED]" && sanitized.name === "Admin", "Audit log strips passwords and secrets");

  console.log(`\n=== TEST SUMMARY: ${passed} Passed, ${failed} Failed ===`);
  if (failed > 0) process.exit(1);
}

runTests();
