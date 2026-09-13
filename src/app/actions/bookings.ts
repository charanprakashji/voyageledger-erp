"use server";

import prisma from "@/lib/prisma";
import { getCurrentUser, requireRole, handleActionError } from "@/lib/auth";
import { recordAuditLog } from "@/lib/audit";
import {
  calculateServicePrices,
  calculateBookingTotals,
  validateStatusTransition,
  generateBookingNumber,
  ServicePriceInput,
} from "@/lib/booking";
import { BookingStatus, ServiceType, ServiceStatus, UserRole } from "@prisma/client";
import { revalidatePath } from "next/cache";

export interface PassengerInput {
  title?: string;
  firstName: string;
  middleName?: string;
  lastName: string;
  dateOfBirth?: string;
  gender?: string;
  nationality?: string;
  passportNumber?: string;
  passportIssueDate?: string;
  passportExpiryDate?: string;
  passportIssuingCountry?: string;
  visaNumber?: string;
  visaExpiryDate?: string;
  phone?: string;
  email?: string;
  specialRequirements?: string;
  notes?: string;
}

export interface FlightSegmentInput {
  airline: string;
  flightNumber: string;
  departureAirport: string;
  arrivalAirport: string;
  departureDateTime?: string;
  arrivalDateTime?: string;
  cabinClass?: string;
  ticketNumber?: string;
  pnr?: string;
  baggageAllowance?: string;
  fareBasis?: string;
  isRefundable?: boolean;
  isChangeable?: boolean;
  segmentOrder?: number;
  notes?: string;
}

export interface HotelDetailInput {
  hotelName: string;
  city: string;
  checkInDate: string;
  checkOutDate: string;
  roomType?: string;
  roomsCount?: number;
  nightsCount?: number;
  mealPlan?: string;
  confirmationNumber?: string;
  guestNames?: string;
  cancellationPolicy?: string;
  notes?: string;
}

export interface VisaDetailInput {
  destinationCountry: string;
  visaType?: string;
  applicantName?: string;
  applicationNumber?: string;
  submissionDate?: string;
  expectedDate?: string;
  visaStatus?: string;
  notes?: string;
}

export interface TransferDetailInput {
  pickupLocation: string;
  dropoffLocation: string;
  vehicleType?: string;
  serviceDateTime?: string;
  passengerCount?: number;
  notes?: string;
}

export interface ServiceItemInput extends ServicePriceInput {
  id?: string;
  supplierId: string;
  serviceType: ServiceType;
  description: string;
  supplierRef?: string;
  serviceStartDate?: string;
  serviceEndDate?: string;
  status?: ServiceStatus;
  notes?: string;
  flightSegments?: FlightSegmentInput[];
  hotelDetail?: HotelDetailInput;
  visaDetail?: VisaDetailInput;
  transferDetail?: TransferDetailInput;
}

export interface CreateBookingInput {
  customerId: string;
  pnrOrRef?: string;
  confirmationNumber?: string;
  salesAgent?: string;
  travelStartDate: string;
  travelEndDate?: string;
  destination?: string;
  status?: BookingStatus;
  currency?: string;
  notes?: string;
  internalNotes?: string;
  passengers: PassengerInput[];
  serviceItems: ServiceItemInput[];
}

export interface UpdateBookingInput extends CreateBookingInput {
  id: string;
}

/**
 * Fetch paginated list of bookings with filtering
 */
