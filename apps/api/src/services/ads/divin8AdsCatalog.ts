import {
  REPORT_PRODUCT_ORDER,
  REPORT_PRODUCTS,
  divin8ReportProductListPrice,
  getPublicSystemLabelsForReport,
  type ReportProductKey,
} from "@wisdom/utils";

export type Divin8AdsCatalogEntry = {
  key: ReportProductKey;
  displayName: string;
  price: string;
  shortDescription: string;
  systems: string[];
  landingPath: string;
  orderPath: string;
  source: "prime_mentor_catalog";
};

export function getDivin8AdvertisingCatalog(): Divin8AdsCatalogEntry[] {
  return REPORT_PRODUCT_ORDER.map((key) => {
    const product = REPORT_PRODUCTS[key];
    return {
      key,
      displayName: product.displayName,
      price: divin8ReportProductListPrice(key),
      shortDescription: product.shortDescription,
      systems: getPublicSystemLabelsForReport(key),
      landingPath: "/reports",
      orderPath: product.orderPath,
      source: "prime_mentor_catalog",
    };
  });
}
