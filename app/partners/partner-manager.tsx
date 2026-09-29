"use client";

import { useId, useState, useTransition, type FormEvent } from "react";
import type { Partner } from "@/generated/prisma/client";
import { deletePartner, savePartner } from "./actions";

type PartnerData = Pick<Partner, "id" | "number" | "type" | "name" | "email" | "notes" | "contactLink">;
const inputClass = "mt-2 w-full rounded-lg border border-slate-300 bg-white px-3 py-2.5 outline-none focus:border-emerald-600 focus:ring-2 focus:ring-emerald-100";
const buttonClass = "rounded-lg bg-emerald-700 px-4 py-2.5 text-sm font-semibold text-white hover:bg-emerald-800 disabled:opacity-50";

function PartnerForm({ partner, onSaved, onCancel }: {
  partner: PartnerData | null;
  onSaved: () => void;
  onCancel: () => void;
}) {
  const prefix = useId();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState("");

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (pending) return;
    const data = new FormData(event.currentTarget);
    setError("");
    startTransition(async () => {
      try {
        const result = await savePartner(partner?.id ?? null, data);
        if (result.error) setError(result.error);
        else onSaved();
      } catch {
        setError("Speichern nicht möglich. Bitte lade die Seite neu und versuche es erneut.");
      }
    });
  }

  return (
    <section aria-labelledby={prefix + "-heading"} className="mt-6 rounded-2xl border border-emerald-200 bg-white p-6 shadow-sm">
      <h2 id={prefix + "-heading"} className="text-lg font-semibold">{partner ? "Partner bearbeiten" : "Partner anlegen"}</h2>
      <form onSubmit={submit} className="mt-5" aria-busy={pending}>
        <fieldset disabled={pending} className="space-y-5 disabled:opacity-60">
          <div className="grid gap-5 sm:grid-cols-2">
            <div>
              <label htmlFor={prefix + "-name"} className="text-sm font-medium">Name *</label>
              <input id={prefix + "-name"} name="name" required defaultValue={partner?.name ?? ""} className={inputClass} autoFocus />
            </div>
            <div>
              <label htmlFor={prefix + "-type"} className="text-sm font-medium">Typ *</label>
              <select id={prefix + "-type"} name="type" defaultValue={partner?.type ?? "NATURAL_PERSON"} className={inputClass}>
                <option value="NATURAL_PERSON">Natürliche Person</option>
                <option value="LEGAL_ENTITY">Juristische Person</option>
              </select>
            </div>
            <div>
              <label htmlFor={prefix + "-email"} className="text-sm font-medium">E-Mail-Adresse</label>
              <input id={prefix + "-email"} name="email" type="email" defaultValue={partner?.email ?? ""} className={inputClass} />
            </div>
            <div>
              <label htmlFor={prefix + "-link"} className="text-sm font-medium">Kontaktlink</label>
              <input id={prefix + "-link"} name="contactLink" type="url" placeholder="https://…" defaultValue={partner?.contactLink ?? ""} className={inputClass} />
            </div>
          </div>
          <div>
            <label htmlFor={prefix + "-notes"} className="text-sm font-medium">Notizen</label>
            <textarea id={prefix + "-notes"} name="notes" rows={4} defaultValue={partner?.notes ?? ""} className={inputClass} />
          </div>
          <div className="flex flex-wrap gap-3">
            <button type="submit" className={buttonClass}>{pending ? "Wird gespeichert…" : "Speichern"}</button>
            <button type="button" onClick={onCancel} className="rounded-lg border border-slate-300 px-4 py-2.5 text-sm hover:bg-slate-50">Abbrechen</button>
          </div>
        </fieldset>
        {error && <p role="alert" className="mt-4 text-sm text-red-700">{error}</p>}
      </form>
    </section>
  );
}

