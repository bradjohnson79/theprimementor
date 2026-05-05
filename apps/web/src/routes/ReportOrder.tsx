import { useMemo, useState, type ReactNode } from "react";
import { useAuth, useUser } from "@clerk/react";
import { Link, Navigate, useParams } from "react-router-dom";
import {
  getSchemaByReportType,
  isPremiumReportProduct,
  resolveReportProductFromRouteSlug,
  type ReportProductKey,
} from "@wisdom/utils";
import { useCurrentUser } from "../hooks/useCurrentUser";
import { api } from "../lib/api";
import { startReportCheckout } from "../lib/reportCheckout";

type FormState = Record<string, string | boolean | string[]>;
type ValidationIssue = {
  path: Array<string | number>;
  message: string;
};

const AREA_OPTIONS = [
  "Career",
  "Finances",
  "Relationships",
  "Health and vitality",
  "Spiritual growth",
  "Family",
  "Business",
  "Personal transformation",
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
  return Boolean(
    error
      && typeof error === "object"
      && "issues" in error
      && Array.isArray((error as { issues?: unknown }).issues),
  );
}

function validationMessages(error: { issues: ValidationIssue[] }) {
  return Object.fromEntries(error.issues.map((issue) => {
    const path = issue.path.join(".");
    const formPath = path.replace(/^person([AB])\.(.)/, (_match: string, person: string, first: string) => `person${person}${first.toUpperCase()}`);
    return [formPath, issue.message];
  }));
}

