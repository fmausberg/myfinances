"use client";

import { Fragment, useId, useState, useTransition, type FormEvent } from "react";
import { bookingAccountTypeLabels } from "@/lib/booking-account-types";
import { groupTemplateHierarchy } from "@/lib/template-hierarchy";
import { allowsAccountChildren, isAccountDescendant, type AccountTreeItem } from "@/lib/booking-account-policy";
import { deleteBookingAccount, initializeBookingAccounts, saveBookingAccount } from "./actions";

const inputClass = "mt-2 w-full rounded-lg border border-slate-300 bg-white px-3 py-2.5 outline-none focus:border-emerald-600 focus:ring-2 focus:ring-emerald-100";
const buttonClass = "rounded-lg bg-emerald-700 px-4 py-2.5 text-sm font-semibold text-white hover:bg-emerald-800 disabled:opacity-50";
type Editor = { account: AccountTreeItem | null; parentId: string };

function AccountForm({ editor, accounts, onSaved, onCancel }: {
  editor: Editor;
  accounts: AccountTreeItem[];
  onSaved: () => void;
  onCancel: () => void;
}) {
  const { account } = editor;
  const prefix = useId();
  const [parentId, setParentId] = useState(editor.parentId);
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState("");
  const parent = accounts.find((item) => item.id === parentId);
  const fromTemplate = Boolean(account?.templateId);
  const parentOptions = groupTemplateHierarchy(accounts).flatMap((group) => group.types.flatMap((type) => type.rows))
    .filter(({ template: candidate }) =>
      (!account || candidate.type === account.type) &&
      (!account || !isAccountDescendant(candidate.id, account.id, accounts)) &&
      !candidate.bucket && (candidate.id === account?.parentId || allowsAccountChildren(candidate.id, accounts)),
    );
  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (pending) return;
    const data = new FormData(event.currentTarget);
    setError("");
    startTransition(async () => {
      try {
        const result = await saveBookingAccount(account?.id ?? null, data);
        if (result.error) setError(result.error);
        else onSaved();
      } catch {
        setError("Speichern nicht möglich. Bitte lade die Seite neu und versuche es erneut.");
      }
    });
  }
  return (
    <section className="mt-6 rounded-xl border border-emerald-200 bg-white p-6 shadow-sm" aria-labelledby={prefix + "-heading"}>
      <h2 id={prefix + "-heading"} className="text-lg font-semibold">{account ? "Buchungskonto bearbeiten" : "Eigenes Unterkonto anlegen"}</h2>
      {fromTemplate && <p className="mt-2 text-sm text-slate-500">Name, Beschreibung, Position und Archivierung gelten nur für deinen Kontenbaum. Struktur, Kontotyp und Bebuchbarkeit stammen aus dem Vorlagen-Setup.</p>}
      {account?.bucket && <p className="mt-2 text-sm text-slate-500">Name und Archivierung gelten auch für den verknüpften Bucket. Seine Reihenfolge bleibt unabhängig.</p>}
      <form onSubmit={submit} aria-busy={pending} className="mt-5">
        <fieldset disabled={pending} className="space-y-5 disabled:opacity-60">
          <div className="grid gap-5 sm:grid-cols-2">
            <div><label htmlFor={prefix + "-name"} className="text-sm font-medium">Name *</label><input id={prefix + "-name"} name="name" required defaultValue={account?.name ?? ""} className={inputClass} autoFocus /></div>
            <div>
              <label htmlFor={prefix + "-position"} className="text-sm font-medium">Position</label>
              {account ? <input id={prefix + "-position"} name="position" type="number" step={1} min={-2147483648} max={2147483647} required defaultValue={account.position} className={inputClass} /> : <input type="hidden" name="position" value="0" />}
              <p className="mt-1 text-xs text-slate-500">{account ? "Kleinere Werte stehen auf derselben Ebene weiter oben. Beim Verschieben in eine andere Gruppe wird das Konto hinten angefügt." : "Neue Konten werden am Ende der gewählten Gruppe angefügt."}</p>
            </div>
            {!fromTemplate && <div>
              <label htmlFor={prefix + "-parent"} className="text-sm font-medium">Übergeordnetes Konto *</label>
              <select id={prefix + "-parent"} name="parentId" required value={parentId} onChange={(event) => setParentId(event.target.value)} className={inputClass}>
                <option value="">Bitte auswählen</option>
                {parentOptions.map(({ template: item, depth }) => <option key={item.id} value={item.id}>{"— ".repeat(depth)}{item.name}</option>)}
              </select>
            </div>}
            <div><p className="text-sm font-medium">Kontotyp</p><p className="mt-3 text-sm text-slate-600">{account ? bookingAccountTypeLabels[account.type] : parent ? bookingAccountTypeLabels[parent.type] : "Wird vom übergeordneten Konto übernommen."}</p></div>
          </div>
          <div><label htmlFor={prefix + "-description"} className="text-sm font-medium">Beschreibung</label><textarea id={prefix + "-description"} name="description" rows={3} defaultValue={account?.description ?? ""} className={inputClass} /></div>
          <div className="flex flex-wrap gap-5 text-sm">
            <label className="flex items-center gap-2"><input name="isArchived" type="checkbox" defaultChecked={account?.isArchived ?? false} className="accent-emerald-700" />Archiviert</label>
            {account?.bucket ? <><input type="hidden" name="isPostable" value="on" /><span className="text-slate-500">Bebuchbar (Bucket-Konto)</span></> : fromTemplate
              ? <span className="text-slate-500">{account?.isPostable ? "Bebuchbar" : "Nicht bebuchbar (Strukturkonto)"}</span>
              : <label className="flex items-center gap-2"><input name="isPostable" type="checkbox" defaultChecked={account?.isPostable ?? true} className="accent-emerald-700" />Bebuchbar</label>}
          </div>
          <div className="flex gap-3"><button type="submit" className={buttonClass}>{pending ? "Wird gespeichert…" : "Speichern"}</button><button type="button" onClick={onCancel} className="rounded-lg border border-slate-300 px-4 py-2.5 text-sm hover:bg-slate-50">Abbrechen</button></div>
        </fieldset>
        {error && <p role="alert" className="mt-4 text-sm text-red-700">{error}</p>}
      </form>
    </section>
  );
}

