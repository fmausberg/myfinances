import type { Metadata } from "next";
import Link from "next/link";
import { SignOutButton } from "@/components/sign-out-button";
import { requireSession } from "@/lib/session";
import { prisma } from "@/lib/prisma";
import { PartnerManager } from "./partner-manager";

export const metadata: Metadata = { title: "Partner | My Finances" };

export default async function PartnersPage() {
  const { user } = await requireSession();
  const partners = await prisma.partner.findMany({
    where: { ownerId: user.id },
    orderBy: [{ name: "asc" }, { number: "asc" }],
    select: {
      id: true, number: true, type: true, name: true,
      email: true, notes: true, contactLink: true,
    },
  });

  return (
    <main className="flex-1 bg-slate-50 px-6 py-10 text-slate-900">
      <div className="mx-auto max-w-4xl">
        <header className="flex flex-wrap items-center justify-between gap-4">
          <Link href="/" className="text-xl font-bold tracking-tight">My Finances</Link>
          <nav aria-label="Hauptnavigation" className="flex flex-wrap items-center gap-5 text-sm">
            <Link href="/" className="text-slate-600 hover:text-slate-900">Mein Konto</Link>
            <Link href="/partners" aria-current="page" className="font-semibold text-emerald-700">Partner</Link>
            <Link href="/booking-accounts" className="font-semibold text-emerald-700 hover:underline">Buchungskonten</Link>
            {user.role === "ADMIN" && <Link href="/admin/booking-account-templates" className="font-semibold text-emerald-700 hover:underline">Kontenvorlagen</Link>}
            <SignOutButton />
          </nav>
        </header>
        <PartnerManager partners={partners} />
      </div>
    </main>
  );
}
