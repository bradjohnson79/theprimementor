import { useAuth } from "@clerk/react";
import { useEffect, useMemo, useState } from "react";
import { useAdminSettings } from "../../context/AdminSettingsContext";
import { api } from "../../lib/api";

interface NotificationActivityRow {
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
}

interface NotificationEventInfo {
  event: string;
  label: string;
  recipientType: "user" | "admin";
  configurable: boolean;
}

type NotificationEvent = NotificationEventInfo["event"];

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
  activity: NotificationActivityRow[];
  configurableEvents: string[];
}

interface NotificationEventsResponse {
  events: NotificationEventInfo[];
}

interface NotificationPreviewResponse {
  event: string;
  recipientType: string;
  subject: string;
  html: string;
  templateVersion: string;
  dryRun: boolean;
  payload: Record<string, unknown>;
}

interface NotificationTestResult {
  success: boolean;
  skipped: boolean;
  dryRun?: boolean;
  recipients?: string[];
  deliveryMode?: string;
  preview?: {
    subject: string;
    html: string;
    templateVersion: string;
  };
}

interface NotificationTestResponse {
  entityId: string;
  event: string;
  payload: Record<string, unknown>;
  dryRun: boolean;
  result: NotificationTestResult;
}

function classNames(...values: Array<string | false | null | undefined>) {
  return values.filter(Boolean).join(" ");
}

function prettyEventLabel(event: string) {
  return event.replace(/\./g, " ").replace(/\b\w/g, (match) => match.toUpperCase());
}

