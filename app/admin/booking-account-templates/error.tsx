"use client";

export default function TemplatesError({ retry }: { retry: () => void }) {
  return (
    <main className="flex-1 bg-slate-50 px-6 py-16 text-slate-900">
      <div className="mx-auto max-w-5xl rounded-xl border border-slate-200 bg-white p-8">
        <h1 className="text-xl font-semibold">Vorlagen konnten nicht geladen werden</h1>
        <p role="alert" className="mt-3 text-slate-600">Bitte versuche es gleich noch einmal.</p>
        <button onClick={retry} className="mt-6 rounded-lg bg-emerald-700 px-4 py-2.5 text-sm font-semibold text-white">Erneut versuchen</button>
      </div>
    </main>
  );
}
