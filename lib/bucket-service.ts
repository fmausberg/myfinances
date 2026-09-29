import "server-only";
import { Prisma } from "@/generated/prisma/client";
import { prisma } from "@/lib/prisma";
import { accountTreeSelect } from "@/lib/booking-account-data";
import { allowsAccountChildren } from "@/lib/booking-account-policy";
import { isEligibleBucketAccount } from "@/lib/bucket-policy";
import { nextPosition } from "@/lib/list-position";

export class BucketError extends Error {}
const options = { isolationLevel: Prisma.TransactionIsolationLevel.Serializable, timeout: 30000 } as const;

// Retrying serialization failures also re-reads ownership and eligibility.
async function transaction<T>(work: (tx: Prisma.TransactionClient) => Promise<T>): Promise<T> {
  for (let attempt = 0; ; attempt++) {
    try {
      return await prisma.$transaction(work, options);
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2034" && attempt < 2) continue;
      throw error;
    }
  }
}

function read(form: FormData, key: string) {
  const value = form.get(key);
  return typeof value === "string" ? value.trim() : "";
}

function readCurrency(form: FormData) {
  const currency = read(form, "currency");
  if (!/^[A-Z]{3}$/.test(currency)) throw new BucketError("Die Währung muss aus drei Großbuchstaben bestehen, zum Beispiel EUR.");
  return currency;
}

// Bucket has no archive column: its linked account is the sole archive state.
// No financial-entry models exist in the current schema. If added, currency
// changes/deletion need explicit dependency checks here before any write.
async function ownedBucket(tx: Prisma.TransactionClient, ownerId: string, id: string) {
  const bucket = await tx.bucket.findFirst({
    where: { id, ownerId },
    include: { bookingAccount: { include: { _count: { select: { children: true } } } } },
  });
  if (!bucket || bucket.bookingAccount.ownerId !== ownerId) throw new BucketError("Bucket nicht gefunden oder kein Zugriff.");
  const account = bucket.bookingAccount;
  if (account.templateId || account.type !== "LIQUID_ASSETS" || !account.isPostable || account._count.children) {
    throw new BucketError("Das verknüpfte Konto muss ein persönliches, bebuchbares Liquiditätskonto ohne Unterkonten sein.");
  }
  return bucket;
}

export async function createOwnedBucket(ownerId: string, form: FormData) {
  const mode = read(form, "mode");
  if (mode !== "new" && mode !== "existing") throw new BucketError("Bitte wähle, wie der Bucket angelegt werden soll.");
  const currency = readCurrency(form);
  const notes = read(form, "notes") || null;
  return transaction(async (tx) => {
    const accounts = await tx.bookingAccount.findMany({ where: { ownerId }, select: accountTreeSelect });
    const buckets = await tx.bucket.findMany({ where: { ownerId }, select: { position: true } });
    const position = nextPosition(buckets);
    let accountId: string;
    let name: string;
    if (mode === "existing") {
      const account = accounts.find((item) => item.id === read(form, "bookingAccountId"));
      if (!account || !isEligibleBucketAccount(account, accounts) ||
        await tx.bookingAccount.count({ where: { parentId: account.id } })) {
        throw new BucketError("Das Konto ist nicht verfügbar. Wähle ein eigenes, aktives Liquiditätskonto ohne Unterkonten oder Bucket.");
      }
      // Existing data, position and any future entries on this account stay intact.
      accountId = account.id;
      name = account.name;
    } else {
      name = read(form, "name");
      if (!name) throw new BucketError("Bitte gib einen Namen ein.");
      const parent = accounts.find((item) => item.id === read(form, "parentId"));
      if (!parent || parent.type !== "LIQUID_ASSETS" || !allowsAccountChildren(parent.id, accounts)) {
        throw new BucketError("Wähle eine aktive, für eigene Unterkonten freigegebene Liquiditätskontengruppe.");
      }
      const account = await tx.bookingAccount.create({
        data: {
          ownerId, name, parentId: parent.id, type: "LIQUID_ASSETS",
          isPostable: true, isArchived: false,
          position: nextPosition(accounts.filter((item) => item.parentId === parent.id && item.type === parent.type)),
        },
        select: { id: true },
      });
      accountId = account.id;
    }
    return tx.bucket.create({ data: { ownerId, name, currency, notes, position, bookingAccountId: accountId } });
  });
}

export async function updateOwnedBucket(ownerId: string, id: string, form: FormData) {
  const name = read(form, "name");
  if (!name) throw new BucketError("Bitte gib einen Namen ein.");
  const currency = readCurrency(form);
  const notes = read(form, "notes") || null;
  const isArchived = form.get("isArchived") === "on";
  return transaction(async (tx) => {
    const bucket = await ownedBucket(tx, ownerId, id);
    await tx.bookingAccount.update({
      where: { id: bucket.bookingAccountId, ownerId },
      data: { name, isArchived },
    });
    return tx.bucket.update({ where: { id, ownerId }, data: { name, currency, notes } });
  });
}

export async function deleteOwnedBucket(ownerId: string, id: string) {
  return transaction(async (tx) => {
    const bucket = await ownedBucket(tx, ownerId, id);
    await tx.bucket.delete({ where: { id, ownerId } });
    await tx.bookingAccount.delete({ where: { id: bucket.bookingAccountId, ownerId } });
  });
}

export async function reorderOwnedBuckets(ownerId: string, ids: string[]) {
  if (!Array.isArray(ids) || ids.some((id) => typeof id !== "string" || !id) || new Set(ids).size !== ids.length) {
    throw new BucketError("Ungültige Reihenfolge.");
  }
  return transaction(async (tx) => {
    const buckets = await tx.bucket.findMany({ where: { ownerId }, select: { id: true } });
    const ownIds = new Set(buckets.map((bucket) => bucket.id));
    if (ids.length !== ownIds.size || ids.some((id) => !ownIds.has(id))) {
      throw new BucketError("Die Bucket-Liste hat sich geändert oder enthält fremde Einträge. Bitte lade sie neu.");
    }
    // Validate linked account structure/ownership for every affected record.
    for (const id of ids) await ownedBucket(tx, ownerId, id);
    for (const [position, id] of ids.entries()) {
      await tx.bucket.update({ where: { id, ownerId }, data: { position } });
    }
  });
}
