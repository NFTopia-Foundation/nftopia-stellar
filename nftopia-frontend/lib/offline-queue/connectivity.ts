/** Shared online check used by the write hook and the replay loop. */
export function isBrowserOnline(): boolean {
  return typeof navigator === "undefined" || navigator.onLine !== false;
}
