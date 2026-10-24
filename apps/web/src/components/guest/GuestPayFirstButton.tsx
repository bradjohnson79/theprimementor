import { useState } from "react";
import { useAuth } from "@clerk/react";
import GuestCheckoutModal from "./GuestCheckoutModal";

function browserTimezone() {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC";
  } catch {
    return "UTC";
  }
}

/**
 * "Continue as guest" for pay-first products (sessions, Divin8 reports, Manifestation Monthly).
 * Collects email + optional name, sends the shopper to Stripe, then the guest thank-you page
 * offers the intake form. Hidden for signed-in visitors, who keep their existing flow.
 */
export default function GuestPayFirstButton({
  endpoint,
  extraBody,
  choices,
  choiceLabel,
  itemLabel,
  className,
  label = "Continue as guest",
}: {
  endpoint: string;
  extraBody?: Record<string, unknown>;
  choices?: Array<{ label: string; extraBody: Record<string, unknown> }>;
  choiceLabel?: string;
  itemLabel?: string;
  className?: string;
  label?: string;
}) {
  const { isSignedIn } = useAuth();
  const [open, setOpen] = useState(false);
  if (isSignedIn) return null;
  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className={className ?? "inline-flex min-h-11 items-center justify-center rounded-xl border border-white/20 bg-white/5 px-5 py-3 text-sm font-semibold text-white hover:bg-white/10"}
      >
        {label}
      </button>
      <GuestCheckoutModal
        open={open}
        onClose={() => setOpen(false)}
        endpoint={endpoint}
        extraBody={{
          timezone: browserTimezone(),
          returnPath: typeof window !== "undefined" ? window.location.pathname : undefined,
          ...extraBody,
        }}
        choices={choices}
        choiceLabel={choiceLabel}
        title="Continue as guest"
        itemLabel={itemLabel}
      />
    </>
  );
}
