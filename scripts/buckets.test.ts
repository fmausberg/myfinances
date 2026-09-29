import "dotenv/config";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { test } from "node:test";
import { prisma } from "../lib/prisma";
import { accountTreeSelect } from "../lib/booking-account-data";
import { allowsAccountChildren } from "../lib/booking-account-policy";
import { createOwnedBucket, updateOwnedBucket, deleteOwnedBucket, reorderOwnedBuckets } from "../lib/bucket-service";
import { groupTemplateHierarchy } from "../lib/template-hierarchy";

function form(values: Record<string, string>) {
  const data = new FormData();
  for (const [key, value] of Object.entries(values)) data.set(key, value);
  return data;
}

test("Bucket lifecycle, ownership, hierarchy, ordering and concurrent assignment", async (t) => {
  const suffix = randomUUID();
  const userIds: string[] = [];
  const templateIds: string[] = [];
  try {
    const owner = await prisma.user.create({ data: { name: "Bucket test", email: `bucket-${suffix}@example.com` } });
    userIds.push(owner.id);
    const stranger = await prisma.user.create({ data: { name: "Other test", email: `other-bucket-${suffix}@example.com` } });
    userIds.push(stranger.id);
    const template = await prisma.bookingAccountTemplate.create({
      data: { code: suffix, name: "Allowed", type: "LIQUID_ASSETS", allowsCustomChildren: true, isPostable: false },
    });
    templateIds.push(template.id);
    const parent = await prisma.bookingAccount.create({
      data: { name: "Parent", ownerId: owner.id, templateId: template.id, type: "LIQUID_ASSETS", isPostable: false },
    });
    const otherParent = await prisma.bookingAccount.create({
      data: { name: "Other parent", ownerId: stranger.id, templateId: template.id, type: "LIQUID_ASSETS", isPostable: false },
    });
    const existing = await prisma.bookingAccount.create({
      data: { name: "Existing", description: "Keep this", ownerId: owner.id, parentId: parent.id, type: "LIQUID_ASSETS", position: 12 },
    });
    const existingBucket = await createOwnedBucket(owner.id, form({
      mode: "existing", bookingAccountId: existing.id, currency: "EUR", notes: "Attached", name: "Ignored",
      ownerId: stranger.id, position: "999",
    }));
    await t.test("Existing account is linked without replacing its data", async () => {
      assert.equal(existingBucket.name, existing.name);
      assert.equal(existingBucket.ownerId, owner.id);
      assert.equal(existingBucket.position, 0);
      const unchanged = await prisma.bookingAccount.findUniqueOrThrow({ where: { id: existing.id } });
      assert.equal(unchanged.description, "Keep this");
      assert.equal(unchanged.position, 12);
      assert.equal(unchanged.name, "Existing");
    });
    const newBucket = await createOwnedBucket(owner.id, form({
      mode: "new", parentId: parent.id, name: "New", currency: "USD", notes: "New notes",
    }));
    await t.test("New account and bucket are created with independent end positions", async () => {
      const account = await prisma.bookingAccount.findUniqueOrThrow({ where: { id: newBucket.bookingAccountId } });
      assert.equal(account.position, 13);
      assert.equal(newBucket.position, 1);
      assert.equal(account.templateId, null);
      assert.equal(account.type, "LIQUID_ASSETS");
      assert.equal(account.isPostable, true);
      assert.equal(account.ownerId, owner.id);
      assert.equal(account.parentId, parent.id);
    });
    await t.test("Bucket accounts deny children, including through personal descendants", async () => {
      const accounts = await prisma.bookingAccount.findMany({ where: { ownerId: owner.id }, select: accountTreeSelect });
      assert(allowsAccountChildren(parent.id, accounts));
      assert(!allowsAccountChildren(existing.id, accounts));
      await assert.rejects(createOwnedBucket(owner.id, form({ mode: "new", parentId: existing.id, name: "Blocked", currency: "EUR" })));
    });
    await t.test("Invalid currencies and foreign parents/accounts are rejected without inserts", async () => {
      const count = await prisma.bookingAccount.count({ where: { ownerId: owner.id } });
      for (const currency of ["eur", "EU", "EURO", "12X", ""]) {
        await assert.rejects(createOwnedBucket(owner.id, form({ mode: "new", name: "Invalid", parentId: parent.id, currency })));
      }
      await assert.rejects(createOwnedBucket(owner.id, form({ mode: "new", name: "Foreign", parentId: otherParent.id, currency: "EUR" })));
      await assert.rejects(createOwnedBucket(stranger.id, form({ mode: "existing", bookingAccountId: existing.id, currency: "EUR" })));
      assert.equal(await prisma.bookingAccount.count({ where: { ownerId: owner.id } }), count);
    });
    await t.test("Existing account eligibility is enforced on the server", async () => {
      await assert.rejects(createOwnedBucket(owner.id, form({ mode: "existing", bookingAccountId: parent.id, currency: "EUR" })));
      for (const properties of [
        { type: "EXPENSES" as const },
        { isPostable: false },
        { isArchived: true },
      ]) {
        const invalid = await prisma.bookingAccount.create({ data: {
          name: "Ineligible", ownerId: owner.id, parentId: parent.id, type: "LIQUID_ASSETS", ...properties,
        } });
        await assert.rejects(createOwnedBucket(owner.id, form({ mode: "existing", bookingAccountId: invalid.id, currency: "EUR" })));
      }
      await assert.rejects(createOwnedBucket(owner.id, form({ mode: "existing", bookingAccountId: existing.id, currency: "EUR" })));
      const personal = await prisma.bookingAccount.create({ data: { name: "Personal group", ownerId: owner.id, parentId: parent.id, type: "LIQUID_ASSETS" } });
      const nested = await createOwnedBucket(owner.id, form({ mode: "new", parentId: personal.id, name: "Nested", currency: "EUR" }));
      await assert.rejects(createOwnedBucket(owner.id, form({ mode: "existing", bookingAccountId: personal.id, currency: "EUR" })));
      await deleteOwnedBucket(owner.id, nested.id);
      await prisma.bookingAccount.delete({ where: { id: personal.id } });
    });
    await t.test("Template permission revocation and archive are respected", async () => {
      await prisma.bookingAccountTemplate.update({ where: { id: template.id }, data: { allowsCustomChildren: false } });
      await assert.rejects(createOwnedBucket(owner.id, form({ mode: "new", parentId: parent.id, name: "Locked", currency: "EUR" })));
      await prisma.bookingAccountTemplate.update({ where: { id: template.id }, data: { allowsCustomChildren: true } });
      await prisma.bookingAccount.update({ where: { id: parent.id }, data: { isArchived: true } });
      await assert.rejects(createOwnedBucket(owner.id, form({ mode: "new", parentId: parent.id, name: "Archived", currency: "EUR" })));
      await prisma.bookingAccount.update({ where: { id: parent.id }, data: { isArchived: false } });
    });
    await t.test("Editing syncs names and archive state; other users cannot mutate", async () => {
      await updateOwnedBucket(owner.id, newBucket.id, form({ name: "Renamed", currency: "CHF", notes: "Edited", isArchived: "on" }));
      const bucket = await prisma.bucket.findUniqueOrThrow({ where: { id: newBucket.id }, include: { bookingAccount: true } });
      assert.equal(bucket.name, bucket.bookingAccount.name);
      assert.equal(bucket.name, "Renamed");
      assert.equal(bucket.currency, "CHF");
      assert.equal(bucket.notes, "Edited");
      assert(bucket.bookingAccount.isArchived);
      await updateOwnedBucket(owner.id, newBucket.id, form({ name: "Renamed", currency: "CHF" }));
      assert.equal((await prisma.bookingAccount.findUniqueOrThrow({ where: { id: bucket.bookingAccountId } })).isArchived, false);
      await assert.rejects(updateOwnedBucket(stranger.id, newBucket.id, form({ name: "Hacked", currency: "EUR" })));
      await assert.rejects(deleteOwnedBucket(stranger.id, newBucket.id));
    });
    await t.test("Reordering accepts only the complete owner list and never moves accounts", async () => {
      const oldAccountPosition = (await prisma.bookingAccount.findUniqueOrThrow({ where: { id: newBucket.bookingAccountId } })).position;
      await assert.rejects(reorderOwnedBuckets(owner.id, [newBucket.id, newBucket.id]));
      await assert.rejects(reorderOwnedBuckets(owner.id, [newBucket.id]));
      await assert.rejects(reorderOwnedBuckets(stranger.id, [existingBucket.id, newBucket.id]));
      await assert.rejects(reorderOwnedBuckets(owner.id, [existingBucket.id, otherParent.id]));
      await reorderOwnedBuckets(owner.id, [newBucket.id, existingBucket.id]);
      const ordered = await prisma.bucket.findMany({ where: { ownerId: owner.id }, orderBy: [{ position: "asc" }, { number: "asc" }] });
      assert.deepEqual(ordered.map((bucket) => bucket.id), [newBucket.id, existingBucket.id]);
      assert.equal((await prisma.bookingAccount.findUniqueOrThrow({ where: { id: newBucket.bookingAccountId } })).position, oldAccountPosition);
    });
    await t.test("Concurrent assignments produce exactly one bucket", async () => {
      const candidate = await prisma.bookingAccount.create({ data: { name: "Race", ownerId: owner.id, parentId: parent.id, type: "LIQUID_ASSETS" } });
      const results = await Promise.allSettled([
        createOwnedBucket(owner.id, form({ mode: "existing", bookingAccountId: candidate.id, currency: "EUR" })),
        createOwnedBucket(owner.id, form({ mode: "existing", bookingAccountId: candidate.id, currency: "EUR" })),
      ]);
      assert.equal(results.filter((result) => result.status === "fulfilled").length, 1);
      assert.equal(await prisma.bucket.count({ where: { bookingAccountId: candidate.id } }), 1);
    });
    await t.test("Deletion checks dependencies and removes both records atomically", async () => {
      const child = await prisma.bookingAccount.create({ data: { name: "External invalid child", ownerId: owner.id, parentId: newBucket.bookingAccountId, type: "LIQUID_ASSETS" } });
      await assert.rejects(deleteOwnedBucket(owner.id, newBucket.id));
      assert(await prisma.bucket.findUnique({ where: { id: newBucket.id } }));
      await prisma.bookingAccount.delete({ where: { id: child.id } });
      await deleteOwnedBucket(owner.id, newBucket.id);
      assert.equal(await prisma.bucket.findUnique({ where: { id: newBucket.id } }), null);
      assert.equal(await prisma.bookingAccount.findUnique({ where: { id: newBucket.bookingAccountId } }), null);
    });
    await t.test("Hierarchy ties use number, not alphabetic name", () => {
      const rows = groupTemplateHierarchy([
        { id: "a", parentId: null, type: "LIQUID_ASSETS" as const, name: "Z", position: 0, number: 1 },
        { id: "b", parentId: null, type: "LIQUID_ASSETS" as const, name: "A", position: 0, number: 2 },
      ])[0].types[0].rows;
      assert.deepEqual(rows.map((row) => row.template.id), ["a", "b"]);
    });
  } finally {
    await prisma.bucket.deleteMany({ where: { ownerId: { in: userIds } } });
    await prisma.bookingAccount.updateMany({ where: { ownerId: { in: userIds } }, data: { parentId: null } });
    await prisma.bookingAccount.deleteMany({ where: { ownerId: { in: userIds } } });
    await prisma.user.deleteMany({ where: { id: { in: userIds } } });
    await prisma.bookingAccountTemplate.deleteMany({ where: { id: { in: templateIds } } });
    await prisma.$disconnect();
  }
});
