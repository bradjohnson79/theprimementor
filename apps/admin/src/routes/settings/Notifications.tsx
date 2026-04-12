import { useAuth } from "@clerk/react";
import { useEffect, useMemo, useState } from "react";
import { useAdminSettings } from "../../context/AdminSettingsContext";
import { api } from "../../lib/api";

type NotificationEvent =
  | "payment.succeeded"
  | "payment.failed"
  | "booking.created"
  | "booking.confirmed"
  | "report.generated"
  | "admin.payment.received"
  | "admin.new.booking"
  | "admin.new.user"
  | "admin.test";

interface NotificationSettingsResponse {
  settings: {
    enabledEvents: Record<string, boolean>;
    adminRecipientsOverride: string[];
    effectiveAdminRecipients: string[];
  };
  deliveryPolicy: {
    mode: string;
    label: string;
  };
  activity: Array<{
    id: string;
    event_type: string;
    entity_id: string;
    recipient: string;
    recipient_type: string;
    status: string;
    sent_at: string | null;
    failure_reason: string | null;
    template_version: string;
    provider_message_id: string | null;
  }>;
  configurableEvents: NotificationEvent[];
}

function classNames(...values: Array<string | false | null | undefined>) {
  return values.filter(Boolean).join(" ");
}

function prettyEventLabel(event: string) {
  return event.replace(/\./g, " ").replace(/\b\w/g, (match) => match.toUpperCase());
}

const defaultPreviewPayloads: Record<NotificationEvent, Record<string, unknown>> = {
  "payment.succeeded": {
    entityId: "payment_demo_1",
    paymentId: "pay_demo_1",
    amount: 199,
    currency: "usd",
    product: "Blueprint Reading",
  },
  "payment.failed": {
    entityId: "payment_demo_2",
    paymentId: "pay_demo_2",
    amount: 199,
    currency: "usd",
    product: "Blueprint Reading",
    reason: "Card declined",
  },
  "booking.created": {
    entityId: "booking_demo_1",
    bookingId: "booking_demo_1",
    bookingType: "Mentoring Session",
    fullName: "Preview Client",
    timezone: "America/Vancouver",
  },
  "booking.confirmed": {
    entityId: "booking_demo_1",
    bookingId: "booking_demo_1",
    bookingType: "Mentoring Session",
    startTimeUtc: new Date().toISOString(),
    endTimeUtc: new Date(Date.now() + 60 * 60 * 1000).toISOString(),
    timezone: "America/Vancouver",
  },
  "report.generated": {
    entityId: "report_demo_1",
    orderId: "order_demo_1",
    reportId: "report_demo_1",
    title: "Blueprint Report",
    reportTier: "intro",
  },
  "admin.payment.received": {
    entityId: "payment_demo_admin",
    paymentId: "pay_demo_admin",
    amount: 199,
    currency: "usd",
    product: "Blueprint Reading",
    userEmail: "client@example.com",
  },
  "admin.new.booking": {
    entityId: "booking_demo_admin",
    bookingId: "booking_demo_admin",
    bookingType: "Mentoring Session",
    userEmail: "client@example.com",
    fullName: "Preview Client",
  },
  "admin.new.user": {
    entityId: "user_demo_1",
    clerkId: "user_demo_clerk",
    email: "newuser@example.com",
    name: "Preview User",
  },
  "admin.test": {
    entityId: "admin_test_preview",
    message: "Preview the admin test template.",
  },
};

