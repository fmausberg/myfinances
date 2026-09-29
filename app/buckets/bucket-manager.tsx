"use client";

import Link from "next/link";
import { useId, useState, useTransition, type FormEvent } from "react";
import type { ActionResult } from "@/lib/action-result";
import { allowsAccountChildren, type AccountTreeItem } from "@/lib/booking-account-policy";
import { isEligibleBucketAccount, type BucketItem } from "@/lib/bucket-policy";
import { groupTemplateHierarchy } from "@/lib/template-hierarchy";
import { createBucket, updateBucket, deleteBucket, reorderBuckets } from "./actions";

const inputClass = "mt-2 w-full rounded-lg border border-slate-300 bg-white px-3 py-2.5 outline-none focus:border-emerald-600 focus:ring-2 focus:ring-emerald-100";
const buttonClass = "rounded-lg bg-emerald-700 px-4 py-2.5 text-sm font-semibold text-white hover:bg-emerald-800 disabled:opacity-50";

function BucketForm({ bucket, accounts, onSaved, onCancel }: {
  bucket: BucketItem | null;
  accounts: AccountTreeItem[];
  onSaved: () => void;
  onCancel: () => void;
}) {
  const prefix = useId();
  const [mode, setMode] = useState("new");
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState("");
  const parents = groupTemplateHierarchy(accounts).flatMap((group) => group.types.flatMap((type) => type.rows))
    .filter(({ template: account }) => account.type === "LIQUID_ASSETS" && allowsAccountChildren(account.id, accounts));
  const existing = accounts.filter((account) => isEligibleBucketAccount(account, accounts));
  const noSelection = !bucket && (mode === "new" ? parents.length === 0 : existing.length === 0);

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (pending) return;
    const data = new FormData(event.currentTarget);
    setError("");
    startTransition(async () => {
      try {
        const result = bucket ? await updateBucket(bucket.id, data) : await createBucket(data);
        if (result.error) setError(result.error);
        else onSaved();
      } catch {
        setError("Speichern nicht möglich. Bitte lade die Seite neu und versuche es erneut.");
      }
    });
  }

  return (
    <section className="mt-6 rounded-xl border border-emerald-200 bg-white p-6 shadow-sm" aria-labelledby={prefix + "-heading"}>
      <h2 id={prefix + "-heading"} className="text-lg font-semibold">{bucket ? "Bucket bearbeiten" : "Bucket anlegen"}</h2>
      <form onSubmit={submit} className="mt-5" aria-busy={pending}>
        <fieldset disabled={pending} className="space-y-5 disabled:opacity-60">
          {!bucket && <fieldset className="space-y-2">
            <legend className="mb-2 text-sm font-medium">Verknüpftes Buchungskonto</legend>
            <label className="flex items-center gap-2 text-sm"><input type="radio" name="mode" value="new" checked={mode === "new"} onChange={() => setMode("new")} />Neues Buchungskonto erstellen</label>
            <label className="flex items-center gap-2 text-sm"><input type="radio" name="mode" value="existing" checked={mode === "existing"} onChange={() => setMode("existing")} />Bestehendes Buchungskonto verwenden</label>
          </fieldset>}
          <div className="grid gap-5 sm:grid-cols-2">
            {(bucket || mode === "new") && <div><label htmlFor={prefix + "-name"} className="text-sm font-medium">Name *</label><input id={prefix + "-name"} name="name" required defaultValue={bucket?.name ?? ""} className={inputClass} /><p className="mt-1 text-xs text-slate-500">Dieser Name gilt für Bucket und Buchungskonto.</p></div>}
            {!bucket && mode === "existing" && <div>
              <label htmlFor={prefix + "-account"} className="text-sm font-medium">Buchungskonto *</label>
              <select id={prefix + "-account"} name="bookingAccountId" required defaultValue="" className={inputClass}>
                <option value="">Bitte auswählen</option>
                {existing.map((account) => <option key={account.id} value={account.id}>{account.name} (Nr. {account.number})</option>)}
              </select>
              <p className="mt-1 text-xs text-slate-500">Der Kontoname wird übernommen. Das Konto bleibt bestehen.</p>
            </div>}
            <div><label htmlFor={prefix + "-currency"} className="text-sm font-medium">Währung *</label><input id={prefix + "-currency"} name="currency" required pattern="[A-Z]{3}" minLength={3} maxLength={3} defaultValue={bucket?.currency ?? "EUR"} autoCapitalize="characters" spellCheck={false} className={inputClass} aria-describedby={prefix + "-currency-help"} /><p id={prefix + "-currency-help"} className="mt-1 text-xs text-slate-500">Drei Großbuchstaben, zum Beispiel EUR oder USD.</p></div>
            {!bucket && mode === "new" && <div className="sm:col-span-2">
              <label htmlFor={prefix + "-parent"} className="text-sm font-medium">Übergeordnete Kontengruppe *</label>
              <select id={prefix + "-parent"} name="parentId" required defaultValue="" className={inputClass}>
                <option value="">Bitte auswählen</option>
                {parents.map(({ template: account, depth }) => <option key={account.id} value={account.id}>{"— ".repeat(depth)}{account.name}</option>)}
              </select>
            </div>}
          </div>
          {noSelection && <p role="status" className="rounded-lg bg-slate-50 p-3 text-sm text-slate-600">
            {mode === "new" ? "Es gibt noch keine freigegebene Liquiditätskontengruppe für neue Konten." : "Es gibt kein geeignetes freies Liquiditätskonto ohne Unterkonten."}
            {" "}<Link href="/booking-accounts" className="font-medium text-emerald-700 underline">Buchungskonten verwalten</Link>
            {mode === "new" && " oder den Administrator um Freigabe eigener Unterkonten bitten."}
          </p>}
          <div><label htmlFor={prefix + "-notes"} className="text-sm font-medium">Notizen</label><textarea id={prefix + "-notes"} name="notes" rows={3} defaultValue={bucket?.notes ?? ""} className={inputClass} /></div>
          {bucket && <label className="flex items-center gap-2 text-sm"><input name="isArchived" type="checkbox" defaultChecked={bucket.bookingAccount.isArchived} className="accent-emerald-700" />Bucket und Konto archivieren</label>}
          <div className="flex gap-3"><button type="submit" disabled={noSelection} className={buttonClass}>{pending ? "Wird gespeichert…" : "Speichern"}</button><button type="button" onClick={onCancel} className="rounded-lg border border-slate-300 px-4 py-2.5 text-sm hover:bg-slate-50">Abbrechen</button></div>
        </fieldset>
        {error && <p role="alert" className="mt-4 text-sm text-red-700">{error}</p>}
      </form>
    </section>
  );
}