function initialForm(email: string, fullName: string): FormState {
  return {
    fullName,
    email,
    phone: "",
    birthDate: "",
    birthTime: "",
    birthPlaceName: "",
    birthTimezone: browserTimezone(),
    currentLocation: "",
    primaryFocus: "",
    notes: "",
    question1: "",
    question2: "",
    question3: "",
    personAFullName: fullName,
    personABirthDate: "",
    personABirthTime: "",
    personABirthPlaceName: "",
    personABirthTimezone: browserTimezone(),
    personACurrentLocation: "",
    personBFullName: "",
    personBBirthDate: "",
    personBBirthTime: "",
    personBBirthPlaceName: "",
    personBBirthTimezone: browserTimezone(),
    personBCurrentLocation: "",
    relationshipType: "",
    relationshipQuestion: "",
    relationshipStatus: "",
    desiredFocus: "",
    currentLifeFocus: "",
    areasOfInterest: [],
    consentGiven: false,
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

export default function ReportOrder() {
  const params = useParams();
  const product = resolveReportProductFromRouteSlug(params.reportType ?? "");
  const { getToken } = useAuth();
  const { user: clerkUser } = useUser();
  const { user: dbUser } = useCurrentUser();
  const email = dbUser?.email || clerkUser?.primaryEmailAddress?.emailAddress || "";
  const fullName = clerkUser?.fullName || "";
  const [form, setForm] = useState<FormState>(() => initialForm(email, fullName));
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [submitting, setSubmitting] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  const reportType = product?.key as ReportProductKey | undefined;
  const resolvedForm = useMemo<FormState>(() => ({
    ...form,
    email: String(form.email || email),
    fullName: String(form.fullName || fullName),
  }), [email, form, fullName]);

  if (!product || !reportType) {
    return <Navigate to="/dashboard/reports/intro" replace />;
  }

  const currentProduct = product;
  const currentReportType = reportType;
  const productTitle = product.displayName;

  function update(field: string, value: string | boolean | string[]) {
    setForm((current) => ({ ...current, [field]: value }));
    setErrors((current) => {
      const next = { ...current };
      delete next[field];
      return next;
    });
  }

  function buildPayload() {
    if (currentReportType === "compatibility") {
      return {
        reportType: currentReportType,
        email: String(resolvedForm.email),
        phone: String(resolvedForm.phone),
        personA: {
          fullName: String(resolvedForm.personAFullName),
          birthDate: String(resolvedForm.personABirthDate),
          birthTime: String(resolvedForm.personABirthTime),
          birthPlaceName: String(resolvedForm.personABirthPlaceName),
          birthTimezone: String(resolvedForm.personABirthTimezone),
          currentLocation: String(resolvedForm.personACurrentLocation),
        },
        personB: {
          fullName: String(resolvedForm.personBFullName),
          birthDate: String(resolvedForm.personBBirthDate),
          birthTime: String(resolvedForm.personBBirthTime),
          birthPlaceName: String(resolvedForm.personBBirthPlaceName),
          birthTimezone: String(resolvedForm.personBBirthTimezone),
          currentLocation: String(resolvedForm.personBCurrentLocation),
        },
        relationshipType: String(resolvedForm.relationshipType),
        relationshipQuestion: String(resolvedForm.relationshipQuestion),
        relationshipStatus: String(resolvedForm.relationshipStatus),
        desiredFocus: String(resolvedForm.desiredFocus),
        consentGiven: Boolean(resolvedForm.consentGiven),
      };
    }

    const base = {
      reportType: currentReportType,
      tier: isPremiumReportProduct(currentProduct) ? currentProduct.tier : undefined,
      fullName: String(resolvedForm.fullName),
      email: String(resolvedForm.email),
      phone: String(resolvedForm.phone),
      birthDate: String(resolvedForm.birthDate),
      birthTime: String(resolvedForm.birthTime),
      birthPlaceName: String(resolvedForm.birthPlaceName),
      birthTimezone: String(resolvedForm.birthTimezone),
      currentLocation: String(resolvedForm.currentLocation),
      primaryFocus: String(resolvedForm.primaryFocus),
      notes: String(resolvedForm.notes),
      consentGiven: Boolean(resolvedForm.consentGiven),
    };

    if (currentReportType === "three_questions") {
      return {
        ...base,
        question1: String(resolvedForm.question1),
        question2: String(resolvedForm.question2),
        question3: String(resolvedForm.question3),
      };
    }
    if (currentReportType === "annual_12_month") {
      return {
        ...base,
        currentLifeFocus: String(resolvedForm.currentLifeFocus),
        areasOfInterest: Array.isArray(resolvedForm.areasOfInterest) ? resolvedForm.areasOfInterest : [],
      };
    }
    return base;
  }

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    setMessage(null);
    setErrors({});
    const payload = buildPayload();
    try {
      getSchemaByReportType(currentReportType).parse(payload);
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
      const token = await getToken();
      const response = await api.post("/member/reports", payload, token) as { reportId?: string };
      if (!response.reportId) {
        throw new Error("Report checkout could not be started.");
      }
      await startReportCheckout(response.reportId, { token });
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Report checkout could not be started.");
    } finally {
      setSubmitting(false);
    }
  }

  function renderSinglePersonFields(prefix = "") {
    const key = (name: string) => prefix ? `${prefix}${name.charAt(0).toUpperCase()}${name.slice(1)}` : name;
    return (
      <div className="grid gap-4 md:grid-cols-2">
        <Label label="Full name" error={errors[key("fullName")] ?? errors.fullName}>
          <input className={fieldClassName(errors[key("fullName")] ?? errors.fullName)} value={String(resolvedForm[key("fullName")] ?? "")} onChange={(event) => update(key("fullName"), event.target.value)} />
        </Label>
        <Label label="Birth date" error={errors[key("birthDate")] ?? errors.birthDate}>
          <input type="date" className={fieldClassName(errors[key("birthDate")] ?? errors.birthDate)} value={String(resolvedForm[key("birthDate")] ?? "")} onChange={(event) => update(key("birthDate"), event.target.value)} />
        </Label>
        <Label label="Birth time, if known">
          <input type="time" className={fieldClassName()} value={String(resolvedForm[key("birthTime")] ?? "")} onChange={(event) => update(key("birthTime"), event.target.value)} />
        </Label>
        <Label label="Birth location" error={errors[key("birthPlaceName")] ?? errors.birthPlaceName}>
          <input className={fieldClassName(errors[key("birthPlaceName")] ?? errors.birthPlaceName)} placeholder="City, region, country" value={String(resolvedForm[key("birthPlaceName")] ?? "")} onChange={(event) => update(key("birthPlaceName"), event.target.value)} />
        </Label>
        <Label label="Birth timezone">
          <input className={fieldClassName()} value={String(resolvedForm[key("birthTimezone")] ?? browserTimezone())} onChange={(event) => update(key("birthTimezone"), event.target.value)} />
        </Label>
        <Label label="Current location, optional">
          <input className={fieldClassName()} value={String(resolvedForm[key("currentLocation")] ?? "")} onChange={(event) => update(key("currentLocation"), event.target.value)} />
        </Label>
      </div>
    );
  }

  function renderProductSpecificFields() {
    if (currentReportType === "three_questions") {
      return (
        <div className="space-y-4">
          {[1, 2, 3].map((questionNumber) => {
            const field = `question${questionNumber}`;
            return (
              <Label key={field} label={`Question ${questionNumber}`} error={errors[field]}>
                <textarea className={`${fieldClassName(errors[field])} min-h-24`} value={String(resolvedForm[field] ?? "")} onChange={(event) => update(field, event.target.value)} />
              </Label>
            );
          })}
        </div>
      );
    }
    if (currentReportType === "compatibility") {
      return (
        <div className="space-y-8">
          <div>
            <h3 className="mb-3 text-sm font-medium uppercase tracking-[0.16em] text-white/45">Person A</h3>
            {renderSinglePersonFields("personA")}
          </div>
          <div>
            <h3 className="mb-3 text-sm font-medium uppercase tracking-[0.16em] text-white/45">Person B</h3>
            {renderSinglePersonFields("personB")}
          </div>
          <div className="grid gap-4 md:grid-cols-2">
            <Label label="Relationship type" error={errors.relationshipType}>
              <select className={fieldClassName(errors.relationshipType)} value={String(resolvedForm.relationshipType)} onChange={(event) => update("relationshipType", event.target.value)}>
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
              <input className={fieldClassName()} value={String(resolvedForm.relationshipStatus)} onChange={(event) => update("relationshipStatus", event.target.value)} />
            </Label>
          </div>
          <Label label="Main question or desired focus, optional">
            <textarea className={`${fieldClassName()} min-h-24`} value={String(resolvedForm.desiredFocus)} onChange={(event) => update("desiredFocus", event.target.value)} />
          </Label>
        </div>
      );
    }
    if (currentReportType === "annual_12_month") {
      return (
        <div className="space-y-4">
          <Label label="Current major life focus, optional">
            <textarea className={`${fieldClassName()} min-h-24`} value={String(resolvedForm.currentLifeFocus)} onChange={(event) => update("currentLifeFocus", event.target.value)} />
          </Label>
          <div>
            <p className="text-sm text-white/70">Areas of interest</p>
            <div className="mt-2 grid gap-2 sm:grid-cols-2">
              {AREA_OPTIONS.map((area) => {
                const selected = Array.isArray(resolvedForm.areasOfInterest) && resolvedForm.areasOfInterest.includes(area);
                return (
                  <label key={area} className="flex items-center gap-2 rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-sm text-white/75">
                    <input
                      type="checkbox"
                      checked={selected}
                      onChange={(event) => {
                        const current = Array.isArray(resolvedForm.areasOfInterest) ? resolvedForm.areasOfInterest : [];
                        update("areasOfInterest", event.target.checked ? [...current, area] : current.filter((item: string) => item !== area));
                      }}
                    />
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
        <select className={fieldClassName()} value={String(resolvedForm.primaryFocus)} onChange={(event) => update("primaryFocus", event.target.value)}>
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
    <div className="mx-auto max-w-4xl px-6 py-10">
      <Link to="/reports" className="text-sm text-accent-cyan hover:text-white">Back to Reports</Link>
      <section className="glass-card mt-4 rounded-3xl p-6 sm:p-8">
        <p className="text-xs font-medium uppercase tracking-[0.24em] text-accent-cyan">{currentProduct.type === "casual" ? "Casual Divin8 Report" : "Premium Divin8 Report"}</p>
        <h1 className="mt-3 text-3xl font-semibold text-white">{productTitle}</h1>
        <p className="mt-3 text-sm leading-7 text-white/70">{currentProduct.shortDescription}</p>
      </section>

      <form onSubmit={(event) => void handleSubmit(event)} className="glass-card mt-6 space-y-8 rounded-3xl p-6 sm:p-8">
        {currentReportType !== "compatibility" ? (
          <>
            <section>
              <h2 className="text-lg font-medium text-white">Client Details</h2>
              <div className="mt-4 grid gap-4 md:grid-cols-2">
                <Label label="Email">
                  <input className={fieldClassName()} value={String(resolvedForm.email)} readOnly />
                </Label>
                <Label label="Phone" error={errors.phone}>
                  <input className={fieldClassName(errors.phone)} value={String(resolvedForm.phone)} onChange={(event) => update("phone", event.target.value)} />
                </Label>
              </div>
              <div className="mt-4">{renderSinglePersonFields()}</div>
            </section>
            <section>
              <h2 className="text-lg font-medium text-white">Report Focus</h2>
              <div className="mt-4">{renderProductSpecificFields()}</div>
            </section>
          </>
        ) : (
          <section>
            <h2 className="text-lg font-medium text-white">Compatibility Intake</h2>
            <div className="mt-4 grid gap-4 md:grid-cols-2">
              <Label label="Account email">
                <input className={fieldClassName()} value={String(resolvedForm.email)} readOnly />
              </Label>
              <Label label="Phone, optional">
                <input className={fieldClassName()} value={String(resolvedForm.phone)} onChange={(event) => update("phone", event.target.value)} />
              </Label>
            </div>
            <div className="mt-6">{renderProductSpecificFields()}</div>
          </section>
        )}

        <section>
          <Label label="Additional notes, optional">
            <textarea className={`${fieldClassName()} min-h-24`} value={String(resolvedForm.notes)} onChange={(event) => update("notes", event.target.value)} />
          </Label>
          <label className="mt-4 flex items-start gap-3 rounded-xl border border-white/10 bg-white/5 p-3 text-sm text-white/75">
            <input type="checkbox" checked={Boolean(resolvedForm.consentGiven)} onChange={(event) => update("consentGiven", event.target.checked)} />
            <span>I confirm this information is accurate and consent to having it used to prepare my Divin8 report.</span>
          </label>
          {errors.consentGiven ? <p className="mt-2 text-xs text-rose-200">{errors.consentGiven}</p> : null}
        </section>

        {message ? <div className="rounded-xl border border-rose-400/25 bg-rose-950/30 px-4 py-3 text-sm text-rose-100">{message}</div> : null}

        <div className="flex flex-col gap-3 sm:flex-row sm:justify-end">
          <Link to="/dashboard" className="rounded-xl border border-white/15 px-4 py-2.5 text-center text-sm text-white/75 hover:bg-white/5">Back to Dashboard</Link>
          <button type="submit" disabled={submitting} className="rounded-xl bg-gradient-to-r from-amber-300 to-yellow-500 px-5 py-2.5 text-sm font-semibold text-slate-950 disabled:cursor-not-allowed disabled:opacity-60">
            {submitting ? "Starting Checkout..." : currentProduct.ctaLabel}
          </button>
        </div>
      </form>
    </div>
  );
}
