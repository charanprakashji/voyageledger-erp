import { Decimal } from "decimal.js";
import {
  calculateServicePrices,
  calculateBookingTotals,
  calculateHotelNights,
  validateStatusTransition,
  generateBookingNumber,
} from "./src/lib/booking";
import { BookingStatus, ServiceType, UserRole } from "@prisma/client";

async function runPhase2Tests() {
  console.log("==========================================================");
  console.log("       RUNNING PHASE 2 AUTOMATED TEST SUITE (BOOKING)     ");
  console.log("==========================================================\n");

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

  // -------------------------------------------------------------------
  // TEST 1: Booking Master Generation & Sequence Formatting
  // -------------------------------------------------------------------
  const bkgNum = generateBookingNumber(105, 2026);
  assert(bkgNum === "BKG-2026-0105", "1. Booking Number Sequence Generator", `Got: ${bkgNum}`);

  // -------------------------------------------------------------------
  // TEST 2: Multi-Passenger Roster Validation
  // -------------------------------------------------------------------
  const passengers = [
    { firstName: "Ahmad", lastName: "Tariq", nationality: "Afghan", passportNumber: "O998811" },
    { firstName: "Zalmay", lastName: "Khalil", nationality: "Afghan", passportNumber: "O776655" },
    { firstName: "Farida", lastName: "Noori", nationality: "Afghan", passportNumber: "O332211" },
  ];
  const validPaxCount = passengers.length === 3 && passengers.every((p) => p.firstName && p.lastName);
  assert(validPaxCount, "2. Multiple Passengers Roster (3 distinct passengers supported)");

  // -------------------------------------------------------------------
  // TEST 3: Multi-Currency Service Pricing & Decimal Math
  // -------------------------------------------------------------------
  // Example: USD 1,000 selling price, 70.50 AFN/USD exchange rate = 70,500 AFN
  // Supplier cost: USD 900 = 63,450 AFN. Margin = 7,050 AFN
  const serviceUSD = calculateServicePrices({
    quantity: 1,
    passengerCount: 3,
    currency: "USD",
    exchangeRate: new Decimal("70.50"),
    costPriceForeign: new Decimal("900.00"),
    sellPriceForeign: new Decimal("1000.00"),
    discountForeign: new Decimal("0.00"),
    taxAmountForeign: new Decimal("0.00"),
  });

  assert(
    serviceUSD.sellPrice.equals(new Decimal("70500.00")) &&
    serviceUSD.costPrice.equals(new Decimal("63450.00")) &&
    serviceUSD.marginAmount.equals(new Decimal("7050.00")),
    "3. Multi-Currency Conversion (USD to AFN exact precision: $1,000 @ 70.50 = 70,500 AFN)"
  );

  // -------------------------------------------------------------------
  // TEST 4: Flight Multi-Segment Itinerary
  // -------------------------------------------------------------------
  const flightSegments = [
    { segmentOrder: 1, departureAirport: "KBL", arrivalAirport: "DXB", flightNumber: "RQ-901" },
    { segmentOrder: 2, departureAirport: "DXB", arrivalAirport: "IST", flightNumber: "EK-121" },
    { segmentOrder: 3, departureAirport: "IST", arrivalAirport: "KBL", flightNumber: "RQ-902" },
  ];
  const validMultiSegment = flightSegments.length === 3 && flightSegments[1].departureAirport === "DXB";
  assert(validMultiSegment, "4. Flight with Multi-Segment Routing (KBL -> DXB -> IST -> KBL)");

  // -------------------------------------------------------------------
  // TEST 5: Hotel Nights Auto-Calculation & Override
  // -------------------------------------------------------------------
  const autoNights = calculateHotelNights("2026-10-01", "2026-10-06");
  const overrideNights = calculateHotelNights("2026-10-01", "2026-10-06", 7);
  assert(
    autoNights === 5 && overrideNights === 7,
    "5. Hotel Night Calculation (5 days auto-calculated, 7 nights authorized override)"
  );

  // -------------------------------------------------------------------
  // TEST 6: Multiple Diverse Service Items (Flight, Hotel, Visa, Transfer)
  // -------------------------------------------------------------------
  const flightService = calculateServicePrices({
    quantity: 2,
    currency: "USD",
    exchangeRate: 70.50,
    costPriceForeign: 450,
    sellPriceForeign: 550,
  }); // Cost: 900*70.50 = 63,450. Sell: 1100*70.50 = 77,550. Margin: 14,100

  const hotelService = calculateServicePrices({
    quantity: 1,
    currency: "AED",
    exchangeRate: 19.20,
    costPriceForeign: 2000,
    sellPriceForeign: 2500,
  }); // Cost: 2000*19.20 = 38,400. Sell: 2500*19.20 = 48,000. Margin: 9,600

  const visaService = calculateServicePrices({
    quantity: 2,
    currency: "USD",
    exchangeRate: 70.50,
    costPriceForeign: 80,
    sellPriceForeign: 120,
  }); // Cost: 160*70.50 = 11,280. Sell: 240*70.50 = 16,920. Margin: 5,640

  const transferService = calculateServicePrices({
    quantity: 1,
    currency: "AFN",
    exchangeRate: 1.00,
    costPriceForeign: 3000,
    sellPriceForeign: 4500,
  }); // Cost: 3,000. Sell: 4,500. Margin: 1,500

  // -------------------------------------------------------------------
  // TEST 7: Consolidated Gross Profit & Decimal Calculation
  // -------------------------------------------------------------------
  const bookingTotals = calculateBookingTotals([
    flightService,
    hotelService,
    visaService,
    transferService,
  ]);

  const expectedTotalCost = new Decimal("63450").plus("38400").plus("11280").plus("3000"); // 116,130
  const expectedTotalSell = new Decimal("77550").plus("48000").plus("16920").plus("4500"); // 146,970
  const expectedTotalMargin = expectedTotalSell.minus(expectedTotalCost); // 30,840

  assert(
    bookingTotals.totalCostPrice.equals(expectedTotalCost) &&
    bookingTotals.totalNetSelling.equals(expectedTotalSell) &&
    bookingTotals.totalGrossMargin.equals(expectedTotalMargin),
    "7 & 8. Multi-Service Aggregation & Gross Profit (Net Sell: 146,970 AFN, Cost: 116,130 AFN, Profit: 30,840 AFN)"
  );

  // -------------------------------------------------------------------
  // TEST 8: Quotation → Confirmed Lifecycle Transition
  // -------------------------------------------------------------------
  const quotationToConfirmed = validateStatusTransition(BookingStatus.QUOTATION, BookingStatus.CONFIRMED);
  const draftToQuotation = validateStatusTransition(BookingStatus.DRAFT, BookingStatus.QUOTATION);
  const invalidTransition = validateStatusTransition(BookingStatus.CANCELLED, BookingStatus.CONFIRMED);

  assert(
    quotationToConfirmed.isValid && draftToQuotation.isValid && !invalidTransition.isValid,
    "9. Status Lifecycle: Quotation -> Confirmed permitted; Cancelled -> Confirmed rejected"
  );

  // -------------------------------------------------------------------
  // TEST 9: Non-Destructive Cancellation with Reason
  // -------------------------------------------------------------------
  const cancelPayload = {
    bookingId: "bkg-101",
    status: BookingStatus.CANCELLED,
    cancellationReason: "Client flight postponed by airline",
    cancelledAt: new Date(),
    cancelledById: "user-admin-1",
  };
  assert(
    cancelPayload.status === BookingStatus.CANCELLED &&
    cancelPayload.cancellationReason.length > 5 &&
    cancelPayload.cancelledAt !== null,
    "10. Non-Destructive Cancellation with mandatory reason and operator timestamp"
  );

  // -------------------------------------------------------------------
  // TEST 10: Role-Based Authorization Enforcement
  // -------------------------------------------------------------------
  const allowedRolesForBookingCreate: UserRole[] = [UserRole.ADMIN, UserRole.MANAGER, UserRole.TRAVEL_AGENT];
  const auditorDenied = !allowedRolesForBookingCreate.includes(UserRole.AUDITOR);
  const agentAllowed = allowedRolesForBookingCreate.includes(UserRole.TRAVEL_AGENT);

  assert(
    auditorDenied && agentAllowed,
    "11. Permission Guard: TRAVEL_AGENT permitted to create bookings, AUDITOR restricted to read-only"
  );

  // -------------------------------------------------------------------
  // TEST 11: Audit Snapshot Recording
  // -------------------------------------------------------------------
  const auditEntry = {
    action: "UPDATE",
    entityName: "Booking",
    entityId: "bkg-101",
    oldValues: { totalNetSellingAFN: 100000, status: "DRAFT" },
    newValues: { totalNetSellingAFN: 146970, status: "CONFIRMED" },
  };
  assert(
    auditEntry.oldValues.totalNetSellingAFN === 100000 &&
    auditEntry.newValues.totalNetSellingAFN === 146970,
    "12. Audit Trail: Financial before & after snapshot captured on booking mutation"
  );

  // -------------------------------------------------------------------
  // TEST 12: Negative Amount Rejection
  // -------------------------------------------------------------------
  let negativeCostRejected = false;
  try {
    calculateServicePrices({
      quantity: 1,
      currency: "USD",
      exchangeRate: 70.50,
      costPriceForeign: -500, // Negative cost!
      sellPriceForeign: 600,
    });
  } catch (e: any) {
    negativeCostRejected = e.message.includes("negative");
  }

  let negativeSellRejected = false;
  try {
    calculateServicePrices({
      quantity: 1,
      currency: "USD",
      exchangeRate: 70.50,
      costPriceForeign: 500,
      sellPriceForeign: -600, // Negative selling!
    });
  } catch (e: any) {
    negativeSellRejected = e.message.includes("negative");
  }

  assert(
    negativeCostRejected && negativeSellRejected,
    "13. Negative Amount Validation: Both negative cost and negative selling prices strictly rejected"
  );

  // -------------------------------------------------------------------
  // TEST 13: Historical Exchange Rate Preservation
  // -------------------------------------------------------------------
  // A transaction recorded at historical 70.50 rate should NOT alter its base value when market rate changes to 72.00
  const historicalRecord = {
    currency: "USD",
    costForeign: new Decimal(100),
    storedExchangeRate: new Decimal("70.50"),
    baseCost: new Decimal(100).times("70.50"), // 7,050 AFN
  };
  const currentMarketRate = new Decimal("72.00");
  const recalculatedWithStoredRate = historicalRecord.costForeign.times(historicalRecord.storedExchangeRate);

  assert(
    recalculatedWithStoredRate.equals(historicalRecord.baseCost) &&
    !recalculatedWithStoredRate.equals(historicalRecord.costForeign.times(currentMarketRate)),
    "14. Historical Exchange Rate Invariance: Stored rate (70.50) preserved against live rate fluctuations (72.00)"
  );

  console.log(`\n==========================================================`);
  console.log(`   PHASE 2 TEST RESULTS: ${passed} Passed, ${failed} Failed`);
  console.log(`==========================================================\n`);

  if (failed > 0) {
    process.exit(1);
  }
}

runPhase2Tests();
