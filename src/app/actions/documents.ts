"use server";

import prisma from "@/lib/prisma";
import { requireRole, handleActionError } from "@/lib/auth";
import { recordAuditLog } from "@/lib/audit";
import { UserRole } from "@prisma/client";
import { safeRevalidatePath } from "@/lib/utils";

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
  try {
    const currentUser = await requireRole([
      UserRole.ADMIN,
      UserRole.MANAGER,
      UserRole.TRAVEL_AGENT,
      UserRole.ACCOUNTANT,
    ]);

    if (!input.fileName || !input.fileName.trim()) {
      return { success: false, error: "File name is required" };
    }

    const sanitizedFileName = input.fileName.trim().replace(/[/\\?%*:|"<>]/g, "_");
    const extension = sanitizedFileName.split(".").pop()?.toLowerCase() || "";

    const ALLOWED_EXTENSIONS = ["pdf", "jpg", "jpeg", "png", "webp"];
    const ALLOWED_MIME_TYPES = [
      "application/pdf",
      "image/jpeg",
      "image/png",
      "image/webp",
    ];

    if (!ALLOWED_EXTENSIONS.includes(extension)) {
      return {
        success: false,
        error: `Invalid file extension '.${extension}'. Only PDF and image files are permitted.`,
      };
    }

    if (!ALLOWED_MIME_TYPES.includes(input.mimeType.toLowerCase().trim())) {
      return {
        success: false,
        error: `Invalid MIME type '${input.mimeType}'. Only PDF and Image documents are allowed.`,
      };
    }

    const MAX_SIZE_BYTES = 10 * 1024 * 1024; // 10MB
    if (input.fileSize <= 0 || input.fileSize > MAX_SIZE_BYTES) {
      return {
        success: false,
        error: "File size exceeds the 10MB limit or is empty.",
      };
    }

    const doc = await prisma.documentAttachment.create({
      data: {
        bookingId: input.bookingId || null,
        entityType: input.entityType,
        entityId: input.entityId,
        fileName: sanitizedFileName,
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
      safeRevalidatePath(`/bookings/${input.bookingId}`);
    }

    return { success: true as const, data: doc };
  } catch (error: any) {
    return handleActionError(error, "Failed to attach document");
  }
}
