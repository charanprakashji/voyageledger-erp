import { Decimal } from "decimal.js";
import { BookingStatus, ServiceType, ServiceStatus } from "@prisma/client";

// Set precision for financial calculations
Decimal.set({ precision: 28, rounding: Decimal.ROUND_HALF_UP });

export interface ServicePriceInput {
  quantity: number;
  passengerCount?: number;
  currency: string;
  exchangeRate: number | string | Decimal;
  costPriceForeign: number | string | Decimal;
  sellPriceForeign: number | string | Decimal;
  discountForeign?: number | string | Decimal;
  taxAmountForeign?: number | string | Decimal;
}

export interface CalculatedServicePrices {
  quantity: number;
  passengerCount: number;
  currency: string;
  exchangeRate: Decimal;
  
  // Foreign Currency
  costPriceForeign: Decimal;
  sellPriceForeign: Decimal;
  discountForeign: Decimal;
  taxAmountForeign: Decimal;
  netSellingForeign: Decimal;

  // Base Currency (AFN)
  costPrice: Decimal;         // Total direct cost in AFN (Foreign cost * Qty * Rate)
  sellPrice: Decimal;         // Total gross sell in AFN (Foreign sell * Qty * Rate)
  discountBase: Decimal;      // Discount in AFN
  taxAmountBase: Decimal;     // Tax in AFN
  netSellingBase: Decimal;    // Net sell in AFN (Gross Sell - Discount + Tax)
  marginAmount: Decimal;      // Gross margin in AFN (Net Selling - Total Direct Cost)
}

export interface BookingFinancialTotals {
  totalCostPrice: Decimal;
  totalSellPrice: Decimal;
  totalDiscount: Decimal;
  totalTax: Decimal;
  totalNetSelling: Decimal;
  totalGrossMargin: Decimal;
  marginPercentage: Decimal;
}

/**
 * Validates and calculates service prices with strict Decimal math.
 * Rejects negative cost or selling values.
 */
export function calculateServicePrices(input: ServicePriceInput): CalculatedServicePrices {
  const quantity = Math.max(1, input.quantity || 1);
  const passengerCount = Math.max(1, input.passengerCount || 1);
  const currency = (input.currency || "AFN").toUpperCase().trim();
  
  const exchangeRate = new Decimal(input.exchangeRate || 1);
  if (exchangeRate.lte(0)) {
    throw new Error("Exchange rate must be strictly greater than 0");
  }

  const costPriceForeign = new Decimal(input.costPriceForeign || 0);
  const sellPriceForeign = new Decimal(input.sellPriceForeign || 0);
  const discountForeign = new Decimal(input.discountForeign || 0);
  const taxAmountForeign = new Decimal(input.taxAmountForeign || 0);

  // Reject negative numbers
  if (costPriceForeign.lt(0)) {
    throw new Error("Service cost price cannot be negative");
  }
  if (sellPriceForeign.lt(0)) {
    throw new Error("Service selling price cannot be negative");
  }
  if (discountForeign.lt(0)) {
    throw new Error("Discount amount cannot be negative");
  }
  if (taxAmountForeign.lt(0)) {
    throw new Error("Tax amount cannot be negative");
  }

  // Multiply by quantity for total foreign prices
  const totalCostForeign = costPriceForeign.times(quantity);
  const totalSellForeign = sellPriceForeign.times(quantity);

  // Convert to Base AFN using stored historical exchange rate
  const costPriceBase = totalCostForeign.times(exchangeRate).toDecimalPlaces(2);
  const sellPriceBase = totalSellForeign.times(exchangeRate).toDecimalPlaces(2);
  const discountBase = discountForeign.times(exchangeRate).toDecimalPlaces(2);
  const taxAmountBase = taxAmountForeign.times(exchangeRate).toDecimalPlaces(2);

  const netSellingForeign = totalSellForeign.minus(discountForeign).plus(taxAmountForeign);
  const netSellingBase = sellPriceBase.minus(discountBase).plus(taxAmountBase);
  const marginAmount = netSellingBase.minus(costPriceBase);

  return {
    quantity,
    passengerCount,
    currency,
    exchangeRate,
    costPriceForeign,
    sellPriceForeign,
    discountForeign,
    taxAmountForeign,
    netSellingForeign,
    costPrice: costPriceBase,
    sellPrice: sellPriceBase,
    discountBase,
    taxAmountBase,
    netSellingBase,
    marginAmount,
  };
}

/**
 * Computes consolidated totals across an array of service items.
 */
