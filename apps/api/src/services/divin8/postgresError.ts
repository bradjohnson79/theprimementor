export interface InspectedPostgresError {
  code: string | null;
  message: string | null;
  detail: string | null;
  hint: string | null;
  constraint: string | null;
  table: string | null;
  column: string | null;
}

function readString(value: unknown): string | null {
  return typeof value === "string" && value.trim() ? value : null;
}

export function inspectPostgresError(error: unknown): InspectedPostgresError {
  const inspected: InspectedPostgresError = {
    code: null,
    message: null,
    detail: null,
    hint: null,
    constraint: null,
    table: null,
    column: null,
  };

  let current: unknown = error;
  for (let depth = 0; depth < 6 && current && typeof current === "object"; depth += 1) {
    const record = current as Record<string, unknown>;
    inspected.code ??= readString(record.code);
    inspected.message ??= readString(record.message);
    inspected.detail ??= readString(record.detail);
    inspected.hint ??= readString(record.hint);
    inspected.constraint ??= readString(record.constraint);
    inspected.table ??= readString(record.table);
    inspected.column ??= readString(record.column);
    current = record.cause;
  }

  return inspected;
}

export function postgresErrorText(error: unknown) {
  const inspected = inspectPostgresError(error);
  return [inspected.code, inspected.constraint, inspected.table, inspected.column, inspected.detail, inspected.hint, inspected.message]
    .filter(Boolean)
    .join(" ");
}
