import { PrismaClient, UserRole, UserStatus, CustomerType, ServiceType } from "@prisma/client";
import bcrypt from "bcryptjs";
import Decimal from "decimal.js";
import { DEFAULT_CHART_OF_ACCOUNTS } from "../src/lib/accounting";

const prisma = new PrismaClient();

/**
 * SAFE LOCAL DEVELOPMENT SEED SCRIPT
 * Populates the local PostgreSQL database with 100% FICTIONAL test records.
 */
async function main() {
  console.log("🌱 Starting Safe Local Development Database Seed (Fictional Data Only)...");

  // 1. Seed Company Settings
  console.log("1. Seeding Fictional Company Settings...");
  await prisma.companySetting.deleteMany();
  await prisma.companySetting.create({
    data: {
      companyName: "Ariana Silk Road Travel & Tours (Local Dev)",
      address: "Ansari Square, Shahr-e-Naw",
      province: "Kabul",
      city: "Kabul",
      country: "Afghanistan",
      phone: "+93 20 220 1234",
      email: "info@arianatravel.af",
      taxNumber: "TIN-LOCAL-900234188",
      taxRegistrationNumber: "MOCI-LOCAL-2026-899",
      defaultCurrency: "AFN",
      supportedCurrencies: ["AFN", "USD", "EUR", "AED"],
      financialYearStart: "01-01",
    },
  });

  // 2. Seed Chart of Accounts
  console.log("2. Seeding Standard Chart of Accounts (COA)...");
  for (const acc of DEFAULT_CHART_OF_ACCOUNTS) {
    await prisma.chartOfAccount.upsert({
      where: { code: acc.code },
      update: {
        name: acc.name,
        accountType: acc.accountType,
        normalBalance: acc.normalBalance,
        isSystem: acc.isSystem,
      },
      create: {
        code: acc.code,
        name: acc.name,
        accountType: acc.accountType,
        normalBalance: acc.normalBalance,
        isSystem: acc.isSystem,
      },
    });
  }

  // 3. Seed Accounting Period
  console.log("3. Seeding Accounting Period for FY 2026...");
  const existingPeriod = await prisma.accountingPeriod.findFirst({
    where: { name: "FY 2026" },
  });
  if (!existingPeriod) {
    await prisma.accountingPeriod.create({
      data: {
        name: "FY 2026",
        financialYear: "2026",
        startDate: new Date("2026-01-01T00:00:00Z"),
        endDate: new Date("2026-12-31T23:59:59Z"),
        isLocked: false,
      },
    });
  }

  // 4. Seed Local Admin & Test Users
  console.log("4. Seeding Fictional Users with Hashed Credentials...");
  const salt = await bcrypt.genSalt(10);
  const adminPasswordHash = await bcrypt.hash("Admin@Local2026!", salt);
  const agentPasswordHash = await bcrypt.hash("Agent@Local2026!", salt);

  const adminUser = await prisma.user.upsert({
    where: { email: "admin@voyageledger.af" },
    update: {
      passwordHash: adminPasswordHash,
      role: UserRole.ADMIN,
      status: UserStatus.ACTIVE,
    },
    create: {
      email: "admin@voyageledger.af",
      name: "Local System Administrator",
      passwordHash: adminPasswordHash,
      role: UserRole.ADMIN,
      status: UserStatus.ACTIVE,
      phone: "+93 700 112233",
    },
  });

  const agentUser = await prisma.user.upsert({
    where: { email: "agent@voyageledger.af" },
    update: {
      passwordHash: agentPasswordHash,
      role: UserRole.TRAVEL_AGENT,
      status: UserStatus.ACTIVE,
    },
    create: {
      email: "agent@voyageledger.af",
      name: "Local Travel Agent (Ahmad)",
      passwordHash: agentPasswordHash,
      role: UserRole.TRAVEL_AGENT,
      status: UserStatus.ACTIVE,
      phone: "+93 700 445566",
    },
  });

  // 5. Seed Fictional Customers
  console.log("5. Seeding Fictional Customers...");
  const custCorporate = await prisma.customer.upsert({
    where: { code: "CUST-0001" },
    update: {},
    create: {
      code: "CUST-0001",
      name: "Pamir Logistics & Mining Corp (Fictional)",
      type: CustomerType.CORPORATE,
      contactPerson: "Mohammad Qasim",
      email: "procurement@pamir-mining.af",
      phone: "+93 799 123456",
      province: "Kabul",
      city: "Kabul",
      address: "Kolola Pushta Road, District 4",
      creditLimit: new Decimal("500000.00"),
    },
  });

  await prisma.customer.upsert({
    where: { code: "CUST-0002" },
    update: {},
    create: {
      code: "CUST-0002",
      name: "Dr. Zalmay Karimi (Fictional)",
      type: CustomerType.INDIVIDUAL,
      email: "z.karimi@example.af",
      phone: "+93 788 987654",
      province: "Herat",
      city: "Herat",
      address: "Jade Shomali, Herat City",
    },
  });

  // 6. Seed Fictional Suppliers
  console.log("6. Seeding Fictional Suppliers...");
  const suppAirline = await prisma.supplier.upsert({
    where: { code: "SUPP-0001" },
    update: {},
    create: {
      code: "SUPP-0001",
      name: "Ariana Test Airline Carrier",
      type: "AIRLINE",
      contactPerson: "Carrier Ticketing Desk",
      email: "sales@ariana-test.af",
      phone: "+93 20 230 0000",
      currency: "USD",
      province: "Kabul",
      city: "Kabul",
    },
  });

  const suppHotel = await prisma.supplier.upsert({
    where: { code: "SUPP-0002" },
    update: {},
    create: {
      code: "SUPP-0002",
      name: "Kabul Serena Hospitality (Test Partner)",
      type: "HOTEL",
      contactPerson: "Reservations Manager",
      email: "reservations@serena-test.af",
      phone: "+93 20 222 3333",
      currency: "AFN",
      province: "Kabul",
      city: "Kabul",
    },
  });

  // 7. Seed Fictional Booking
  console.log("7. Seeding Fictional Booking & Service Items...");
  await prisma.booking.upsert({
    where: { bookingNumber: "BKG-2026-000001" },
    update: {},
    create: {
      bookingNumber: "BKG-2026-000001",
      customerId: custCorporate.id,
      createdById: agentUser.id,
      salesAgentId: agentUser.id,
      bookingDate: new Date("2026-03-01T08:00:00Z"),
      travelStartDate: new Date("2026-04-10T00:00:00Z"),
      travelEndDate: new Date("2026-04-20T00:00:00Z"),
      pnr: "PMR89K",
      supplierRef: "REF-KBL-DXB-01",
      status: "CONFIRMED",
      passengers: {
        create: [
          {
            title: "Mr",
            firstName: "Mohammad",
            lastName: "Qasim",
            nationality: "Afghan",
            passportNumber: "P0098231",
          },
          {
            title: "Eng",
            firstName: "Habibullah",
            lastName: "Wardak",
            nationality: "Afghan",
            passportNumber: "P0076124",
          },
        ],
      },
      serviceItems: {
        create: [
          {
            supplierId: suppAirline.id,
            serviceType: ServiceType.FLIGHT,
            description: "2x Return Air Tickets Kabul (KBL) to Dubai (DXB)",
            quantity: 2,
            currency: "USD",
            exchangeRate: new Decimal("70.00"),
            costPriceForeign: new Decimal("500.00"),
            costPrice: new Decimal("70000.00"),
            sellPriceForeign: new Decimal("650.00"),
            sellPrice: new Decimal("91000.00"),
            netSellingForeign: new Decimal("1300.00"),
            netSellingBase: new Decimal("91000.00"),
            marginAmount: new Decimal("21000.00"),
          },
          {
            supplierId: suppHotel.id,
            serviceType: ServiceType.HOTEL,
            description: "5 Nights Hotel Stay (Double Occupancy)",
            quantity: 5,
            currency: "AFN",
            exchangeRate: new Decimal("1.00"),
            costPrice: new Decimal("10000.00"),
            sellPrice: new Decimal("14000.00"),
            netSellingBase: new Decimal("14000.00"),
            marginAmount: new Decimal("4000.00"),
          },
        ],
      },
    },
  });

  console.log("✅ Safe Local Development Seed Completed Successfully!");
  console.log("--------------------------------------------------");
  console.log("Local Admin Credentials:");
  console.log("  Email: admin@voyageledger.af");
  console.log("  Pass : Admin@Local2026!");
  console.log("Local Travel Agent Credentials:");
  console.log("  Email: agent@voyageledger.af");
  console.log("  Pass : Agent@Local2026!");
  console.log("--------------------------------------------------");
}

main()
  .catch((e) => {
    console.error("❌ Error running local seed:", e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
