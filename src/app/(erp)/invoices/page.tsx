import React from 'react';
import prisma from '@/lib/prisma';
import { getInvoices } from '@/app/actions/invoices';
import { InvoiceListTable } from '@/components/invoices/InvoiceListTable';
import { Header } from '@/components/layout/Header';

export const dynamic = 'force-dynamic';

export default async function InvoicesPage() {
  let invoices: any[] = [];
  let pagination = { total: 0, page: 1, limit: 20, totalPages: 0 };
  let customers: any[] = [];

  try {
    const [invoiceRes, customerList] = await Promise.all([
      getInvoices({ limit: 50 }),
      prisma.customer.findMany({
        where: { isActive: true },
        select: { id: true, name: true, code: true },
        orderBy: { name: 'asc' },
      }),
    ]);

    if (invoiceRes.success) {
      invoices = invoiceRes.data;
      pagination = invoiceRes.pagination;
    }
    customers = customerList.map((c) => ({
      id: c.id,
      name: c.name,
      customerCode: c.code,
    }));
  } catch (err) {
    console.error('Error loading invoices page:', err);
  }

  return (
    <div>
      <Header title="Customer Invoices & Billing" userRole="ADMIN" />
      <div className="p-8">
        <InvoiceListTable
          initialData={invoices}
          pagination={pagination}
          customers={customers}
        />
      </div>
    </div>
  );
}
