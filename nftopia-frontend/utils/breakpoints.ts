// Responsive breakpoints for mobile-first design
export const BREAKPOINTS = {
  xs: 475,
  sm: 576,
  md: 768,
  lg: 992,
  xl: 1200,
  "2xl": 1440,
};

export type BreakpointKey = keyof typeof BREAKPOINTS;

// Helper to get media query string for a breakpoint
export function getBreakpointQuery(
  breakpoint: BreakpointKey,
  type: "min" | "max" = "min"
) {
  const px = BREAKPOINTS[breakpoint];
  return `(${type}-width: ${px}px)`;
}

// Device type detection helpers
export const DEVICE_TYPES = {
  mobile: "(max-width: 575px)",
  tablet: "(min-width: 576px) and (max-width: 991px)",
  desktop: "(min-width: 992px)",
} as const;

// Responsive spacing values
export const SPACING = {
  xs: "1rem", // 16px
  sm: "1.5rem", // 24px
  md: "2rem", // 32px
  lg: "3rem", // 48px
  xl: "4rem", // 64px
} as const;

// Responsive font sizes
export const FONT_SIZES = {
  xs: "0.75rem", // 12px
  sm: "0.875rem", // 14px
  base: "1rem", // 16px
  lg: "1.125rem", // 18px
  xl: "1.25rem", // 20px
  "2xl": "1.5rem", // 24px
  "3xl": "1.875rem", // 30px
  "4xl": "2.25rem", // 36px
} as const;
