import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";
import { usePathname } from "next/navigation";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

// Re-export breakpoints utilities
export * from "../utils/breakpoints";

const locales = ["en", "fr", "es", "de"];

/**
 * Extract locale from pathname
 * @param pathname - The current pathname
 * @returns The locale string or undefined if not found
 */
export function getLocaleFromPathname(pathname: string): string | undefined {
  return locales.find(
    (locale) => pathname.startsWith(`/${locale}/`) || pathname === `/${locale}`
  );
}

/**
 * Hook to get the current locale from pathname
 * @returns The current locale string
 */
export function useLocale() {
  const pathname = usePathname();
  return getLocaleFromPathname(pathname) || "en";
}

/**
 * Build a localized route
 * @param locale - The locale to use
 * @param path - The path without locale prefix
 * @returns The localized path
 */
export function localizedRoute(locale: string, path: string): string {
  return `/${locale}${path}`;
}
