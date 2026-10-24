import { useEffect, useState, type FormEvent, type ReactNode } from "react";
import { Link, useParams } from "react-router-dom";
import { getSchemaByReportType, type ReportProductKey } from "@wisdom/utils";
import { usePageMeta } from "../hooks/usePageMeta";
import { fetchGuestIntake, guestIntakePath, submitGuestIntake, type GuestIntakeView } from "../lib/guestIntake";
import { GuestIntakeStatusPage } from "./GuestServicesIntakePage";

/**
 * Guest Divin8 Reports Intake Form (no sign-in). Same fields and validation as the signed-in
 * report form (ReportOrder.tsx) for each report type, minus checkout (already paid) and with no
 * availability step. Single-use: submitting releases the report for preparation.
 */

type FormState = Record<string, string | boolean | string[]>;
type ValidationIssue = { path: Array<string | number>; message: string };

const AREA_OPTIONS = [
  "Career", "Finances", "Relationships", "Health and vitality",
  "Spiritual growth", "Family", "Business", "Personal transformation",
];

function browserTimezone() {
  return Intl.DateTimeFormat().resolvedOptions().timeZone || "America/Vancouver";
}

function fieldClassName(error?: string) {
  return [
    "mt-1 w-full rounded-xl border bg-white/5 px-3 py-2 text-sm text-white/90 placeholder:text-white/35 focus:outline-none focus:ring-1",
    error ? "border-rose-400/60 focus:ring-rose-300/30" : "border-white/15 focus:border-accent-cyan/50 focus:ring-accent-cyan/30",
  ].join(" ");
}

function hasValidationIssues(error: unknown): error is { issues: ValidationIssue[] } {
  return Boolean(error && typeof error === "object" && "issues" in error && Array.isArray((error as { issues?: unknown }).issues));
}

function validationMessages(error: { issues: ValidationIssue[] }) {
  return Object.fromEntries(error.issues.map((issue) => {
    const path = issue.path.join(".");
    return [path.replace(/^person([AB])\.(.)/, (_m: string, p: string, f: string) => `person${p}${f.toUpperCase()}`), issue.message];
  }));
}

function initialForm(email: string, fullName: string): FormState {
  const tz = browserTimezone();
  return {
    fullName, email, phone: "", birthDate: "", birthTime: "", birthPlaceName: "", birthTimezone: tz,
    currentLocation: "", primaryFocus: "", notes: "", question1: "", question2: "", question3: "",
    personAFullName: fullName, personABirthDate: "", personABirthTime: "", personABirthPlaceName: "",
    personABirthTimezone: tz, personACurrentLocation: "",
    personBFullName: "", personBBirthDate: "", personBBirthTime: "", personBBirthPlaceName: "",
    personBBirthTimezone: tz, personBCurrentLocation: "",
    relationshipType: "", relationshipQuestion: "", relationshipStatus: "", desiredFocus: "",
    currentLifeFocus: "", areasOfInterest: [], consentGiven: false,
  };
}

function Label({ label, children, error }: { label: string; children: ReactNode; error?: string }) {
  return (
    <label className="block text-sm text-white/70">
      {label}
      {children}
      {error ? <span className="mt-1 block text-xs text-rose-200">{error}</span> : null}
    </label>
  );
}

