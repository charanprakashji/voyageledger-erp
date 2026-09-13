"use client";

import React, { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import {
  Users,
  Plane,
  Building,
  FileCheck,
  Car,
  Plus,
  Trash2,
  Save,
  ArrowLeft,
  DollarSign,
  AlertCircle,
  HelpCircle,
  Clock,
  Compass,
  Shield,
  Layers,
} from "lucide-react";
import { BookingStatus, ServiceType, ServiceStatus } from "@prisma/client";
import {
  createBooking,
  updateBooking,
  CreateBookingInput,
  PassengerInput,
  ServiceItemInput,
} from "@/app/actions/bookings";
import { calculateHotelNights, calculateServicePrices, calculateBookingTotals } from "@/lib/booking";

interface BookingFormProps {
  initialData?: any;
  customers: Array<{ id: string; name: string; code: string; companyName?: string | null; defaultCurrency?: string }>;
  suppliers: Array<{ id: string; name: string; code: string; type: string; currency?: string }>;
  defaultCurrencies?: string[];
}

export function BookingForm({
  initialData,
  customers,
  suppliers,
  defaultCurrencies = ["AFN", "USD", "EUR", "AED", "GBP"],
}: BookingFormProps) {
  const router = useRouter();
  const isEditing = Boolean(initialData?.id);

  const [customerId, setCustomerId] = useState(initialData?.customerId || (customers[0]?.id || ""));
  const [pnrOrRef, setPnrOrRef] = useState(initialData?.pnrOrRef || "");
  const [confirmationNumber, setConfirmationNumber] = useState(initialData?.confirmationNumber || "");
  const [salesAgent, setSalesAgent] = useState(initialData?.salesAgent || "");
  const [destination, setDestination] = useState(initialData?.destination || "");
  const [travelStartDate, setTravelStartDate] = useState(
    initialData?.travelStartDate
      ? new Date(initialData.travelStartDate).toISOString().split("T")[0]
      : new Date().toISOString().split("T")[0]
  );
  const [travelEndDate, setTravelEndDate] = useState(
    initialData?.travelEndDate
      ? new Date(initialData.travelEndDate).toISOString().split("T")[0]
      : ""
  );
  const [status, setStatus] = useState<BookingStatus>(initialData?.status || BookingStatus.CONFIRMED);
  const [currency, setCurrency] = useState(initialData?.currency || "AFN");
  const [notes, setNotes] = useState(initialData?.notes || "");
  const [internalNotes, setInternalNotes] = useState(initialData?.internalNotes || "");

  // Passengers State
  const [passengers, setPassengers] = useState<PassengerInput[]>(
    initialData?.passengers?.length
      ? initialData.passengers.map((p: any) => ({
          title: p.title || "Mr",
          firstName: p.firstName || "",
          middleName: p.middleName || "",
          lastName: p.lastName || "",
          dateOfBirth: p.dateOfBirth ? new Date(p.dateOfBirth).toISOString().split("T")[0] : "",
          gender: p.gender || "MALE",
          nationality: p.nationality || "Afghan",
          passportNumber: p.passportNumber || "",
          passportIssueDate: p.passportIssueDate ? new Date(p.passportIssueDate).toISOString().split("T")[0] : "",
          passportExpiryDate: p.passportExpiryDate ? new Date(p.passportExpiryDate).toISOString().split("T")[0] : "",
          passportIssuingCountry: p.passportIssuingCountry || "Afghanistan",
          visaNumber: p.visaNumber || "",
          visaExpiryDate: p.visaExpiryDate ? new Date(p.visaExpiryDate).toISOString().split("T")[0] : "",
          phone: p.phone || "",
          email: p.email || "",
          specialRequirements: p.specialRequirements || "",
          notes: p.notes || "",
        }))
      : [
          {
            title: "Mr",
            firstName: "",
            middleName: "",
            lastName: "",
            nationality: "Afghan",
            passportIssuingCountry: "Afghanistan",
            gender: "MALE",
          },
        ]
  );

  // Service Items State
  const [serviceItems, setServiceItems] = useState<ServiceItemInput[]>(
    initialData?.serviceItems?.length
      ? initialData.serviceItems.map((s: any) => ({
          id: s.id,
          supplierId: s.supplierId,
          serviceType: s.serviceType,
          description: s.description || "",
          supplierRef: s.supplierRef || "",
          serviceStartDate: s.serviceStartDate ? new Date(s.serviceStartDate).toISOString().split("T")[0] : "",
          serviceEndDate: s.serviceEndDate ? new Date(s.serviceEndDate).toISOString().split("T")[0] : "",
          quantity: s.quantity || 1,
          passengerCount: s.passengerCount || 1,
          currency: s.currency || "USD",
          exchangeRate: s.exchangeRate || 70.5,
          costPriceForeign: s.costPriceForeign || 0,
          sellPriceForeign: s.sellPriceForeign || 0,
          discountForeign: s.discountForeign || 0,
          taxAmountForeign: s.taxAmountForeign || 0,
          status: s.status || ServiceStatus.CONFIRMED,
          notes: s.notes || "",
          flightSegments: s.flightSegments?.length
            ? s.flightSegments.map((f: any) => ({
                airline: f.airline || "Kam Air",
                flightNumber: f.flightNumber || "",
                departureAirport: f.departureAirport || "KBL",
                arrivalAirport: f.arrivalAirport || "DXB",
                departureDateTime: f.departureDateTime ? new Date(f.departureDateTime).toISOString().slice(0, 16) : "",
                arrivalDateTime: f.arrivalDateTime ? new Date(f.arrivalDateTime).toISOString().slice(0, 16) : "",
                cabinClass: f.cabinClass || "ECONOMY",
                ticketNumber: f.ticketNumber || "",
                pnr: f.pnr || "",
                baggageAllowance: f.baggageAllowance || "30 KG",
                isRefundable: Boolean(f.isRefundable),
                isChangeable: f.isChangeable !== false,
              }))
            : undefined,
          hotelDetail: s.hotelDetail
            ? {
                hotelName: s.hotelDetail.hotelName || "",
                city: s.hotelDetail.city || "",
                checkInDate: s.hotelDetail.checkInDate ? new Date(s.hotelDetail.checkInDate).toISOString().split("T")[0] : "",
                checkOutDate: s.hotelDetail.checkOutDate ? new Date(s.hotelDetail.checkOutDate).toISOString().split("T")[0] : "",
                roomType: s.hotelDetail.roomType || "Standard Room",
                roomsCount: s.hotelDetail.roomsCount || 1,
                nightsCount: s.hotelDetail.nightsCount || 1,
                mealPlan: s.hotelDetail.mealPlan || "Bed & Breakfast (BB)",
                confirmationNumber: s.hotelDetail.confirmationNumber || "",
                guestNames: s.hotelDetail.guestNames || "",
              }
            : undefined,
          visaDetail: s.visaDetail
            ? {
                destinationCountry: s.visaDetail.destinationCountry || "UAE",
                visaType: s.visaDetail.visaType || "Tourist Visa",
                applicantName: s.visaDetail.applicantName || "",
                applicationNumber: s.visaDetail.applicationNumber || "",
                submissionDate: s.visaDetail.submissionDate ? new Date(s.visaDetail.submissionDate).toISOString().split("T")[0] : "",
                expectedDate: s.visaDetail.expectedDate ? new Date(s.visaDetail.expectedDate).toISOString().split("T")[0] : "",
                visaStatus: s.visaDetail.visaStatus || "APPLIED",
              }
            : undefined,
          transferDetail: s.transferDetail
            ? {
                pickupLocation: s.transferDetail.pickupLocation || "",
                dropoffLocation: s.transferDetail.dropoffLocation || "",
                vehicleType: s.transferDetail.vehicleType || "Sedan",
                serviceDateTime: s.transferDetail.serviceDateTime ? new Date(s.transferDetail.serviceDateTime).toISOString().slice(0, 16) : "",
                passengerCount: s.transferDetail.passengerCount || 1,
              }
            : undefined,
        }))
      : [
          {
            supplierId: suppliers[0]?.id || "",
            serviceType: ServiceType.FLIGHT,
            description: "Roundtrip Flight Ticket",
            quantity: 1,
            passengerCount: 1,
            currency: "USD",
            exchangeRate: 70.5,
            costPriceForeign: 500,
            sellPriceForeign: 600,
            discountForeign: 0,
            taxAmountForeign: 0,
            flightSegments: [
              {
                airline: "Kam Air",
                flightNumber: "RQ-901",
                departureAirport: "KBL - Kabul",
                arrivalAirport: "DXB - Dubai",
                cabinClass: "ECONOMY",
                baggageAllowance: "30 KG",
              },
            ],
          },
        ]
  );

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Auto-fill currency exchange rate defaults
  const handleCurrencyChangeForService = (index: number, newCurrency: string) => {
    const updated = [...serviceItems];
    let defaultRate = 1.0;
    if (newCurrency === "USD") defaultRate = 70.5;
    else if (newCurrency === "EUR") defaultRate = 77.2;
    else if (newCurrency === "AED") defaultRate = 19.2;
    else if (newCurrency === "GBP") defaultRate = 91.5;
    else if (newCurrency === "AFN") defaultRate = 1.0;

    updated[index].currency = newCurrency;
    updated[index].exchangeRate = defaultRate;
    setServiceItems(updated);
  };

  // Passenger Handlers
  const addPassenger = () => {
    setPassengers([
      ...passengers,
      {
        title: "Mr",
        firstName: "",
        middleName: "",
        lastName: "",
        nationality: "Afghan",
        passportIssuingCountry: "Afghanistan",
        gender: "MALE",
      },
    ]);
  };

  const removePassenger = (index: number) => {
    if (passengers.length === 1) return;
    setPassengers(passengers.filter((_, i) => i !== index));
  };

  const updatePassenger = (index: number, field: keyof PassengerInput, value: any) => {
    const updated = [...passengers];
    updated[index] = { ...updated[index], [field]: value };
    setPassengers(updated);
  };

  // Service Item Handlers
  const addServiceItem = (type: ServiceType = ServiceType.FLIGHT) => {
    const defaultSupplier = suppliers.find((s) => s.type === (type as string)) || suppliers[0];
    const newItem: ServiceItemInput = {
      supplierId: defaultSupplier?.id || suppliers[0]?.id || "",
      serviceType: type,
      description: `${type} Reservation`,
      quantity: 1,
      passengerCount: Math.max(1, passengers.length),
      currency: "USD",
      exchangeRate: 70.5,
      costPriceForeign: 0,
      sellPriceForeign: 0,
      discountForeign: 0,
      taxAmountForeign: 0,
    };

    if (type === ServiceType.FLIGHT) {
      newItem.flightSegments = [
        {
          airline: "Kam Air",
          flightNumber: "",
          departureAirport: "KBL - Kabul",
          arrivalAirport: "DXB - Dubai",
          cabinClass: "ECONOMY",
          baggageAllowance: "30 KG",
        },
      ];
    } else if (type === ServiceType.HOTEL) {
      newItem.hotelDetail = {
        hotelName: "",
        city: destination || "Dubai",
        checkInDate: travelStartDate,
        checkOutDate: travelEndDate || travelStartDate,
        nightsCount: calculateHotelNights(travelStartDate, travelEndDate || travelStartDate),
        roomType: "Standard Room",
        roomsCount: 1,
        mealPlan: "Bed & Breakfast (BB)",
      };
    } else if (type === ServiceType.VISA) {
      newItem.visaDetail = {
        destinationCountry: "UAE",
        visaType: "Tourist Visa",
        applicantName: passengers[0] ? `${passengers[0].firstName} ${passengers[0].lastName}` : "",
        visaStatus: "APPLIED",
      };
    } else if (type === ServiceType.TRANSFER) {
      newItem.transferDetail = {
        pickupLocation: "Airport",
        dropoffLocation: "Hotel",
        vehicleType: "Sedan",
        passengerCount: Math.max(1, passengers.length),
      };
    }

    setServiceItems([...serviceItems, newItem]);
  };

  const removeServiceItem = (index: number) => {
    if (serviceItems.length === 1) return;
    setServiceItems(serviceItems.filter((_, i) => i !== index));
  };

  const updateServiceItem = (index: number, field: keyof ServiceItemInput, value: any) => {
    const updated = [...serviceItems];
    updated[index] = { ...updated[index], [field]: value };
    setServiceItems(updated);
  };

  // Hotel nights auto-calc
  const handleHotelDateChange = (index: number, checkIn: string, checkOut: string) => {
    const updated = [...serviceItems];
    if (updated[index].hotelDetail) {
      const nights = calculateHotelNights(checkIn, checkOut);
      updated[index].hotelDetail = {
        ...updated[index].hotelDetail!,
        checkInDate: checkIn,
        checkOutDate: checkOut,
        nightsCount: nights,
      };
      setServiceItems(updated);
    }
  };

  // Consolidated Financial Totals Calculation in real time
  const computedTotals = React.useMemo(() => {
    try {
      const calculated = serviceItems.map((item) => {
        return calculateServicePrices({
          quantity: item.quantity,
          passengerCount: item.passengerCount,
          currency: item.currency,
          exchangeRate: item.exchangeRate,
          costPriceForeign: item.costPriceForeign,
          sellPriceForeign: item.sellPriceForeign,
          discountForeign: item.discountForeign,
          taxAmountForeign: item.taxAmountForeign,
        });
      });
      return calculateBookingTotals(calculated);
    } catch {
      return null;
    }
  }, [serviceItems]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    setErrorMessage(null);

    // Basic Validations
    if (!customerId) {
      setErrorMessage("Please select a customer for the booking");
      setIsSubmitting(false);
      return;
    }

    if (!travelStartDate) {
      setErrorMessage("Please specify the travel start date");
      setIsSubmitting(false);
      return;
    }

    const invalidPax = passengers.some((p) => !p.firstName.trim() || !p.lastName.trim());
    if (invalidPax) {
      setErrorMessage("Every passenger must have at least a First Name and Last Name");
      setIsSubmitting(false);
      return;
    }

    const invalidService = serviceItems.some(
      (s) => !s.supplierId || Number(s.costPriceForeign) < 0 || Number(s.sellPriceForeign) < 0
    );
    if (invalidService) {
      setErrorMessage("All travel services must have an assigned supplier and non-negative amounts");
      setIsSubmitting(false);
      return;
    }

    try {
      const payload: CreateBookingInput = {
        customerId,
        pnrOrRef,
        confirmationNumber,
        salesAgent,
        destination,
        travelStartDate,
        travelEndDate: travelEndDate || undefined,
        status,
        currency,
        notes,
        internalNotes,
        passengers,
        serviceItems,
      };

      let res;
      if (isEditing) {
        res = await updateBooking({ ...payload, id: initialData.id });
      } else {
        res = await createBooking(payload);
      }

      if (res.success) {
        router.push(isEditing ? `/bookings/${initialData.id}` : `/bookings/${res.data?.id}`);
        router.refresh();
      } else {
        setErrorMessage(res.error || "Failed to save booking");
      }
    } catch (err: any) {
      setErrorMessage(err.message || "An unexpected error occurred");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-8 max-w-7xl mx-auto pb-16">
      {/* Header Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-200 dark:border-slate-800 pb-5">
        <div>
          <div className="flex items-center gap-3">
            <Link
              href="/bookings"
              className="p-1.5 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg transition-colors"
            >
              <ArrowLeft className="w-5 h-5" />
            </Link>
            <div>
              <h1 className="text-2xl font-bold text-slate-900 dark:text-white">
                {isEditing ? `Edit Booking #${initialData.bookingNumber}` : "Create Travel Booking"}
              </h1>
              <p className="text-xs text-slate-500 mt-0.5">
                Multi-Passenger Roster & Multi-Currency Services Engine (AFN Base)
              </p>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <Link
            href="/bookings"
            className="px-4 py-2 text-sm font-medium rounded-lg border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
          >
            Cancel
          </Link>
          <button
            type="submit"
            disabled={isSubmitting}
            className="inline-flex items-center gap-2 px-5 py-2 text-sm font-semibold rounded-lg bg-blue-600 hover:bg-blue-700 text-white shadow-sm disabled:opacity-50 transition-colors"
          >
            <Save className="w-4 h-4" />
            {isSubmitting ? "Saving..." : isEditing ? "Update Booking" : "Save Booking"}
          </button>
        </div>
      </div>

      {errorMessage && (
        <div className="p-4 bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-900 text-rose-700 dark:text-rose-300 text-sm rounded-xl flex items-center gap-3">
          <AlertCircle className="w-5 h-5 shrink-0" />
          <span>{errorMessage}</span>
        </div>
      )}

      {/* SECTION 1: MASTER BOOKING HEADER */}
      <div className="p-6 rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-sm space-y-6">
        <h2 className="text-base font-bold text-slate-900 dark:text-white flex items-center gap-2">
          <Layers className="w-5 h-5 text-blue-600" />
          Booking Details & Customer Profile
        </h2>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
          <div>
            <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 uppercase tracking-wider mb-1.5">
              Customer / Billing Entity *
            </label>
            <select
              value={customerId}
              onChange={(e) => setCustomerId(e.target.value)}
              required
              className="w-full px-3.5 py-2 text-sm rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500 font-medium"
            >
              <option value="">-- Select Customer --</option>
              {customers.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.code} - {c.name} {c.companyName ? `(${c.companyName})` : ""}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 uppercase tracking-wider mb-1.5">
              Primary Airline PNR / GDS Reference
            </label>
            <input
              type="text"
              placeholder="e.g. 7X9KBL, FG301"
              value={pnrOrRef}
              onChange={(e) => setPnrOrRef(e.target.value)}
              className="w-full px-3.5 py-2 text-sm rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500 font-mono font-semibold uppercase"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 uppercase tracking-wider mb-1.5">
              Destination / Route Summary
            </label>
            <input
              type="text"
              placeholder="e.g. Dubai, Istanbul, Delhi, Jeddah"
              value={destination}
              onChange={(e) => setDestination(e.target.value)}
              className="w-full px-3.5 py-2 text-sm rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 uppercase tracking-wider mb-1.5">
              Travel Start Date *
            </label>
            <input
              type="date"
              required
              value={travelStartDate}
              onChange={(e) => setTravelStartDate(e.target.value)}
              className="w-full px-3.5 py-2 text-sm rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 uppercase tracking-wider mb-1.5">
              Travel End Date (Return)
            </label>
            <input
              type="date"
              value={travelEndDate}
              onChange={(e) => setTravelEndDate(e.target.value)}
              className="w-full px-3.5 py-2 text-sm rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 uppercase tracking-wider mb-1.5">
              Booking Status
            </label>
            <select
              value={status}
              onChange={(e) => setStatus(e.target.value as BookingStatus)}
              className="w-full px-3.5 py-2 text-sm rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500 font-semibold"
            >
              <option value="CONFIRMED">CONFIRMED</option>
              <option value="QUOTATION">QUOTATION</option>
              <option value="DRAFT">DRAFT</option>
              <option value="TICKETED">TICKETED</option>
            </select>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 uppercase tracking-wider mb-1.5">
              Sales Agent / Consultant
            </label>
            <input
              type="text"
              placeholder="e.g. Ahmad Tariq"
              value={salesAgent}
              onChange={(e) => setSalesAgent(e.target.value)}
              className="w-full px-3.5 py-2 text-sm rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 uppercase tracking-wider mb-1.5">
              External Reference / Voucher #
            </label>
            <input
              type="text"
              placeholder="e.g. VOUCH-88910"
              value={confirmationNumber}
              onChange={(e) => setConfirmationNumber(e.target.value)}
              className="w-full px-3.5 py-2 text-sm rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500 font-mono"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 uppercase tracking-wider mb-1.5">
              Customer Notes / Itinerary Memo
            </label>
            <input
              type="text"
              placeholder="Special instructions visible to customer..."
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              className="w-full px-3.5 py-2 text-sm rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
        </div>
      </div>

      {/* SECTION 2: PASSENGERS ROSTER */}
      <div className="p-6 rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-sm space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-base font-bold text-slate-900 dark:text-white flex items-center gap-2">
              <Users className="w-5 h-5 text-indigo-600" />
              Passengers Roster ({passengers.length})
            </h2>
            <p className="text-xs text-slate-500 mt-0.5">
              Passenger identities are distinct from the corporate billing customer.
            </p>
          </div>
          <button
            type="button"
            onClick={addPassenger}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-lg bg-indigo-50 dark:bg-indigo-950/40 text-indigo-700 dark:text-indigo-300 hover:bg-indigo-100 transition-colors"
          >
            <Plus className="w-3.5 h-3.5" /> Add Passenger
          </button>
        </div>

        <div className="space-y-4">
          {passengers.map((pax, index) => (
            <div
              key={index}
              className="p-4 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50/60 dark:bg-slate-800/40 space-y-4"
            >
              <div className="flex items-center justify-between border-b border-slate-200 dark:border-slate-700 pb-2">
                <span className="text-xs font-bold text-indigo-700 dark:text-indigo-400 uppercase tracking-wider">
                  Passenger #{index + 1} {index === 0 ? "(Lead Passenger)" : ""}
                </span>
                {passengers.length > 1 && (
                  <button
                    type="button"
                    onClick={() => removePassenger(index)}
                    className="text-slate-400 hover:text-rose-600 transition-colors"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                )}
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-6 gap-3 text-xs">
                <div>
                  <label className="font-semibold text-slate-600 dark:text-slate-400">Title</label>
                  <select
                    value={pax.title}
                    onChange={(e) => updatePassenger(index, "title", e.target.value)}
                    className="mt-1 w-full px-2.5 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800"
                  >
                    <option value="Mr">Mr</option>
                    <option value="Mrs">Mrs</option>
                    <option value="Ms">Ms</option>
                    <option value="Dr">Dr</option>
                    <option value="Child">Child</option>
                    <option value="Infant">Infant</option>
                  </select>
                </div>

                <div>
                  <label className="font-semibold text-slate-600 dark:text-slate-400">First Name *</label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. Ahmad"
                    value={pax.firstName}
                    onChange={(e) => updatePassenger(index, "firstName", e.target.value)}
                    className="mt-1 w-full px-2.5 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 font-medium"
                  />
                </div>

                <div>
                  <label className="font-semibold text-slate-600 dark:text-slate-400">Middle Name</label>
                  <input
                    type="text"
                    placeholder="e.g. Zia"
                    value={pax.middleName || ""}
                    onChange={(e) => updatePassenger(index, "middleName", e.target.value)}
                    className="mt-1 w-full px-2.5 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800"
                  />
                </div>

                <div>
                  <label className="font-semibold text-slate-600 dark:text-slate-400">Last Name *</label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. Popal"
                    value={pax.lastName}
                    onChange={(e) => updatePassenger(index, "lastName", e.target.value)}
                    className="mt-1 w-full px-2.5 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 font-medium"
                  />
                </div>

                <div>
                  <label className="font-semibold text-slate-600 dark:text-slate-400">Date of Birth</label>
                  <input
                    type="date"
                    value={pax.dateOfBirth || ""}
                    onChange={(e) => updatePassenger(index, "dateOfBirth", e.target.value)}
                    className="mt-1 w-full px-2.5 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800"
                  />
                </div>

                <div>
                  <label className="font-semibold text-slate-600 dark:text-slate-400">Gender</label>
                  <select
                    value={pax.gender || "MALE"}
                    onChange={(e) => updatePassenger(index, "gender", e.target.value)}
                    className="mt-1 w-full px-2.5 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800"
                  >
                    <option value="MALE">Male</option>
                    <option value="FEMALE">Female</option>
                    <option value="OTHER">Other</option>
                  </select>
                </div>

                <div>
                  <label className="font-semibold text-slate-600 dark:text-slate-400">Passport Number</label>
                  <input
                    type="text"
                    placeholder="e.g. O12345678"
                    value={pax.passportNumber || ""}
                    onChange={(e) => updatePassenger(index, "passportNumber", e.target.value)}
                    className="mt-1 w-full px-2.5 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 font-mono uppercase"
                  />
                </div>

                <div>
                  <label className="font-semibold text-slate-600 dark:text-slate-400">Passport Expiry</label>
                  <input
                    type="date"
                    value={pax.passportExpiryDate || ""}
                    onChange={(e) => updatePassenger(index, "passportExpiryDate", e.target.value)}
                    className="mt-1 w-full px-2.5 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800"
                  />
                </div>

                <div>
                  <label className="font-semibold text-slate-600 dark:text-slate-400">Nationality</label>
                  <input
                    type="text"
                    value={pax.nationality || "Afghan"}
                    onChange={(e) => updatePassenger(index, "nationality", e.target.value)}
                    className="mt-1 w-full px-2.5 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800"
                  />
                </div>

                <div>
                  <label className="font-semibold text-slate-600 dark:text-slate-400">Visa / Resident #</label>
                  <input
                    type="text"
                    placeholder="e.g. V-998811"
                    value={pax.visaNumber || ""}
                    onChange={(e) => updatePassenger(index, "visaNumber", e.target.value)}
                    className="mt-1 w-full px-2.5 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 font-mono"
                  />
                </div>

                <div>
                  <label className="font-semibold text-slate-600 dark:text-slate-400">Contact Phone</label>
                  <input
                    type="text"
                    placeholder="+93 700 123 456"
                    value={pax.phone || ""}
                    onChange={(e) => updatePassenger(index, "phone", e.target.value)}
                    className="mt-1 w-full px-2.5 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800"
                  />
                </div>

                <div>
                  <label className="font-semibold text-slate-600 dark:text-slate-400">Special Meal/Wheelchair</label>
                  <input
                    type="text"
                    placeholder="e.g. Halal meal, WCHR"
                    value={pax.specialRequirements || ""}
                    onChange={(e) => updatePassenger(index, "specialRequirements", e.target.value)}
                    className="mt-1 w-full px-2.5 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800"
                  />
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* SECTION 3: MULTI-SERVICE ITEMS BUILDER */}
      <div className="p-6 rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-sm space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <h2 className="text-base font-bold text-slate-900 dark:text-white flex items-center gap-2">
              <Plane className="w-5 h-5 text-sky-600" />
              Travel Service Items & Multi-Currency Pricing
            </h2>
            <p className="text-xs text-slate-500 mt-0.5">
              Specify supplier costs, client selling rates, exchange rates, and detailed segment specifications.
            </p>
          </div>

          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => addServiceItem(ServiceType.FLIGHT)}
              className="inline-flex items-center gap-1 px-2.5 py-1.5 text-xs font-semibold rounded-lg bg-sky-50 dark:bg-sky-950/40 text-sky-700 dark:text-sky-300 hover:bg-sky-100 transition-colors"
            >
              <Plane className="w-3.5 h-3.5" /> + Flight
            </button>
            <button
              type="button"
              onClick={() => addServiceItem(ServiceType.HOTEL)}
              className="inline-flex items-center gap-1 px-2.5 py-1.5 text-xs font-semibold rounded-lg bg-amber-50 dark:bg-amber-950/40 text-amber-700 dark:text-amber-300 hover:bg-amber-100 transition-colors"
            >
              <Building className="w-3.5 h-3.5" /> + Hotel
            </button>
            <button
              type="button"
              onClick={() => addServiceItem(ServiceType.VISA)}
              className="inline-flex items-center gap-1 px-2.5 py-1.5 text-xs font-semibold rounded-lg bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300 hover:bg-emerald-100 transition-colors"
            >
              <FileCheck className="w-3.5 h-3.5" /> + Visa
            </button>
            <button
              type="button"
              onClick={() => addServiceItem(ServiceType.TRANSFER)}
              className="inline-flex items-center gap-1 px-2.5 py-1.5 text-xs font-semibold rounded-lg bg-purple-50 dark:bg-purple-950/40 text-purple-700 dark:text-purple-300 hover:bg-purple-100 transition-colors"
            >
              <Car className="w-3.5 h-3.5" /> + Transfer
            </button>
            <button
              type="button"
              onClick={() => addServiceItem(ServiceType.TOUR)}
              className="inline-flex items-center gap-1 px-2.5 py-1.5 text-xs font-semibold rounded-lg bg-rose-50 dark:bg-rose-950/40 text-rose-700 dark:text-rose-300 hover:bg-rose-100 transition-colors"
            >
              <Compass className="w-3.5 h-3.5" /> + Tour
            </button>
          </div>
        </div>

        <div className="space-y-6">
          {serviceItems.map((item, index) => {
            const calculatedItem = calculateServicePrices({
              quantity: item.quantity,
              passengerCount: item.passengerCount,
              currency: item.currency,
              exchangeRate: item.exchangeRate,
              costPriceForeign: item.costPriceForeign,
              sellPriceForeign: item.sellPriceForeign,
              discountForeign: item.discountForeign,
              taxAmountForeign: item.taxAmountForeign,
            });

            return (
              <div
                key={index}
                className="p-5 rounded-2xl border border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-800/30 space-y-5"
              >
                {/* Item Header & Service Type Bar */}
                <div className="flex items-center justify-between border-b border-slate-200 dark:border-slate-700 pb-3">
                  <div className="flex items-center gap-2">
                    <span className="px-2.5 py-1 rounded-md text-xs font-bold uppercase tracking-wider bg-blue-600 text-white">
                      {item.serviceType} #{index + 1}
                    </span>
                    <input
                      type="text"
                      required
                      placeholder="Service description / route..."
                      value={item.description}
                      onChange={(e) => updateServiceItem(index, "description", e.target.value)}
                      className="px-3 py-1 text-sm font-semibold rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white"
                    />
                  </div>

                  <div className="flex items-center gap-3">
                    <div className="text-xs font-bold font-mono text-emerald-600 dark:text-emerald-400">
                      AFN Margin: {calculatedItem.marginAmount.toNumber().toLocaleString(undefined, { minimumFractionDigits: 2 })}
                    </div>
                    {serviceItems.length > 1 && (
                      <button
                        type="button"
                        onClick={() => removeServiceItem(index)}
                        className="text-slate-400 hover:text-rose-600 transition-colors"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    )}
                  </div>
                </div>

                {/* Pricing & Multi-Currency Grid */}
                <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-8 gap-3 text-xs">
                  <div className="col-span-2">
                    <label className="font-semibold text-slate-600 dark:text-slate-400">Supplier *</label>
                    <select
                      value={item.supplierId}
                      onChange={(e) => updateServiceItem(index, "supplierId", e.target.value)}
                      required
                      className="mt-1 w-full px-2.5 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 font-medium"
                    >
                      <option value="">-- Select Supplier --</option>
                      {suppliers.map((s) => (
                        <option key={s.id} value={s.id}>
                          {s.name} ({s.type})
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="font-semibold text-slate-600 dark:text-slate-400">Currency</label>
                    <select
                      value={item.currency}
                      onChange={(e) => handleCurrencyChangeForService(index, e.target.value)}
                      className="mt-1 w-full px-2.5 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 font-bold"
                    >
                      {defaultCurrencies.map((c) => (
                        <option key={c} value={c}>
                          {c}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="font-semibold text-slate-600 dark:text-slate-400">Exchange Rate (AFN)</label>
                    <input
                      type="number"
                      step="0.0001"
                      required
                      min="0.0001"
                      value={item.exchangeRate as any}
                      onChange={(e) => updateServiceItem(index, "exchangeRate", parseFloat(e.target.value) || 1)}
                      className="mt-1 w-full px-2.5 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 font-mono font-medium"
                    />
                  </div>

                  <div>
                    <label className="font-semibold text-slate-600 dark:text-slate-400">Qty</label>
                    <input
                      type="number"
                      min="1"
                      required
                      value={item.quantity}
                      onChange={(e) => updateServiceItem(index, "quantity", parseInt(e.target.value) || 1)}
                      className="mt-1 w-full px-2.5 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800"
                    />
                  </div>

                  <div>
                    <label className="font-semibold text-slate-600 dark:text-slate-400">Unit Cost ({item.currency})</label>
                    <input
                      type="number"
                      step="0.01"
                      min="0"
                      required
                      value={item.costPriceForeign as any}
                      onChange={(e) => updateServiceItem(index, "costPriceForeign", parseFloat(e.target.value) || 0)}
                      className="mt-1 w-full px-2.5 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 font-mono font-medium text-rose-600"
                    />
                  </div>

                  <div>
                    <label className="font-semibold text-slate-600 dark:text-slate-400">Unit Sell ({item.currency})</label>
                    <input
                      type="number"
                      step="0.01"
                      min="0"
                      required
                      value={item.sellPriceForeign as any}
                      onChange={(e) => updateServiceItem(index, "sellPriceForeign", parseFloat(e.target.value) || 0)}
                      className="mt-1 w-full px-2.5 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 font-mono font-bold text-blue-600"
                    />
                  </div>

                  <div>
                    <label className="font-semibold text-slate-600 dark:text-slate-400">Discount ({item.currency})</label>
                    <input
                      type="number"
                      step="0.01"
                      min="0"
                      value={item.discountForeign as any}
                      onChange={(e) => updateServiceItem(index, "discountForeign", parseFloat(e.target.value) || 0)}
                      className="mt-1 w-full px-2.5 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 font-mono"
                    />
                  </div>
                </div>

                {/* Sub-Detail Forms Based on Service Type */}
                {item.serviceType === ServiceType.FLIGHT && (
                  <div className="p-3.5 rounded-xl border border-sky-200 dark:border-sky-900/60 bg-sky-50/50 dark:bg-sky-950/20 space-y-3">
                    <p className="text-xs font-bold text-sky-800 dark:text-sky-300 uppercase tracking-wider flex items-center gap-1.5">
                      <Plane className="w-3.5 h-3.5" /> Flight Segment Specifications
                    </p>
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-6 gap-3 text-xs">
                      <div>
                        <label className="font-medium text-slate-600 dark:text-slate-400">Airline</label>
                        <input
                          type="text"
                          placeholder="e.g. Kam Air, Ariana, Emirates"
                          value={item.flightSegments?.[0]?.airline || "Kam Air"}
                          onChange={(e) => {
                            const updated = [...serviceItems];
                            if (!updated[index].flightSegments) updated[index].flightSegments = [{} as any];
                            updated[index].flightSegments![0].airline = e.target.value;
                            setServiceItems(updated);
                          }}
                          className="mt-1 w-full px-2.5 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800"
                        />
                      </div>

                      <div>
                        <label className="font-medium text-slate-600 dark:text-slate-400">Flight #</label>
                        <input
                          type="text"
                          placeholder="e.g. RQ-901"
                          value={item.flightSegments?.[0]?.flightNumber || ""}
                          onChange={(e) => {
                            const updated = [...serviceItems];
                            if (!updated[index].flightSegments) updated[index].flightSegments = [{} as any];
                            updated[index].flightSegments![0].flightNumber = e.target.value;
                            setServiceItems(updated);
                          }}
                          className="mt-1 w-full px-2.5 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 font-mono"
                        />
                      </div>

                      <div>
                        <label className="font-medium text-slate-600 dark:text-slate-400">Departure Airport</label>
                        <input
                          type="text"
                          placeholder="e.g. KBL - Kabul"
                          value={item.flightSegments?.[0]?.departureAirport || "KBL"}
                          onChange={(e) => {
                            const updated = [...serviceItems];
                            if (!updated[index].flightSegments) updated[index].flightSegments = [{} as any];
                            updated[index].flightSegments![0].departureAirport = e.target.value;
                            setServiceItems(updated);
                          }}
                          className="mt-1 w-full px-2.5 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800"
                        />
                      </div>

                      <div>
                        <label className="font-medium text-slate-600 dark:text-slate-400">Arrival Airport</label>
                        <input
                          type="text"
                          placeholder="e.g. DXB - Dubai"
                          value={item.flightSegments?.[0]?.arrivalAirport || "DXB"}
                          onChange={(e) => {
                            const updated = [...serviceItems];
                            if (!updated[index].flightSegments) updated[index].flightSegments = [{} as any];
                            updated[index].flightSegments![0].arrivalAirport = e.target.value;
                            setServiceItems(updated);
                          }}
                          className="mt-1 w-full px-2.5 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800"
                        />
                      </div>

                      <div>
                        <label className="font-medium text-slate-600 dark:text-slate-400">Cabin Class</label>
                        <select
                          value={item.flightSegments?.[0]?.cabinClass || "ECONOMY"}
                          onChange={(e) => {
                            const updated = [...serviceItems];
                            if (!updated[index].flightSegments) updated[index].flightSegments = [{} as any];
                            updated[index].flightSegments![0].cabinClass = e.target.value;
                            setServiceItems(updated);
                          }}
                          className="mt-1 w-full px-2.5 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800"
                        >
                          <option value="ECONOMY">Economy</option>
                          <option value="PREMIUM_ECONOMY">Premium Economy</option>
                          <option value="BUSINESS">Business</option>
                          <option value="FIRST">First</option>
                        </select>
                      </div>

                      <div>
                        <label className="font-medium text-slate-600 dark:text-slate-400">Baggage Allowance</label>
                        <input
                          type="text"
                          placeholder="e.g. 30 KG"
                          value={item.flightSegments?.[0]?.baggageAllowance || "30 KG"}
                          onChange={(e) => {
                            const updated = [...serviceItems];
                            if (!updated[index].flightSegments) updated[index].flightSegments = [{} as any];
                            updated[index].flightSegments![0].baggageAllowance = e.target.value;
                            setServiceItems(updated);
                          }}
                          className="mt-1 w-full px-2.5 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800"
                        />
                      </div>
                    </div>
                  </div>
                )}

                {item.serviceType === ServiceType.HOTEL && (
                  <div className="p-3.5 rounded-xl border border-amber-200 dark:border-amber-900/60 bg-amber-50/50 dark:bg-amber-950/20 space-y-3">
                    <p className="text-xs font-bold text-amber-800 dark:text-amber-300 uppercase tracking-wider flex items-center gap-1.5">
                      <Building className="w-3.5 h-3.5" /> Hotel Booking Specifications
                    </p>
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-6 gap-3 text-xs">
                      <div className="col-span-2">
                        <label className="font-medium text-slate-600 dark:text-slate-400">Hotel Name</label>
                        <input
                          type="text"
                          placeholder="e.g. Grand Millennium Hotel Dubai"
                          value={item.hotelDetail?.hotelName || ""}
                          onChange={(e) => {
                            const updated = [...serviceItems];
                            if (!updated[index].hotelDetail) updated[index].hotelDetail = {} as any;
                            updated[index].hotelDetail!.hotelName = e.target.value;
                            setServiceItems(updated);
                          }}
                          className="mt-1 w-full px-2.5 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800"
                        />
                      </div>

                      <div>
                        <label className="font-medium text-slate-600 dark:text-slate-400">Check-in</label>
                        <input
                          type="date"
                          value={item.hotelDetail?.checkInDate || travelStartDate}
                          onChange={(e) =>
                            handleHotelDateChange(
                              index,
                              e.target.value,
                              item.hotelDetail?.checkOutDate || travelEndDate || travelStartDate
                            )
                          }
                          className="mt-1 w-full px-2.5 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800"
                        />
                      </div>

                      <div>
                        <label className="font-medium text-slate-600 dark:text-slate-400">Check-out</label>
                        <input
                          type="date"
                          value={item.hotelDetail?.checkOutDate || travelEndDate || travelStartDate}
                          onChange={(e) =>
                            handleHotelDateChange(
                              index,
                              item.hotelDetail?.checkInDate || travelStartDate,
                              e.target.value
                            )
                          }
                          className="mt-1 w-full px-2.5 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800"
                        />
                      </div>

                      <div>
                        <label className="font-medium text-slate-600 dark:text-slate-400">Nights (Auto/Override)</label>
                        <input
                          type="number"
                          min="1"
                          value={item.hotelDetail?.nightsCount || 1}
                          onChange={(e) => {
                            const updated = [...serviceItems];
                            if (updated[index].hotelDetail) {
                              updated[index].hotelDetail!.nightsCount = parseInt(e.target.value) || 1;
                              setServiceItems(updated);
                            }
                          }}
                          className="mt-1 w-full px-2.5 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 font-bold"
                        />
                      </div>

                      <div>
                        <label className="font-medium text-slate-600 dark:text-slate-400">Meal Plan</label>
                        <select
                          value={item.hotelDetail?.mealPlan || "Bed & Breakfast (BB)"}
                          onChange={(e) => {
                            const updated = [...serviceItems];
                            if (updated[index].hotelDetail) {
                              updated[index].hotelDetail!.mealPlan = e.target.value;
                              setServiceItems(updated);
                            }
                          }}
                          className="mt-1 w-full px-2.5 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800"
                        >
                          <option value="Room Only (RO)">Room Only (RO)</option>
                          <option value="Bed & Breakfast (BB)">Bed & Breakfast (BB)</option>
                          <option value="Half Board (HB)">Half Board (HB)</option>
                          <option value="Full Board (FB)">Full Board (FB)</option>
                          <option value="All Inclusive (AI)">All Inclusive (AI)</option>
                        </select>
                      </div>
                    </div>
                  </div>
                )}

                {item.serviceType === ServiceType.VISA && (
                  <div className="p-3.5 rounded-xl border border-emerald-200 dark:border-emerald-900/60 bg-emerald-50/50 dark:bg-emerald-950/20 space-y-3">
                    <p className="text-xs font-bold text-emerald-800 dark:text-emerald-300 uppercase tracking-wider flex items-center gap-1.5">
                      <FileCheck className="w-3.5 h-3.5" /> Visa Application Specifications
                    </p>
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 text-xs">
                      <div>
                        <label className="font-medium text-slate-600 dark:text-slate-400">Destination Country</label>
                        <input
                          type="text"
                          placeholder="e.g. UAE, Turkey, Uzbekistan, Iran"
                          value={item.visaDetail?.destinationCountry || "UAE"}
                          onChange={(e) => {
                            const updated = [...serviceItems];
                            if (!updated[index].visaDetail) updated[index].visaDetail = {} as any;
                            updated[index].visaDetail!.destinationCountry = e.target.value;
                            setServiceItems(updated);
                          }}
                          className="mt-1 w-full px-2.5 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800"
                        />
                      </div>

                      <div>
                        <label className="font-medium text-slate-600 dark:text-slate-400">Visa Category</label>
                        <input
                          type="text"
                          placeholder="e.g. 30 Days Tourist, Business, Umrah"
                          value={item.visaDetail?.visaType || "Tourist Visa"}
                          onChange={(e) => {
                            const updated = [...serviceItems];
                            if (!updated[index].visaDetail) updated[index].visaDetail = {} as any;
                            updated[index].visaDetail!.visaType = e.target.value;
                            setServiceItems(updated);
                          }}
                          className="mt-1 w-full px-2.5 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800"
                        />
                      </div>

                      <div>
                        <label className="font-medium text-slate-600 dark:text-slate-400">Application / Ref #</label>
                        <input
                          type="text"
                          placeholder="e.g. APPL-55443"
                          value={item.visaDetail?.applicationNumber || ""}
                          onChange={(e) => {
                            const updated = [...serviceItems];
                            if (!updated[index].visaDetail) updated[index].visaDetail = {} as any;
                            updated[index].visaDetail!.applicationNumber = e.target.value;
                            setServiceItems(updated);
                          }}
                          className="mt-1 w-full px-2.5 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 font-mono"
                        />
                      </div>

                      <div>
                        <label className="font-medium text-slate-600 dark:text-slate-400">Visa Status</label>
                        <select
                          value={item.visaDetail?.visaStatus || "APPLIED"}
                          onChange={(e) => {
                            const updated = [...serviceItems];
                            if (!updated[index].visaDetail) updated[index].visaDetail = {} as any;
                            updated[index].visaDetail!.visaStatus = e.target.value;
                            setServiceItems(updated);
                          }}
                          className="mt-1 w-full px-2.5 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800"
                        >
                          <option value="APPLIED">Applied</option>
                          <option value="IN_PROCESS">In Process</option>
                          <option value="APPROVED">Approved</option>
                          <option value="REJECTED">Rejected</option>
                        </select>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* SECTION 4: CONSOLIDATED REAL-TIME FINANCIAL SUMMARY BAR */}
      {computedTotals && (
        <div className="p-6 rounded-2xl border-2 border-blue-500/30 bg-gradient-to-br from-slate-900 to-slate-950 text-white shadow-xl space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-800 pb-3">
            <h3 className="text-sm font-bold uppercase tracking-wider text-blue-400 flex items-center gap-2">
              <DollarSign className="w-4 h-4" />
              Consolidated Booking Financial Summary (AFN Base)
            </h3>
            <span className="text-xs text-slate-400">
              * Operational Source Document (GL Posting reserved for Invoicing Phase)
            </span>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-4">
            <div>
              <p className="text-xs text-slate-400">Gross Selling</p>
              <p className="text-lg font-bold text-white mt-0.5 font-mono">
                {computedTotals.totalSellPrice.toNumber().toLocaleString(undefined, { minimumFractionDigits: 2 })}
              </p>
              <span className="text-[10px] text-slate-500">AFN</span>
            </div>

            <div>
              <p className="text-xs text-slate-400">Total Discount</p>
              <p className="text-lg font-bold text-amber-400 mt-0.5 font-mono">
                {computedTotals.totalDiscount.toNumber().toLocaleString(undefined, { minimumFractionDigits: 2 })}
              </p>
              <span className="text-[10px] text-slate-500">AFN</span>
            </div>

            <div>
              <p className="text-xs text-slate-400">Net Selling Price</p>
              <p className="text-xl font-extrabold text-blue-400 mt-0.5 font-mono">
                {computedTotals.totalNetSelling.toNumber().toLocaleString(undefined, { minimumFractionDigits: 2 })}
              </p>
              <span className="text-[10px] text-slate-500">AFN Client Billing</span>
            </div>

            <div>
              <p className="text-xs text-slate-400">Supplier Direct Cost</p>
              <p className="text-lg font-bold text-rose-400 mt-0.5 font-mono">
                {computedTotals.totalCostPrice.toNumber().toLocaleString(undefined, { minimumFractionDigits: 2 })}
              </p>
              <span className="text-[10px] text-slate-500">AFN Payable Cost</span>
            </div>

            <div className="col-span-2 p-3 rounded-xl bg-emerald-950/40 border border-emerald-800/50">
              <div className="flex items-center justify-between">
                <p className="text-xs font-semibold text-emerald-400 uppercase tracking-wider">Gross Profit</p>
                <span className="text-xs font-bold px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300">
                  {computedTotals.marginPercentage.toString()}% Margin
                </span>
              </div>
              <p className="text-2xl font-black text-emerald-300 mt-1 font-mono">
                {computedTotals.totalGrossMargin.toNumber().toLocaleString(undefined, { minimumFractionDigits: 2 })}{" "}
                <span className="text-xs font-normal text-emerald-400">AFN</span>
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Action Submit Buttons */}
      <div className="flex justify-end gap-3 pt-4">
        <Link
          href="/bookings"
          className="px-6 py-2.5 text-sm font-medium rounded-lg border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
        >
          Cancel
        </Link>
        <button
          type="submit"
          disabled={isSubmitting}
          className="inline-flex items-center gap-2 px-8 py-2.5 text-sm font-bold rounded-lg bg-blue-600 hover:bg-blue-700 text-white shadow-md shadow-blue-500/20 disabled:opacity-50 transition-colors"
        >
          <Save className="w-4 h-4" />
          {isSubmitting ? "Saving Booking..." : isEditing ? "Update Booking" : "Confirm & Save Booking"}
        </button>
      </div>
    </form>
  );
}
