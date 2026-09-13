import React from 'react';
import { notFound } from 'next/navigation';
import { getReceiptById } from '@/app/actions/receipts';
import { ReceiptDetailView } from '@/components/receipts/ReceiptDetailView';
import { Header } from '@/components/layout/Header';

export const dynamic = 'force-dynamic';

interface ReceiptPageProps {
  params: Promise<{ id: string }>;
}

export default async function ReceiptDetailPage({ params }: ReceiptPageProps) {
  const { id } = await params;
  const res = await getReceiptById(id);

  if (!res.success || !res.data) {
    notFound();
  }

  return (
    <div>
      <Header title={`Receipt ${res.data.receiptNumber}`} userRole="ADMIN" />
      <div className="p-8 max-w-7xl mx-auto">
        <ReceiptDetailView receipt={res.data as any} />
      </div>
    </div>
  );
}
