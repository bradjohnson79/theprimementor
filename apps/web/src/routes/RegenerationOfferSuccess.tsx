import { useEffect, useState } from "react";
import { useAuth } from "@clerk/react";
import { Link, useSearchParams } from "react-router-dom";
import { trackEventOnce } from "../lib/analytics";
import { syncOwnedCheckoutSession } from "../lib/checkoutSessionSync";
import { fetchRegenerationOfferPurchaseStatus } from "../lib/regenerationOffer";

type ConfirmationState = "processing" | "confirmed" | "missing" | "error";

export default function RegenerationOfferSuccess() {
  const { getToken, isSignedIn } = useAuth();
  const [searchParams] = useSearchParams();
  const checkoutSessionId = searchParams.get("checkoutSessionId")?.trim() ?? "";
  const [state, setState] = useState<ConfirmationState>("processing");
  const [message, setMessage] = useState("Payment received — confirmation is being processed.");

  useEffect(() => {
    if (!checkoutSessionId) {
      setState("missing");
      setMessage("Payment received — confirmation is being processed. If this page was opened manually, please check your email for confirmation.");
      return;
    }
    if (!isSignedIn) {
      setState("processing");
      setMessage("Payment received — please sign in with the purchasing account so we can confirm the order status.");
      return;
    }

    let cancelled = false;

    async function confirmPurchase() {
      try {
        const token = await getToken();
        await syncOwnedCheckoutSession({
          token,
          checkoutSessionId,
          entityType: "regeneration_offer",
          entityId: null,
        });

        for (let attempt = 0; attempt < 6; attempt += 1) {
          if (cancelled) return;
          const result = await fetchRegenerationOfferPurchaseStatus(token, checkoutSessionId);
          if (result.status?.completed) {
            setState("confirmed");
            setMessage("Payment confirmed. Your Regeneration Q&A Package order has been received.");
            trackEventOnce(`analytics:regeneration-offer:${result.status.orderId}`, "purchase", {
              source: "regeneration_offer_checkout_success",
              productType: "regeneration_offer",
              orderId: result.status.orderId,
            });
            return;
          }
          await new Promise((resolve) => window.setTimeout(resolve, 1500));
        }

        if (!cancelled) {
          setState("processing");
          setMessage("Payment received — confirmation is being processed. Your order will appear once Stripe finishes syncing.");
        }
      } catch (err) {
        if (!cancelled) {
          setState("error");
          setMessage(err instanceof Error ? err.message : "Payment received, but confirmation is still syncing.");
        }
      }
    }

    void confirmPurchase();
    return () => {
      cancelled = true;
    };
  }, [checkoutSessionId, getToken, isSignedIn]);

  return (
    <div className="mx-auto max-w-3xl px-6 py-16 text-white">
      <section className="rounded-[2rem] border border-white/12 bg-white/[0.055] p-8 shadow-[0_28px_80px_rgba(0,0,0,0.32)] backdrop-blur-xl">
        <p className="text-[0.72rem] font-semibold uppercase tracking-[0.32em] text-amber-100/70">
          Regeneration Q&A Package
        </p>
        <h1 className="mt-4 text-3xl font-semibold tracking-[-0.04em]">
          {state === "confirmed" ? "Order Confirmed" : "Confirmation Processing"}
        </h1>
        <p className="mt-4 text-base leading-8 text-white/68">{message}</p>
        <div className="mt-7 flex flex-col gap-3 sm:flex-row">
          {!isSignedIn ? (
            <Link
              to={`/sign-in?redirect_url=${encodeURIComponent(`/regeneration-offer/success?checkoutSessionId=${checkoutSessionId}`)}`}
              className="inline-flex min-h-12 items-center justify-center rounded-xl bg-amber-300 px-6 py-3 text-sm font-semibold text-slate-950 transition hover:bg-amber-200"
            >
              Sign In to Confirm
            </Link>
          ) : null}
          <Link
            to="/sessions"
            className="inline-flex min-h-12 items-center justify-center rounded-xl border border-white/15 px-6 py-3 text-sm font-semibold text-white transition hover:bg-white/8"
          >
            Go to Sessions
          </Link>
          <Link
            to="/regeneration-offer"
            className="inline-flex min-h-12 items-center justify-center rounded-xl border border-white/15 px-6 py-3 text-sm font-semibold text-white/78 transition hover:bg-white/8 hover:text-white"
          >
            Back to Offer
          </Link>
        </div>
      </section>
    </div>
  );
}