export function AccountManager({ accounts }: { accounts: AccountTreeItem[] }) {
  const [editor, setEditor] = useState<Editor | null>(null);
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const groups = groupTemplateHierarchy(accounts);
  const busy = pending || editor !== null;
  function initialize() {
    setError("");
    startTransition(async () => {
      try {
        const result = await initializeBookingAccounts();
        if (result.error) setError(result.error);
        else setNotice("Dein Kontenbaum wurde aus den Vorlagen erstellt.");
      } catch {
        setError("Der Kontenbaum konnte nicht erstellt werden. Bitte versuche es erneut.");
      }
    });
  }
  function remove(account: AccountTreeItem) {
    if (!window.confirm(`Eigenes Konto „${account.name}“ wirklich löschen?`)) return;
    setError("");
    setNotice("");
    startTransition(async () => {
      try {
        const result = await deleteBookingAccount(account.id);
        if (result.error) setError(result.error);
        else setNotice("Konto gelöscht.");
      } catch {
        setError("Löschen nicht möglich. Bitte versuche es erneut.");
      }
    });
  }
  function openEditor(next: Editor) {
    setEditor(next);
    setError("");
    setNotice("");
    window.scrollTo({ top: 0, behavior: "smooth" });
  }
  return (
    <>
      <h1 className="mt-12 text-3xl font-semibold">Meine Buchungskonten</h1>
      <p className="mt-2 text-slate-600">Dein persönlicher Kontenbaum, gegliedert nach Bilanz und Erfolgsrechnung.</p>
      {error && <p role="alert" className="mt-5 text-sm text-red-700">{error}</p>}
      {notice && <p role="status" className="mt-5 text-sm text-emerald-700">{notice}</p>}
      {accounts.length === 0 ? (
        <section className="mt-8 rounded-2xl border border-slate-200 bg-white p-8 text-center shadow-sm">
          <h2 className="text-xl font-semibold">Starte mit deinem Kontenbaum</h2>
          <p className="mx-auto mt-3 max-w-lg text-sm text-slate-600">Übernimm die aktiven Kontenvorlagen als Anfangsstand. Anschließend kannst du deine Konten anpassen und in freigegebenen Bereichen eigene Unterkonten ergänzen.</p>
          <button onClick={initialize} disabled={pending} className={"mt-6 " + buttonClass}>{pending ? "Konten werden erstellt…" : "Anfangsstand aus Vorlagen erstellen"}</button>
        </section>
      ) : (
        <>
          {editor && <AccountForm key={editor.account?.id ?? "new-" + editor.parentId} editor={editor} accounts={accounts} onCancel={() => setEditor(null)} onSaved={() => { setEditor(null); setNotice("Konto gespeichert."); }} />}
          <p className="mb-3 mt-8 text-sm text-slate-500">{accounts.length} Konten · Eigene Unterkonten kannst du über „Unterkonto“ anlegen.</p>
          <div role="region" aria-label="Buchungskontenbaum" tabIndex={0} className="overflow-x-auto rounded-xl border border-slate-200 bg-white shadow-sm focus-visible:outline-2 focus-visible:outline-emerald-700">
            <table className="w-full text-sm">
              <caption className="sr-only">Dein persönlicher Buchungskontenbaum</caption>
              <thead className="bg-slate-50 text-left text-xs text-slate-500"><tr><th scope="col" className="px-4 py-3 font-medium">Nr.</th><th scope="col" className="px-4 py-3 font-medium">Name</th><th scope="col" className="px-4 py-3 text-right font-medium">Aktionen</th></tr></thead>
              {groups.map((group) => <tbody key={group.label}>
                <tr className="border-t border-slate-200 bg-slate-100"><th colSpan={3} className="px-4 py-3 text-left font-semibold">{group.label}</th></tr>
                {group.types.map(({ type, rows }) => <Fragment key={type}>
                  <tr className="border-t border-slate-100 bg-slate-50"><th colSpan={3} className="px-4 py-2 text-left text-xs font-semibold text-slate-600">{bookingAccountTypeLabels[type]}</th></tr>
                  {rows.map(({ template: account, depth }) => {
                    const canAdd = allowsAccountChildren(account.id, accounts);
                    const canDelete = !account.templateId && !account.bucket && !accounts.some((item) => item.parentId === account.id);
                    return <tr key={account.id} className="border-t border-slate-100 align-top hover:bg-slate-50">
                      <td className="px-4 py-3 tabular-nums text-slate-500">{account.number}</td>
                      <th scope="row" className="px-4 py-3 text-left font-medium" style={{ paddingLeft: `${1 + depth * 1.25}rem` }}>
                        <span className={account.isArchived ? "text-slate-400" : ""}>{account.name}</span>
                        {account.isArchived && <span className="ml-2 text-xs font-normal text-slate-500">Archiviert</span>}
                        {!account.templateId && <span className="ml-2 text-xs font-normal text-slate-500">Eigenes Konto</span>}
                      </th>
                      <td className="px-4 py-3"><div className="flex justify-end gap-3 whitespace-nowrap">
                        {canAdd && <button disabled={busy} onClick={() => openEditor({ account: null, parentId: account.id })} aria-label={"Unterkonto für " + account.name + " anlegen"} className="text-emerald-700 hover:underline disabled:opacity-50">Unterkonto</button>}
                        <button disabled={busy} onClick={() => openEditor({ account, parentId: account.parentId ?? "" })} aria-label={account.name + " bearbeiten"} className="font-semibold text-emerald-700 hover:underline disabled:opacity-50">Bearbeiten</button>
                        {canDelete && <button disabled={busy} onClick={() => remove(account)} aria-label={account.name + " löschen"} className="text-red-700 hover:underline disabled:opacity-50">Löschen</button>}
                      </div></td>
                    </tr>;
                  })}
                </Fragment>)}
              </tbody>)}
            </table>
          </div>
        </>
      )}
    </>
  );
}
