import type { Metadata } from "next";
import Link from "next/link";
import { requireSession } from "@/lib/session";
import { prisma } from "@/lib/prisma";
import { accountTreeSelect } from "@/lib/booking-account-data";
import { SignOutButton } from "@/components/sign-out-button";
import { BucketManager } from "./bucket-manager";

export const metadata: Metadata = { title: "Meine Buckets | My Finances" };

export default async function BucketsPage() {
  const { user } = await requireSession();
  const [buckets, accounts] = await Promise.all([
    prisma.bucket.findMany({
      where: { ownerId: user.id, bookingAccount: { ownerId: user.id } },
      orderBy: [{ position: "asc" }, { number: "asc" }],
      select: {
        id: true, number: true, name: true, currency: true, notes: true,
        position: true, bookingAccountId: true,
        bookingAccount: { select: { isArchived: true } },
      },
    }),
    prisma.bookingAccount.findMany({
      where: { ownerId: user.id },
      orderBy: [{ position: "asc" }, { number: "asc" }],
      select: accountTreeSelect,
    }),
  ]);
  return (
    <main className="flex-1 bg-slate-50 px-6 py-10 text-slate-900">
      <div className="mx-auto max-w-5xl">
        <header className="flex flex-wrap items-center justify-between gap-4">
          <Link href="/" className="text-xl font-bold tracking-tight">My Finances</Link>
          <nav aria-label="Hauptnavigation" className="flex flex-wrap items-center gap-5 text-sm">
            <Link href="/">Mein Konto</Link><Link href="/partners">Partner</Link>
            <Link href="/booking-accounts">Buchungskonten</Link>
            <Link href="/buckets" aria-current="page" className="font-semibold text-emerald-700">Buckets</Link>
            <SignOutButton />
          </nav>
        </header>
        <BucketManager buckets={buckets} accounts={accounts} />
      </div>
    </main>
  );
}
