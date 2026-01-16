// Shared types for custom hooks
import type { BreakpointKey } from "../utils/breakpoints";

// Discriminated union for breakpoint queries
export type BreakpointQuery =
  | { type: "min" | "max"; breakpoint: BreakpointKey }
  | { type: "custom"; query: string };

// Return type for useMobile
export type UseMobileReturn = boolean;

// Return type for useMediaQuery
export type UseMediaQueryReturn = boolean;
