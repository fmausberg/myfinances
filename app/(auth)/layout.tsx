import Link from "next/link";
import { redirect } from "next/navigation";
import { getSession } from "@/lib/session";

export default async function AuthLayout({ children }: { children: React.ReactNode }) {
  if (await getSession()) redirect("/");
  return (
    <main className="flex flex-1 flex-col items-center justify-center bg-slate-50 px-6 py-16 text-slate-900">
      <Link href="/" className="mb-8 text-xl font-bold tracking-tight">My Finances</Link>
      <section className="w-full max-w-md rounded-2xl border border-slate-200 bg-white p-8 shadow-sm">{children}</section>
    </main>
  );
}
