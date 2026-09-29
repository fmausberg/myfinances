import type { Metadata } from "next";
import Link from "next/link";
import { requireAdmin } from "@/lib/session";
import { prisma } from "@/lib/prisma";
import { TemplateManager } from "./template-manager";

export const metadata: Metadata = { title: "Buchungskontenvorlagen | My Finances" };

export default async function TemplatesPage() {
  await requireAdmin();
  const templates = await prisma.bookingAccountTemplate.findMany({
    orderBy: [{ position: "asc" }, { name: "asc" }, { number: "asc" }],
    select: {
      id: true, number: true, name: true, description: true, position: true,
      type: true, parentId: true, isArchived: true,
      isPostable: true, allowsCustomChildren: true,
    },
  });
  return (
    <main className="flex-1 bg-slate-50 px-6 py-10 text-slate-900">
      <div className="mx-auto max-w-5xl">
        <Link href="/" className="text-sm font-medium text-emerald-700 hover:underline">← Mein Konto</Link>
        <TemplateManager templates={templates} />
      </div>
    </main>
  );
}