export async function getBookings(params?: {
  search?: string;
  status?: BookingStatus;
  customerId?: string;
  supplierId?: string;
  serviceType?: ServiceType;
  fromDate?: string;
  toDate?: string;
  page?: number;
  limit?: number;
}) {
  const limit = Math.min(100, Math.max(1, params?.limit || 20));
  const page = Math.max(1, params?.page || 1);
  const skip = (page - 1) * limit;

  try {
    await requireRole([
      UserRole.ADMIN,
      UserRole.MANAGER,
      UserRole.ACCOUNTANT,
      UserRole.TRAVEL_AGENT,
      UserRole.AUDITOR,
    ]);

    const where: any = {};

    if (params?.status) {
      where.status = params.status;
    }

    if (params?.customerId) {
      where.customerId = params.customerId;
    }

    if (params?.supplierId || params?.serviceType) {
      where.serviceItems = {
        some: {
          ...(params?.supplierId ? { supplierId: params.supplierId } : {}),
          ...(params?.serviceType ? { serviceType: params.serviceType } : {}),
        },
      };
    }

    if (params?.fromDate || params?.toDate) {
      where.travelStartDate = {};
      if (params?.fromDate) {
        where.travelStartDate.gte = new Date(params.fromDate);
      }
      if (params?.toDate) {
        where.travelStartDate.lte = new Date(params.toDate);
      }
    }

    if (params?.search) {
      const s = params.search.trim();
      where.OR = [
        { bookingNumber: { contains: s, mode: "insensitive" } },
        { pnrOrRef: { contains: s, mode: "insensitive" } },
        { confirmationNumber: { contains: s, mode: "insensitive" } },
        { destination: { contains: s, mode: "insensitive" } },
        { customer: { name: { contains: s, mode: "insensitive" } } },
        { customer: { companyName: { contains: s, mode: "insensitive" } } },
        {
          passengers: {
            some: {
              OR: [
                { firstName: { contains: s, mode: "insensitive" } },
                { lastName: { contains: s, mode: "insensitive" } },
                { passportNumber: { contains: s, mode: "insensitive" } },
              ],
            },
          },
        },
      ];
    }

    const [total, bookings] = await Promise.all([
      prisma.booking.count({ where }),
      prisma.booking.findMany({
        where,
        include: {
          customer: {
            select: { id: true, code: true, name: true, companyName: true, phone: true },
          },
          createdBy: {
            select: { id: true, name: true, role: true },
          },
          passengers: {
            select: { id: true, firstName: true, lastName: true, passportNumber: true },
          },
          serviceItems: {
            select: {
              id: true,
              serviceType: true,
              description: true,
              currency: true,
              costPrice: true,
              sellPrice: true,
              netSellingBase: true,
              marginAmount: true,
              supplier: { select: { id: true, name: true } },
            },
          },
        },
        orderBy: { createdAt: "desc" },
        skip,
        take: limit,
      }),
    ]);

    return {
      success: true,
      data: bookings.map((b) => ({
        ...b,
        totalCostPrice: Number(b.totalCostPrice),
        totalSellPrice: Number(b.totalSellPrice),
        totalDiscount: Number(b.totalDiscount),
        totalTax: Number(b.totalTax),
        totalNetSelling: Number(b.totalNetSelling),
        totalGrossMargin: Number(b.totalGrossMargin),
        serviceItems: b.serviceItems.map((s) => ({
          ...s,
          costPrice: Number(s.costPrice),
          sellPrice: Number(s.sellPrice),
          netSellingBase: Number(s.netSellingBase),
          marginAmount: Number(s.marginAmount),
        })),
      })),
      pagination: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      },
    };
  } catch (error: any) {
    const safeError = handleActionError(error, "Failed to retrieve bookings");
    return {
      success: false,
      error: safeError.error,
      data: [],
      pagination: { total: 0, page: 1, limit, totalPages: 0 },
    };
  }
}

/**
 * Fetch single booking with full passenger and multi-service breakdown
 */
