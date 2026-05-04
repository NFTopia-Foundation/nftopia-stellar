"use client";

import React, {
  createContext,
  useContext,
  useEffect,
  useRef,
  useState,
  useCallback,
  KeyboardEvent,
} from "react";
import { cn } from "@/lib/utils";

// ---------------------------------------------------------------------------
// Context
// ---------------------------------------------------------------------------
interface DropdownContextValue {
  open: boolean;
  setOpen: (v: boolean) => void;
  triggerId: string;
  menuId: string;
}

const DropdownContext = createContext<DropdownContextValue | null>(null);

function useDropdown() {
  const ctx = useContext(DropdownContext);
  if (!ctx) throw new Error("Dropdown compound components must be used inside <Dropdown>");
  return ctx;
}

// ---------------------------------------------------------------------------
// Root
// ---------------------------------------------------------------------------
interface DropdownProps {
  children: React.ReactNode;
  className?: string;
  /** Controlled open state */
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
}

let uid = 0;

export function Dropdown({ children, className, open: controlledOpen, onOpenChange }: DropdownProps) {
  const id = useRef(`dropdown-${++uid}`);
  const [internalOpen, setInternalOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  const isControlled = controlledOpen !== undefined;
  const open = isControlled ? controlledOpen : internalOpen;

  const setOpen = useCallback(
    (v: boolean) => {
      if (!isControlled) setInternalOpen(v);
      onOpenChange?.(v);
    },
    [isControlled, onOpenChange]
  );

  // Close on outside click
  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [open, setOpen]);

  // Close on Escape
  useEffect(() => {
    if (!open) return;
    const handler = (e: globalThis.KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("keydown", handler);
    return () => document.removeEventListener("keydown", handler);
  }, [open, setOpen]);

  return (
    <DropdownContext.Provider
      value={{
        open,
        setOpen,
        triggerId: `${id.current}-trigger`,
        menuId: `${id.current}-menu`,
      }}
    >
      <div ref={containerRef} className={cn("relative", className)}>
        {children}
      </div>
    </DropdownContext.Provider>
  );
}

// ---------------------------------------------------------------------------
// Trigger
// ---------------------------------------------------------------------------
interface DropdownTriggerProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  children: React.ReactNode;
}

export function DropdownTrigger({ children, className, ...props }: DropdownTriggerProps) {
  const { open, setOpen, triggerId, menuId } = useDropdown();

  return (
    <button
      id={triggerId}
      type="button"
      aria-haspopup="menu"
      aria-expanded={open}
      aria-controls={menuId}
      onClick={() => setOpen(!open)}
      className={cn(
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
        className
      )}
      {...props}
    >
      {children}
    </button>
  );
}

// ---------------------------------------------------------------------------
// Menu
// ---------------------------------------------------------------------------
interface DropdownMenuProps {
  children: React.ReactNode;
  className?: string;
  align?: "left" | "right";
}

export function DropdownMenu({ children, className, align = "right" }: DropdownMenuProps) {
  const { open, menuId, triggerId } = useDropdown();
  const menuRef = useRef<HTMLDivElement>(null);

  // Arrow-key navigation between menu items
  const handleKeyDown = (e: KeyboardEvent<HTMLDivElement>) => {
    const items = Array.from(
      menuRef.current?.querySelectorAll<HTMLElement>('[role="menuitem"]:not([disabled])') ?? []
    );
    if (!items.length) return;
    const idx = items.indexOf(document.activeElement as HTMLElement);

    if (e.key === "ArrowDown") {
      e.preventDefault();
      items[(idx + 1) % items.length]?.focus();
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      items[(idx - 1 + items.length) % items.length]?.focus();
    } else if (e.key === "Home") {
      e.preventDefault();
      items[0]?.focus();
    } else if (e.key === "End") {
      e.preventDefault();
      items[items.length - 1]?.focus();
    }
  };

  if (!open) return null;

  return (
    <div
      id={menuId}
      ref={menuRef}
      role="menu"
      aria-labelledby={triggerId}
      onKeyDown={handleKeyDown}
      className={cn(
        "absolute top-full mt-2 z-50 min-w-[10rem] rounded-lg border border-purple-500/20 bg-[#181359]/95 backdrop-blur-md shadow-xl overflow-hidden",
        align === "right" ? "right-0" : "left-0",
        className
      )}
    >
      {children}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Item
// ---------------------------------------------------------------------------
interface DropdownItemProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  children: React.ReactNode;
  /** Close the dropdown when this item is activated */
  closeOnSelect?: boolean;
}

export function DropdownItem({
  children,
  className,
  onClick,
  closeOnSelect = true,
  disabled,
  ...props
}: DropdownItemProps) {
  const { setOpen } = useDropdown();

  const handleClick = (e: React.MouseEvent<HTMLButtonElement>) => {
    onClick?.(e);
    if (closeOnSelect) setOpen(false);
  };

  return (
    <button
      role="menuitem"
      type="button"
      disabled={disabled}
      aria-disabled={disabled}
      onClick={handleClick}
      className={cn(
        "w-full flex items-center gap-3 px-4 py-2.5 text-sm text-left transition-colors",
        "hover:bg-purple-500/10 focus-visible:bg-purple-500/10 focus-visible:outline-none",
        "disabled:opacity-50 disabled:pointer-events-none",
        className
      )}
      {...props}
    >
      {children}
    </button>
  );
}

// ---------------------------------------------------------------------------
// Separator
// ---------------------------------------------------------------------------
export function DropdownSeparator({ className }: { className?: string }) {
  return <div role="separator" className={cn("my-1 border-t border-purple-500/20", className)} />;
}
