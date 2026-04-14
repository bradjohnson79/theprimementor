import { useAuth } from "@clerk/react";
import { SEO_PAGE_OPTIONS, SEO_PAGES, type SeoPageKey } from "@wisdom/utils";
import { useEffect, useMemo, useState } from "react";
import { useAdminSettings } from "../context/AdminSettingsContext";
import { api } from "../lib/api";

interface SeoKeywordBuckets {
  primary: string[];
  secondary: string[];
}

interface SeoRecord {
  id: string;
  pageKey: SeoPageKey;
  title: string | null;
  metaDescription: string | null;
  keywords: SeoKeywordBuckets;
  ogImage: string | null;
  robotsIndex: boolean;
  createdAt: string;
  updatedAt: string;
}

interface SeoResponse {
  pages: Array<{
    key: SeoPageKey;
    label: string;
    description: string;
  }>;
  settings: SeoRecord[];
}

interface SeoFormState {
  title: string;
  metaDescription: string;
  primaryKeywords: string;
  secondaryKeywords: string;
  ogImage: string;
  robotsIndex: boolean;
}

function classNames(...values: Array<string | false | null | undefined>) {
  return values.filter(Boolean).join(" ");
}

function toKeywordLines(value: string[]) {
  return value.join(", ");
}

function parseKeywords(value: string) {
  return Array.from(new Set(
    value
      .split(",")
      .map((entry) => entry.trim())
      .filter(Boolean),
  ));
}

function buildFormState(record: SeoRecord | null | undefined): SeoFormState {
  return {
    title: record?.title ?? "",
    metaDescription: record?.metaDescription ?? "",
    primaryKeywords: toKeywordLines(record?.keywords.primary ?? []),
    secondaryKeywords: toKeywordLines(record?.keywords.secondary ?? []),
    ogImage: record?.ogImage ?? "",
    robotsIndex: record?.robotsIndex ?? true,
  };
}

function formatDate(value: string) {
  return new Intl.DateTimeFormat("en-CA", {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  }).format(new Date(value));
}

function FormField({
  label,
  hint,
  children,
}: {
  label: string;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <label className="block">
      <span className="text-sm font-medium">{label}</span>
      {hint ? <span className="mt-1 block text-xs opacity-70">{hint}</span> : null}
      <div className="mt-3">{children}</div>
    </label>
  );
}

function SectionCard({
  title,
  eyebrow,
  isLightTheme,
  children,
}: {
  title: string;
  eyebrow?: string;
  isLightTheme: boolean;
  children: React.ReactNode;
}) {
  return (
    <section
      className={classNames(
        "rounded-3xl border p-6 shadow-sm backdrop-blur-sm",
        isLightTheme
          ? "border-slate-200 bg-white shadow-[0_16px_40px_rgba(15,23,42,0.08)]"
          : "border-white/10 bg-white/5 shadow-[0_16px_40px_rgba(2,6,23,0.24)]",
      )}
    >
      {eyebrow ? <p className="text-xs font-semibold uppercase tracking-[0.28em] text-accent-cyan">{eyebrow}</p> : null}
      <h2 className={classNames("mt-2 text-xl font-semibold", isLightTheme ? "text-slate-900" : "text-white")}>{title}</h2>
      <div className="mt-6">{children}</div>
    </section>
  );
}

