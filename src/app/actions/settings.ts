"use server";

import { db } from "@/lib/db";
import { requireRole } from "@/lib/auth";
import { recordAuditLog } from "@/lib/audit";
import { revalidatePath } from "next/cache";

export async function getCompanySettings() {
  let settings = await db.companySetting.findFirst();
  if (!settings) {
    settings = await db.companySetting.create({
      data: {
        companyName: "Ariana Horizon Travel & Tourism",
        address: "Shahre Naw, Street 3, Kabul",
        province: "Kabul",
        district: "District 4",
        city: "Kabul",
        country: "Afghanistan",
        phone: "+93 20 220 1234",
        email: "info@arianahorizon.af",
        taxNumber: "TIN-900823410",
        taxRegistrationNumber: "BRN-KBL-2024-8891",
        defaultCurrency: "AFN",
        supportedCurrencies: ["AFN", "USD", "EUR", "AED"],
        financialYearStart: "01-01",
        invoicePrefix: "INV-",
        receiptPrefix: "RCT-",
      },
    });
  }
  return settings;
}

export async function updateCompanySettings(formData: FormData) {
  const user = await requireRole(["ADMIN"]);

  const companyName = formData.get("companyName")?.toString().trim();
  const address = formData.get("address")?.toString().trim();
  const province = formData.get("province")?.toString().trim() || "Kabul";
  const district = formData.get("district")?.toString().trim();
  const city = formData.get("city")?.toString().trim() || "Kabul";
  const phone = formData.get("phone")?.toString().trim();
  const email = formData.get("email")?.toString().trim();
  const taxNumber = formData.get("taxNumber")?.toString().trim();
  const taxRegistrationNumber = formData.get("taxRegistrationNumber")?.toString().trim();
  const defaultCurrency = formData.get("defaultCurrency")?.toString().trim() || "AFN";
  const invoicePrefix = formData.get("invoicePrefix")?.toString().trim() || "INV-";
  const receiptPrefix = formData.get("receiptPrefix")?.toString().trim() || "RCT-";

  if (!companyName) {
    return { success: false, error: "Company name is required." };
  }

  const existing = await getCompanySettings();

  const updated = await db.companySetting.update({
    where: { id: existing.id },
    data: {
      companyName,
      address,
      province,
      district,
      city,
      phone,
      email,
      taxNumber,
      taxRegistrationNumber,
      defaultCurrency,
      invoicePrefix,
      receiptPrefix,
    },
  });

  await recordAuditLog({
    userId: user.id,
    action: "UPDATE",
    entityName: "CompanySetting",
    entityId: updated.id,
    oldValues: existing,
    newValues: updated,
  });

  revalidatePath("/settings");
  revalidatePath("/", "layout");

  return { success: true, settings: updated };
}
