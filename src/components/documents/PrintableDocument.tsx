"use client";

import React from "react";

export interface CompanyHeaderProps {
  companyName?: string;
  address?: string;
  city?: string;
  province?: string;
  country?: string;
  phone?: string;
  email?: string;
  tin?: string;
  registrationNumber?: string;
}

export interface DocumentLineItem {
  description: string;
  serviceType?: string;
  quantity: number;
  unitPrice: string;
  discount?: string;
  taxRate?: string;
  taxAmount?: string;
  total: string;
}

export interface PrintableDocumentProps {
  documentType:
    | "INVOICE"
    | "RECEIPT"
    | "QUOTATION"
    | "SUPPLIER_BILL"
    | "PAYMENT_VOUCHER"
    | "EXPENSE_VOUCHER";
  documentNumber: string;
  documentDate: string;
  dueDate?: string;
  status: string;
  partyType: "CUSTOMER" | "SUPPLIER" | "BENEFICIARY";
  partyName: string;
  partyCode?: string;
  partyContact?: string;
  bookingNumber?: string;
  pnr?: string;
  currency: string;
  exchangeRate?: string;
  lines: DocumentLineItem[];
  subtotal: string;
  discountTotal?: string;
  taxTotal?: string;
  grandTotal: string;
  baseTotalAfn?: string;
  paymentDetails?: {
    paymentMethod: string;
    bankAccount?: string;
    transactionRef?: string;
    allocatedInvoices?: string;
  };
  notes?: string;
  companyInfo?: CompanyHeaderProps;
}

