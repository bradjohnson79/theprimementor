import { useSignUp } from "@clerk/react";
import { useState, useRef, useCallback } from "react";
import { Link, useNavigate } from "react-router-dom";

interface CustomSignUpProps {
  redirectUrl?: string;
  signInUrl?: string;
}

const RESEND_COOLDOWN_MS = 60_000;

const CLERK_ERROR_MAP: Record<string, string> = {
  form_code_incorrect: "That code is incorrect. Please check the latest email and try again.",
  verification_expired: "This code has expired. Please request a new one.",
  form_identifier_exists: "An account with this email already exists. Please sign in instead.",
  form_password_pwned: "This password has appeared in a data breach. Please choose a different one.",
  form_password_length_too_short: "Password is too short. Please use at least 8 characters.",
};

function mapClerkError(err: unknown): string {
  const clerkError = err as { errors?: { code?: string; message?: string; longMessage?: string }[] };
  const first = clerkError.errors?.[0];
  if (first?.code && CLERK_ERROR_MAP[first.code]) {
    return CLERK_ERROR_MAP[first.code];
  }
  return first?.longMessage || first?.message || "Something went wrong. Please try again.";
}

export default function CustomSignUp({ redirectUrl, signInUrl = "/sign-in" }: CustomSignUpProps) {
  const { isLoaded, signUp, setActive } = useSignUp();
  const navigate = useNavigate();

  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [code, setCode] = useState("");
  const [error, setError] = useState("");
  const [resendNotice, setResendNotice] = useState("");

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [pendingVerification, setPendingVerification] = useState(false);
  const [isVerifying, setIsVerifying] = useState(false);
  const [resendCooldown, setResendCooldown] = useState(0);
  const [isResending, setIsResending] = useState(false);

  const verificationStartedRef = useRef(false);
  const cooldownTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const startResendCooldown = useCallback(() => {
    setResendCooldown(RESEND_COOLDOWN_MS / 1000);
    if (cooldownTimerRef.current) clearInterval(cooldownTimerRef.current);
    cooldownTimerRef.current = setInterval(() => {
      setResendCooldown((prev) => {
        if (prev <= 1) {
          clearInterval(cooldownTimerRef.current!);
          cooldownTimerRef.current = null;
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
  }, []);

  if (!isLoaded) {
    return (
      <div className="flex min-h-[200px] items-center justify-center">
        <span className="inline-block h-5 w-5 animate-spin rounded-full border-2 border-white/20 border-t-cyan-400" />
      </div>
    );
  }

  async function handleSignUp(e: React.FormEvent) {
    e.preventDefault();
    if (isSubmitting) return;

    setError("");
    setIsSubmitting(true);
    console.log("CLERK_FLOW", { step: "signup_started", email });

    try {
      await signUp!.create({
        emailAddress: email,
        password,
        firstName: firstName.trim() || undefined,
        lastName: lastName.trim() || undefined,
      });
      console.log("CLERK_FLOW", { step: "signup_created" });

      if (verificationStartedRef.current) {
        console.log("CLERK_FLOW", { step: "verification_skipped_duplicate" });
        setPendingVerification(true);
        return;
      }

      verificationStartedRef.current = true;
      await signUp!.prepareEmailAddressVerification({ strategy: "email_code" });
      console.log("CLERK_FLOW", { step: "verification_sent" });

      startResendCooldown();
      setPendingVerification(true);
    } catch (err: unknown) {
      setError(mapClerkError(err));
      console.error("CLERK_FLOW", { step: "signup_error", error: mapClerkError(err) });
    } finally {
      setIsSubmitting(false);
    }
  }

  async function handleVerify(e: React.FormEvent) {
    e.preventDefault();
    if (isVerifying) return;

    setError("");
    setResendNotice("");
    setIsVerifying(true);
    console.log("CLERK_FLOW", { step: "verification_attempt" });

    try {
      const result = await signUp!.attemptEmailAddressVerification({ code });

      if (result.status === "complete") {
        console.log("CLERK_FLOW", { step: "verification_complete" });
        await setActive!({ session: result.createdSessionId });
        navigate(redirectUrl || "/dashboard", { replace: true });
      } else {
        setError("Verification incomplete. Please try again.");
        console.log("CLERK_FLOW", { step: "verification_incomplete", status: result.status });
      }
    } catch (err: unknown) {
      setError(mapClerkError(err));
    } finally {
      setIsVerifying(false);
    }
  }

  async function handleResend() {
    if (isResending || resendCooldown > 0) return;

    setError("");
    setResendNotice("");
    setIsResending(true);
    console.log("CLERK_FLOW", { step: "resend_requested" });

    try {
      await signUp!.prepareEmailAddressVerification({ strategy: "email_code" });
      startResendCooldown();
      setCode("");
      setResendNotice("A new code has been sent. Please check your latest email.");
      console.log("CLERK_FLOW", { step: "resend_complete" });
    } catch (err: unknown) {
      setError(mapClerkError(err));
    } finally {
      setIsResending(false);
    }
  }

  const inputClass =
    "w-full rounded-lg border border-white/15 bg-white/5 px-4 py-2.5 text-sm text-white placeholder:text-white/35 outline-none transition focus:border-cyan-400/50 focus:bg-white/[0.07]";
  const labelClass = "mb-1.5 block text-xs text-white/50";

  if (pendingVerification) {
    return (
      <div className="w-full max-w-sm space-y-6 rounded-2xl border border-white/10 bg-white/[0.03] p-8 backdrop-blur-lg">
        <div className="text-center">
          <h2 className="text-xl font-semibold text-white">Verify your email</h2>
          <p className="mt-2 text-sm text-white/55">
            We sent a verification code to <span className="text-white/80">{email}</span>
          </p>
        </div>

        {error && (
          <div className="rounded-lg border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-400">
            {error}
          </div>
        )}

        {resendNotice && (
          <div className="rounded-lg border border-cyan-500/30 bg-cyan-500/10 px-4 py-3 text-sm text-cyan-300">
            {resendNotice}
          </div>
        )}

        <form onSubmit={handleVerify} className="space-y-4">
          <div>
            <label className={labelClass}>Verification Code</label>
            <input
              type="text"
              inputMode="numeric"
              autoComplete="one-time-code"
              value={code}
              onChange={(e) => setCode(e.target.value.replace(/\D/g, "").slice(0, 6))}
              placeholder="Enter 6-digit code"
              className={inputClass}
              autoFocus
            />
            <p className="mt-1.5 text-xs text-white/35">
              Enter the most recent code sent to your email. Previous codes will not work.
            </p>
          </div>

          <button
            type="submit"
            disabled={isVerifying || code.length < 6}
            className="w-full rounded-lg bg-cyan-500/20 px-4 py-2.5 text-sm font-medium text-cyan-300 transition hover:bg-cyan-500/30 disabled:cursor-not-allowed disabled:opacity-40"
          >
            {isVerifying ? "Verifying..." : "Verify Email"}
          </button>
        </form>

        <div className="text-center">
          <button
            type="button"
            onClick={handleResend}
            disabled={isResending || resendCooldown > 0}
            className="text-xs text-white/40 transition hover:text-white/70 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {isResending
              ? "Sending..."
              : resendCooldown > 0
                ? `Resend code in ${resendCooldown}s`
                : "Didn\u2019t receive a code? Resend"}
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="w-full max-w-sm space-y-6 rounded-2xl border border-white/10 bg-white/[0.03] p-8 backdrop-blur-lg">
      <div className="text-center">
        <h2 className="text-xl font-semibold text-white">Create your account</h2>
        <p className="mt-2 text-sm text-white/55">Join The Prime Mentor</p>
      </div>

      {error && (
        <div className="rounded-lg border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-400">
          {error}
        </div>
      )}

      <form onSubmit={handleSignUp} className="space-y-4">
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className={labelClass}>First Name</label>
            <input
              type="text"
              value={firstName}
              onChange={(e) => setFirstName(e.target.value)}
              placeholder="First"
              className={inputClass}
            />
          </div>
          <div>
            <label className={labelClass}>Last Name</label>
            <input
              type="text"
              value={lastName}
              onChange={(e) => setLastName(e.target.value)}
              placeholder="Last"
              className={inputClass}
            />
          </div>
        </div>

        <div>
          <label className={labelClass}>Email</label>
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="you@example.com"
            required
            className={inputClass}
          />
        </div>

        <div>
          <label className={labelClass}>Password</label>
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="Create a password"
            required
            className={inputClass}
          />
        </div>

        <button
          type="submit"
          disabled={isSubmitting || !email || !password}
          className="w-full rounded-lg bg-cyan-500/20 px-4 py-2.5 text-sm font-medium text-cyan-300 transition hover:bg-cyan-500/30 disabled:cursor-not-allowed disabled:opacity-40"
        >
          {isSubmitting ? "Creating account..." : "Create Account"}
        </button>
      </form>

      <p className="text-center text-xs text-white/40">
        Already have an account?{" "}
        <Link to={signInUrl} className="text-cyan-400 hover:text-cyan-300 transition">
          Sign in
        </Link>
      </p>
    </div>
  );
}
