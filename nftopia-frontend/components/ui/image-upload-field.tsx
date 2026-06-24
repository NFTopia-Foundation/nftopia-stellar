"use client";

import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type DragEvent,
} from "react";
import { ImagePlus, Redo2, Undo2 } from "lucide-react";
import { cn } from "@/lib/utils";

const MAX_HISTORY = 5;
const MAX_SIZE_MB = 5;
const ACCEPTED_TYPES = ["image/jpeg", "image/png", "image/webp", "image/gif"];

type HistoryEntry = {
  previewUrl: string | null;
  file: File | null;
  remoteUrl: string | null;
};

export type ImageUploadFieldProps = {
  label?: string;
  value?: string;
  fallbackSeed?: string;
  aspect?: "square" | "banner";
  className?: string;
  onPendingFileChange?: (file: File | null) => void;
};

function isAcceptedImage(file: File): boolean {
  return ACCEPTED_TYPES.includes(file.type);
}

export function ImageUploadField({
  label,
  value,
  fallbackSeed,
  aspect = "square",
  className,
  onPendingFileChange,
}: ImageUploadFieldProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [history, setHistory] = useState<HistoryEntry[]>([
    { previewUrl: value ?? null, file: null, remoteUrl: value ?? null },
  ]);
  const [historyIndex, setHistoryIndex] = useState(0);
  const [isDragActive, setIsDragActive] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const current = history[historyIndex];

  useEffect(() => {
    if (!value) return;
    setHistory([{ previewUrl: value, file: null, remoteUrl: value }]);
    setHistoryIndex(0);
  }, [value]);

  useEffect(() => {
    return () => {
      history.forEach((entry) => {
        if (entry.previewUrl?.startsWith("blob:")) {
          URL.revokeObjectURL(entry.previewUrl);
        }
      });
    };
  }, [history]);

  const displayUrl = useMemo(() => {
    if (current.previewUrl) return current.previewUrl;
    if (fallbackSeed) {
      return `https://api.dicebear.com/7.x/bottts-neutral/svg?seed=${encodeURIComponent(fallbackSeed)}`;
    }
    return null;
  }, [current.previewUrl, fallbackSeed]);

  const pushHistory = useCallback(
    (entry: HistoryEntry) => {
      setHistory((prev) => {
        const trimmed = prev.slice(0, historyIndex + 1);
        const next = [...trimmed, entry];
        if (next.length > MAX_HISTORY) {
          const removed = next.shift();
          if (removed?.previewUrl?.startsWith("blob:")) {
            URL.revokeObjectURL(removed.previewUrl);
          }
        }
        setHistoryIndex(next.length - 1);
        return next;
      });
    },
    [historyIndex],
  );

  const applyFile = useCallback(
    (file: File) => {
      if (!isAcceptedImage(file)) {
        setError("Use JPG, PNG, WebP, or GIF.");
        return;
      }

      if (file.size > MAX_SIZE_MB * 1024 * 1024) {
        setError(`Max ${MAX_SIZE_MB}MB.`);
        return;
      }

      setError(null);
      const previewUrl = URL.createObjectURL(file);
      pushHistory({ previewUrl, file, remoteUrl: null });
      onPendingFileChange?.(file);
    },
    [onPendingFileChange, pushHistory],
  );

  const handleFiles = useCallback(
    (files: FileList | null) => {
      const file = files?.[0];
      if (file) applyFile(file);
    },
    [applyFile],
  );

  const handleDrop = (event: DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    setIsDragActive(false);
    handleFiles(event.dataTransfer.files);
  };

  const undo = () => {
    if (historyIndex <= 0) return;
    const nextIndex = historyIndex - 1;
    setHistoryIndex(nextIndex);
    onPendingFileChange?.(history[nextIndex]?.file ?? null);
  };

  const redo = () => {
    if (historyIndex >= history.length - 1) return;
    const nextIndex = historyIndex + 1;
    setHistoryIndex(nextIndex);
    onPendingFileChange?.(history[nextIndex]?.file ?? null);
  };

  const canUndo = historyIndex > 0;
  const canRedo = historyIndex < history.length - 1;

  return (
    <div className={cn("space-y-2", className)}>
      {label ? (
        <span className="block text-sm font-medium text-card-foreground">
          {label}
        </span>
      ) : null}

      <div
        role="button"
        tabIndex={0}
        onClick={() => inputRef.current?.click()}
        onKeyDown={(event) => {
          if (event.key === "Enter" || event.key === " ") {
            event.preventDefault();
            inputRef.current?.click();
          }
        }}
        onDragEnter={(event) => {
          event.preventDefault();
          setIsDragActive(true);
        }}
        onDragOver={(event) => {
          event.preventDefault();
          setIsDragActive(true);
        }}
        onDragLeave={(event) => {
          event.preventDefault();
          setIsDragActive(false);
        }}
        onDrop={handleDrop}
        className={cn(
          "group relative overflow-hidden rounded-xl border border-dashed border-border bg-muted/20 transition-colors",
          aspect === "banner" ? "h-36 md:h-44" : "aspect-square max-w-[160px]",
          isDragActive && "border-purple-400 bg-purple-500/10",
          "cursor-pointer focus:outline-none focus-visible:ring-2 focus-visible:ring-purple-400",
        )}
        aria-label={label || "Upload image"}
      >
        <input
          ref={inputRef}
          type="file"
          accept={ACCEPTED_TYPES.join(",")}
          className="hidden"
          onChange={(event) => handleFiles(event.target.files)}
        />

        {displayUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={displayUrl}
            alt=""
            className="h-full w-full object-cover"
          />
        ) : (
          <div className="flex h-full flex-col items-center justify-center gap-2 px-4 text-center text-muted-foreground">
            <ImagePlus className="h-6 w-6 text-purple-400" />
            <p className="text-xs">Drop or click</p>
          </div>
        )}

        <div className="pointer-events-none absolute inset-0 flex items-end justify-center bg-gradient-to-t from-black/50 to-transparent p-2 opacity-0 transition-opacity group-hover:opacity-100">
          <span className="text-xs text-white">Change</span>
        </div>
      </div>

      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={undo}
          disabled={!canUndo}
          className="rounded-md border border-border p-1.5 text-muted-foreground transition-colors hover:text-foreground disabled:opacity-40"
          aria-label="Undo image change"
        >
          <Undo2 className="h-4 w-4" />
        </button>
        <button
          type="button"
          onClick={redo}
          disabled={!canRedo}
          className="rounded-md border border-border p-1.5 text-muted-foreground transition-colors hover:text-foreground disabled:opacity-40"
          aria-label="Redo image change"
        >
          <Redo2 className="h-4 w-4" />
        </button>
      </div>

      {error ? <p className="text-xs text-red-400">{error}</p> : null}
    </div>
  );
}
