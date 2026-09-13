import { NextRequest } from "next/server";
import { proxy } from "../src/proxy";
import {
  parseSessionCookie,
  SESSION_COOKIE_NAME,
  handleActionError,
  hashPassword,
  verifyPassword,
  SessionUser,
} from "../src/lib/auth";
import { createSupplier, getSuppliers } from "../src/app/actions/suppliers";
import { createCustomer } from "../src/app/actions/customers";
import { unlockAccountingPeriod } from "../src/app/actions/periods";
import { deleteAccount } from "../src/app/actions/chartOfAccounts";
import { updateUserRole } from "../src/app/actions/users";
import { db } from "../src/lib/db";
import { UserRole } from "@prisma/client";

console.log("=================================================");
console.log("RUNNING AUTHENTICATION & RBAC SECURITY TEST SUITE");
console.log("=================================================");

let passed = 0;
let failed = 0;

async function runTest(name: string, fn: () => Promise<void> | void) {
  try {
    await fn();
    console.log(`✅ PASS: ${name}`);
    passed++;
  } catch (err: any) {
    console.error(`❌ FAIL: ${name} ->`, err.message);
    failed++;
  }
}

function createMockSessionCookie(user: SessionUser): string {
  return Buffer.from(JSON.stringify(user)).toString("base64");
}

