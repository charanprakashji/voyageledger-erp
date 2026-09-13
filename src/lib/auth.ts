import bcrypt from "bcryptjs";
import { cookies } from "next/headers";
import { db } from "@/lib/db";
import { UserRole } from "@prisma/client";
import {
  SessionUser,
  SESSION_COOKIE_NAME,
  SESSION_MAX_AGE_MS,
  sanitizeRedirectUrl,
} from "./authCommon";

export {
  type SessionUser,
  SESSION_COOKIE_NAME,
  SESSION_MAX_AGE_MS,
  sanitizeRedirectUrl,
};

export function parseSessionCookie(cookieValue?: string | null): SessionUser | null {
  if (!cookieValue) return null;
  try {
    const decoded = Buffer.from(cookieValue, "base64").toString("utf-8");
    const parsed = JSON.parse(decoded) as SessionUser & { createdAt?: number };
    if (parsed && parsed.id && parsed.role) {
      if (parsed.createdAt && typeof parsed.createdAt === "number") {
        if (Date.now() - parsed.createdAt > SESSION_MAX_AGE_MS) {
          return null; // Expired session
        }
      }
      return {
        id: parsed.id,
        email: parsed.email,
        name: parsed.name,
        role: parsed.role,
        status: parsed.status,
      };
    }
    return null;
  } catch {
    return null;
  }
}

/**
 * Standardized, safe error handler for server actions.
 * Guarantees that sensitive database errors, Prisma exceptions, SQL queries,
 * credentials, and stack traces are NOT leaked to the client.
 */
export function handleActionError(
  error: unknown,
  fallbackMessage = "An unexpected server error occurred. Please try again later."
): { success: false; error: string } {
  const message = error instanceof Error ? error.message : String(error);

  if (message.startsWith("UNAUTHORIZED")) {
    return {
      success: false,
      error: "UNAUTHORIZED: Authentication required. Please sign in.",
    };
  }

  if (message.startsWith("FORBIDDEN")) {
    return {
      success: false,
      error: message.includes("inactive or suspended")
        ? "FORBIDDEN: User account is inactive or suspended."
        : "FORBIDDEN: You do not have permission to perform this action.",
    };
  }

  const isSensitiveInternalError =
    message.includes("PrismaClient") ||
    message.includes("invocation:") ||
    message.includes("SELECT ") ||
    message.includes("INSERT ") ||
    message.includes("UPDATE ") ||
    message.includes("DELETE ") ||
    message.includes("connection pool") ||
    message.includes("ECONNREFUSED") ||
    message.includes("FATAL:") ||
    message.includes("at ") ||
    message.includes("node_modules") ||
    message.includes("password") ||
    message.includes("DATABASE_URL") ||
    message.includes("Unique constraint failed");

  if (isSensitiveInternalError) {
    console.error("[Safe Server Action Error - Internal/Database]:", error);
    return { success: false, error: fallbackMessage };
  }

  return { success: false, error: message || fallbackMessage };
}

/**
 * Hashes a plain password using bcrypt (10 rounds).
 */
export async function hashPassword(password: string): Promise<string> {
  const salt = await bcrypt.genSalt(10);
  return bcrypt.hash(password, salt);
}

/**
 * Verifies a plain password against the stored bcrypt hash.
 */
export async function verifyPassword(password: string, hash: string): Promise<boolean> {
  return bcrypt.compare(password, hash);
}

/**
 * Creates a signed/encoded cookie session for authenticated users.
 */
export async function createSession(user: SessionUser): Promise<void> {
  const sessionData = JSON.stringify({
    id: user.id,
    email: user.email,
    name: user.name,
    role: user.role,
    status: user.status,
    createdAt: Date.now(),
  });

  const encoded = Buffer.from(sessionData).toString("base64");
  const cookieStore = await cookies();
  
  cookieStore.set(SESSION_COOKIE_NAME, encoded, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: 60 * 60 * 24 * 7, // 7 days
  });
}

/**
 * Clears user session cookie.
 */
export async function destroySession(): Promise<void> {
  const cookieStore = await cookies();
  cookieStore.delete(SESSION_COOKIE_NAME);
}

/**
 * Retrieves and validates the current authenticated session.
 * Re-validates against database to ensure user is ACTIVE.
 */
export async function getCurrentUser(): Promise<SessionUser | null> {
  try {
    const cookieStore = await cookies();
    const sessionCookie = cookieStore.get(SESSION_COOKIE_NAME);

    if (!sessionCookie?.value) {
      return null;
    }

    const decoded = Buffer.from(sessionCookie.value, "base64").toString("utf-8");
    const parsed = JSON.parse(decoded) as SessionUser;

    // Verify user exists and is ACTIVE in DB
    const dbUser = await db.user.findUnique({
      where: { id: parsed.id },
      select: { id: true, email: true, name: true, role: true, status: true },
    });

    if (!dbUser || dbUser.status !== "ACTIVE") {
      return null;
    }

    return {
      id: dbUser.id,
      email: dbUser.email,
      name: dbUser.name,
      role: dbUser.role,
      status: dbUser.status,
    };
  } catch {
    return null;
  }
}

/**
 * Server-Side Role-Based Authorization Guard.
 * Throws an error or returns false if user lacks permission.
 */
export async function requireRole(allowedRoles: UserRole[]): Promise<SessionUser> {
  const user = await getCurrentUser();

  if (!user) {
    throw new Error("UNAUTHORIZED: Authentication required.");
  }

  if (user.status !== "ACTIVE") {
    throw new Error("FORBIDDEN: User account is inactive or suspended.");
  }

  if (!allowedRoles.includes(user.role)) {
    throw new Error(
      `FORBIDDEN: Access denied. Required role: [${allowedRoles.join(", ")}], but user is [${user.role}].`
    );
  }

  return user;
}
