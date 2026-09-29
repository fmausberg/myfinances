"use server";

import { revalidatePath } from "next/cache";
import { Prisma } from "@/generated/prisma/client";
import { prisma } from "@/lib/prisma";
import { requireSession } from "@/lib/session";
import type { ActionResult } from "@/lib/action-result";
import { accountTreeSelect } from "@/lib/booking-account-data";
import { allowsAccountChildren, isAccountDescendant } from "@/lib/booking-account-policy";

const path = "/booking-accounts";
const transactionOptions = { isolationLevel: Prisma.TransactionIsolationLevel.Serializable, timeout: 30000 } as const;

function failure(error: unknown): ActionResult {
  if (error instanceof Prisma.PrismaClientKnownRequestError) {
    if (error.code === "P2034" || error.code === "P2002") {
      return { error: "Die Daten wurden gleichzeitig geändert. Bitte lade die Seite neu und versuche es erneut." };
    }
    if (error.code === "P2003") return { error: "Das Konto wird noch verwendet und kann nicht gelöscht werden." };
    if (error.code === "P2025") return { error: "Konto nicht gefunden oder kein Zugriff." };
  }
  return { error: "Die Änderung konnte nicht gespeichert werden. Bitte versuche es erneut." };
}

export async function initializeBookingAccounts(): Promise<ActionResult> {
  const { user } = await requireSession();
  try {
    const result = await prisma.$transaction(async (tx): Promise<ActionResult> => {
      if (await tx.bookingAccount.count({ where: { ownerId: user.id } })) {
        return { success: true };
      }
      const templates = await tx.bookingAccountTemplate.findMany({
        orderBy: [{ position: "asc" }, { number: "asc" }],
      });
      const byId = new Map(templates.map((template) => [template.id, template]));
      const children = new Map<string, typeof templates>();
      for (const template of templates) {
        if (template.parentId) {
          if (!byId.has(template.parentId)) return { error: "Die Vorlagenhierarchie ist unvollständig. Bitte wende dich an einen Administrator." };
          const siblings = children.get(template.parentId) ?? [];
          siblings.push(template);
          children.set(template.parentId, siblings);
        }
      }
      const stack = templates.filter((template) => !template.parentId).reverse()
        .map((template) => ({ template, excluded: false }));
      const visited = new Set<string>();
      const ordered: typeof templates = [];
      while (stack.length) {
        const { template, excluded } = stack.pop()!;
        if (visited.has(template.id)) return { error: "Die Vorlagenhierarchie enthält einen Kreis." };
        visited.add(template.id);
        const skip = excluded || template.isArchived;
        if (!skip) {
          if (template.parentId && byId.get(template.parentId)?.type !== template.type) {
            return { error: "Die Kontotypen in den Vorlagen passen nicht zusammen. Bitte wende dich an einen Administrator." };
          }
          ordered.push(template);
        }
        for (const child of [...(children.get(template.id) ?? [])].reverse()) {
          stack.push({ template: child, excluded: skip });
        }
      }
      if (visited.size !== templates.length) return { error: "Die Vorlagenhierarchie enthält einen Kreis. Bitte wende dich an einen Administrator." };
      if (!ordered.length) return { error: "Es stehen noch keine aktiven Vorlagen bereit. Bitte wende dich an einen Administrator." };

      const accountIds = new Map<string, string>();
      for (const template of ordered) {
        const account = await tx.bookingAccount.create({
          data: {
            ownerId: user.id, templateId: template.id,
            parentId: template.parentId ? accountIds.get(template.parentId)! : null,
            name: template.name, description: template.description,
            type: template.type, position: template.position,
            isPostable: template.isPostable, isArchived: false,
          },
          select: { id: true },
        });
        accountIds.set(template.id, account.id);
      }
      return { success: true };
    }, transactionOptions);
    if (result.error) return result;
  } catch (error) {
    return failure(error);
  }
  revalidatePath(path);
  return { success: true };
}

