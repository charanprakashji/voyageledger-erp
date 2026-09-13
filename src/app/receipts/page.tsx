import React from 'react';
import prisma from '@/lib/prisma';
import { getReceipts } from '@/app/actions/receipts';
import { ReceiptListTable } from '@/components/receipts/ReceiptListTable';
import { Header } from '@/components/layout/Header';

export const dynamic = 'force-dynamic';

export default async function ReceiptsPage() {
  let receipts: any[] = [];
  let pagination = { total: 0, page: 1, limit: 20, totalPages: 0 };
  let customers: any[] = [];

  try {
    const [receiptRes, customerList] = await Promise.all([
      getReceipts({ limit: 50 }),
      prisma.customer.findMany({
        where: { isActive: true },
        select: { id: true, name: true, code: true },
        orderBy: { name: 'asc' },
      }),
    ]);

    if (receiptRes.success) {
      receipts = receiptRes.data;
      pagination = receiptRes.pagination;
    }
    customers = customerList.map((c) => ({
      id: c.id,
      name: c.name,
      code: c.code,
    }));
  } catch (err) {
    console.error('Error loading receipts page:', err);
  }

  return (
    <div>
      <Header title="Customer Receipts & Settlements" userRole="ADMIN" />
      <div className="p-8">
        <ReceiptListTable
          initialData={receipts}
          pagination={pagination}
          customers={customers}
        />
      </div>
    </div>
  );
}
