import React from "react";
import prisma from "@/lib/prisma";
import { getSupplierBills } from "@/app/actions/bills";
import { SupplierBillListTable } from "@/components/bills/SupplierBillListTable";
import { Header } from "@/components/layout/Header";

export const dynamic = "force-dynamic";

export default async function SupplierBillsPage() {
  let bills: any[] = [];
  let pagination = { total: 0, page: 1, limit: 20, totalPages: 0 };
  let suppliers: any[] = [];

  try {
    const [billRes, supplierList] = await Promise.all([
      getSupplierBills({ limit: 50 }),
      prisma.supplier.findMany({
        where: { isActive: true },
        select: { id: true, name: true, code: true },
        orderBy: { name: "asc" },
      }),
    ]);

    if (billRes.success) {
      bills = billRes.data;
      pagination = billRes.pagination;
    }
    suppliers = supplierList.map((s) => ({
      id: s.id,
      name: s.name,
      supplierCode: s.code,
    }));
  } catch (err) {
    console.error("Error loading supplier bills page:", err);
  }

  return (
    <div>
      <Header title="Supplier Bills & AP" userRole="ADMIN" />
      <div className="p-8">
        <SupplierBillListTable
          initialData={bills}
          pagination={pagination}
          suppliers={suppliers}
        />
      </div>
    </div>
  );
}