export default function Seo() {
  const { getToken } = useAuth();
  const { resolvedTheme } = useAdminSettings();
  const isLightTheme = resolvedTheme === "light";
  const [data, setData] = useState<SeoResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [savingKey, setSavingKey] = useState<SeoPageKey | null>(null);
  const [activePage, setActivePage] = useState<SeoPageKey>(SEO_PAGES.home);
  const [form, setForm] = useState<SeoFormState>(buildFormState(null));

  const inputClass = classNames(
    "w-full rounded-2xl border px-4 py-3 text-sm outline-none transition-colors",
    isLightTheme ? "border-slate-200 bg-white text-slate-900" : "border-white/10 bg-white/5 text-white",
  );

  async function load() {
    setLoading(true);
    setError(null);
    try {
      const token = await getToken();
      const response = (await api.get("/admin/seo", token)) as { data: SeoResponse };
      setData(response.data);
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : "Failed to load SEO settings.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void load();
  }, []);

  const settingsByPage = useMemo(() => {
    const next = new Map<SeoPageKey, SeoRecord>();
    for (const item of data?.settings ?? []) {
      next.set(item.pageKey, item);
    }
    return next;
  }, [data]);

  const activeRecord = settingsByPage.get(activePage) ?? null;
  const globalRecord = settingsByPage.get(SEO_PAGES.global) ?? null;

  useEffect(() => {
    setForm(buildFormState(activeRecord));
    setMessage(null);
  }, [activePage, activeRecord]);

  const keywordLibrary = useMemo(() => {
    const allKeywords = (data?.settings ?? []).flatMap((item) => [
      ...item.keywords.primary,
      ...item.keywords.secondary,
    ]);
    return Array.from(new Set(allKeywords)).sort((left, right) => left.localeCompare(right));
  }, [data]);

  async function savePage(pageKey: SeoPageKey) {
    setSavingKey(pageKey);
    setError(null);
    setMessage(null);
    try {
      const token = await getToken();
      const payload = {
        pageKey,
        title: form.title,
        metaDescription: form.metaDescription,
        keywords: {
          primary: parseKeywords(form.primaryKeywords),
          secondary: parseKeywords(form.secondaryKeywords),
        },
        ogImage: form.ogImage,
        robotsIndex: form.robotsIndex,
      };

      const existing = settingsByPage.get(pageKey);
      if (existing) {
        await api.put(`/admin/seo/${pageKey}`, payload, token);
      } else {
        await api.post("/admin/seo", payload, token);
      }

      await load();
      setMessage(`${SEO_PAGE_OPTIONS.find((page) => page.key === pageKey)?.label ?? pageKey} SEO saved.`);
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : "Failed to save SEO settings.");
    } finally {
      setSavingKey(null);
    }
  }

  return (
    <div className="space-y-6">
      <div>
        <p className="text-xs font-semibold uppercase tracking-[0.32em] text-accent-cyan">Search Layer</p>
        <h1 className={classNames("mt-2 text-3xl font-semibold tracking-tight", isLightTheme ? "text-slate-900" : "text-white")}>
          SEO
        </h1>
        <p className={classNames("mt-3 max-w-3xl text-sm leading-6", isLightTheme ? "text-slate-600" : "text-white/65")}>
          Control global metadata, page-level keyword targeting, social preview defaults, and indexing behavior without
          exposing SEO configuration outside the admin workspace.
        </p>
      </div>

      {message ? (
        <div
          className={classNames(
            "rounded-2xl border px-4 py-3 text-sm",
            isLightTheme ? "border-emerald-200 bg-emerald-50 text-emerald-700" : "border-emerald-400/25 bg-emerald-400/10 text-emerald-100",
          )}
        >
          {message}
        </div>
      ) : null}

      {error ? (
        <div
          className={classNames(
            "rounded-2xl border px-4 py-3 text-sm",
            isLightTheme ? "border-rose-200 bg-rose-50 text-rose-700" : "border-rose-400/25 bg-rose-400/10 text-rose-100",
          )}
        >
          {error}
        </div>
      ) : null}

      <div className="grid gap-4 xl:grid-cols-[1.1fr_1fr]">
        <SectionCard title="Global SEO Settings" eyebrow="Foundation" isLightTheme={isLightTheme}>
          {loading ? (
            <div className="space-y-3">
              {Array.from({ length: 4 }).map((_, index) => (
                <div key={`global-loading-${index}`} className="h-14 animate-pulse rounded-2xl bg-white/5" />
              ))}
            </div>
          ) : (
            <div className="space-y-4">
              <div className={classNames("rounded-2xl border p-4", isLightTheme ? "border-slate-200 bg-slate-50" : "border-white/10 bg-white/5")}>
                <p className="text-xs uppercase tracking-wide text-accent-cyan">Default title</p>
                <p className={classNames("mt-2 text-sm", isLightTheme ? "text-slate-700" : "text-white/70")}>
                  {globalRecord?.title || "Not configured yet"}
                </p>
              </div>
              <div className={classNames("rounded-2xl border p-4", isLightTheme ? "border-slate-200 bg-slate-50" : "border-white/10 bg-white/5")}>
                <p className="text-xs uppercase tracking-wide text-accent-cyan">Default meta description</p>
                <p className={classNames("mt-2 text-sm", isLightTheme ? "text-slate-700" : "text-white/70")}>
                  {globalRecord?.metaDescription || "No global fallback description has been saved yet."}
                </p>
              </div>
              <div className={classNames("rounded-2xl border p-4", isLightTheme ? "border-slate-200 bg-slate-50" : "border-white/10 bg-white/5")}>
                <p className="text-xs uppercase tracking-wide text-accent-cyan">Global keywords</p>
                <p className={classNames("mt-2 text-sm", isLightTheme ? "text-slate-700" : "text-white/70")}>
                  {[...(globalRecord?.keywords.primary ?? []), ...(globalRecord?.keywords.secondary ?? [])].join(", ") || "No keywords saved yet."}
                </p>
              </div>
              <button
                type="button"
                onClick={() => {
                  setActivePage(SEO_PAGES.global);
                  setForm(buildFormState(globalRecord));
                }}
                className={classNames(
                  "rounded-full border px-4 py-2 text-sm transition",
                  isLightTheme
                    ? "border-slate-200 bg-white text-slate-700 hover:bg-slate-50"
                    : "border-white/10 bg-white/5 text-white/75 hover:bg-white/10 hover:text-white",
                )}
              >
                Edit global defaults
              </button>
            </div>
          )}
        </SectionCard>

        <SectionCard title="Page-Level SEO" eyebrow="Targeted Control" isLightTheme={isLightTheme}>
          {loading ? (
            <div className="grid gap-2 sm:grid-cols-2">
              {Array.from({ length: 7 }).map((_, index) => (
                <div key={`page-option-loading-${index}`} className="h-14 animate-pulse rounded-2xl bg-white/5" />
              ))}
            </div>
          ) : (
            <div className="grid gap-2 sm:grid-cols-2">
              {SEO_PAGE_OPTIONS.map((page) => (
                <button
                  key={page.key}
                  type="button"
                  onClick={() => setActivePage(page.key)}
                  className={classNames(
                    "rounded-2xl border px-4 py-3 text-left transition",
                    activePage === page.key
                      ? "border-accent-cyan bg-accent-cyan/10 text-accent-cyan"
                      : isLightTheme
                        ? "border-slate-200 bg-slate-50 text-slate-700 hover:border-slate-300"
                        : "border-white/10 bg-white/5 text-white/75 hover:border-white/20 hover:text-white",
                  )}
                >
                  <p className="font-medium">{page.label}</p>
                  <p className={classNames("mt-1 text-xs", activePage === page.key ? "text-accent-cyan/80" : isLightTheme ? "text-slate-500" : "text-white/50")}>
                    {page.description}
                  </p>
                </button>
              ))}
            </div>
          )}
        </SectionCard>
      </div>

      <SectionCard title={`${SEO_PAGE_OPTIONS.find((page) => page.key === activePage)?.label ?? activePage} Metadata`} eyebrow="Editor" isLightTheme={isLightTheme}>
        {loading ? (
          <div className="space-y-3">
            {Array.from({ length: 6 }).map((_, index) => (
              <div key={`editor-loading-${index}`} className="h-14 animate-pulse rounded-2xl bg-white/5" />
            ))}
          </div>
        ) : (
          <div className="grid gap-6 xl:grid-cols-[1.05fr_0.95fr]">
            <div className="space-y-5">
              <FormField label="SEO Title" hint="Keep this concise and aligned with the page intent.">
                <input
                  className={inputClass}
                  value={form.title}
                  onChange={(event) => setForm((current) => ({ ...current, title: event.target.value }))}
                  placeholder="Prime Mentor | Page title"
                />
              </FormField>

              <FormField label="Meta Description" hint="Aim for a clean, high-intent summary with natural keyword placement.">
                <textarea
                  className={classNames(inputClass, "min-h-32 resize-y")}
                  value={form.metaDescription}
                  onChange={(event) => setForm((current) => ({ ...current, metaDescription: event.target.value }))}
                  placeholder="Describe the page clearly for search and social previews."
                />
              </FormField>

              <FormField label="Open Graph Image" hint="Absolute image URL used for social previews.">
                <input
                  className={inputClass}
                  value={form.ogImage}
                  onChange={(event) => setForm((current) => ({ ...current, ogImage: event.target.value }))}
                  placeholder="https://theprimementor.com/images/og-home.jpg"
                />
              </FormField>

              <button
                type="button"
                onClick={() => setForm((current) => ({ ...current, robotsIndex: !current.robotsIndex }))}
                className={classNames(
                  "flex w-full items-center justify-between rounded-2xl border px-4 py-3 text-left transition",
                  isLightTheme ? "border-slate-200 bg-slate-50 hover:bg-slate-100" : "border-white/10 bg-white/5 hover:bg-white/10",
                )}
              >
                <span>
                  <span className="block text-sm font-medium">Search Indexing</span>
                  <span className="mt-1 block text-xs opacity-70">
                    Toggle whether this page should be indexed when SEO tags are rendered publicly.
                  </span>
                </span>
                <span
                  className={classNames(
                    "relative inline-flex h-7 w-12 items-center rounded-full transition-colors",
                    form.robotsIndex ? "bg-accent-cyan" : isLightTheme ? "bg-slate-300" : "bg-white/20",
                  )}
                >
                  <span
                    className={classNames(
                      "inline-block h-5 w-5 transform rounded-full bg-white transition-transform",
                      form.robotsIndex ? "translate-x-6" : "translate-x-1",
                    )}
                  />
                </span>
              </button>
            </div>

            <div className="space-y-5">
              <FormField label="Primary Keywords" hint="Comma-separated core target phrases for the selected page.">
                <textarea
                  className={classNames(inputClass, "min-h-32 resize-y")}
                  value={form.primaryKeywords}
                  onChange={(event) => setForm((current) => ({ ...current, primaryKeywords: event.target.value }))}
                  placeholder="prime mentor, spiritual mentorship, divin8"
                />
              </FormField>

              <FormField label="Secondary Keywords" hint="Related support phrases, long-tail variants, and campaign language.">
                <textarea
                  className={classNames(inputClass, "min-h-32 resize-y")}
                  value={form.secondaryKeywords}
                  onChange={(event) => setForm((current) => ({ ...current, secondaryKeywords: event.target.value }))}
                  placeholder="online spiritual sessions, astrology mentorship, blueprint guidance"
                />
              </FormField>

              <div className={classNames("rounded-2xl border p-4", isLightTheme ? "border-slate-200 bg-slate-50" : "border-white/10 bg-white/5")}>
                <p className="text-xs uppercase tracking-wide text-accent-cyan">Record status</p>
                <p className={classNames("mt-2 text-sm", isLightTheme ? "text-slate-700" : "text-white/70")}>
                  {activeRecord
                    ? `Saved ${formatDate(activeRecord.updatedAt)}`
                    : "This page does not have a saved SEO row yet. Saving now will create it."}
                </p>
              </div>

              <div className="flex flex-wrap gap-3">
                <button
                  type="button"
                  onClick={() => void savePage(activePage)}
                  disabled={savingKey === activePage}
                  className={classNames(
                    "rounded-full px-5 py-2.5 text-sm font-medium transition",
                    isLightTheme ? "bg-slate-900 text-white hover:bg-slate-800" : "bg-accent-cyan text-slate-950 hover:brightness-110",
                    savingKey === activePage && "cursor-not-allowed opacity-60",
                  )}
                >
                  {savingKey === activePage ? "Saving..." : "Save SEO Settings"}
                </button>
                <button
                  type="button"
                  onClick={() => setForm(buildFormState(activeRecord))}
                  className={classNames(
                    "rounded-full border px-5 py-2.5 text-sm transition",
                    isLightTheme ? "border-slate-200 bg-white text-slate-700 hover:bg-slate-50" : "border-white/10 bg-white/5 text-white/75 hover:bg-white/10 hover:text-white",
                  )}
                >
                  Reset Editor
                </button>
              </div>
            </div>
          </div>
        )}
      </SectionCard>

      <div className="grid gap-4 xl:grid-cols-[1fr_0.9fr]">
        <SectionCard title="Keyword Tracking" eyebrow="Inventory" isLightTheme={isLightTheme}>
          {loading ? (
            <div className="grid gap-2 sm:grid-cols-2">
              {Array.from({ length: 8 }).map((_, index) => (
                <div key={`keyword-loading-${index}`} className="h-10 animate-pulse rounded-full bg-white/5" />
              ))}
            </div>
          ) : keywordLibrary.length === 0 ? (
            <p className={classNames("text-sm", isLightTheme ? "text-slate-500" : "text-white/60")}>
              No keywords have been saved yet. Add page-level keywords to build the search inventory.
            </p>
          ) : (
            <div className="flex flex-wrap gap-2">
              {keywordLibrary.map((keyword) => (
                <span
                  key={keyword}
                  className={classNames(
                    "rounded-full border px-3 py-1.5 text-xs font-medium",
                    isLightTheme ? "border-slate-200 bg-slate-50 text-slate-700" : "border-white/10 bg-white/5 text-white/75",
                  )}
                >
                  {keyword}
                </span>
              ))}
            </div>
          )}
        </SectionCard>

        <SectionCard title="SEO Opportunities" eyebrow="Future-Ready" isLightTheme={isLightTheme}>
          <div className="space-y-4">
            <div className={classNames("rounded-2xl border p-4", isLightTheme ? "border-slate-200 bg-slate-50" : "border-white/10 bg-white/5")}>
              <p className={classNames("text-sm font-medium", isLightTheme ? "text-slate-900" : "text-white")}>
                Content gap review placeholder
              </p>
              <p className={classNames("mt-2 text-sm", isLightTheme ? "text-slate-600" : "text-white/60")}>
                Reserve this section for future comparisons between tracked keywords, landing pages, and conversion performance.
              </p>
            </div>
            <div className={classNames("rounded-2xl border p-4", isLightTheme ? "border-slate-200 bg-slate-50" : "border-white/10 bg-white/5")}>
              <p className={classNames("text-sm font-medium", isLightTheme ? "text-slate-900" : "text-white")}>
                Metadata coverage status
              </p>
              <p className={classNames("mt-2 text-sm", isLightTheme ? "text-slate-600" : "text-white/60")}>
                {data?.settings.length ?? 0} saved SEO rows across {SEO_PAGE_OPTIONS.length} mapped page targets.
              </p>
            </div>
            <div className={classNames("rounded-2xl border p-4", isLightTheme ? "border-slate-200 bg-slate-50" : "border-white/10 bg-white/5")}>
              <p className={classNames("text-sm font-medium", isLightTheme ? "text-slate-900" : "text-white")}>
                Analytics join point
              </p>
              <p className={classNames("mt-2 text-sm", isLightTheme ? "text-slate-600" : "text-white/60")}>
                This module is structured so keyword strategy can later be merged with the Analytics dashboard for page-level
                conversion and campaign visibility.
              </p>
            </div>
          </div>
        </SectionCard>
      </div>
    </div>
  );
}
