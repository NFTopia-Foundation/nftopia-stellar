import { useParams } from "next/navigation";

// Utility to get current locale from params
export function useCurrentLocale() {
  const params = useParams();
  return params.locale as string;
}

// Utility to build localized routes
export function buildLocalizedRoute(locale: string, path: string): string {
  // Ensure path starts with /
  const normalizedPath = path.startsWith("/") ? path : `/${path}`;
  // Build /{locale}{path}
  return `/${locale}${normalizedPath}`;
}

// Hook to get a function that builds localized routes with current locale
export function useLocalizedRoute() {
  const locale = useCurrentLocale();
  return (path: string) => buildLocalizedRoute(locale, path);
}
