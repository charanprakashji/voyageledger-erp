import { Storage } from "@google-cloud/storage";

const projectId = process.env.GCP_PROJECT_ID || "travel-accounting-2026";
const bucketName = process.env.GCS_BUCKET_NAME || "travel-accounting-2026-docs";

// Initialize GCS client
let storageClient: Storage | null = null;

function getStorageClient(): Storage {
  if (!storageClient) {
    storageClient = new Storage({
      projectId,
      ...(process.env.GOOGLE_APPLICATION_CREDENTIALS
        ? { keyFilename: process.env.GOOGLE_APPLICATION_CREDENTIALS }
        : {}),
    });
  }
  return storageClient;
}

/**
 * Generates a signed upload URL so client browsers can directly upload
 * documents (vouchers, tickets, receipts, bank slips) to Google Cloud Storage
 * without passing heavy binary payloads through the Next.js server.
 */
export async function generateSignedUploadUrl(
  fileName: string,
  contentType: string,
  folder: "bookings" | "invoices" | "receipts" | "expenses" = "bookings"
): Promise<{ uploadUrl: string; gcsPath: string; fileKey: string }> {
  const storage = getStorageClient();
  const bucket = storage.bucket(bucketName);
  
  const timestamp = Date.now();
  const sanitizedName = fileName.replace(/[^a-zA-Z0-9.-]/g, "_");
  const fileKey = `${folder}/${timestamp}-${sanitizedName}`;
  const file = bucket.file(fileKey);

  // URL valid for 15 minutes
  const [uploadUrl] = await file.getSignedUrl({
    version: "v4",
    action: "write",
    expires: Date.now() + 15 * 60 * 1000,
    contentType,
  });

  const gcsPath = `gs://${bucketName}/${fileKey}`;

  return {
    uploadUrl,
    gcsPath,
    fileKey,
  };
}

/**
 * Generates a temporary read-only signed URL for viewing an uploaded document.
 */
export async function generateSignedReadUrl(fileKey: string): Promise<string> {
  const storage = getStorageClient();
  const bucket = storage.bucket(bucketName);
  const file = bucket.file(fileKey);

  const [readUrl] = await file.getSignedUrl({
    version: "v4",
    action: "read",
    expires: Date.now() + 60 * 60 * 1000, // 1 hour
  });

  return readUrl;
}
