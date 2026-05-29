// Hook for tracking UI element visibility and interaction
import { useEffect } from "react";
import { trackUIElementViewed, trackUIElementInteracted } from "../lib/telemetry/ui/element-tracker";
import { DeviceType, ViewportPosition } from "../lib/telemetry/ui/types";

export function useUIElementTracking(ref: React.RefObject<HTMLElement>, element: string, deviceType: DeviceType) {
  useEffect(() => {
    if (!ref.current) return;
    const node = ref.current;
    let observer: IntersectionObserver | null = null;
    let hasTrackedView = false;
    function handleVisibility(entries: IntersectionObserverEntry[]) {
      entries.forEach(entry => {
        if (entry.isIntersecting && entry.intersectionRatio >= 0.5 && !hasTrackedView) {
          hasTrackedView = true;
          trackUIElementViewed({
            element,
            visibilityPercent: Math.round(entry.intersectionRatio * 100),
            position: entry.boundingClientRect.top < window.innerHeight / 2 ? ViewportPosition.AboveFold : ViewportPosition.BelowFold,
            deviceType,
            timestamp: Date.now(),
          });
        }
      });
    }
    observer = new window.IntersectionObserver(handleVisibility, { threshold: [0.5] });
    observer.observe(node);
    return () => {
      observer && observer.disconnect();
    };
  }, [ref, element, deviceType]);
}