function PartnerRow({ partner, onEdit, onDeleted }: {
  partner: PartnerData;
  onEdit: () => void;
  onDeleted: () => void;
}) {
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState("");
  function remove() {
    if (!window.confirm(`„${partner.name}“ wirklich löschen? Eine vorhandene Benutzerverknüpfung wird ebenfalls gelöscht.`)) return;
    setError("");
    startTransition(async () => {
      try {
        const result = await deletePartner(partner.id);
        if (result.error) setError(result.error);
        else onDeleted();
      } catch {
        setError("Löschen nicht möglich. Bitte lade die Seite neu und versuche es erneut.");
      }
    });
  }
  return (
    <tr className="border-t border-slate-100 align-top hover:bg-slate-50">
      <td className="px-4 py-3 tabular-nums text-slate-500">{partner.number}</td>
      <th scope="row" className="px-4 py-3 text-left font-medium">
        <span className="block max-w-48 truncate" title={partner.name}>{partner.name}</span>
      </th>
      <td className="px-4 py-3">
        <div className="flex justify-end gap-3 whitespace-nowrap">
          <button onClick={onEdit} disabled={pending} aria-label={partner.name + " bearbeiten"} className="text-sm font-semibold text-emerald-700 hover:underline disabled:opacity-50">Bearbeiten</button>
          <button onClick={remove} disabled={pending} aria-label={partner.name + " löschen"} className="text-sm font-medium text-red-700 hover:underline disabled:opacity-50">{pending ? "Wird gelöscht…" : "Löschen"}</button>
        </div>
        {error && <p role="alert" className="mt-2 max-w-48 text-xs text-red-700">{error}</p>}
      </td>
    </tr>
  );
}

export function PartnerManager({ partners }: { partners: PartnerData[] }) {
  const [editor, setEditor] = useState<PartnerData | "new" | null>(null);
  const [notice, setNotice] = useState("");
  return (
    <>
      <div className="mt-12 flex flex-wrap items-start justify-between gap-4">
        <div><h1 className="text-3xl font-semibold">Meine Partner</h1><p className="mt-2 text-slate-600">Verwalte deine Personen, Unternehmen und Kontakte.</p></div>
        <button onClick={() => { setEditor("new"); setNotice(""); }} disabled={editor !== null} className={buttonClass}>Partner anlegen</button>
      </div>
      {notice && <p role="status" className="mt-5 text-sm text-emerald-700">{notice}</p>}
      {editor !== null && <PartnerForm key={editor === "new" ? "new" : editor.id} partner={editor === "new" ? null : editor} onCancel={() => setEditor(null)} onSaved={() => { setEditor(null); setNotice("Partner gespeichert."); }} />}
      <div className="mt-8 space-y-4">
        <p className="text-sm text-slate-500">{partners.length} Partner</p>
        {partners.length === 0 && <div className="rounded-2xl border border-dashed border-slate-300 p-10 text-center"><h2 className="font-semibold">Noch keine Partner</h2><p className="mt-2 text-sm text-slate-600">Lege deinen ersten Partner über „Partner anlegen“ an.</p></div>}
        {partners.length > 0 && <div role="region" aria-label="Partnertabelle" tabIndex={0} className="overflow-x-auto rounded-xl border border-slate-200 bg-white shadow-sm focus-visible:outline-2 focus-visible:outline-emerald-700">
          <table className="w-full text-sm">
            <caption className="sr-only">Deine Partner mit Nummer, Name und Aktionen</caption>
            <thead className="bg-slate-50 text-left text-xs text-slate-500">
              <tr>
                <th scope="col" className="px-4 py-3 font-medium">Nr.</th>
                <th scope="col" className="px-4 py-3 font-medium">Name</th>
                <th scope="col" className="px-4 py-3 text-right font-medium">Aktionen</th>
              </tr>
            </thead>
            <tbody>
              {partners.map((partner) => <PartnerRow key={partner.id} partner={partner} onEdit={() => { setEditor(partner); setNotice(""); window.scrollTo({ top: 0, behavior: "smooth" }); }} onDeleted={() => { if (editor !== "new" && editor?.id === partner.id) setEditor(null); setNotice("Partner gelöscht."); }} />)}
            </tbody>
          </table>
        </div>}
      </div>
    </>
  );
}
