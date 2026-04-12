import type { Database } from "@wisdom/db";
import type { AdminOrder } from "./ordersService.js";
import { getAdminOrderById } from "./ordersService.js";
import { runDivin8Execution } from "./divin8EngineService.js";
import { mapOrderToDivin8Input } from "./divin8/orderToDivin8Input.js";
import {
  getOrderExecutionReport,
  markOrderExecutionState,
  persistOrderExecutionResult,
  type OrderExecutionState,
} from "./divin8OrderPersistenceService.js";
import { sendNotification } from "./notifications/notificationService.js";

type DispatcherLogger = {
  info: (payload: unknown, message?: string) => void;
  warn: (payload: unknown, message?: string) => void;
  error: (payload: unknown, message?: string) => void;
};

export interface DispatchOrderExecutionOptions {
  force?: boolean;
  trigger?: "admin" | "webhook";
  logger?: DispatcherLogger;
  retryDelaysMs?: number[];
}

export interface DispatchOrderExecutionResult {
  order_id: string;
  outcome:
    | "completed"
    | "already_completed"
    | "already_generating"
    | "awaiting_input"
    | "failed"
    | "order_not_ready";
  order: AdminOrder | null;
  output: AdminOrder["execution"]["output"];
  report_id: string | null;
  statusCode: number;
  message: string;
  details?: unknown;
}

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function createError(
  statusCode: number,
  message: string,
  details?: unknown,
): Error & { statusCode?: number; details?: unknown } {
  const error = new Error(message) as Error & { statusCode?: number; details?: unknown };
  error.statusCode = statusCode;
  error.details = details;
  return error;
}

function readStoredExecutionState(report: Awaited<ReturnType<typeof getOrderExecutionReport>>): OrderExecutionState {
  const meta = report && typeof report.meta === "object" && report.meta !== null && !Array.isArray(report.meta)
    ? report.meta as Record<string, unknown>
    : null;
  const executionState = typeof meta?.execution_state === "string" ? meta.execution_state : null;
  if (
    executionState === "idle"
    || executionState === "generating"
    || executionState === "awaiting_input"
    || executionState === "completed"
    || executionState === "failed"
  ) {
    return executionState;
  }
  if (report?.status === "generating") return "generating";
  if (report?.status === "awaiting_input") return "awaiting_input";
  if (report?.status === "failed") return "failed";
  if (report?.generated_report) return "completed";
  return "idle";
}

async function loadOrderWithRetry(
  db: Database,
  orderId: string,
  retryDelaysMs: number[],
): Promise<AdminOrder | null> {
  for (let index = 0; index <= retryDelaysMs.length; index += 1) {
    try {
      return await getAdminOrderById(db, orderId);
    } catch (error) {
      const statusCode = error instanceof Error && "statusCode" in error
        ? (error as { statusCode?: number }).statusCode
        : undefined;
      if (statusCode !== 404 || index === retryDelaysMs.length) {
        throw error;
      }
      await sleep(retryDelaysMs[index] ?? 0);
    }
  }
  return null;
}

function getExistingOutput(order: AdminOrder | null): AdminOrder["execution"]["output"] {
  return order?.execution.output ?? null;
}

