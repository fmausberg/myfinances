"use server";

import { revalidatePath } from "next/cache";
import { Prisma } from "@/generated/prisma/client";
import { requireSession } from "@/lib/session";
import type { ActionResult } from "@/lib/action-result";
import { BucketError, createOwnedBucket, updateOwnedBucket, deleteOwnedBucket, reorderOwnedBuckets } from "@/lib/bucket-service";

async function mutate(work: (ownerId: string) => Promise<unknown>): Promise<ActionResult> {
  const { user } = await requireSession();
  try {
    await work(user.id);
  } catch (error) {
    if (error instanceof BucketError) return { error: error.message };
    if (error instanceof Prisma.PrismaClientKnownRequestError) {
      if (error.code === "P2002") return { error: "Dieses Konto wurde inzwischen einem Bucket zugeordnet. Bitte lade die Liste neu." };
      if (error.code === "P2034") return { error: "Die Daten wurden gleichzeitig geändert. Bitte versuche es erneut." };
      if (error.code === "P2003") return { error: "Bucket oder Konto werden noch verwendet und können nicht gelöscht werden." };
      if (error.code === "P2025") return { error: "Bucket nicht gefunden oder kein Zugriff." };
    }
    return { error: "Die Änderung konnte nicht gespeichert werden. Bitte versuche es erneut." };
  }
  revalidatePath("/buckets");
  revalidatePath("/booking-accounts");
  return { success: true };
}

export async function createBucket(form: FormData): Promise<ActionResult> {
  return mutate((ownerId) => createOwnedBucket(ownerId, form));
}
export async function updateBucket(id: string, form: FormData): Promise<ActionResult> {
  return mutate((ownerId) => {
    if (typeof id !== "string" || !id) throw new BucketError("Ungültiger Bucket.");
    return updateOwnedBucket(ownerId, id, form);
  });
}
export async function deleteBucket(id: string): Promise<ActionResult> {
  return mutate((ownerId) => {
    if (typeof id !== "string" || !id) throw new BucketError("Ungültiger Bucket.");
    return deleteOwnedBucket(ownerId, id);
  });
}
export async function reorderBuckets(ids: string[]): Promise<ActionResult> {
  return mutate((ownerId) => reorderOwnedBuckets(ownerId, ids));
}
