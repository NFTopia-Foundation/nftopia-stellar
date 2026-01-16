import { useEffect, useState } from "react";

export function useMediaQuery(query: string): boolean {
  const getMatches = (q: string): boolean => {
    if (typeof window !== "undefined" && window.matchMedia) {
      return window.matchMedia(q).matches;
    }
    return false;
  };

  const [matches, setMatches] = useState<boolean>(getMatches(query));

  useEffect(() => {
    let timeout: NodeJS.Timeout | null = null;
    const handleChange = () => {
      if (timeout) clearTimeout(timeout);
      timeout = setTimeout(() => {
        setMatches(getMatches(query));
      }, 100); // Debounce: 100ms
    };

    const mql = window.matchMedia(query);
    mql.addEventListener("change", handleChange);
    setMatches(mql.matches);

    return () => {
      mql.removeEventListener("change", handleChange);
      if (timeout) clearTimeout(timeout);
    };
  }, [query]);

  return matches;
}
