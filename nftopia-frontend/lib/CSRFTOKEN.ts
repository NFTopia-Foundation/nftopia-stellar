import { API_CONFIG } from "./config";

/**
 * Fetches a CSRF token from the server
 * @returns The CSRF token as a string
 */
export async function getCookie(): Promise<string> {
  try {
    const csrfRes = await fetch(`${API_CONFIG.baseUrl}/auth/csrf-token`, {
      credentials: "include",
    });

    if (!csrfRes.ok) {
      throw new Error("Failed to fetch CSRF token");
    }

    const { csrfToken } = await csrfRes.json();
    return csrfToken;
  } catch (error) {
    console.error("Error fetching CSRF token:", error);
    throw error;
  }
}
