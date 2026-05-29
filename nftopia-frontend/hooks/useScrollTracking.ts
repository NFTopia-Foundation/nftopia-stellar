// Hook for tracking scroll depth milestones
import { useEffect } from "react";
import { trackScrollDepth } from "../lib/telemetry/ui/scroll-tracker";
import { DeviceType } from "../lib/telemetry/ui/types";

export function useScrollTracking(elementsPassed: string[], deviceType: DeviceType) {
  useEffect(() => {
    function handleScroll() {
      const scrollPercent = Math.round((window.scrollY + window.innerHeight) / document.body.scrollHeight * 100);
      let milestone: 25 | 50 | 75 | 100 | null = null;
      if (scrollPercent >= 100) milestone = 100;
      else if (scrollPercent >= 75) milestone = 75;
      else if (scrollPercent >= 50) milestone = 50;
      else if (scrollPercent >= 25) milestone = 25;
      if (milestone) {
        trackScrollDepth({
          milestone,
          elementsPassed,
          deviceType,
          timestamp: Date.now(),
        });
      }
    }
    window.addEventListener("scroll", handleScroll);
    return () => window.removeEventListener("scroll", handleScroll);
  }, [elementsPassed, deviceType]);
}
