"use server";

import { db } from "@/lib/db";
import { verifyPassword, hashPassword, createSession, destroySession, getCurrentUser } from "@/lib/auth";
import { recordAuditLog } from "@/lib/audit";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

export interface AuthActionResult {
  success: boolean;
  error?: string;
}

/**
 * Seeds the initial Admin user if the database has no users.
 */
export async function seedInitialAdmin(): Promise<void> {
  const userCount = await db.user.count();
  if (userCount === 0) {
    const passwordHash = await hashPassword("Admin@2026");
    await db.user.create({
      data: {
        email: "admin@voyageledger.af",
        name: "System Administrator",
        passwordHash,
        role: "ADMIN",
        status: "ACTIVE",
        phone: "+93 70 000 0000",
      },
    });
  }
}

/**
 * Server Action for User Login.
 */
export async function loginAction(
  prevState: AuthActionResult | null,
  formData: FormData
): Promise<AuthActionResult> {
  try {
    await seedInitialAdmin();

    const email = formData.get("email")?.toString().trim().toLowerCase();
    const password = formData.get("password")?.toString();

    if (!email || !password) {
      return { success: false, error: "Email and password are required." };
    }

    const user = await db.user.findUnique({
      where: { email },
    });

    if (!user) {
      return { success: false, error: "Invalid email or password." };
    }

    // Inactive or suspended users cannot authenticate
    if (user.status !== "ACTIVE") {
      return {
        success: false,
        error: "Your account is inactive or suspended. Please contact the administrator.",
      };
    }

    const isMatch = await verifyPassword(password, user.passwordHash);
    if (!isMatch) {
      return { success: false, error: "Invalid email or password." };
    }

    // Create secure session cookie
    await createSession({
      id: user.id,
      email: user.email,
      name: user.name,
      role: user.role,
      status: user.status,
    });

    // Record audit log
    await recordAuditLog({
      userId: user.id,
      action: "LOGIN",
      entityName: "User",
      entityId: user.id,
      newValues: { email: user.email, role: user.role },
    });

    return { success: true };
  } catch (error) {
    console.error("Login error:", error);
    return { success: false, error: "An unexpected error occurred during login." };
  }
}

/**
 * Server Action for User Logout.
 */
export async function logoutAction(): Promise<void> {
  const user = await getCurrentUser();
  if (user) {
    await recordAuditLog({
      userId: user.id,
      action: "LOGOUT",
      entityName: "User",
      entityId: user.id,
    });
  }

  await destroySession();
  revalidatePath("/", "layout");
  redirect("/login");
}