export function PrintableDocument(props: PrintableDocumentProps) {
  const company = {
    companyName: props.companyInfo?.companyName || "Ariana Silk Road Travel & Tours",
    address: props.companyInfo?.address || "Ansari Square, Shahr-e-Naw",
    city: props.companyInfo?.city || "Kabul",
    province: props.companyInfo?.province || "Kabul",
    country: props.companyInfo?.country || "Afghanistan",
    phone: props.companyInfo?.phone || "+93 (0) 20 220 1234",
    email: props.companyInfo?.email || "finance@arianatravel.af",
    tin: props.companyInfo?.tin || "TIN-900234188",
    registrationNumber: props.companyInfo?.registrationNumber || "MOCI-2024-KBL-899",
  };

  const getDocTitle = () => {
    switch (props.documentType) {
      case "INVOICE":
        return "TAX INVOICE";
      case "RECEIPT":
        return "PAYMENT RECEIPT";
      case "QUOTATION":
        return "TRAVEL QUOTATION / ITINERARY";
      case "SUPPLIER_BILL":
        return "SUPPLIER BILL (ACCOUNTS PAYABLE)";
      case "PAYMENT_VOUCHER":
        return "PAYMENT DISBURSEMENT VOUCHER";
      case "EXPENSE_VOUCHER":
        return "OPERATING EXPENSE VOUCHER";
      default:
        return "FINANCIAL DOCUMENT";
    }
  };

  return (
    <div className="bg-white text-slate-900 p-8 max-w-4xl mx-auto rounded-lg shadow-sm print:shadow-none print:p-0 print:m-0 border border-slate-200 print:border-none font-sans text-sm">
      {/* Header */}
      <div className="flex justify-between items-start border-b border-slate-300 pb-6 mb-6">
        <div>
          <div className="flex items-center gap-3 mb-2">
            <div className="w-10 h-10 rounded bg-indigo-600 flex items-center justify-center text-white font-bold text-xl print:border print:border-black">
              A
            </div>
            <div>
              <h1 className="text-xl font-bold text-slate-900 leading-tight">
                {company.companyName}
              </h1>
              <p className="text-xs text-slate-500">Travel Management & Accounting ERP</p>
            </div>
          </div>
          <p className="text-xs text-slate-600">
            {company.address}, {company.city}, {company.province}, {company.country}
          </p>
          <p className="text-xs text-slate-600">
            Phone: {company.phone} | Email: {company.email}
          </p>
          <p className="text-xs text-slate-600">
            TIN: <span className="font-mono font-medium">{company.tin}</span> | Reg:{" "}
            <span className="font-mono font-medium">{company.registrationNumber}</span>
          </p>
        </div>

        <div className="text-right">
          <div className="inline-block px-3 py-1 rounded bg-slate-100 text-slate-800 font-bold tracking-wider text-sm mb-2 border border-slate-300">
            {getDocTitle()}
          </div>
          <div className="text-xs text-slate-600 space-y-1">
            <p>
              Doc #: <span className="font-mono font-bold text-slate-900">{props.documentNumber}</span>
            </p>
            <p>
              Date: <span className="font-medium text-slate-900">{props.documentDate}</span>
            </p>
            {props.dueDate && (
              <p>
                Due Date: <span className="font-medium text-slate-900">{props.dueDate}</span>
              </p>
            )}
            <p>
              Status: <span className="font-semibold text-indigo-700">{props.status}</span>
            </p>
          </div>
        </div>
      </div>

      {/* Party Details & Booking Link */}
      <div className="grid grid-cols-2 gap-6 bg-slate-50 p-4 rounded border border-slate-200 mb-6">
        <div>
          <h2 className="text-xs font-bold uppercase tracking-wider text-slate-500 mb-1">
            {props.partyType === "CUSTOMER"
              ? "Billed To (Customer)"
              : props.partyType === "SUPPLIER"
              ? "Supplier / Vendor"
              : "Beneficiary"}
          </h2>
          <p className="font-bold text-slate-900 text-base">{props.partyName}</p>
          {props.partyCode && (
            <p className="text-xs text-slate-600">
              Account Code: <span className="font-mono">{props.partyCode}</span>
            </p>
          )}
          {props.partyContact && (
            <p className="text-xs text-slate-600">Contact: {props.partyContact}</p>
          )}
        </div>

        <div className="text-right space-y-1 text-xs">
          {props.bookingNumber && (
            <p>
              <span className="text-slate-500">Booking Ref:</span>{" "}
              <span className="font-mono font-bold text-slate-900">{props.bookingNumber}</span>
            </p>
          )}
          {props.pnr && (
            <p>
              <span className="text-slate-500">PNR:</span>{" "}
              <span className="font-mono font-bold text-indigo-700">{props.pnr}</span>
            </p>
          )}
          <p>
            <span className="text-slate-500">Currency:</span>{" "}
            <span className="font-bold text-slate-900">{props.currency}</span>
            {props.currency !== "AFN" && props.exchangeRate && (
              <span className="text-slate-500"> (@ {props.exchangeRate} AFN)</span>
            )}
          </p>
        </div>
      </div>

      {/* Items Table */}
      <table className="w-full text-left border-collapse mb-6">
        <thead>
          <tr className="border-b-2 border-slate-300 text-xs font-bold text-slate-700 uppercase bg-slate-100">
            <th className="py-2.5 px-3">#</th>
            <th className="py-2.5 px-3">Description</th>
            <th className="py-2.5 px-3 text-right">Qty</th>
            <th className="py-2.5 px-3 text-right">Unit Price ({props.currency})</th>
            {props.lines.some((l) => l.taxAmount && l.taxAmount !== "0.00") && (
              <th className="py-2.5 px-3 text-right">Tax</th>
            )}
            <th className="py-2.5 px-3 text-right">Total ({props.currency})</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-200 text-xs">
          {props.lines.map((line, idx) => (
            <tr key={idx} className="hover:bg-slate-50/50">
              <td className="py-2.5 px-3 font-mono text-slate-400">{idx + 1}</td>
              <td className="py-2.5 px-3 font-medium text-slate-800">
                {line.description}
                {line.serviceType && (
                  <span className="ml-2 text-[10px] uppercase tracking-wider bg-slate-200 text-slate-700 px-1.5 py-0.5 rounded">
                    {line.serviceType}
                  </span>
                )}
              </td>
              <td className="py-2.5 px-3 text-right font-mono">{line.quantity}</td>
              <td className="py-2.5 px-3 text-right font-mono">{line.unitPrice}</td>
              {props.lines.some((l) => l.taxAmount && l.taxAmount !== "0.00") && (
                <td className="py-2.5 px-3 text-right font-mono text-slate-600">
                  {line.taxAmount || "0.00"}
                </td>
              )}
              <td className="py-2.5 px-3 text-right font-mono font-semibold text-slate-900">
                {line.total}
              </td>
            </tr>
          ))}
        </tbody>
      </table>

      {/* Totals Section */}
      <div className="flex justify-between items-start border-t border-slate-300 pt-4 mb-8">
        <div className="w-1/2 pr-4 space-y-2 text-xs">
          {props.paymentDetails && (
            <div className="p-3 bg-slate-50 border border-slate-200 rounded">
              <p className="font-bold text-slate-700 mb-1">Payment Method & Settlement</p>
              <p className="text-slate-600">Method: {props.paymentDetails.paymentMethod}</p>
              {props.paymentDetails.bankAccount && (
                <p className="text-slate-600">Account: {props.paymentDetails.bankAccount}</p>
              )}
              {props.paymentDetails.transactionRef && (
                <p className="text-slate-600">Ref: {props.paymentDetails.transactionRef}</p>
              )}
              {props.paymentDetails.allocatedInvoices && (
                <p className="text-slate-600">Settled Invoices: {props.paymentDetails.allocatedInvoices}</p>
              )}
            </div>
          )}

          {props.notes && (
            <div>
              <p className="font-bold text-slate-700 mb-1">Notes / Terms</p>
              <p className="text-slate-600 whitespace-pre-wrap">{props.notes}</p>
            </div>
          )}
        </div>

        <div className="w-2/5 space-y-1.5 text-xs text-right">
          <div className="flex justify-between py-1 border-b border-slate-100">
            <span className="text-slate-600">Subtotal:</span>
            <span className="font-mono font-semibold">
              {props.subtotal} {props.currency}
            </span>
          </div>

          {props.discountTotal && props.discountTotal !== "0.00" && (
            <div className="flex justify-between py-1 border-b border-slate-100 text-rose-600">
              <span>Discount:</span>
              <span className="font-mono font-semibold">
                -{props.discountTotal} {props.currency}
              </span>
            </div>
          )}

          {props.taxTotal && props.taxTotal !== "0.00" && (
            <div className="flex justify-between py-1 border-b border-slate-100">
              <span className="text-slate-600">Tax Total:</span>
              <span className="font-mono font-semibold">
                {props.taxTotal} {props.currency}
              </span>
            </div>
          )}

          <div className="flex justify-between py-2 border-b-2 border-slate-900 text-sm font-bold text-slate-900">
            <span>Grand Total:</span>
            <span className="font-mono text-indigo-700">
              {props.grandTotal} {props.currency}
            </span>
          </div>

          {props.currency !== "AFN" && props.baseTotalAfn && (
            <div className="flex justify-between py-1 text-[11px] text-slate-500 font-mono">
              <span>Base Equivalent (AFN):</span>
              <span className="font-semibold text-slate-700">{props.baseTotalAfn} AFN</span>
            </div>
          )}
        </div>
      </div>

      {/* Signature & Authorization Box */}
      <div className="grid grid-cols-2 gap-12 pt-8 border-t border-slate-200 text-xs">
        <div>
          <div className="border-b border-slate-400 h-12 mb-1"></div>
          <p className="font-semibold text-slate-800">Prepared / Authorized By</p>
          <p className="text-slate-500">Finance & Accounts Department</p>
        </div>
        <div className="text-right">
          <div className="border-b border-slate-400 h-12 mb-1"></div>
          <p className="font-semibold text-slate-800">Customer / Receiver Signature</p>
          <p className="text-slate-500">Acknowledged & Accepted</p>
        </div>
      </div>
    </div>
  );
}
