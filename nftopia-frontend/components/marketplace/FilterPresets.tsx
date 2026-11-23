"use client";

import { useEffect, useId, useState } from "react";
import { Button } from "@/components/ui/button";
import { useTranslation } from "@/hooks/useTranslation";
import {
  MAX_FILTER_PRESETS,
  MAX_PRESET_NAME_LENGTH,
  deletePreset,
  loadPresets,
  savePreset,
  serializeFilters,
  type FilterPreset,
} from "@/lib/marketplace/filter-presets";

interface FilterPresetsProps {
  /** Signed-in user id; presets are stored per user (or shared "anonymous"). */
  userId?: string | null;
  /** The marketplace's current URL search params. */
  currentQuery: string;
  /** Replaces the URL search params with the preset's query. */
  onApply: (query: string) => void;
}

const fieldClass =
  "bg-[#1E1A45] border border-purple-900/30 rounded-full px-4 py-2 text-sm text-white focus:outline-none focus:border-purple-500";

/**
 * Save / apply / delete named marketplace filter presets (#752). Presets are
 * persisted in localStorage; if storage is unavailable or corrupt the list is
 * simply empty and saving reports a message — filtering itself is unaffected.
 */
export function FilterPresets({ userId, currentQuery, onApply }: FilterPresetsProps) {
  const { t } = useTranslation();
  const nameId = useId();
  const selectId = useId();
  const [presets, setPresets] = useState<FilterPreset[]>([]);
  const [selectedId, setSelectedId] = useState("");
  const [name, setName] = useState("");
  const [message, setMessage] = useState<{ text: string; error: boolean } | null>(null);

  // Read storage after mount only: localStorage doesn't exist during SSR and
  // reading it in render would cause a hydration mismatch.
  useEffect(() => {
    const loaded = loadPresets(userId);
    setPresets(loaded);
    setSelectedId((id) => (loaded.some((p) => p.id === id) ? id : ""));
  }, [userId]);

  const hasFilters = serializeFilters(currentQuery) !== "";
  const selected = presets.find((p) => p.id === selectedId) ?? null;

  const handleSave = () => {
    const result = savePreset(name, currentQuery, userId);
    if (result.ok) {
      setPresets(result.presets);
      setSelectedId(result.preset.id);
      setName("");
      setMessage({ text: t("marketplace.presets.saved", { name: result.preset.name }), error: false });
      return;
    }
    const key = {
      "empty-name": "marketplace.presets.errors.emptyName",
      "no-filters": "marketplace.presets.errors.noFilters",
      "limit-reached": "marketplace.presets.errors.limitReached",
      "storage-unavailable": "marketplace.presets.errors.storageUnavailable",
    }[result.reason];
    setMessage({ text: t(key, { max: MAX_FILTER_PRESETS }), error: true });
  };

  const handleApply = () => {
    if (!selected) return;
    onApply(selected.query);
    setMessage({ text: t("marketplace.presets.applied", { name: selected.name }), error: false });
  };

  const handleDelete = () => {
    if (!selected) return;
    const remaining = deletePreset(selected.id, userId);
    if (remaining.some((p) => p.id === selected.id)) {
      setMessage({ text: t("marketplace.presets.errors.storageUnavailable"), error: true });
      return;
    }
    setPresets(remaining);
    setSelectedId("");
    setMessage({ text: t("marketplace.presets.deleted", { name: selected.name }), error: false });
  };

  return (
    <div className="flex flex-wrap gap-2 items-center" data-testid="filter-presets">
      <label htmlFor={nameId} className="sr-only">
        {t("marketplace.presets.nameLabel")}
      </label>
      <input
        id={nameId}
        type="text"
        maxLength={MAX_PRESET_NAME_LENGTH}
        placeholder={t("marketplace.presets.namePlaceholder")}
        value={name}
        onChange={(e) => setName(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter") {
            e.preventDefault();
            handleSave();
          }
        }}
        className={`${fieldClass} w-40`}
      />
      <Button
        type="button"
        variant="ghost"
        onClick={handleSave}
        disabled={!hasFilters}
        className="text-purple-400 hover:text-purple-300"
      >
        {t("marketplace.presets.save")}
      </Button>

      <label htmlFor={selectId} className="sr-only">
        {t("marketplace.presets.listLabel")}
      </label>
      <select
        id={selectId}
        value={selectedId}
        onChange={(e) => setSelectedId(e.target.value)}
        disabled={presets.length === 0}
        className={fieldClass}
      >
        <option value="">
          {presets.length === 0 ? t("marketplace.presets.none") : t("marketplace.presets.choose")}
        </option>
        {presets.map((p) => (
          <option key={p.id} value={p.id}>
            {p.name}
          </option>
        ))}
      </select>
      <Button
        type="button"
        variant="ghost"
        onClick={handleApply}
        disabled={!selected}
        className="text-purple-400 hover:text-purple-300"
      >
        {t("marketplace.presets.apply")}
      </Button>
      <Button
        type="button"
        variant="ghost"
        onClick={handleDelete}
        disabled={!selected}
        className="text-red-400 hover:text-red-300"
      >
        {t("marketplace.presets.delete")}
      </Button>

      <p
        role="status"
        className={`w-full text-xs ${message?.error ? "text-red-400" : "text-gray-400"}`}
      >
        {message?.text ?? ""}
      </p>
    </div>
  );
}
