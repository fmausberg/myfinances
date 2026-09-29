import { requireSession } from "@/lib/session";
import { SignOutButton } from "@/components/sign-out-button";

export default async function Home() {
  const { user } = await requireSession();
  return (
    <main className="flex-1 bg-slate-50 px-6 py-10 text-slate-900">
      <div className="mx-auto max-w-4xl">
        <header className="flex items-center justify-between gap-4"><span className="text-xl font-bold tracking-tight">My Finances</span><SignOutButton /></header>
        <section className="mt-12 rounded-2xl border border-slate-200 bg-white p-8 shadow-sm">
          <p className="text-sm font-medium text-emerald-700">Your account</p>
          <h1 className="mt-3 text-3xl font-semibold">Welcome, {user.name}</h1>
          <p className="mt-3 text-slate-600">You are logged in and ready to start organizing your finances.</p>
          <dl className="mt-8 border-t border-slate-100 pt-6"><dt className="text-sm text-slate-500">Email address</dt><dd className="mt-1 break-all font-medium">{user.email}</dd></dl>
        </section>
      </div>
    </main>
  );
}
