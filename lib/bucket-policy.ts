import type { Bucket } from "@/generated/prisma/client";
import type { AccountTreeItem } from "@/lib/booking-account-policy";

export type BucketItem = Pick<Bucket, "id" | "number" | "name" | "currency" | "notes" | "position" | "bookingAccountId"> & {
  bookingAccount: { isArchived: boolean };
};

export function isEligibleBucketAccount(account: AccountTreeItem, accounts: AccountTreeItem[]) {
  return account.type === "LIQUID_ASSETS" && account.isPostable &&
    !account.templateId && !account.isArchived && !account.bucket &&
    !accounts.some((child) => child.parentId === account.id);
}
