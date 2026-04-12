export interface ApiSuccess<T> {
  success: true;
  data: T;
}

export interface ApiFailure<T extends Record<string, unknown> | undefined = undefined> {
  success: false;
  error: string;
  data?: T;
}

export type ApiResult<T, TErrorData extends Record<string, unknown> | undefined = undefined> =
  | ApiSuccess<T>
  | ApiFailure<TErrorData>;

export function ok<T>(data: T): ApiSuccess<T> {
  return {
    success: true,
    data,
  };
}

export function fail<T extends Record<string, unknown> | undefined = undefined>(
  error: string,
  data?: T,
): ApiFailure<T> {
  return {
    success: false,
    error,
    ...(data ? { data } : {}),
  };
}

interface ReplyLike {
  status: (statusCode: number) => {
    send: (payload: unknown) => unknown;
  };
  send: (payload: unknown) => unknown;
}

export function sendApiError<T extends Record<string, unknown> | undefined = undefined>(
  reply: ReplyLike,
  statusCode: number,
  error: string,
  data?: T,
) {
  return reply.status(statusCode).send(fail(error, data));
}

export function isApiResult(payload: unknown): payload is ApiResult<unknown> {
  if (!payload || typeof payload !== "object") {
    return false;
  }

  if (!("success" in payload) || typeof payload.success !== "boolean") {
    return false;
  }

  if (payload.success) {
    return "data" in payload;
  }

  return "error" in payload && typeof payload.error === "string";
}

export function shouldBypassApiEnvelope(payload: unknown, contentType: string) {
  if (contentType && !contentType.includes("application/json")) {
    return true;
  }

  if (
    payload === null
    || payload === undefined
    || typeof payload === "string"
    || typeof payload === "number"
    || typeof payload === "boolean"
    || payload instanceof Uint8Array
  ) {
    return true;
  }

  return false;
}

export function assertInternalApiEnvelope(payload: unknown) {
  if (payload === null || payload === undefined) {
    return;
  }

  if (!isApiResult(payload)) {
    const error = new Error("Internal API responses must return ok()/fail() envelopes before serialization.");
    (error as Error & { statusCode?: number }).statusCode = 500;
    throw error;
  }
}

export function toLegacyPayload(payload: ApiResult<unknown>) {
  if (payload.success) {
    return payload.data;
  }

  const failure = payload as ApiFailure<Record<string, unknown> | undefined>;
  const extra = failure.data;
  if (extra && typeof extra === "object" && !Array.isArray(extra)) {
    return {
      error: failure.error,
      ...extra,
    };
  }

  return { error: failure.error };
}
