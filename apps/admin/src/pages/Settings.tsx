import { useAuth, useUser } from "@clerk/react";
import { motion } from "framer-motion";
import { PLATFORM_TIMEZONE, SUPPORTED_LANGUAGES } from "@wisdom/utils";
import {
  useEffect,
  useMemo,
  useState,
  type ChangeEvent,
  type FormEvent,
  type ReactNode,
} from "react";
import { useAdminSettings, type DateFormat, type ThemeMode } from "../context/AdminSettingsContext";
import { useI18n } from "../i18n";
import { api } from "../lib/api";

type SettingsSection = "account" | "security" | "appearance" | "preferences";

interface AccountSummary {
  role: string;
  created_at: string | null;
}

const sectionTabs: Array<{
  id: SettingsSection;
  labelKey: string;
  eyebrowKey: string;
}> = [
  { id: "account", labelKey: "settings.tabs.account", eyebrowKey: "settings.tabs.accountEyebrow" },
  { id: "security", labelKey: "settings.tabs.security", eyebrowKey: "settings.tabs.securityEyebrow" },
  { id: "appearance", labelKey: "settings.tabs.appearance", eyebrowKey: "settings.tabs.appearanceEyebrow" },
  { id: "preferences", labelKey: "settings.tabs.preferences", eyebrowKey: "settings.tabs.preferencesEyebrow" },
];

const dashboardViewOptions = [
  { value: "overview", label: "Overview" },
  { value: "clients", label: "Clients" },
  { value: "bookings", label: "Bookings" },
  { value: "reports", label: "Reports" },
  { value: "payments", label: "Payments" },
] as const;

const dateFormatOptions: Array<{ value: DateFormat; label: string }> = [
  { value: "long", label: "March 19, 2026" },
  { value: "short", label: "03/19/2026" },
  { value: "compact", label: "19 Mar 2026" },
];

const timezoneOptions = [
  PLATFORM_TIMEZONE,
  "America/Vancouver",
  "America/Denver",
  "America/Chicago",
  "America/New_York",
  "Europe/London",
  "Europe/Paris",
  "Asia/Tokyo",
  "Australia/Sydney",
];

function formatDate(
  value: string | Date | null | undefined,
  locale: string,
  timezone: string,
  format: DateFormat,
  includeTime = false,
) {
  if (!value) {
    return "";
  }

  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) {
    return "";
  }

  const formatMap: Record<DateFormat, Intl.DateTimeFormatOptions> = {
    long: { month: "long", day: "numeric", year: "numeric" },
    short: { month: "2-digit", day: "2-digit", year: "numeric" },
    compact: { month: "short", day: "numeric", year: "numeric" },
  };

  const options: Intl.DateTimeFormatOptions = includeTime
    ? { ...formatMap[format], hour: "numeric", minute: "2-digit" }
    : formatMap[format];

  return new Intl.DateTimeFormat(locale, {
    timeZone: timezone,
    ...options,
  }).format(date);
}

function classNames(...values: Array<string | false | null | undefined>) {
  return values.filter(Boolean).join(" ");
}

function SectionCard({
  children,
  isLightTheme,
  className,
}: {
  children: ReactNode;
  isLightTheme: boolean;
  className?: string;
}) {
  return (
    <div
      className={classNames(
        "rounded-2xl border p-6 shadow-sm backdrop-blur-sm transition-colors",
        isLightTheme
          ? "border-slate-200 bg-white shadow-[0_14px_34px_rgba(15,23,42,0.08)]"
          : "border-white/10 bg-white/5 shadow-[0_14px_34px_rgba(2,6,23,0.25)]",
        className,
      )}
    >
      {children}
    </div>
  );
}

