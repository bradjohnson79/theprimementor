import { useState } from "react";

interface ContactPublicContentProps {
  headingAs?: "h1" | "h2" | "h3";
}

export function ContactPublicContent({ headingAs: Heading = "h1" }: ContactPublicContentProps) {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [message, setMessage] = useState("");
  const [submitted, setSubmitted] = useState(false);

  function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSubmitted(true);
  }

  const fieldClassName =
    "mt-1 w-full rounded-xl border border-white/15 bg-white/5 px-3 py-2.5 text-sm text-white placeholder:text-white/40 focus:border-cyan-400/50 focus:outline-none focus:ring-1 focus:ring-cyan-400/30";

  return (
    <div className="mx-auto max-w-2xl px-6">
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
          <label className="block text-sm text-white/70">
            Name
            <input className={fieldClassName} value={name} onChange={(e) => setName(e.target.value)} placeholder="Your name" required />
          </label>
          <label className="block text-sm text-white/70">
            Email
            <input className={fieldClassName} type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@example.com" required />
          </label>
          <label className="block text-sm text-white/70">
            Message
            <textarea className={fieldClassName} rows={5} value={message} onChange={(e) => setMessage(e.target.value)} placeholder="How can we help?" required />
          </label>
          <button
            type="submit"
            className="rounded-xl bg-cyan-400 px-5 py-2.5 text-sm font-medium text-slate-950 transition hover:bg-cyan-300"
          >
            Send message
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
