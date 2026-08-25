import type Stripe from "stripe";

export const SHOP_TEST_SESSION_IDS = {
  body: "cs_test_shop_body",
  mind: "cs_test_shop_mind",
  energy: "cs_test_shop_energy",
  source: "cs_test_shop_source",
  safeguard: "cs_test_shop_safeguard",
  bed: "cs_test_shop_bed",
  unpaid: "cs_test_shop_unpaid",
  canceled: "cs_test_shop_canceled",
  processing: "cs_test_shop_processing",
  missingFulfillment: "cs_test_shop_missing_fulfillment",
  emailFailed: "cs_test_shop_email_failed",
} as const;

export const SHOP_TEST_READY_FIXTURES = [
  {
    key: "body",
    sessionId: SHOP_TEST_SESSION_IDS.body,
    slug: "healing-code-cards-body-deck",
    name: "Healing Code Cards: Body Deck",
    downloadUrl: "https://drive.google.com/drive/folders/1SJw4BK9jWK0yzSol9bdNc6EiVTALMWJK?usp=sharing",
  },
  {
    key: "mind",
    sessionId: SHOP_TEST_SESSION_IDS.mind,
    slug: "healing-code-cards-mind-deck",
    name: "Healing Code Cards: Mind Deck",
    downloadUrl: "https://drive.google.com/drive/folders/1EIBuHMGOcTYsmyZtEa0XHzqJ2zr7mhG1?usp=sharing",
  },
  {
    key: "energy",
    sessionId: SHOP_TEST_SESSION_IDS.energy,
    slug: "healing-code-cards-energy-deck",
    name: "Healing Code Cards: Energy Deck",
    downloadUrl: "https://drive.google.com/drive/folders/1n49uVAUqqze51JAtHZhS1QMdG22yZSJp?usp=sharing",
  },
  {
    key: "source",
    sessionId: SHOP_TEST_SESSION_IDS.source,
    slug: "healing-code-cards-source-deck-body-set",
    name: "Healing Code Cards: Source Deck — Body Set",
    downloadUrl: "https://drive.google.com/drive/folders/12XygFrHVkszd6TFFGmpODWUcs8Tuqdc_?usp=sharing",
  },
  {
    key: "safeguard",
    sessionId: SHOP_TEST_SESSION_IDS.safeguard,
    slug: "digital-safeguard-kit",
    name: "Digital Safeguard Kit",
    downloadUrl: "https://drive.google.com/drive/folders/1VGlbedF6AbqFly5So0Bp1-Xi80HFupyB?usp=sharing",
  },
  {
    key: "bed",
    sessionId: SHOP_TEST_SESSION_IDS.bed,
    slug: "remote-source-bed-kit",
    name: "Remote Source Bed Kit",
    downloadUrl: "https://drive.google.com/file/d/1AzNBGO807C9b_JiIn_ldvSRGr1D37UzW/view?usp=sharing",
  },
] as const;

export interface ShopTestSessionOwner {
  userId: string;
  userEmail: string;
  clerkId: string;
}

type StubKind = "paid" | "unpaid" | "canceled";

const SESSION_KIND: Record<string, StubKind> = {
  [SHOP_TEST_SESSION_IDS.body]: "paid",
  [SHOP_TEST_SESSION_IDS.mind]: "paid",
  [SHOP_TEST_SESSION_IDS.energy]: "paid",
  [SHOP_TEST_SESSION_IDS.source]: "paid",
  [SHOP_TEST_SESSION_IDS.safeguard]: "paid",
  [SHOP_TEST_SESSION_IDS.bed]: "paid",
  [SHOP_TEST_SESSION_IDS.processing]: "paid",
  [SHOP_TEST_SESSION_IDS.missingFulfillment]: "paid",
  [SHOP_TEST_SESSION_IDS.emailFailed]: "paid",
  [SHOP_TEST_SESSION_IDS.unpaid]: "unpaid",
  [SHOP_TEST_SESSION_IDS.canceled]: "canceled",
};

export function retrieveStubbedShopCheckoutSession(
  sessionId: string,
  owner?: ShopTestSessionOwner,
): Stripe.Checkout.Session | null {
  const kind = SESSION_KIND[sessionId];
  if (!kind) return null;

  const status = kind === "canceled" ? "canceled" : "complete";
  const paymentStatus = kind === "paid" ? "paid" : kind === "canceled" ? "unpaid" : "unpaid";

  return {
    id: sessionId,
    object: "checkout.session",
    status,
    payment_status: paymentStatus,
    client_reference_id: null,
    amount_total: 2499,
    currency: "cad",
    metadata: {
      type: "shop",
      userId: owner?.userId ?? "",
      userEmail: owner?.userEmail ?? "",
      clerkId: owner?.clerkId ?? "",
    },
  } as Stripe.Checkout.Session;
}
