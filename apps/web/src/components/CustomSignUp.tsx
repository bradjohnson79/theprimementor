import { useSignUp } from "@clerk/react";
import { useState, useRef, useCallback, useEffect } from "react";
import { Link, useNavigate } from "react-router-dom";
import {
  authCardClass,
  authInputClass,
  authLabelClass,
  authLinkClass,
  authPrimaryButtonClass,
} from "../lib/authFormStyles";

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
  const { signUp, fetchStatus } = useSignUp();
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

  useEffect(() => {
    return () => {
      if (cooldownTimerRef.current) {
        clearInterval(cooldownTimerRef.current);
      }
    };
  }, []);

  function throwIfSignalError(error: unknown) {
    if (error) {
      throw error;
    }
  }

  if (fetchStatus === "fetching") {
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
      const signUpResult = await signUp.password({
        emailAddress: email,
        password,
        firstName: firstName.trim() || undefined,
        lastName: lastName.trim() || undefined,
      });
      throwIfSignalError(signUpResult.error);
      console.log("CLERK_FLOW", { step: "signup_created" });

      if (verificationStartedRef.current) {
        console.log("CLERK_FLOW", { step: "verification_skipped_duplicate" });
        setPendingVerification(true);
        return;
      }

      verificationStartedRef.current = true;
      const emailCodeResult = await signUp.verifications.sendEmailCode();
      throwIfSignalError(emailCodeResult.error);
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
      const verificationResult = await signUp.verifications.verifyEmailCode({ code });
      throwIfSignalError(verificationResult.error);

      if (signUp.status === "complete") {
        console.log("CLERK_FLOW", { step: "verification_complete" });
        const finalizeResult = await signUp.finalize();
        throwIfSignalError(finalizeResult.error);
        navigate(redirectUrl || "/dashboard", { replace: true });
      } else {
        setError("Verification incomplete. Please try again.");
        console.log("CLERK_FLOW", { step: "verification_incomplete", status: signUp.status });
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
      const resendResult = await signUp.verifications.sendEmailCode();
      throwIfSignalError(resendResult.error);
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

  if (pendingVerification) {
    return (
      <div className={authCardClass}>
        <div className="text-center">
          <h2 className="text-xl font-semibold text-slate-900">Verify your email</h2>
          <p className="mt-2 text-sm text-slate-600">
            We sent a verification code to <span className="font-medium text-slate-800">{email}</span>
          </p>
        </div>

        {error && (
          <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
            {error}
          </div>
        )}

        {resendNotice && (
          <div className="rounded-lg border border-cyan-200 bg-cyan-50 px-4 py-3 text-sm text-cyan-800">
            {resendNotice}
          </div>
        )}

        <form onSubmit={handleVerify} className="space-y-4">
          <div>
            <label className={authLabelClass}>Verification Code</label>
            <input
              type="text"
              inputMode="numeric"
              autoComplete="one-time-code"
              value={code}
              onChange={(e) => setCode(e.target.value.replace(/\D/g, "").slice(0, 6))}
              placeholder="Enter 6-digit code"
              className={authInputClass}
              autoFocus
            />
            <p className="mt-1.5 text-xs text-slate-500">
              Enter the most recent code sent to your email. Previous codes will not work.
            </p>
          </div>

          <button
            type="submit"
            disabled={isVerifying || code.length < 6}
            className={authPrimaryButtonClass}
          >
            {isVerifying ? "Verifying..." : "Verify Email"}
          </button>
        </form>

        <div className="text-center">
          <button
            type="button"
            onClick={handleResend}
            disabled={isResending || resendCooldown > 0}
            className="text-xs font-medium text-cyan-700 transition hover:text-cyan-600 disabled:cursor-not-allowed disabled:text-slate-400"
          >
            {isResending
              ? "Sending..."
              : resendCooldown > 0
                ? `Resend code in ${resendCooldown}s`
                : "Didn't receive a code? Resend"}
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className={authCardClass}>
      <div className="text-center">
        <h2 className="text-xl font-semibold text-slate-900">Create your account</h2>
        <p className="mt-2 text-sm text-slate-600">Join The Prime Mentor</p>
      </div>

      {error && (
        <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {error}
        </div>
      )}

      <form onSubmit={handleSignUp} className="space-y-4">
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className={authLabelClass}>First Name</label>
            <input
              type="text"
              value={firstName}
              onChange={(e) => setFirstName(e.target.value)}
              placeholder="First"
              className={authInputClass}
            />
          </div>
          <div>
            <label className={authLabelClass}>Last Name</label>
            <input
              type="text"
              value={lastName}
              onChange={(e) => setLastName(e.target.value)}
              placeholder="Last"
              className={authInputClass}
            />
          </div>
        </div>

        <div>
          <label className={authLabelClass}>Email</label>
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="you@example.com"
            required
            className={authInputClass}
          />
        </div>

        <div>
          <label className={authLabelClass}>Password</label>
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="Create a password"
            required
            className={authInputClass}
          />
        </div>

        <button
          type="submit"
          disabled={isSubmitting || !email || !password}
          className={authPrimaryButtonClass}
        >
          {isSubmitting ? "Creating account..." : "Create Account"}
        </button>
      </form>

      <p className="text-center text-xs text-slate-600">
        Already have an account?{" "}
        <Link to={signInUrl} className={authLinkClass}>
          Sign in
        </Link>
      </p>
    </div>
  );
}
