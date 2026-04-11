import { useEffect, useState } from "react";
import { useAuth } from "@clerk/react";
import { useCurrentUser } from "../hooks/useCurrentUser";
import { api } from "../lib/api";

export default function Contact() {
  const { getToken } = useAuth();
  const { user } = useCurrentUser();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [message, setMessage] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [success, setSuccess] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!email && user?.email) {
      setEmail(user.email);
    }
    if (!name && user?.email) {
      setName(user.email.split("@")[0] ?? "");
    }
  }, [email, name, user?.email]);

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSuccess(null);
    setError(null);

    if (!name.trim() || !email.trim() || !message.trim()) {
      setError("Please complete all fields.");
      return;
    }

    setIsSubmitting(true);
    try {
      const token = await getToken();
      await api.post(
        "/member/contact",
        {
          name: name.trim(),
          email: email.trim(),
          message: message.trim(),
        },
        token,
      );
      setMessage("");
      setSuccess("Your message has been sent.");
    } catch {
      setError("Something went wrong. Please try again.");
    } finally {
      setIsSubmitting(false);
    }
  }

  const fieldClassName =
    "mt-1 w-full rounded-xl border border-white/15 bg-white/5 px-3 py-2 text-sm text-white placeholder:text-white/40 focus:border-accent-cyan/50 focus:outline-none focus:ring-1 focus:ring-accent-cyan/30";

  return (
    <div className="px-8 py-8">
      <div className="mx-auto max-w-3xl">
        <section className="glass-card rounded-2xl p-8">
          <h1 className="text-2xl font-semibold text-white">Contact</h1>

          {success ? (
            <p className="mt-4 rounded-xl border border-emerald-400/25 bg-emerald-950/35 px-4 py-3 text-sm text-emerald-100">
              {success}
            </p>
          ) : null}
          {error ? (
            <p className="mt-4 rounded-xl border border-red-400/30 bg-red-950/40 px-4 py-3 text-sm text-red-200">
              {error}
            </p>
          ) : null}

          <form className="mt-6 space-y-4" onSubmit={handleSubmit}>
            <label className="block text-sm text-white/70">
              Name
              <input
                className={fieldClassName}
                value={name}
                onChange={(event) => setName(event.target.value)}
                placeholder="Your name"
              />
            </label>

            <label className="block text-sm text-white/70">
              Email
              <input
                className={fieldClassName}
                type="email"
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                placeholder="you@example.com"
              />
            </label>

            <label className="block text-sm text-white/70">
              Message
              <textarea
                className={fieldClassName}
                rows={6}
                value={message}
                onChange={(event) => setMessage(event.target.value)}
                placeholder="How can we help?"
              />
            </label>

            <button
              type="submit"
              disabled={isSubmitting}
              className="rounded-xl bg-accent-cyan px-5 py-2.5 text-sm font-medium text-slate-950 transition hover:bg-accent-cyan/90 disabled:cursor-not-allowed disabled:bg-white/20 disabled:text-white/60"
            >
              {isSubmitting ? "Sending..." : "Send message"}
            </button>
          </form>
        </section>
      </div>
    </div>
  );
}
