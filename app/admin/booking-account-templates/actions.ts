"use server";

import { revalidatePath } from "next/cache";
import { Prisma } from "@/generated/prisma/client";
import type { BookingAccountType } from "@/generated/prisma/enums";
import { bookingAccountTypeLabels } from "@/lib/booking-account-types";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/session";
import type { ActionResult } from "@/lib/action-result";

const path = "/admin/booking-account-templates";

function databaseError(error: unknown) {
  if (error instanceof Prisma.PrismaClientKnownRequestError) {
    if (error.code === "P2002") return "Dieser Name ist bereits vergeben.";
    if (error.code === "P2003") return "Die Vorlage wird noch von Untervorlagen oder Buchungskonten verwendet. Du kannst sie stattdessen archivieren.";
    if (error.code === "P2025") return "Die Vorlage wurde nicht gefunden.";
    if (error.code === "P2034") return "Die Daten wurden zwischenzeitlich geändert. Bitte versuche es erneut.";
  }
  return "Die Änderung konnte nicht gespeichert werden. Bitte versuche es erneut.";
}

export async function saveTemplate(id: string | null, formData: FormData): Promise<ActionResult> {
  await requireAdmin();
  if (id !== null && (typeof id !== "string" || !id)) return { error: "Ungültige Vorlage." };
  const read = (key: string) => {
    const value = formData.get(key);
    return typeof value === "string" ? value.trim() : "";
  };
  const name = read("name");
  const type = read("type");
  const parentId = read("parentId") || null;
  const rawPosition = read("position");
  const position = Number(rawPosition);
  if (!/^-?\d+$/.test(rawPosition) || !Number.isInteger(position) || position < -2147483648 || position > 2147483647) {
    return { error: "Bitte gib eine ganzzahlige Position zwischen -2147483648 und 2147483647 ein." };
  }
  if (!name) return { error: "Bitte gib einen Namen ein." };
  if (!Object.hasOwn(bookingAccountTypeLabels, type)) return { error: "Bitte wähle einen gültigen Kontotyp." };
  const data = {
    code: name, name, position, type: type as BookingAccountType,
    description: read("description") || null,
    parentId,
    isArchived: formData.get("isArchived") === "on",
    isPostable: formData.get("isPostable") === "on",
    allowsCustomChildren: formData.get("allowsCustomChildren") === "on",
  };
  try {
    const result = await prisma.$transaction(async (tx): Promise<ActionResult> => {
      // Validate the complete ancestor chain in the same serializable transaction
      // as the write, so concurrent reparenting cannot introduce a cycle.
      let ancestorId = parentId;
      const seen = new Set<string>();
      if (id) seen.add(id);
      while (ancestorId) {
        if (seen.has(ancestorId)) return { error: "Diese übergeordnete Vorlage würde einen Kreis in der Hierarchie erzeugen." };
        seen.add(ancestorId);
        const ancestor: { parentId: string | null; type: BookingAccountType } | null = await tx.bookingAccountTemplate.findUnique({
          where: { id: ancestorId }, select: { parentId: true, type: true },
        });
        if (!ancestor) return { error: "Die übergeordnete Vorlage existiert nicht mehr." };
        if (ancestor.type !== data.type) {
          return { error: "Der Kontotyp muss mit der übergeordneten Vorlage und ihrer Hierarchie übereinstimmen." };
        }
        ancestorId = ancestor.parentId;
      }
      if (id) {
        const incompatibleChild = await tx.bookingAccountTemplate.findFirst({
          where: { parentId: id, type: { not: data.type } },
          select: { id: true },
        });
        if (incompatibleChild) {
          return { error: "Der Kontotyp passt nicht zu bestehenden Untervorlagen. Löse zuerst deren Zuordnung oder passe sie an." };
        }
      }
      if (id === null) await tx.bookingAccountTemplate.create({ data });
      else await tx.bookingAccountTemplate.update({ where: { id }, data });
      return { success: true } as const;
    }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
    if (result.error) return result;
  } catch (error) {
    return { error: databaseError(error) };
  }
  revalidatePath(path);
  return { success: true } as const;
}

export async function deleteTemplate(id: string): Promise<ActionResult> {
  await requireAdmin();
  if (typeof id !== "string" || !id) return { error: "Ungültige Vorlage." };
  try {
    // Restrict relations prevent deleting templates still referenced elsewhere.
    await prisma.bookingAccountTemplate.delete({ where: { id } });
  } catch (error) {
    return { error: databaseError(error) };
  }
  revalidatePath(path);
  return { success: true } as const;
}
