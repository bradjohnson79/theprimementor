import { useEffect, useState } from "react";
import { api } from "../lib/api";

const BETA_NOTICE_EXPIRES_AT = Date.parse("2026-05-01T07:01:00.000Z");

interface ContactPublicContentProps {
  headingAs?: "h1" | "h2" | "h3";
}

export function ContactPublicContent({ headingAs: Heading = "h1" }: ContactPublicContentProps) {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [message, setMessage] = useState("");
  const [submitted, setSubmitted] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showBetaNotice, setShowBetaNotice] = useState(() => Date.now() < BETA_NOTICE_EXPIRES_AT);

  useEffect(() => {
    if (!showBetaNotice) {
      return;
    }

    const remainingMs = BETA_NOTICE_EXPIRES_AT - Date.now();
    if (remainingMs <= 0) {
      setShowBetaNotice(false);
      return;
    }

    const timeout = window.setTimeout(() => {
      setShowBetaNotice(false);
    }, remainingMs);

    return () => {
      window.clearTimeout(timeout);
    };
  }, [showBetaNotice]);

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSubmitError(null);
    setIsSubmitting(true);

    try {
      await api.post("/contact", { name, email, message });
      setSubmitted(true);
      setName("");
      setEmail("");
      setMessage("");
    } catch (error) {
      setSubmitError(error instanceof Error ? error.message : "Unable to send your message right now.");
    } finally {
      setIsSubmitting(false);
    }
  }

  const fieldClassName =
    "mt-1 w-full rounded-xl border border-white/15 bg-white/5 px-3 py-2.5 text-sm text-white placeholder:text-white/40 focus:border-cyan-400/50 focus:outline-none focus:ring-1 focus:ring-cyan-400/30";

  return (
    <div className="mx-auto max-w-2xl px-6">
      {showBetaNotice ? (
        <div className="mb-6 rounded-2xl border border-amber-300/25 bg-amber-500/10 px-5 py-4 text-sm leading-7 text-amber-50/90">
          <p className="font-semibold uppercase tracking-[0.18em] text-amber-200/90">Beta Site Notice</p>
          <p className="mt-2">
            The Prime Mentor is currently in beta. If you discover any bugs or issues while using the site, please
            contact us here so we can resolve them promptly.
          </p>
        </div>
      ) : null}
      <Heading className="text-3xl font-semibold tracking-tight">Contact</Heading>
      <p className="mt-3 text-sm leading-7 text-white/60">
        Have a question or want to connect? Send us a message and we will get back to you.
      </p>

      {submitted ? (
        <div className="mt-8 rounded-2xl border border-emerald-400/25 bg-emerald-950/30 px-6 py-5 text-sm text-emerald-100">
          Thank you for reaching out. We will be in touch soon.
        </div>
      ) : (
        <form className="mt-8 space-y-5" onSubmit={handleSubmit}>
          {submitError ? (
            <div className="rounded-2xl border border-rose-400/25 bg-rose-950/30 px-4 py-3 text-sm text-rose-100">
              {submitError}
            </div>
          ) : null}
          <label className="block text-sm text-white/70">
            Name
            <input className={fieldClassName} value={name} onChange={(e) => setName(e.target.value)} placeholder="Your name" required disabled={isSubmitting} />
          </label>
          <label className="block text-sm text-white/70">
            Email
            <input className={fieldClassName} type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@example.com" required disabled={isSubmitting} />
          </label>
          <label className="block text-sm text-white/70">
            Message
            <textarea className={fieldClassName} rows={5} value={message} onChange={(e) => setMessage(e.target.value)} placeholder="How can we help?" required disabled={isSubmitting} />
          </label>
          <button
            type="submit"
            disabled={isSubmitting}
            className="rounded-xl bg-cyan-400 px-5 py-2.5 text-sm font-medium text-slate-950 transition hover:bg-cyan-300 disabled:cursor-not-allowed disabled:opacity-70"
          >
            {isSubmitting ? "Sending..." : "Send message"}
          </button>
        </form>
      )}
    </div>
  );
}

export default function ContactPublic() {
  return (
    <div className="bg-[#050510] py-20 text-white">
      <ContactPublicContent />
    </div>
  );
}
