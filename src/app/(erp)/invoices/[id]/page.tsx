import React from 'react';
import { notFound } from 'next/navigation';
import { getInvoiceById } from '@/app/actions/invoices';
import { InvoiceDetailView } from '@/components/invoices/InvoiceDetailView';
import { Header } from '@/components/layout/Header';

export const dynamic = 'force-dynamic';

interface InvoicePageProps {
  params: Promise<{ id: string }>;
}

export default async function InvoiceDetailPage({ params }: InvoicePageProps) {
  const { id } = await params;
  const res = await getInvoiceById(id);

  if (!res.success || !res.data) {
    notFound();
  }

  return (
    <div>
      <Header title={`Invoice ${res.data.invoiceNumber}`} userRole="ADMIN" />
      <div className="p-8 max-w-7xl mx-auto">
        <InvoiceDetailView invoice={res.data} />
      </div>
    </div>
  );
}
