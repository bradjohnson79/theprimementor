import { resolveApiUrl } from "./apiBase";

export interface ShopPublicImage {
  id: string;
  url: string;
  altText: string | null;
  isPrimary: boolean;
}

export interface ShopPublicProduct {
  id: string;
  slug: string;
  name: string;
  subtitle?: string | null;
  formatLabel: string;
  quickSummary: string | null;
  fullDescription: string | null;
  includedItems: string | null;
  videoUrl: string | null;
  videoEmbedUrl: string | null;
  videoHeading?: string | null;
  videoIntro?: string | null;
  wellnessNotice: string | null;
  priceCents: number;
  currency: string;
  priceLabel: string;
  featured: boolean;
  sortOrder: number;
  images: ShopPublicImage[];
  hasDownloadFiles: boolean;
  awaitingDeckAssets?: boolean;
  awaitingBooklet?: boolean;
  hasSecureManual?: boolean;
  canPurchase?: boolean;
  publicBooklet?: { displayName: string; url: string } | null;
  purchased: boolean;
  collection?: string | null;
  testimonials?: ShopPublicTestimonial[];
  testimonialSection?: {
    heading: string;
    subtitle?: string | null;
    disclaimer: string;
  } | null;
  relatedProducts?: ShopRelatedProduct[];
}

export interface ShopRelatedProduct {
  id: string;
  slug: string;
  name: string;
  formatLabel: string;
  quickSummary: string | null;
  priceCents: number;
  currency: string;
  priceLabel: string;
  images: ShopPublicImage[];
}

export interface ShopPublicTestimonial {
  id: string;
  customerName: string;
  location: string | null;
  title: string | null;
  testimonialText: string;
  contextLabel: string | null;
  sortOrder: number;
}

export type ShopOrderSuccessState =
  | "ready"
  | "processing"
  | "invalid"
  | "unpaid"
  | "canceled"
  | "missing_fulfillment"
  | "email_failed";

export interface ShopOrderSuccess {
  state: ShopOrderSuccessState;
  productName: string | null;
  formatLabel: string | null;
  productImage: { url: string; altText: string | null } | null;
  orderReference: string | null;
  downloadLabel: string | null;
  downloadUrl: string | null;
  instructions: string | null;
  maskedEmail: string | null;
  emailStatus: "sent" | "failed" | "pending" | "skipped" | null;
  message: string;
}

export interface ShopPurchase {
  entitlementId: string;
  productId: string;
  productName: string;
  slug: string;
  formatLabel: string;
  purchasedAt: string | null;
  awaitingAssets: boolean;
  awaitingDeckAssets?: boolean;
  awaitingBooklet?: boolean;
  files: Array<{
    id: string;
    displayName: string;
    mimeType: string | null;
    sizeBytes: number | null;
    kind: string;
  }>;
}

export function unwrapShopProducts(payload: unknown): ShopPublicProduct[] {
  if (Array.isArray(payload)) return payload as ShopPublicProduct[];
  if (payload && typeof payload === "object" && Array.isArray((payload as { data?: unknown }).data)) {
    return (payload as { data: ShopPublicProduct[] }).data;
  }
  return [];
}

export function shopMediaSrc(url: string) {
  if (url.startsWith("http://") || url.startsWith("https://") || url.startsWith("/shop/")) return url;
  const path = url.replace(/^\/api/, "");
  const normalized = path.startsWith("/") ? path : `/${path}`;
  const resolved = resolveApiUrl(normalized);
  if (resolved.startsWith("http") || resolved.startsWith("/api/")) {
    return resolved;
  }
  return `/api${normalized}`;
}