function Field({
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

function Toggle({
  checked,
  onChange,
  label,
  hint,
  isLightTheme,
}: {
  checked: boolean;
  onChange: (checked: boolean) => void;
  label: string;
  hint?: string;
  isLightTheme: boolean;
}) {
  return (
    <button
      type="button"
      onClick={() => onChange(!checked)}
      className={classNames(
        "flex w-full items-center justify-between rounded-2xl border px-4 py-3 text-left transition-colors",
        isLightTheme
          ? "border-slate-200 bg-slate-50 hover:bg-slate-100"
          : "border-white/10 bg-white/5 hover:bg-white/10",
      )}
    >
      <span>
        <span className="block text-sm font-medium">{label}</span>
        {hint ? <span className="mt-1 block text-xs opacity-70">{hint}</span> : null}
      </span>
      <span
        className={classNames(
          "relative inline-flex h-7 w-12 items-center rounded-full transition-colors",
          checked ? "bg-accent-cyan" : isLightTheme ? "bg-slate-300" : "bg-white/20",
        )}
      >
        <span
          className={classNames(
            "inline-block h-5 w-5 transform rounded-full bg-white transition-transform",
            checked ? "translate-x-6" : "translate-x-1",
          )}
        />
      </span>
    </button>
  );
}

export default function Settings() {
  const { user, isLoaded } = useUser();
  const { getToken } = useAuth();
  const { settings, resolvedTheme, updateProfile, updateSettings, resetSettings } =
    useAdminSettings();
  const { locale, t } = useI18n();
  const isLightTheme = resolvedTheme === "light";

  const [activeSection, setActiveSection] = useState<SettingsSection>("account");
  const [accountSummary, setAccountSummary] = useState<AccountSummary | null>(null);
  const [accountForm, setAccountForm] = useState<{
    name: string;
    email: string;
    avatarDataUrl: string | null;
  } | null>(null);
  const [accountMessage, setAccountMessage] = useState<string | null>(null);
  const [accountError, setAccountError] = useState<string | null>(null);

  const [passwordForm, setPasswordForm] = useState({
    currentPassword: "",
    newPassword: "",
    confirmPassword: "",
  });
  const [securityMessage, setSecurityMessage] = useState<string | null>(null);
  const [securityError, setSecurityError] = useState<string | null>(null);

  const displayName =
    settings.profile.displayName ||
    [user?.firstName, user?.lastName].filter(Boolean).join(" ").trim() ||
    user?.fullName ||
    "Admin User";
  const displayEmail = settings.profile.email || user?.primaryEmailAddress?.emailAddress || "";
  const displayAvatar = settings.profile.avatarDataUrl || user?.imageUrl || null;

  const availableTimezones = useMemo(() => {
    return Array.from(new Set([settings.timezone, ...timezoneOptions]));
  }, [settings.timezone]);

  const resolvedAccountForm = accountForm ?? {
    name: displayName,
    email: displayEmail,
    avatarDataUrl: settings.profile.avatarDataUrl,
  };

  useEffect(() => {
    let cancelled = false;

    async function loadAccountSummary() {
      try {
        const token = await getToken();
        const response = (await api.get("/me", token)) as AccountSummary;
        if (!cancelled) {
          setAccountSummary(response);
        }
      } catch {
        if (!cancelled) {
          setAccountSummary(null);
        }
      }
    }

    if (isLoaded && user) {
      loadAccountSummary();
    }

    return () => {
      cancelled = true;
    };
  }, [getToken, isLoaded, user]);

  const containerClass = isLightTheme ? "text-slate-900" : "text-white";
  const mutedClass = isLightTheme ? "text-slate-500" : "text-white/60";
  const inputClass = classNames(
    "w-full rounded-xl border px-4 py-3 text-sm outline-none transition-colors",
    isLightTheme
      ? "border-slate-200 bg-white text-slate-900 placeholder:text-slate-400 focus:border-accent-cyan"
      : "border-white/10 bg-white/5 text-white placeholder:text-white/30 focus:border-accent-cyan",
  );
  const selectClass = classNames(
    inputClass,
    "appearance-none pr-10",
    isLightTheme ? "bg-white" : "bg-navy-medium",
  );
  const secondaryButtonClass = classNames(
    "rounded-xl border px-4 py-2.5 text-sm font-medium transition-colors",
    isLightTheme
      ? "border-slate-200 bg-white text-slate-700 hover:bg-slate-50"
      : "border-white/10 bg-white/5 text-white/80 hover:bg-white/10",
  );

  function renderLanguageCard() {
    return (
      <SectionCard isLightTheme={isLightTheme}>
        <div className="flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <p className="text-sm font-medium text-accent-cyan">{t("settings.language.title")}</p>
            <h3 className="mt-2 text-xl font-semibold">{t("settings.language.label")}</h3>
            <p className={classNames("mt-2 max-w-2xl text-sm", mutedClass)}>
              {t("settings.language.description")}
            </p>
          </div>

          <div className="w-full max-w-sm">
            <Field label={t("settings.language.label")} hint={t("settings.language.hint")}>
              <select
                className={selectClass}
                value={settings.language}
                onChange={(event) =>
                  updateSettings({
                    language: event.target.value as (typeof SUPPORTED_LANGUAGES)[number]["code"],
                  })
                }
              >
                {SUPPORTED_LANGUAGES.map((language) => (
                  <option key={language.code} value={language.code}>
                    {language.label}
                  </option>
                ))}
              </select>
            </Field>
          </div>
        </div>
      </SectionCard>
    );
  }

  function handleAccountSave(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setAccountError(null);
    setAccountMessage(null);

    const trimmedName = resolvedAccountForm.name.trim();
    const trimmedEmail = resolvedAccountForm.email.trim();

    if (!trimmedName) {
      setAccountError("Name is required.");
      return;
    }

    if (trimmedEmail && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmedEmail)) {
      setAccountError("Enter a valid email address.");
      return;
    }

    updateProfile({
      displayName: trimmedName,
      email: trimmedEmail,
      avatarDataUrl: resolvedAccountForm.avatarDataUrl,
    });
    setAccountMessage("Account details saved locally and ready for backend sync.");
    setAccountForm(null);
  }

  function handleAvatarUpload(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) {
      return;
    }

    if (!file.type.startsWith("image/")) {
      setAccountError("Please upload an image file for the avatar.");
      return;
    }

    const reader = new FileReader();
    reader.onload = () => {
      const result = typeof reader.result === "string" ? reader.result : null;
      setAccountForm({
        ...resolvedAccountForm,
        avatarDataUrl: result,
      });
      setAccountError(null);
    };
    reader.readAsDataURL(file);
  }

  function handlePasswordSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSecurityError(null);
    setSecurityMessage(null);

    if (!passwordForm.currentPassword || !passwordForm.newPassword || !passwordForm.confirmPassword) {
      setSecurityError("Fill in all password fields.");
      return;
    }

    if (passwordForm.newPassword.length < 8) {
      setSecurityError("New password must be at least 8 characters.");
      return;
    }

    if (passwordForm.newPassword !== passwordForm.confirmPassword) {
      setSecurityError("New password and confirmation must match.");
      return;
    }

    if (passwordForm.currentPassword === passwordForm.newPassword) {
      setSecurityError("Choose a new password that differs from the current one.");
      return;
    }

    setPasswordForm({
      currentPassword: "",
      newPassword: "",
      confirmPassword: "",
    });
    setSecurityMessage("Password change validated. Wire this form to the auth backend when ready.");
  }

  function renderAccountSection() {
    return (
      <div className="space-y-6">
        <SectionCard isLightTheme={isLightTheme}>
          <div className="flex flex-col gap-6 lg:flex-row lg:items-start lg:justify-between">
            <div>
              <p className="text-sm font-medium text-accent-cyan">Account</p>
              <h3 className="mt-2 text-xl font-semibold">Identity and profile</h3>
              <p className={classNames("mt-2 max-w-2xl text-sm", mutedClass)}>
                Manage your admin identity details, avatar preview, and account metadata without
                disturbing the rest of the dashboard.
              </p>
            </div>
            <div className="flex items-center gap-4">
              <div
                className={classNames(
                  "flex h-16 w-16 items-center justify-center overflow-hidden rounded-2xl border",
                  isLightTheme ? "border-slate-200 bg-slate-100" : "border-white/10 bg-white/10",
                )}
              >
                {displayAvatar ? (
                  <img src={displayAvatar} alt="Avatar preview" className="h-full w-full object-cover" />
                ) : (
                  <span className="text-lg font-semibold">{displayName.charAt(0)}</span>
                )}
              </div>
              <div>
                <p className="text-sm font-medium">{displayName}</p>
                <p className={classNames("text-sm", mutedClass)}>{displayEmail || "No email on file"}</p>
              </div>
            </div>
          </div>
        </SectionCard>

        <div className="grid gap-6 xl:grid-cols-[minmax(0,1.35fr)_minmax(320px,0.65fr)]">
          <SectionCard isLightTheme={isLightTheme}>
            <form className="space-y-5" onSubmit={handleAccountSave}>
              <div className="grid gap-5 md:grid-cols-2">
                <Field label="Name" hint="Editable and persisted locally until backend profile sync is connected.">
                  <input
                    className={inputClass}
                    value={resolvedAccountForm.name}
                    onChange={(event) =>
                      setAccountForm({
                        ...resolvedAccountForm,
                        name: event.target.value,
                      })
                    }
                    placeholder="Admin name"
                  />
                </Field>

                <Field label="Email" hint="Editable with validation. Keep it aligned with your auth provider later.">
                  <input
                    className={inputClass}
                    value={resolvedAccountForm.email}
                    onChange={(event) =>
                      setAccountForm({
                        ...resolvedAccountForm,
                        email: event.target.value,
                      })
                    }
                    placeholder="name@example.com"
                  />
                </Field>
              </div>

              <div className="grid gap-5 md:grid-cols-2">
                <Field label="Role" hint="Read-only for this pass.">
                  <input className={inputClass} value={accountSummary?.role || "admin"} disabled />
                </Field>

                <Field label="Avatar upload" hint="Optional. PNG or JPG works best.">
                  <div className="flex items-center gap-3">
                    <input
                      className={classNames(inputClass, "file:mr-4 file:rounded-lg file:border-0 file:bg-accent-cyan/15 file:px-3 file:py-2 file:text-sm file:font-medium file:text-accent-cyan")}
                      type="file"
                      accept="image/*"
                      onChange={handleAvatarUpload}
                    />
                    {resolvedAccountForm.avatarDataUrl ? (
                      <button
                        type="button"
                        className={secondaryButtonClass}
                        onClick={() => setAccountForm({ ...resolvedAccountForm, avatarDataUrl: null })}
                      >
                        Remove
                      </button>
                    ) : null}
                  </div>
                </Field>
              </div>

              {accountError ? (
                <div
                  className={classNames(
                    "rounded-xl border px-4 py-3 text-sm",
                    isLightTheme
                      ? "border-rose-200 bg-rose-50 text-rose-700"
                      : "border-rose-500/30 bg-rose-500/10 text-rose-100",
                  )}
                >
                  {accountError}
                </div>
              ) : null}

              {accountMessage ? (
                <div
                  className={classNames(
                    "rounded-xl border px-4 py-3 text-sm",
                    isLightTheme
                      ? "border-emerald-200 bg-emerald-50 text-emerald-700"
                      : "border-emerald-500/30 bg-emerald-500/10 text-emerald-100",
                  )}
                >
                  {accountMessage}
                </div>
              ) : null}

              <div className="flex flex-wrap gap-3">
                <button
                  type="submit"
                  className="rounded-xl bg-accent-cyan px-4 py-2.5 text-sm font-semibold text-slate-950 transition hover:brightness-110"
                >
                  Save account changes
                </button>
                <button
                  type="button"
                  className={secondaryButtonClass}
                  onClick={() => setAccountForm(null)}
                >
                  Reset form
                </button>
              </div>
            </form>
          </SectionCard>

          <SectionCard isLightTheme={isLightTheme}>
            <h4 className="text-sm font-semibold uppercase tracking-[0.18em] text-accent-cyan">
              Account activity
            </h4>
            <div className="mt-5 space-y-4">
              <div
                className={classNames(
                  "rounded-2xl border p-4",
                  isLightTheme ? "border-slate-200 bg-slate-50" : "border-white/10 bg-white/5",
                )}
              >
                <p className={classNames("text-xs uppercase tracking-[0.18em]", mutedClass)}>Last login</p>
                <p className="mt-2 text-base font-semibold">
                  {formatDate(user?.lastSignInAt ?? null, locale, settings.timezone, settings.dateFormat, true) || t("common.unavailable")}
                </p>
              </div>
              <div
                className={classNames(
                  "rounded-2xl border p-4",
                  isLightTheme ? "border-slate-200 bg-slate-50" : "border-white/10 bg-white/5",
                )}
              >
                <p className={classNames("text-xs uppercase tracking-[0.18em]", mutedClass)}>
                  Account created
                </p>
                <p className="mt-2 text-base font-semibold">
                  {formatDate(
                    accountSummary?.created_at ?? user?.createdAt ?? null,
                    locale,
                    settings.timezone,
                    settings.dateFormat,
                    true,
                  ) || t("common.unavailable")}
                </p>
              </div>
              <div
                className={classNames(
                  "rounded-2xl border p-4",
                  isLightTheme ? "border-slate-200 bg-slate-50" : "border-white/10 bg-white/5",
                )}
              >
                <p className={classNames("text-xs uppercase tracking-[0.18em]", mutedClass)}>
                  Current timezone
                </p>
                <p className="mt-2 text-base font-semibold">{settings.timezone}</p>
              </div>
            </div>
          </SectionCard>
        </div>
      </div>
    );
  }

  function renderSecuritySection() {
    return (
      <div className="space-y-6">
        <SectionCard isLightTheme={isLightTheme}>
          <p className="text-sm font-medium text-accent-cyan">Security</p>
          <h3 className="mt-2 text-xl font-semibold">Protect your admin access</h3>
          <p className={classNames("mt-2 max-w-2xl text-sm", mutedClass)}>
            Tighten password flows, prepare 2FA, and stage session controls for future backend
            session revocation.
          </p>
        </SectionCard>

        <div className="grid gap-6 xl:grid-cols-[minmax(0,1.15fr)_minmax(320px,0.85fr)]">
          <SectionCard isLightTheme={isLightTheme}>
            <form className="space-y-5" onSubmit={handlePasswordSubmit}>
              <Field label="Current password">
                <input
                  type="password"
                  className={inputClass}
                  value={passwordForm.currentPassword}
                  onChange={(event) =>
                    setPasswordForm((current) => ({
                      ...current,
                      currentPassword: event.target.value,
                    }))
                  }
                  placeholder="Current password"
                />
              </Field>

              <div className="grid gap-5 md:grid-cols-2">
                <Field label="New password" hint="At least 8 characters.">
                  <input
                    type="password"
                    className={inputClass}
                    value={passwordForm.newPassword}
                    onChange={(event) =>
                      setPasswordForm((current) => ({
                        ...current,
                        newPassword: event.target.value,
                      }))
                    }
                    placeholder="New password"
                  />
                </Field>

                <Field label="Confirm password">
                  <input
                    type="password"
                    className={inputClass}
                    value={passwordForm.confirmPassword}
                    onChange={(event) =>
                      setPasswordForm((current) => ({
                        ...current,
                        confirmPassword: event.target.value,
                      }))
                    }
                    placeholder="Confirm new password"
                  />
                </Field>
              </div>

              {securityError ? (
                <div
                  className={classNames(
                    "rounded-xl border px-4 py-3 text-sm",
                    isLightTheme
                      ? "border-rose-200 bg-rose-50 text-rose-700"
                      : "border-rose-500/30 bg-rose-500/10 text-rose-100",
                  )}
                >
                  {securityError}
                </div>
              ) : null}

              {securityMessage ? (
                <div
                  className={classNames(
                    "rounded-xl border px-4 py-3 text-sm",
                    isLightTheme
                      ? "border-emerald-200 bg-emerald-50 text-emerald-700"
                      : "border-emerald-500/30 bg-emerald-500/10 text-emerald-100",
                  )}
                >
                  {securityMessage}
                </div>
              ) : null}

              <div className="flex flex-wrap gap-3">
                <button
                  type="submit"
                  className="rounded-xl bg-accent-cyan px-4 py-2.5 text-sm font-semibold text-slate-950 transition hover:brightness-110"
                >
                  Update password
                </button>
                <button
                  type="button"
                  className={secondaryButtonClass}
                  onClick={() =>
                    setPasswordForm({
                      currentPassword: "",
                      newPassword: "",
                      confirmPassword: "",
                    })
                  }
                >
                  Clear form
                </button>
              </div>
            </form>
          </SectionCard>

          <div className="space-y-6">
            <SectionCard isLightTheme={isLightTheme}>
              <Toggle
                checked={settings.twoFactorEnabled}
                onChange={(checked) => updateSettings({ twoFactorEnabled: checked })}
                label="Enable 2FA"
                hint="UI-only stub for this pass. Keep the toggle ready for real factor enrollment."
                isLightTheme={isLightTheme}
              />
            </SectionCard>

            <SectionCard isLightTheme={isLightTheme}>
              <h4 className="text-sm font-semibold uppercase tracking-[0.18em] text-accent-cyan">
                Session controls
              </h4>
              <p className={classNames("mt-3 text-sm", mutedClass)}>
                Global device revocation is staged here so it can be wired to Clerk session
                invalidation without changing the UI later.
              </p>
              <button
                type="button"
                className={classNames(
                  "mt-5 w-full rounded-xl px-4 py-3 text-sm font-semibold transition-colors",
                  isLightTheme
                    ? "bg-slate-900 text-white hover:bg-slate-800"
                    : "bg-white text-slate-950 hover:bg-slate-100",
                )}
                onClick={() =>
                  setSecurityMessage(
                    "Log-out-of-all-devices is staged in the UI and ready for Clerk session revocation wiring.",
                  )
                }
              >
                Log out of all devices
              </button>
            </SectionCard>
          </div>
        </div>
      </div>
    );
  }

  function renderAppearanceSection() {
    const previewIsLight = resolvedTheme === "light";
    const themeOptions: Array<{ value: ThemeMode; label: string; description: string }> = [
      { value: "dark", label: t("settings.theme.dark"), description: t("settings.theme.darkDescription") },
      { value: "light", label: t("settings.theme.light"), description: t("settings.theme.lightDescription") },
      { value: "system", label: t("settings.theme.system"), description: t("settings.theme.systemDescription") },
    ];

    return (
      <div className="space-y-6">
        <SectionCard isLightTheme={isLightTheme}>
          <p className="text-sm font-medium text-accent-cyan">{t("settings.appearance.title")}</p>
          <h3 className="mt-2 text-xl font-semibold">{t("settings.appearance.subtitle")}</h3>
          <p className={classNames("mt-2 max-w-2xl text-sm", mutedClass)}>{t("settings.appearance.description")}</p>
        </SectionCard>

        <div className="grid gap-6 xl:grid-cols-[minmax(0,1.05fr)_minmax(320px,0.95fr)]">
          <SectionCard isLightTheme={isLightTheme}>
            <div className="grid gap-4">
              {themeOptions.map((option) => {
                const active = settings.themeMode === option.value;
                return (
                  <button
                    key={option.value}
                    type="button"
                    onClick={() => updateSettings({ themeMode: option.value })}
                    className={classNames(
                      "rounded-2xl border px-5 py-4 text-left transition-all",
                      active
                        ? "border-accent-cyan bg-accent-cyan/10"
                        : isLightTheme
                          ? "border-slate-200 bg-slate-50 hover:border-slate-300 hover:bg-slate-100"
                          : "border-white/10 bg-white/5 hover:border-white/20 hover:bg-white/10",
                    )}
                  >
                    <div className="flex items-center justify-between gap-3">
                      <div>
                        <p className="text-sm font-semibold">{option.label}</p>
                        <p className={classNames("mt-1 text-sm", mutedClass)}>{option.description}</p>
                      </div>
                      <span
                        className={classNames(
                          "h-3.5 w-3.5 rounded-full border",
                          active
                            ? "border-accent-cyan bg-accent-cyan"
                            : isLightTheme
                              ? "border-slate-300 bg-white"
                              : "border-white/20 bg-transparent",
                        )}
                      />
                    </div>
                  </button>
                );
              })}
            </div>
          </SectionCard>

          <SectionCard isLightTheme={isLightTheme}>
            <h4 className="text-sm font-semibold uppercase tracking-[0.18em] text-accent-cyan">{t("settings.preview.title")}</h4>
            <div className="mt-5 grid gap-4 md:grid-cols-2">
              <div
                className={classNames(
                  "rounded-2xl border p-5",
                  previewIsLight
                    ? "border-slate-200 bg-slate-50 text-slate-900"
                    : "border-white/10 bg-[#0f172a] text-white",
                )}
              >
                <p className="text-sm font-semibold">{t("settings.preview.primarySurface")}</p>
                <p className="mt-2 text-sm opacity-70">{t("settings.preview.primarySurfaceDescription")}</p>
              </div>
              <div
                className={classNames(
                  "rounded-2xl border p-5",
                  previewIsLight
                    ? "border-slate-200 bg-white text-slate-900 shadow-[0_10px_24px_rgba(15,23,42,0.08)]"
                    : "border-white/10 bg-white/5 text-white",
                )}
              >
                <p className="text-sm font-semibold">{t("settings.preview.cardTreatment")}</p>
                <p className="mt-2 text-sm opacity-70">{t("settings.preview.cardTreatmentDescription")}</p>
              </div>
            </div>
            <p className={classNames("mt-5 text-sm", mutedClass)}>
              {t("settings.preview.resolvedTheme")}: <span className="font-semibold capitalize">{resolvedTheme}</span>
            </p>
          </SectionCard>
        </div>
      </div>
    );
  }

  function renderPreferencesSection() {
    return (
      <div className="space-y-6">
        <SectionCard isLightTheme={isLightTheme}>
          <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
            <div>
              <p className="text-sm font-medium text-accent-cyan">{t("settings.preferences.title")}</p>
              <h3 className="mt-2 text-xl font-semibold">{t("settings.preferences.subtitle")}</h3>
              <p className={classNames("mt-2 max-w-2xl text-sm", mutedClass)}>{t("settings.preferences.description")}</p>
            </div>
            <button type="button" className={secondaryButtonClass} onClick={resetSettings}>
              {t("settings.preferences.reset")}
            </button>
          </div>
        </SectionCard>

        <div className="grid gap-6 xl:grid-cols-2">
          <SectionCard isLightTheme={isLightTheme}>
            <h4 className="text-sm font-semibold uppercase tracking-[0.18em] text-accent-cyan">{t("settings.preferences.workspaceDefaults")}</h4>
            <div className="mt-5 space-y-5">
              <Field label={t("settings.preferences.defaultDashboardView")}>
                <select
                  className={selectClass}
                  value={settings.defaultDashboardView}
                  onChange={(event) =>
                    updateSettings({
                      defaultDashboardView: event.target.value as (typeof dashboardViewOptions)[number]["value"],
                    })
                  }
                >
                  {dashboardViewOptions.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
              </Field>

              <Field label={t("settings.preferences.timezone")}>
                <select
                  className={selectClass}
                  value={settings.timezone}
                  onChange={(event) => updateSettings({ timezone: event.target.value })}
                >
                  {availableTimezones.map((timezone) => (
                    <option key={timezone} value={timezone}>
                      {timezone}
                    </option>
                  ))}
                </select>
              </Field>

              <Field label={t("settings.preferences.dateFormat")}>
                <select
                  className={selectClass}
                  value={settings.dateFormat}
                  onChange={(event) =>
                    updateSettings({
                      dateFormat: event.target.value as DateFormat,
                    })
                  }
                >
                  {dateFormatOptions.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
              </Field>

              <Toggle
                checked={settings.autoRefresh}
                onChange={(checked) => updateSettings({ autoRefresh: checked })}
                label={t("settings.preferences.autoRefresh")}
                hint={t("settings.preferences.autoRefreshHint")}
                isLightTheme={isLightTheme}
              />
            </div>
          </SectionCard>

          <SectionCard isLightTheme={isLightTheme}>
            <h4 className="text-sm font-semibold uppercase tracking-[0.18em] text-accent-cyan">{t("settings.preferences.reportDefaults")}</h4>
            <div className="mt-5 space-y-5">
              <Field label={t("settings.preferences.defaultExportFormat")}>
                <select
                  className={selectClass}
                  value={settings.defaultExportFormat}
                  onChange={(event) =>
                    updateSettings({
                      defaultExportFormat: event.target.value as "docx" | "pdf",
                    })
                  }
                >
                  <option value="docx">DOCX</option>
                  <option value="pdf">PDF</option>
                </select>
              </Field>

              <Toggle
                checked={settings.reportAutoSave}
                onChange={(checked) => updateSettings({ reportAutoSave: checked })}
                label={t("settings.preferences.autoSave")}
                hint={t("settings.preferences.autoSaveHint")}
                isLightTheme={isLightTheme}
              />

              <div
                className={classNames(
                  "rounded-2xl border p-4",
                  isLightTheme ? "border-slate-200 bg-slate-50" : "border-white/10 bg-white/5",
                )}
              >
                <p className="text-sm font-medium">{t("settings.preferences.snapshot")}</p>
                <p className={classNames("mt-2 text-sm", mutedClass)}>
                  {t("settings.preferences.snapshotView")}: {dashboardViewOptions.find((option) => option.value === settings.defaultDashboardView)?.label}
                </p>
                <p className={classNames("mt-1 text-sm", mutedClass)}>
                  {t("settings.preferences.snapshotExport")}: {settings.defaultExportFormat.toUpperCase()}
                </p>
                <p className={classNames("mt-1 text-sm", mutedClass)}>
                  {t("settings.preferences.snapshotAutoRefresh")}: {settings.autoRefresh ? t("settings.preferences.on") : t("settings.preferences.off")}
                </p>
              </div>
            </div>
          </SectionCard>
        </div>
      </div>
    );
  }

  const sectionContent: Record<SettingsSection, ReactNode> = {
    account: renderAccountSection(),
    security: renderSecuritySection(),
    appearance: renderAppearanceSection(),
    preferences: renderPreferencesSection(),
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.35 }}
      className={classNames("space-y-6", containerClass)}
    >
      <div>
        <h2 className="text-2xl font-bold">{t("settings.title")}</h2>
        <p className={classNames("mt-1 text-sm", mutedClass)}>
          {t("settings.description")}
        </p>
      </div>

      {renderLanguageCard()}

      <div className="grid gap-6 xl:grid-cols-[280px_minmax(0,1fr)]">
        <SectionCard isLightTheme={isLightTheme} className="h-fit">
          <div className="space-y-2">
            {sectionTabs.map((tab) => {
              const active = activeSection === tab.id;
              return (
                <button
                  key={tab.id}
                  type="button"
                  onClick={() => setActiveSection(tab.id)}
                  className={classNames(
                    "w-full rounded-2xl border px-4 py-4 text-left transition-all",
                    active
                      ? "border-accent-cyan bg-accent-cyan/10"
                      : isLightTheme
                        ? "border-transparent hover:border-slate-200 hover:bg-slate-50"
                        : "border-transparent hover:border-white/10 hover:bg-white/5",
                  )}
                >
                  <p className="text-sm font-semibold">{t(tab.labelKey)}</p>
                  <p className={classNames("mt-1 text-xs", mutedClass)}>{t(tab.eyebrowKey)}</p>
                </button>
              );
            })}
          </div>
        </SectionCard>

        <div className="min-w-0">{sectionContent[activeSection]}</div>
      </div>
    </motion.div>
  );
}