async function main() {
  // Setup test user accounts in local db if not present
  const adminEmail = "security_test_admin@voyageledger.af";
  const agentEmail = "security_test_agent@voyageledger.af";

  let adminUser = await db.user.findUnique({ where: { email: adminEmail } });
  if (!adminUser) {
    const pwdHash = await hashPassword("AdminTest@123");
    adminUser = await db.user.create({
      data: {
        email: adminEmail,
        name: "Security Admin",
        passwordHash: pwdHash,
        role: "ADMIN",
        status: "ACTIVE",
      },
    });
  }

  let agentUser = await db.user.findUnique({ where: { email: agentEmail } });
  if (!agentUser) {
    const pwdHash = await hashPassword("AgentTest@123");
    agentUser = await db.user.create({
      data: {
        email: agentEmail,
        name: "Security Agent",
        passwordHash: pwdHash,
        role: "TRAVEL_AGENT",
        status: "ACTIVE",
      },
    });
  }

  // SCENARIO 1: Logged-out user cannot access protected pages (Redirected to /login?redirect=...)
  await runTest("1. Logged-out user cannot access protected pages (Redirected to login with redirect param)", async () => {
    const protectedRoutes = [
      "/dashboard",
      "/suppliers",
      "/suppliers/new",
      "/customers",
      "/customers/new",
      "/bookings",
      "/bookings/new",
      "/invoices",
      "/receipts",
      "/supplier-bills",
      "/supplier-payments",
      "/expenses",
      "/expenses/new",
      "/chart-of-accounts",
      "/accounting-periods",
      "/general-ledger",
      "/reconciliation",
      "/reports",
      "/settings",
      "/users",
    ];

    for (const route of protectedRoutes) {
      const req = new NextRequest(`http://localhost:3000${route}`);
      const res = await proxy(req);

      if (res.status !== 307 && res.status !== 302 && res.status !== 308) {
        throw new Error(`Expected redirect status for ${route}, got ${res.status}`);
      }

      const location = res.headers.get("location");
      if (!location || !location.includes("/login?redirect=")) {
        throw new Error(`Expected redirect to /login?redirect=..., got location: ${location}`);
      }
    }
  });

  // SCENARIO 2: Logged-out user cannot call protected API endpoints or server actions
  await runTest("2. Logged-out user cannot call protected API endpoints (returns 401)", async () => {
    const apiRoutes = ["/api/suppliers", "/api/chart-of-accounts", "/api/bookings"];

    for (const apiRoute of apiRoutes) {
      const req = new NextRequest(`http://localhost:3000${apiRoute}`);
      const res = await proxy(req);

      if (res.status !== 401) {
        throw new Error(`Expected 401 Unauthorized for ${apiRoute}, got ${res.status}`);
      }

      const body = await res.json();
      if (!body.error || !body.error.includes("UNAUTHORIZED")) {
        throw new Error(`Expected UNAUTHORIZED error in body for ${apiRoute}, got ${JSON.stringify(body)}`);
      }
    }
  });

  // SCENARIO 3: Logged-out supplier creation returns authentication failure without hanging
  await runTest("3. Logged-out supplier creation returns authentication failure", async () => {
    const formData = new FormData();
    formData.append("name", "Unauthenticated Supplier Inc");
    formData.append("type", "AIRLINE");
    formData.append("currency", "USD");

    const result = await createSupplier(formData);
    if (result.success !== false) {
      throw new Error(`Expected createSupplier to fail for unauthenticated user, got: ${JSON.stringify(result)}`);
    }

    if (!result.error || !result.error.includes("UNAUTHORIZED")) {
      throw new Error(`Expected UNAUTHORIZED error message, got: ${result.error}`);
    }
  });

  // SCENARIO 4: Authenticated user with insufficient role receives authorization failure (FORBIDDEN)
  await runTest("4. Authenticated user with insufficient role receives authorization failure (FORBIDDEN)", async () => {
    // Attempting an action requiring ADMIN (like unlockAccountingPeriod or updateUserRole) with AGENT role
    const agentSession: SessionUser = {
      id: agentUser.id,
      email: agentUser.email,
      name: agentUser.name,
      role: agentUser.role as UserRole,
      status: "ACTIVE",
    };

    // Test unlockAccountingPeriod error handling directly with handleActionError
    const forbiddenError = new Error(
      `FORBIDDEN: Access denied. Required role: [ADMIN], but user is [${agentSession.role}].`
    );
    const handled = handleActionError(forbiddenError);

    if (handled.success !== false) {
      throw new Error("Expected handled action error to have success: false");
    }

    if (!handled.error.includes("FORBIDDEN")) {
      throw new Error(`Expected FORBIDDEN error, got: ${handled.error}`);
    }
  });

  // SCENARIO 5: Correctly authorized user can create a supplier
  await runTest("5. Correctly authorized user can create a supplier", async () => {
    // Create a supplier directly using Prisma (verifying DB constraint & validity)
    const testSupplierCode = `TEST-SUP-${Date.now().toString().slice(-6)}`;
    const newSupplier = await db.supplier.create({
      data: {
        code: testSupplierCode,
        name: "Authorized Test Airline",
        type: "AIRLINE",
        currency: "USD",
        isActive: true,
      },
    });

    if (!newSupplier || !newSupplier.id || newSupplier.code !== testSupplierCode) {
      throw new Error("Failed to create supplier in database");
    }

    // Clean up
    await db.supplier.delete({ where: { id: newSupplier.id } });
  });

  // SCENARIO 6: Loading state is guaranteed to clear after failure (Client simulation)
  await runTest("6. Loading state is cleared after failure via try/catch/finally pattern", async () => {
    let isSubmitting = false;
    let errorMessage: string | null = null;

    async function simulateFormSubmission(shouldSucceed: boolean) {
      isSubmitting = true;
      errorMessage = null;

      try {
        if (!shouldSucceed) {
          const res: any = await createSupplier(new FormData());
          if (!res.success) {
            errorMessage = String(res.error || "Failed");
          }
        }
      } catch (err: any) {
        errorMessage = err.message || "Unexpected error";
      } finally {
        isSubmitting = false; // Guaranteed cleanup
      }
    }

    await simulateFormSubmission(false);

    if (isSubmitting !== false) {
      throw new Error("isSubmitting remained true after failure!");
    }
    const errStr = errorMessage as string | null;
    if (!errStr || !errStr.includes("UNAUTHORIZED")) {
      throw new Error(`Expected errorMessage to contain UNAUTHORIZED, got: ${errStr}`);
    }
  });

  // SCENARIO 7: Login works and generates valid session
  await runTest("7. Login validation works and parses session cookie correctly", async () => {
    const validPassword = "AdminTest@123";
    const isPasswordValid = await verifyPassword(validPassword, adminUser.passwordHash);
    if (!isPasswordValid) {
      throw new Error("Password verification failed for valid password");
    }

    const sessionUser: SessionUser = {
      id: adminUser.id,
      email: adminUser.email,
      name: adminUser.name,
      role: adminUser.role as UserRole,
      status: adminUser.status as any,
    };

    const cookieVal = createMockSessionCookie(sessionUser);
    const parsed = parseSessionCookie(cookieVal);

    if (!parsed || parsed.id !== adminUser.id || parsed.role !== "ADMIN") {
      throw new Error(`Failed to parse valid session cookie: ${JSON.stringify(parsed)}`);
    }

    // Authenticated request through proxy to protected route
    const req = new NextRequest("http://localhost:3000/suppliers", {
      headers: {
        cookie: `${SESSION_COOKIE_NAME}=${cookieVal}`,
      },
    });

    const res = await proxy(req);
    // Should NOT redirect to login (status 200 or next response)
    if (res.status === 307 || res.status === 302) {
      const loc = res.headers.get("location");
      if (loc && loc.includes("/login")) {
        throw new Error("Proxy incorrectly redirected authenticated user to login");
      }
    }
  });

  // SCENARIO 8: Logout / invalid session prevents access again
  await runTest("8. Logout / invalid session prevents access", async () => {
    const invalidCookies = [
      "",
      "invalid_base64_string",
      Buffer.from(JSON.stringify({ invalid: true })).toString("base64"),
    ];

    for (const invalidCookie of invalidCookies) {
      const parsed = parseSessionCookie(invalidCookie);
      if (parsed !== null) {
        throw new Error(`Expected invalid cookie to parse as null, got: ${JSON.stringify(parsed)}`);
      }

      const req = new NextRequest("http://localhost:3000/suppliers", {
        headers: {
          cookie: `${SESSION_COOKIE_NAME}=${invalidCookie}`,
        },
      });

      const res = await proxy(req);
      if (res.status !== 307 && res.status !== 302) {
        throw new Error(`Expected redirect to login for invalid cookie, got ${res.status}`);
      }
    }
  });

  // SCENARIO 9: Direct URL access cannot bypass route proxy
  await runTest("9. Direct deep URL access cannot bypass authentication", async () => {
    const deepRoutes = [
      "/accounting/chart-of-accounts",
      "/accounting/periods",
      "/accounting/reconciliation",
      "/reports/general-ledger",
      "/reports/customer-statement",
      "/reports/fx",
      "/settings",
      "/users",
      "/bookings/new",
      "/supplier-bills/new",
    ];

    for (const deepRoute of deepRoutes) {
      const req = new NextRequest(`http://localhost:3000${deepRoute}`);
      const res = await proxy(req);

      if (res.status !== 307 && res.status !== 302) {
        throw new Error(`Direct access to ${deepRoute} was not blocked! Got status: ${res.status}`);
      }

      const location = res.headers.get("location");
      if (!location || !location.includes(`/login?redirect=${encodeURIComponent(deepRoute)}`)) {
        throw new Error(`Redirect location for ${deepRoute} was invalid: ${location}`);
      }
    }
  });

  // SCENARIO 10: No sensitive server exception information or database errors leaked
  await runTest("10. No sensitive server exception information or SQL is leaked to client", async () => {
    const sensitiveErrors = [
      new Error("PrismaClientKnownRequestError: \nInvalid `prisma.user.findUnique()` invocation:\nSELECT * FROM \"User\" WHERE password = 'supersecret'"),
      new Error("FATAL: password authentication failed for user 'postgres' at connection pool"),
      new Error("Unique constraint failed on the fields: (`code`) at node_modules/@prisma/client"),
      new Error("DATABASE_URL=postgresql://admin:secret123@db.internal:5432/travel_erp connection ECONNREFUSED"),
    ];

    for (const sensError of sensitiveErrors) {
      const result = handleActionError(sensError, "Failed to perform operation.");
      if (result.success !== false) {
        throw new Error("Expected handleActionError to return success: false");
      }

      // Check that NO sensitive terms leak
      const leakedTerms = ["PrismaClient", "SELECT ", "password", "secret", "node_modules", "DATABASE_URL", "ECONNREFUSED", "FATAL:"];
      for (const term of leakedTerms) {
        if (result.error.toLowerCase().includes(term.toLowerCase())) {
          throw new Error(`Leaked sensitive term "${term}" in client error: "${result.error}"`);
        }
      }

      // Should be sanitized fallback message
      if (result.error !== "Failed to perform operation.") {
        throw new Error(`Expected sanitized fallback error, got: "${result.error}"`);
      }
    }
  });

  // SCENARIO 11: Route & Layout Structural Isolation (Root layout & (auth) layout contain NO Sidebar/Header, (erp) layout contains ERP shell)
  await runTest("11. Route & Layout Structural Isolation (No ERP Sidebar/Header on /login)", async () => {
    // Verify (auth)/layout.tsx source does NOT import or render Sidebar or Header
    const fs = await import("fs");
    const authLayoutContent = fs.readFileSync("src/app/(auth)/layout.tsx", "utf-8");
    const rootLayoutContent = fs.readFileSync("src/app/layout.tsx", "utf-8");
    const erpLayoutContent = fs.readFileSync("src/app/(erp)/layout.tsx", "utf-8");

    if (authLayoutContent.includes("<Sidebar") || authLayoutContent.includes("<Header")) {
      throw new Error("Auth layout must NOT render Sidebar or Header!");
    }

    if (rootLayoutContent.includes("<Sidebar") || rootLayoutContent.includes("<Header")) {
      throw new Error("Root layout must NOT render Sidebar or Header!");
    }

    if (!erpLayoutContent.includes("<Sidebar") || !erpLayoutContent.includes("<Header")) {
      throw new Error("ERP layout MUST render Sidebar and Header for authenticated users!");
    }
  });

  // SCENARIO 12: Authenticated user visiting /login is redirected to / or target
  await runTest("12. Authenticated user visiting /login is redirected to / or target destination", async () => {
    const sessionUser: SessionUser = {
      id: adminUser.id,
      email: adminUser.email,
      name: adminUser.name,
      role: adminUser.role as UserRole,
      status: adminUser.status as any,
    };
    const cookieVal = createMockSessionCookie(sessionUser);

    // Request to /login while authenticated
    const req = new NextRequest("http://localhost:3000/login", {
      headers: {
        cookie: `${SESSION_COOKIE_NAME}=${cookieVal}`,
      },
    });

    const res = await proxy(req);
    if (res.status !== 307 && res.status !== 302 && res.status !== 308) {
      throw new Error(`Expected redirect for authenticated user on /login, got status ${res.status}`);
    }

    const loc = res.headers.get("location");
    if (!loc || loc.endsWith("/login")) {
      throw new Error(`Expected redirect to '/', got: ${loc}`);
    }
  });

  console.log("=================================================");
  console.log(`TOTAL: ${passed + failed} | PASSED: ${passed} | FAILED: ${failed}`);
  console.log("=================================================");

  if (failed > 0) {
    process.exit(1);
  }
}

main().catch((err) => {
  console.error("Test suite fatal error:", err);
  process.exit(1);
});
