import type { Metadata } from "next";
import Link from "next/link";
import { requireSession } from "@/lib/session";
import { prisma } from "@/lib/prisma";
import { accountTreeSelect } from "@/lib/booking-account-data";
import { AccountManager } from "./account-manager";
import { SignOutButton } from "@/components/sign-out-button";

export const metadata: Metadata = { title: "Meine Buchungskonten | My Finances" };

export default async function BookingAccountsPage() {
  const { user } = await requireSession();
  const accounts = await prisma.bookingAccount.findMany({
    where: { ownerId: user.id },
    orderBy: [{ position: "asc" }, { number: "asc" }],
    select: accountTreeSelect,
  });
  return (
    <main className="flex-1 bg-slate-50 px-6 py-10 text-slate-900">
      <div className="mx-auto max-w-5xl">
        <header className="flex flex-wrap items-center justify-between gap-4">
          <Link href="/" className="text-xl font-bold tracking-tight">My Finances</Link>
          <nav aria-label="Hauptnavigation" className="flex flex-wrap items-center gap-5 text-sm">
            <Link href="/">Mein Konto</Link>
            <Link href="/partners">Partner</Link>
            <Link href="/buckets">Buckets</Link>
            <Link href="/booking-accounts" aria-current="page" className="font-semibold text-emerald-700">Buchungskonten</Link>
            {user.role === "ADMIN" && <Link href="/admin/booking-account-templates" className="text-emerald-700">Kontenvorlagen</Link>}
            <SignOutButton />
          </nav>
        </header>
        <AccountManager accounts={accounts} />
      </div>
    </main>
  );
}
