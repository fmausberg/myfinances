"use client";

import { Fragment, useId, useState, useTransition, type FormEvent } from "react";
import type { BookingAccountTemplate } from "@/generated/prisma/client";
import { bookingAccountGroups, bookingAccountTypeLabels } from "@/lib/booking-account-types";
import { groupTemplateHierarchy } from "@/lib/template-hierarchy";
import { deleteTemplate, saveTemplate } from "./actions";

type Template = Pick<BookingAccountTemplate,
  "id" | "number" | "name" | "description" | "type" | "parentId" | "position" |
  "isArchived" | "isPostable" | "allowsCustomChildren">;
const inputClass = "mt-2 w-full rounded-lg border border-slate-300 bg-white px-3 py-2.5 outline-none focus:border-emerald-600 focus:ring-2 focus:ring-emerald-100";
const buttonClass = "rounded-lg bg-emerald-700 px-4 py-2.5 text-sm font-semibold text-white hover:bg-emerald-800 disabled:opacity-50";

function TemplateForm({ template, templates, onSaved, onCancel }: {
  template: Template | null;
  templates: Template[];
  onSaved: () => void;
  onCancel: () => void;
}) {
  const prefix = useId();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState("");
  const byId = new Map(templates.map((item) => [item.id, item]));
  const initialParent = template?.parentId ? byId.get(template.parentId) : undefined;
  const [selectedType, setSelectedType] = useState<string>(initialParent?.type ?? template?.type ?? "");
  const [selectedParentId, setSelectedParentId] = useState(template?.parentId ?? "");
  const selectedParent = byId.get(selectedParentId);
  const parentOptions = groupTemplateHierarchy(templates).flatMap((group) =>
    group.types.flatMap((typeGroup) => typeGroup.rows),
  ).filter(({ template: candidate }) => {
    if (selectedType && candidate.type !== selectedType) return false;
    const seen = new Set<string>();
    let current: Template | undefined = candidate;
    while (current) {
      if (current.id === template?.id || seen.has(current.id)) return false;
      seen.add(current.id);
      current = current.parentId ? byId.get(current.parentId) : undefined;
    }
    return true;
  });

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (pending) return;
    const data = new FormData(event.currentTarget);
    setError("");
    startTransition(async () => {
      try {
        const result = await saveTemplate(template?.id ?? null, data);
        if (result.error) setError(result.error);
        else onSaved();
      } catch {
        setError("Speichern nicht möglich. Bitte lade die Seite neu und versuche es erneut.");
      }
    });
  }

  return (
    <section className="mt-6 rounded-2xl border border-emerald-200 bg-white p-6 shadow-sm" aria-labelledby={prefix + "-heading"}>
      <h2 id={prefix + "-heading"} className="text-lg font-semibold">{template ? "Vorlage bearbeiten" : "Vorlage anlegen"}</h2>
      <form onSubmit={submit} aria-busy={pending} className="mt-5">
        <fieldset disabled={pending} className="space-y-5 disabled:opacity-60">
          <div className="grid gap-5 sm:grid-cols-2">
            <div>
              <label htmlFor={prefix + "-name"} className="text-sm font-medium">Name *</label>
              <input id={prefix + "-name"} name="name" required defaultValue={template?.name ?? ""} className={inputClass} autoFocus />
            </div>
            <div>
              <label htmlFor={prefix + "-type"} className="text-sm font-medium">Kontotyp *</label>
              <select id={prefix + "-type"} name="type" required value={selectedParent?.type ?? selectedType} onChange={(event) => setSelectedType(event.target.value)} className={inputClass} aria-describedby={selectedParent ? prefix + "-type-help" : undefined}>
                {selectedParent
                  ? <option value={selectedParent.type}>{bookingAccountTypeLabels[selectedParent.type]}</option>
                  : <><option value="">Bitte auswählen</option>{bookingAccountGroups.map((group) => <optgroup key={group.label} label={group.label}>{group.types.map((type) => <option key={type} value={type}>{bookingAccountTypeLabels[type]}</option>)}</optgroup>)}</>}
              </select>
              {selectedParent && <p id={prefix + "-type-help"} className="mt-2 text-xs text-slate-500">Der Kontotyp entspricht der übergeordneten Vorlage. Wähle „Keine“, um ihn zu ändern.</p>}
              {template && initialParent && template.type !== initialParent.type && <p className="mt-2 text-sm text-amber-700">Der bisherige Kontotyp passt nicht zur übergeordneten Vorlage. Beim Speichern wird deren Kontotyp übernommen.</p>}
            </div>
            <div>
              <label htmlFor={prefix + "-parent"} className="text-sm font-medium">Übergeordnete Vorlage</label>
              <select id={prefix + "-parent"} name="parentId" value={selectedParentId} onChange={(event) => {
                const parentId = event.target.value;
                setSelectedParentId(parentId);
                const parent = byId.get(parentId);
                if (parent) setSelectedType(parent.type);
              }} className={inputClass}>
                <option value="">Keine (oberste Ebene)</option>
                {parentOptions.map(({ template: item, depth }) => <option key={item.id} value={item.id}>{"— ".repeat(depth)}{item.name}</option>)}
              </select>
            </div>
          </div>
          <div>
            <label htmlFor={prefix + "-position"} className="text-sm font-medium">Position</label>
            <input id={prefix + "-position"} name="position" type="number" step={1} min={-2147483648} max={2147483647} required defaultValue={template?.position ?? 0} aria-describedby={prefix + "-position-help"} className={inputClass} />
            <p id={prefix + "-position-help"} className="mt-2 text-xs text-slate-500">Kleinere Werte erscheinen auf derselben Hierarchieebene weiter oben. Bei gleicher Position wird nach Name sortiert.</p>
          </div>
          <div>
            <label htmlFor={prefix + "-description"} className="text-sm font-medium">Beschreibung</label>
            <textarea id={prefix + "-description"} name="description" rows={3} defaultValue={template?.description ?? ""} className={inputClass} />
          </div>
          <div className="flex flex-wrap gap-x-6 gap-y-3 text-sm">
            <label className="flex items-center gap-2"><input type="checkbox" name="isPostable" defaultChecked={template?.isPostable ?? true} className="accent-emerald-700" />Bebuchbar</label>
            <label className="flex items-center gap-2"><input type="checkbox" name="allowsCustomChildren" defaultChecked={template?.allowsCustomChildren ?? false} className="accent-emerald-700" />Eigene Unterkonten erlauben</label>
            <label className="flex items-center gap-2"><input type="checkbox" name="isArchived" defaultChecked={template?.isArchived ?? false} className="accent-emerald-700" />Archiviert</label>
          </div>
          <div className="flex gap-3">
            <button type="submit" className={buttonClass}>{pending ? "Wird gespeichert…" : "Speichern"}</button>
            <button type="button" onClick={onCancel} className="rounded-lg border border-slate-300 px-4 py-2.5 text-sm hover:bg-slate-50">Abbrechen</button>
          </div>
        </fieldset>
        {error && <p role="alert" className="mt-4 text-sm text-red-700">{error}</p>}
      </form>
    </section>
  );
}

