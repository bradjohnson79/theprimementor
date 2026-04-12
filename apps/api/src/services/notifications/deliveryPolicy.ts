export type NotificationDeliveryMode = "production_live" | "redirected" | "suppressed";

export interface NotificationDeliveryPolicy {
  mode: NotificationDeliveryMode;
  label: string;
  redirectRecipients: string[];
}

function normalizeEmailList(value: string) {
  return Array.from(
    new Set(
      value
        .split(",")
        .map((entry) => entry.trim().toLowerCase())
        .filter(Boolean),
    ),
  );
}

export function getNotificationDeliveryPolicy(): NotificationDeliveryPolicy {
  const redirectRecipients = normalizeEmailList(process.env.NOTIFICATION_REDIRECT_EMAILS?.trim() ?? "");
  if (process.env.NODE_ENV === "production") {
    return {
      mode: "production_live",
      label: "PRODUCTION - live delivery enabled",
      redirectRecipients: [],
    };
  }

  if (redirectRecipients.length > 0) {
    return {
      mode: "redirected",
      label: `DEVELOPMENT - redirected to ${redirectRecipients.join(", ")}`,
      redirectRecipients,
    };
  }

  return {
    mode: "suppressed",
    label: "DEVELOPMENT - emails suppressed",
    redirectRecipients: [],
  };
}

export function applyNotificationDeliveryPolicy(recipients: string[]) {
  const policy = getNotificationDeliveryPolicy();
  if (policy.mode === "production_live") {
    return {
      policy,
      resolvedRecipients: recipients,
      suppressed: false,
      redirected: false,
    };
  }

  if (policy.mode === "redirected") {
    return {
      policy,
      resolvedRecipients: policy.redirectRecipients,
      suppressed: false,
      redirected: true,
    };
  }

  return {
    policy,
    resolvedRecipients: [] as string[],
    suppressed: true,
    redirected: false,
  };
}
