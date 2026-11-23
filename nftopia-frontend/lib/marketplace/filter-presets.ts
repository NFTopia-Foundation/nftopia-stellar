/**
 * Saved marketplace filter presets (#752). A preset is a user-chosen name plus
 * the serialized marketplace search params (minPrice, maxPrice, category,
 * sortBy, search, …). Presets live in localStorage, namespaced per signed-in
 * user so two accounts on the same browser don't see each other's presets.
 *
 * Every storage access is wrapped: a missing/blocked localStorage (private
 * mode, SSR, quota exceeded) or corrupt JSON must never break filtering —
 * callers get an empty list or a typed failure instead of an exception.
 */

export const MAX_FILTER_PRESETS = 10;
export const MAX_PRESET_NAME_LENGTH = 40;
const STORAGE_PREFIX = "nftopia:marketplace-filter-presets";
const ANONYMOUS_KEY = "anonymous";

/** Params a preset never stores: pagination/cursors are not part of a "filter". */
const EXCLUDED_PARAMS = new Set(["page", "after", "cursor"]);

export interface FilterPreset {
  id: string;
  name: string;
  /** Serialized URLSearchParams, e.g. "category=art&maxPrice=50". */
  query: string;
  createdAt: string;
}

export type SavePresetResult =
  | { ok: true; preset: FilterPreset; presets: FilterPreset[] }
  | { ok: false; reason: "empty-name" | "no-filters" | "limit-reached" | "storage-unavailable" };

/** Minimal Storage surface, so tests can inject a failing or in-memory store. */
export type PresetStorage = Pick<Storage, "getItem" | "setItem">;

export function presetStorageKey(userId?: string | null): string {
  return `${STORAGE_PREFIX}:${userId || ANONYMOUS_KEY}`;
}

/** Returns window.localStorage, or null when it is unavailable or throws on access. */
export function getBrowserStorage(): PresetStorage | null {
  try {
    if (typeof window === "undefined" || !window.localStorage) return null;
    return window.localStorage;
  } catch {
    return null;
  }
}

/** Canonical preset query: drops empty and excluded params, sorts keys for stable comparison. */
export function serializeFilters(params: URLSearchParams | string): string {
  const source = typeof params === "string" ? new URLSearchParams(params) : params;
  const entries: [string, string][] = [];
  source.forEach((value, key) => {
    if (value !== "" && !EXCLUDED_PARAMS.has(key)) entries.push([key, value]);
  });
  entries.sort(([a], [b]) => a.localeCompare(b));
  return new URLSearchParams(entries).toString();
}

function isPreset(value: unknown): value is FilterPreset {
  if (!value || typeof value !== "object") return false;
  const p = value as Record<string, unknown>;
  return (
    typeof p.id === "string" &&
    typeof p.name === "string" &&
    typeof p.query === "string" &&
    typeof p.createdAt === "string"
  );
}

/** Loads presets, ignoring corrupt entries. Never throws. */
export function loadPresets(
  userId?: string | null,
  storage: PresetStorage | null = getBrowserStorage(),
): FilterPreset[] {
  if (!storage) return [];
  try {
    const raw = storage.getItem(presetStorageKey(userId));
    if (!raw) return [];
    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.filter(isPreset).slice(0, MAX_FILTER_PRESETS);
  } catch {
    return [];
  }
}

function writePresets(
  presets: FilterPreset[],
  userId: string | null | undefined,
  storage: PresetStorage | null,
): boolean {
  if (!storage) return false;
  try {
    storage.setItem(presetStorageKey(userId), JSON.stringify(presets));
    return true;
  } catch {
    return false;
  }
}

function newId(): string {
  try {
    if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
      return crypto.randomUUID();
    }
  } catch {
    // fall through
  }
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
}

/**
 * Saves the given filters under `name`. Saving an existing name (case-
 * insensitive) replaces that preset instead of creating a duplicate, and does
 * not count against the cap.
 */
export function savePreset(
  name: string,
  params: URLSearchParams | string,
  userId?: string | null,
  storage: PresetStorage | null = getBrowserStorage(),
): SavePresetResult {
  const trimmed = name.trim().slice(0, MAX_PRESET_NAME_LENGTH);
  if (!trimmed) return { ok: false, reason: "empty-name" };

  const query = serializeFilters(params);
  if (!query) return { ok: false, reason: "no-filters" };

  if (!storage) return { ok: false, reason: "storage-unavailable" };

  const existing = loadPresets(userId, storage);
  const sameName = existing.find(
    (p) => p.name.toLocaleLowerCase() === trimmed.toLocaleLowerCase(),
  );

  if (!sameName && existing.length >= MAX_FILTER_PRESETS) {
    return { ok: false, reason: "limit-reached" };
  }

  const preset: FilterPreset = {
    id: sameName?.id ?? newId(),
    name: trimmed,
    query,
    createdAt: new Date().toISOString(),
  };
  const presets = sameName
    ? existing.map((p) => (p.id === sameName.id ? preset : p))
    : [...existing, preset];

  if (!writePresets(presets, userId, storage)) {
    return { ok: false, reason: "storage-unavailable" };
  }
  return { ok: true, preset, presets };
}

/** Deletes a preset by id. Returns the remaining presets (unchanged list if storage fails). */
export function deletePreset(
  id: string,
  userId?: string | null,
  storage: PresetStorage | null = getBrowserStorage(),
): FilterPreset[] {
  const existing = loadPresets(userId, storage);
  const remaining = existing.filter((p) => p.id !== id);
  if (remaining.length === existing.length) return existing;
  return writePresets(remaining, userId, storage) ? remaining : existing;
}
