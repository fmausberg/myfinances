import type { BookingAccount, BookingAccountTemplate } from "@/generated/prisma/client";

export type AccountTreeItem = Pick<BookingAccount,
  "id" | "number" | "name" | "type" | "description" | "position" |
  "parentId" | "templateId" | "isArchived" | "isPostable"> & {
  template: Pick<BookingAccountTemplate, "allowsCustomChildren" | "isArchived"> | null;
  bucket: { id: string } | null;
};

// Custom branches inherit permission from the nearest template-backed ancestor.
// Every ancestor must be active. Missing parents and cycles deny permission.
export function allowsAccountChildren(accountId: string, accounts: AccountTreeItem[]): boolean {
  const byId = new Map(accounts.map((account) => [account.id, account]));
  const seen = new Set<string>();
  let current = byId.get(accountId);
  let permitted: boolean | undefined;
  while (current) {
    if (seen.has(current.id) || current.isArchived || current.template?.isArchived) return false;
    seen.add(current.id);
    if (current.templateId) {
      if (!current.template) return false;
      permitted ??= current.template.allowsCustomChildren;
    }
    if (!current.parentId) return permitted === true;
    current = byId.get(current.parentId);
  }
  return false;
}

export function isAccountDescendant(candidateId: string, ancestorId: string, accounts: AccountTreeItem[]) {
  const byId = new Map(accounts.map((account) => [account.id, account]));
  const seen = new Set<string>();
  let current = byId.get(candidateId);
  while (current) {
    if (current.id === ancestorId || seen.has(current.id)) return true;
    seen.add(current.id);
    current = current.parentId ? byId.get(current.parentId) : undefined;
  }
  return false;
}
