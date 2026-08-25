const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:5000/api";

export type ApiOptions = RequestInit & {
  token?: string | null;
};

/**
 * Carries the HTTP status alongside the message.
 *
 * Callers need the status to tell apart "your session expired" (401, sign the
 * user out) from "you cannot do that" (403, tell them) from "the server is
 * down" (0, offer a retry). A bare Error collapses all three into a string.
 */
export class ApiError extends Error {
  status: number;
  fieldErrors: Array<{ field: string; message: string }>;
  /** Seconds to wait, when the server said how long a throttle lasts. */
  retryAfter?: number;

  constructor(
    message: string,
    status: number,
    fieldErrors: Array<{ field: string; message: string }> = [],
    retryAfter?: number
  ) {
    super(message);
    this.name = "ApiError";
    this.status = status;
    this.fieldErrors = fieldErrors;
    this.retryAfter = retryAfter;
  }

  /** No response at all: DNS failure, refused connection, offline. */
  get isNetworkError() {
    return this.status === 0;
  }

  get isAuthError() {
    return this.status === 401;
  }
}

// Wording the user sees when a request fails. Deliberately plain: raw driver and
// validation text from the server never reaches the interface.
const STATUS_MESSAGES: Record<number, string> = {
  0: "We could not reach Excel Connect Hub. Check your internet connection and try again.",
  401: "Your session has expired. Please sign in again.",
  403: "You do not have permission to do that.",
  404: "We could not find what you were looking for.",
  409: "That conflicts with something that already exists.",
  429: "Too many attempts. Please wait a moment and try again.",
  500: "Something went wrong on our side. Please try again.",
  502: "Excel Connect Hub is temporarily unavailable. Please try again shortly.",
  503: "Excel Connect Hub is temporarily unavailable. Please try again shortly."
};

export async function api<T>(path: string, options: ApiOptions = {}): Promise<T> {
  const { token, headers, ...rest } = options;

  let response: Response;
  try {
    response = await fetch(`${API_URL}${path}`, {
      ...rest,
      headers: {
        "Content-Type": "application/json",
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
        ...headers
      }
    });
  } catch (error) {
    if (process.env.NODE_ENV === "development") {
      console.error("Excel Connect Hub API request failed", { path, apiUrl: API_URL, error });
    }
    throw new ApiError(STATUS_MESSAGES[0], 0);
  }

  // 204 and other empty bodies are valid; do not treat them as a parse failure.
  const data = await response.json().catch(() => ({} as Record<string, unknown>));

  if (!response.ok) {
    const body = data as {
      message?: string;
      errors?: Array<{ field: string; message: string }>;
      retryAfter?: number;
    };
    // Field-level validation messages are written for humans and are safe to
    // surface. Everything else falls back to the status wording above so no
    // internal server text is ever rendered.
    const validationMessage = body.errors?.length ? body.errors[0].message : undefined;
    const message =
      validationMessage ||
      (response.status < 500 && body.message) ||
      STATUS_MESSAGES[response.status] ||
      "Request failed. Please try again.";

    throw new ApiError(message, response.status, body.errors || [], body.retryAfter);
  }

  return data as T;
}

/**
 * Uploads a single image and returns its public URL.
 *
 * Kept separate from `api()` because a multipart body must not carry a
 * Content-Type header set by us — the browser has to generate one that includes
 * the multipart boundary, and overriding it makes the server reject the body.
 */
export async function uploadImage(file: File, token?: string | null): Promise<{ url: string; filename: string }> {
  const body = new FormData();
  body.append("file", file);

  let response: Response;
  try {
    response = await fetch(`${API_URL}/uploads`, {
      method: "POST",
      headers: token ? { Authorization: `Bearer ${token}` } : {},
      body
    });
  } catch {
    throw new ApiError(STATUS_MESSAGES[0], 0);
  }

  const data = await response.json().catch(() => ({} as { message?: string }));

  if (!response.ok) {
    const message =
      (response.status < 500 && (data as { message?: string }).message) ||
      STATUS_MESSAGES[response.status] ||
      "That image could not be uploaded.";
    throw new ApiError(message, response.status);
  }

  return data as { url: string; filename: string };
}