export async function saveBookingAccount(id: string | null, formData: FormData): Promise<ActionResult> {
  const { user } = await requireSession();
  if (id !== null && (typeof id !== "string" || !id)) return { error: "Ungültiges Konto." };
  const read = (key: string) => {
    const value = formData.get(key);
    return typeof value === "string" ? value.trim() : "";
  };
  const name = read("name");
  const rawPosition = read("position");
  const position = Number(rawPosition);
  if (!name) return { error: "Bitte gib einen Namen ein." };
  if (!/^-?\d+$/.test(rawPosition) || !Number.isInteger(position) || position < -2147483648 || position > 2147483647) {
    return { error: "Bitte gib eine gültige ganzzahlige Position ein." };
  }
  const common = { name, description: read("description") || null, position, isArchived: formData.get("isArchived") === "on" };
  try {
    const result = await prisma.$transaction(async (tx): Promise<ActionResult> => {
      const accounts = await tx.bookingAccount.findMany({ where: { ownerId: user.id }, select: accountTreeSelect });
      const current = id ? accounts.find((account) => account.id === id) : null;
      if (id && !current) return { error: "Konto nicht gefunden oder kein Zugriff." };
      if (current?.templateId) {
        // Template identity, structure, type and posting rules are not user input.
        await tx.bookingAccount.update({ where: { id: current.id, ownerId: user.id }, data: common });
        return { success: true };
      }
      const parentId = read("parentId");
      const parent = accounts.find((account) => account.id === parentId);
      if (!parent || (current?.parentId !== parent.id && !allowsAccountChildren(parent.id, accounts))) {
        return { error: "Unter diesem Konto sind keine eigenen Unterkonten erlaubt. Wähle einen aktiven, freigegebenen Zweig." };
      }
      if (id && isAccountDescendant(parent.id, id, accounts)) return { error: "Ein Konto darf nicht unter sich selbst oder eines seiner Unterkonten verschoben werden." };
      // Existing custom accounts retain their type. New accounts inherit it.
      if (current && current.type !== parent.type) return { error: "Das übergeordnete Konto muss denselben Kontotyp haben." };
      const isPostable = formData.get("isPostable") === "on";
      if (current?.bucket && !isPostable) return { error: "Ein mit einem Bucket verknüpftes Konto muss bebuchbar bleiben." };
      const data = { ...common, parentId: parent.id, type: current?.type ?? parent.type, isPostable };
      if (current) await tx.bookingAccount.update({ where: { id: current.id, ownerId: user.id }, data });
      else await tx.bookingAccount.create({ data: { ...data, ownerId: user.id } });
      return { success: true };
    }, transactionOptions);
    if (result.error) return result;
  } catch (error) {
    return failure(error);
  }
  revalidatePath(path);
  return { success: true };
}

export async function deleteBookingAccount(id: string): Promise<ActionResult> {
  const { user } = await requireSession();
  if (typeof id !== "string" || !id) return { error: "Ungültiges Konto." };
  try {
    const result = await prisma.$transaction(async (tx): Promise<ActionResult> => {
      const account = await tx.bookingAccount.findFirst({
        where: { id, ownerId: user.id },
        select: { templateId: true, bucket: { select: { id: true } }, _count: { select: { children: true } } },
      });
      if (!account) return { error: "Konto nicht gefunden oder kein Zugriff." };
      if (account.templateId) return { error: "Vorlagenkonten können nur archiviert werden." };
      if (account.bucket || account._count.children) return { error: "Das Konto besitzt Unterkonten oder ist mit einem Bucket verknüpft. Archiviere es stattdessen." };
      await tx.bookingAccount.delete({ where: { id, ownerId: user.id } });
      return { success: true };
    }, transactionOptions);
    if (result.error) return result;
  } catch (error) {
    return failure(error);
  }
  revalidatePath(path);
  return { success: true };
}
