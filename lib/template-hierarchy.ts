import type { BookingAccountType } from "@/generated/prisma/enums";
import { bookingAccountGroups } from "@/lib/booking-account-types";

type HierarchyItem = {
  id: string;
  parentId: string | null;
  type: BookingAccountType;
  name: string;
  number: number;
  position: number;
};

export function groupTemplateHierarchy<T extends HierarchyItem>(templates: T[]) {
  return bookingAccountGroups.map((group) => ({
    label: group.label,
    types: group.types.map((type) => {
      const items = templates.filter((item) => item.type === type).sort(
        (a, b) => a.position - b.position
          || a.number - b.number,
      );
      const ids = new Set(items.map((item) => item.id));
      const children = new Map<string, T[]>();
      for (const item of items) {
        if (item.parentId && ids.has(item.parentId)) {
          const siblings = children.get(item.parentId) ?? [];
          siblings.push(item);
          children.set(item.parentId, siblings);
        }
      }
      const rows: { template: T; depth: number }[] = [];
      const visited = new Set<string>();
      function visit(root: T) {
        const stack = [{ template: root, depth: 0 }];
        while (stack.length) {
          const row = stack.pop()!;
          if (visited.has(row.template.id)) continue;
          visited.add(row.template.id);
          rows.push(row);
          for (const child of [...(children.get(row.template.id) ?? [])].reverse()) {
            stack.push({ template: child, depth: row.depth + 1 });
          }
        }
      }
      // Cross-type parents stay in their own category.
      for (const item of items) {
        if (!item.parentId || !ids.has(item.parentId)) visit(item);
      }
      // Keep every record visible even if externally edited data has a cycle.
      for (const item of items) if (!visited.has(item.id)) visit(item);
      return { type, rows };
    }).filter((group) => group.rows.length > 0),
  })).filter((group) => group.types.length > 0);
}
