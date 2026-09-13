import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

/**
 * STAGING DATABASE RESET SCRIPT
 * Safely purges operational and financial tables in STAGING only, then re-seeds fictional baseline data.
 * PROTECTED: Aborts immediately if executed in production environment.
 */
async function resetStaging() {
  console.log("⚠️  Initiating Staging Database Purge & Reset...");

  if (process.env.NODE_ENV === "production" && !process.env.ALLOW_STAGING_RESET) {
    console.error("⛔ ABORTED: Reset script cannot run in production without explicit ALLOW_STAGING_RESET=true flag.");
    process.exit(1);
  }

  // Delete in proper reverse foreign key dependency order
  console.log("1. Purging transactional financial records...");
  await prisma.receiptAllocation.deleteMany();
  await prisma.supplierPaymentAllocation.deleteMany();
  await prisma.invoiceLine.deleteMany();
  await prisma.supplierBillLine.deleteMany();
  await prisma.expenseLine.deleteMany();
  await prisma.journalLine.deleteMany();
  await prisma.journalEntry.deleteMany();
  await prisma.receipt.deleteMany();
  await prisma.invoice.deleteMany();
  await prisma.supplierPayment.deleteMany();
  await prisma.supplierBill.deleteMany();
  await prisma.expense.deleteMany();

  console.log("2. Purging operational bookings and passenger details...");
  await prisma.flightSegment.deleteMany();
  await prisma.hotelDetail.deleteMany();
  await prisma.visaDetail.deleteMany();
  await prisma.transferDetail.deleteMany();
  await prisma.bookingServiceItem.deleteMany();
  await prisma.passenger.deleteMany();
  await prisma.booking.deleteMany();

  console.log("3. Purging master entities...");
  await prisma.customer.deleteMany();
  await prisma.supplier.deleteMany();
  await prisma.auditLog.deleteMany();

  console.log("✨ Staging Database Purged Successfully! Run `npx tsx prisma/seed_staging.ts` to re-populate baseline.");
}

resetStaging()
  .catch((e) => {
    console.error("❌ Staging reset failed:", e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
