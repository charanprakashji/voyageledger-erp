import React from 'react';
import prisma from '@/lib/prisma';
import { InvoiceForm } from '@/components/invoices/InvoiceForm';
import { Header } from '@/components/layout/Header';

export const dynamic = 'force-dynamic';

interface NewInvoicePageProps {
  searchParams: Promise<{ bookingId?: string; customerId?: string }>;
}

export default async function NewInvoicePage({ searchParams }: NewInvoicePageProps) {
  const { bookingId, customerId } = await searchParams;

  const [rawCustomers, rawBookings, rawTaxConfigs, rawAccounts] = await Promise.all([
    prisma.customer.findMany({
      where: { isActive: true },
      select: { id: true, name: true, code: true, companyName: true, defaultCurrency: true },
      orderBy: { name: 'asc' },
    }),
    prisma.booking.findMany({
      where: { status: { notIn: ['DRAFT', 'CANCELLED'] } },
      include: {
        serviceItems: true,
      },
      orderBy: { createdAt: 'desc' },
      take: 100,
    }),
    prisma.taxConfiguration.findMany({
      where: { isActive: true },
      orderBy: { taxName: 'asc' },
    }),
    prisma.chartOfAccount.findMany({
      where: { isActive: true },
      select: { id: true, code: true, name: true, accountType: true },
      orderBy: { code: 'asc' },
    }),
  ]);

  const customers = rawCustomers.map((c) => ({
    id: c.id,
    name: c.name,
    code: c.code,
    companyName: c.companyName,
    defaultCurrency: c.defaultCurrency,
  }));

  const bookings = rawBookings.map((b) => ({
    id: b.id,
    bookingNumber: b.bookingNumber,
    customerId: b.customerId,
    currency: b.currency,
    serviceItems: b.serviceItems.map((s) => ({
      id: s.id,
      serviceType: s.serviceType,
      description: s.description,
      sellPriceForeign: Number(s.sellPriceForeign),
      currency: s.currency,
      exchangeRate: Number(s.exchangeRate),
    })),
  }));

  const taxConfigurations = rawTaxConfigs.map((t) => ({
    id: t.id,
    taxCode: t.taxCode,
    taxName: t.taxName,
    percentage: Number(t.percentage),
    liabilityAccountId: t.liabilityAccountId,
  }));

  const chartOfAccounts = rawAccounts.map((a) => ({
    id: a.id,
    code: a.code,
    name: a.name,
    accountType: a.accountType,
  }));

  return (
    <div>
      <Header title="Generate Customer Invoice" userRole="ADMIN" />
      <div className="p-8 max-w-7xl mx-auto">
        <InvoiceForm
          customers={customers}
          bookings={bookings}
          taxConfigurations={taxConfigurations}
          chartOfAccounts={chartOfAccounts}
        />
      </div>
    </div>
  );
}