function TemplateRow({ template, depth, disabled, onEdit, onDeleted }: {
  template: Template;
  depth: number;
  disabled: boolean;
  onEdit: () => void;
  onDeleted: () => void;
}) {
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState("");
  function remove() {
    if (!window.confirm(`Vorlage „${template.name}“ wirklich löschen?`)) return;
    setError("");
    startTransition(async () => {
      try {
        const result = await deleteTemplate(template.id);
        if (result.error) setError(result.error);
        else onDeleted();
      } catch {
        setError("Löschen nicht möglich. Bitte lade die Seite neu und versuche es erneut.");
      }
    });
  }
  return (
    <tr className="border-t border-slate-100 align-top hover:bg-slate-50">
      <td className="px-4 py-3 tabular-nums text-slate-500">{template.number}</td>
      <th scope="row" className="px-4 py-3 text-left font-medium" style={{ paddingLeft: `${1 + depth * 1.25}rem` }}>
        <span className="block max-w-60 truncate" title={template.name}>{template.name}</span>
      </th>
      <td className="px-4 py-3 text-slate-600">{bookingAccountTypeLabels[template.type]}</td>
      <td className="px-4 py-3">
        <div className="flex justify-end gap-3 whitespace-nowrap">
          <button onClick={onEdit} disabled={pending || disabled} aria-label={template.name + " bearbeiten"} className="font-semibold text-emerald-700 hover:underline disabled:opacity-50">Bearbeiten</button>
          <button onClick={remove} disabled={pending || disabled} aria-label={template.name + " löschen"} className="text-red-700 hover:underline disabled:opacity-50">{pending ? "Wird gelöscht…" : "Löschen"}</button>
        </div>
        {error && <p role="alert" className="mt-2 max-w-64 text-xs text-red-700">{error}</p>}
      </td>
    </tr>
  );
}