export async function getBookingById(id: string) {
  try {
    await requireRole([
      UserRole.ADMIN,
      UserRole.MANAGER,
      UserRole.ACCOUNTANT,
      UserRole.TRAVEL_AGENT,
      UserRole.AUDITOR,
    ]);

    const booking = await prisma.booking.findUnique({
      where: { id },
      include: {
        customer: true,
        createdBy: { select: { id: true, name: true, role: true, email: true } },
        cancelledBy: { select: { id: true, name: true, role: true } },
        passengers: true,
        serviceItems: {
          include: {
            supplier: true,
            flightSegments: { orderBy: { segmentOrder: "asc" } },
            hotelDetail: true,
            visaDetail: true,
            transferDetail: true,
          },
        },
        attachments: true,
      },
    });

    if (!booking) {
      return { success: false, error: "Booking record not found" };
    }

    // Fetch related audit trail
    const auditLogs = await prisma.auditLog.findMany({
      where: { entityName: "Booking", entityId: id },
      include: { user: { select: { name: true, role: true } } },
      orderBy: { createdAt: "desc" },
    });

    return {
      success: true,
      data: {
        ...booking,
        totalCostPrice: Number(booking.totalCostPrice),
        totalSellPrice: Number(booking.totalSellPrice),
        totalDiscount: Number(booking.totalDiscount),
        totalTax: Number(booking.totalTax),
        totalNetSelling: Number(booking.totalNetSelling),
        totalGrossMargin: Number(booking.totalGrossMargin),
        serviceItems: booking.serviceItems.map((s) => ({
          ...s,
          exchangeRate: Number(s.exchangeRate),
          costPriceForeign: Number(s.costPriceForeign),
          sellPriceForeign: Number(s.sellPriceForeign),
          discountForeign: Number(s.discountForeign),
          taxAmountForeign: Number(s.taxAmountForeign),
          netSellingForeign: Number(s.netSellingForeign),
          costPrice: Number(s.costPrice),
          sellPrice: Number(s.sellPrice),
          discountBase: Number(s.discountBase),
          taxAmountBase: Number(s.taxAmountBase),
          netSellingBase: Number(s.netSellingBase),
          marginAmount: Number(s.marginAmount),
        })),
        auditLogs,
      },
    };
  } catch (error: any) {
    return handleActionError(error, "Failed to load booking details");
  }
}

/**
 * Create a new Booking with passengers and multi-currency service items
 */
