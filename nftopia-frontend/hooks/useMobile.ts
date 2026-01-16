import { useEffect, useState } from "react";

// Default Tailwind 'sm' breakpoint (mobile: <640px)
const DEFAULT_MOBILE_BREAKPOINT = 640;

export function useMobile(
  breakpoint: number = DEFAULT_MOBILE_BREAKPOINT
): boolean {
  const [isMobile, setIsMobile] = useState<boolean>(
    typeof window !== "undefined" ? window.innerWidth < breakpoint : false
  );

  useEffect(() => {
    // SSR-safe: only run on client
    let timeout: NodeJS.Timeout | null = null;
    const handleResize = () => {
      if (timeout) clearTimeout(timeout);
      timeout = setTimeout(() => {
        setIsMobile(window.innerWidth < breakpoint);
      }, 100); // Debounce: 100ms
    };
    window.addEventListener("resize", handleResize);
    // Initial check
    setIsMobile(window.innerWidth < breakpoint);
    return () => {
      window.removeEventListener("resize", handleResize);
      if (timeout) clearTimeout(timeout);
    };
  }, [breakpoint]);

  return isMobile;
}
