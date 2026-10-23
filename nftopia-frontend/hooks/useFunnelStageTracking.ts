"use client";

import { useEffect, useRef } from "react";
import { usePathname } from "next/navigation";
import { useAuthStore } from "@/lib/stores/auth-store";
import { telemetry } from "@/lib/telemetry";
import { resolveStageFromRoute } from "@/lib/telemetry/funnel/stage-resolver";
import { JourneySessionManager } from "@/lib/telemetry/funnel/journey-session";
import { NavigationMethod, type UserCohort } from "@/lib/telemetry/funnel/types";

/**
 * Fires `funnel_stage_entered`/`funnel_stage_exited` telemetry on every
 * route change (#662) — the piece that was missing between the funnel
 * types/stage-resolver/journey-session building blocks and any actual
 * dispatch call, so there was no real funnel data to show a dashboard.
 *
 * Mount once, near the app root (see app/[locale]/layout.tsx).
 *
 * Known simplification: `navigation_method` is always reported as
 * `DIRECT_URL` here since a pathname watcher alone can't distinguish a nav
 * click from a typed URL — call `telemetry.track` directly with a more
 * specific `navigation_method` from a click handler if that distinction
 * becomes important for a specific funnel step.
 */
export function useFunnelStageTracking(): void {
  const pathname = usePathname();
  const authUser = useAuthStore((state) => state.user);
  const isAuthenticated = useAuthStore((state) => state.isAuthenticated);

  const priorStageRef = useRef<{
    stage: string;
    enteredAt: number;
    interactions: number;
  } | null>(null);

  useEffect(() => {
    if (!pathname) return;

    const { stage, routeNormalized } = resolveStageFromRoute({
      nextPathname: pathname,
    });

    const prior = priorStageRef.current;

    // No-op: the route changed but resolved to the same stage (e.g. a query
    // param changed within /marketplace). Don't fire entered/exited for a
    // stage the session never actually left.
    if (prior && prior.stage === stage) return;

    const now = Date.now();
    const userCohort: UserCohort = isAuthenticated ? "returning" : "new";
    const session = JourneySessionManager.getOrCreateSession(
      stage,
      authUser?.id,
    );
    const isReturningToStage = session.stages_visited.includes(stage);

    if (prior) {
      telemetry.track("funnel_stage_exited", {
        stage: prior.stage,
        exit_reason: "progression",
        next_stage: stage,
        next_route: routeNormalized,
        time_in_stage_ms: now - prior.enteredAt,
        // This hook doesn't instrument in-stage interactions (clicks,
        // scrolls, etc.), so these two always read as "no interaction" —
        // the dashboard doesn't consume either field yet. Wire up
        // lib/telemetry/ui/element-tracker.ts here before relying on them.
        interactions_count: prior.interactions,
        bounce: prior.interactions === 0,
        stage_sequence_number: session.stages_visited.length,
      });
    }

    JourneySessionManager.trackStageTransition(session, stage);

    telemetry.track("funnel_stage_entered", {
      stage,
      stage_sequence_number: session.stages_visited.length,
      route_path: routeNormalized,
      referrer_stage: prior?.stage,
      navigation_method: NavigationMethod.DIRECT_URL,
      time_in_prior_stage_ms: prior ? now - prior.enteredAt : undefined,
      is_returning_to_stage: isReturningToStage,
      user_cohort: userCohort,
    });

    priorStageRef.current = { stage, enteredAt: now, interactions: 0 };
    // Only re-run when the route (and therefore possibly the stage)
    // changes — auth state is read fresh each time via the refs/store
    // above without needing to be a dependency that re-fires this effect.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pathname]);
}