export async function createBooking(input: CreateBookingInput) {
  try {
    const currentUser = await requireRole([
      UserRole.ADMIN,
      UserRole.MANAGER,
      UserRole.TRAVEL_AGENT,
    ]);

    if (!input.customerId) {
      return { success: false, error: "Customer selection is required" };
    }

    if (!input.travelStartDate) {
      return { success: false, error: "Travel start date is required" };
    }

    if (!input.passengers || input.passengers.length === 0) {
      return { success: false, error: "At least one passenger is required for a booking" };
    }

    if (!input.serviceItems || input.serviceItems.length === 0) {
      return { success: false, error: "At least one travel service item is required" };
    }
    // 1. Verify customer exists
    const customer = await prisma.customer.findUnique({
      where: { id: input.customerId },
    });
    if (!customer) {
      return { success: false, error: "Selected customer does not exist" };
    }

    // 2. Validate and calculate each service item using Decimal math
    const calculatedServices = input.serviceItems.map((item) => {
      if (!item.supplierId) {
        throw new Error(`Supplier is required for service: ${item.description || item.serviceType}`);
      }
      const prices = calculateServicePrices(item);
      return {
        ...item,
        prices,
      };
    });

    // 3. Compute consolidated financial totals (AFN)
    const bookingTotals = calculateBookingTotals(
      calculatedServices.map((cs) => cs.prices)
    );

    // 4. Generate unique Booking sequence number
    const count = await prisma.booking.count();
    const bookingNumber = generateBookingNumber(count + 1);

    const leadPax =
      input.passengers[0]
        ? `${input.passengers[0].firstName} ${input.passengers[0].lastName}`
        : "Lead Passenger";

    // 5. Create Booking in database inside a transaction
    const newBooking = await prisma.$transaction(async (tx) => {
      const created = await tx.booking.create({
        data: {
          bookingNumber,
          customerId: input.customerId,
          createdById: currentUser.id,
          pnr: input.pnrOrRef?.trim() || null,
          supplierRef: input.confirmationNumber?.trim() || null,
          salesAgentId: input.salesAgent?.trim() || currentUser.id,
          leadPassenger: leadPax,
          travelStartDate: new Date(input.travelStartDate),
          travelEndDate: input.travelEndDate ? new Date(input.travelEndDate) : null,
          destination: input.destination?.trim() || null,
          status: input.status || BookingStatus.DRAFT,
          currency: input.currency || "AFN",
          notes: input.notes?.trim() || null,
          internalNotes: input.internalNotes?.trim() || null,
          
          // Stored base totals
          totalCostPrice: bookingTotals.totalCostPrice.toString(),
          totalSellPrice: bookingTotals.totalSellPrice.toString(),
          totalDiscount: bookingTotals.totalDiscount.toString(),
          totalTax: bookingTotals.totalTax.toString(),
          totalNetSelling: bookingTotals.totalNetSelling.toString(),
          totalGrossMargin: bookingTotals.totalGrossMargin.toString(),
          
          // Passengers
          passengers: {
            create: input.passengers.map((p) => ({
              title: p.title || "Mr",
              firstName: p.firstName.trim(),
              middleName: p.middleName?.trim() || null,
              lastName: p.lastName.trim(),
              dateOfBirth: p.dateOfBirth ? new Date(p.dateOfBirth) : null,
              gender: p.gender || null,
              nationality: p.nationality?.trim() || "Afghan",
              passportNumber: p.passportNumber?.trim() || null,
              passportIssueDate: p.passportIssueDate ? new Date(p.passportIssueDate) : null,
              passportExpiryDate: p.passportExpiryDate ? new Date(p.passportExpiryDate) : null,
              passportIssuingCountry: p.passportIssuingCountry?.trim() || "Afghanistan",
              visaNumber: p.visaNumber?.trim() || null,
              visaExpiryDate: p.visaExpiryDate ? new Date(p.visaExpiryDate) : null,
              phone: p.phone?.trim() || null,
              email: p.email?.trim() || null,
              specialRequirements: p.specialRequirements?.trim() || null,
              notes: p.notes?.trim() || null,
            })),
          },

          // Service items & detail sub-records
          serviceItems: {
            create: calculatedServices.map((cs) => ({
              supplier: { connect: { id: cs.supplierId } },
              serviceType: cs.serviceType,
              description: cs.description.trim(),
              supplierRef: cs.supplierRef?.trim() || null,
              serviceStartDate: cs.serviceStartDate ? new Date(cs.serviceStartDate) : null,
              serviceEndDate: cs.serviceEndDate ? new Date(cs.serviceEndDate) : null,
              quantity: cs.prices.quantity,
              passengerCount: cs.prices.passengerCount,
              
              currency: cs.prices.currency,
              exchangeRate: cs.prices.exchangeRate.toString(),
              costPriceForeign: cs.prices.costPriceForeign.toString(),
              sellPriceForeign: cs.prices.sellPriceForeign.toString(),
              discountForeign: cs.prices.discountForeign.toString(),
              taxAmountForeign: cs.prices.taxAmountForeign.toString(),
              netSellingForeign: cs.prices.netSellingForeign.toString(),

              costPrice: cs.prices.costPrice.toString(),
              sellPrice: cs.prices.sellPrice.toString(),
              discountBase: cs.prices.discountBase.toString(),
              taxAmountBase: cs.prices.taxAmountBase.toString(),
              netSellingBase: cs.prices.netSellingBase.toString(),
              marginAmount: cs.prices.marginAmount.toString(),
              
              status: cs.status || ServiceStatus.CONFIRMED,
              notes: cs.notes?.trim() || null,

              // Flight segments
              flightSegments: cs.flightSegments && cs.flightSegments.length > 0
                ? {
                    create: cs.flightSegments.map((f, idx) => ({
                      airline: f.airline.trim(),
                      flightNumber: f.flightNumber.trim(),
                      departureAirport: f.departureAirport.trim(),
                      arrivalAirport: f.arrivalAirport.trim(),
                      departureDateTime: f.departureDateTime ? new Date(f.departureDateTime) : null,
                      arrivalDateTime: f.arrivalDateTime ? new Date(f.arrivalDateTime) : null,
                      cabinClass: f.cabinClass || "ECONOMY",
                      ticketNumber: f.ticketNumber?.trim() || null,
                      pnr: f.pnr?.trim() || cs.supplierRef?.trim() || null,
                      baggageAllowance: f.baggageAllowance?.trim() || "30 KG",
                      fareBasis: f.fareBasis?.trim() || null,
                      isRefundable: Boolean(f.isRefundable),
                      isChangeable: f.isChangeable !== false,
                      segmentOrder: f.segmentOrder || idx + 1,
                      notes: f.notes?.trim() || null,
                    })),
                  }
                : undefined,

              // Hotel Detail
              hotelDetail: cs.hotelDetail
                ? {
                    create: {
                      hotelName: cs.hotelDetail.hotelName.trim(),
                      city: cs.hotelDetail.city.trim(),
                      checkInDate: new Date(cs.hotelDetail.checkInDate),
                      checkOutDate: new Date(cs.hotelDetail.checkOutDate),
                      roomType: cs.hotelDetail.roomType?.trim() || "Standard Room",
                      numberOfRooms: cs.hotelDetail.roomsCount || 1,
                      numberOfNights: cs.hotelDetail.nightsCount || 1,
                      mealPlan: cs.hotelDetail.mealPlan || "BB",
                      confirmationCode: cs.hotelDetail.confirmationNumber?.trim() || null,
                      notes: cs.hotelDetail.notes?.trim() || null,
                    },
                  }
                : undefined,

              // Visa Detail
              visaDetail: cs.visaDetail
                ? {
                    create: {
                      visaCountry: (cs.visaDetail as any).destinationCountry?.trim() || (cs.visaDetail as any).visaCountry?.trim() || "UAE",
                      visaType: cs.visaDetail.visaType?.trim() || "Tourist Visa",
                      applicantName: cs.visaDetail.applicantName?.trim() || null,
                      submissionDate: cs.visaDetail.submissionDate ? new Date(cs.visaDetail.submissionDate) : null,
                      status: cs.visaDetail.visaStatus || "PROCESSING",
                      notes: cs.visaDetail.notes?.trim() || null,
                    },
                  }
                : undefined,

              // Transfer Detail
              transferDetail: cs.transferDetail
                ? {
                    create: [
                      {
                        pickupLocation: cs.transferDetail.pickupLocation.trim(),
                        dropoffLocation: cs.transferDetail.dropoffLocation.trim(),
                        vehicleType: cs.transferDetail.vehicleType || "Sedan",
                        pickupDateTime: cs.transferDetail.serviceDateTime ? new Date(cs.transferDetail.serviceDateTime) : null,
                        passengerCount: cs.transferDetail.passengerCount || 1,
                        notes: cs.transferDetail.notes?.trim() || null,
                      },
                    ],
                  }
                : undefined,
            })),
          },
        },
      });

      return created;
    });

    // 6. Record Audit Log
    await recordAuditLog({
      userId: currentUser.id,
      action: "CREATE",
      entityName: "Booking",
      entityId: newBooking.id,
      newValues: {
        bookingNumber: newBooking.bookingNumber,
        customerName: customer.name,
        passengersCount: input.passengers.length,
        servicesCount: input.serviceItems.length,
        totalNetSellingAFN: bookingTotals.totalNetSelling.toNumber(),
        totalCostPriceAFN: bookingTotals.totalCostPrice.toNumber(),
        totalGrossMarginAFN: bookingTotals.totalGrossMargin.toNumber(),
        status: newBooking.status,
      },
    });

    revalidatePath("/bookings");
    return { success: true, data: { id: newBooking.id, bookingNumber: newBooking.bookingNumber } };
  } catch (error: any) {
    return handleActionError(error, "Failed to create booking");
  }
}

