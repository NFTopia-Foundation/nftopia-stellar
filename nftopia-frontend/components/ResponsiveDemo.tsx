import React from "react";
import { useMobile, useMediaQuery } from "@/hooks";
import { BREAKPOINTS, getBreakpointQuery } from "@/utils/breakpoints";

export const ResponsiveDemo: React.FC = () => {
  const isMobile = useMobile(); // default: 640px
  const isMd = useMediaQuery(getBreakpointQuery("md", "min"));
  const isDesktop = useMediaQuery(getBreakpointQuery("lg", "min"));
  const isTablet = isMd && !isDesktop;

  return (
    <div
      style={{
        padding: 24,
        background: "#181359",
        color: "#fff",
        borderRadius: 12,
      }}
    >
      <h2>Responsive Demo</h2>
      <div>
        <strong>Device Type:</strong> {isMobile && "Mobile"}
        {isTablet && "Tablet"}
        {isDesktop && "Desktop"}
      </div>
      <div style={{ marginTop: 16 }}>
        <div style={{ display: isMobile ? "block" : "none" }}>
          <p>📱 This is mobile layout (width &lt; {BREAKPOINTS.sm}px)</p>
        </div>
        <div style={{ display: isTablet ? "block" : "none" }}>
          <p>
            💻 This is tablet layout (width ≥ {BREAKPOINTS.md}px and &lt;{" "}
            {BREAKPOINTS.lg}px)
          </p>
        </div>
        <div style={{ display: isDesktop ? "block" : "none" }}>
          <p>🖥️ This is desktop layout (width ≥ {BREAKPOINTS.lg}px)</p>
        </div>
      </div>
    </div>
  );
};
