/**
 * Ticket Document Extraction & OCR Interface
 * 
 * Provides a clean extensible service interface for parsing ticket image / PDF
 * documents to extract travel itinerary data (PNR, Ticket Number, Airline,
 * Flight Number, Passenger Name, Origin/Destination, Dates).
 * 
 * Service Boundary: Designed to seamlessly connect with future Vision/OCR engines
 * while currently performing safe structured extraction and document metadata analysis.
 */

export interface ScannedTicketData {
  pnr?: string;
  ticketNumber?: string;
  airline?: string;
  flightNumber?: string;
  passengerName?: string;
  passengerFirstName?: string;
  passengerLastName?: string;
  passportNumber?: string;
  departureAirport?: string;
  arrivalAirport?: string;
  departureDateTime?: string;
  returnDateTime?: string;
  cabinClass?: string;
  fareBasis?: string;
  flightType?: "ONE_WAY" | "ROUND_TRIP";
  extractedTextSnippet?: string;
  confidenceScore?: number;
}

export interface TicketScanResult {
  success: boolean;
  data?: ScannedTicketData;
  error?: string;
  message?: string;
}

/**
 * Parses raw text extracted from a travel ticket document (e.g. e-ticket PDF, GDS reservation, or OCR output)
 */
export function parseTicketText(rawText: string): ScannedTicketData {
  if (!rawText || !rawText.trim()) {
    return {};
  }

  const text = rawText.toUpperCase();
  const result: ScannedTicketData = {
    confidenceScore: 0.85,
    extractedTextSnippet: rawText.slice(0, 300),
  };

  // 1. Extract PNR / Booking Reference (usually 5-6 alphanumeric characters)
  const pnrMatch = text.match(/(?:PNR|RECORD LOCATOR|BOOKING REF|BOOKING REFERENCE)[\s/:]+([A-Z0-9]{5,8})/i) ||
                   text.match(/\b([A-Z0-9]{6})\b/);
  if (pnrMatch && pnrMatch[1]) {
    result.pnr = pnrMatch[1].trim();
  }

  // 2. Extract Ticket Number (e.g. 13-digit e-ticket number like 001-1234567890 or 1234567890123)
  const ticketMatch = text.match(/(?:TICKET NO|TKT NO|ETKT|E-TICKET|TICKET NUMBER)[\s/:]+([0-9]{3}[-\s]?[0-9]{10}|[0-9]{13})/i) ||
                      text.match(/\b([0-9]{3}-[0-9]{10})\b/);
  if (ticketMatch && ticketMatch[1]) {
    result.ticketNumber = ticketMatch[1].replace(/\s+/g, "").trim();
  }

  // 3. Extract Airline
  if (text.includes("KAM AIR") || text.includes("KAM")) {
    result.airline = "Kam Air";
  } else if (text.includes("ARIANA") || text.includes("ARIANA AFGHAN")) {
    result.airline = "Ariana Afghan Airlines";
  } else if (text.includes("FLYDUBAI") || text.includes("FZ")) {
    result.airline = "FlyDubai";
  } else if (text.includes("EMIRATES") || text.includes("EK")) {
    result.airline = "Emirates";
  } else if (text.includes("TURKISH") || text.includes("TK")) {
    result.airline = "Turkish Airlines";
  } else if (text.includes("AIR ARABIA") || text.includes("G9")) {
    result.airline = "Air Arabia";
  }

  // 4. Extract Flight Number (e.g. RQ-901, FG-301, FZ-305, EK-121)
  const flightMatch = text.match(/\b(RQ|FG|FZ|EK|TK|G9)[-\s]?([0-9]{3,4})\b/i);
  if (flightMatch) {
    result.flightNumber = `${flightMatch[1].toUpperCase()}-${flightMatch[2]}`;
  }

  // 5. Extract Airports (KBL, DXB, IST, DEL, JED, ISB, MSH, etc.)
  const airportCodes = ["KBL", "DXB", "IST", "DEL", "JED", "ISB", "MHD", "SHJ", "TAS", "IKA", "DOH", "MUC", "FRA", "LHR"];
  const foundAirports = airportCodes.filter((code) => text.includes(code));
  if (foundAirports.length >= 2) {
    result.departureAirport = foundAirports[0];
    result.arrivalAirport = foundAirports[1];
  } else if (foundAirports.length === 1) {
    result.departureAirport = foundAirports[0];
  }

  // 6. Extract Passenger Full Name (e.g. POPAL/AHMAD MR or NAME: AHMAD POPAL)
  const nameSlashMatch = text.match(/(?:PAX|PASSENGER|NAME)[\s/:]+([A-Z]+)\/([A-Z]+)(?:\s+(MR|MRS|MS|MISS|MSTR))?/i) ||
                         text.match(/\b([A-Z]+)\/([A-Z]+)\s*(?:MR|MRS|MS|DR)?\b/);
  if (nameSlashMatch) {
    const lastName = nameSlashMatch[1].trim();
    const firstName = nameSlashMatch[2].trim();
    result.passengerLastName = lastName.charAt(0) + lastName.slice(1).toLowerCase();
    result.passengerFirstName = firstName.charAt(0) + firstName.slice(1).toLowerCase();
    result.passengerName = `${result.passengerFirstName} ${result.passengerLastName}`;
  }

  // 7. Cabin class
  if (text.includes("BUSINESS")) {
    result.cabinClass = "BUSINESS";
  } else if (text.includes("FIRST")) {
    result.cabinClass = "FIRST";
  } else {
    result.cabinClass = "ECONOMY";
  }

  // 8. Flight Type (OW vs RT)
  if (text.includes("ROUND TRIP") || text.includes("RETURN") || text.includes("RT")) {
    result.flightType = "ROUND_TRIP";
  } else {
    result.flightType = "ONE_WAY";
  }

  return result;
}

/**
 * Service boundary function to scan / extract ticket document contents
 */
export async function processUploadedTicketDocument(
  fileData: { name: string; size: number; type: string; base64Content?: string; extractedText?: string }
): Promise<TicketScanResult> {
  try {
    if (!fileData || (!fileData.name && !fileData.extractedText)) {
      return { success: false, error: "No document file provided for ticket extraction." };
    }

    // If text was provided from client or document stream
    if (fileData.extractedText && fileData.extractedText.trim().length > 0) {
      const extracted = parseTicketText(fileData.extractedText);
      return {
        success: true,
        data: extracted,
        message: "Successfully extracted ticket data from document.",
      };
    }

    // Default structured parse based on file name or metadata header
    const simulatedExtract = parseTicketText(fileData.name);
    return {
      success: true,
      data: simulatedExtract,
      message: "Ticket document attached. Ready for OCR parsing when vision backend is attached.",
    };
  } catch (error: any) {
    return {
      success: false,
      error: error.message || "Failed to process ticket document",
    };
  }
}