/**
 * Update an existing booking
 */
export async function updateBooking(input: UpdateBookingInput) {
  try {
    const currentUser = await requireRole([
      UserRole.ADMIN,
      UserRole.MANAGER,
      UserRole.TRAVEL_AGENT,
    ]);

    const existing = await prisma.booking.findUnique({
      where: { id: input.id },
      include: { serviceItems: true, passengers: true },
    });

    if (!existing) {
      return { success: false, error: "Booking record not found" };
    }

    if (existing.status === BookingStatus.CANCELLED && currentUser.role !== UserRole.ADMIN) {
      return { success: false, error: "Cancelled bookings cannot be modified" };
    }

    // Recalculate service item prices
    const calculatedServices = input.serviceItems.map((item) => {
      if (!item.supplierId) {
        throw new Error(`Supplier is required for service: ${item.description || item.serviceType}`);
      }
      const prices = calculateServicePrices(item);
      return { ...item, prices };
    });

    const bookingTotals = calculateBookingTotals(
      calculatedServices.map((cs) => cs.prices)
    );

    const leadPax =
      input.passengers[0]
        ? `${input.passengers[0].firstName} ${input.passengers[0].lastName}`
        : "Lead Passenger";

    await prisma.$transaction(async (tx) => {
      // 1. Delete old passenger and service detail records
      await tx.passenger.deleteMany({ where: { bookingId: input.id } });
      await tx.bookingServiceItem.deleteMany({ where: { bookingId: input.id } });

      // 2. Update booking header and re-create updated children
      await tx.booking.update({
        where: { id: input.id },
        data: {
          customerId: input.customerId,
          pnr: input.pnrOrRef?.trim() || null,
          supplierRef: input.confirmationNumber?.trim() || null,
          salesAgentId: input.salesAgent?.trim() || existing.salesAgentId,
          leadPassenger: leadPax,
          travelStartDate: new Date(input.travelStartDate),
          travelEndDate: input.travelEndDate ? new Date(input.travelEndDate) : null,
          destination: input.destination?.trim() || null,
          notes: input.notes?.trim() || null,
          internalNotes: input.internalNotes?.trim() || null,

          totalCostPrice: bookingTotals.totalCostPrice.toString(),
          totalSellPrice: bookingTotals.totalSellPrice.toString(),
          totalDiscount: bookingTotals.totalDiscount.toString(),
          totalTax: bookingTotals.totalTax.toString(),
          totalNetSelling: bookingTotals.totalNetSelling.toString(),
          totalGrossMargin: bookingTotals.totalGrossMargin.toString(),

          passengers: {
            create: input.passengers.map((p) => ({
              title: p.title || "Mr",
              firstName: p.firstName.trim(),
              middleName: p.middleName?.trim() || null,
              lastName: p.lastName.trim(),
              dateOfBirth: p.dateOfBirth ? new Date(p.dateOfBirth) : null,
              gender: p.gender || null,
              nationality: p.nationality?.trim() || "Afghan",
              passportNumber: p.passportNumber?.trim() || null,
              passportIssueDate: p.passportIssueDate ? new Date(p.passportIssueDate) : null,
              passportExpiryDate: p.passportExpiryDate ? new Date(p.passportExpiryDate) : null,
              passportIssuingCountry: p.passportIssuingCountry?.trim() || "Afghanistan",
              visaNumber: p.visaNumber?.trim() || null,
              visaExpiryDate: p.visaExpiryDate ? new Date(p.visaExpiryDate) : null,
              phone: p.phone?.trim() || null,
              email: p.email?.trim() || null,
              specialRequirements: p.specialRequirements?.trim() || null,
              notes: p.notes?.trim() || null,
            })),
          },

          serviceItems: {
            create: calculatedServices.map((cs) => ({
              supplier: { connect: { id: cs.supplierId } },
              serviceType: cs.serviceType,
              description: cs.description.trim(),
              supplierRef: cs.supplierRef?.trim() || null,
              serviceStartDate: cs.serviceStartDate ? new Date(cs.serviceStartDate) : null,
              serviceEndDate: cs.serviceEndDate ? new Date(cs.serviceEndDate) : null,
              quantity: cs.prices.quantity,
              passengerCount: cs.prices.passengerCount,

              currency: cs.prices.currency,
              exchangeRate: cs.prices.exchangeRate.toString(),
              costPriceForeign: cs.prices.costPriceForeign.toString(),
              sellPriceForeign: cs.prices.sellPriceForeign.toString(),
              discountForeign: cs.prices.discountForeign.toString(),
              taxAmountForeign: cs.prices.taxAmountForeign.toString(),
              netSellingForeign: cs.prices.netSellingForeign.toString(),

              costPrice: cs.prices.costPrice.toString(),
              sellPrice: cs.prices.sellPrice.toString(),
              discountBase: cs.prices.discountBase.toString(),
              taxAmountBase: cs.prices.taxAmountBase.toString(),
              netSellingBase: cs.prices.netSellingBase.toString(),
              marginAmount: cs.prices.marginAmount.toString(),

              status: cs.status || ServiceStatus.CONFIRMED,
              notes: cs.notes?.trim() || null,

              flightSegments: cs.flightSegments && cs.flightSegments.length > 0
                ? {
                    create: cs.flightSegments.map((f, idx) => ({
                      airline: f.airline.trim(),
                      flightNumber: f.flightNumber.trim(),
                      departureAirport: f.departureAirport.trim(),
                      arrivalAirport: f.arrivalAirport.trim(),
                      departureDateTime: f.departureDateTime ? new Date(f.departureDateTime) : null,
                      arrivalDateTime: f.arrivalDateTime ? new Date(f.arrivalDateTime) : null,
                      cabinClass: f.cabinClass || "ECONOMY",
                      ticketNumber: f.ticketNumber?.trim() || null,
                      pnr: f.pnr?.trim() || cs.supplierRef?.trim() || null,
                      baggageAllowance: f.baggageAllowance?.trim() || "30 KG",
                      fareBasis: f.fareBasis?.trim() || null,
                      isRefundable: Boolean(f.isRefundable),
                      isChangeable: f.isChangeable !== false,
                      segmentOrder: f.segmentOrder || idx + 1,
                      notes: f.notes?.trim() || null,
                    })),
                  }
                : undefined,

              hotelDetail: cs.hotelDetail
                ? {
                    create: {
                      hotelName: cs.hotelDetail.hotelName.trim(),
                      city: cs.hotelDetail.city.trim(),
                      checkInDate: new Date(cs.hotelDetail.checkInDate),
                      checkOutDate: new Date(cs.hotelDetail.checkOutDate),
                      roomType: cs.hotelDetail.roomType?.trim() || "Standard Room",
                      numberOfRooms: cs.hotelDetail.roomsCount || 1,
                      numberOfNights: cs.hotelDetail.nightsCount || 1,
                      mealPlan: cs.hotelDetail.mealPlan || "BB",
                      confirmationCode: cs.hotelDetail.confirmationNumber?.trim() || null,
                      notes: cs.hotelDetail.notes?.trim() || null,
                    },
                  }
                : undefined,

              visaDetail: cs.visaDetail
                ? {
                    create: {
                      visaCountry: (cs.visaDetail as any).destinationCountry?.trim() || (cs.visaDetail as any).visaCountry?.trim() || "UAE",
                      visaType: cs.visaDetail.visaType?.trim() || "Tourist Visa",
                      applicantName: cs.visaDetail.applicantName?.trim() || null,
                      submissionDate: cs.visaDetail.submissionDate ? new Date(cs.visaDetail.submissionDate) : null,
                      status: cs.visaDetail.visaStatus || "PROCESSING",
                      notes: cs.visaDetail.notes?.trim() || null,
                    },
                  }
                : undefined,

              transferDetail: cs.transferDetail
                ? {
                    create: [
                      {
                        pickupLocation: cs.transferDetail.pickupLocation.trim(),
                        dropoffLocation: cs.transferDetail.dropoffLocation.trim(),
                        vehicleType: cs.transferDetail.vehicleType || "Sedan",
                        pickupDateTime: cs.transferDetail.serviceDateTime ? new Date(cs.transferDetail.serviceDateTime) : null,
                        passengerCount: cs.transferDetail.passengerCount || 1,
                        notes: cs.transferDetail.notes?.trim() || null,
                      },
                    ],
                  }
                : undefined,
            })),
          },
        },
      });
    });

    // Audit log
    await recordAuditLog({
      userId: currentUser.id,
      action: "UPDATE",
      entityName: "Booking",
      entityId: input.id,
      oldValues: {
        totalNetSellingAFN: Number(existing.totalNetSelling),
        totalCostPriceAFN: Number(existing.totalCostPrice),
      },
      newValues: {
        totalNetSellingAFN: bookingTotals.totalNetSelling.toNumber(),
        totalCostPriceAFN: bookingTotals.totalCostPrice.toNumber(),
        totalGrossMarginAFN: bookingTotals.totalGrossMargin.toNumber(),
      },
    });

    revalidatePath(`/bookings/${input.id}`);
    revalidatePath("/bookings");
    return { success: true, data: { id: input.id } };
  } catch (error: any) {
    return handleActionError(error, "Failed to update booking");
  }
}

