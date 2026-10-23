/**
 * Brad confirmed (BRAD-ANSWERS.md, Oct 23, 2026): the Healing Code Card and
 * Safeguard Kit files are NOT missing — they are delivered as Google Drive
 * digital downloads after purchase. Do not hide or disable these products,
 * and do not change the delivery mechanism. The only fix needed is removing
 * the stale "awaiting attachment" copy from public pages.
 */
export function sanitizeShopCopy(text: string): string {
  return text
    .replace(/\s*Deck card files are awaiting attachment\./gi, "")
    .replace(/\s*Printable Personal and Environmental safeguard files are awaiting attachment\.[^.]*\./gi, "")
    .replace(/\s*Purchasers will receive the complete kit files when they are uploaded\./gi, "")
    .replace(/\s*Do not treat missing files as included\./gi, "")
    .replace(/\s{2,}/g, " ")
    .trim();
}
