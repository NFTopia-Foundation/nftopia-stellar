import { useAuthStore } from "@/lib/stores/auth-store";
import { parseResponseError, normalizeApiError } from "@/utils/fetchUtils";

const DEFAULT_TIMEOUT_MS = 15000;

// Shared singleton promise to batch concurrent duplicate token refresh calls cleanly
let refreshPromise: Promise<any> | null = null;

/**
 * Fetch layer with built-in client timeout processing,
 * concurrency-safe automated JWT management, and unified error payload interceptors.
 * Usage: await fetchWithAuth(url, options)
 */
export async function fetchWithAuth(
  input: RequestInfo,
  init?: RequestInit,
  retry = true,
): Promise<Response> {
  const accessToken =
    typeof window !== "undefined"
      ? (localStorage.getItem("access_token") || sessionStorage.getItem("access_token"))
      : null;
  const refreshToken =
    typeof window !== "undefined"
      ? (localStorage.getItem("refresh_token") || sessionStorage.getItem("refresh_token"))
      : null;

  const headers = new Headers(init?.headers || {});
  if (accessToken) {
    headers.set("Authorization", `Bearer ${accessToken}`);
  }

  // Synthesize client timeout using a unified AbortController signal
  const clientController = new AbortController();
  const timeoutId = setTimeout(
    () => clientController.abort(),
    DEFAULT_TIMEOUT_MS,
  );

  // Link external signals if passed down via configuration parameters
  if (init?.signal) {
    init.signal.addEventListener("abort", () => clientController.abort());
  }

  try {
    const response = await fetch(input, {
      ...init,
      headers,
      signal: clientController.signal,
    });

    clearTimeout(timeoutId);

    // Trap token expiration windows natively
    if (response.status === 401 && refreshToken && retry) {
      try {
        // Concurrency-safe atomic token refresh block
        if (!refreshPromise) {
          refreshPromise = (async () => {
            try {
              const { refreshToken: performRefresh } = useAuthStore.getState();
              return await performRefresh();
            } finally {
              refreshPromise = null;
            }
          })();
        }

        // Await single active network execution block
        await refreshPromise;

        const newAccessToken =
          typeof window !== "undefined"
            ? (localStorage.getItem("access_token") || sessionStorage.getItem("access_token"))
            : null;
        if (newAccessToken) {
          headers.set("Authorization", `Bearer ${newAccessToken}`);

          // Construct unique cancellation controllers specifically for the retry execution frame
          const retryController = new AbortController();
          const retryTimeoutId = setTimeout(
            () => retryController.abort(),
            DEFAULT_TIMEOUT_MS,
          );
          if (init?.signal) {
            init.signal.addEventListener("abort", () =>
              retryController.abort(),
            );
          }

          const retryResponse = await fetch(input, {
            ...init,
            headers,
            signal: retryController.signal,
          });

          clearTimeout(retryTimeoutId);

          if (!retryResponse.ok) {
            throw await parseResponseError(retryResponse);
          }
          return retryResponse;
        }
      } catch (err) {
        // Refresh failed completely; clear the session
        const { logout } = useAuthStore.getState();
        await logout();
        throw await parseResponseError(response);
      }
    }

    if (!response.ok) {
      throw await parseResponseError(response);
    }

    return response;
  } catch (error) {
    clearTimeout(timeoutId);
    throw await normalizeApiError(error);
  }
}