/**
 * Update booking status with validation transition check
 */
export async function updateBookingStatus(id: string, newStatus: BookingStatus) {
  try {
    const currentUser = await requireRole([
      UserRole.ADMIN,
      UserRole.MANAGER,
      UserRole.TRAVEL_AGENT,
    ]);

    const booking = await prisma.booking.findUnique({
      where: { id },
      select: { id: true, status: true, bookingNumber: true, totalNetSelling: true },
    });

    if (!booking) {
      return { success: false, error: "Booking record not found" };
    }

    const validation = validateStatusTransition(booking.status, newStatus);
    if (!validation.isValid) {
      return { success: false, error: validation.error };
    }

    const isQuotationConversion =
      booking.status === BookingStatus.QUOTATION && newStatus === BookingStatus.CONFIRMED;

    await prisma.booking.update({
      where: { id },
      data: { status: newStatus },
    });

    await recordAuditLog({
      userId: currentUser.id,
      action: isQuotationConversion ? "CONVERT_QUOTATION" : "STATUS_CHANGE",
      entityName: "Booking",
      entityId: id,
      oldValues: { status: booking.status },
      newValues: { status: newStatus },
    });

    revalidatePath(`/bookings/${id}`);
    revalidatePath("/bookings");
    return { success: true };
  } catch (error: any) {
    return handleActionError(error, "Failed to update status");
  }
}

