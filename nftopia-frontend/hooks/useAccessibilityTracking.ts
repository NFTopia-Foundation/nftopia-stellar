// Hook for tracking accessibility interactions (keyboard nav, focus)
import { useEffect } from "react";
import { trackAccessibilityInteraction } from "../lib/telemetry/ui/performance-tracker";
import { DeviceType } from "../lib/telemetry/ui/types";

export function useAccessibilityTracking(deviceType: DeviceType) {
  useEffect(() => {
    let lastElement: string = "";
    function handleKeydown(e: KeyboardEvent) {
      if (["Tab", "ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight"].includes(e.key)) {
        const direction = e.key === "Tab" ? (e.shiftKey ? "backward" : "forward") :
          e.key === "ArrowUp" ? "up" : e.key === "ArrowDown" ? "down" : "forward";
        const active = document.activeElement as HTMLElement;
        const after = active?.getAttribute("data-telemetry-id") || active?.id || "unknown";
        trackAccessibilityInteraction({
          interaction: "keyboard_nav",
          direction,
          elementBefore: lastElement,
          elementAfter: after,
          deviceType,
          timestamp: Date.now(),
        });
        lastElement = after;
      }
    }
    window.addEventListener("keydown", handleKeydown);
    return () => window.removeEventListener("keydown", handleKeydown);
  }, [deviceType]);
}
