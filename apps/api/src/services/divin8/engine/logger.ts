import type { Divin8CoreSystemResult, Divin8RouteDecision } from "./types.js";

function stringify(payload: unknown) {
  try {
    return JSON.stringify(payload);
  } catch {
    return "[unserializable]";
  }
}

function shouldLog() {
  return process.env.DIVIN8_ENGINE_LOGGING === "1" || process.env.NODE_ENV !== "production";
}

export function logCoreSystemEvent(stage: string, payload: Record<string, unknown>) {
  if (!shouldLog()) {
    return;
  }

  queueMicrotask(() => {
    console.info(`[divin8-core] ${stage} ${stringify(payload)}`);
  });
}

export function logRouteDecision(route: Divin8RouteDecision) {
  logCoreSystemEvent("route", {
    type: route.type,
    strict: route.strict,
    confidence: route.confidence,
    requestedSystems: route.requestedSystems,
    matchedSignals: route.matchedSignals,
  });
}

export function logCoreSystemResult(result: Divin8CoreSystemResult) {
  logCoreSystemEvent("result", {
    status: result.status,
    route: result.route.type,
    engineRun: result.engineRun,
    errorCode: result.status === "error" ? result.errorCode : null,
  });
}
