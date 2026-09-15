import React from 'react';
import prisma from '@/lib/prisma';
import { ReceiptForm } from '@/components/receipts/ReceiptForm';

export const dynamic = 'force-dynamic';

export default async function NewReceiptPage() {
  const [rawCustomers, rawInvoices, rawBankAccounts] = await Promise.all([
    prisma.customer.findMany({
      where: { isActive: true },
      select: { id: true, name: true, code: true, companyName: true },
      orderBy: { name: 'asc' },
    }),
    prisma.invoice.findMany({
      where: {
        status: { in: ['POSTED', 'PARTIALLY_PAID'] },
        balanceDue: { gt: 0 },
      },
      select: {
        id: true,
        invoiceNumber: true,
        customerId: true,
        currency: true,
        exchangeRate: true,
        grandTotal: true,
        paidAmount: true,
        balanceDue: true,
        status: true,
      },
      orderBy: { issueDate: 'desc' },
    }),
    prisma.chartOfAccount.findMany({
      where: {
        isActive: true,
        accountType: 'ASSET',
        code: { in: ['1010', '1020', '1030'] },
      },
      select: { id: true, code: true, name: true },
      orderBy: { code: 'asc' },
    }),
  ]);

  const customers = rawCustomers.map((c) => ({
    id: c.id,
    name: c.name,
    code: c.code,
    companyName: c.companyName,
  }));

  const invoices = rawInvoices.map((inv) => ({
    id: inv.id,
    invoiceNumber: inv.invoiceNumber,
    customerId: inv.customerId,
    currency: inv.currency,
    exchangeRate: Number(inv.exchangeRate),
    grandTotal: Number(inv.grandTotal),
    paidAmount: Number(inv.paidAmount),
    balanceDue: Number(inv.balanceDue),
    status: inv.status,
  }));

  const bankAccounts = rawBankAccounts.map((b) => ({
    id: b.id,
    code: b.code,
    name: b.name,
    currency: b.code === '1030' ? 'USD' : 'AFN',
  }));

  return (
    <div className="max-w-6xl mx-auto">
      <ReceiptForm
        customers={customers}
        invoices={invoices}
        bankAccounts={bankAccounts}
      />
    </div>
  );
}