export function TemplateManager({ templates }: { templates: Template[] }) {
  const [editor, setEditor] = useState<Template | "new" | null>(null);
  const [notice, setNotice] = useState("");
  const groups = groupTemplateHierarchy(templates);
  return (
    <>
      <div className="mt-8 flex flex-wrap items-start justify-between gap-4">
        <div><p className="text-sm font-medium text-emerald-700">Administration</p><h1 className="mt-2 text-3xl font-semibold">Buchungskontenvorlagen</h1><p className="mt-2 text-slate-600">Verwalte die zentralen Vorlagen und ihre Hierarchie.</p></div>
        <button onClick={() => { setEditor("new"); setNotice(""); }} disabled={editor !== null} className={buttonClass}>Vorlage anlegen</button>
      </div>
      {notice && <p role="status" className="mt-5 text-sm text-emerald-700">{notice}</p>}
      {editor !== null && <TemplateForm key={editor === "new" ? "new" : editor.id} template={editor === "new" ? null : editor} templates={templates} onCancel={() => setEditor(null)} onSaved={() => { setEditor(null); setNotice("Vorlage gespeichert."); }} />}
      <p className="mb-3 mt-8 text-sm text-slate-500">{templates.length} Vorlagen</p>
      {templates.length === 0 ? <div className="rounded-xl border border-dashed border-slate-300 p-10 text-center text-sm text-slate-600">Noch keine Vorlagen. Lege die erste über „Vorlage anlegen“ an.</div> :
        <div role="region" aria-label="Buchungskontenvorlagen" tabIndex={0} className="overflow-x-auto rounded-xl border border-slate-200 bg-white shadow-sm focus-visible:outline-2 focus-visible:outline-emerald-700">
          <table className="w-full text-sm">
            <caption className="sr-only">Buchungskontenvorlagen verwalten</caption>
            <thead className="bg-slate-50 text-left text-xs text-slate-500"><tr>
              {["Nr.", "Name", "Kontotyp"].map((label) => <th key={label} scope="col" className="px-4 py-3 font-medium">{label}</th>)}
              <th scope="col" className="px-4 py-3 text-right font-medium">Aktionen</th>
            </tr></thead>
            {groups.map((group) => <tbody key={group.label}>
              <tr className="border-t border-slate-200 bg-slate-100"><th colSpan={4} className="px-4 py-3 text-left font-semibold text-slate-900">{group.label}</th></tr>
              {group.types.map(({ type, rows }) => <Fragment key={type}>
                <tr className="border-t border-slate-100 bg-slate-50"><th colSpan={4} className="px-4 py-2 text-left text-xs font-semibold text-slate-600">{bookingAccountTypeLabels[type]}</th></tr>
                {rows.map(({ template, depth }) => <TemplateRow key={template.id} template={template} depth={depth} disabled={editor !== null} onEdit={() => { setEditor(template); setNotice(""); window.scrollTo({ top: 0, behavior: "smooth" }); }} onDeleted={() => setNotice("Vorlage gelöscht.")} />)}
              </Fragment>)}
            </tbody>)}
          </table>
        </div>}
    </>
  );
}
