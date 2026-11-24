import { ActionConflict, ServerState } from "./types";

export type ReplayFailureKind = "conflict" | "retryable" | "fatal";

export interface ReplayFailure {
  kind: ReplayFailureKind;
  message: string;
  conflict?: ActionConflict;
}

/** Thrown by adapters when the server reports a 409 / revision mismatch. */
export class OfflineActionConflictError extends Error {
  readonly conflict: ActionConflict;

  constructor(
    message: string,
    options: {
      serverRevision?: string;
      serverState?: ServerState;
      detectedAt?: number;
    } = {},
  ) {
    super(message);
    this.name = "OfflineActionConflictError";
    this.conflict = {
      code: "CONFLICT",
      message,
      serverRevision: options.serverRevision,
      serverState: options.serverState,
      detectedAt: options.detectedAt ?? Date.now(),
    };
  }
}

type UnknownRecord = Record<string, unknown>;

function isRecord(value: unknown): value is UnknownRecord {
  return typeof value === "object" && value !== null;
}

function firstString(...values: unknown[]): string | undefined {
  for (const value of values) {
    if (typeof value === "string" && value.length > 0) return value;
  }
  return undefined;
}

function firstNumber(...values: unknown[]): number | undefined {
  for (const value of values) {
    if (typeof value === "number" && Number.isFinite(value)) return value;
  }
  return undefined;
}

function nested(value: unknown, path: string[]): UnknownRecord | undefined {
  let current: unknown = value;
  for (const key of path) {
    if (!isRecord(current)) return undefined;
    current = current[key];
  }
  return isRecord(current) ? current : undefined;
}

/**
 * Normalizes transport-specific errors (fetch, Apollo/GraphQL, REST payloads)
 * into a single classification used by the replay loop.
 */
export function classifyReplayError(
  error: unknown,
  now: number = Date.now(),
): ReplayFailure {
  if (error instanceof OfflineActionConflictError) {
    return { kind: "conflict", message: error.message, conflict: error.conflict };
  }

  const record = isRecord(error) ? error : {};
  const response = nested(record, ["response"]) ?? nested(record, ["networkError"]);
  const graphQlError = Array.isArray(record.graphQLErrors)
    ? record.graphQLErrors.find(isRecord)
    : undefined;
  const extensions =
    nested(record, ["extensions"]) ??
    nested(graphQlError ?? {}, ["extensions"]) ??
    nested(response, ["extensions"]);
  const data = nested(record, ["data"]) ?? nested(response, ["data"]);

  const status =
    firstNumber(
      record.status,
      record.statusCode,
      response?.status,
      response?.statusCode,
      graphQlError?.status,
    ) ?? 0;
  const code = (
    firstString(record.code, extensions?.code, graphQlError?.code) ?? ""
  ).toUpperCase();
  const message =
    firstString(record.message, graphQlError?.message) ??
    "The action could not be synchronized.";

  const conflictSignal =
    status === 409 ||
    code === "CONFLICT" ||
    /conflict|revision mismatch|stale revision|version mismatch/i.test(message);

  if (conflictSignal) {
    const serverState =
      record.serverState ??
      extensions?.serverState ??
      data?.serverState ??
      nested(data ?? {}, ["result"])?.serverState;
    const responseHeaders = isRecord(response?.headers) ? response.headers : undefined;
    const etag =
      typeof responseHeaders?.get === "function"
        ? responseHeaders.get("etag")
        : undefined;
    const serverRevision = firstString(
      record.serverRevision,
      record.revision,
      extensions?.serverRevision,
      data?.serverRevision,
      etag,
    );
    return {
      kind: "conflict",
      message,
      conflict: {
        code: "CONFLICT",
        message,
        serverRevision,
        serverState: isRecord(serverState) ? (serverState as ServerState) : undefined,
        detectedAt: now,
      },
    };
  }

  const fatal =
    [400, 401, 403, 422].includes(status) ||
    ["VALIDATION_ERROR", "UNAUTHORIZED", "FORBIDDEN", "BAD_USER_INPUT"].includes(code);

  return { kind: fatal ? "fatal" : "retryable", message };
}

/** True for failures that are worth capturing for later replay. */
export function isRetryableFailure(error: unknown): boolean {
  return classifyReplayError(error).kind === "retryable";
}
