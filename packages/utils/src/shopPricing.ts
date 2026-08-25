export function formatShopPriceCad(cents: number, currency = "CAD"): string {
  const dollars = cents / 100;
  const amount = Number.isInteger(dollars) ? `$${dollars}` : `$${dollars.toFixed(2)}`;
  return `${amount} ${currency.toUpperCase()}`;
}

export function dollarsToCents(value: string | number): number {
  const numeric = typeof value === "number" ? value : Number.parseFloat(value);
  if (!Number.isFinite(numeric) || numeric <= 0) {
    throw new Error("Price must be a positive number.");
  }
  return Math.round(numeric * 100);
}
