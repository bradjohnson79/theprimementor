export const REPORT_PUBLIC_MARKETING_PATHS = [
  "/reports",
  "/reports/introductory",
  "/reports/compatibility",
] as const;

export function isReportsMarketingPath(pathname: string): boolean {
  return (REPORT_PUBLIC_MARKETING_PATHS as readonly string[]).includes(pathname);
}
