import { PrismaClient } from "@prisma/client";

async function main() {
  const passwords = ["postgres", "password", "admin", "root", "123456", ""];
  const users = ["postgres"];
  const dbs = ["postgres", "travel_erp", "travel_erp_local", "travel_erp_dev"];

  console.log("Searching for working local PostgreSQL credentials...");

  for (const user of users) {
    for (const password of passwords) {
      for (const db of dbs) {
        const url = `postgresql://${user}:${password}@127.0.0.1:5432/${db}?schema=public`;
        const prisma = new PrismaClient({
          datasources: { db: { url } },
        });

        try {
          await prisma.$queryRawUnsafe("SELECT 1 as ping");
          console.log(`\n🎉 SUCCESS! Connected with: postgresql://${user}:***@127.0.0.1:5432/${db}`);
          console.log(`FULL_WORKING_URL: ${url}`);
          await prisma.$disconnect();
          process.exit(0);
        } catch (err: any) {
          // continue
        } finally {
          await prisma.$disconnect().catch(() => {});
        }
      }
    }
  }

  console.log("\n❌ Could not connect with standard default credentials.");
  process.exit(1);
}

main();
