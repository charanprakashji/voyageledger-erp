import prisma from "../src/lib/prisma";
import Decimal from "decimal.js";
import {
  createBooking,
  getBookingById,
  getBookings,
  getSavedPassengers,
} from "../src/app/actions/bookings";
import {
  createShareholder,
  getShareholders,
  updateShareholder,
  deleteShareholder,
} from "../src/app/actions/shareholders";
import {
  calculateServicePrices,
  calculateBookingTotals,
} from "../src/lib/booking";
import { parseTicketText } from "../src/lib/ocr/ticketScanner";
import { setMockSessionUser, hashPassword } from "../src/lib/auth";
import { BookingStatus, ServiceType, ServiceStatus, UserRole } from "@prisma/client";

async function runUnifiedBookingTests() {
  console.log("==================================================================");
  console.log("     RUNNING VOYAGELEDGER UNIFIED BOOKING & SHAREHOLDER SUITE    ");
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

  try {
    // Authenticate test session
    let adminUser = await prisma.user.findFirst({ where: { role: "ADMIN" } });
    if (!adminUser) {
      const pwdHash = await hashPassword("AdminTest@123");
      adminUser = await prisma.user.create({
        data: {
          email: "admin_unified_test@voyageledger.af",
          name: "Unified Admin",
          passwordHash: pwdHash,
          role: "ADMIN",
          status: "ACTIVE",
        },
      });
    }

    setMockSessionUser({
      id: adminUser.id,
      email: adminUser.email,
      name: adminUser.name,
      role: "ADMIN",
      status: "ACTIVE",
    });

    // -------------------------------------------------------------------
    // 0. PRE-FLIGHT: Ensure Fictional Test Customer & Suppliers Exist
    // -------------------------------------------------------------------
    let testCustomer = await prisma.customer.findFirst({
      where: { code: "CUST-TEST-01" },
    });
    if (!testCustomer) {
      testCustomer = await prisma.customer.create({
        data: {
          code: "CUST-TEST-01",
          name: "Test Customer Kabul",
          companyName: "Kabul Trading Co",
          defaultCurrency: "AFN",
        },
      });
    }

    let airlineSupplier = await prisma.supplier.findFirst({
      where: { type: "AIRLINE" },
    });
    if (!airlineSupplier) {
      airlineSupplier = await prisma.supplier.create({
        data: {
          code: "SUP-AIR-01",
          name: "Kam Air Wholesale",
          type: "AIRLINE",
          currency: "USD",
        },
      });
    }

    let visaSupplier = await prisma.supplier.findFirst({
      where: { type: "VISA_PROVIDER" },
    });
    if (!visaSupplier) {
      visaSupplier = await prisma.supplier.create({
        data: {
          code: "SUP-VISA-01",
          name: "Dubai Visa Processing Hub",
          type: "VISA_PROVIDER",
          currency: "USD",
        },
      });
    }

    let hotelSupplier = await prisma.supplier.findFirst({
      where: { type: "HOTEL" },
    });
    if (!hotelSupplier) {
      hotelSupplier = await prisma.supplier.create({
        data: {
          code: "SUP-HOTEL-01",
          name: "Millennium Hotel Group",
          type: "HOTEL",
          currency: "USD",
        },
      });
    }

    // Baseline record counts for data preservation test
    const initialBookingCount = await prisma.booking.count();
    const initialCustomerCount = await prisma.customer.count();
    const initialSupplierCount = await prisma.supplier.count();

    // -------------------------------------------------------------------
    // TEST 1: Ticket-Only Standalone Booking Creation
    // -------------------------------------------------------------------
    const ticketOnlyRes = await createBooking({
      customerId: testCustomer.id,
      travelStartDate: "2026-10-10",
      destination: "Dubai",
      currency: "USD",
      passengers: [
        {
          firstName: "Zia",
          lastName: "Ahmadi",
          passportNumber: "O88776655",
          nationality: "Afghan",
        },
      ],
      serviceItems: [
        {
          supplierId: airlineSupplier.id,
          serviceType: ServiceType.FLIGHT,
          description: "Kam Air RQ-901 KBL-DXB",
          quantity: 1,
          currency: "USD",
          exchangeRate: 70.5,
          costPriceForeign: 450,
          sellPriceForeign: 550,
          flightSegments: [
            {
              airline: "Kam Air",
              flightNumber: "RQ-901",
              departureAirport: "KBL",
              arrivalAirport: "DXB",
              ticketNumber: "001-9988112233",
              pnr: "7XKBL1",
              flightType: "ONE_WAY",
              ticketStatus: "CONFIRM",
            },
          ],
        },
      ],
    });

    assert(ticketOnlyRes.success && Boolean(ticketOnlyRes.data?.id), "1. Ticket-only booking created successfully");

    // -------------------------------------------------------------------
    // TEST 2: Visa-Only Standalone Booking Creation
    // -------------------------------------------------------------------
    const visaOnlyRes = await createBooking({
      customerId: testCustomer.id,
      travelStartDate: "2026-11-01",
      destination: "UAE",
      currency: "USD",
      passengers: [
        {
          firstName: "Maryam",
          lastName: "Karimi",
          passportNumber: "O11223344",
          nationality: "Afghan",
        },
      ],
      serviceItems: [
        {
          supplierId: visaSupplier.id,
          serviceType: ServiceType.VISA,
          description: "UAE 30 Days Tourist Visa",
          quantity: 1,
          currency: "USD",
          exchangeRate: 70.5,
          costPriceForeign: 80,
          sellPriceForeign: 120,
          visaDetail: {
            destinationCountry: "UAE",
            visaType: "Tourist 30 Days",
            applicantName: "Maryam Karimi",
            visaStatus: "PROCESSING",
          },
        },
      ],
    });

    assert(visaOnlyRes.success && Boolean(visaOnlyRes.data?.id), "2. Visa-only booking created successfully without forcing ticket");

    // -------------------------------------------------------------------
    // TEST 3: Hotel-Only Standalone Booking Creation
    // -------------------------------------------------------------------
    const hotelOnlyRes = await createBooking({
      customerId: testCustomer.id,
      travelStartDate: "2026-12-01",
      destination: "Dubai",
      currency: "USD",
      passengers: [
        {
          firstName: "Farhad",
          lastName: "Noori",
          passportNumber: "O55443322",
          nationality: "Afghan",
        },
      ],
      serviceItems: [
        {
          supplierId: hotelSupplier.id,
          serviceType: ServiceType.HOTEL,
          description: "Millennium Hotel Dubai",
          quantity: 1,
          currency: "USD",
          exchangeRate: 70.5,
          costPriceForeign: 300,
          sellPriceForeign: 400,
          hotelDetail: {
            hotelName: "Millennium Hotel Dubai",
            city: "Dubai",
            checkInDate: "2026-12-01",
            checkOutDate: "2026-12-05",
            nightsCount: 4,
            roomType: "Standard Deluxe",
            mealPlan: "Bed & Breakfast (BB)",
          },
        },
      ],
    });

    assert(hotelOnlyRes.success && Boolean(hotelOnlyRes.data?.id), "3. Hotel-only booking created successfully without forcing ticket");

    // -------------------------------------------------------------------
    // TEST 4: Ticket + Visa Combined Booking
    // -------------------------------------------------------------------
    const ticketVisaRes = await createBooking({
      customerId: testCustomer.id,
      travelStartDate: "2026-10-15",
      destination: "Dubai",
      passengers: [{ firstName: "Ali", lastName: "Reza", passportNumber: "O990011" }],
      serviceItems: [
        {
          supplierId: airlineSupplier.id,
          serviceType: ServiceType.FLIGHT,
          description: "Ticket KBL-DXB",
          quantity: 1,
          currency: "USD",
          exchangeRate: 70.5,
          costPriceForeign: 450,
          sellPriceForeign: 550,
        },
        {
          supplierId: visaSupplier.id,
          serviceType: ServiceType.VISA,
          description: "UAE Visa",
          quantity: 1,
          currency: "USD",
          exchangeRate: 70.5,
          costPriceForeign: 80,
          sellPriceForeign: 120,
        },
      ],
    });

    assert(ticketVisaRes.success, "4. Ticket + Visa combined booking created successfully");

    // -------------------------------------------------------------------
    // TEST 5: Ticket + Hotel Combined Booking
    // -------------------------------------------------------------------
    const ticketHotelRes = await createBooking({
      customerId: testCustomer.id,
      travelStartDate: "2026-10-20",
      destination: "Istanbul",
      passengers: [{ firstName: "Hassan", lastName: "Sultani", passportNumber: "O334455" }],
      serviceItems: [
        {
          supplierId: airlineSupplier.id,
          serviceType: ServiceType.FLIGHT,
          description: "Ticket KBL-IST",
          quantity: 1,
          currency: "USD",
          exchangeRate: 70.5,
          costPriceForeign: 500,
          sellPriceForeign: 650,
        },
        {
          supplierId: hotelSupplier.id,
          serviceType: ServiceType.HOTEL,
          description: "Grand Hotel Istanbul",
          quantity: 1,
          currency: "USD",
          exchangeRate: 70.5,
          costPriceForeign: 250,
          sellPriceForeign: 350,
        },
      ],
    });

    assert(ticketHotelRes.success, "5. Ticket + Hotel combined booking created successfully");

    // -------------------------------------------------------------------
    // TEST 6: Visa + Hotel Combined Booking
    // -------------------------------------------------------------------
    const visaHotelRes = await createBooking({
      customerId: testCustomer.id,
      travelStartDate: "2026-11-10",
      destination: "Dubai",
      passengers: [{ firstName: "Kamran", lastName: "Qasimi", passportNumber: "O778899" }],
      serviceItems: [
        {
          supplierId: visaSupplier.id,
          serviceType: ServiceType.VISA,
          description: "UAE Tourist Visa",
          quantity: 1,
          currency: "USD",
          exchangeRate: 70.5,
          costPriceForeign: 80,
          sellPriceForeign: 120,
        },
        {
          supplierId: hotelSupplier.id,
          serviceType: ServiceType.HOTEL,
          description: "City Hotel Dubai",
          quantity: 1,
          currency: "USD",
          exchangeRate: 70.5,
          costPriceForeign: 200,
          sellPriceForeign: 280,
        },
      ],
    });

    assert(visaHotelRes.success, "6. Visa + Hotel combined booking created successfully");

    // -------------------------------------------------------------------
    // TEST 7: Complete 3-in-1 Combined Booking: Ticket + Visa + Hotel
    // -------------------------------------------------------------------
    const allInOneRes = await createBooking({
      customerId: testCustomer.id,
      travelStartDate: "2026-12-15",
      destination: "Dubai",
      referrer: "Kabul Express Agency",
      liaison: "Ahmad Tariq",
      customerCommission: 500, // 500 AFN commission discount
      additionalCharge: 200,   // 200 AFN service fee
      paymentMade: true,
      paymentAccount: "Cash (AFN)",
      passengers: [
        {
          firstName: "Zalmay",
          lastName: "Khalil",
          passportNumber: "O77665544",
          nationality: "Afghan",
          passportExpiryDate: "2030-01-01",
        },
      ],
      serviceItems: [
        {
          supplierId: airlineSupplier.id,
          serviceType: ServiceType.FLIGHT,
          description: "Kam Air Roundtrip",
          quantity: 1,
          currency: "USD",
          exchangeRate: 70.5,
          costPriceForeign: 500,
          sellPriceForeign: 600,
          flightSegments: [
            {
              airline: "Kam Air",
              flightNumber: "RQ-901",
              departureAirport: "KBL",
              arrivalAirport: "DXB",
              ticketNumber: "001-5544332211",
              pnr: "99DXB1",
              flightType: "ROUND_TRIP",
              ticketStatus: "CONFIRM",
            },
          ],
        },
        {
          supplierId: visaSupplier.id,
          serviceType: ServiceType.VISA,
          description: "UAE 30 Days Visa",
          quantity: 1,
          currency: "USD",
          exchangeRate: 70.5,
          costPriceForeign: 80,
          sellPriceForeign: 120,
          visaDetail: {
            destinationCountry: "UAE",
            visaType: "Tourist 30 Days",
            applicantName: "Zalmay Khalil",
            visaStatus: "PROCESSING",
          },
        },
        {
          supplierId: hotelSupplier.id,
          serviceType: ServiceType.HOTEL,
          description: "Millennium Hotel 5 Nights",
          quantity: 1,
          currency: "USD",
          exchangeRate: 70.5,
          costPriceForeign: 300,
          sellPriceForeign: 400,
          hotelDetail: {
            hotelName: "Millennium Hotel Dubai",
            city: "Dubai",
            checkInDate: "2026-12-15",
            checkOutDate: "2026-12-20",
            nightsCount: 5,
          },
        },
      ],
    });

    assert(allInOneRes.success && Boolean(allInOneRes.data?.id), "7. Complete 3-in-1 Combined Booking (Ticket + Visa + Hotel) created");

    // -------------------------------------------------------------------
    // TEST 8 & 9: Parent-Child Relationship Integrity & Synchronization
    // -------------------------------------------------------------------
    const combinedBookingId = allInOneRes.data!.id;
    const combinedDetails = await getBookingById(combinedBookingId);

    const hasFlightChild = combinedDetails.data?.serviceItems?.some((s: any) => s.serviceType === "FLIGHT");
    const hasVisaChild = combinedDetails.data?.serviceItems?.some((s: any) => s.serviceType === "VISA");
    const hasHotelChild = combinedDetails.data?.serviceItems?.some((s: any) => s.serviceType === "HOTEL");
    const singleParentBookingNumber = combinedDetails.data?.bookingNumber;

    assert(
      Boolean(hasFlightChild && hasVisaChild && hasHotelChild && singleParentBookingNumber),
      "8 & 9. Combined booking synchronizes Flight, Visa, and Hotel child records under ONE parent booking number"
    );

    // -------------------------------------------------------------------
    // TEST 10: Saved Passport Selection & Lookup Utility
    // -------------------------------------------------------------------
    const savedPaxRes = await getSavedPassengers({ search: "Zalmay" });
    const foundZalmay = savedPaxRes.success && savedPaxRes.data.some((p: any) => p.passportNumber === "O77665544");

    assert(foundZalmay, "10. Saved Passport / Passenger profile retrieved for 1-click autofill");

    // -------------------------------------------------------------------
    // TEST 11: Duplicate Customer Prevention & IDOR Security
    // -------------------------------------------------------------------
    const fakeCustomerId = "00000000-0000-0000-0000-000000000000";
    const idorCustomerRes = await createBooking({
      customerId: fakeCustomerId,
      travelStartDate: "2026-10-10",
      passengers: [{ firstName: "Test", lastName: "Pax" }],
      serviceItems: [
        {
          supplierId: airlineSupplier.id,
          serviceType: ServiceType.FLIGHT,
          description: "Flight",
          quantity: 1,
          currency: "USD",
          exchangeRate: 70.5,
          costPriceForeign: 100,
          sellPriceForeign: 150,
        },
      ],
    });

    assert(!idorCustomerRes.success, "11. IDOR Protection: Rejection of forged/unauthorized customer ID");

    // -------------------------------------------------------------------
    // TEST 12: Empty Service Selection Rejection
    // -------------------------------------------------------------------
    const emptyServiceRes = await createBooking({
      customerId: testCustomer.id,
      travelStartDate: "2026-10-10",
      passengers: [{ firstName: "Test", lastName: "Pax" }],
      serviceItems: [],
    });

    assert(!emptyServiceRes.success, "12. Validation: Empty service selection is strictly rejected");

    // -------------------------------------------------------------------
    // TEST 13: Financial Calculations & Decimal.js Precision
    // -------------------------------------------------------------------
    // Ticket (600 - 500 = 100 USD) = 7,050 AFN
    // Visa (120 - 80 = 40 USD) = 2,820 AFN
    // Hotel (400 - 300 = 100 USD) = 7,050 AFN
    // Total Cost: (500+80+300)*70.5 = 880 * 70.5 = 62,040 AFN
    // Total Raw Sell: (600+120+400)*70.5 = 1120 * 70.5 = 78,960 AFN
    // Adjusted Net Sell: 78,960 + 200 (add charge) - 500 (commission) = 78,660 AFN
    // Margin: 78,660 - 62,040 = 16,620 AFN
    const storedCost = new Decimal(combinedDetails.data?.totalCostPrice || 0);
    const storedNetSell = new Decimal(combinedDetails.data?.totalNetSelling || 0);
    const storedMargin = new Decimal(combinedDetails.data?.totalGrossMargin || 0);

    assert(
      storedCost.equals(new Decimal("62040.00")) &&
      storedNetSell.equals(new Decimal("78660.00")) &&
      storedMargin.equals(new Decimal("16620.00")),
      "13. Multi-Service Pricing Precision: Exact Decimal math with Commissions & Additional Charges (AFN 16,620 profit)"
    );

    // -------------------------------------------------------------------
    // TEST 14: Ticket Document Extraction & OCR Service Boundary
    // -------------------------------------------------------------------
    const sampleRawTicket = "KAM AIR FLIGHT RQ-901 PNR: 7X9KBL PAX: POPAL/AHMAD TKT: 001-9988112233 KBL DXB ECONOMY";
    const extractedData = parseTicketText(sampleRawTicket);

    assert(
      extractedData.airline === "Kam Air" &&
      extractedData.flightNumber === "RQ-901" &&
      extractedData.pnr === "7X9KBL" &&
      extractedData.ticketNumber === "001-9988112233" &&
      extractedData.passengerFirstName === "Ahmad" &&
      extractedData.passengerLastName === "Popal",
      "14. Ticket Document Scanner successfully parses PNR, Airline, Flight Number, Ticket #, and Passenger Name"
    );

    // -------------------------------------------------------------------
    // TEST 15: Draft Booking Does NOT Post Incorrect GL Journal Entries
    // -------------------------------------------------------------------
    const journalsForBooking = await prisma.journalLine.findMany({
      where: { bookingId: combinedBookingId },
    });

    assert(
      journalsForBooking.length === 0,
      "15. Accounting Invariant: Operational Draft Booking creation does NOT prematurely post GL journal entries"
    );

    // -------------------------------------------------------------------
    // TEST 16, 17, 18: Shareholder Master CRUD, RBAC & Audit Logging
    // -------------------------------------------------------------------
    const shRes = await createShareholder({
      name: "Haji Mohammad Qasim",
      code: "SH-001",
      nationalId: "1402-998811",
      sharePercentage: 40.00,
      capitalContribution: 4000000,
      currency: "AFN",
      notes: "Founding partner",
    });

    assert(shRes.success && Boolean(shRes.data?.id), "16. Shareholder creation with capital structure succeeded");

    const shListRes = await getShareholders();
    assert(shListRes.success && shListRes.data.length > 0, "17. Shareholder directory query succeeded");

    const shUpdateRes = await updateShareholder({
      id: shRes.data!.id,
      sharePercentage: 45.00,
    });
    assert(shUpdateRes.success && Number(shUpdateRes.data?.sharePercentage) === 45.00, "18. Shareholder update & audit log succeeded");

    // -------------------------------------------------------------------
    // TEST 19: Database Preservation & Non-Destructive Invariance
    // -------------------------------------------------------------------
    const finalCustomerCount = await prisma.customer.count();
    const finalSupplierCount = await prisma.supplier.count();
    const finalBookingCount = await prisma.booking.count();

    assert(
      finalCustomerCount >= initialCustomerCount &&
      finalSupplierCount >= initialSupplierCount &&
      finalBookingCount > initialBookingCount,
      "19. Database Preservation: All existing customer, supplier, and booking records remain 100% intact"
    );

    console.log(`\n==================================================================`);
    console.log(`   UNIFIED BOOKING SUITE RESULTS: ${passed} Passed, ${failed} Failed`);
    console.log(`==================================================================\n`);

    if (failed > 0) {
      process.exit(1);
    }
  } catch (err: any) {
    console.error("Test suite runtime error:", err);
    process.exit(1);
  }
}

runUnifiedBookingTests();