export function calculateBookingTotals(items: Array<{
  costPrice: Decimal | number | string;
  sellPrice: Decimal | number | string;
  discountBase?: Decimal | number | string;
  taxAmountBase?: Decimal | number | string;
  netSellingBase?: Decimal | number | string;
  marginAmount?: Decimal | number | string;
}>): BookingFinancialTotals {
  let totalCostPrice = new Decimal(0);
  let totalSellPrice = new Decimal(0);
  let totalDiscount = new Decimal(0);
  let totalTax = new Decimal(0);
  let totalNetSelling = new Decimal(0);

  for (const item of items) {
    totalCostPrice = totalCostPrice.plus(new Decimal(item.costPrice || 0));
    totalSellPrice = totalSellPrice.plus(new Decimal(item.sellPrice || 0));
    totalDiscount = totalDiscount.plus(new Decimal(item.discountBase || 0));
    totalTax = totalTax.plus(new Decimal(item.taxAmountBase || 0));
    
    if (item.netSellingBase !== undefined) {
      totalNetSelling = totalNetSelling.plus(new Decimal(item.netSellingBase));
    } else {
      const net = new Decimal(item.sellPrice || 0)
        .minus(new Decimal(item.discountBase || 0))
        .plus(new Decimal(item.taxAmountBase || 0));
      totalNetSelling = totalNetSelling.plus(net);
    }
  }

  // Gross profit = Net Selling - Direct Cost
  const totalGrossMargin = totalNetSelling.minus(totalCostPrice);
  const marginPercentage = totalNetSelling.gt(0)
    ? totalGrossMargin.dividedBy(totalNetSelling).times(100).toDecimalPlaces(2)
    : new Decimal(0);

  return {
    totalCostPrice: totalCostPrice.toDecimalPlaces(2),
    totalSellPrice: totalSellPrice.toDecimalPlaces(2),
    totalDiscount: totalDiscount.toDecimalPlaces(2),
    totalTax: totalTax.toDecimalPlaces(2),
    totalNetSelling: totalNetSelling.toDecimalPlaces(2),
    totalGrossMargin: totalGrossMargin.toDecimalPlaces(2),
    marginPercentage,
  };
}

/**
 * Validates lifecycle status transitions for bookings.
 */
export function validateStatusTransition(
  currentStatus: BookingStatus,
  targetStatus: BookingStatus
): { isValid: boolean; error?: string } {
  if (currentStatus === targetStatus) {
    return { isValid: true };
  }

  const validTransitions: Record<BookingStatus, BookingStatus[]> = {
    DRAFT: [BookingStatus.QUOTATION, BookingStatus.CONFIRMED, BookingStatus.CANCELLED],
    QUOTATION: [BookingStatus.CONFIRMED, BookingStatus.DRAFT, BookingStatus.CANCELLED],
    CONFIRMED: [BookingStatus.PARTIALLY_PAID, BookingStatus.PAID, BookingStatus.COMPLETED, BookingStatus.CANCELLED],
    PARTIALLY_PAID: [BookingStatus.PAID, BookingStatus.COMPLETED, BookingStatus.CANCELLED],
    PAID: [BookingStatus.COMPLETED, BookingStatus.CANCELLED],
    COMPLETED: [BookingStatus.CANCELLED],
    CANCELLED: [BookingStatus.DRAFT],
  };

  const allowed = validTransitions[currentStatus] || [];
  if (!allowed.includes(targetStatus)) {
    return {
      isValid: false,
      error: `Invalid status transition from ${currentStatus} to ${targetStatus}`,
    };
  }

  return { isValid: true };
}

/**
 * Computes number of hotel nights from check-in and check-out dates.
 */
export function calculateHotelNights(
  checkInDate: Date | string,
  checkOutDate: Date | string,
  overrideNights?: number
): number {
  if (overrideNights && overrideNights > 0) {
    return Math.floor(overrideNights);
  }

  const checkIn = new Date(checkInDate);
  const checkOut = new Date(checkOutDate);

  if (isNaN(checkIn.getTime()) || isNaN(checkOut.getTime())) {
    return 1;
  }

  const diffMs = checkOut.getTime() - checkIn.getTime();
  const diffDays = Math.round(diffMs / (1000 * 60 * 60 * 24));
  return Math.max(1, diffDays);
}

/**
 * Generates standardized booking sequence number.
 */
export function generateBookingNumber(sequence: number, year: number = new Date().getFullYear()): string {
  const pad = String(sequence).padStart(4, "0");
  return `BKG-${year}-${pad}`;
}
