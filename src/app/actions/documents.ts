"use server";

import prisma from "@/lib/prisma";
import { getCurrentUser, requireRole } from "@/lib/auth";
import { recordAuditLog } from "@/lib/audit";
import { UserRole } from "@prisma/client";
import { revalidatePath } from "next/cache";

export interface AttachDocumentInput {
  bookingId?: string;
  entityType: "BOOKING" | "INVOICE" | "RECEIPT" | "EXPENSE" | "SUPPLIER" | "CUSTOMER";
  entityId: string;
  fileName: string;
  fileSize: number;
  mimeType: string;
  gcsPath: string; // e.g. gs://travel-accounting-2026-docs/passports/pax-123.pdf
}

export async function attachDocument(input: AttachDocumentInput) {
  const currentUser = await requireRole([
    UserRole.ADMIN,
    UserRole.MANAGER,
    UserRole.TRAVEL_AGENT,
    UserRole.ACCOUNTANT,
  ]);

  try {
    const doc = await prisma.documentAttachment.create({
      data: {
        bookingId: input.bookingId || null,
        entityType: input.entityType,
        entityId: input.entityId,
        fileName: input.fileName.trim(),
        fileSize: input.fileSize,
        mimeType: input.mimeType.trim(),
        gcsPath: input.gcsPath.trim(),
        uploadedBy: currentUser.name,
      },
    });

    await recordAuditLog({
      userId: currentUser.id,
      action: "UPLOAD_DOCUMENT",
      entityName: "DocumentAttachment",
      entityId: doc.id,
      newValues: {
        fileName: doc.fileName,
        gcsPath: doc.gcsPath,
        entityType: doc.entityType,
        entityId: doc.entityId,
      },
    });

    if (input.bookingId) {
      revalidatePath(`/bookings/${input.bookingId}`);
    }

    return { success: true, data: doc };
  } catch (error: any) {
    console.error("Error attaching document:", error);
    return { success: false, error: error.message || "Failed to attach document" };
  }
}
