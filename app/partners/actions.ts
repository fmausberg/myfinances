"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requireSession } from "@/lib/session";
import type { Partner } from "@/generated/prisma/client";

export async function savePartner(id: string | null, formData: FormData) {
  const { user } = await requireSession();
  if (id !== null && (typeof id !== "string" || !id)) {
    return { error: "Ungültiger Partner." };
  }
  const read = (key: string) => {
    const value = formData.get(key);
    return typeof value === "string" ? value.trim() : "";
  };
  const name = read("name");
  const type = read("type");
  const email = read("email");
  const notes = read("notes");
  const contactLink = read("contactLink");

  if (!name) return { error: "Bitte gib einen Namen ein." };
  if (type !== "NATURAL_PERSON" && type !== "LEGAL_ENTITY") {
    return { error: "Bitte wähle einen gültigen Partnertyp." };
  }
  if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return { error: "Bitte gib eine gültige E-Mail-Adresse ein." };
  }
  if (contactLink) {
    try {
      const url = new URL(contactLink);
      if (!["https:", "http:"].includes(url.protocol)) throw new Error();
    } catch {
      return { error: "Bitte gib einen vollständigen Kontaktlink mit https:// oder http:// ein." };
    }
  }

  const data = {
    name, type, email: email || null, notes: notes || null,
    contactLink: contactLink || null,
  } satisfies Pick<Partner, "name" | "type" | "email" | "notes" | "contactLink">;
  try {
    if (id === null) {
      await prisma.partner.create({ data: { ...data, ownerId: user.id } });
    } else {
      // Scope the mutation itself to the owner, including concurrent requests.
      const result = await prisma.partner.updateMany({
        where: { id, ownerId: user.id },
        data,
      });
      if (!result.count) return { error: "Partner nicht gefunden oder kein Zugriff." };
    }
  } catch {
    return { error: "Der Partner konnte nicht gespeichert werden. Bitte versuche es erneut." };
  }
  revalidatePath("/partners");
  return { success: true } as const;
}

export async function deletePartner(id: string) {
  const { user } = await requireSession();
  if (typeof id !== "string" || !id) return { error: "Ungültiger Partner." };
  try {
    const result = await prisma.partner.deleteMany({ where: { id, ownerId: user.id } });
    if (!result.count) return { error: "Partner nicht gefunden oder kein Zugriff." };
  } catch {
    return { error: "Der Partner konnte nicht gelöscht werden. Bitte versuche es erneut." };
  }
  revalidatePath("/partners");
  return { success: true } as const;
}
