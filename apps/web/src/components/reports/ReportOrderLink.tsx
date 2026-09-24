import type { ReactNode } from "react";
import { Link } from "react-router-dom";
import { REPORT_PRODUCTS, type ReportProductKey } from "@wisdom/utils";
import { withCurrentSearch } from "../../lib/reportAttribution";
import {
  trackReportOrderClick,
  type ReportLandingPageSource,
} from "../../lib/reportLandingAnalytics";

export default function ReportOrderLink({
  reportKey,
  pageSource,
  search,
  className,
  children,
}: {
  reportKey: ReportProductKey;
  pageSource: ReportLandingPageSource;
  search: string;
  className?: string;
  children?: ReactNode;
}) {
  const product = REPORT_PRODUCTS[reportKey];
  return (
    <Link
      to={withCurrentSearch(product.orderPath, search)}
      className={className}
      onClick={() => trackReportOrderClick(reportKey, pageSource)}
    >
      {children ?? product.ctaLabel}
    </Link>
  );
}
