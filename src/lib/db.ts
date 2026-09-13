// Prisma Client singleton for PostgreSQL / Google Cloud SQL with Startup Safety Guards
import { PrismaClient } from "@prisma/client";

/**
 * Validates environment and database target configuration to prevent
 * cross-environment contamination (e.g. staging connecting to production database,
 * or production connecting to staging database).
 */
export function validateEnvironmentSafety(): void {
  const appEnv = (process.env.APP_ENV || "").toLowerCase();
  const dbUrl = (process.env.DATABASE_URL || "").toLowerCase();
  const gcsBucket = (process.env.GCS_BUCKET_NAME || "").toLowerCase();

  // Known production database identifiers and instance names
  const prodDbIdentifiers = [
    "production",
    "prod_",
    "_prod",
    "prod-db",
    "travel-erp-prod",
    "travel-accounting-2026-prod",
    "travel-accounting-2026:asia-south1:travel-erp-db",
    "travel-accounting-2026:asia-south1:production",
  ];

  // Known staging/test database identifiers
  const stagingDbIdentifiers = [
    "staging",
    "test",
    "travel_erp_staging",
    "travel_erp_test",
    "travel-accounting-2026-staging",
  ];

  if (appEnv === "local" || appEnv === "development") {
    // Local safety guard: Refuse to connect if DATABASE_URL points to a production or remote cloud database
    const isProd = prodDbIdentifiers.some((marker) => dbUrl.includes(marker));
    const isCloudStaging = dbUrl.includes("travel-accounting-2026-staging") || dbUrl.includes("cloudsql");
    
    if (isProd) {
      throw new Error(
        "⛔ CRITICAL SAFETY ERROR: APP_ENV is set to '" + appEnv + "', but DATABASE_URL points to a PRODUCTION database. Local connection refused."
      );
    }
    if (isCloudStaging) {
      throw new Error(
        "⛔ CRITICAL SAFETY ERROR: APP_ENV is set to '" + appEnv + "', but DATABASE_URL points to a Cloud SQL staging instance. Local connection refused."
      );
    }
    if (gcsBucket === "travel-accounting-2026-docs") {
      throw new Error(
        "⛔ CRITICAL SAFETY ERROR: APP_ENV is '" + appEnv + "' but GCS_BUCKET_NAME is set to the production bucket ('travel-accounting-2026-docs'). Use a local or test bucket identifier."
      );
    }
  } else if (appEnv === "staging") {
    // Staging safety guard: Refuse to connect if DATABASE_URL points to a production database
    const isExplicitlyProd = prodDbIdentifiers.some((marker) => dbUrl.includes(marker));
    const isStagingDb = stagingDbIdentifiers.some((marker) => dbUrl.includes(marker));

    // Refuse if explicitly marked as production, or if pointing to production GCP Cloud SQL instance
    if (isExplicitlyProd && !isStagingDb) {
      throw new Error(
        "⛔ CRITICAL SAFETY ERROR: APP_ENV is set to 'staging', but DATABASE_URL points to a PRODUCTION database target. Staging connection refused to prevent data corruption."
      );
    }

    // Safety guard against accidentally using the production GCS bucket in staging
    if (gcsBucket === "travel-accounting-2026-docs") {
      throw new Error(
        "⛔ CRITICAL SAFETY ERROR: APP_ENV is 'staging' but GCS_BUCKET_NAME is set to the production bucket ('travel-accounting-2026-docs'). Staging must use a separate bucket (e.g. 'travel-accounting-staging-docs-2026')."
      );
    }
  } else if (appEnv === "production") {
    // Production safety guard: Refuse to connect if DATABASE_URL targets a staging, test, or local database
    const isExplicitlyStaging = stagingDbIdentifiers.some((marker) => dbUrl.includes(marker));
    if (isExplicitlyStaging) {
      throw new Error(
        "⛔ CRITICAL SAFETY ERROR: APP_ENV is set to 'production', but DATABASE_URL targets a STAGING or TEST database. Production connection refused to protect test data integrity."
      );
    }
  }
}

// Run validation before instantiating client
validateEnvironmentSafety();

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
};

export const db =
  globalForPrisma.prisma ??
  new PrismaClient({
    log:
      process.env.NODE_ENV === "development"
        ? ["query", "error", "warn"]
        : ["error"],
  });

if (process.env.NODE_ENV !== "production") {
  globalForPrisma.prisma = db;
}
