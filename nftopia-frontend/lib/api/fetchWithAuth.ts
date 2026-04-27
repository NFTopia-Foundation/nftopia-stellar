import { useAuthStore } from "@/lib/stores/auth-store";

/**
 * Fetch with automatic JWT attach and refresh on 401/expired.
 * Usage: await fetchWithAuth(url, options)
 */
export async function fetchWithAuth(
  input: RequestInfo,
  init?: RequestInit,
  retry = true
): Promise<Response> {
  // Get tokens from localStorage (not Zustand, to avoid stale closure)
  const accessToken = typeof window !== "undefined" ? localStorage.getItem("access_token") : null;
  const refreshToken = typeof window !== "undefined" ? localStorage.getItem("refresh_token") : null;

  // Attach Authorization header if accessToken exists
  const headers = new Headers(init?.headers || {});
  if (accessToken) {
    headers.set("Authorization", `Bearer ${accessToken}`);
  }

  const response = await fetch(input, { ...init, headers });

  // If unauthorized and we have a refresh token, try to refresh
  if (response.status === 401 && refreshToken && retry) {
    try {
      // Use the auth store's refreshToken method from Zustand
      const { refreshToken, logout } = useAuthStore.getState();
      await refreshToken();
      // Retry the original request with new token
      const newAccessToken = typeof window !== "undefined" ? localStorage.getItem("access_token") : null;
      if (newAccessToken) {
        headers.set("Authorization", `Bearer ${newAccessToken}`);
        return fetch(input, { ...init, headers });
      }
    } catch (err) {
      // Refresh failed, log out
      const { logout } = useAuthStore.getState();
      await logout();
      throw new Error("Session expired. Please log in again.");
    }
  }

  return response;
}