export default function NotificationsSettings() {
  const { getToken } = useAuth();
  const { resolvedTheme } = useAdminSettings();
  const isLightTheme = resolvedTheme === "light";
  const [data, setData] = useState<NotificationSettingsResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [saveMessage, setSaveMessage] = useState<string | null>(null);
  const [testMessage, setTestMessage] = useState("");
  const [testResult, setTestResult] = useState<string | null>(null);
  const [previewEvent, setPreviewEvent] = useState<NotificationEvent>("admin.test");
  const [previewPayload, setPreviewPayload] = useState(
    JSON.stringify(defaultPreviewPayloads["admin.test"], null, 2),
  );
  const [previewResult, setPreviewResult] = useState<{ subject: string; html: string; templateVersion: string } | null>(null);
  const [adminRecipientsText, setAdminRecipientsText] = useState("");

  const inputClass = classNames(
    "w-full rounded-xl border px-4 py-3 text-sm outline-none transition-colors",
    isLightTheme
      ? "border-slate-200 bg-white text-slate-900"
      : "border-white/10 bg-white/5 text-white",
  );
  const cardClass = classNames(
    "rounded-2xl border p-6",
    isLightTheme ? "border-slate-200 bg-white" : "border-white/10 bg-white/5",
  );
  const buttonClass = classNames(
    "rounded-xl px-4 py-2.5 text-sm font-medium transition-colors",
    isLightTheme
      ? "bg-slate-900 text-white hover:bg-slate-800"
      : "bg-accent-cyan text-navy-dark hover:brightness-110",
  );
  const secondaryButtonClass = classNames(
    "rounded-xl border px-4 py-2.5 text-sm font-medium transition-colors",
    isLightTheme
      ? "border-slate-200 bg-white text-slate-700 hover:bg-slate-50"
      : "border-white/10 bg-white/5 text-white hover:bg-white/10",
  );

  async function load() {
    setLoading(true);
    setError(null);
    try {
      const token = await getToken();
      const response = (await api.get("/admin/notifications", token)) as NotificationSettingsResponse;
      setData(response);
      setAdminRecipientsText(response.settings.adminRecipientsOverride.join(", "));
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : "Failed to load notifications.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void load();
  }, []);

  useEffect(() => {
    setPreviewPayload(JSON.stringify(defaultPreviewPayloads[previewEvent], null, 2));
  }, [previewEvent]);

  const effectiveRecipients = useMemo(
    () => data?.settings.effectiveAdminRecipients.join(", ") ?? "Not configured",
    [data],
  );

  async function handleToggle(event: string, checked: boolean) {
    if (!data) {
      return;
    }

    const nextEnabledEvents = {
      ...data.settings.enabledEvents,
      [event]: checked,
    };
    setData({
      ...data,
      settings: {
        ...data.settings,
        enabledEvents: nextEnabledEvents,
      },
    });
  }

  async function handleSave() {
    if (!data) {
      return;
    }

    setSaving(true);
    setSaveMessage(null);
    try {
      const token = await getToken();
      const response = (await api.patch("/admin/notifications/settings", {
        enabledEvents: data.settings.enabledEvents,
        adminRecipientsOverride: adminRecipientsText
          .split(",")
          .map((entry) => entry.trim())
          .filter(Boolean),
      }, token)) as NotificationSettingsResponse["settings"];

      setData((current) => current ? {
        ...current,
        settings: response,
      } : current);
      setAdminRecipientsText(response.adminRecipientsOverride.join(", "));
      setSaveMessage("Notification settings saved.");
    } catch (saveError) {
      setSaveMessage(saveError instanceof Error ? saveError.message : "Failed to save settings.");
    } finally {
      setSaving(false);
    }
  }

  async function handlePreview() {
    try {
      const token = await getToken();
      const payload = JSON.parse(previewPayload) as Record<string, unknown>;
      const response = (await api.post("/admin/notifications/preview", {
        event: previewEvent,
        payload,
      }, token)) as { subject: string; html: string; templateVersion: string };
      setPreviewResult(response);
    } catch (previewError) {
      setPreviewResult({
        subject: "Preview failed",
        html: previewError instanceof Error ? previewError.message : "Invalid preview payload.",
        templateVersion: "n/a",
      });
    }
  }

  async function handleTestSend() {
    try {
      const token = await getToken();
      const response = (await api.post("/admin/notifications/test", {
        message: testMessage,
      }, token)) as { entityId: string; result: { success: boolean; skipped: boolean } };
      setTestResult(response.result.success
        ? `Test notification handled for ${response.entityId}.`
        : `Test notification failed for ${response.entityId}.`);
      await load();
    } catch (testError) {
      setTestResult(testError instanceof Error ? testError.message : "Test send failed.");
    }
  }

  async function handleRetry(id: string) {
    try {
      const token = await getToken();
      await api.post("/admin/notifications/retry", { ids: [id] }, token);
      await load();
    } catch (retryError) {
      setError(retryError instanceof Error ? retryError.message : "Retry failed.");
    }
  }

  if (loading) {
    return <div className={cardClass}>Loading notification settings...</div>;
  }

  if (error || !data) {
    return <div className={cardClass}>{error ?? "Notification settings are unavailable."}</div>;
  }

  return (
    <div className="space-y-6">
      <div className={cardClass}>
        <p className="text-sm font-medium text-accent-cyan">Notifications</p>
        <h2 className="mt-2 text-2xl font-semibold">Admin notification control plane</h2>
        <p className="mt-2 text-sm opacity-70">
          Configure delivery, preview templates, inspect recent activity, and retry failed sends without bypassing the central service.
        </p>
      </div>

      <div className="grid gap-6 xl:grid-cols-[1.1fr_0.9fr]">
        <div className={cardClass}>
          <div className="flex items-start justify-between gap-4">
            <div>
              <h3 className="text-lg font-semibold">Delivery settings</h3>
              <p className="mt-1 text-sm opacity-70">The current environment mode is enforced centrally by the API delivery policy.</p>
            </div>
            <span className={classNames(
              "rounded-full px-3 py-1 text-xs font-semibold uppercase tracking-[0.16em]",
              isLightTheme ? "bg-slate-100 text-slate-700" : "bg-white/10 text-white/80",
            )}>
              {data.deliveryPolicy.label}
            </span>
          </div>

          <div className="mt-6 space-y-4">
            {data.configurableEvents.map((event) => (
              <label
                key={event}
                className={classNames(
                  "flex items-center justify-between rounded-2xl border px-4 py-3",
                  isLightTheme ? "border-slate-200 bg-slate-50" : "border-white/10 bg-white/5",
                )}
              >
                <span>
                  <span className="block text-sm font-medium">{prettyEventLabel(event)}</span>
                  <span className="mt-1 block text-xs opacity-70">{event}</span>
                </span>
                <input
                  type="checkbox"
                  checked={Boolean(data.settings.enabledEvents[event])}
                  onChange={(changeEvent) => handleToggle(event, changeEvent.target.checked)}
                />
              </label>
            ))}
          </div>

          <div className="mt-6">
            <label className="block text-sm font-medium">Admin recipient overrides</label>
            <p className="mt-1 text-xs opacity-70">Comma-separated emails. Leave blank to fall back to env or primary admin resolution.</p>
            <textarea
              className={classNames(inputClass, "mt-3 min-h-[96px]")}
              value={adminRecipientsText}
              onChange={(event) => setAdminRecipientsText(event.target.value)}
            />
            <p className="mt-3 text-xs opacity-70">Effective recipients: {effectiveRecipients}</p>
          </div>

          <div className="mt-6 flex items-center gap-3">
            <button type="button" className={buttonClass} onClick={handleSave} disabled={saving}>
              {saving ? "Saving..." : "Save settings"}
            </button>
            {saveMessage ? <span className="text-sm opacity-70">{saveMessage}</span> : null}
          </div>
        </div>

        <div className="space-y-6">
          <div className={cardClass}>
            <h3 className="text-lg font-semibold">Test send</h3>
            <p className="mt-1 text-sm opacity-70">Sends the `admin.test` event through the same notification service used by production flows.</p>
            <input
              className={classNames(inputClass, "mt-4")}
              value={testMessage}
              onChange={(event) => setTestMessage(event.target.value)}
              placeholder="Optional test message"
            />
            <div className="mt-4 flex items-center gap-3">
              <button type="button" className={buttonClass} onClick={handleTestSend}>Send test notification</button>
              {testResult ? <span className="text-sm opacity-70">{testResult}</span> : null}
            </div>
          </div>

          <div className={cardClass}>
            <h3 className="text-lg font-semibold">Preview</h3>
            <div className="mt-4 space-y-4">
              <select
                className={inputClass}
                value={previewEvent}
                onChange={(event) => setPreviewEvent(event.target.value as NotificationEvent)}
              >
                {([...data.configurableEvents, "admin.test"] as NotificationEvent[]).map((event) => (
                  <option key={event} value={event}>{prettyEventLabel(event)}</option>
                ))}
              </select>
              <textarea
                className={classNames(inputClass, "min-h-[220px] font-mono text-xs")}
                value={previewPayload}
                onChange={(event) => setPreviewPayload(event.target.value)}
              />
              <button type="button" className={secondaryButtonClass} onClick={handlePreview}>Render preview</button>
              {previewResult ? (
                <div className={classNames(
                  "rounded-2xl border p-4",
                  isLightTheme ? "border-slate-200 bg-slate-50" : "border-white/10 bg-white/5",
                )}>
                  <p className="text-sm font-medium">{previewResult.subject}</p>
                  <p className="mt-1 text-xs opacity-70">Template: {previewResult.templateVersion}</p>
                  <div
                    className="prose prose-sm mt-4 max-w-none"
                    dangerouslySetInnerHTML={{ __html: previewResult.html }}
                  />
                </div>
              ) : null}
            </div>
          </div>
        </div>
      </div>

      <div className={cardClass}>
        <div className="flex items-center justify-between gap-4">
          <div>
            <h3 className="text-lg font-semibold">Activity log</h3>
            <p className="mt-1 text-sm opacity-70">Recent notification ledger rows, including failed deliveries and duplicate skips.</p>
          </div>
          <button type="button" className={secondaryButtonClass} onClick={() => void load()}>Refresh</button>
        </div>

        <div className="mt-6 overflow-x-auto">
          <table className="min-w-full text-left text-sm">
            <thead className={classNames(isLightTheme ? "text-slate-500" : "text-white/60")}>
              <tr>
                <th className="px-3 py-2">Event</th>
                <th className="px-3 py-2">Entity</th>
                <th className="px-3 py-2">Recipient</th>
                <th className="px-3 py-2">Type</th>
                <th className="px-3 py-2">Status</th>
                <th className="px-3 py-2">Sent</th>
                <th className="px-3 py-2">Failure</th>
                <th className="px-3 py-2">Action</th>
              </tr>
            </thead>
            <tbody>
              {data.activity.map((row) => (
                <tr key={row.id} className={classNames(isLightTheme ? "border-t border-slate-200" : "border-t border-white/10")}>
                  <td className="px-3 py-3">{row.event_type}</td>
                  <td className="px-3 py-3">{row.entity_id}</td>
                  <td className="px-3 py-3">{row.recipient || "Unavailable"}</td>
                  <td className="px-3 py-3">{row.recipient_type}</td>
                  <td className="px-3 py-3">{row.status}</td>
                  <td className="px-3 py-3">{row.sent_at ? new Date(row.sent_at).toLocaleString() : "Not sent"}</td>
                  <td className="px-3 py-3">{row.failure_reason ?? "None"}</td>
                  <td className="px-3 py-3">
                    {row.status === "failed" ? (
                      <button type="button" className={secondaryButtonClass} onClick={() => void handleRetry(row.id)}>
                        Retry
                      </button>
                    ) : (
                      <span className="text-xs opacity-60">n/a</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
