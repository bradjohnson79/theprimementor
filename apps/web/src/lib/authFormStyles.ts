export const authCardClass =
  "w-full max-w-md space-y-6 rounded-2xl border border-slate-200 bg-white p-8 shadow-[0_24px_80px_rgba(15,23,42,0.14)]";

export const authInputClass =
  "w-full rounded-lg border border-slate-300 bg-white px-4 py-2.5 text-sm text-slate-900 placeholder:text-slate-400 outline-none transition focus:border-cyan-500 focus:ring-4 focus:ring-cyan-100";

export const authLabelClass =
  "mb-1.5 block text-xs font-medium uppercase tracking-[0.08em] text-slate-600";

export const authPrimaryButtonClass =
  "w-full rounded-lg bg-slate-950 px-4 py-2.5 text-sm font-medium text-white transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:bg-slate-300 disabled:text-slate-500";

export const authLinkClass = "font-medium text-cyan-700 transition hover:text-cyan-600";

export const clerkAuthAppearance = {
  variables: {
    colorPrimary: "#0f172a",
    colorText: "#0f172a",
    colorTextSecondary: "#475569",
    colorBackground: "#ffffff",
    colorInputBackground: "#ffffff",
    colorInputText: "#0f172a",
    colorDanger: "#b91c1c",
    borderRadius: "0.75rem",
  },
  elements: {
    rootBox: "w-full max-w-md",
    cardBox: "w-full",
    card: "w-full rounded-2xl border border-slate-200 bg-white p-8 shadow-[0_24px_80px_rgba(15,23,42,0.14)]",
    headerTitle: "text-2xl font-semibold text-slate-900",
    headerSubtitle: "mt-2 text-sm text-slate-600",
    socialButtonsBlockButton:
      "h-11 rounded-lg border border-slate-300 bg-white shadow-none transition hover:bg-slate-50",
    socialButtonsBlockButtonText: "text-sm font-medium text-slate-700",
    dividerLine: "bg-slate-200",
    dividerText: "text-xs font-medium uppercase tracking-[0.08em] text-slate-500",
    formFieldLabel: "mb-1.5 text-xs font-medium uppercase tracking-[0.08em] text-slate-600",
    formFieldInput:
      "h-11 rounded-lg border border-slate-300 bg-white text-slate-900 placeholder:text-slate-400 shadow-none focus:border-cyan-500 focus:ring-4 focus:ring-cyan-100",
    formFieldInputShowPasswordButton: "text-slate-500 hover:text-slate-700",
    formButtonPrimary:
      "h-11 rounded-lg bg-slate-950 text-sm font-medium text-white shadow-none transition hover:bg-slate-800 focus:ring-4 focus:ring-slate-200",
    footerActionText: "text-sm text-slate-600",
    footerActionLink: "font-medium text-cyan-700 hover:text-cyan-600",
    formFieldHintText: "text-xs text-slate-500",
    formFieldErrorText: "text-sm text-red-700",
    formFieldSuccessText: "text-sm text-emerald-700",
    formFieldAction: "font-medium text-cyan-700 hover:text-cyan-600",
    alert: "rounded-lg border border-red-200 bg-red-50",
    alertText: "text-sm text-red-700",
    identityPreviewText: "text-sm text-slate-700",
    identityPreviewEditButton: "font-medium text-cyan-700 hover:text-cyan-600",
    formResendCodeLink: "font-medium text-cyan-700 hover:text-cyan-600",
    otpCodeFieldInput:
      "h-11 rounded-lg border border-slate-300 bg-white text-slate-900 shadow-none focus:border-cyan-500 focus:ring-4 focus:ring-cyan-100",
  },
};
