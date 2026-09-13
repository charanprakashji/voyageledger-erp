"use server";

import { db } from "@/lib/db";
import { requireRole, hashPassword } from "@/lib/auth";
import { recordAuditLog } from "@/lib/audit";
import { revalidatePath } from "next/cache";
import { UserRole, UserStatus } from "@prisma/client";

export async function getUsers() {
  await requireRole(["ADMIN", "MANAGER"]);
  return db.user.findMany({
    orderBy: { createdAt: "desc" },
    select: {
      id: true,
      email: true,
      name: true,
      role: true,
      status: true,
      phone: true,
      createdAt: true,
      updatedAt: true,
      _count: {
        select: {
          bookingsCreated: true,
          invoicesCreated: true,
          journalEntriesCreated: true,
        },
      },
    },
  });
}

export async function createUser(formData: FormData) {
  const currentUser = await requireRole(["ADMIN"]);

  const name = formData.get("name")?.toString().trim();
  const email = formData.get("email")?.toString().trim().toLowerCase();
  const password = formData.get("password")?.toString();
  const role = formData.get("role")?.toString() as UserRole;
  const phone = formData.get("phone")?.toString().trim() || null;

  if (!name || !email || !password || !role) {
    return { success: false, error: "Name, Email, Password, and Role are required." };
  }

  const existing = await db.user.findUnique({ where: { email } });
  if (existing) {
    return { success: false, error: `User with email '${email}' already exists.` };
  }

  const passwordHash = await hashPassword(password);

  const newUser = await db.user.create({
    data: {
      name,
      email,
      passwordHash,
      role,
      status: "ACTIVE",
      phone,
    },
  });

  await recordAuditLog({
    userId: currentUser.id,
    action: "CREATE",
    entityName: "User",
    entityId: newUser.id,
    newValues: { name: newUser.name, email: newUser.email, role: newUser.role, status: newUser.status },
  });

  revalidatePath("/users");
  return { success: true, user: newUser };
}

export async function updateUserStatus(userId: string, status: UserStatus) {
  const currentUser = await requireRole(["ADMIN"]);

  if (currentUser.id === userId && status !== "ACTIVE") {
    return { success: false, error: "You cannot deactivate or suspend your own account." };
  }

  const existing = await db.user.findUnique({ where: { id: userId } });
  if (!existing) {
    return { success: false, error: "User not found." };
  }

  const updated = await db.user.update({
    where: { id: userId },
    data: { status },
  });

  await recordAuditLog({
    userId: currentUser.id,
    action: "UPDATE",
    entityName: "User",
    entityId: userId,
    oldValues: { status: existing.status },
    newValues: { status: updated.status },
  });

  revalidatePath("/users");
  return { success: true, user: updated };
}

export async function updateUserRole(userId: string, role: UserRole) {
  const currentUser = await requireRole(["ADMIN"]);

  const existing = await db.user.findUnique({ where: { id: userId } });
  if (!existing) {
    return { success: false, error: "User not found." };
  }

  const updated = await db.user.update({
    where: { id: userId },
    data: { role },
  });

  await recordAuditLog({
    userId: currentUser.id,
    action: "UPDATE",
    entityName: "User",
    entityId: userId,
    oldValues: { role: existing.role },
    newValues: { role: updated.role },
  });

  revalidatePath("/users");
  return { success: true, user: updated };
}
