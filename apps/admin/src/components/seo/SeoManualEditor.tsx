import type { ReactNode } from "react";
import { SEO_PAGES, type SeoPageKey } from "@wisdom/utils";
import SeoSectionCard from "./SeoSectionCard";
import type { SeoPageDefinition, SeoRecord } from "./types";
import { classNames } from "./utils";

export interface SeoFormState {
  title: string;
  metaDescription: string;
  primaryKeywords: string;
  secondaryKeywords: string;
  ogImage: string;
  robotsIndex: boolean;
}

function FormField({
  label,
  hint,
  children,
}: {
  label: string;
  hint?: string;
  children: ReactNode;
}) {
  return (
    <label className="block">
      <span className="text-sm font-medium">{label}</span>
      {hint ? <span className="mt-1 block text-xs opacity-70">{hint}</span> : null}
      <div className="mt-3">{children}</div>
    </label>
  );
}

export default function SeoManualEditor({
  isLightTheme,
  pages,
  settingsByPage,
  activePage,
  onActivePageChange,
  form,
  onFormChange,
  savingKey,
  onSave,
}: {
  isLightTheme: boolean;
  pages: SeoPageDefinition[];
  settingsByPage: Map<SeoPageKey, SeoRecord>;
  activePage: SeoPageKey;
  onActivePageChange: (pageKey: SeoPageKey) => void;
  form: SeoFormState;
  onFormChange: (next: SeoFormState) => void;
  savingKey: SeoPageKey | null;
  onSave: (pageKey: SeoPageKey) => void;
}) {
  const inputClass = classNames(
    "w-full rounded-2xl border px-4 py-3 text-sm outline-none transition-colors",
    isLightTheme ? "border-slate-200 bg-white text-slate-900" : "border-white/10 bg-white/5 text-white",
  );
  const activeRecord = settingsByPage.get(activePage) ?? null;

  return (
    <SeoSectionCard title="Live SEO Data" eyebrow="Manual Editor" isLightTheme={isLightTheme}>
      <div className="grid gap-6 xl:grid-cols-[0.32fr_0.68fr]">
        <div className="space-y-3">
          {pages.map((page) => {
            const hasSettings = settingsByPage.has(page.key);
            return (
              <button
                key={page.key}
                type="button"
                onClick={() => onActivePageChange(page.key)}
                className={classNames(
                  "w-full rounded-2xl border px-4 py-4 text-left transition-colors",
                  activePage === page.key
                    ? "border-accent-cyan bg-accent-cyan/10"
                    : isLightTheme
                      ? "border-slate-200 bg-white hover:border-slate-300"
                      : "border-white/10 bg-white/5 hover:border-white/20",
                )}
              >
                <div className="flex items-center justify-between">
                  <span className="font-medium">{page.label}</span>
                  <span className="text-xs uppercase tracking-[0.18em] opacity-60">
                    {page.key === SEO_PAGES.global ? "Default" : hasSettings ? "Saved" : "Draft"}
                  </span>
                </div>
                <p className="mt-2 text-sm opacity-70">{page.description}</p>
              </button>
            );
          })}
        </div>

        <div className="space-y-5">
          <div className="rounded-2xl border border-inherit bg-black/10 p-4 text-sm">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <p className="text-xs uppercase tracking-[0.18em] opacity-60">Editing</p>
                <p className="mt-1 text-lg font-semibold">{pages.find((page) => page.key === activePage)?.label ?? activePage}</p>
              </div>
              <button
                type="button"
                onClick={() => onSave(activePage)}
                disabled={savingKey === activePage}
                className={classNames(
                  "rounded-2xl px-4 py-2 text-sm font-semibold transition-colors",
                  savingKey === activePage
                    ? "cursor-not-allowed bg-slate-400/30 text-white/60"
                    : "bg-accent-cyan text-slate-950 hover:brightness-110",
                )}
              >
                {savingKey === activePage ? "Saving..." : "Save Live SEO"}
              </button>
            </div>
            {activeRecord ? <p className="mt-3 text-xs opacity-60">Last updated: {new Date(activeRecord.updatedAt).toLocaleString()}</p> : null}
          </div>

          <div className="grid gap-5">
            <FormField label="SEO Title" hint="Target 30-60 characters with the page's main intent.">
              <input
                value={form.title}
                onChange={(event) => onFormChange({ ...form, title: event.target.value })}
                className={inputClass}
                placeholder="Prime Mentor Sessions for Clarity and Transformation"
              />
            </FormField>

            <FormField label="Meta Description" hint="Target 140-160 characters with a clear benefit or CTA.">
              <textarea
                value={form.metaDescription}
                onChange={(event) => onFormChange({ ...form, metaDescription: event.target.value })}
                rows={4}
                className={inputClass}
                placeholder="Receive grounded insight, transformational support, and clear next steps through Prime Mentor sessions."
              />
            </FormField>

            <div className="grid gap-5 lg:grid-cols-2">
              <FormField label="Primary Keywords" hint="Comma separated.">
                <textarea
                  value={form.primaryKeywords}
                  onChange={(event) => onFormChange({ ...form, primaryKeywords: event.target.value })}
                  rows={3}
                  className={inputClass}
                  placeholder="prime mentor sessions, clarity session"
                />
              </FormField>

              <FormField label="Secondary Keywords" hint="Comma separated supporting terms.">
                <textarea
                  value={form.secondaryKeywords}
                  onChange={(event) => onFormChange({ ...form, secondaryKeywords: event.target.value })}
                  rows={3}
                  className={inputClass}
                  placeholder="spiritual mentorship, transformation guidance"
                />
              </FormField>
            </div>

            <FormField label="OG Image" hint="Recommended social image URL or asset path.">
              <input
                value={form.ogImage}
                onChange={(event) => onFormChange({ ...form, ogImage: event.target.value })}
                className={inputClass}
                placeholder="https://www.theprimementor.com/images/share-card.png"
              />
            </FormField>

            <label className="flex items-center gap-3 rounded-2xl border border-inherit bg-black/10 px-4 py-3 text-sm">
              <input
                type="checkbox"
                checked={form.robotsIndex}
                onChange={(event) => onFormChange({ ...form, robotsIndex: event.target.checked })}
              />
              Allow indexing for this page
            </label>
          </div>
        </div>
      </div>
    </SeoSectionCard>
  );
}
