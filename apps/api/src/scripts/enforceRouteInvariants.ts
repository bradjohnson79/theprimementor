import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { API_ROUTE_MANIFEST, type ApiRouteManifestEntry } from "../routeInventory.js";

const REQUIRED_ENV: Record<string, string> = {
  OPENAI_API_KEY: "test",
  STRIPE_SECRET_KEY: "sk_test_x",
  STRIPE_WEBHOOK_SECRET: "whsec_test_x",
  STRIPE_PRICE_SEEKER_MONTHLY: "price_test_seeker_monthly",
  STRIPE_PRICE_INITIATE_MONTHLY: "price_test_initiate_monthly",
  STRIPE_PRICE_TRAINING_ENTRY: "price_test_training_entry",
  STRIPE_PRICE_TRAINING_SEEKER: "price_test_training_seeker",
  STRIPE_PRICE_TRAINING_INITIATE: "price_test_training_initiate",
};

const ROUTE_FILE_BANS = [
  {
    regex: /reply\.status\([^\n]+\)\.send\(\{\s*error:/g,
    message: "Direct legacy error sends are banned; use sendApiError().",
  },
  {
    regex: /reply\.send\(\{/g,
    message: "Direct JSON reply.send payloads are banned; return ok(...) instead.",
  },
  {
    regex: /return\s+\{\s*(data|ok|status|success)\s*:/g,
    message: "Direct legacy JSON returns are banned; wrap payloads in ok(...).",
  },
  {
    regex: /request\.dbUser(?:\?|\!)?\.role\s*!==\s*"admin"/g,
    message: "Inline admin checks are banned; use requireAdmin().",
  },
  {
    regex: /reply\.status\([^\n]+\)\.send\(fail\(/g,
    message: "Error responses should use sendApiError() instead of raw fail().",
  },
];

function applyRequiredEnv() {
  const previous = new Map<string, string | undefined>();
  for (const [key, value] of Object.entries(REQUIRED_ENV)) {
    previous.set(key, process.env[key]);
    process.env[key] = value;
  }

  return () => {
    for (const [key, value] of previous.entries()) {
      if (value === undefined) {
        delete process.env[key];
      } else {
        process.env[key] = value;
      }
    }
  };
}

function normalizeRoute(route: { method: string; url: string }) {
  return `${route.method.toUpperCase()} ${route.url}`;
}

function diffRoutes(expected: string[], actual: string[]) {
  const expectedSet = new Set(expected);
  const actualSet = new Set(actual);

  return {
    missing: expected.filter((route) => !actualSet.has(route)),
    extra: actual.filter((route) => !expectedSet.has(route)),
  };
}

function routeLiteral(manifestEntry: ApiRouteManifestEntry) {
  return manifestEntry.url.replace(/^\/api/, "") || "/";
}

function extractRouteSnippet(content: string, manifestEntry: ApiRouteManifestEntry) {
  const literal = routeLiteral(manifestEntry);
  const singleQuoted = `'${literal}'`;
  const doubleQuoted = `"${literal}"`;
  const index = content.indexOf(singleQuoted) >= 0
    ? content.indexOf(singleQuoted)
    : content.indexOf(doubleQuoted);

  if (index < 0) {
    throw new Error(`Could not locate route ${manifestEntry.method} ${manifestEntry.url} in ${manifestEntry.handlerFile}`);
  }

  return content.slice(index, index + 1400);
}

async function assertManifestMetadata() {
  const unique = new Set<string>();
  const srcDir = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");

  for (const entry of API_ROUTE_MANIFEST) {
    const key = normalizeRoute(entry);
    if (unique.has(key)) {
      throw new Error(`Duplicate route manifest entry: ${key}`);
    }
    unique.add(key);

    if (!entry.handlerFile.trim()) {
      throw new Error(`Route manifest entry missing handler file: ${key}`);
    }

    const handlerPath = path.join(srcDir, entry.handlerFile);
    await fs.access(handlerPath);

    if (entry.validation === "service" && entry.serviceRefs.length === 0) {
      throw new Error(`Service-validated route must declare service refs: ${key}`);
    }
  }
}

async function assertRouteManifestMatchesRuntime() {
  const restoreEnv = applyRequiredEnv();
  const { buildApp } = await import("../server.js");
  const app = await buildApp();
  try {
    const actual = app.routeInventory
      .filter((route) => ["GET", "POST", "PUT", "PATCH", "DELETE"].includes(route.method))
      .map(normalizeRoute)
      .sort();
    const expected = API_ROUTE_MANIFEST
      .map(normalizeRoute)
      .sort();
    const { missing, extra } = diffRoutes(expected, actual);

    if (missing.length > 0 || extra.length > 0) {
      throw new Error([
        "Route manifest drift detected.",
        missing.length > 0 ? `Missing from runtime: ${missing.join(", ")}` : "",
        extra.length > 0 ? `Missing from manifest: ${extra.join(", ")}` : "",
      ].filter(Boolean).join("\n"));
    }
  } finally {
    await app.close();
    restoreEnv();
  }
}

async function assertProtectedRoutesUseRequireAuth() {
  const srcDir = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");

  for (const entry of API_ROUTE_MANIFEST) {
    if (entry.auth === "public" || entry.auth === "stripe-webhook" || entry.auth === "clerk-webhook") {
      continue;
    }

    const filePath = path.join(srcDir, entry.handlerFile);
    const content = await fs.readFile(filePath, "utf8");
    const snippet = extractRouteSnippet(content, entry);
    if (entry.auth === "internal") {
      if (!/assertInternalWeeklySeoAccess\(request\)/.test(snippet)) {
        throw new Error(`Internal route is missing internal auth enforcement: ${normalizeRoute(entry)} in ${entry.handlerFile}`);
      }
      continue;
    }

    if (!/preHandler:\s*requireAuth/.test(snippet)) {
      throw new Error(`Protected route is missing requireAuth preHandler: ${normalizeRoute(entry)} in ${entry.handlerFile}`);
    }
  }
}

async function assertAdminRoutesUseRequireAdmin() {
  const srcDir = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");

  for (const entry of API_ROUTE_MANIFEST) {
    if (entry.auth !== "admin") {
      continue;
    }

    const filePath = path.join(srcDir, entry.handlerFile);
    const content = await fs.readFile(filePath, "utf8");
    const snippet = extractRouteSnippet(content, entry);
    if (!/requireAdmin\(request\)/.test(snippet)) {
      throw new Error(`Admin route is missing requireAdmin(request): ${normalizeRoute(entry)} in ${entry.handlerFile}`);
    }
  }
}

async function assertValidationPolicies() {
  for (const entry of API_ROUTE_MANIFEST) {
    const isMutating = ["POST", "PATCH", "PUT"].includes(entry.method);
    const requiresProtectedValidation = isMutating
      && entry.auth !== "public"
      && entry.auth !== "stripe-webhook"
      && entry.auth !== "clerk-webhook";

    if (requiresProtectedValidation && entry.validation === "none") {
      throw new Error(`Protected mutating route must declare validation coverage: ${normalizeRoute(entry)}`);
    }
  }
}

async function assertRouteFilesUseSharedContract() {
  const routesDir = path.join(path.dirname(fileURLToPath(import.meta.url)), "..", "routes");
  const entries = await fs.readdir(routesDir);
  const failures: string[] = [];

  for (const entry of entries) {
    if (!entry.endsWith(".ts")) {
      continue;
    }

    const filePath = path.join(routesDir, entry);
    const content = await fs.readFile(filePath, "utf8");
    for (const rule of ROUTE_FILE_BANS) {
      if (rule.regex.test(content)) {
        failures.push(`${entry}: ${rule.message}`);
      }
      rule.regex.lastIndex = 0;
    }
  }

  if (failures.length > 0) {
    throw new Error(`Route invariant violations detected:\n${failures.join("\n")}`);
  }
}

async function assertNotificationBoundaries() {
  const srcDir = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");
  const routePath = path.join(srcDir, "routes", "admin-notifications.ts");
  const routeContent = await fs.readFile(routePath, "utf8");

  if (/sendResendEmail|new\s+Resend|emails\.send/.test(routeContent)) {
    throw new Error("Admin notification routes may not call Resend directly.");
  }

  const allowedProviderFiles = new Set([
    path.join(srcDir, "services", "notifications", "providers", "resendProvider.ts"),
  ]);

  const repoFiles = await fs.readdir(srcDir, { recursive: true });
  const sourceFiles = repoFiles
    .filter((entry): entry is string => typeof entry === "string" && entry.endsWith(".ts"))
    .map((entry) => path.join(srcDir, entry));

  for (const filePath of sourceFiles) {
    const content = await fs.readFile(filePath, "utf8");
    if (!allowedProviderFiles.has(filePath) && /new\s+Resend|emails\.send/.test(content)) {
      throw new Error(`Direct Resend usage is only allowed in resendProvider.ts: ${path.relative(srcDir, filePath)}`);
    }
  }
}

async function assertCriticalPaymentNotificationGuardrails() {
  const srcDir = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");
  const eventsPath = path.join(srcDir, "services", "notifications", "events.ts");
  const webhookPath = path.join(srcDir, "services", "payments", "stripeWebhookService.ts");
  const manualPaymentPath = path.join(srcDir, "services", "adminOrderPaymentService.ts");

  const [eventsContent, webhookContent, manualPaymentContent] = await Promise.all([
    fs.readFile(eventsPath, "utf8"),
    fs.readFile(webhookPath, "utf8"),
    fs.readFile(manualPaymentPath, "utf8"),
  ]);

  const configurableEventsMatch = eventsContent.match(
    /export const CONFIGURABLE_NOTIFICATION_EVENTS = \[([\s\S]*?)\] as const/,
  );
  if (!configurableEventsMatch) {
    throw new Error("Could not verify configurable notification events.");
  }

  if (/"admin\.payment\.received"/.test(configurableEventsMatch[1] ?? "")) {
    throw new Error(
      'Critical owner alert "admin.payment.received" must remain non-configurable unless explicitly re-approved.',
    );
  }

  if (!/event:\s*"admin\.payment\.received"/.test(webhookContent)) {
    throw new Error("Stripe payment completion flow must continue dispatching admin.payment.received.");
  }

  const paymentSuccessFunctionMatch = webhookContent.match(
    /async function emitPaymentSucceededNotifications\([\s\S]*?\n\}/,
  );
  if (!paymentSuccessFunctionMatch) {
    throw new Error("Could not verify emitPaymentSucceededNotifications.");
  }

  if (/if \(!input\.userId\) \{\s*return;\s*\}/.test(paymentSuccessFunctionMatch[0])) {
    throw new Error(
      "emitPaymentSucceededNotifications may not short-circuit owner alerts when user resolution is incomplete.",
    );
  }

  if (!/markAdminOrderManualPaid[\s\S]*event:\s*"admin\.payment\.received"/.test(manualPaymentContent)) {
    throw new Error("Manual mark-paid recovery flow must dispatch admin.payment.received.");
  }
}

async function main() {
  await assertManifestMetadata();
  await assertRouteManifestMatchesRuntime();
  await assertProtectedRoutesUseRequireAuth();
  await assertAdminRoutesUseRequireAdmin();
  await assertValidationPolicies();
  await assertRouteFilesUseSharedContract();
  await assertNotificationBoundaries();
  await assertCriticalPaymentNotificationGuardrails();
}

void main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