export default function GuestReportsIntakePage() {
  const { token = "" } = useParams();
  const [view, setView] = useState<GuestIntakeView | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  usePageMeta({
    title: "Divin8 Reports Intake Form | The Prime Mentor",
    description: "Share your birth details so your Divin8 report can be prepared.",
    canonical: "",
  });

  useEffect(() => {
    let cancelled = false;
    fetchGuestIntake(token)
      .then((next) => { if (!cancelled) setView(next); })
      .catch((error: Error) => { if (!cancelled) setLoadError(error.message || "This link has expired or is no longer valid."); });
    return () => { cancelled = true; };
  }, [token]);

  if (loadError) {
    return (
      <GuestIntakeStatusPage title="This link has expired or is no longer valid">
        <p>Use the most recent link in your confirmation email, or open your order page to get a fresh one.</p>
        <p>Still stuck? <Link to="/contact" className="underline">Contact us</Link>.</p>
      </GuestIntakeStatusPage>
    );
  }
  if (!view) {
    return (
      <main className="flex min-h-[60vh] items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-white/20 border-t-white" />
      </main>
    );
  }
  if (view.kind !== "reports") {
    return (
      <GuestIntakeStatusPage title="This link is for the Services Intake Form">
        <p>Your order is a session or package, so it uses the services form.</p>
        <Link to={guestIntakePath("services", token)} className="mt-4 inline-flex rounded-xl bg-gradient-to-r from-cyan-500 via-sky-500 to-indigo-500 px-5 py-3 text-sm font-semibold text-slate-950">
          Open the Services Intake Form
        </Link>
      </GuestIntakeStatusPage>
    );
  }
  if (done || view.intakeStatus === "submitted") {
    return (
      <GuestIntakeStatusPage title={done ? "Thank you — we have your intake form" : "We already have your intake form"}>
        <p>Your {view.productLabel} is now being prepared. We'll email you as soon as it's ready.</p>
        <p className="text-sm">Need to change something? Reply to your confirmation email or <Link to="/contact" className="underline">contact us</Link>.</p>
      </GuestIntakeStatusPage>
    );
  }
  return <ReportsIntakeForm token={token} view={view} onDone={() => setDone(true)} />;
}

