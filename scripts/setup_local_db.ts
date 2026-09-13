import { PrismaClient } from "@prisma/client";

async function setup() {
  const masterUrl = "postgresql://postgres:postgres@127.0.0.1:5432/postgres?schema=public";
  const prisma = new PrismaClient({
    datasources: { db: { url: masterUrl } },
  });

  try {
    console.log("Checking if database 'travel_erp_local' exists...");
    const result: any[] = await prisma.$queryRawUnsafe(
      "SELECT 1 FROM pg_database WHERE datname = 'travel_erp_local'"
    );

    if (result.length === 0) {
      console.log("Creating database 'travel_erp_local'...");
      await prisma.$executeRawUnsafe("CREATE DATABASE travel_erp_local");
      console.log("✅ Database 'travel_erp_local' created successfully.");
    } else {
      console.log("ℹ️ Database 'travel_erp_local' already exists.");
    }
  } catch (err: any) {
    console.error("❌ Error setting up local database:", err.message);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

setup();
