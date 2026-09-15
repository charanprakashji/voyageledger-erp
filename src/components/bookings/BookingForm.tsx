"use client";

import React, { useState, useMemo, useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import {
  Users,
  Plane,
  Building,
  FileCheck,
  Plus,
  Trash2,
  Save,
  ArrowLeft,
  DollarSign,
  AlertCircle,
  Clock,
  Layers,
  UploadCloud,
  FileText,
  Search,
  CheckCircle2,
  XCircle,
  CreditCard,
  UserCheck,
  Sparkles,
  Info,
  Calendar,
  Check,
  ShieldCheck,
  Tag,
  Loader2,
  PenTool,
  Percent,
  Calculator,
  ArrowRight,
} from "lucide-react";
import { BookingStatus, ServiceType, ServiceStatus } from "@prisma/client";
import {
  createBooking,
  updateBooking,
  getSavedPassengers,
  CreateBookingInput,
  PassengerInput,
  ServiceItemInput,
  FlightSegmentInput,
  HotelDetailInput,
  VisaDetailInput,
} from "@/app/actions/bookings";
import { calculateHotelNights, calculateServicePrices, calculateBookingTotals } from "@/lib/booking";
import { processUploadedTicketDocument, ScannedTicketData } from "@/lib/ocr/ticketScanner";
import Decimal from "decimal.js";

interface BookingFormProps {
  initialData?: any;
  customers: Array<{ id: string; name: string; code: string; companyName?: string | null; defaultCurrency?: string }>;
  suppliers: Array<{ id: string; name: string; code: string; type: string; currency?: string }>;
  employees?: Array<{ id: string; name: string; email?: string; role?: string }>;
  accounts?: Array<{ id: string; code: string; name: string; currency?: string }>;
  defaultCurrencies?: string[];
}

// Utility: Compute Passenger Age Category (ADT / CHD / INF)
function computeAgeCategory(dobString?: string): "ADT" | "CHD" | "INF" | null {
  if (!dobString) return null;
  const dob = new Date(dobString);
  if (isNaN(dob.getTime())) return null;
  const today = new Date();
  let age = today.getFullYear() - dob.getFullYear();
  const m = today.getMonth() - dob.getMonth();
  if (m < 0 || (m === 0 && today.getDate() < dob.getDate())) {
    age--;
  }
  if (age >= 12) return "ADT";
  if (age >= 2) return "CHD";
  return "INF";
}

export function BookingForm({
  initialData,
  customers,
  suppliers,
  employees = [],
  accounts = [],
  defaultCurrencies = ["AFN", "USD", "EUR", "AED", "GBP"],
}: BookingFormProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const isEditing = Boolean(initialData?.id);

  // Service Activation Toggles: [Ticket] [Visa] [Hotel]
  const initialServices = useMemo(() => {
    if (initialData?.serviceItems?.length) {
      const types = initialData.serviceItems.map((s: any) => s.serviceType);
      return {
        ticket: types.includes("FLIGHT"),
        visa: types.includes("VISA"),
        hotel: types.includes("HOTEL"),
      };
    }
    const preselect = searchParams?.get("service")?.toLowerCase();
    if (preselect === "ticket" || preselect === "flight") return { ticket: true, visa: false, hotel: false };
    if (preselect === "visa") return { ticket: false, visa: true, hotel: false };
    if (preselect === "hotel") return { ticket: false, visa: false, hotel: true };
    return { ticket: true, visa: false, hotel: false }; // Default to ticket enabled
  }, [initialData, searchParams]);

  const [activeServices, setActiveServices] = useState(initialServices);

  // Master Booking Header State
  const [customerId, setCustomerId] = useState(initialData?.customerId || (customers[0]?.id || ""));
  const [bookingDate, setBookingDate] = useState(
    initialData?.bookingDate
      ? new Date(initialData.bookingDate).toISOString().split("T")[0]
      : new Date().toISOString().split("T")[0]
  );
  const [customerType, setCustomerType] = useState<string>("INDIVIDUAL"); // Individual Sale vs Corporate Sale
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
  const [destination, setDestination] = useState(initialData?.destination || "Dubai");
  const [status, setStatus] = useState<BookingStatus>(initialData?.status || BookingStatus.CONFIRMED);
  const [currency, setCurrency] = useState(initialData?.currency || "USD");
  const [salesAgent, setSalesAgent] = useState(initialData?.salesAgentId || initialData?.salesAgent || "");
  const [referrer, setReferrer] = useState(initialData?.referrer || "");
  const [liaison, setLiaison] = useState(initialData?.liaison || "");
  const [notes, setNotes] = useState(initialData?.notes || "");
  const [internalNotes, setInternalNotes] = useState(initialData?.internalNotes || "");

  // Saved Passengers Lookup Modal State
  const [savedPassengersList, setSavedPassengersList] = useState<any[]>([]);
  const [isPassengerLookupOpen, setIsPassengerLookupOpen] = useState(false);
  const [passengerSearchQuery, setPassengerSearchQuery] = useState("");
  const [targetPassengerIndex, setTargetPassengerIndex] = useState<number>(0);

  // Ticket Document Scanner Modal State
  const [isScannerOpen, setIsScannerOpen] = useState(false);
  const [scanFile, setScanFile] = useState<File | null>(null);
  const [scanExtractedText, setScanExtractedText] = useState("");
  const [isScanning, setIsScanning] = useState(false);
  const [scanFeedback, setScanFeedback] = useState<string | null>(null);

  // Passengers State
  const [passengers, setPassengers] = useState<PassengerInput[]>(
    initialData?.passengers?.length
      ? initialData.passengers.map((p: any) => ({
          id: p.id,
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

  // Service 1: Ticket / Flight State
  const initialFlightItem = initialData?.serviceItems?.find((s: any) => s.serviceType === "FLIGHT");
  const defaultAirlineSupplier = suppliers.find((s) => s.type === "AIRLINE") || suppliers[0];

  const [ticketData, setTicketData] = useState({
    supplierId: initialFlightItem?.supplierId || defaultAirlineSupplier?.id || "",
    airline: initialFlightItem?.flightSegments?.[0]?.airline || "Kam Air",
    flightNumber: initialFlightItem?.flightSegments?.[0]?.flightNumber || "RQ-901",
    departureAirport: initialFlightItem?.flightSegments?.[0]?.departureAirport || "KBL - Kabul",
    arrivalAirport: initialFlightItem?.flightSegments?.[0]?.arrivalAirport || "DXB - Dubai",
    departureDateTime: initialFlightItem?.flightSegments?.[0]?.departureDateTime
      ? new Date(initialFlightItem.flightSegments[0].departureDateTime).toISOString().slice(0, 16)
      : "",
    returnDateTime: initialFlightItem?.flightSegments?.[0]?.returnDateTime
      ? new Date(initialFlightItem.flightSegments[0].returnDateTime).toISOString().slice(0, 16)
      : "",
    cabinClass: initialFlightItem?.flightSegments?.[0]?.cabinClass || "ECONOMY",
    ticketNumber: initialFlightItem?.flightSegments?.[0]?.ticketNumber || "",
    pnr: initialFlightItem?.flightSegments?.[0]?.pnr || initialData?.pnr || "",
    baggageAllowance: initialFlightItem?.flightSegments?.[0]?.baggageAllowance || "30 KG",
    flightType: initialFlightItem?.flightSegments?.[0]?.flightType || "ONE_WAY",
    ticketStatus: initialFlightItem?.flightSegments?.[0]?.ticketStatus || "CONFIRM",
    quantity: initialFlightItem?.quantity || 1,
    costPriceForeign: initialFlightItem?.costPriceForeign || 450,
    sellPriceForeign: initialFlightItem?.sellPriceForeign || 550,
    discountForeign: initialFlightItem?.discountForeign || 0,
    taxRatePercent: 0,
    taxAmountForeign: initialFlightItem?.taxAmountForeign || 0,
    supplierCommissionForeign: 0,
    currency: initialFlightItem?.currency || "USD",
    exchangeRate: initialFlightItem?.exchangeRate || 70.5,
  });

  // Multi-leg flight segments
  const [flightSegments, setFlightSegments] = useState<FlightSegmentInput[]>(
    initialFlightItem?.flightSegments?.length
      ? initialFlightItem.flightSegments.map((seg: any, idx: number) => ({
          airline: seg.airline || "Kam Air",
          flightNumber: seg.flightNumber || `RQ-${901 + idx}`,
          departureAirport: seg.departureAirport || "KBL - Kabul",
          arrivalAirport: seg.arrivalAirport || "DXB - Dubai",
          departureDateTime: seg.departureDateTime ? new Date(seg.departureDateTime).toISOString().slice(0, 16) : "",
          arrivalDateTime: seg.arrivalDateTime ? new Date(seg.arrivalDateTime).toISOString().slice(0, 16) : "",
          returnDateTime: seg.returnDateTime ? new Date(seg.returnDateTime).toISOString().slice(0, 16) : "",
          cabinClass: seg.cabinClass || "ECONOMY",
          ticketNumber: seg.ticketNumber || "",
          pnr: seg.pnr || "",
          baggageAllowance: seg.baggageAllowance || "30 KG",
          flightType: seg.flightType || "ONE_WAY",
          ticketStatus: seg.ticketStatus || "CONFIRM",
          segmentOrder: seg.segmentOrder || idx + 1,
        }))
      : [
          {
            airline: "Kam Air",
            flightNumber: "RQ-901",
            departureAirport: "KBL - Kabul",
            arrivalAirport: "DXB - Dubai",
            departureDateTime: "",
            arrivalDateTime: "",
            cabinClass: "ECONOMY",
            baggageAllowance: "30 KG",
            flightType: "ONE_WAY",
            ticketStatus: "CONFIRM",
            segmentOrder: 1,
          },
        ]
  );

  // Auto status suggestion based on flight departure date
  useEffect(() => {
    if (travelStartDate) {
      const flightDate = new Date(travelStartDate);
      const now = new Date();
      now.setHours(0, 0, 0, 0);
      if (flightDate < now) {
        setTicketData((prev) => ({ ...prev, ticketStatus: "DONE" }));
      } else {
        setTicketData((prev) => ({ ...prev, ticketStatus: "CONFIRM" }));
      }
    }
  }, [travelStartDate]);

  // Service 2: Visa State
  const initialVisaItem = initialData?.serviceItems?.find((s: any) => s.serviceType === "VISA");
  const defaultVisaSupplier = suppliers.find((s) => s.type === "VISA_PROVIDER") || suppliers[0];

  const [visaData, setVisaData] = useState({
    supplierId: initialVisaItem?.supplierId || defaultVisaSupplier?.id || "",
    destinationCountry: initialVisaItem?.visaDetail?.visaCountry || "UAE",
    visaType: initialVisaItem?.visaDetail?.visaType || "Tourist Visa (30 Days)",
    applicantName: initialVisaItem?.visaDetail?.applicantName || "",
    applicationNumber: initialVisaItem?.visaDetail?.visaNumber || initialVisaItem?.visaDetail?.applicationNumber || "",
    submissionDate: initialVisaItem?.visaDetail?.submissionDate
      ? new Date(initialVisaItem.visaDetail.submissionDate).toISOString().split("T")[0]
      : travelStartDate,
    expectedDate: initialVisaItem?.visaDetail?.approvalDate
      ? new Date(initialVisaItem.visaDetail.approvalDate).toISOString().split("T")[0]
      : "",
    visaStatus: initialVisaItem?.visaDetail?.status || "PROCESSING",
    quantity: initialVisaItem?.quantity || 1,
    costPriceForeign: initialVisaItem?.costPriceForeign || 80,
    sellPriceForeign: initialVisaItem?.sellPriceForeign || 120,
    discountForeign: initialVisaItem?.discountForeign || 0,
    taxRatePercent: 0,
    taxAmountForeign: initialVisaItem?.taxAmountForeign || 0,
    currency: initialVisaItem?.currency || "USD",
    exchangeRate: initialVisaItem?.exchangeRate || 70.5,
  });

  // Service 3: Hotel State
  const initialHotelItem = initialData?.serviceItems?.find((s: any) => s.serviceType === "HOTEL");
  const defaultHotelSupplier = suppliers.find((s) => s.type === "HOTEL") || suppliers[0];

  const [hotelData, setHotelData] = useState({
    supplierId: initialHotelItem?.supplierId || defaultHotelSupplier?.id || "",
    hotelName: initialHotelItem?.hotelDetail?.hotelName || "Grand Millennium Hotel Dubai",
    city: initialHotelItem?.hotelDetail?.city || destination || "Dubai",
    country: initialHotelItem?.hotelDetail?.country || "UAE",
    checkInDate: initialHotelItem?.hotelDetail?.checkInDate
      ? new Date(initialHotelItem.hotelDetail.checkInDate).toISOString().split("T")[0]
      : travelStartDate,
    checkOutDate: initialHotelItem?.hotelDetail?.checkOutDate
      ? new Date(initialHotelItem.hotelDetail.checkOutDate).toISOString().split("T")[0]
      : travelEndDate || travelStartDate,
    nightsCount: initialHotelItem?.hotelDetail?.numberOfNights || 3,
    roomsCount: initialHotelItem?.hotelDetail?.numberOfRooms || 1,
    roomType: initialHotelItem?.hotelDetail?.roomType || "Standard Room",
    mealPlan: initialHotelItem?.hotelDetail?.mealPlan || "Bed & Breakfast (BB)",
    confirmationCode: initialHotelItem?.hotelDetail?.confirmationCode || "",
    quantity: initialHotelItem?.quantity || 1,
    costPriceForeign: initialHotelItem?.costPriceForeign || 250,
    sellPriceForeign: initialHotelItem?.sellPriceForeign || 320,
    discountForeign: initialHotelItem?.discountForeign || 0,
    taxRatePercent: 0,
    taxAmountForeign: initialHotelItem?.taxAmountForeign || 0,
    currency: initialHotelItem?.currency || "USD",
    exchangeRate: initialHotelItem?.exchangeRate || 70.5,
  });

  // Price Summary Adjustments State (Formula Bar Style)
  const [issuingPrice, setIssuingPrice] = useState<number>(ticketData.costPriceForeign);
  const [soldPrice, setSoldPrice] = useState<number>(ticketData.sellPriceForeign);
  const [supplierCommission, setSupplierCommission] = useState<number>(0); // COM
  const [additionalCharge, setAdditionalCharge] = useState<number>(initialData?.additionalCharge || 0); // AC
  const [customerCommission, setCustomerCommission] = useState<number>(initialData?.customerCommission || 0); // CC
  const [taxPercent, setTaxPercent] = useState<number>(0); // TAX%
  const [exchangeRate, setExchangeRate] = useState<number>(ticketData.exchangeRate || 70.5); // Rate

  // Payment & Authorization State
  const [paymentMade, setPaymentMade] = useState<boolean>(Boolean(initialData?.paymentMade));
  const [paymentCurrency, setPaymentCurrency] = useState<string>(currency);
  const [paymentAccount, setPaymentAccount] = useState<string>(initialData?.paymentAccount || "Cash (AFN)");
  const [paymentReceiver, setPaymentReceiver] = useState<string>(initialData?.paymentReceiver || "");
  const [paymentSignature, setPaymentSignature] = useState<string>(initialData?.paymentSignature || "");

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Sync ticket pricing with formula bar
  useEffect(() => {
    setIssuingPrice(ticketData.costPriceForeign);
    setSoldPrice(ticketData.sellPriceForeign);
    setExchangeRate(ticketData.exchangeRate);
  }, [ticketData.costPriceForeign, ticketData.sellPriceForeign, ticketData.exchangeRate]);

  // Accessibility: Close modals with Escape key
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        if (isPassengerLookupOpen) setIsPassengerLookupOpen(false);
        if (isScannerOpen) setIsScannerOpen(false);
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isPassengerLookupOpen, isScannerOpen]);

  // Load saved passengers when lookup modal opens
  const openPassengerLookup = async (index: number) => {
    setTargetPassengerIndex(index);
    setIsPassengerLookupOpen(true);
    try {
      const res = await getSavedPassengers({ customerId, search: passengerSearchQuery });
      if (res.success && res.data) {
        setSavedPassengersList(res.data);
      }
    } catch (e) {
      console.error(e);
    }
  };

  const handleSelectSavedPassenger = (savedPax: any) => {
    const updated = [...passengers];
    updated[targetPassengerIndex] = {
      ...updated[targetPassengerIndex],
      title: savedPax.title || "Mr",
      firstName: savedPax.firstName,
      middleName: savedPax.middleName || "",
      lastName: savedPax.lastName,
      dateOfBirth: savedPax.dateOfBirth ? new Date(savedPax.dateOfBirth).toISOString().split("T")[0] : "",
      gender: savedPax.gender || "MALE",
      nationality: savedPax.nationality || "Afghan",
      passportNumber: savedPax.passportNumber || "",
      passportIssueDate: savedPax.passportIssueDate ? new Date(savedPax.passportIssueDate).toISOString().split("T")[0] : "",
      passportExpiryDate: savedPax.passportExpiryDate ? new Date(savedPax.passportExpiryDate).toISOString().split("T")[0] : "",
      passportIssuingCountry: savedPax.passportIssuingCountry || "Afghanistan",
      visaNumber: savedPax.visaNumber || "",
      phone: savedPax.phone || "",
      email: savedPax.email || "",
    };
    setPassengers(updated);

    // Auto update Visa applicant name if matching first pax
    if (targetPassengerIndex === 0) {
      setVisaData((prev) => ({
        ...prev,
        applicantName: `${savedPax.firstName} ${savedPax.lastName}`,
      }));
    }

    setIsPassengerLookupOpen(false);
  };

  // OCR Ticket Scanner Handle
  const handleTicketScanSubmit = async (e?: React.FormEvent | React.MouseEvent) => {
    if (e) e.preventDefault();
    setIsScanning(true);
    setScanFeedback(null);

    try {
      const res = await processUploadedTicketDocument({
        name: scanFile?.name || "ticket_document.pdf",
        size: scanFile?.size || 1024,
        type: scanFile?.type || "application/pdf",
        extractedText: scanExtractedText || undefined,
      });

      if (res.success && res.data) {
        const d = res.data;
        setTicketData((prev) => ({
          ...prev,
          airline: d.airline || prev.airline,
          flightNumber: d.flightNumber || prev.flightNumber,
          departureAirport: d.departureAirport || prev.departureAirport,
          arrivalAirport: d.arrivalAirport || prev.arrivalAirport,
          pnr: d.pnr || prev.pnr,
          ticketNumber: d.ticketNumber || prev.ticketNumber,
          cabinClass: d.cabinClass || prev.cabinClass,
        }));

        // Update first flight segment
        if (flightSegments.length > 0) {
          const updatedSegs = [...flightSegments];
          updatedSegs[0] = {
            ...updatedSegs[0],
            airline: d.airline || updatedSegs[0].airline,
            flightNumber: d.flightNumber || updatedSegs[0].flightNumber,
            departureAirport: d.departureAirport || updatedSegs[0].departureAirport,
            arrivalAirport: d.arrivalAirport || updatedSegs[0].arrivalAirport,
            pnr: d.pnr || updatedSegs[0].pnr,
            ticketNumber: d.ticketNumber || updatedSegs[0].ticketNumber,
          };
          setFlightSegments(updatedSegs);
        }

        if (d.passengerFirstName || d.passengerLastName) {
          const updated = [...passengers];
          updated[0] = {
            ...updated[0],
            firstName: d.passengerFirstName || updated[0].firstName,
            lastName: d.passengerLastName || updated[0].lastName,
          };
          setPassengers(updated);
        }

        setScanFeedback(res.message || "Ticket document processed and fields populated!");
        setTimeout(() => {
          setIsScannerOpen(false);
          setScanFeedback(null);
        }, 1200);
      } else {
        setScanFeedback(res.error || "Could not parse ticket data.");
      }
    } catch (err: any) {
      setScanFeedback(err.message || "Failed to scan ticket document.");
    } finally {
      setIsScanning(false);
    }
  };

  // Toggle Services
  const toggleService = (svc: "ticket" | "visa" | "hotel") => {
    setActiveServices((prev) => ({ ...prev, [svc]: !prev[svc] }));
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

  // Flight Segment Handlers (Multi-leg support)
  const addFlightSegment = () => {
    const lastSeg = flightSegments[flightSegments.length - 1];
    setFlightSegments([
      ...flightSegments,
      {
        airline: lastSeg?.airline || ticketData.airline || "Kam Air",
        flightNumber: `RQ-${902 + flightSegments.length}`,
        departureAirport: lastSeg?.arrivalAirport || "DXB - Dubai",
        arrivalAirport: "KBL - Kabul",
        departureDateTime: "",
        arrivalDateTime: "",
        cabinClass: "ECONOMY",
        baggageAllowance: "30 KG",
        flightType: ticketData.flightType || "ONE_WAY",
        ticketStatus: ticketData.ticketStatus || "CONFIRM",
        segmentOrder: flightSegments.length + 1,
      },
    ]);
  };

  const removeFlightSegment = (index: number) => {
    if (flightSegments.length === 1) return;
    setFlightSegments(flightSegments.filter((_, i) => i !== index));
  };

  const updateFlightSegment = (index: number, field: keyof FlightSegmentInput, value: any) => {
    const updated = [...flightSegments];
    updated[index] = { ...updated[index], [field]: value };
    setFlightSegments(updated);
  };

  // Active Service Items array for financial computation & submission
  const activeServiceList = useMemo(() => {
    const items: ServiceItemInput[] = [];

    if (activeServices.ticket) {
      // Calculate tax amount from taxPercent if provided
      const calculatedTax = (soldPrice * taxPercent) / 100;

      items.push({
        supplierId: ticketData.supplierId,
        serviceType: ServiceType.FLIGHT,
        description: `${ticketData.airline} ${flightSegments[0]?.flightNumber || ticketData.flightNumber} (${flightSegments[0]?.departureAirport || ticketData.departureAirport} → ${flightSegments[0]?.arrivalAirport || ticketData.arrivalAirport})`,
        quantity: ticketData.quantity,
        passengerCount: passengers.length,
        currency: ticketData.currency,
        exchangeRate: exchangeRate,
        costPriceForeign: issuingPrice,
        sellPriceForeign: soldPrice,
        discountForeign: ticketData.discountForeign,
        taxAmountForeign: calculatedTax,
        supplierRef: ticketData.pnr,
        flightSegments: flightSegments.map((seg, idx) => ({
          airline: seg.airline || ticketData.airline,
          flightNumber: seg.flightNumber || ticketData.flightNumber,
          departureAirport: seg.departureAirport || ticketData.departureAirport,
          arrivalAirport: seg.arrivalAirport || ticketData.arrivalAirport,
          departureDateTime: seg.departureDateTime || undefined,
          arrivalDateTime: seg.arrivalDateTime || undefined,
          returnDateTime: seg.returnDateTime || undefined,
          cabinClass: seg.cabinClass || ticketData.cabinClass,
          ticketNumber: seg.ticketNumber || ticketData.ticketNumber,
          pnr: seg.pnr || ticketData.pnr,
          baggageAllowance: seg.baggageAllowance || ticketData.baggageAllowance,
          flightType: ticketData.flightType,
          ticketStatus: ticketData.ticketStatus,
          segmentOrder: idx + 1,
        })),
      });
    }

    if (activeServices.visa) {
      items.push({
        supplierId: visaData.supplierId,
        serviceType: ServiceType.VISA,
        description: `${visaData.destinationCountry} - ${visaData.visaType} (${visaData.applicantName || passengers[0]?.firstName || "Applicant"})`,
        quantity: visaData.quantity,
        passengerCount: passengers.length,
        currency: visaData.currency,
        exchangeRate: visaData.exchangeRate,
        costPriceForeign: visaData.costPriceForeign,
        sellPriceForeign: visaData.sellPriceForeign,
        discountForeign: visaData.discountForeign,
        taxAmountForeign: visaData.taxAmountForeign,
        visaDetail: {
          destinationCountry: visaData.destinationCountry,
          visaType: visaData.visaType,
          applicationNumber: visaData.applicationNumber,
          applicantName: visaData.applicantName || `${passengers[0]?.firstName} ${passengers[0]?.lastName}`,
          visaStatus: visaData.visaStatus,
          submissionDate: visaData.submissionDate || undefined,
          expectedDate: visaData.expectedDate || undefined,
        },
      });
    }

    if (activeServices.hotel) {
      items.push({
        supplierId: hotelData.supplierId,
        serviceType: ServiceType.HOTEL,
        description: `${hotelData.hotelName} (${hotelData.city}) - ${hotelData.nightsCount} Nights`,
        quantity: hotelData.quantity,
        passengerCount: passengers.length,
        currency: hotelData.currency,
        exchangeRate: hotelData.exchangeRate,
        costPriceForeign: hotelData.costPriceForeign,
        sellPriceForeign: hotelData.sellPriceForeign,
        discountForeign: hotelData.discountForeign,
        taxAmountForeign: hotelData.taxAmountForeign,
        supplierRef: hotelData.confirmationCode,
        hotelDetail: {
          hotelName: hotelData.hotelName,
          city: hotelData.city,
          checkInDate: hotelData.checkInDate,
          checkOutDate: hotelData.checkOutDate,
          roomsCount: hotelData.roomsCount,
          nightsCount: hotelData.nightsCount,
          roomType: hotelData.roomType,
          mealPlan: hotelData.mealPlan,
          confirmationNumber: hotelData.confirmationCode,
        },
      });
    }

    return items;
  }, [
    activeServices,
    ticketData,
    flightSegments,
    issuingPrice,
    soldPrice,
    taxPercent,
    exchangeRate,
    passengers,
    visaData,
    hotelData,
  ]);

  // Consolidated Financial Totals Calculation in real time using Decimal.js
  const computedTotals = useMemo(() => {
    try {
      const calculated = activeServiceList.map((item) => {
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

      const rawTotals = calculateBookingTotals(calculated);
      const custCommDec = new Decimal(customerCommission || 0);
      const addChargeDec = new Decimal(additionalCharge || 0);
      const suppCommDec = new Decimal(supplierCommission || 0);

      const netSelling = rawTotals.totalNetSelling.plus(addChargeDec).minus(custCommDec);
      const grossMargin = netSelling.minus(rawTotals.totalCostPrice).plus(suppCommDec);
      const marginPct = netSelling.gt(0)
        ? grossMargin.dividedBy(netSelling).times(100).toDecimalPlaces(2)
        : new Decimal(0);

      // Foreign currency buying and selling totals
      let foreignBuying = new Decimal(0);
      let foreignSelling = new Decimal(0);
      for (const item of activeServiceList) {
        foreignBuying = foreignBuying.plus(new Decimal(item.costPriceForeign || 0).times(item.quantity || 1));
        foreignSelling = foreignSelling.plus(new Decimal(item.sellPriceForeign || 0).times(item.quantity || 1));
      }

      // Foreign currency profit
      const foreignTax = foreignSelling.times(taxPercent).dividedBy(100);
      const foreignProfit = foreignSelling.minus(new Decimal(customerCommission || 0).dividedBy(exchangeRate || 1))
        .plus(new Decimal(additionalCharge || 0).dividedBy(exchangeRate || 1))
        .minus(foreignBuying)
        .plus(new Decimal(supplierCommission || 0).dividedBy(exchangeRate || 1));

      return {
        rawTotals,
        totalCostPrice: rawTotals.totalCostPrice,
        totalSellPrice: rawTotals.totalSellPrice,
        totalDiscount: rawTotals.totalDiscount,
        totalTax: rawTotals.totalTax,
        totalNetSelling: netSelling,
        totalGrossMargin: grossMargin,
        marginPercentage: marginPct,
        customerCommission: custCommDec,
        additionalCharge: addChargeDec,
        supplierCommission: suppCommDec,
        foreignBuying,
        foreignSelling,
        foreignTax,
        foreignProfit,
      };
    } catch {
      return null;
    }
  }, [activeServiceList, customerCommission, additionalCharge, supplierCommission, taxPercent, exchangeRate]);

  // Form Validation State
  const hasActiveService = activeServices.ticket || activeServices.visa || activeServices.hotel;
  const isCustomerValid = Boolean(customerId);
  const isTravelStartDateValid = Boolean(travelStartDate);
  const arePassengersValid = passengers.length > 0 && passengers.every((p) => p.firstName.trim() && p.lastName.trim());
  const areSuppliersValid = activeServiceList.every((item) => Boolean(item.supplierId));
  const isFormValid = hasActiveService && isCustomerValid && isTravelStartDateValid && arePassengersValid && areSuppliersValid;

  const selectedCustomerObj = customers.find((c) => c.id === customerId);

  // Dynamic Submit Button Label
  const submitButtonLabel = useMemo(() => {
    if (isEditing) return "Update Booking";
    const activeCount = (activeServices.ticket ? 1 : 0) + (activeServices.visa ? 1 : 0) + (activeServices.hotel ? 1 : 0);
    if (activeCount > 1) return "Add Package Booking";
    if (activeServices.ticket) return "Add Ticket Booking";
    if (activeServices.visa) return "Add Visa Booking";
    if (activeServices.hotel) return "Add Hotel Booking";
    return "Confirm & Save Booking";
  }, [isEditing, activeServices]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    setErrorMessage(null);

    // 1. Validation: At least one service must be active
    if (!hasActiveService) {
      setErrorMessage("Please select at least one service: [Ticket], [Visa], or [Hotel].");
      setIsSubmitting(false);
      return;
    }

    if (!customerId) {
      setErrorMessage("Please select a customer for the booking.");
      setIsSubmitting(false);
      return;
    }

    if (!travelStartDate) {
      setErrorMessage("Please specify the departure / travel start date.");
      setIsSubmitting(false);
      return;
    }

    // 2. Validate passengers
    const invalidPax = passengers.some((p) => !p.firstName.trim() || !p.lastName.trim());
    if (invalidPax) {
      setErrorMessage("Every passenger must have at least a First Name and Last Name.");
      setIsSubmitting(false);
      return;
    }

    // 3. Validate active services have suppliers
    for (const item of activeServiceList) {
      if (!item.supplierId) {
        setErrorMessage(`Please select a supplier for ${item.serviceType}.`);
        setIsSubmitting(false);
        return;
      }
    }

    try {
      const payload: CreateBookingInput = {
        customerId,
        pnrOrRef: ticketData.pnr || hotelData.confirmationCode || undefined,
        confirmationNumber: ticketData.ticketNumber || hotelData.confirmationCode || undefined,
        salesAgent,
        referrer,
        liaison,
        destination,
        travelStartDate,
        travelEndDate: travelEndDate || undefined,
        status,
        currency,
        notes,
        internalNotes,
        customerCommission,
        additionalCharge,
        paymentMade,
        paymentAccount,
        paymentReceiver,
        paymentSignature,
        passengers,
        serviceItems: activeServiceList,
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
    <form onSubmit={handleSubmit} className="max-w-7xl mx-auto pb-28 space-y-6" aria-label="Travel Booking Form">
      {/* Top Header Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-200 dark:border-slate-800 pb-5">
        <div className="flex items-center gap-3">
          <Link
            href="/bookings"
            aria-label="Back to Bookings List"
            className="p-2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-xl transition-colors"
          >
            <ArrowLeft className="w-5 h-5" />
          </Link>
          <div>
            <h1 className="text-2xl font-bold text-slate-900 dark:text-white">
              {isEditing ? `Edit Booking #${initialData.bookingNumber}` : "New Travel Booking"}
            </h1>
            <p className="text-xs text-slate-500 mt-0.5">
              Ticket, Visa, and Hotel bookings with multi-leg segments, live formula calculation, and authorized signatures.
            </p>
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
            type="button"
            onClick={() => setStatus(BookingStatus.DRAFT)}
            disabled={isSubmitting}
            className="px-4 py-2 text-sm font-medium rounded-lg border border-slate-300 dark:border-slate-700 text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors"
          >
            Save Draft
          </button>
          <button
            type="submit"
            disabled={isSubmitting || !isFormValid}
            className="inline-flex items-center gap-2 px-6 py-2 text-sm font-bold rounded-lg bg-blue-600 hover:bg-blue-700 text-white shadow-md shadow-blue-500/20 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            {isSubmitting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
            {isSubmitting ? "Saving..." : submitButtonLabel}
          </button>
        </div>
      </div>

      {errorMessage && (
        <div
          role="alert"
          aria-live="polite"
          className="p-4 bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-900 text-rose-700 dark:text-rose-300 text-sm rounded-xl flex items-center gap-3 shadow-sm"
        >
          <AlertCircle className="w-5 h-5 shrink-0 text-rose-600" />
          <span className="font-medium">{errorMessage}</span>
        </div>
      )}

      {/* Main Two-Column Layout (Desktop Grid) */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
        {/* Left / Main Column (Inputs & Services) */}
        <div className="lg:col-span-8 space-y-8">
          {/* SECTION 1: TOP SECTION (Customer, Passenger quick lookup, Dates, Booking Type, Liaison, Referrer) */}
          <div className="p-6 rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-sm space-y-5">
            <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-3">
              <h2 className="text-base font-bold text-slate-900 dark:text-white flex items-center gap-2">
                <Users className="w-5 h-5 text-blue-600" />
                Customer & Itinerary Overview
              </h2>
              <div className="flex items-center gap-2">
                <span className="text-xs font-semibold px-2.5 py-1 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300">
                  Date: {bookingDate}
                </span>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              {/* Customer Selection */}
              <div className="col-span-1 sm:col-span-2">
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 uppercase tracking-wider mb-1.5">
                  Customer Master *
                </label>
                <select
                  value={customerId}
                  onChange={(e) => setCustomerId(e.target.value)}
                  required
                  aria-invalid={!customerId}
                  className={`w-full px-3.5 py-2 text-sm rounded-lg border bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white focus:outline-none focus:ring-2 font-semibold ${
                    !customerId
                      ? "border-rose-300 focus:ring-rose-400"
                      : "border-slate-200 dark:border-slate-700 focus:ring-blue-500"
                  }`}
                >
                  <option value="">-- Select Master Customer --</option>
                  {customers.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.code} - {c.name} {c.companyName ? `(${c.companyName})` : ""}
                    </option>
                  ))}
                </select>
                {!customerId && (
                  <p className="text-[11px] text-rose-500 mt-1">Customer selection is required</p>
                )}
              </div>

              {/* Customer Type: Individual Sale vs Corporate Sale */}
              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 uppercase tracking-wider mb-1.5">
                  Customer Type
                </label>
                <select
                  value={customerType}
                  onChange={(e) => setCustomerType(e.target.value)}
                  className="w-full px-3.5 py-2 text-sm rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500 font-semibold"
                >
                  <option value="INDIVIDUAL">Individual Sale</option>
                  <option value="CORPORATE">Customer List / Corporate</option>
                </select>
              </div>

              {/* Booking Date */}
              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 uppercase tracking-wider mb-1.5">
                  Booking Date *
                </label>
                <input
                  type="date"
                  required
                  value={bookingDate}
                  onChange={(e) => setBookingDate(e.target.value)}
                  className="w-full px-3.5 py-2 text-sm rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500 font-mono"
                />
              </div>

              {/* Flight Type (OW / TW) */}
              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 uppercase tracking-wider mb-1.5">
                  Flight Type
                </label>
                <select
                  value={ticketData.flightType}
                  onChange={(e) => {
                    const val = e.target.value;
                    setTicketData({ ...ticketData, flightType: val });
                    const updatedSegs = flightSegments.map((s) => ({ ...s, flightType: val }));
                    setFlightSegments(updatedSegs);
                  }}
                  className="w-full px-3.5 py-2 text-sm rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500 font-bold text-indigo-600 dark:text-indigo-400"
                >
                  <option value="ONE_WAY">One Way (OW)</option>
                  <option value="ROUND_TRIP">Round Trip (TW)</option>
                </select>
              </div>

              {/* Departure Date */}
              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 uppercase tracking-wider mb-1.5">
                  Departure Date *
                </label>
                <input
                  type="date"
                  required
                  aria-invalid={!travelStartDate}
                  value={travelStartDate}
                  onChange={(e) => setTravelStartDate(e.target.value)}
                  className="w-full px-3.5 py-2 text-sm rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500 font-mono"
                />
              </div>

              {/* Return Date */}
              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 uppercase tracking-wider mb-1.5">
                  Return Date
                </label>
                <input
                  type="date"
                  value={travelEndDate}
                  onChange={(e) => setTravelEndDate(e.target.value)}
                  className="w-full px-3.5 py-2 text-sm rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500 font-mono"
                />
              </div>

              {/* Destination */}
              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 uppercase tracking-wider mb-1.5">
                  Destination
                </label>
                <input
                  type="text"
                  placeholder="e.g. Dubai, Istanbul, Jeddah"
                  value={destination}
                  onChange={(e) => setDestination(e.target.value)}
                  className="w-full px-3.5 py-2 text-sm rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500 font-medium"
                />
              </div>

              {/* Referrer (Linked to Employees list) */}
              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 uppercase tracking-wider mb-1.5">
                  Referrer
                </label>
                <select
                  value={referrer}
                  onChange={(e) => setReferrer(e.target.value)}
                  className="w-full px-3.5 py-2 text-sm rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value="">-- Select Referrer (Employee) --</option>
                  {employees.map((emp) => (
                    <option key={emp.id} value={emp.name}>
                      {emp.name} ({emp.role || "Staff"})
                    </option>
                  ))}
                </select>
              </div>

              {/* Liaison (Linked to Employees list) */}
              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 uppercase tracking-wider mb-1.5">
                  Liaison
                </label>
                <select
                  value={liaison}
                  onChange={(e) => setLiaison(e.target.value)}
                  className="w-full px-3.5 py-2 text-sm rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value="">-- Select Liaison (Employee) --</option>
                  {employees.map((emp) => (
                    <option key={emp.id} value={emp.name}>
                      {emp.name} ({emp.role || "Staff"})
                    </option>
                  ))}
                </select>
              </div>

              {/* Status Dropdown with Auto-Fill Logic */}
              <div className="col-span-1 sm:col-span-2">
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 uppercase tracking-wider mb-1.5">
                  Booking Status
                </label>
                <select
                  value={ticketData.ticketStatus}
                  onChange={(e) => {
                    const val = e.target.value;
                    setTicketData({ ...ticketData, ticketStatus: val });
                    if (val === "CONFIRM" || val === "DONE") setStatus(BookingStatus.CONFIRMED);
                    else if (val === "CANCELLED" || val === "VOID") setStatus(BookingStatus.CANCELLED);
                  }}
                  className="w-full px-3.5 py-2 text-sm rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500 font-bold text-blue-600 dark:text-blue-400"
                >
                  <option value="CONFIRM">Confirm (Autofill before flight date)</option>
                  <option value="DONE">Done (Auto-change after flight date)</option>
                  <option value="REFUND">Refund</option>
                  <option value="REISSUED">Reissued</option>
                  <option value="CANCELLED">Cancelled</option>
                  <option value="VOID">Void</option>
                  <option value="OTHER">Other</option>
                </select>
              </div>
            </div>
          </div>

          {/* SECTION 2: SERVICE SELECTOR TOGGLES (Three Large Cards) */}
          <div className="p-6 rounded-2xl border-2 border-blue-500/20 bg-gradient-to-r from-blue-50/50 via-indigo-50/30 to-purple-50/50 dark:from-slate-900 dark:via-slate-900 dark:to-slate-900 shadow-sm space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
              <div>
                <h2 className="text-base font-bold text-slate-900 dark:text-white flex items-center gap-2">
                  <Layers className="w-5 h-5 text-blue-600" />
                  Service Selection Cards
                </h2>
                <p className="text-xs text-slate-500 mt-0.5">
                  Toggle one or more services to build standalone or unified packages. Form sections expand dynamically.
                </p>
              </div>
              <div className="flex items-center gap-1.5 text-xs text-indigo-700 dark:text-indigo-400 font-semibold bg-indigo-50 dark:bg-indigo-950/60 px-3 py-1 rounded-full border border-indigo-200 dark:border-indigo-800">
                <Sparkles className="w-3.5 h-3.5" /> Multi-Service Package Support
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 pt-2">
              {/* Card 1: Ticket */}
              <button
                type="button"
                role="checkbox"
                aria-checked={activeServices.ticket}
                onClick={() => toggleService("ticket")}
                className={`p-4 rounded-xl border-2 flex items-center justify-between transition-all cursor-pointer text-left ${
                  activeServices.ticket
                    ? "border-sky-500 bg-sky-50/80 dark:bg-sky-950/50 text-sky-950 dark:text-sky-100 shadow-md ring-2 ring-sky-500/20"
                    : "border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-800 text-slate-500 opacity-70 hover:opacity-100"
                }`}
              >
                <div className="flex items-center gap-3">
                  <div
                    className={`p-3 rounded-xl ${
                      activeServices.ticket ? "bg-sky-500 text-white shadow-sm" : "bg-slate-100 dark:bg-slate-700 text-slate-500"
                    }`}
                  >
                    <Plane className="w-6 h-6" />
                  </div>
                  <div>
                    <p className="font-bold text-sm text-slate-900 dark:text-white">Flight Ticket</p>
                    <p className="text-[11px] text-slate-500 dark:text-slate-400">Multi-leg Flights & PNR</p>
                  </div>
                </div>
                {activeServices.ticket ? (
                  <CheckCircle2 className="w-6 h-6 text-sky-600 dark:text-sky-400" />
                ) : (
                  <div className="w-6 h-6 rounded-full border-2 border-slate-300 dark:border-slate-600" />
                )}
              </button>

              {/* Card 2: Visa */}
              <button
                type="button"
                role="checkbox"
                aria-checked={activeServices.visa}
                onClick={() => toggleService("visa")}
                className={`p-4 rounded-xl border-2 flex items-center justify-between transition-all cursor-pointer text-left ${
                  activeServices.visa
                    ? "border-emerald-500 bg-emerald-50/80 dark:bg-emerald-950/50 text-emerald-950 dark:text-emerald-100 shadow-md ring-2 ring-emerald-500/20"
                    : "border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-800 text-slate-500 opacity-70 hover:opacity-100"
                }`}
              >
                <div className="flex items-center gap-3">
                  <div
                    className={`p-3 rounded-xl ${
                      activeServices.visa ? "bg-emerald-500 text-white shadow-sm" : "bg-slate-100 dark:bg-slate-700 text-slate-500"
                    }`}
                  >
                    <FileCheck className="w-6 h-6" />
                  </div>
                  <div>
                    <p className="font-bold text-sm text-slate-900 dark:text-white">Visa Service</p>
                    <p className="text-[11px] text-slate-500 dark:text-slate-400">Tourist & Business Visas</p>
                  </div>
                </div>
                {activeServices.visa ? (
                  <CheckCircle2 className="w-6 h-6 text-emerald-600 dark:text-emerald-400" />
                ) : (
                  <div className="w-6 h-6 rounded-full border-2 border-slate-300 dark:border-slate-600" />
                )}
              </button>

              {/* Card 3: Hotel */}
              <button
                type="button"
                role="checkbox"
                aria-checked={activeServices.hotel}
                onClick={() => toggleService("hotel")}
                className={`p-4 rounded-xl border-2 flex items-center justify-between transition-all cursor-pointer text-left ${
                  activeServices.hotel
                    ? "border-amber-500 bg-amber-50/80 dark:bg-amber-950/50 text-amber-950 dark:text-amber-100 shadow-md ring-2 ring-amber-500/20"
                    : "border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-800 text-slate-500 opacity-70 hover:opacity-100"
                }`}
              >
                <div className="flex items-center gap-3">
                  <div
                    className={`p-3 rounded-xl ${
                      activeServices.hotel ? "bg-amber-500 text-white shadow-sm" : "bg-slate-100 dark:bg-slate-700 text-slate-500"
                    }`}
                  >
                    <Building className="w-6 h-6" />
                  </div>
                  <div>
                    <p className="font-bold text-sm text-slate-900 dark:text-white">Hotel Booking</p>
                    <p className="text-[11px] text-slate-500 dark:text-slate-400">Rooms, Nights & Meals</p>
                  </div>
                </div>
                {activeServices.hotel ? (
                  <CheckCircle2 className="w-6 h-6 text-amber-600 dark:text-amber-400" />
                ) : (
                  <div className="w-6 h-6 rounded-full border-2 border-slate-300 dark:border-slate-600" />
                )}
              </button>
            </div>
          </div>

          {/* SECTION 3: PASSENGERS ROSTER & SAVED PASSPORTS (Auto-calculated ADT / CHD / INF) */}
          <div className="p-6 rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-sm space-y-5">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-100 dark:border-slate-800 pb-3">
              <div>
                <h2 className="text-base font-bold text-slate-900 dark:text-white flex items-center gap-2">
                  <Users className="w-5 h-5 text-indigo-600" />
                  Passengers Roster ({passengers.length})
                </h2>
                <p className="text-xs text-slate-500 mt-0.5">
                  Fill from saved passport selector with automatic age categorization: ADT (Adult), CHD (Child), INF (Infant).
                </p>
              </div>
              <button
                type="button"
                onClick={addPassenger}
                className="inline-flex items-center gap-1.5 px-3.5 py-1.5 text-xs font-bold rounded-lg bg-indigo-50 dark:bg-indigo-950/40 text-indigo-700 dark:text-indigo-300 hover:bg-indigo-100 transition-colors border border-indigo-200 dark:border-indigo-800"
              >
                <Plus className="w-3.5 h-3.5" /> Add Another Passenger
              </button>
            </div>

            <div className="space-y-4">
              {passengers.map((pax, index) => {
                const ageCat = computeAgeCategory(pax.dateOfBirth);
                return (
                  <div
                    key={index}
                    className="p-4 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50/70 dark:bg-slate-800/40 space-y-3"
                  >
                    <div className="flex items-center justify-between border-b border-slate-200 dark:border-slate-700 pb-2">
                      <div className="flex items-center gap-3">
                        <span className="text-xs font-bold text-indigo-700 dark:text-indigo-400 uppercase tracking-wider">
                          Passenger #{index + 1} {index === 0 ? "(Lead Passenger)" : ""}
                        </span>
                        {ageCat && (
                          <span
                            className={`px-2 py-0.5 text-[10px] font-black rounded-md uppercase tracking-wider ${
                              ageCat === "ADT"
                                ? "bg-blue-100 text-blue-800 dark:bg-blue-950 dark:text-blue-300 border border-blue-300 dark:border-blue-800"
                                : ageCat === "CHD"
                                ? "bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300 border border-amber-300 dark:border-amber-800"
                                : "bg-purple-100 text-purple-800 dark:bg-purple-950 dark:text-purple-300 border border-purple-300 dark:border-purple-800"
                            }`}
                          >
                            Age: {ageCat} ({ageCat === "ADT" ? "Adult" : ageCat === "CHD" ? "Child" : "Infant"})
                          </span>
                        )}
                        <button
                          type="button"
                          onClick={() => openPassengerLookup(index)}
                          className="inline-flex items-center gap-1 px-2.5 py-1 text-[11px] font-semibold rounded-md bg-white dark:bg-slate-800 border border-indigo-200 dark:border-indigo-800 text-indigo-700 dark:text-indigo-300 hover:bg-indigo-50 shadow-xs transition-colors"
                        >
                          <Search className="w-3 h-3" /> Fill From Saved Passport
                        </button>
                      </div>
                      {passengers.length > 1 && (
                        <button
                          type="button"
                          aria-label={`Remove Passenger ${index + 1}`}
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
                          value={pax.title || "Mr"}
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

                      <div className="lg:col-span-2">
                        <label className="font-semibold text-slate-600 dark:text-slate-400">First Name *</label>
                        <input
                          type="text"
                          required
                          aria-invalid={!pax.firstName.trim()}
                          placeholder="e.g. Ahmad"
                          value={pax.firstName}
                          onChange={(e) => updatePassenger(index, "firstName", e.target.value)}
                          className={`mt-1 w-full px-2.5 py-1.5 rounded-lg border bg-white dark:bg-slate-800 font-medium ${
                            !pax.firstName.trim() ? "border-rose-300 focus:ring-rose-400" : "border-slate-200 dark:border-slate-700"
                          }`}
                        />
                      </div>

                      <div className="lg:col-span-2">
                        <label className="font-semibold text-slate-600 dark:text-slate-400">Last Name *</label>
                        <input
                          type="text"
                          required
                          aria-invalid={!pax.lastName.trim()}
                          placeholder="e.g. Popal"
                          value={pax.lastName}
                          onChange={(e) => updatePassenger(index, "lastName", e.target.value)}
                          className={`mt-1 w-full px-2.5 py-1.5 rounded-lg border bg-white dark:bg-slate-800 font-medium ${
                            !pax.lastName.trim() ? "border-rose-300 focus:ring-rose-400" : "border-slate-200 dark:border-slate-700"
                          }`}
                        />
                      </div>

                      <div>
                        <label className="font-semibold text-slate-600 dark:text-slate-400">Date of Birth</label>
                        <input
                          type="date"
                          value={pax.dateOfBirth || ""}
                          onChange={(e) => updatePassenger(index, "dateOfBirth", e.target.value)}
                          className="mt-1 w-full px-2.5 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 font-mono"
                        />
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
                          className="mt-1 w-full px-2.5 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 font-mono"
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
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* DYNAMIC SERVICE FORM 1: TICKET SECTION & MULTI-LEG FLIGHT SEGMENT TABLE */}
          {activeServices.ticket && (
            <div className="p-6 rounded-2xl border border-sky-200 dark:border-sky-900/60 bg-white dark:bg-slate-900 shadow-sm space-y-6 transition-all">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-sky-100 dark:border-sky-900/40 pb-3">
                <div className="flex items-center gap-2.5">
                  <div className="p-2.5 rounded-xl bg-sky-500 text-white shadow-xs">
                    <Plane className="w-5 h-5" />
                  </div>
                  <div>
                    <h3 className="text-base font-bold text-slate-900 dark:text-white">
                      Flight Ticket Specifications & Multi-Leg Segments
                    </h3>
                    <p className="text-xs text-slate-500">
                      Airline supplier link, PNR, Ticket Number, multi-leg segment table, and flight itinerary.
                    </p>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={() => setIsScannerOpen(true)}
                  className="inline-flex items-center gap-2 px-3.5 py-1.5 text-xs font-bold rounded-lg bg-sky-50 dark:bg-sky-950/60 border border-sky-300 dark:border-sky-800 text-sky-700 dark:text-sky-300 hover:bg-sky-100 transition-colors shadow-xs"
                >
                  <UploadCloud className="w-3.5 h-3.5" /> Scan Ticket / Upload Document
                </button>
              </div>

              {/* Flight Master Info */}
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 text-xs">
                <div>
                  <label className="font-semibold text-slate-700 dark:text-slate-300">Supplier (Linked Airline) *</label>
                  <select
                    value={ticketData.supplierId}
                    onChange={(e) => setTicketData({ ...ticketData, supplierId: e.target.value })}
                    required
                    aria-invalid={!ticketData.supplierId}
                    className={`mt-1 w-full px-3 py-2 rounded-lg border bg-slate-50 dark:bg-slate-800 font-medium ${
                      !ticketData.supplierId ? "border-rose-300 focus:ring-rose-400" : "border-slate-200 dark:border-slate-700"
                    }`}
                  >
                    <option value="">-- Select Linked Supplier --</option>
                    {suppliers.map((s) => (
                      <option key={s.id} value={s.id}>
                        {s.name} ({s.type})
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="font-semibold text-slate-700 dark:text-slate-300">Airline Name</label>
                  <input
                    type="text"
                    placeholder="e.g. Kam Air, Ariana, Turkish Airlines"
                    value={ticketData.airline}
                    onChange={(e) => setTicketData({ ...ticketData, airline: e.target.value })}
                    className="mt-1 w-full px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 font-medium"
                  />
                </div>

                <div>
                  <label className="font-semibold text-slate-700 dark:text-slate-300">Airline PNR / GDS Code</label>
                  <input
                    type="text"
                    placeholder="e.g. 7X9KBL"
                    value={ticketData.pnr}
                    onChange={(e) => setTicketData({ ...ticketData, pnr: e.target.value.toUpperCase() })}
                    className="mt-1 w-full px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 font-mono font-bold text-sky-700 dark:text-sky-300 uppercase"
                  />
                </div>

                <div>
                  <label className="font-semibold text-slate-700 dark:text-slate-300">E-Ticket Number</label>
                  <input
                    type="text"
                    placeholder="e.g. 001-9988112233"
                    value={ticketData.ticketNumber}
                    onChange={(e) => setTicketData({ ...ticketData, ticketNumber: e.target.value })}
                    className="mt-1 w-full px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 font-mono"
                  />
                </div>
              </div>

              {/* Multi-Leg Flight Segment Table */}
              <div className="space-y-3 pt-2">
                <div className="flex items-center justify-between">
                  <h4 className="text-xs font-bold uppercase tracking-wider text-slate-700 dark:text-slate-300 flex items-center gap-2">
                    <Plane className="w-4 h-4 text-sky-600" />
                    Flight Segments / Legs ({flightSegments.length})
                  </h4>
                  <button
                    type="button"
                    onClick={addFlightSegment}
                    className="inline-flex items-center gap-1.5 px-3 py-1 text-xs font-bold rounded-lg bg-sky-50 dark:bg-sky-950/60 text-sky-700 dark:text-sky-300 hover:bg-sky-100 border border-sky-300 dark:border-sky-800 transition-colors"
                  >
                    <Plus className="w-3.5 h-3.5" /> + Add Flight Segment
                  </button>
                </div>

                <div className="overflow-x-auto border border-slate-200 dark:border-slate-800 rounded-xl">
                  <table className="w-full text-left text-xs border-collapse">
                    <thead className="bg-slate-100/70 dark:bg-slate-800/60 text-slate-600 dark:text-slate-400 font-semibold">
                      <tr>
                        <th className="p-2.5">Leg</th>
                        <th className="p-2.5">Airline</th>
                        <th className="p-2.5">Flight #</th>
                        <th className="p-2.5">Origin (Dep)</th>
                        <th className="p-2.5">Destination (Arr)</th>
                        <th className="p-2.5">Departure Time</th>
                        <th className="p-2.5">Cabin / Baggage</th>
                        <th className="p-2.5 text-center">Action</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-200 dark:divide-slate-800 bg-white dark:bg-slate-900">
                      {flightSegments.map((seg, idx) => (
                        <tr key={idx} className="hover:bg-slate-50/50 dark:hover:bg-slate-800/30">
                          <td className="p-2.5 font-bold font-mono text-sky-600">#{idx + 1}</td>
                          <td className="p-2.5">
                            <input
                              type="text"
                              value={seg.airline}
                              onChange={(e) => updateFlightSegment(idx, "airline", e.target.value)}
                              placeholder="Airline"
                              className="w-28 px-2 py-1 rounded border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 font-medium"
                            />
                          </td>
                          <td className="p-2.5">
                            <input
                              type="text"
                              value={seg.flightNumber}
                              onChange={(e) => updateFlightSegment(idx, "flightNumber", e.target.value)}
                              placeholder="e.g. RQ-901"
                              className="w-24 px-2 py-1 rounded border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 font-mono font-bold"
                            />
                          </td>
                          <td className="p-2.5">
                            <input
                              type="text"
                              value={seg.departureAirport}
                              onChange={(e) => updateFlightSegment(idx, "departureAirport", e.target.value)}
                              placeholder="KBL - Kabul"
                              className="w-32 px-2 py-1 rounded border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800"
                            />
                          </td>
                          <td className="p-2.5">
                            <input
                              type="text"
                              value={seg.arrivalAirport}
                              onChange={(e) => updateFlightSegment(idx, "arrivalAirport", e.target.value)}
                              placeholder="DXB - Dubai"
                              className="w-32 px-2 py-1 rounded border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800"
                            />
                          </td>
                          <td className="p-2.5">
                            <input
                              type="datetime-local"
                              value={seg.departureDateTime || ""}
                              onChange={(e) => updateFlightSegment(idx, "departureDateTime", e.target.value)}
                              className="px-2 py-1 rounded border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 font-mono text-[11px]"
                            />
                          </td>
                          <td className="p-2.5">
                            <div className="flex items-center gap-1">
                              <select
                                value={seg.cabinClass || "ECONOMY"}
                                onChange={(e) => updateFlightSegment(idx, "cabinClass", e.target.value)}
                                className="px-1.5 py-1 rounded border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-[11px]"
                              >
                                <option value="ECONOMY">Economy</option>
                                <option value="BUSINESS">Business</option>
                                <option value="FIRST">First</option>
                              </select>
                              <input
                                type="text"
                                value={seg.baggageAllowance || "30 KG"}
                                onChange={(e) => updateFlightSegment(idx, "baggageAllowance", e.target.value)}
                                placeholder="Baggage"
                                className="w-16 px-1.5 py-1 rounded border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-[11px] font-mono"
                              />
                            </div>
                          </td>
                          <td className="p-2.5 text-center">
                            {flightSegments.length > 1 && (
                              <button
                                type="button"
                                onClick={() => removeFlightSegment(idx)}
                                className="text-slate-400 hover:text-rose-600 transition-colors"
                              >
                                <Trash2 className="w-4 h-4" />
                              </button>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}

          {/* DYNAMIC SERVICE FORM 2: VISA SECTION */}
          {activeServices.visa && (
            <div className="p-6 rounded-2xl border border-emerald-200 dark:border-emerald-900/60 bg-white dark:bg-slate-900 shadow-sm space-y-5 transition-all">
              <div className="flex items-center gap-2.5 border-b border-emerald-100 dark:border-emerald-900/40 pb-3">
                <div className="p-2.5 rounded-xl bg-emerald-500 text-white shadow-xs">
                  <FileCheck className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-slate-900 dark:text-white">
                    Visa Application Specifications
                  </h3>
                  <p className="text-xs text-slate-500">Destination country, visa category, applicant tracking, and supplier pricing.</p>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 text-xs">
                <div>
                  <label className="font-semibold text-slate-700 dark:text-slate-300">Supplier (Visa Provider) *</label>
                  <select
                    value={visaData.supplierId}
                    onChange={(e) => setVisaData({ ...visaData, supplierId: e.target.value })}
                    required
                    aria-invalid={!visaData.supplierId}
                    className={`mt-1 w-full px-3 py-2 rounded-lg border bg-slate-50 dark:bg-slate-800 font-medium ${
                      !visaData.supplierId ? "border-rose-300 focus:ring-rose-400" : "border-slate-200 dark:border-slate-700"
                    }`}
                  >
                    <option value="">-- Select Visa Provider --</option>
                    {suppliers.map((s) => (
                      <option key={s.id} value={s.id}>
                        {s.name} ({s.type})
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="font-semibold text-slate-700 dark:text-slate-300">Destination Country</label>
                  <input
                    type="text"
                    placeholder="e.g. UAE, Turkey, Saudi Arabia"
                    value={visaData.destinationCountry}
                    onChange={(e) => setVisaData({ ...visaData, destinationCountry: e.target.value })}
                    className="mt-1 w-full px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 font-medium"
                  />
                </div>

                <div>
                  <label className="font-semibold text-slate-700 dark:text-slate-300">Visa Type / Category</label>
                  <input
                    type="text"
                    placeholder="e.g. Tourist 30 Days, Business Multiple"
                    value={visaData.visaType}
                    onChange={(e) => setVisaData({ ...visaData, visaType: e.target.value })}
                    className="mt-1 w-full px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800"
                  />
                </div>

                <div>
                  <label className="font-semibold text-slate-700 dark:text-slate-300">Application / File #</label>
                  <input
                    type="text"
                    placeholder="e.g. APPL-77889"
                    value={visaData.applicationNumber}
                    onChange={(e) => setVisaData({ ...visaData, applicationNumber: e.target.value })}
                    className="mt-1 w-full px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 font-mono"
                  />
                </div>

                <div>
                  <label className="font-semibold text-slate-700 dark:text-slate-300">Applicant Full Name</label>
                  <input
                    type="text"
                    placeholder="e.g. Ahmad Popal"
                    value={visaData.applicantName || `${passengers[0]?.firstName} ${passengers[0]?.lastName}`}
                    onChange={(e) => setVisaData({ ...visaData, applicantName: e.target.value })}
                    className="mt-1 w-full px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 font-medium"
                  />
                </div>

                <div>
                  <label className="font-semibold text-slate-700 dark:text-slate-300">Visa Status</label>
                  <select
                    value={visaData.visaStatus}
                    onChange={(e) => setVisaData({ ...visaData, visaStatus: e.target.value })}
                    className="mt-1 w-full px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 font-semibold"
                  >
                    <option value="PROCESSING">Processing</option>
                    <option value="SUBMITTED">Submitted</option>
                    <option value="APPROVED">Approved</option>
                    <option value="REJECTED">Rejected</option>
                  </select>
                </div>

                <div>
                  <label className="font-semibold text-slate-700 dark:text-slate-300">Buying Cost ({visaData.currency}) *</label>
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    required
                    value={visaData.costPriceForeign}
                    onChange={(e) => setVisaData({ ...visaData, costPriceForeign: parseFloat(e.target.value) || 0 })}
                    className="mt-1 w-full px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 font-mono font-bold text-rose-600"
                  />
                </div>

                <div>
                  <label className="font-semibold text-slate-700 dark:text-slate-300">Selling Price ({visaData.currency}) *</label>
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    required
                    value={visaData.sellPriceForeign}
                    onChange={(e) => setVisaData({ ...visaData, sellPriceForeign: parseFloat(e.target.value) || 0 })}
                    className="mt-1 w-full px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 font-mono font-bold text-blue-600"
                  />
                </div>
              </div>
            </div>
          )}

          {/* DYNAMIC SERVICE FORM 3: HOTEL SECTION */}
          {activeServices.hotel && (
            <div className="p-6 rounded-2xl border border-amber-200 dark:border-amber-900/60 bg-white dark:bg-slate-900 shadow-sm space-y-5 transition-all">
              <div className="flex items-center gap-2.5 border-b border-amber-100 dark:border-amber-900/40 pb-3">
                <div className="p-2.5 rounded-xl bg-amber-500 text-white shadow-xs">
                  <Building className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-slate-900 dark:text-white">
                    Hotel Reservation Specifications
                  </h3>
                  <p className="text-xs text-slate-500">Property details, check-in/out dates, room nights, and supplier cost.</p>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 text-xs">
                <div className="col-span-1 sm:col-span-2">
                  <label className="font-semibold text-slate-700 dark:text-slate-300">Supplier (Hotel Provider) *</label>
                  <select
                    value={hotelData.supplierId}
                    onChange={(e) => setHotelData({ ...hotelData, supplierId: e.target.value })}
                    required
                    aria-invalid={!hotelData.supplierId}
                    className={`mt-1 w-full px-3 py-2 rounded-lg border bg-slate-50 dark:bg-slate-800 font-medium ${
                      !hotelData.supplierId ? "border-rose-300 focus:ring-rose-400" : "border-slate-200 dark:border-slate-700"
                    }`}
                  >
                    <option value="">-- Select Hotel Supplier --</option>
                    {suppliers.map((s) => (
                      <option key={s.id} value={s.id}>
                        {s.name} ({s.type})
                      </option>
                    ))}
                  </select>
                </div>

                <div className="col-span-1 sm:col-span-2">
                  <label className="font-semibold text-slate-700 dark:text-slate-300">Hotel Name</label>
                  <input
                    type="text"
                    placeholder="e.g. Grand Millennium Hotel Dubai"
                    value={hotelData.hotelName}
                    onChange={(e) => setHotelData({ ...hotelData, hotelName: e.target.value })}
                    className="mt-1 w-full px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 font-medium"
                  />
                </div>

                <div>
                  <label className="font-semibold text-slate-700 dark:text-slate-300">City / Destination</label>
                  <input
                    type="text"
                    value={hotelData.city}
                    onChange={(e) => setHotelData({ ...hotelData, city: e.target.value })}
                    className="mt-1 w-full px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800"
                  />
                </div>

                <div>
                  <label className="font-semibold text-slate-700 dark:text-slate-300">Check-in Date</label>
                  <input
                    type="date"
                    value={hotelData.checkInDate}
                    onChange={(e) => {
                      const checkIn = e.target.value;
                      const nights = calculateHotelNights(checkIn, hotelData.checkOutDate);
                      setHotelData({ ...hotelData, checkInDate: checkIn, nightsCount: nights });
                    }}
                    className="mt-1 w-full px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 font-mono"
                  />
                </div>

                <div>
                  <label className="font-semibold text-slate-700 dark:text-slate-300">Check-out Date</label>
                  <input
                    type="date"
                    value={hotelData.checkOutDate}
                    onChange={(e) => {
                      const checkOut = e.target.value;
                      const nights = calculateHotelNights(hotelData.checkInDate, checkOut);
                      setHotelData({ ...hotelData, checkOutDate: checkOut, nightsCount: nights });
                    }}
                    className="mt-1 w-full px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 font-mono"
                  />
                </div>

                <div>
                  <label className="font-semibold text-slate-700 dark:text-slate-300">Nights (Auto / Override)</label>
                  <input
                    type="number"
                    min="1"
                    value={hotelData.nightsCount}
                    onChange={(e) => setHotelData({ ...hotelData, nightsCount: parseInt(e.target.value) || 1 })}
                    className="mt-1 w-full px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 font-bold font-mono"
                  />
                </div>

                <div>
                  <label className="font-semibold text-slate-700 dark:text-slate-300">Room Type</label>
                  <input
                    type="text"
                    placeholder="e.g. Standard Deluxe"
                    value={hotelData.roomType}
                    onChange={(e) => setHotelData({ ...hotelData, roomType: e.target.value })}
                    className="mt-1 w-full px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800"
                  />
                </div>

                <div>
                  <label className="font-semibold text-slate-700 dark:text-slate-300">Meal Plan</label>
                  <select
                    value={hotelData.mealPlan}
                    onChange={(e) => setHotelData({ ...hotelData, mealPlan: e.target.value })}
                    className="mt-1 w-full px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800"
                  >
                    <option value="Room Only (RO)">Room Only (RO)</option>
                    <option value="Bed & Breakfast (BB)">Bed & Breakfast (BB)</option>
                    <option value="Half Board (HB)">Half Board (HB)</option>
                    <option value="Full Board (FB)">Full Board (FB)</option>
                    <option value="All Inclusive (AI)">All Inclusive (AI)</option>
                  </select>
                </div>

                <div>
                  <label className="font-semibold text-slate-700 dark:text-slate-300">Buying Cost ({hotelData.currency}) *</label>
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    required
                    value={hotelData.costPriceForeign}
                    onChange={(e) => setHotelData({ ...hotelData, costPriceForeign: parseFloat(e.target.value) || 0 })}
                    className="mt-1 w-full px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 font-mono font-bold text-rose-600"
                  />
                </div>

                <div>
                  <label className="font-semibold text-slate-700 dark:text-slate-300">Selling Price ({hotelData.currency}) *</label>
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    required
                    value={hotelData.sellPriceForeign}
                    onChange={(e) => setHotelData({ ...hotelData, sellPriceForeign: parseFloat(e.target.value) || 0 })}
                    className="mt-1 w-full px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 font-mono font-bold text-blue-600"
                  />
                </div>
              </div>
            </div>
          )}

          {/* SECTION 4: FORMULA BAR STYLE PRICE SUMMARY SECTION */}
          {computedTotals && (
            <div className="p-6 rounded-2xl border-2 border-indigo-500/30 bg-gradient-to-br from-slate-900 via-slate-900 to-indigo-950 text-white shadow-xl space-y-6">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-800 pb-3">
                <div className="flex items-center gap-2">
                  <Calculator className="w-5 h-5 text-indigo-400" />
                  <h3 className="text-base font-bold uppercase tracking-wider text-indigo-300">
                    Formula Bar Price Summary & Live Profit Engine
                  </h3>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-xs text-slate-400">Currency:</span>
                  <select
                    value={currency}
                    onChange={(e) => setCurrency(e.target.value)}
                    className="px-2.5 py-1 text-xs font-bold rounded-md bg-slate-800 border border-slate-700 text-white"
                  >
                    {defaultCurrencies.map((c) => (
                      <option key={c} value={c}>
                        {c}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              {/* FORMULA BAR INPUTS: IP, SP, COM, AC, CC, TAX%, RATE */}
              <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-7 gap-3 text-xs">
                {/* IP - Issuing Price */}
                <div className="p-3 rounded-xl bg-slate-800/60 border border-slate-700/50">
                  <label className="text-slate-400 uppercase font-bold text-[10px] block mb-1">
                    IP (Issuing Price)
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    value={issuingPrice}
                    onChange={(e) => {
                      const val = parseFloat(e.target.value) || 0;
                      setIssuingPrice(val);
                      setTicketData((prev) => ({ ...prev, costPriceForeign: val }));
                    }}
                    className="w-full px-2 py-1 text-xs rounded bg-slate-900 border border-slate-700 font-mono text-rose-400 font-bold"
                  />
                  <span className="text-[10px] text-slate-500 mt-0.5 block">Direct Cost</span>
                </div>

                {/* SP - Sold Price */}
                <div className="p-3 rounded-xl bg-slate-800/60 border border-slate-700/50">
                  <label className="text-slate-400 uppercase font-bold text-[10px] block mb-1">
                    SP (Sold Price)
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    value={soldPrice}
                    onChange={(e) => {
                      const val = parseFloat(e.target.value) || 0;
                      setSoldPrice(val);
                      setTicketData((prev) => ({ ...prev, sellPriceForeign: val }));
                    }}
                    className="w-full px-2 py-1 text-xs rounded bg-slate-900 border border-slate-700 font-mono text-white font-bold"
                  />
                  <span className="text-[10px] text-slate-500 mt-0.5 block">Client Gross</span>
                </div>

                {/* COM - Supplier Commission */}
                <div className="p-3 rounded-xl bg-slate-800/60 border border-slate-700/50">
                  <label className="text-slate-400 uppercase font-bold text-[10px] block mb-1">
                    COM (Commission)
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    value={supplierCommission}
                    onChange={(e) => setSupplierCommission(parseFloat(e.target.value) || 0)}
                    className="w-full px-2 py-1 text-xs rounded bg-slate-900 border border-slate-700 font-mono text-emerald-400 font-bold"
                  />
                  <span className="text-[10px] text-slate-500 mt-0.5 block">Supplier Comm.</span>
                </div>

                {/* AC - Additional Charge */}
                <div className="p-3 rounded-xl bg-slate-800/60 border border-slate-700/50">
                  <label className="text-slate-400 uppercase font-bold text-[10px] block mb-1">
                    AC (Add. Charge)
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    value={additionalCharge}
                    onChange={(e) => setAdditionalCharge(parseFloat(e.target.value) || 0)}
                    className="w-full px-2 py-1 text-xs rounded bg-slate-900 border border-slate-700 font-mono text-sky-400 font-bold"
                  />
                  <span className="text-[10px] text-slate-500 mt-0.5 block">Service Fee</span>
                </div>

                {/* CC - Customer Commission / Discount */}
                <div className="p-3 rounded-xl bg-slate-800/60 border border-slate-700/50">
                  <label className="text-slate-400 uppercase font-bold text-[10px] block mb-1">
                    CC (Cust. Comm.)
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    value={customerCommission}
                    onChange={(e) => setCustomerCommission(parseFloat(e.target.value) || 0)}
                    className="w-full px-2 py-1 text-xs rounded bg-slate-900 border border-slate-700 font-mono text-amber-400 font-bold"
                  />
                  <span className="text-[10px] text-slate-500 mt-0.5 block">Client Discount</span>
                </div>

                {/* TAX% - Tax Rate */}
                <div className="p-3 rounded-xl bg-slate-800/60 border border-slate-700/50">
                  <label className="text-slate-400 uppercase font-bold text-[10px] block mb-1">
                    TAX% (Tax Rate)
                  </label>
                  <input
                    type="number"
                    step="0.1"
                    min="0"
                    max="100"
                    value={taxPercent}
                    onChange={(e) => setTaxPercent(parseFloat(e.target.value) || 0)}
                    className="w-full px-2 py-1 text-xs rounded bg-slate-900 border border-slate-700 font-mono text-purple-400 font-bold"
                  />
                  <span className="text-[10px] text-slate-500 mt-0.5 block">
                    Tax: {((soldPrice * taxPercent) / 100).toFixed(2)}
                  </span>
                </div>

                {/* RATE - Currency Conversion */}
                <div className="p-3 rounded-xl bg-slate-800/60 border border-slate-700/50">
                  <label className="text-slate-400 uppercase font-bold text-[10px] block mb-1">
                    Rate ({currency}→AFN)
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    min="0.01"
                    value={exchangeRate}
                    onChange={(e) => {
                      const val = parseFloat(e.target.value) || 1;
                      setExchangeRate(val);
                      setTicketData((prev) => ({ ...prev, exchangeRate: val }));
                    }}
                    className="w-full px-2 py-1 text-xs rounded bg-slate-900 border border-slate-700 font-mono text-indigo-300 font-bold"
                  />
                  <span className="text-[10px] text-slate-500 mt-0.5 block">Live FX Rate</span>
                </div>
              </div>

              {/* AUTO CALCULATED SUMMARY BAR */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 pt-2 border-t border-slate-800">
                <div className="p-3.5 rounded-xl bg-slate-800/80 border border-slate-700/70">
                  <p className="text-slate-400 uppercase font-semibold text-[11px]">Total Net Selling (Receivable)</p>
                  <p className="text-xl font-black text-blue-400 font-mono mt-1">
                    {computedTotals.totalNetSelling.toNumber().toLocaleString(undefined, { minimumFractionDigits: 2 })} AFN
                  </p>
                  <p className="text-[11px] text-slate-400 font-mono mt-0.5">
                    ≈ {(computedTotals.totalNetSelling.toNumber() / (exchangeRate || 1)).toLocaleString(undefined, { minimumFractionDigits: 2 })} {currency}
                  </p>
                </div>

                <div className="p-3.5 rounded-xl bg-slate-800/80 border border-slate-700/70">
                  <p className="text-slate-400 uppercase font-semibold text-[11px]">Total Direct Cost (Payable)</p>
                  <p className="text-xl font-black text-rose-400 font-mono mt-1">
                    {computedTotals.totalCostPrice.toNumber().toLocaleString(undefined, { minimumFractionDigits: 2 })} AFN
                  </p>
                  <p className="text-[11px] text-slate-400 font-mono mt-0.5">
                    ≈ {(computedTotals.totalCostPrice.toNumber() / (exchangeRate || 1)).toLocaleString(undefined, { minimumFractionDigits: 2 })} {currency}
                  </p>
                </div>

                <div className="p-3.5 rounded-xl bg-emerald-950/80 border border-emerald-700/70">
                  <div className="flex items-center justify-between">
                    <p className="text-emerald-300 uppercase font-bold text-[11px]">Auto Profit / Margin</p>
                    <span className="text-xs font-black px-2 py-0.5 rounded bg-emerald-500/30 text-emerald-300">
                      {computedTotals.marginPercentage.toString()}%
                    </span>
                  </div>
                  <p className="text-xl font-black text-emerald-400 font-mono mt-1">
                    {computedTotals.totalGrossMargin.toNumber().toLocaleString(undefined, { minimumFractionDigits: 2 })} AFN
                  </p>
                  <p className="text-[11px] text-emerald-300/80 font-mono mt-0.5">
                    ≈ {(computedTotals.totalGrossMargin.toNumber() / (exchangeRate || 1)).toLocaleString(undefined, { minimumFractionDigits: 2 })} {currency}
                  </p>
                </div>
              </div>
            </div>
          )}

          {/* SECTION 5: PAYMENT & SIGNATURE AUTHORIZATION */}
          <div className="p-6 rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-sm space-y-6">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-100 dark:border-slate-800 pb-3">
              <div className="flex items-center gap-2">
                <CreditCard className="w-5 h-5 text-indigo-600" />
                <h2 className="text-base font-bold text-slate-900 dark:text-white">
                  Payment, Receiver & Signature Lines
                </h2>
              </div>
              <div className="flex items-center gap-1.5 text-xs text-slate-500">
                <ShieldCheck className="w-4 h-4 text-emerald-500" />
                <span>Authorized Agency Verification Metadata</span>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 text-xs">
              <div>
                <label className="font-semibold text-slate-700 dark:text-slate-300">Payment Made?</label>
                <div className="mt-1 flex items-center gap-4 h-9">
                  <label className="inline-flex items-center gap-1.5 font-medium cursor-pointer">
                    <input
                      type="radio"
                      name="paymentMade"
                      checked={paymentMade === true}
                      onChange={() => setPaymentMade(true)}
                      className="text-blue-600 focus:ring-blue-500"
                    />
                    Yes (Settled)
                  </label>
                  <label className="inline-flex items-center gap-1.5 font-medium cursor-pointer">
                    <input
                      type="radio"
                      name="paymentMade"
                      checked={paymentMade === false}
                      onChange={() => setPaymentMade(false)}
                      className="text-blue-600 focus:ring-blue-500"
                    />
                    No (On Credit / AR)
                  </label>
                </div>
              </div>

              <div>
                <label className="font-semibold text-slate-700 dark:text-slate-300">Payment Currency</label>
                <select
                  value={paymentCurrency}
                  onChange={(e) => setPaymentCurrency(e.target.value)}
                  className="mt-1 w-full px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 font-bold"
                >
                  {defaultCurrencies.map((c) => (
                    <option key={c} value={c}>
                      {c}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="font-semibold text-slate-700 dark:text-slate-300">Payment Account / Mode</label>
                <input
                  type="text"
                  placeholder="e.g. Cash (AFN), Kabul Bank, Hawala"
                  value={paymentAccount}
                  onChange={(e) => setPaymentAccount(e.target.value)}
                  className="mt-1 w-full px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 font-medium"
                />
              </div>

              <div>
                <label className="font-semibold text-slate-700 dark:text-slate-300">Payment Receiver (Employee)</label>
                <select
                  value={paymentReceiver}
                  onChange={(e) => setPaymentReceiver(e.target.value)}
                  className="mt-1 w-full px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 font-medium"
                >
                  <option value="">-- Select Receiver Employee --</option>
                  {employees.map((emp) => (
                    <option key={emp.id} value={emp.name}>
                      {emp.name} ({emp.role || "Officer"})
                    </option>
                  ))}
                </select>
              </div>
            </div>

            {/* Signature Line Displays */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 pt-2">
              {/* Receiver Signature Box */}
              <div className="p-4 rounded-xl border-2 border-dashed border-slate-300 dark:border-slate-700 bg-slate-50/50 dark:bg-slate-800/30 space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-slate-700 dark:text-slate-300 flex items-center gap-1.5">
                    <PenTool className="w-3.5 h-3.5 text-indigo-600" />
                    Receiver Signature Line
                  </span>
                  <span className="text-[10px] text-slate-400 font-mono">{bookingDate}</span>
                </div>
                <div className="h-12 border-b-2 border-slate-400 dark:border-slate-600 flex items-end justify-center pb-1">
                  <span className="text-xs font-serif italic text-slate-600 dark:text-slate-300">
                    {paymentReceiver ? `Signed by: ${paymentReceiver}` : "__________________________________"}
                  </span>
                </div>
                <div className="flex justify-between text-[11px] text-slate-500">
                  <span>Authorized Receiver</span>
                  <span className="font-semibold text-slate-700 dark:text-slate-300">
                    {paymentReceiver || "Unassigned"}
                  </span>
                </div>
              </div>

              {/* Authorized Supervisor Signature Box */}
              <div className="p-4 rounded-xl border-2 border-dashed border-slate-300 dark:border-slate-700 bg-slate-50/50 dark:bg-slate-800/30 space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-slate-700 dark:text-slate-300 flex items-center gap-1.5">
                    <ShieldCheck className="w-3.5 h-3.5 text-emerald-600" />
                    Authorized Signature (Supervisor / Manager)
                  </span>
                  <select
                    value={paymentSignature}
                    onChange={(e) => setPaymentSignature(e.target.value)}
                    className="px-2 py-0.5 text-xs rounded border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800"
                  >
                    <option value="">-- Select Signer --</option>
                    {employees.map((emp) => (
                      <option key={emp.id} value={emp.name}>
                        {emp.name} ({emp.role})
                      </option>
                    ))}
                  </select>
                </div>
                <div className="h-12 border-b-2 border-slate-400 dark:border-slate-600 flex items-end justify-center pb-1">
                  <span className="text-xs font-serif italic text-slate-600 dark:text-slate-300">
                    {paymentSignature ? `Authorized: ${paymentSignature}` : "__________________________________"}
                  </span>
                </div>
                <div className="flex justify-between text-[11px] text-slate-500">
                  <span>Manager Approval Line</span>
                  <span className="font-semibold text-slate-700 dark:text-slate-300">
                    {paymentSignature || "Pending Approval"}
                  </span>
                </div>
              </div>
            </div>

            {/* Client and Internal Notes */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs pt-2">
              <div>
                <label className="font-semibold text-slate-700 dark:text-slate-300">Client Facing Notes / Terms</label>
                <textarea
                  rows={2}
                  placeholder="Notes printed on customer voucher or itinerary..."
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  className="mt-1 w-full px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800"
                />
              </div>

              <div>
                <label className="font-semibold text-slate-700 dark:text-slate-300">Internal Agency Notes</label>
                <textarea
                  rows={2}
                  placeholder="Confidential remarks, ticketing queue instructions..."
                  value={internalNotes}
                  onChange={(e) => setInternalNotes(e.target.value)}
                  className="mt-1 w-full px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800"
                />
              </div>
            </div>
          </div>

          {/* CHANGE 3 PLACEHOLDER NOTIFICATION */}
          <div className="p-4 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50/60 dark:bg-slate-900/40 flex items-start gap-3">
            <Info className="w-5 h-5 text-indigo-500 shrink-0 mt-0.5" />
            <div className="text-xs text-slate-600 dark:text-slate-400 space-y-1">
              <p className="font-bold text-slate-800 dark:text-slate-200">
                Change 3 (Client Feature Extension) — Specification Pending
              </p>
              <p>
                No requirements were provided for Change 3 yet. Placeholder slot is reserved without guesswork as requested.
              </p>
            </div>
          </div>
        </div>

        {/* Right Column: Sticky Booking Summary Sidebar */}
        <div className="lg:col-span-4 sticky top-6 space-y-5">
          <div className="p-6 rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-md space-y-5">
            <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-3">
              <h3 className="text-base font-bold text-slate-900 dark:text-white flex items-center gap-2">
                <FileText className="w-5 h-5 text-blue-600" />
                Booking Summary
              </h3>
              <span
                className={`text-xs font-extrabold px-2.5 py-1 rounded-full ${
                  status === "CONFIRMED"
                    ? "bg-emerald-100 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300"
                    : status === "QUOTATION"
                    ? "bg-amber-100 dark:bg-amber-950/60 text-amber-700 dark:text-amber-300"
                    : "bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300"
                }`}
              >
                {status}
              </span>
            </div>

            {/* Selected Services Badges */}
            <div className="space-y-1.5">
              <p className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider">Active Services</p>
              <div className="flex flex-wrap gap-2">
                {activeServices.ticket && (
                  <span className="inline-flex items-center gap-1.5 px-2.5 py-1 text-xs font-bold rounded-lg bg-sky-100 dark:bg-sky-950/60 text-sky-700 dark:text-sky-300 border border-sky-300 dark:border-sky-800">
                    <Plane className="w-3.5 h-3.5" /> Flight Ticket ({flightSegments.length} Segments)
                  </span>
                )}
                {activeServices.visa && (
                  <span className="inline-flex items-center gap-1.5 px-2.5 py-1 text-xs font-bold rounded-lg bg-emerald-100 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300 border border-emerald-300 dark:border-emerald-800">
                    <FileCheck className="w-3.5 h-3.5" /> Visa Service
                  </span>
                )}
                {activeServices.hotel && (
                  <span className="inline-flex items-center gap-1.5 px-2.5 py-1 text-xs font-bold rounded-lg bg-amber-100 dark:bg-amber-950/60 text-amber-700 dark:text-amber-300 border border-amber-300 dark:border-amber-800">
                    <Building className="w-3.5 h-3.5" /> Hotel Stay
                  </span>
                )}
                {!hasActiveService && (
                  <span className="text-xs text-rose-500 font-semibold">No services active</span>
                )}
              </div>
            </div>

            {/* Customer & Lead Passenger Preview */}
            <div className="p-3.5 rounded-xl bg-slate-50 dark:bg-slate-800/50 border border-slate-100 dark:border-slate-800 space-y-2 text-xs">
              <div className="flex justify-between">
                <span className="text-slate-500">Customer:</span>
                <span className="font-bold text-slate-800 dark:text-slate-200">
                  {selectedCustomerObj ? `${selectedCustomerObj.name}` : "Not Selected"}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">Type:</span>
                <span className="font-bold text-slate-800 dark:text-slate-200">
                  {customerType === "INDIVIDUAL" ? "Individual Sale" : "Corporate Sale"}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">Passengers:</span>
                <span className="font-bold text-slate-800 dark:text-slate-200">
                  {passengers.length} pax ({passengers[0]?.firstName ? `${passengers[0].firstName} ${passengers[0].lastName}` : "Lead Pax"})
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">Destination:</span>
                <span className="font-bold text-slate-800 dark:text-slate-200">{destination || "N/A"}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">Dates:</span>
                <span className="font-medium text-slate-700 dark:text-slate-300 font-mono">
                  {travelStartDate} {travelEndDate ? `→ ${travelEndDate}` : ""}
                </span>
              </div>
            </div>

            {/* Price Calculations Breakdown */}
            {computedTotals && (
              <div className="space-y-2 pt-2 border-t border-slate-100 dark:border-slate-800 text-xs">
                <div className="flex justify-between text-slate-500">
                  <span>Buying Cost (Direct):</span>
                  <span className="font-mono text-rose-600 dark:text-rose-400 font-semibold">
                    {computedTotals.totalCostPrice.toNumber().toLocaleString(undefined, { minimumFractionDigits: 2 })} AFN
                  </span>
                </div>
                <div className="flex justify-between text-slate-500">
                  <span>Selling Gross:</span>
                  <span className="font-mono text-slate-800 dark:text-slate-200 font-semibold">
                    {computedTotals.totalSellPrice.toNumber().toLocaleString(undefined, { minimumFractionDigits: 2 })} AFN
                  </span>
                </div>
                {customerCommission > 0 && (
                  <div className="flex justify-between text-amber-600 dark:text-amber-400">
                    <span>Customer Discount (CC):</span>
                    <span className="font-mono font-semibold">
                      -{customerCommission.toLocaleString(undefined, { minimumFractionDigits: 2 })} AFN
                    </span>
                  </div>
                )}
                {additionalCharge > 0 && (
                  <div className="flex justify-between text-sky-600 dark:text-sky-400">
                    <span>Additional Fee (AC):</span>
                    <span className="font-mono font-semibold">
                      +{additionalCharge.toLocaleString(undefined, { minimumFractionDigits: 2 })} AFN
                    </span>
                  </div>
                )}

                <div className="pt-3 border-t border-slate-200 dark:border-slate-700">
                  <div className="flex justify-between items-baseline">
                    <span className="text-xs uppercase font-bold text-slate-600 dark:text-slate-400">
                      Total Net Payable:
                    </span>
                    <span className="text-xl font-black text-blue-600 dark:text-blue-400 font-mono">
                      {computedTotals.totalNetSelling.toNumber().toLocaleString(undefined, { minimumFractionDigits: 2 })} AFN
                    </span>
                  </div>
                  <div className="flex justify-between items-baseline mt-1">
                    <span className="text-[11px] font-semibold text-emerald-600 dark:text-emerald-400">
                      Estimated Profit ({computedTotals.marginPercentage.toString()}%):
                    </span>
                    <span className="text-sm font-bold text-emerald-600 dark:text-emerald-400 font-mono">
                      {computedTotals.totalGrossMargin.toNumber().toLocaleString(undefined, { minimumFractionDigits: 2 })} AFN
                    </span>
                  </div>
                </div>
              </div>
            )}

            {/* Quick Submit Buttons */}
            <div className="pt-3 space-y-2">
              <button
                type="submit"
                disabled={isSubmitting || !isFormValid}
                className="w-full py-3 px-4 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-bold text-sm shadow-md shadow-blue-500/20 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 transition-all"
              >
                {isSubmitting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                {isSubmitting ? "Saving Booking..." : submitButtonLabel}
              </button>

              <button
                type="button"
                onClick={() => setStatus(BookingStatus.DRAFT)}
                disabled={isSubmitting}
                className="w-full py-2 px-4 rounded-xl border border-slate-300 dark:border-slate-700 text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 text-xs font-semibold transition-colors"
              >
                Save as Operational Draft
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* BOTTOM FIXED ACTION BAR */}
      <div className="fixed bottom-0 left-0 right-0 z-40 bg-white/95 dark:bg-slate-900/95 backdrop-blur-md border-t border-slate-200 dark:border-slate-800 py-3 px-6 shadow-2xl">
        <div className="max-w-7xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-4">
          {/* Left Service Add/Toggle Buttons */}
          <div className="flex items-center gap-2">
            <span className="text-xs font-semibold text-slate-500 mr-1 hidden md:inline">Add Services:</span>
            <button
              type="button"
              onClick={() => toggleService("ticket")}
              className={`px-3 py-1.5 text-xs font-bold rounded-lg border flex items-center gap-1.5 transition-all ${
                activeServices.ticket
                  ? "bg-sky-50 dark:bg-sky-950/60 border-sky-400 text-sky-700 dark:text-sky-300 shadow-xs"
                  : "bg-white dark:bg-slate-800 border-slate-300 dark:border-slate-700 text-slate-600 dark:text-slate-400 hover:bg-slate-50"
              }`}
            >
              <Plane className="w-3.5 h-3.5" /> + Ticket Booking {activeServices.ticket && "✓"}
            </button>
            <button
              type="button"
              onClick={() => toggleService("visa")}
              className={`px-3 py-1.5 text-xs font-bold rounded-lg border flex items-center gap-1.5 transition-all ${
                activeServices.visa
                  ? "bg-emerald-50 dark:bg-emerald-950/60 border-emerald-400 text-emerald-700 dark:text-emerald-300 shadow-xs"
                  : "bg-white dark:bg-slate-800 border-slate-300 dark:border-slate-700 text-slate-600 dark:text-slate-400 hover:bg-slate-50"
              }`}
            >
              <FileCheck className="w-3.5 h-3.5" /> + Visa Booking {activeServices.visa && "✓"}
            </button>
            <button
              type="button"
              onClick={() => toggleService("hotel")}
              className={`px-3 py-1.5 text-xs font-bold rounded-lg border flex items-center gap-1.5 transition-all ${
                activeServices.hotel
                  ? "bg-amber-50 dark:bg-amber-950/60 border-amber-400 text-amber-700 dark:text-amber-300 shadow-xs"
                  : "bg-white dark:bg-slate-800 border-slate-300 dark:border-slate-700 text-slate-600 dark:text-slate-400 hover:bg-slate-50"
              }`}
            >
              <Building className="w-3.5 h-3.5" /> + Hotel Booking {activeServices.hotel && "✓"}
            </button>
          </div>

          {/* Right Action Buttons */}
          <div className="flex items-center gap-3">
            <Link
              href="/bookings"
              className="px-4 py-2 text-xs font-semibold rounded-lg border border-slate-300 dark:border-slate-700 text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
            >
              Cancel
            </Link>
            <button
              type="submit"
              disabled={isSubmitting || !isFormValid}
              className="px-6 py-2 text-xs font-bold rounded-lg bg-blue-600 hover:bg-blue-700 text-white shadow-md shadow-blue-500/20 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2 transition-all"
            >
              {isSubmitting ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Save className="w-3.5 h-3.5" />}
              {isSubmitting ? "Saving..." : submitButtonLabel}
            </button>
          </div>
        </div>
      </div>

      {/* SAVED PASSENGERS LOOKUP MODAL */}
      {isPassengerLookupOpen && (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="saved-passengers-title"
          className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4"
        >
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl max-w-2xl w-full p-6 space-y-4 shadow-2xl">
            <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-3">
              <h3 id="saved-passengers-title" className="text-base font-bold text-slate-900 dark:text-white flex items-center gap-2">
                <Users className="w-5 h-5 text-indigo-600" />
                Select Saved Passenger / Passport Record
              </h3>
              <button
                type="button"
                aria-label="Close saved passengers dialog"
                onClick={() => setIsPassengerLookupOpen(false)}
                className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
              >
                ✕
              </button>
            </div>

            <div className="flex items-center gap-2">
              <Search className="w-4 h-4 text-slate-400" />
              <input
                type="text"
                placeholder="Search by name, passport number, phone..."
                value={passengerSearchQuery}
                onChange={async (e) => {
                  const q = e.target.value;
                  setPassengerSearchQuery(q);
                  const res = await getSavedPassengers({ customerId, search: q });
                  if (res.success && res.data) setSavedPassengersList(res.data);
                }}
                className="w-full px-3 py-1.5 text-xs rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800"
              />
            </div>

            <div className="max-h-64 overflow-y-auto space-y-2">
              {savedPassengersList.length === 0 ? (
                <p className="text-xs text-slate-400 py-6 text-center">No saved passengers found.</p>
              ) : (
                savedPassengersList.map((pax) => {
                  const age = computeAgeCategory(pax.dateOfBirth);
                  return (
                    <div
                      key={pax.id}
                      onClick={() => handleSelectSavedPassenger(pax)}
                      className="p-3 rounded-xl border border-slate-100 dark:border-slate-800 bg-slate-50/70 dark:bg-slate-800/50 hover:border-indigo-400 cursor-pointer flex items-center justify-between text-xs transition-colors"
                    >
                      <div>
                        <div className="flex items-center gap-2">
                          <p className="font-bold text-slate-800 dark:text-slate-200">
                            {pax.title} {pax.firstName} {pax.middleName} {pax.lastName}
                          </p>
                          {age && (
                            <span className="px-1.5 py-0.2 text-[10px] font-bold rounded bg-indigo-100 dark:bg-indigo-950 text-indigo-700 dark:text-indigo-300">
                              {age}
                            </span>
                          )}
                        </div>
                        <p className="text-[11px] text-slate-500 font-mono mt-0.5">
                          Passport: <span className="text-indigo-600 dark:text-indigo-400">{pax.passportNumber || "N/A"}</span> • {pax.nationality}
                        </p>
                      </div>
                      <button
                        type="button"
                        className="px-3 py-1 text-xs font-semibold rounded-lg bg-indigo-50 text-indigo-700 dark:bg-indigo-950/60 dark:text-indigo-300"
                      >
                        Autofill
                      </button>
                    </div>
                  );
                })
              )}
            </div>
          </div>
        </div>
      )}

      {/* TICKET DOCUMENT SCANNER MODAL */}
      {isScannerOpen && (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="ticket-scanner-title"
          className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4"
        >
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl max-w-lg w-full p-6 space-y-5 shadow-2xl">
            <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-3">
              <div className="flex items-center gap-2">
                <UploadCloud className="w-5 h-5 text-sky-600" />
                <h3 id="ticket-scanner-title" className="text-base font-bold text-slate-900 dark:text-white">
                  Scan Ticket / Document Extraction
                </h3>
              </div>
              <button
                type="button"
                aria-label="Close ticket scanner modal"
                onClick={() => setIsScannerOpen(false)}
                className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
              >
                ✕
              </button>
            </div>

            <p className="text-xs text-slate-500">
              Upload a ticket image or PDF, or paste ticket itinerary text to extract and autofill PNR, ticket number, airline, flight number, and passenger fields.
            </p>

            <div className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
                  Select Ticket Image / PDF Document
                </label>
                <input
                  type="file"
                  accept="image/*,.pdf"
                  onChange={(e) => setScanFile(e.target.files?.[0] || null)}
                  className="w-full text-xs text-slate-500 file:mr-3 file:py-2 file:px-4 file:rounded-lg file:border-0 file:text-xs file:font-semibold file:bg-sky-50 file:text-sky-700 hover:file:bg-sky-100"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
                  Or Paste E-Ticket / GDS Itinerary Text
                </label>
                <textarea
                  rows={4}
                  placeholder="e.g. KAM AIR RQ-901 PNR: 7X9KBL PAX: POPAL/AHMAD TKT: 001-9988112233 KBL-DXB..."
                  value={scanExtractedText}
                  onChange={(e) => setScanExtractedText(e.target.value)}
                  className="w-full px-3 py-2 text-xs rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 font-mono"
                />
              </div>

              {scanFeedback && (
                <div className="p-3 bg-sky-50 dark:bg-sky-950/40 text-sky-800 dark:text-sky-300 text-xs rounded-lg font-medium">
                  {scanFeedback}
                </div>
              )}

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setIsScannerOpen(false)}
                  className="px-4 py-2 text-xs font-medium rounded-lg border border-slate-200 text-slate-700 dark:text-slate-300"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleTicketScanSubmit}
                  disabled={isScanning}
                  className="px-5 py-2 text-xs font-bold rounded-lg bg-sky-600 hover:bg-sky-700 text-white disabled:opacity-50 flex items-center gap-1.5"
                >
                  {isScanning && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                  {isScanning ? "Processing..." : "Process Document"}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </form>
  );
}