export function BucketManager({ buckets, accounts }: { buckets: BucketItem[]; accounts: AccountTreeItem[] }) {
  const [editor, setEditor] = useState<BucketItem | "new" | null>(null);
  const [pending, startTransition] = useTransition();
  const [notice, setNotice] = useState("");
  const [error, setError] = useState("");
  const busy = pending || editor !== null;
  function run(action: () => Promise<ActionResult>, message: string) {
    setError("");
    setNotice("");
    startTransition(async () => {
      try {
        const result = await action();
        if (result.error) setError(result.error);
        else setNotice(message);
      } catch {
        setError("Die Änderung ist fehlgeschlagen. Bitte versuche es erneut.");
      }
    });
  }
  function move(index: number, direction: number) {
    const ids = buckets.map((bucket) => bucket.id);
    const target = index + direction;
    if (target < 0 || target >= ids.length) return;
    [ids[index], ids[target]] = [ids[target], ids[index]];
    run(() => reorderBuckets(ids), "Reihenfolge gespeichert.");
  }
  function remove(bucket: BucketItem) {
    if (!window.confirm(`Bucket „${bucket.name}“ löschen? Auch das verknüpfte persönliche Buchungskonto wird unwiderruflich gelöscht – selbst wenn du ein bestehendes Konto zugeordnet hast.`)) return;
    run(() => deleteBucket(bucket.id), "Bucket und Buchungskonto gelöscht.");
  }
  return (
    <>
      <div className="mt-12 flex flex-wrap items-start justify-between gap-4">
        <div><h1 className="text-3xl font-semibold">Meine Buckets</h1><p className="mt-2 text-slate-600">Verwalte deine Liquiditätskonten und ihre Währungen.</p></div>
        <button disabled={busy} onClick={() => { setEditor("new"); setNotice(""); setError(""); }} className={buttonClass}>Bucket anlegen</button>
      </div>
      {notice && <p role="status" className="mt-5 text-sm text-emerald-700">{notice}</p>}
      {error && <p role="alert" className="mt-5 text-sm text-red-700">{error}</p>}
      {editor !== null && <BucketForm key={editor === "new" ? "new" : editor.id} bucket={editor === "new" ? null : editor} accounts={accounts} onCancel={() => setEditor(null)} onSaved={() => { setEditor(null); setNotice("Bucket gespeichert."); }} />}
      {buckets.length === 0 ? <section className="mt-8 rounded-xl border border-dashed border-slate-300 p-10 text-center"><h2 className="font-semibold">Noch keine Buckets</h2><p className="mt-2 text-sm text-slate-600">Lege einen Bucket mit einem neuen Buchungskonto an oder verknüpfe ein geeignetes bestehendes Konto.</p></section> :
        <div role="region" aria-label="Buckets" tabIndex={0} className="mt-8 overflow-x-auto rounded-xl border border-slate-200 bg-white shadow-sm focus-visible:outline-2 focus-visible:outline-emerald-700">
          <table className="w-full text-sm">
            <caption className="sr-only">Eigene Buckets mit Reihenfolge und Aktionen</caption>
            <thead className="bg-slate-50 text-left text-xs text-slate-500"><tr>{["Reihenfolge", "Name", "Währung", "Notizen", "Aktionen"].map((label) => <th scope="col" key={label} className="px-4 py-3 font-medium">{label}</th>)}</tr></thead>
            <tbody>{buckets.map((bucket, index) => <tr key={bucket.id} className="border-t border-slate-100 align-top hover:bg-slate-50">
              <td className="px-4 py-3"><div className="flex gap-2"><button disabled={busy || index === 0} onClick={() => move(index, -1)} aria-label={bucket.name + " nach oben"} className="rounded border border-slate-200 px-2 py-1 disabled:opacity-30">↑</button><button disabled={busy || index === buckets.length - 1} onClick={() => move(index, 1)} aria-label={bucket.name + " nach unten"} className="rounded border border-slate-200 px-2 py-1 disabled:opacity-30">↓</button></div></td>
              <th scope="row" className="px-4 py-3 text-left font-medium"><span className="block max-w-52 truncate" title={bucket.name}>{bucket.name}</span>{bucket.bookingAccount.isArchived && <span className="text-xs font-normal text-slate-500">Archiviert</span>}</th>
              <td className="px-4 py-3">{bucket.currency}</td>
              <td className="px-4 py-3 text-slate-600">{bucket.notes ? <details className="max-w-52"><summary className="cursor-pointer truncate" title={bucket.notes}>{bucket.notes}</summary><p className="mt-2 whitespace-pre-wrap break-words">{bucket.notes}</p></details> : "—"}</td>
              <td className="px-4 py-3"><div className="flex gap-3 whitespace-nowrap"><button disabled={busy} onClick={() => { setEditor(bucket); setError(""); setNotice(""); window.scrollTo({ top: 0, behavior: "smooth" }); }} className="font-semibold text-emerald-700 hover:underline disabled:opacity-50">Bearbeiten</button><button disabled={busy} onClick={() => remove(bucket)} className="text-red-700 hover:underline disabled:opacity-50">Löschen</button></div></td>
            </tr>)}</tbody>
          </table>
        </div>}
    </>
  );
}
