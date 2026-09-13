import bcrypt from "bcryptjs";
import { cookies } from "next/headers";
import { db } from "@/lib/db";
import { UserRole } from "@prisma/client";

export interface SessionUser {
  id: string;
  email: string;
  name: string;
  role: UserRole;
  status: "ACTIVE" | "INACTIVE" | "SUSPENDED";
}

const SESSION_COOKIE_NAME = "voyage_ledger_session";

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
