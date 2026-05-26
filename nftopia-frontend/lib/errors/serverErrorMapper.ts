type FieldErrors = Record<string, string>;

interface MappedError {
  fieldErrors: FieldErrors;
  formError: string;
}

interface ServerErrorPayload {
  errors?: Record<string, string | string[]>;
  message?: string;
  error?: string;
}

export function mapServerError(err: unknown): MappedError {
  const fieldErrors: FieldErrors = {};
  let formError = "Something went wrong. Please try again.";

  if (!err || typeof err !== "object") return { fieldErrors, formError };

  const payload = err as ServerErrorPayload;

  // Known shape: { errors: { fieldName: "message" | ["message"] } }
  if (payload.errors && typeof payload.errors === "object") {
    for (const [field, msg] of Object.entries(payload.errors)) {
      fieldErrors[field] = Array.isArray(msg) ? msg[0] : msg;
    }
    return { fieldErrors, formError: "" };
  }

  // Single string message
  if (typeof payload.message === "string") {
    formError = payload.message;
  } else if (typeof payload.error === "string") {
    formError = payload.error;
  }

  return { fieldErrors, formError };
}
