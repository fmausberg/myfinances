import "server-only";
import type { Prisma } from "@/generated/prisma/client";

export const accountTreeSelect = {
  id: true, number: true, name: true, type: true, description: true,
  position: true, parentId: true, templateId: true, isArchived: true, isPostable: true,
  template: { select: { allowsCustomChildren: true, isArchived: true } },
  bucket: { select: { id: true } },
} satisfies Prisma.BookingAccountSelect;