/**
 * Cancel a booking with mandatory cancellation reason
 */
export async function cancelBooking(id: string, reason: string) {
  try {
    const currentUser = await requireRole([
      UserRole.ADMIN,
      UserRole.MANAGER,
      UserRole.TRAVEL_AGENT,
    ]);

    if (!reason || reason.trim().length < 5) {
      return { success: false, error: "A detailed cancellation reason is mandatory (minimum 5 characters)" };
    }

    const booking = await prisma.booking.findUnique({
      where: { id },
      select: { id: true, status: true, bookingNumber: true, totalNetSelling: true },
    });

    if (!booking) {
      return { success: false, error: "Booking not found" };
    }

    if (booking.status === BookingStatus.CANCELLED) {
      return { success: false, error: "Booking is already cancelled" };
    }

    await prisma.booking.update({
      where: { id },
      data: {
        status: BookingStatus.CANCELLED,
        cancellationReason: reason.trim(),
        cancelledAt: new Date(),
        cancelledById: currentUser.id,
      },
    });

    await recordAuditLog({
      userId: currentUser.id,
      action: "CANCEL",
      entityName: "Booking",
      entityId: id,
      oldValues: { status: booking.status },
      newValues: {
        status: BookingStatus.CANCELLED,
        cancellationReason: reason.trim(),
        cancelledBy: currentUser.name,
      },
    });

    revalidatePath(`/bookings/${id}`);
    revalidatePath("/bookings");
    return { success: true };
  } catch (error: any) {
    return handleActionError(error, "Failed to cancel booking");
  }
}