export async function dispatchOrderExecution(
  db: Database,
  orderId: string,
  options: DispatchOrderExecutionOptions = {},
): Promise<DispatchOrderExecutionResult> {
  const logger = options.logger;
  const retryDelaysMs = options.retryDelaysMs ?? (options.trigger === "webhook" ? [500, 1000, 2000] : []);
  let order: AdminOrder | null;

  try {
    order = await loadOrderWithRetry(db, orderId, retryDelaysMs);
  } catch (error) {
    const statusCode = error instanceof Error && "statusCode" in error
      ? (error as { statusCode?: number }).statusCode
      : undefined;
    if (statusCode === 404) {
      logger?.warn({ orderId, trigger: options.trigger }, "divin8_order_not_ready");
      return {
        order_id: orderId,
        outcome: "order_not_ready",
        order: null,
        output: null,
        report_id: null,
        statusCode: 202,
        message: "Order not ready for execution yet.",
      };
    }
    throw error;
  }

  if (!order) {
    logger?.warn({ orderId, trigger: options.trigger }, "divin8_order_not_ready");
    return {
      order_id: orderId,
      outcome: "order_not_ready",
      order: null,
      output: null,
      report_id: null,
      statusCode: 202,
      message: "Order not ready for execution yet.",
    };
  }

  if (order.type !== "report" && order.type !== "session") {
    throw createError(400, "This order type is not eligible for Divin8 generation.");
  }

  const existingReport = await getOrderExecutionReport(db, order);
  const existingState = readStoredExecutionState(existingReport);

  if (!options.force && existingState === "generating") {
    return {
      order_id: orderId,
      outcome: "already_generating",
      order,
      output: getExistingOutput(order),
      report_id: existingReport?.id ?? order.execution.report_id ?? null,
      statusCode: 409,
      message: "Generation is already in progress.",
    };
  }

  if (!options.force && existingState === "completed" && getExistingOutput(order)) {
    return {
      order_id: orderId,
      outcome: "already_completed",
      order,
      output: getExistingOutput(order),
      report_id: existingReport?.id ?? order.execution.report_id ?? null,
      statusCode: 200,
      message: "Existing generated output returned.",
    };
  }

  const generationStartedAt = new Date().toISOString();

  try {
    const divin8Input = mapOrderToDivin8Input(order);
    await markOrderExecutionState(db, order, order.type === "report" ? (divin8Input.reading_type === "initiate" ? "initiate" : divin8Input.reading_type === "deep_dive" ? "deep_dive" : "intro") : "intro", "generating", {
      startedAt: generationStartedAt,
      lastAttemptAt: generationStartedAt,
      errorMessage: null,
    });

    logger?.info(
      { orderId, userId: order.user_id, trigger: options.trigger },
      "divin8_execution_started",
    );

    const execution = await runDivin8Execution(divin8Input);
    await persistOrderExecutionResult(db, order, execution, { force: options.force });
    const refreshedOrder = await getAdminOrderById(db, orderId);

    logger?.info(
      { orderId, userId: order.user_id, trigger: options.trigger, reportId: refreshedOrder.execution.report_id },
      "divin8_execution_completed",
    );
    if (refreshedOrder.execution.report_id) {
      void sendNotification(db, {
        event: "report.generated",
        userId: order.user_id,
        payload: {
          entityId: refreshedOrder.execution.report_id,
          orderId,
          reportId: refreshedOrder.execution.report_id,
          title: refreshedOrder.metadata.invoice_label ?? refreshedOrder.metadata.report_type ?? "Divin8 Report",
          reportTier: typeof order.metadata.report_type_id === "string" ? order.metadata.report_type_id : null,
        },
      }).catch((error) => {
        logger?.error(
          {
            orderId,
            reportId: refreshedOrder.execution.report_id,
            error: error instanceof Error ? error.message : error,
          },
          "report_generated_notification_failed",
        );
      });
    }

    return {
      order_id: orderId,
      outcome: "completed",
      order: refreshedOrder,
      output: refreshedOrder.execution.output,
      report_id: refreshedOrder.execution.report_id,
      statusCode: 200,
      message: "Divin8 output generated successfully.",
    };
  } catch (error) {
    const statusCode = error instanceof Error && "statusCode" in error
      ? (error as { statusCode?: number }).statusCode
      : undefined;
    const message = error instanceof Error ? error.message : "Divin8 generation failed.";
    const details = error instanceof Error && "details" in error ? (error as { details?: unknown }).details : undefined;
    const awaitingInput = statusCode === 400;
    const nextState: OrderExecutionState = awaitingInput ? "awaiting_input" : "failed";
    const completedAt = new Date().toISOString();
    const reportTier = order.metadata.report_type_id === "initiate"
      ? "initiate"
      : order.metadata.report_type_id === "deep_dive"
        ? "deep_dive"
        : "intro";

    await markOrderExecutionState(db, order, reportTier, nextState, {
      errorMessage: message,
      startedAt: generationStartedAt,
      completedAt: completedAt,
      durationMs: Math.max(0, new Date(completedAt).getTime() - new Date(generationStartedAt).getTime()),
      lastAttemptAt: completedAt,
    });

    const refreshedOrder = await getAdminOrderById(db, orderId);
    const outcome = awaitingInput ? "awaiting_input" : "failed";

    if (awaitingInput) {
      logger?.warn(
        { orderId, userId: order.user_id, details, trigger: options.trigger },
        "divin8_execution_awaiting_input",
      );
      return {
        order_id: orderId,
        outcome,
        order: refreshedOrder,
        output: refreshedOrder.execution.output,
        report_id: refreshedOrder.execution.report_id,
        statusCode: 400,
        message,
        details,
      };
    }

    logger?.error(
      { orderId, userId: order.user_id, details, trigger: options.trigger, error: message },
      "divin8_execution_failed",
    );
    return {
      order_id: orderId,
      outcome,
      order: refreshedOrder,
      output: refreshedOrder.execution.output,
      report_id: refreshedOrder.execution.report_id,
      statusCode: 500,
      message,
      details,
    };
  }
}
