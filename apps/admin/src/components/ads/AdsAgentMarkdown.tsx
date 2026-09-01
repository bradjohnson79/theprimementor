import { useMemo } from "react";
import { renderReportMarkdownToSafeHtml } from "../../lib/reportHtml";

export function AdsAgentMarkdown({
  markdown,
  isLightTheme,
}: {
  markdown: string;
  isLightTheme: boolean;
}) {
  const html = useMemo(() => renderReportMarkdownToSafeHtml(markdown), [markdown]);
  return (
    <div
      data-ads-agent-assistant
      className={`ads-agent-prose ${isLightTheme ? "ads-agent-prose--light" : "ads-agent-prose--dark"}`}
      dangerouslySetInnerHTML={{ __html: html }}
    />
  );
}
