import React from "react";
import prisma from "@/lib/prisma";
import { getShareholders } from "@/app/actions/shareholders";
import { ShareholderList } from "@/components/shareholders/ShareholderList";
import { Header } from "@/components/layout/Header";

export const dynamic = "force-dynamic";

export default async function ShareholdersPage() {
  let shareholders: any[] = [];
  let pagination = { total: 0, page: 1, limit: 20, totalPages: 0 };

  try {
    const res = await getShareholders({ limit: 50 });
    if (res.success) {
      shareholders = res.data;
      pagination = res.pagination;
    }
  } catch (err) {
    console.error("Error loading shareholders page:", err);
  }

  return (
    <div>
      <Header title="Company Shareholders & Capital Structure" userRole="ADMIN" />
      <div className="p-8">
        <ShareholderList initialData={shareholders} pagination={pagination} />
      </div>
    </div>
  );
}
