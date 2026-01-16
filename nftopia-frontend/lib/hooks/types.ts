import type { BreakpointKey } from "../../utils/breakpoints";

export type UseMobileOptions = {
  breakpoint?: number | BreakpointKey;
};

export type UseMobileReturn = boolean;

export type UseMediaQueryReturn = boolean;
