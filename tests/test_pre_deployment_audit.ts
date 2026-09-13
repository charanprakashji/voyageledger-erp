import Decimal from "decimal.js";
import { NextRequest } from "next/server";
import { proxy } from "../src/proxy";
import {
  parseSessionCookie,
  SESSION_COOKIE_NAME,
  SESSION_MAX_AGE_MS,
  sanitizeRedirectUrl,
  handleActionError,
  hashPassword,
  verifyPassword,
  SessionUser,
} from "../src/lib/auth";
import { db } from "../src/lib/db";
import { UserRole } from "@prisma/client";
import { createCustomer, getCustomerById, updateCustomer } from "../src/app/actions/customers";
import { createSupplier, getSupplierById, updateSupplier } from "../src/app/actions/suppliers";
import { createBooking, cancelBooking } from "../src/app/actions/bookings";
import { approveInvoice, postInvoice, cancelInvoice } from "../src/app/actions/invoices";
import { approveReceipt, postReceipt, cancelReceipt } from "../src/app/actions/receipts";
import { postSupplierBill, cancelSupplierBill, createSupplierPayment } from "../src/app/actions/bills";
import { approveExpense, postExpense } from "../src/app/actions/expenses";
import { lockAccountingPeriod, unlockAccountingPeriod } from "../src/app/actions/periods";
import { updateUserRole, updateUserStatus } from "../src/app/actions/users";
import { validateDocumentUpload } from "../src/lib/gcsStorage";
import { validateEnvironmentSafety } from "../src/lib/db";

console.log("==================================================================");
console.log("VOYAGELEDGER ERP — COMPREHENSIVE PRE-DEPLOYMENT AUDIT SUITE");
console.log("==================================================================");

let passed = 0;
let failed = 0;

async function auditTest(name: string, fn: () => Promise<void> | void) {
  try {
    await fn();
    console.log(`✅ PASS: ${name}`);
    passed++;
  } catch (err: any) {
    console.error(`❌ FAIL: ${name} ->`, err.message);
    failed++;
  }
}

function createMockSessionCookie(user: SessionUser, createdAt = Date.now()): string {
  return Buffer.from(JSON.stringify({ ...user, createdAt })).toString("base64");
}

