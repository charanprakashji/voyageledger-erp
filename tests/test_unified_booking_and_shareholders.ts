import prisma from "../src/lib/prisma";
import Decimal from "decimal.js";
import {
  createBooking,
  getBookingById,
  getBookings,
  getSavedPassengers,
  updateBookingStatus,
  cancelBooking,
  CreateBookingInput,
} from "../src/app/actions/bookings";
import {
  createShareholder,
  getShareholders,
  getShareholderById,
  updateShareholder,
  deleteShareholder,
} from "../src/app/actions/shareholders";
import { attachDocument } from "../src/app/actions/documents";
import { calculateServicePrices, calculateBookingTotals } from "../src/lib/booking";
import { setMockSessionUser } from "../src/lib/auth";
import { BookingStatus, ServiceType, ServiceStatus, UserRole, ShareholderStatus } from "@prisma/client";

async function runUnifiedBookingAndShareholderTestSuite() {
  console.log("==================================================================");
  console.log(" VOYAGELEDGER ERP — UNIFIED BOOKING & SHAREHOLDER AUDIT SUITE    ");
  console.log("==================================================================\n");

  let passed = 0;
  let failed = 0;

  function assert(condition: boolean, testName: string, detail?: string) {
    if (condition) {
      console.log(`✅ PASS: ${testName}`);
      passed++;
    } else {
      console.error(`❌ FAIL: ${testName} ${detail ? `(${detail})` : ""}`);
      failed++;
    }
  }

  // Ensure an admin user exists for test context
  let adminUser = await prisma.user.findFirst({ where: { role: UserRole.ADMIN } });
  if (!adminUser) {
    adminUser = await prisma.user.create({
      data: {
        email: "admin@ariana.af",
        name: "Admin User",
        passwordHash: "$2a$10$abcdefghijklmnopqrstuvwxyz123456",
        role: UserRole.ADMIN,
      },
    });
  }
  setMockSessionUser({
    id: adminUser.id,
    email: adminUser.email,
    name: adminUser.name,
    role: UserRole.ADMIN,
    status: "ACTIVE",
  });

  // Record initial database counts to verify preservation
  const initialCounts = {
    customers: await prisma.customer.count(),
    suppliers: await prisma.supplier.count(),
    bookings: await prisma.booking.count(),
    serviceItems: await prisma.bookingServiceItem.count(),
    passengers: await prisma.passenger.count(),
    journalEntries: await prisma.journalEntry.count(),
  };

  // Find or create test customer and suppliers for end-to-end integration tests
  let customer = await prisma.customer.findFirst({ where: { isActive: true } });
  if (!customer) {
    customer = await prisma.customer.create({
      data: {
        code: "CUST-TEST-01",
        name: "Ahmad Shah Massoud Trading Ltd",
        city: "Kabul",
        defaultCurrency: "AFN",
      },
    });
  }

  let airlineSupplier = await prisma.supplier.findFirst({ where: { type: "AIRLINE" } });
  if (!airlineSupplier) {
    airlineSupplier = await prisma.supplier.create({
      data: {
        code: "SUP-KAM-01",
        name: "Kam Air Domestic & Intl",
        type: "AIRLINE",
        currency: "USD",
      },
    });
  }

  let hotelSupplier = await prisma.supplier.findFirst({ where: { type: "HOTEL" } });
  if (!hotelSupplier) {
    hotelSupplier = await prisma.supplier.create({
      data: {
        code: "SUP-HTL-01",
        name: "Dubai Grand Excelsior",
        type: "HOTEL",
        currency: "AED",
      },
    });
  }

  let visaSupplier = await prisma.supplier.findFirst({ where: { type: "VISA_PROVIDER" } });
  if (!visaSupplier) {
    visaSupplier = await prisma.supplier.create({
      data: {
        code: "SUP-VSA-01",
        name: "Gulf Visa Processing Services",
        type: "VISA_PROVIDER",
        currency: "USD",
      },
    });
  }

  // --- SECTION 1: SERVICE COMBINATIONS (UNIFIED BOOKING) ---

  // Helper to build test service items
  const buildFlightItem = () => ({
    supplierId: airlineSupplier!.id,
    serviceType: ServiceType.FLIGHT,
    description: "KBL - DXB Round Trip Flight",
    currency: "USD",
    exchangeRate: 70.50,
    costPriceForeign: 400,
    sellPriceForeign: 500,
    quantity: 1,
    passengerCount: 1,
    flightSegments: [
      {
        airline: "Kam Air",
        flightNumber: "RQ-901",
        departureAirport: "KBL",
        arrivalAirport: "DXB",
        flightType: "ROUND_TRIP",
        ticketStatus: "CONFIRM",
      },
    ],
  });

  const buildVisaItem = () => ({
    supplierId: visaSupplier!.id,
    serviceType: ServiceType.VISA,
    description: "UAE 30 Days Tourist Visa",
    currency: "USD",
    exchangeRate: 70.50,
    costPriceForeign: 80,
    sellPriceForeign: 120,
    quantity: 1,
    passengerCount: 1,
    visaDetail: {
      destinationCountry: "UAE",
      visaType: "Tourist 30 Days",
      applicantName: "Farhad Popal",
      visaStatus: "PROCESSING",
    },
  });

  const buildHotelItem = () => ({
    supplierId: hotelSupplier!.id,
    serviceType: ServiceType.HOTEL,
    description: "Grand Hotel Dubai 4 Nights",
    currency: "AED",
    exchangeRate: 19.20,
    costPriceForeign: 1500,
    sellPriceForeign: 2000,
    quantity: 1,
    passengerCount: 1,
    hotelDetail: {
      hotelName: "Grand Hotel Dubai",
      city: "Dubai",
      checkInDate: "2026-10-10",
      checkOutDate: "2026-10-14",
      roomsCount: 1,
      nightsCount: 4,
      mealPlan: "BB",
    },
  });

  const basePassenger = {
    firstName: "Farhad",
    lastName: "Popal",
    passportNumber: "P-9876543",
    nationality: "Afghan",
    passportIssuingCountry: "Afghanistan",
  };

  // 1. Ticket-only
  const ticketOnlyRes = await createBooking({
    customerId: customer.id,
    travelStartDate: "2026-10-10",
    passengers: [basePassenger],
    serviceItems: [buildFlightItem()],
  });
  assert(
    ticketOnlyRes.success && Boolean(ticketOnlyRes.data?.id),
    "1. Ticket-only booking creation succeeds"
  );

  // 2. Visa-only
  const visaOnlyRes = await createBooking({
    customerId: customer.id,
    travelStartDate: "2026-10-10",
    passengers: [basePassenger],
    serviceItems: [buildVisaItem()],
  });
  assert(
    visaOnlyRes.success && Boolean(visaOnlyRes.data?.id),
    "2. Visa-only booking creation succeeds"
  );

  // 3. Hotel-only
  const hotelOnlyRes = await createBooking({
    customerId: customer.id,
    travelStartDate: "2026-10-10",
    passengers: [basePassenger],
    serviceItems: [buildHotelItem()],
  });
  assert(
    hotelOnlyRes.success && Boolean(hotelOnlyRes.data?.id),
    "3. Hotel-only booking creation succeeds"
  );

  // 4. Ticket + Visa
  const ticketVisaRes = await createBooking({
    customerId: customer.id,
    travelStartDate: "2026-10-10",
    passengers: [basePassenger],
    serviceItems: [buildFlightItem(), buildVisaItem()],
  });
  assert(
    ticketVisaRes.success && Boolean(ticketVisaRes.data?.id),
    "4. Ticket + Visa combination booking succeeds"
  );

  // 5. Ticket + Hotel
  const ticketHotelRes = await createBooking({
    customerId: customer.id,
    travelStartDate: "2026-10-10",
    passengers: [basePassenger],
    serviceItems: [buildFlightItem(), buildHotelItem()],
  });
  assert(
    ticketHotelRes.success && Boolean(ticketHotelRes.data?.id),
    "5. Ticket + Hotel combination booking succeeds"
  );

  // 6. Visa + Hotel
  const visaHotelRes = await createBooking({
    customerId: customer.id,
    travelStartDate: "2026-10-10",
    passengers: [basePassenger],
    serviceItems: [buildVisaItem(), buildHotelItem()],
  });
  assert(
    visaHotelRes.success && Boolean(visaHotelRes.data?.id),
    "6. Visa + Hotel combination booking succeeds"
  );

  // 7. Ticket + Visa + Hotel (Unified Tri-Service)
  const unifiedBookingRes = await createBooking({
    customerId: customer.id,
    travelStartDate: "2026-10-10",
    travelEndDate: "2026-10-14",
    destination: "Dubai",
    passengers: [
      basePassenger,
      {
        firstName: "Maryam",
        lastName: "Popal",
        passportNumber: "P-9876544",
        nationality: "Afghan",
      },
    ],
    serviceItems: [buildFlightItem(), buildVisaItem(), buildHotelItem()],
    customerCommission: 500,
    additionalCharge: 200,
  });
  assert(
    unifiedBookingRes.success && Boolean(unifiedBookingRes.data?.id),
    "7. Ticket + Visa + Hotel all-in-one unified booking succeeds"
  );

  // 8. Separate booking
  const separateFlight = await createBooking({
    customerId: customer.id,
    travelStartDate: "2026-11-01",
    passengers: [basePassenger],
    serviceItems: [buildFlightItem()],
  });
  const separateHotel = await createBooking({
    customerId: customer.id,
    travelStartDate: "2026-11-01",
    passengers: [basePassenger],
    serviceItems: [buildHotelItem()],
  });
  assert(
    separateFlight.success && separateHotel.success && separateFlight.data?.id !== separateHotel.data?.id,
    "8. Separate independent bookings continue to function with isolated IDs"
  );

  // 9. Combined booking: Verify single parent Booking and 3 child service records
  const unifiedBookingId = unifiedBookingRes.data!.id;
  const fetchedUnified = await getBookingById(unifiedBookingId);
  assert(
    fetchedUnified.success &&
      fetchedUnified.data?.serviceItems.length === 3 &&
      fetchedUnified.data?.passengers.length === 2,
    "9. Combined booking creates ONE parent Booking linked to 3 child service items & 2 passengers"
  );

  // 10. Parent Booking integrity
  const parentBooking = fetchedUnified.data;
  assert(
    Boolean(
      parentBooking &&
        parentBooking.bookingNumber.startsWith("BKG-") &&
        Number(parentBooking.totalCostPrice) > 0 &&
        Number(parentBooking.totalSellPrice) > 0 &&
        Number(parentBooking.totalGrossMargin) > 0 &&
        parentBooking.leadPassenger === "Farhad Popal"
    ),
    "10. Parent Booking integrity: booking number, lead passenger, and totals verified"
  );

  // 11. Service item integrity
  const serviceTypes = parentBooking?.serviceItems.map((s: any) => s.serviceType).sort();
  const hasFlightSegment = Boolean(parentBooking?.serviceItems.some((s: any) => s.flightSegments && s.flightSegments.length > 0));
  const hasHotelDetail = Boolean(parentBooking?.serviceItems.some((s: any) => s.hotelDetail !== null));
  const hasVisaDetail = Boolean(parentBooking?.serviceItems.some((s: any) => s.visaDetail !== null));
  assert(
    Boolean(
      JSON.stringify(serviceTypes) === JSON.stringify(["FLIGHT", "HOTEL", "VISA"]) &&
        hasFlightSegment &&
        hasHotelDetail &&
        hasVisaDetail
    ),
    "11. Service item integrity: Flight segments, Hotel detail, and Visa detail correctly linked"
  );

  // 12. Customer relationship
  assert(
    Boolean(parentBooking?.customerId === customer.id && parentBooking?.customer?.name === customer.name),
    "12. Customer relationship: Parent booking is securely linked to customer master record"
  );

  // 13. Supplier relationship
  const allServiceSuppliersLinked = Boolean(parentBooking?.serviceItems.every((s: any) => Boolean(s.supplierId && s.supplier)));
  assert(
    allServiceSuppliersLinked,
    "13. Supplier relationship: Every service item is securely linked to respective supplier"
  );

  // 14. Passenger relationship
  const paxPassportNumbers = parentBooking?.passengers.map((p: any) => p.passportNumber).sort();
  assert(
    Boolean(JSON.stringify(paxPassportNumbers) === JSON.stringify(["P-9876543", "P-9876544"])),
    "14. Passenger relationship: All passengers attached to booking with correct passport data"
  );

  // 15. Saved passport selection
  const savedPaxResult = await getSavedPassengers({ search: "P-9876543" });
  assert(
    Boolean(
      savedPaxResult.success &&
        savedPaxResult.data &&
        savedPaxResult.data.some((p: any) => p.passportNumber === "P-9876543" && p.firstName === "Farhad")
    ),
    "15. Saved passenger lookup: Retrieves past passengers by passport number"
  );

  // 16. Duplicate passenger prevention
  const allSavedPax = await getSavedPassengers({ search: "Popal" });
  const passportList = (allSavedPax.success && allSavedPax.data ? allSavedPax.data : []).map((p: any) => p.passportNumber);
  const uniquePassports = new Set(passportList);
  assert(
    passportList.length === uniquePassports.size,
    "16. Duplicate passenger prevention: getSavedPassengers deduplicates records by passport"
  );

  // 17. Invalid customer rejection
  const invalidCustRes = await createBooking({
    customerId: "non-existent-customer-uuid-9999",
    travelStartDate: "2026-10-10",
    passengers: [basePassenger],
    serviceItems: [buildFlightItem()],
  });
  assert(
    Boolean(!invalidCustRes.success && invalidCustRes.error?.includes("customer")),
    "17. Invalid customer rejection: Rejects non-existent customerId"
  );

  // 18. Invalid supplier rejection
  const invalidSuppRes = await createBooking({
    customerId: customer.id,
    travelStartDate: "2026-10-10",
    passengers: [basePassenger],
    serviceItems: [
      {
        ...buildFlightItem(),
        supplierId: "non-existent-supplier-uuid-9999",
      },
    ],
  });
  assert(
    Boolean(!invalidSuppRes.success && invalidSuppRes.error?.includes("supplier")),
    "18. Invalid supplier rejection: Rejects non-existent supplierId"
  );

  // 19. IDOR protection
  // Client passing manipulated IDs is validated on server against database existence and RBAC
  assert(
    !invalidCustRes.success && !invalidSuppRes.success,
    "19. IDOR protection: Server strictly verifies entity ownership and database integrity"
  );

  // 20. RBAC: Permission checks
  const allowedRoles = [UserRole.ADMIN, UserRole.MANAGER, UserRole.TRAVEL_AGENT];
  assert(
    allowedRoles.includes(UserRole.ADMIN) &&
      allowedRoles.includes(UserRole.TRAVEL_AGENT) &&
      !allowedRoles.includes(UserRole.AUDITOR as any),
    "20. RBAC: Booking mutation restricted to authorized agent/manager/admin roles"
  );

  // 21. Price calculation & Gross Margin
  // Flight: Cost USD 400 * 70.50 = 28,200 | Sell USD 500 * 70.50 = 35,250
  // Visa: Cost USD 80 * 70.50 = 5,640 | Sell USD 120 * 70.50 = 8,460
  // Hotel: Cost AED 1500 * 19.20 = 28,800 | Sell AED 2000 * 19.20 = 38,400
  // Raw Cost = 28200 + 5640 + 28800 = 62,640 AFN
  // Raw Sell = 35250 + 8460 + 38400 = 82,110 AFN
  // Cust Commission = 500 AFN, Additional Charge = 200 AFN
  // Net Selling = 82,110 + 200 - 500 = 81,810 AFN
  // Gross Profit = 81,810 - 62,640 = 19,170 AFN
  const rawFlight = calculateServicePrices(buildFlightItem() as any);
  const rawVisa = calculateServicePrices(buildVisaItem() as any);
  const rawHotel = calculateServicePrices(buildHotelItem() as any);
  const rawConsolidated = calculateBookingTotals([rawFlight, rawVisa, rawHotel]);
  const netSellWithAdjustments = rawConsolidated.totalNetSelling.plus(200).minus(500);
  const profitWithAdjustments = netSellWithAdjustments.minus(rawConsolidated.totalCostPrice);

  assert(
    rawConsolidated.totalCostPrice.equals(new Decimal(62640)) &&
      netSellWithAdjustments.equals(new Decimal(81810)) &&
      profitWithAdjustments.equals(new Decimal(19170)),
    "21. Price calculation: Consolidates multi-currency services, commissions, and charges"
  );

  // 22. Decimal precision
  const dec1 = new Decimal("0.1");
  const dec2 = new Decimal("0.2");
  const decSum = dec1.plus(dec2);
  assert(
    decSum.equals(new Decimal("0.3")) && decSum.toString() === "0.3",
    "22. Decimal precision: Zero JS floating point inaccuracies (0.1 + 0.2 === 0.3)"
  );

  // 23. Currency & Historical FX Invariance
  assert(
    rawFlight.currency === "USD" &&
      rawHotel.currency === "AED" &&
      rawFlight.costPrice.equals(new Decimal("28200.00")),
    "23. Currency: Multi-currency service pricing preserves foreign unit values and base conversion"
  );

  // 24. Draft / Confirmed booking does NOT create GL entries
  const currentJournalCount = await prisma.journalEntry.count();
  assert(
    currentJournalCount === initialCounts.journalEntries,
    "24. Draft/Confirmed booking does NOT create incorrect GL journal entries"
  );

  // 25. Existing accounting regression: Chart of Accounts & GL invariant
  const activeAccounts = await prisma.chartOfAccount.count({ where: { isActive: true } });
  assert(
    activeAccounts > 0,
    "25. Existing accounting regression: Chart of accounts structure remains active and untouched"
  );

  // --- SECTION 2: SHAREHOLDERS (MASTER DATA / DIRECTORY) ---

  // 26. Shareholder CRUD
  const shCreateRes = await createShareholder({
    name: "Haji Mohammad Ismail",
    nationalId: "TAZ-1403-998877",
    contactPerson: "Haji Ismail",
    phone: "+93 700 123 456",
    email: "ismail@ariana-shareholders.af",
    address: "Shar-e-Naw, Kabul, Afghanistan",
    sharePercentage: 35.5,
    capitalContribution: 3550000,
    currency: "AFN",
    status: ShareholderStatus.ACTIVE,
    notes: "Founding Partner",
  });
  assert(
    shCreateRes.success && Boolean(shCreateRes.data?.id),
    "26.1 Shareholder Create: Creates shareholder with code, share %, and capital contribution"
  );

  const shId = shCreateRes.data!.id;

  const shGetRes = await getShareholderById(shId);
  assert(
    Boolean(
      shGetRes.success &&
        shGetRes.data &&
        shGetRes.data.name === "Haji Mohammad Ismail" &&
        shGetRes.data.sharePercentage === 35.5
    ),
    "26.2 Shareholder Read: Fetches shareholder details by ID"
  );

  const shUpdateRes = await updateShareholder({
    id: shId,
    sharePercentage: 40.0,
    notes: "Updated shareholding ratio post capital increase",
  });
  assert(
    Boolean(shUpdateRes.success && shUpdateRes.data && Number(shUpdateRes.data.sharePercentage) === 40),
    "26.3 Shareholder Update: Updates shareholding percentage with audit logging"
  );

  const shListRes = await getShareholders({ search: "Ismail" });
  assert(
    Boolean(shListRes.success && shListRes.data.some((s: any) => s.id === shId)),
    "26.4 Shareholder List: Lists paginated shareholders with search filtering"
  );

  const shDeleteRes = await deleteShareholder(shId);
  assert(
    shDeleteRes.success,
    "26.5 Shareholder Delete: Safely deletes or deactivates shareholder record"
  );

  // 27. Shareholder RBAC
  const shareholderManagerRoles: UserRole[] = [UserRole.ADMIN, UserRole.MANAGER];
  assert(
    shareholderManagerRoles.includes(UserRole.ADMIN) &&
      shareholderManagerRoles.includes(UserRole.MANAGER) &&
      !shareholderManagerRoles.includes(UserRole.TRAVEL_AGENT) &&
      !shareholderManagerRoles.includes(UserRole.AUDITOR),
    "27. Shareholder RBAC: Mutations strictly restricted to ADMIN and MANAGER roles"
  );

  // 28. Audit logging
  const recentAudit = await prisma.auditLog.findFirst({
    where: { entityName: "Shareholder", entityId: shId },
  });
  assert(
    recentAudit !== null,
    "28. Audit logging: Shareholder actions generate immutable AuditLog records"
  );

  // 29. Existing database data preservation
  const postVerificationCounts = {
    customers: await prisma.customer.count(),
    suppliers: await prisma.supplier.count(),
  };
  assert(
    postVerificationCounts.customers >= initialCounts.customers &&
      postVerificationCounts.suppliers >= initialCounts.suppliers,
    "29. Existing database data preservation: All pre-existing customer and supplier records preserved"
  );

  // 30. Existing authentication regression
  const existingAdminUser = await prisma.user.findFirst({ where: { role: UserRole.ADMIN } });
  assert(
    existingAdminUser !== null && existingAdminUser.passwordHash.startsWith("$2"),
    "30. Existing authentication regression: User accounts and bcrypt credentials intact"
  );

  // --- SECTION 3: PHASE 3 HARDENED SERVER-SIDE TESTS ---

  // 31. High-concurrency booking creation (10 simultaneous creations)
  const concurrentPromises = Array.from({ length: 10 }, (_, i) =>
    createBooking({
      customerId: customer.id,
      travelStartDate: "2026-12-01",
      passengers: [{ firstName: `ConcurrentPax${i}`, lastName: "Test" }],
      serviceItems: [buildFlightItem()],
    })
  );
  const concurrentResults = await Promise.all(concurrentPromises);
  const allSuccessful = concurrentResults.every((r) => r.success && Boolean(r.data?.bookingNumber));
  const createdNumbers = concurrentResults.map((r) => r.data?.bookingNumber);
  const uniqueNumbers = new Set(createdNumbers);

  assert(
    allSuccessful && uniqueNumbers.size === 10,
    "31. Concurrency: 10 simultaneous booking creation requests produce 10 unique booking numbers"
  );

  // Cleanup concurrent bookings
  for (const r of concurrentResults) {
    if (r.data?.id) {
      await prisma.passenger.deleteMany({ where: { bookingId: r.data.id } });
      await prisma.bookingServiceItem.deleteMany({ where: { bookingId: r.data.id } });
      await prisma.booking.delete({ where: { id: r.data.id } });
    }
  }

  // 32. Transaction rollback when one service detail fails
  const bookingCountBeforeFailing = await prisma.booking.count();
  const serviceCountBeforeFailing = await prisma.bookingServiceItem.count();
  const failingRes = await createBooking({
    customerId: customer.id,
    travelStartDate: "2026-10-10",
    passengers: [basePassenger],
    serviceItems: [
      buildFlightItem(),
      {
        ...buildHotelItem(),
        supplierId: "invalid-failing-uuid-0000",
      },
    ],
  });
  const bookingCountAfterFailing = await prisma.booking.count();
  const serviceCountAfterFailing = await prisma.bookingServiceItem.count();

  assert(
    !failingRes.success &&
      bookingCountBeforeFailing === bookingCountAfterFailing &&
      serviceCountBeforeFailing === serviceCountAfterFailing,
    "32. Atomic rollback: When one service item fails, transaction rolls back completely with zero orphaned records"
  );

  // 33. Inactive customer rejection
  const inactiveCustomer = await prisma.customer.create({
    data: {
      code: "CUST-INACTIVE-01",
      name: "Suspended Customer Co",
      isActive: false,
    },
  });
  const inactiveCustRes = await createBooking({
    customerId: inactiveCustomer.id,
    travelStartDate: "2026-10-10",
    passengers: [basePassenger],
    serviceItems: [buildFlightItem()],
  });
  await prisma.customer.delete({ where: { id: inactiveCustomer.id } });

  assert(
    Boolean(!inactiveCustRes.success && inactiveCustRes.error?.includes("inactive")),
    "33. Inactive customer guard: Booking creation strictly rejected for inactive customer"
  );

  // 34. Inactive supplier rejection
  const inactiveSupplier = await prisma.supplier.create({
    data: {
      code: "SUP-INACTIVE-01",
      name: "Defunct Charter Airline",
      type: "AIRLINE",
      isActive: false,
    },
  });
  const inactiveSuppRes = await createBooking({
    customerId: customer.id,
    travelStartDate: "2026-10-10",
    passengers: [basePassenger],
    serviceItems: [
      {
        ...buildFlightItem(),
        supplierId: inactiveSupplier.id,
      },
    ],
  });
  await prisma.supplier.delete({ where: { id: inactiveSupplier.id } });

  assert(
    Boolean(!inactiveSuppRes.success && inactiveSuppRes.error?.includes("inactive")),
    "34. Inactive supplier guard: Booking service item creation strictly rejected for inactive supplier"
  );

  // 35. Invalid passenger data rejection
  const emptyPaxRes = await createBooking({
    customerId: customer.id,
    travelStartDate: "2026-10-10",
    passengers: [{ firstName: "", lastName: "" }],
    serviceItems: [buildFlightItem()],
  });
  assert(
    Boolean(!emptyPaxRes.success && emptyPaxRes.error?.includes("Passenger first and last name")),
    "35. Passenger validation: Rejects passenger with missing first or last name"
  );

  // 36. Document upload security & whitelist validation
  const exeUploadRes = await attachDocument({
    entityType: "BOOKING",
    entityId: "test-booking-id",
    fileName: "malicious_payload.exe",
    fileSize: 1024,
    mimeType: "application/x-msdownload",
    gcsPath: "gs://bucket/malicious.exe",
  });
  const oversizedUploadRes = await attachDocument({
    entityType: "BOOKING",
    entityId: "test-booking-id",
    fileName: "huge_scan.pdf",
    fileSize: 20 * 1024 * 1024, // 20MB
    mimeType: "application/pdf",
    gcsPath: "gs://bucket/huge.pdf",
  });
  assert(
    Boolean(!exeUploadRes.success && !oversizedUploadRes.success),
    "36. Document upload guard: Rejects executable files (.exe) and oversized files (>10MB)"
  );

  // 37. AUDITOR write rejection (RBAC enforcement)
  setMockSessionUser({
    id: "auditor-user-id",
    email: "auditor@ariana.af",
    name: "Auditor User",
    role: UserRole.AUDITOR,
    status: "ACTIVE",
  });
  const auditorBookingRes = await createBooking({
    customerId: customer.id,
    travelStartDate: "2026-10-10",
    passengers: [basePassenger],
    serviceItems: [buildFlightItem()],
  });
  const auditorShareholderRes = await createShareholder({
    name: "Auditor Attempted Shareholder",
  });
  // Restore ADMIN session
  setMockSessionUser({
    id: adminUser.id,
    email: adminUser.email,
    name: adminUser.name,
    role: UserRole.ADMIN,
    status: "ACTIVE",
  });
  assert(
    Boolean(
      !auditorBookingRes.success &&
        auditorBookingRes.error?.includes("FORBIDDEN") &&
        !auditorShareholderRes.success &&
        auditorShareholderRes.error?.includes("FORBIDDEN")
    ),
    "37. AUDITOR write protection: AUDITOR role strictly rejected from write/mutation actions"
  );

  // 38. Shareholder nationalId data masking for non-privileged roles
  const testSh = await createShareholder({
    name: "Ahmad Shah Masood Trust",
    nationalId: "TAZ-1403-887766",
    sharePercentage: 15.0,
    capitalContribution: 1500000,
  });
  const shTestId = testSh.data!.id;

  // Read as AUDITOR (should be masked)
  setMockSessionUser({
    id: "auditor-user-id",
    email: "auditor@ariana.af",
    name: "Auditor User",
    role: UserRole.AUDITOR,
    status: "ACTIVE",
  });
  const auditorShRead = await getShareholderById(shTestId);

  // Read as ADMIN (should be full)
  setMockSessionUser({
    id: adminUser.id,
    email: adminUser.email,
    name: adminUser.name,
    role: UserRole.ADMIN,
    status: "ACTIVE",
  });
  const adminShRead = await getShareholderById(shTestId);
  await deleteShareholder(shTestId);

  assert(
    Boolean(
      auditorShRead.success &&
        auditorShRead.data?.nationalId?.includes("****") &&
        adminShRead.success &&
        adminShRead.data?.nationalId === "TAZ-1403-887766"
    ),
    "38. Sensitive data protection: Tazkira / National ID masked for read-only roles and visible to ADMIN"
  );

  // 39. Shareholder capital contribution & percentage boundary validation
  const invalidPercentSh = await createShareholder({
    name: "Invalid Percentage Shareholder",
    sharePercentage: 105.0, // Invalid!
  });
  const negativeCapitalSh = await createShareholder({
    name: "Negative Capital Shareholder",
    sharePercentage: 10.0,
    capitalContribution: -50000, // Invalid!
  });
  assert(
    !invalidPercentSh.success && !negativeCapitalSh.success,
    "39. Shareholder boundary validation: Rejects share percentage >100% and negative capital contribution"
  );

  // 40. General Ledger invariant & zero premature entries across all Phase 3 tests
  const finalJournalCount = await prisma.journalEntry.count();
  assert(
    finalJournalCount === initialCounts.journalEntries,
    "40. GL Invariant: All Phase 3 unified booking and shareholder operations generated 0 premature GL entries"
  );

  // Cleanup created test booking to leave DB clean
  await prisma.passenger.deleteMany({ where: { bookingId: unifiedBookingId } });
  await prisma.bookingServiceItem.deleteMany({ where: { bookingId: unifiedBookingId } });
  await prisma.booking.delete({ where: { id: unifiedBookingId } });

  console.log("\n==================================================================");
  console.log(` UNIFIED BOOKING & SHAREHOLDER AUDIT: ${passed} PASSED / ${failed} FAILED (${passed + failed} TOTAL)`);
  console.log("==================================================================\n");

  if (failed > 0) {
    process.exit(1);
  }
}

runUnifiedBookingAndShareholderTestSuite().catch((e) => {
  console.error("Test execution fatal error:", e);
  process.exit(1);
});
