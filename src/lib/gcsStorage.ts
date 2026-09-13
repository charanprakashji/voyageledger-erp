import crypto from "crypto";

export const ALLOWED_MIME_TYPES = [
  "application/pdf",
  "image/jpeg",
  "image/png",
  "image/webp",
] as const;

export type AllowedMimeType = (typeof ALLOWED_MIME_TYPES)[number];

export const MAX_FILE_SIZE_BYTES = 10 * 1024 * 1024; // 10MB

export interface FileValidationResult {
  isValid: boolean;
  sanitizedFilename?: string;
  storageKey?: string;
  error?: string;
}

export interface SignedUploadUrlResult {
  uploadUrl: string;
  storageKey: string;
  expiresAt: string;
}

/**
 * Validates file upload metadata for document security (passports, visas, invoices, receipts).
 */
export function validateDocumentUpload(
  originalFilename: string,
  mimeType: string,
  sizeBytes: number
): FileValidationResult {
  if (sizeBytes > MAX_FILE_SIZE_BYTES) {
    return {
      isValid: false,
      error: `File size exceeds the 10MB limit (${(sizeBytes / (1024 * 1024)).toFixed(2)} MB uploaded).`,
    };
  }

  if (!ALLOWED_MIME_TYPES.includes(mimeType as AllowedMimeType)) {
    return {
      isValid: false,
      error: `File type '${mimeType}' is not permitted. Only PDF, JPEG, PNG, and WebP documents are allowed.`,
    };
  }

  // Sanitize filename (strip directory traversal, special characters)
  const sanitized = originalFilename
    .replace(/[^a-zA-Z0-9._-]/g, "_")
    .replace(/\.+/g, ".");

  const randomSuffix = crypto.randomBytes(8).toString("hex");
  const timestamp = Date.now();
  const storageKey = `secure_docs/${timestamp}_${randomSuffix}_${sanitized}`;

  return {
    isValid: true,
    sanitizedFilename: sanitized,
    storageKey,
  };
}

/**
 * Generates simulated time-bound signed access tokens / URLs for Google Cloud Storage artifacts.
 */
export function generateSignedDocumentUrl(
  storageKey: string,
  expiresInMinutes: number = 15
): SignedUploadUrlResult {
  const expiresAt = new Date(Date.now() + expiresInMinutes * 60 * 1000).toISOString();
  const token = crypto
    .createHmac("sha256", process.env.SESSION_SECRET || "secure-storage-key-2026")
    .update(`${storageKey}:${expiresAt}`)
    .digest("hex");

  const bucket = process.env.GCS_BUCKET_NAME || "travel-accounting-docs-2026";
  const uploadUrl = `https://storage.googleapis.com/${bucket}/${storageKey}?exp=${encodeURIComponent(
    expiresAt
  )}&sig=${token}`;

  return {
    uploadUrl,
    storageKey,
    expiresAt,
  };
}