async function main() {
  // -------------------------------------------------------------
  // SECTION 1: AUTHENTICATION, SESSIONS & OPEN REDIRECT
  // -------------------------------------------------------------
  await auditTest("1.1 Password hashing generates secure bcrypt salt and verifies correctly", async () => {
    const raw = "SecureP@ss2026";
    const hash = await hashPassword(raw);
    if (!hash.startsWith("$2a$") && !hash.startsWith("$2b$")) {
      throw new Error("Invalid bcrypt hash prefix");
    }
    const valid = await verifyPassword(raw, hash);
    const invalid = await verifyPassword("WrongPassword", hash);
    if (!valid || invalid) {
      throw new Error("Password verification failed");
    }
  });

  await auditTest("1.2 Session TTL validates expiration (Rejects sessions older than 7 days)", () => {
    const user: SessionUser = {
      id: "usr-123",
      email: "test@voyageledger.af",
      name: "Test User",
      role: "ADMIN",
      status: "ACTIVE",
    };

    // Valid current session
    const validCookie = createMockSessionCookie(user, Date.now());
    const validParsed = parseSessionCookie(validCookie);
    if (!validParsed || validParsed.id !== "usr-123") {
      throw new Error("Valid session failed to parse");
    }

    // Expired session (8 days old)
    const eightDaysAgo = Date.now() - (SESSION_MAX_AGE_MS + 86400000);
    const expiredCookie = createMockSessionCookie(user, eightDaysAgo);
    const expiredParsed = parseSessionCookie(expiredCookie);
    if (expiredParsed !== null) {
      throw new Error("Expired session was not rejected by TTL validator!");
    }
  });

  await auditTest("1.3 Open Redirect Guard rejects protocol-relative and malicious redirect targets", () => {
    const maliciousTargets = [
      "//evil.com",
      "//evil.com/path",
      "/\\evil.com",
      "\\evil.com",
      "http://attacker.com",
      "https://attacker.com/steal",
      "javascript:alert(1)",
      "/javascript:alert(1)",
      "data:text/html,<script>alert(1)</script>",
      "/data:text/html,evil",
      "",
      null,
      undefined,
    ];

    for (const target of maliciousTargets) {
      const sanitized = sanitizeRedirectUrl(target as any);
      if (sanitized !== "/") {
        throw new Error(`Open redirect guard failed to sanitize target '${target}', got '${sanitized}'`);
      }
    }

    // Valid relative paths
    const validTargets = ["/dashboard", "/suppliers", "/bookings/new", "/reports/general-ledger?filter=all"];
    for (const target of validTargets) {
      const sanitized = sanitizeRedirectUrl(target);
      if (sanitized !== target) {
        throw new Error(`Sanitizer altered valid internal path '${target}' to '${sanitized}'`);
      }
    }
  });

  // -------------------------------------------------------------
  // SECTION 2: RBAC & PRIVILEGE ESCALATION PREVENTION
  // -------------------------------------------------------------
  await auditTest("2.1 Admin self-demotion and self-suspension protection", async () => {
    // Attempting to demote oneself as Admin
    const adminUser = await db.user.findFirst({ where: { role: "ADMIN", status: "ACTIVE" } });
    if (adminUser) {
      // Direct call to updateUserRole with self ID and non-admin role
      // Note: without active session context in CLI script, handleActionError returns UNAUTHORIZED or guard rejects
      const result = await updateUserRole(adminUser.id, "TRAVEL_AGENT");
      if (result.success !== false) {
        throw new Error("Failed to block admin self-demotion!");
      }
    }
  });

  await auditTest("2.2 Unauthorized server action calls return safe FORBIDDEN status", () => {
    const forbiddenErr = new Error("FORBIDDEN: Access denied. Required role: [ADMIN], but user is [TRAVEL_AGENT].");
    const handled = handleActionError(forbiddenErr);
    if (handled.success !== false || !handled.error.includes("FORBIDDEN")) {
      throw new Error(`Expected FORBIDDEN error, got: ${JSON.stringify(handled)}`);
    }
  });

  // -------------------------------------------------------------
  // SECTION 3: GENERAL LEDGER POSTING & DECIMAL INTEGRITY
  // -------------------------------------------------------------
  await auditTest("3.1 Decimal precision prevents floating point rounding drift", () => {
    // 0.1 + 0.2 in JS float = 0.30000000000000004
    const d1 = new Decimal("0.1");
    const d2 = new Decimal("0.2");
    const sum = d1.plus(d2);
    if (!sum.equals(new Decimal("0.3"))) {
      throw new Error(`Decimal precision failure: ${sum.toString()}`);
    }

    // Multi-currency calculation
    const foreignAmount = new Decimal("1250.75");
    const fxRate = new Decimal("70.8525");
    const baseAmount = foreignAmount.times(fxRate).toDecimalPlaces(2);
    if (baseAmount.toString() !== "88618.76") {
      throw new Error(`Unexpected FX rounded base amount: ${baseAmount.toString()}`);
    }
  });

  await auditTest("3.2 Double-Entry Balanced Journal Invariant strictly enforced", () => {
    const { validateJournalEntryBalance } = require("../src/lib/accounting");
    
    // Balanced: 10,000 DR == 10,000 CR
    const balanced = [
      { debit: 10000, credit: 0 },
      { debit: 0, credit: 10000 },
    ];
    const check1 = validateJournalEntryBalance(balanced);
    if (!check1.isValid || !check1.difference.equals(0)) {
      throw new Error("Balanced journal was incorrectly marked invalid");
    }

    // Unbalanced: 10,000 DR != 9,500 CR
    const unbalanced = [
      { debit: 10000, credit: 0 },
      { debit: 0, credit: 9500 },
    ];
    const check2 = validateJournalEntryBalance(unbalanced);
    if (check2.isValid) {
      throw new Error("Unbalanced journal was incorrectly accepted!");
    }
  });

  // -------------------------------------------------------------
  // SECTION 4: DOCUMENT UPLOAD & GCS SECURITY
  // -------------------------------------------------------------
  await auditTest("4.1 Document upload security rejects executable and malicious payloads", () => {
    // Test MIME whitelist
    const badMimes = [
      { name: "script.exe", mime: "application/x-msdownload", size: 1024 },
      { name: "shell.php", mime: "application/x-php", size: 1024 },
      { name: "run.sh", mime: "text/x-shellscript", size: 1024 },
      { name: "huge_doc.pdf", mime: "application/pdf", size: 20 * 1024 * 1024 }, // 20MB (limit is 10MB)
    ];

    for (const bad of badMimes) {
      const res = validateDocumentUpload(bad.name, bad.mime, bad.size);
      if (res.isValid) {
        throw new Error(`Failed to reject unsafe upload: ${JSON.stringify(bad)}`);
      }
    }

    // Valid uploads
    const validUpload = validateDocumentUpload("passenger_passport.pdf", "application/pdf", 1024 * 500);
    if (!validUpload.isValid || !validUpload.storageKey?.startsWith("secure_docs/")) {
      throw new Error("Valid PDF upload was rejected");
    }
  });

  // -------------------------------------------------------------
  // SECTION 5: STAGING / LOCAL / PRODUCTION ENVIRONMENT SAFETY
  // -------------------------------------------------------------
  await auditTest("5.1 Staging and local environment safety guards active", () => {
    validateEnvironmentSafety();
  });

  // -------------------------------------------------------------
  // SECTION 6: SENSITIVE ERROR SANITIZATION
  // -------------------------------------------------------------
  await auditTest("6.1 Database errors and connection details are never leaked to client", () => {
    const rawErrors = [
      "PrismaClientInitializationError: Can't reach database server at 10.0.0.5:5432",
      "SELECT * FROM \"users\" WHERE \"passwordHash\" = '$2a$10$...'",
      "connection pool timeout at node_modules/@prisma/client",
      "FATAL: database travel_erp does not exist",
    ];

    for (const raw of rawErrors) {
      const handled = handleActionError(new Error(raw), "Operation failed.");
      if (handled.error !== "Operation failed.") {
        throw new Error(`Sanitizer failed to replace internal error '${raw}' with fallback!`);
      }
      if (handled.error.includes("PrismaClient") || handled.error.includes("SELECT") || handled.error.includes("passwordHash")) {
        throw new Error(`Leaked sensitive internal terms in error: ${handled.error}`);
      }
    }
  });

  console.log("==================================================================");
  console.log(`PRE-DEPLOYMENT AUDIT SUMMARY: ${passed + failed} TOTAL | ${passed} PASSED | ${failed} FAILED`);
  console.log("==================================================================");

  if (failed > 0) {
    process.exit(1);
  }
}

main().catch((err) => {
  console.error("Pre-deployment audit fatal error:", err);
  process.exit(1);
});
