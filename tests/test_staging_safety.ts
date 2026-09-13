import { validateEnvironmentSafety } from "../src/lib/db";

console.log("=================================================");
console.log("RUNNING STAGING & LOCAL ENVIRONMENT SAFETY GUARD TESTS");
console.log("=================================================");

let passed = 0;
let failed = 0;

function runTest(name: string, fn: () => void) {
  try {
    fn();
    console.log(`✅ PASS: ${name}`);
    passed++;
  } catch (err: any) {
    console.error(`❌ FAIL: ${name} ->`, err.message);
    failed++;
  }
}

const origEnv = { ...process.env };

function resetEnv() {
  process.env = { ...origEnv };
}

// TEST 1: Staging refuses connection to production database
runTest("Staging refuses to connect to production database", () => {
  resetEnv();
  process.env.APP_ENV = "staging";
  process.env.DATABASE_URL = "postgresql://user:pass@10.0.0.1:5432/travel-accounting-2026-prod?schema=public";
  process.env.GCS_BUCKET_NAME = "travel-accounting-staging-docs-2026";

  let caught = false;
  try {
    validateEnvironmentSafety();
  } catch (e: any) {
    caught = true;
    if (!e.message.includes("PRODUCTION database target")) {
      throw new Error(`Unexpected error message: ${e.message}`);
    }
  }
  if (!caught) {
    throw new Error("Safety guard failed to block production database URL in staging!");
  }
});

// TEST 2: Staging refuses connection if GCS bucket is the production bucket
runTest("Staging refuses to use production GCS bucket", () => {
  resetEnv();
  process.env.APP_ENV = "staging";
  process.env.DATABASE_URL = "postgresql://user:pass@127.0.0.1:5432/travel_erp_staging?schema=public";
  process.env.GCS_BUCKET_NAME = "travel-accounting-2026-docs";

  let caught = false;
  try {
    validateEnvironmentSafety();
  } catch (e: any) {
    caught = true;
    if (!e.message.includes("production bucket ('travel-accounting-2026-docs')")) {
      throw new Error(`Unexpected error message: ${e.message}`);
    }
  }
  if (!caught) {
    throw new Error("Safety guard failed to block production GCS bucket in staging!");
  }
});

// TEST 3: Production refuses connection to staging database
runTest("Production refuses to connect to staging database", () => {
  resetEnv();
  process.env.APP_ENV = "production";
  process.env.DATABASE_URL = "postgresql://user:pass@127.0.0.1:5432/travel_erp_staging?schema=public";
  process.env.GCS_BUCKET_NAME = "travel-accounting-2026-docs";

  let caught = false;
  try {
    validateEnvironmentSafety();
  } catch (e: any) {
    caught = true;
    if (!e.message.includes("STAGING or TEST database")) {
      throw new Error(`Unexpected error message: ${e.message}`);
    }
  }
  if (!caught) {
    throw new Error("Safety guard failed to block staging database URL in production!");
  }
});

// TEST 4: Valid staging config succeeds
runTest("Valid staging config passes safety check", () => {
  resetEnv();
  process.env.APP_ENV = "staging";
  process.env.DATABASE_URL = "postgresql://staging_user:pass@127.0.0.1:5432/travel_erp_staging?schema=public";
  process.env.GCS_BUCKET_NAME = "travel-accounting-staging-docs-2026";

  validateEnvironmentSafety();
});

// TEST 5: Local refuses connection to production database
runTest("Local development refuses to connect to production database", () => {
  resetEnv();
  process.env.APP_ENV = "local";
  process.env.DATABASE_URL = "postgresql://user:pass@35.200.10.10:5432/travel-erp-prod?schema=public";
  process.env.GCS_BUCKET_NAME = "travel-accounting-local-docs-2026";

  let caught = false;
  try {
    validateEnvironmentSafety();
  } catch (e: any) {
    caught = true;
    if (!e.message.includes("PRODUCTION database")) {
      throw new Error(`Unexpected error message: ${e.message}`);
    }
  }
  if (!caught) {
    throw new Error("Safety guard failed to block production database URL in local development!");
  }
});

// TEST 6: Local refuses connection if GCS bucket is production bucket
runTest("Local development refuses to use production GCS bucket", () => {
  resetEnv();
  process.env.APP_ENV = "local";
  process.env.DATABASE_URL = "postgresql://postgres:postgres@127.0.0.1:5432/travel_erp_local?schema=public";
  process.env.GCS_BUCKET_NAME = "travel-accounting-2026-docs";

  let caught = false;
  try {
    validateEnvironmentSafety();
  } catch (e: any) {
    caught = true;
    if (!e.message.includes("production bucket ('travel-accounting-2026-docs')")) {
      throw new Error(`Unexpected error message: ${e.message}`);
    }
  }
  if (!caught) {
    throw new Error("Safety guard failed to block production GCS bucket in local development!");
  }
});

// TEST 7: Valid local config succeeds
runTest("Valid local config passes safety check", () => {
  resetEnv();
  process.env.APP_ENV = "local";
  process.env.DATABASE_URL = "postgresql://postgres:postgres@127.0.0.1:5432/travel_erp_local?schema=public";
  process.env.GCS_BUCKET_NAME = "travel-accounting-local-docs-2026";

  validateEnvironmentSafety();
});

resetEnv();

console.log("=================================================");
console.log(`TOTAL: ${passed + failed} | PASSED: ${passed} | FAILED: ${failed}`);
console.log("=================================================");

if (failed > 0) {
  process.exit(1);
}