function ReportsIntakeForm({ token, view, onDone }: { token: string; view: GuestIntakeView; onDone: () => void }) {
  const reportType = (view.report?.reportType ?? "") as ReportProductKey;
  const [form, setForm] = useState<FormState>(() => initialForm(view.email ?? "", view.fullName ?? ""));
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [message, setMessage] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [website, setWebsite] = useState("");

  function update(field: string, value: string | boolean | string[]) {
    setForm((current) => ({ ...current, [field]: value }));
    setErrors((current) => {
      const next = { ...current };
      delete next[field];
      return next;
    });
  }

  function person(prefix: "personA" | "personB") {
    return {
      fullName: String(form[`${prefix}FullName`]),
      birthDate: String(form[`${prefix}BirthDate`]),
      birthTime: String(form[`${prefix}BirthTime`]),
      birthPlaceName: String(form[`${prefix}BirthPlaceName`]),
      birthTimezone: String(form[`${prefix}BirthTimezone`]),
      currentLocation: String(form[`${prefix}CurrentLocation`]),
    };
  }

  function buildPayload(): Record<string, unknown> {
    if (reportType === "compatibility") {
      return {
        reportType, email: String(form.email), phone: String(form.phone),
        personA: person("personA"), personB: person("personB"),
        relationshipType: String(form.relationshipType), relationshipQuestion: String(form.relationshipQuestion),
        relationshipStatus: String(form.relationshipStatus), desiredFocus: String(form.desiredFocus),
        consentGiven: Boolean(form.consentGiven),
      };
    }
    const base: Record<string, unknown> = {
      reportType, fullName: String(form.fullName), email: String(form.email), phone: String(form.phone),
      birthDate: String(form.birthDate), birthTime: String(form.birthTime), birthPlaceName: String(form.birthPlaceName),
      birthTimezone: String(form.birthTimezone), currentLocation: String(form.currentLocation),
      primaryFocus: String(form.primaryFocus), notes: String(form.notes), consentGiven: Boolean(form.consentGiven),
    };
    if (reportType === "three_questions") {
      return { ...base, question1: String(form.question1), question2: String(form.question2), question3: String(form.question3) };
    }
    if (reportType === "annual_12_month") {
      return { ...base, currentLifeFocus: String(form.currentLifeFocus), areasOfInterest: Array.isArray(form.areasOfInterest) ? form.areasOfInterest : [] };
    }
    return base;
  }

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    if (submitting) return;
    setMessage(null);
    setErrors({});
    const payload = buildPayload();
    try {
      getSchemaByReportType(reportType).parse(payload);
    } catch (error) {
      if (hasValidationIssues(error)) {
        setErrors(validationMessages(error));
        setMessage("Please complete the highlighted fields.");
        return;
      }
      throw error;
    }
    setSubmitting(true);
    try {
      const { reportType: _ignored, email: _email, ...fields } = payload;
      await submitGuestIntake(token, { ...fields, kind: "reports", website: website || undefined });
      onDone();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "We couldn't save your intake form. Please try again.");
    } finally {
      setSubmitting(false);
    }
  }

  function singlePerson(prefix = "") {
    const key = (name: string) => (prefix ? `${prefix}${name.charAt(0).toUpperCase()}${name.slice(1)}` : name);
    const err = (name: string) => errors[key(name)] ?? (prefix ? undefined : errors[name]);
    return (
      <div className="grid gap-4 md:grid-cols-2">
        <Label label="Full name" error={err("fullName")}>
          <input className={fieldClassName(err("fullName"))} value={String(form[key("fullName")] ?? "")} onChange={(e) => update(key("fullName"), e.target.value)} />
        </Label>
        <Label label="Birth date" error={err("birthDate")}>
          <input type="date" className={fieldClassName(err("birthDate"))} value={String(form[key("birthDate")] ?? "")} onChange={(e) => update(key("birthDate"), e.target.value)} />
        </Label>
        <Label label="Birth time, if known">
          <input type="time" className={fieldClassName()} value={String(form[key("birthTime")] ?? "")} onChange={(e) => update(key("birthTime"), e.target.value)} />
        </Label>
        <Label label="Birth location" error={err("birthPlaceName")}>
          <input className={fieldClassName(err("birthPlaceName"))} placeholder="City, region, country" value={String(form[key("birthPlaceName")] ?? "")} onChange={(e) => update(key("birthPlaceName"), e.target.value)} />
        </Label>
        <Label label="Birth timezone">
          <input className={fieldClassName()} value={String(form[key("birthTimezone")] ?? "")} onChange={(e) => update(key("birthTimezone"), e.target.value)} />
        </Label>
        <Label label="Current location, optional">
          <input className={fieldClassName()} value={String(form[key("currentLocation")] ?? "")} onChange={(e) => update(key("currentLocation"), e.target.value)} />
        </Label>
      </div>
    );
  }

  function productFields() {
    if (reportType === "three_questions") {
      return (
        <div className="space-y-4">
          {[1, 2, 3].map((n) => (
            <Label key={n} label={`Question ${n}`} error={errors[`question${n}`]}>
              <textarea className={`${fieldClassName(errors[`question${n}`])} min-h-24`} value={String(form[`question${n}`] ?? "")} onChange={(e) => update(`question${n}`, e.target.value)} />
            </Label>
          ))}
        </div>
      );
    }
    if (reportType === "compatibility") {
      return (
        <div className="space-y-8">
          <div><h3 className="mb-3 text-sm font-medium uppercase tracking-[0.16em] text-white/45">Person A</h3>{singlePerson("personA")}</div>
          <div><h3 className="mb-3 text-sm font-medium uppercase tracking-[0.16em] text-white/45">Person B</h3>{singlePerson("personB")}</div>
          <div className="grid gap-4 md:grid-cols-2">
            <Label label="Relationship type" error={errors.relationshipType}>
              <select className={fieldClassName(errors.relationshipType)} value={String(form.relationshipType)} onChange={(e) => update("relationshipType", e.target.value)}>
                <option value="">Select one</option>
                <option value="romantic">Romantic</option>
                <option value="business">Business</option>
                <option value="creative_partnership">Creative partnership</option>
                <option value="friendship">Friendship</option>
                <option value="family">Family</option>
                <option value="other">Other</option>
              </select>
            </Label>
            <Label label="Current status, optional">
              <input className={fieldClassName()} value={String(form.relationshipStatus)} onChange={(e) => update("relationshipStatus", e.target.value)} />
            </Label>
          </div>
          <Label label="Main question or desired focus, optional">
            <textarea className={`${fieldClassName()} min-h-24`} value={String(form.desiredFocus)} onChange={(e) => update("desiredFocus", e.target.value)} />
          </Label>
        </div>
      );
    }
    if (reportType === "annual_12_month") {
      return (
        <div className="space-y-4">
          <Label label="Current major life focus, optional">
            <textarea className={`${fieldClassName()} min-h-24`} value={String(form.currentLifeFocus)} onChange={(e) => update("currentLifeFocus", e.target.value)} />
          </Label>
          <div>
            <p className="text-sm text-white/70">Areas of interest</p>
            <div className="mt-2 grid gap-2 sm:grid-cols-2">
              {AREA_OPTIONS.map((area) => {
                const current = Array.isArray(form.areasOfInterest) ? form.areasOfInterest : [];
                return (
                  <label key={area} className="flex items-center gap-2 rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-sm text-white/75">
                    <input type="checkbox" checked={current.includes(area)} onChange={(e) => update("areasOfInterest", e.target.checked ? [...current, area] : current.filter((a) => a !== area))} />
                    {area}
                  </label>
                );
              })}
            </div>
          </div>
        </div>
      );
    }
    return (
      <Label label="Primary focus, optional">
        <select className={fieldClassName()} value={String(form.primaryFocus)} onChange={(e) => update("primaryFocus", e.target.value)}>
          <option value="">No specific focus</option>
          <option value="purpose">Purpose and direction</option>
          <option value="relationships">Relationships</option>
          <option value="career">Career and work</option>
          <option value="finance">Finance</option>
          <option value="health">Health and vitality</option>
          <option value="timing">Timing and next season</option>
          <option value="spiritual">Spiritual growth</option>
        </select>
      </Label>
    );
  }

  return (
    <div className="mx-auto max-w-4xl px-6 py-10 text-white">
      <section className="glass-card rounded-3xl p-6 sm:p-8">
        <p className="text-xs font-medium uppercase tracking-[0.24em] text-accent-cyan">Divin8 Reports Intake Form</p>
        <h1 className="mt-3 text-3xl font-semibold">{view.productLabel}</h1>
        <p className="mt-3 text-sm leading-7 text-white/70">
          Thank you for your purchase. Share your birth details below and we'll start preparing your report. No account or scheduling needed.
        </p>
        {view.paymentStatus !== "paid" ? (
          <p className="mt-2 text-xs text-amber-100/80">Your payment is still being confirmed — you can fill this in now.</p>
        ) : null}
      </section>

      <form onSubmit={(event) => void handleSubmit(event)} noValidate className="glass-card mt-6 space-y-8 rounded-3xl p-6 sm:p-8">
        <section>
          <h2 className="text-lg font-medium text-white">{reportType === "compatibility" ? "Compatibility Intake" : "Client Details"}</h2>
          <div className="mt-4 grid gap-4 md:grid-cols-2">
            <Label label="Order email">
              <input className={`${fieldClassName()} opacity-75`} value={String(form.email)} readOnly />
            </Label>
            <Label label={reportType === "compatibility" ? "Phone, optional" : "Phone"} error={errors.phone}>
              <input className={fieldClassName(errors.phone)} value={String(form.phone)} onChange={(e) => update("phone", e.target.value)} />
            </Label>
          </div>
          {reportType !== "compatibility" ? <div className="mt-4">{singlePerson()}</div> : <div className="mt-6">{productFields()}</div>}
        </section>
        {reportType !== "compatibility" ? (
          <section>
            <h2 className="text-lg font-medium text-white">Report Focus</h2>
            <div className="mt-4">{productFields()}</div>
          </section>
        ) : null}

        <div aria-hidden="true" className="absolute left-[-9999px] top-auto h-0 w-0 overflow-hidden">
          <label htmlFor="gr-website">Website</label>
          <input id="gr-website" type="text" tabIndex={-1} autoComplete="off" value={website} onChange={(e) => setWebsite(e.target.value)} />
        </div>

        <section>
          {reportType !== "compatibility" ? (
            <Label label="Additional notes, optional">
              <textarea className={`${fieldClassName()} min-h-24`} value={String(form.notes)} onChange={(e) => update("notes", e.target.value)} />
            </Label>
          ) : null}
          <label className="mt-4 flex items-start gap-3 rounded-xl border border-white/10 bg-white/5 p-3 text-sm text-white/75">
            <input type="checkbox" checked={Boolean(form.consentGiven)} onChange={(e) => update("consentGiven", e.target.checked)} />
            <span>I confirm this information is accurate and consent to having it used to prepare my Divin8 report.</span>
          </label>
          {errors.consentGiven ? <p className="mt-2 text-xs text-rose-200">{errors.consentGiven}</p> : null}
        </section>

        {message ? <div role="alert" className="rounded-xl border border-rose-400/25 bg-rose-950/30 px-4 py-3 text-sm text-rose-100">{message}</div> : null}

        <div className="flex justify-end">
          <button type="submit" disabled={submitting} className="w-full rounded-xl bg-gradient-to-r from-amber-300 to-yellow-500 px-6 py-3 text-sm font-semibold text-slate-950 disabled:opacity-60 sm:w-auto">
            {submitting ? "Saving…" : "Submit intake form"}
          </button>
        </div>
      </form>
    </div>
  );
}
