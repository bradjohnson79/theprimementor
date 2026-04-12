const BRAND_NAME = "The Prime Mentor";
const DEFAULT_FRONTEND_URL = "https://theprimementor.com";
const DEFAULT_ADMIN_URL = "https://admin.theprimementor.com";

function normalizeBaseUrl(value: string) {
  return value.trim().replace(/\/+$/, "");
}

export function getFrontendUrl() {
  const configured = process.env.FRONTEND_URL?.trim()
    || process.env.APP_URL?.trim()
    || process.env.VITE_APP_URL?.trim();

  return configured ? normalizeBaseUrl(configured) : DEFAULT_FRONTEND_URL;
}

export function getAdminUrl() {
  const configured = process.env.ADMIN_URL?.trim();
  return configured ? normalizeBaseUrl(configured) : DEFAULT_ADMIN_URL;
}

export function buildFrontendUrl(path = "/") {
  if (/^https?:\/\//i.test(path)) {
    return path;
  }

  const normalizedPath = path.startsWith("/") ? path : `/${path}`;
  return `${getFrontendUrl()}${normalizedPath}`;
}

export function buildAdminUrl(path = "/") {
  if (/^https?:\/\//i.test(path)) {
    return path;
  }

  const normalizedPath = path.startsWith("/") ? path : `/${path}`;
  return `${getAdminUrl()}${normalizedPath}`;
}

export function escapeHtml(value: string) {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

export function text(value: string | number | null | undefined, fallback: string) {
  if (value === null || value === undefined || value === "") {
    return fallback;
  }

  return String(value);
}

export function money(amount: number | null | undefined, currency: string | null | undefined) {
  if (typeof amount !== "number") {
    return "Unavailable";
  }

  return `${amount} ${text(currency?.toUpperCase(), "USD")}`;
}

export function renderParagraph(value: string) {
  return `<p style="margin:0 0 16px;color:#334155;font-size:15px;line-height:1.7;">${escapeHtml(value)}</p>`;
}

export function renderKeyValueTable(items: Array<{ label: string; value: string | null | undefined }>) {
  const rows = items
    .filter((item) => item.value !== undefined)
    .map((item) => `
      <tr>
        <td style="padding:10px 0;border-bottom:1px solid #e2e8f0;color:#64748b;font-size:13px;font-weight:600;vertical-align:top;width:38%;">
          ${escapeHtml(item.label)}
        </td>
        <td style="padding:10px 0;border-bottom:1px solid #e2e8f0;color:#0f172a;font-size:14px;vertical-align:top;">
          ${escapeHtml(text(item.value, "Unavailable"))}
        </td>
      </tr>
    `)
    .join("");

  return `
    <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="border-collapse:collapse;margin:0;">
      ${rows}
    </table>
  `;
}

export function renderInfoCard(title: string, body: string) {
  return `
    <div style="margin:0 0 20px;padding:20px;border:1px solid #dbe4ee;border-radius:18px;background:#f8fbff;">
      <h2 style="margin:0 0 12px;color:#0f172a;font-size:17px;line-height:1.4;">${escapeHtml(title)}</h2>
      ${body}
    </div>
  `;
}

interface EmailCallToAction {
  label: string;
  url: string;
  note?: string;
}

interface PrimeMentorEmailOptions {
  eyebrow: string;
  title: string;
  intro: string;
  sections: string[];
  callToAction?: EmailCallToAction;
  secondaryCallToAction?: EmailCallToAction;
  footerNote?: string;
}

function renderButton(action: EmailCallToAction, primary: boolean) {
  const background = primary ? "#1ccad8" : "#ffffff";
  const color = primary ? "#06121f" : "#0f172a";
  const border = primary ? "#1ccad8" : "#cbd5e1";
  const note = action.note
    ? `<p style="margin:12px 0 0;color:#64748b;font-size:12px;line-height:1.6;">${escapeHtml(action.note)}</p>`
    : "";

  return `
    <div style="margin:${primary ? "28px" : "16px"} 0 0;">
      <a
        href="${escapeHtml(action.url)}"
        style="display:inline-block;padding:13px 20px;border-radius:999px;border:1px solid ${border};background:${background};color:${color};font-size:14px;font-weight:700;text-decoration:none;"
      >
        ${escapeHtml(action.label)}
      </a>
      ${note}
    </div>
  `;
}

export function renderPrimeMentorEmail(options: PrimeMentorEmailOptions) {
  const footerNote = options.footerNote
    ? `<p style="margin:16px 0 0;color:#64748b;font-size:12px;line-height:1.6;">${escapeHtml(options.footerNote)}</p>`
    : "";

  return `
    <div style="margin:0;padding:32px 16px;background:#020617;">
      <div style="max-width:680px;margin:0 auto;background:#ffffff;border-radius:28px;overflow:hidden;border:1px solid #0f172a;">
        <div style="padding:32px 32px 28px;background:linear-gradient(135deg,#07111d 0%,#10253b 58%,#153b57 100%);">
          <div style="margin:0 0 14px;color:#8fe7ef;font-size:12px;font-weight:700;letter-spacing:0.22em;text-transform:uppercase;">
            ${escapeHtml(options.eyebrow)}
          </div>
          <div style="margin:0;color:#ffffff;font-size:28px;font-weight:700;line-height:1.25;">
            ${escapeHtml(options.title)}
          </div>
          <p style="margin:14px 0 0;color:#d9f4f7;font-size:15px;line-height:1.7;">
            ${escapeHtml(options.intro)}
          </p>
        </div>

        <div style="padding:32px;">
          ${options.sections.join("")}
          ${options.callToAction ? renderButton(options.callToAction, true) : ""}
          ${options.secondaryCallToAction ? renderButton(options.secondaryCallToAction, false) : ""}
        </div>

        <div style="padding:24px 32px 32px;border-top:1px solid #e2e8f0;background:#f8fafc;">
          <p style="margin:0;color:#0f172a;font-size:15px;font-weight:700;">${BRAND_NAME}</p>
          <p style="margin:8px 0 0;color:#475569;font-size:13px;line-height:1.7;">
            Precision guidance, reports, sessions, and mentoring designed to help you move with clarity.
          </p>
          <p style="margin:16px 0 0;color:#475569;font-size:13px;line-height:1.7;">
            Visit <a href="${escapeHtml(buildFrontendUrl("/"))}" style="color:#0f172a;font-weight:700;text-decoration:none;">theprimementor.com</a>
            &nbsp;or reply to this email if you need support.
          </p>
          ${footerNote}
        </div>
      </div>
    </div>
  `;
}
