import {
  MAX_FILTER_PRESETS,
  deletePreset,
  loadPresets,
  presetStorageKey,
  savePreset,
  serializeFilters,
  type PresetStorage,
} from "../filter-presets";

function memoryStorage(initial: Record<string, string> = {}): PresetStorage & {
  data: Record<string, string>;
} {
  const data = { ...initial };
  return {
    data,
    getItem: (k) => (k in data ? data[k] : null),
    setItem: (k, v) => {
      data[k] = v;
    },
  };
}

const throwingStorage: PresetStorage = {
  getItem: () => {
    throw new Error("SecurityError");
  },
  setItem: () => {
    throw new Error("QuotaExceededError");
  },
};

describe("serializeFilters", () => {
  it("drops empty and pagination params and sorts keys", () => {
    expect(serializeFilters("sortBy=price_asc&minPrice=&page=3&category=art")).toBe(
      "category=art&sortBy=price_asc",
    );
  });
});

describe("savePreset / loadPresets", () => {
  it("saves and reloads a named preset", () => {
    const storage = memoryStorage();
    const result = savePreset("Cheap art", "category=art&maxPrice=50", "user-1", storage);

    expect(result.ok).toBe(true);
    const presets = loadPresets("user-1", storage);
    expect(presets).toHaveLength(1);
    expect(presets[0]).toMatchObject({ name: "Cheap art", query: "category=art&maxPrice=50" });
  });

  it("keys presets per user", () => {
    const storage = memoryStorage();
    savePreset("Mine", "category=art", "user-1", storage);

    expect(loadPresets("user-2", storage)).toEqual([]);
    expect(loadPresets(null, storage)).toEqual([]);
    expect(Object.keys(storage.data)).toEqual([presetStorageKey("user-1")]);
  });

  it("replaces a preset saved under the same name instead of duplicating", () => {
    const storage = memoryStorage();
    savePreset("Art", "category=art", "u", storage);
    savePreset("art", "category=art&maxPrice=10", "u", storage);

    const presets = loadPresets("u", storage);
    expect(presets).toHaveLength(1);
    expect(presets[0].query).toBe("category=art&maxPrice=10");
  });

  it("rejects empty names and empty filter sets", () => {
    const storage = memoryStorage();
    expect(savePreset("  ", "category=art", "u", storage)).toEqual({ ok: false, reason: "empty-name" });
    expect(savePreset("x", "page=2", "u", storage)).toEqual({ ok: false, reason: "no-filters" });
  });

  it("caps the number of stored presets", () => {
    const storage = memoryStorage();
    for (let i = 0; i < MAX_FILTER_PRESETS; i++) {
      expect(savePreset(`p${i}`, `maxPrice=${i + 1}`, "u", storage).ok).toBe(true);
    }
    expect(savePreset("one too many", "maxPrice=99", "u", storage)).toEqual({
      ok: false,
      reason: "limit-reached",
    });
    expect(loadPresets("u", storage)).toHaveLength(MAX_FILTER_PRESETS);
  });

  it("returns an empty list for corrupt storage", () => {
    const key = presetStorageKey("u");
    expect(loadPresets("u", memoryStorage({ [key]: "{not json" }))).toEqual([]);
    expect(loadPresets("u", memoryStorage({ [key]: '{"a":1}' }))).toEqual([]);
    expect(
      loadPresets("u", memoryStorage({ [key]: JSON.stringify([{ id: 1 }, { id: "a", name: "ok", query: "x=1", createdAt: "t" }]) })),
    ).toHaveLength(1);
  });

  it("never throws when storage is unavailable", () => {
    expect(loadPresets("u", throwingStorage)).toEqual([]);
    expect(loadPresets("u", null)).toEqual([]);
    expect(savePreset("x", "category=art", "u", throwingStorage)).toEqual({
      ok: false,
      reason: "storage-unavailable",
    });
    expect(savePreset("x", "category=art", "u", null)).toEqual({
      ok: false,
      reason: "storage-unavailable",
    });
    expect(deletePreset("id", "u", throwingStorage)).toEqual([]);
  });
});

describe("deletePreset", () => {
  it("removes only the given preset", () => {
    const storage = memoryStorage();
    const a = savePreset("A", "category=art", "u", storage);
    savePreset("B", "category=music", "u", storage);
    if (!a.ok) throw new Error("save failed");

    const remaining = deletePreset(a.preset.id, "u", storage);
    expect(remaining.map((p) => p.name)).toEqual(["B"]);
    expect(loadPresets("u", storage).map((p) => p.name)).toEqual(["B"]);
  });
});
