import React from 'react';
import { notFound } from 'next/navigation';
import { getReceiptById } from '@/app/actions/receipts';
import { ReceiptDetailView } from '@/components/receipts/ReceiptDetailView';

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
    <div className="max-w-7xl mx-auto">
      <ReceiptDetailView receipt={res.data as any} />
    </div>
  );
}
