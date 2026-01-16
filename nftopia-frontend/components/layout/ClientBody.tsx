import React, { useEffect, useRef } from "react";
import { useTheme } from "../../lib/stores/preferences-store";
import { useSidebar } from "../../lib/stores/app-store";
import { cn } from "../../lib/utils";

export interface ClientBodyProps {
  children: React.ReactNode;
  header?: React.ReactNode;
  footer?: React.ReactNode;
  loading?: boolean;
  showSidebar?: boolean;
  sidebar?: React.ReactNode;
  className?: string;
  "aria-label"?: string;
}

export const ClientBody: React.FC<ClientBodyProps> = ({
  children,
  header,
  footer,
  loading = false,
  showSidebar = false,
  sidebar,
  className,
  "aria-label": ariaLabel = "Main content",
}) => {
  const { theme, setTheme } = useTheme();
  const { sidebarOpen, toggleSidebar, closeSidebar } = useSidebar();
  const mainRef = useRef<HTMLDivElement>(null);

  // Theme switching (Tailwind dark mode)
  useEffect(() => {
    if (typeof window !== "undefined") {
      document.documentElement.classList.toggle("dark", theme.mode === "dark");
    }
  }, [theme.mode]);

  // Focus management for accessibility
  useEffect(() => {
    if (sidebarOpen && showSidebar && sidebar) {
      // Focus the sidebar when opened
      const sidebarEl = document.getElementById("clientbody-sidebar");
      sidebarEl?.focus();
    } else {
      // Focus main content when sidebar closes
      mainRef.current?.focus();
    }
  }, [sidebarOpen, showSidebar, sidebar]);

  // Scroll lock when sidebar is open (mobile)
  useEffect(() => {
    if (sidebarOpen && showSidebar) {
      document.body.style.overflow = "hidden";
    } else {
      document.body.style.overflow = "";
    }
    return () => {
      document.body.style.overflow = "";
    };
  }, [sidebarOpen, showSidebar]);

  return (
    <div
      className={cn(
        "min-h-[100svh] flex flex-col bg-background text-foreground transition-colors duration-300",
        theme.mode === "dark" ? "dark" : "",
        className
      )}
      aria-label={ariaLabel}
    >
      {/* Header */}
      {header && <header className="sticky top-0 z-40 w-full">{header}</header>}

      {/* Sidebar (slide-in for mobile, static for desktop) */}
      {showSidebar && sidebar && (
        <aside
          id="clientbody-sidebar"
          tabIndex={-1}
          aria-label="Sidebar"
          className={cn(
            "fixed inset-y-0 left-0 z-50 w-64 bg-background border-r border-border shadow-lg transition-transform duration-300 ease-in-out",
            sidebarOpen ? "translate-x-0" : "-translate-x-full",
            "focus:outline-none",
            "md:static md:translate-x-0 md:shadow-none md:border-none"
          )}
          role="complementary"
        >
          {sidebar}
          {/* Close button for mobile */}
          <button
            className="absolute top-4 right-4 md:hidden p-2 rounded-full bg-gray-800/70 hover:bg-gray-700 text-white focus:outline-none focus:ring-2 focus:ring-purple-400"
            onClick={closeSidebar}
            aria-label="Close sidebar"
          >
            ×
          </button>
        </aside>
      )}

      {/* Main content area */}
      <main
        ref={mainRef}
        tabIndex={-1}
        className={cn(
          "flex-1 flex flex-col focus:outline-none transition-all duration-300",
          showSidebar && sidebar ? "md:ml-64" : "",
          loading ? "pointer-events-none opacity-60" : ""
        )}
        aria-busy={loading}
        aria-live="polite"
        aria-label="Main content"
      >
        {/* Loading skeleton */}
        {loading ? (
          <div className="flex-1 flex items-center justify-center animate-pulse">
            <div className="w-32 h-32 bg-gray-300 dark:bg-gray-700 rounded-full" />
          </div>
        ) : (
          children
        )}
      </main>

      {/* Footer */}
      {footer && <footer className="w-full mt-auto">{footer}</footer>}
    </div>
  );
};