export default function NotificationsSettings() {
  const { getToken } = useAuth();
  const { resolvedTheme } = useAdminSettings();
  const isLightTheme = resolvedTheme === "light";
  const [data, setData] = useState<NotificationSettingsResponse | null>(null);
  const [notificationEvents, setNotificationEvents] = useState<NotificationEventInfo[]>([]);
  const [selectedEvent, setSelectedEvent] = useState<NotificationEvent>("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [sending, setSending] = useState(false);
  const [saveMessage, setSaveMessage] = useState<string | null>(null);
  const [testMessage, setTestMessage] = useState("");
  const [testRecipientOverride, setTestRecipientOverride] = useState("");
  const [testResult, setTestResult] = useState<string | null>(null);
  const [previewPayload, setPreviewPayload] = useState("{}");
  const [previewResult, setPreviewResult] = useState<NotificationPreviewResponse | null>(null);
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

  const eventMap = useMemo(
    () => new Map(notificationEvents.map((eventInfo) => [eventInfo.event, eventInfo])),
    [notificationEvents],
  );
  const effectiveRecipients = useMemo(
    () => data?.settings.effectiveAdminRecipients.join(", ") ?? "Not configured",
    [data],
  );
  const quickActions = useMemo(() => [
    { event: "booking.confirmed", label: "Send Booking Confirmation" },
    { event: "payment.succeeded", label: "Send Payment Receipt" },
    { event: "admin.new.booking", label: "Send Booking Alert" },
    { event: "admin.payment.received", label: "Send Payment Alert" },
  ].filter((action) => eventMap.has(action.event)), [eventMap]);

  async function fetchPreview(
    event: NotificationEvent,
    payload?: Record<string, unknown>,
  ) {
    const token = await getToken();
    return (await api.post("/admin/notifications/preview", {
      event,
      ...(payload ? { payload } : {}),
    }, token)) as NotificationPreviewResponse;
  }

  async function load() {
    setLoading(true);
    setError(null);
    try {
      const token = await getToken();
      const [settingsResponse, eventsResponse] = await Promise.all([
        api.get("/admin/notifications", token) as Promise<NotificationSettingsResponse>,
        api.get("/admin/notifications/events", token) as Promise<NotificationEventsResponse>,
      ]);

      setData(settingsResponse);
      setNotificationEvents(eventsResponse.events);
      setAdminRecipientsText(settingsResponse.settings.adminRecipientsOverride.join(", "));
      setSelectedEvent((current) => current || eventsResponse.events[0]?.event || "");
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
    if (!selectedEvent) {
      return;
    }

    let active = true;
    void (async () => {
      try {
        const response = await fetchPreview(selectedEvent);
        if (!active) {
          return;
        }

        setPreviewResult(response);
        setPreviewPayload(JSON.stringify(response.payload, null, 2));
      } catch (previewError) {
        if (!active) {
          return;
        }

        setPreviewResult({
          event: selectedEvent,
          recipientType: eventMap.get(selectedEvent)?.recipientType ?? "unknown",
          subject: "Preview failed",
          html: previewError instanceof Error ? previewError.message : "Failed to load preview payload.",
          templateVersion: "n/a",
          dryRun: true,
          payload: {},
        });
      }
    })();

    return () => {
      active = false;
    };
  }, [eventMap, selectedEvent]);

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
    if (!selectedEvent) {
      return;
    }

    try {
      const payload = JSON.parse(previewPayload) as Record<string, unknown>;
      const response = await fetchPreview(selectedEvent, payload);
      setPreviewResult(response);
      setPreviewPayload(JSON.stringify(response.payload, null, 2));
    } catch (previewError) {
      setPreviewResult({
        event: selectedEvent,
        recipientType: eventMap.get(selectedEvent)?.recipientType ?? "unknown",
        subject: "Preview failed",
        html: previewError instanceof Error ? previewError.message : "Invalid preview payload.",
        templateVersion: "n/a",
        dryRun: true,
        payload: {},
      });
    }
  }

  async function handleTestSend(options?: {
    event?: NotificationEvent;
    dryRun?: boolean;
    useSamplePayload?: boolean;
  }) {
    const event = options?.event ?? selectedEvent;
    if (!event) {
      return;
    }

    setSending(true);
    setTestResult(null);
    try {
      const token = await getToken();
      const body: Record<string, unknown> = {
        event,
        dryRun: options?.dryRun === true,
      };

      if (testMessage.trim()) {
        body.message = testMessage.trim();
      }

      if (testRecipientOverride.trim()) {
        body.recipientOverride = testRecipientOverride;
      }

      if (!options?.useSamplePayload) {
        body.payload = JSON.parse(previewPayload) as Record<string, unknown>;
      }

      const response = (await api.post("/admin/notifications/test", body, token)) as NotificationTestResponse;
      if (response.result.dryRun && response.result.preview) {
        setPreviewResult({
          event: response.event,
          recipientType: eventMap.get(response.event)?.recipientType ?? "unknown",
          subject: response.result.preview.subject,
          html: response.result.preview.html,
          templateVersion: response.result.preview.templateVersion,
          dryRun: true,
          payload: response.payload,
        });
      }

      setPreviewPayload(JSON.stringify(response.payload, null, 2));
      const recipientSummary = response.result.recipients?.join(", ");
      setTestResult(response.result.dryRun
        ? `Dry run rendered ${response.event}${recipientSummary ? ` for ${recipientSummary}` : ""}.`
        : response.result.success
          ? `Sample email handled for ${response.entityId}${recipientSummary ? ` to ${recipientSummary}` : ""}.`
          : `Sample email failed for ${response.entityId}.`);

      if (!response.result.dryRun) {
        await load();
      }
    } catch (testError) {
      setTestResult(testError instanceof Error ? testError.message : "Test send failed.");
    } finally {
      setSending(false);
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
          Configure delivery, render dry runs, send sample emails, inspect recent activity, and retry failures without bypassing the central service.
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
                  <span className="block text-sm font-medium">{eventMap.get(event)?.label ?? prettyEventLabel(event)}</span>
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
            <h3 className="text-lg font-semibold">Sample email testing</h3>
            <p className="mt-1 text-sm opacity-70">
              Trigger any notification event through the same pipeline used in production. User events fall back to the effective admin recipients unless you override them here.
            </p>

            <div className="mt-4 grid gap-3 md:grid-cols-2">
              {quickActions.map((action) => (
                <button
                  key={action.event}
                  type="button"
                  className={secondaryButtonClass}
                  disabled={sending}
                  onClick={() => {
                    setSelectedEvent(action.event);
                    void handleTestSend({ event: action.event, useSamplePayload: true });
                  }}
                >
                  {action.label}
                </button>
              ))}
            </div>

            <div className="mt-4 space-y-4">
              <select
                className={inputClass}
                value={selectedEvent}
                onChange={(event) => setSelectedEvent(event.target.value)}
              >
                {notificationEvents.map((eventInfo) => (
                  <option key={eventInfo.event} value={eventInfo.event}>
                    {eventInfo.label}
                  </option>
                ))}
              </select>
              <input
                className={inputClass}
                value={testRecipientOverride}
                onChange={(event) => setTestRecipientOverride(event.target.value)}
                placeholder="Optional recipient override (comma-separated)"
              />
              <input
                className={inputClass}
                value={testMessage}
                onChange={(event) => setTestMessage(event.target.value)}
                placeholder="Optional message override"
              />
              <div className="flex flex-wrap items-center gap-3">
                <button
                  type="button"
                  className={buttonClass}
                  disabled={sending || !selectedEvent}
                  onClick={() => void handleTestSend()}
                >
                  {sending ? "Sending..." : "Send sample email"}
                </button>
                <button
                  type="button"
                  className={secondaryButtonClass}
                  disabled={sending || !selectedEvent}
                  onClick={() => void handleTestSend({ dryRun: true })}
                >
                  Dry run
                </button>
                {testResult ? <span className="text-sm opacity-70">{testResult}</span> : null}
              </div>
            </div>
          </div>

          <div className={cardClass}>
            <h3 className="text-lg font-semibold">Template preview</h3>
            <p className="mt-1 text-sm opacity-70">
              The payload starts from the backend sample contract for the selected event. Edit it here if you want to test a variant before sending.
            </p>
            <div className="mt-4 space-y-4">
              <textarea
                className={classNames(inputClass, "min-h-[220px] font-mono text-xs")}
                value={previewPayload}
                onChange={(event) => setPreviewPayload(event.target.value)}
              />
              <button type="button" className={secondaryButtonClass} onClick={() => void handlePreview()}>
                Render preview
              </button>
              {previewResult ? (
                <div className={classNames(
                  "rounded-2xl border p-4",
                  isLightTheme ? "border-slate-200 bg-slate-50" : "border-white/10 bg-white/5",
                )}>
                  <p className="text-sm font-medium">{previewResult.subject}</p>
                  <p className="mt-1 text-xs opacity-70">
                    Template: {previewResult.templateVersion}
                    {" · "}
                    Recipient type: {previewResult.recipientType}
                  </p>
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
