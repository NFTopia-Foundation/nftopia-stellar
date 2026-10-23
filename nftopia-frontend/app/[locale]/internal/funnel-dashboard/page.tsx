"use client";

import { useEffect, useMemo, useState } from "react";
import { notFound } from "next/navigation";
import { useAuthStore } from "@/lib/stores/auth-store";
import { fetchWithAuth } from "@/lib/api/fetchWithAuth";
import { API_CONFIG } from "@/lib/config";
import { FUNNEL_STAGE_SEQUENCE } from "@/lib/telemetry/funnel/stage-sequence";

/**
 * Internal funnel drop-off dashboard (#662). See
 * docs/funnel-dashboard.md for the full data flow and how to add a new
 * funnel step.
 *
 * Access-gated two ways:
 * 1. `NEXT_PUBLIC_INTERNAL_DASHBOARD_ENABLED` — the route 404s entirely
 *    (not just "hidden from nav") when unset, so it isn't publicly
 *    reachable by URL guessing in a deployment that hasn't opted in.
 * 2. The backend's `/analytics/funnel/summary` endpoint requires an
 *    authenticated ADMIN — this is the real security boundary; the
 *    feature flag above is a deployment-level switch, not the access
 *    control itself.
 */

function defaultFromDate(): string {
  const date = new Date();
  date.setDate(date.getDate() - 7);
  return date.toISOString().slice(0, 10);
}

function defaultToDate(): string {
  return new Date().toISOString().slice(0, 10);
}

function formatStageLabel(stage: string): string {
  return stage
    .split("_")
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(" ");
}

type SummaryResponse = {
  from: string;
  to: string;
  sessionsByStage: Record<string, number>;
};

export default function FunnelDashboardPage() {
  if (process.env.NEXT_PUBLIC_INTERNAL_DASHBOARD_ENABLED !== "true") {
    notFound();
  }

  const isAuthenticated = useAuthStore((state) => state.isAuthenticated);

  const [from, setFrom] = useState(defaultFromDate());
  const [to, setTo] = useState(defaultToDate());
  const [sessionsByStage, setSessionsByStage] = useState<Record<string, number> | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!isAuthenticated) return;

    let active = true;
    setLoading(true);
    setError(null);

    const fromIso = new Date(`${from}T00:00:00.000Z`).toISOString();
    const toIso = new Date(`${to}T23:59:59.999Z`).toISOString();

    fetchWithAuth(
      `${API_CONFIG.baseUrl}/api/v1/analytics/funnel/summary?from=${encodeURIComponent(
        fromIso,
      )}&to=${encodeURIComponent(toIso)}`,
    )
      .then((res) => res.json())
      .then((data: SummaryResponse) => {
        if (active) setSessionsByStage(data.sessionsByStage);
      })
      .catch((err) => {
        if (!active) return;
        setError(
          err?.code === "FORBIDDEN" || err?.code === "UNAUTHORIZED"
            ? "You don't have access to this dashboard."
            : "Failed to load funnel data.",
        );
      })
      .finally(() => {
        if (active) setLoading(false);
      });

    return () => {
      active = false;
    };
  }, [isAuthenticated, from, to]);

  const stages = useMemo(() => {
    if (!sessionsByStage) return [];

    let previousCount: number | null = null;
    return FUNNEL_STAGE_SEQUENCE.map((stage) => {
      const count = sessionsByStage[stage] ?? 0;
      const dropOffPct =
        previousCount && previousCount > 0
          ? Math.round((1 - count / previousCount) * 1000) / 10
          : null;
      previousCount = count;
      return { stage, count, dropOffPct };
    });
  }, [sessionsByStage]);

  const maxCount = useMemo(
    () => Math.max(1, ...stages.map((s) => s.count)),
    [stages],
  );

  if (!isAuthenticated) {
    return (
      <div className="mx-auto max-w-3xl px-6 py-10">
        <p className="text-sm text-muted-foreground">
          Sign in with an admin account to view this dashboard.
        </p>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-4xl px-6 py-10">
      <h1 className="mb-2 text-2xl font-bold text-foreground">
        Funnel Drop-off Dashboard
      </h1>
      <p className="mb-6 text-sm text-muted-foreground">
        Internal use only. Visualizes session counts and drop-off at each
        funnel stage already instrumented via lib/telemetry/funnel.
      </p>

      <div className="mb-6 flex flex-wrap items-end gap-4">
        <label className="flex flex-col text-sm">
          <span className="mb-1 text-muted-foreground">From</span>
          <input
            type="date"
            data-testid="funnel-date-from"
            value={from}
            max={to}
            onChange={(e) => setFrom(e.target.value)}
            className="rounded-lg border border-border bg-muted/40 px-3 py-2 text-foreground"
          />
        </label>
        <label className="flex flex-col text-sm">
          <span className="mb-1 text-muted-foreground">To</span>
          <input
            type="date"
            data-testid="funnel-date-to"
            value={to}
            min={from}
            onChange={(e) => setTo(e.target.value)}
            className="rounded-lg border border-border bg-muted/40 px-3 py-2 text-foreground"
          />
        </label>
      </div>

      {loading && (
        <p className="text-sm text-muted-foreground" data-testid="funnel-loading">
          Loading...
        </p>
      )}

      {error && (
        <p className="text-sm text-red-400" data-testid="funnel-error">
          {error}
        </p>
      )}

      {!loading && !error && sessionsByStage && (
        <div className="space-y-3" data-testid="funnel-stages">
          {stages.map(({ stage, count, dropOffPct }) => (
            <div key={stage} data-testid={`funnel-stage-${stage}`}>
              <div className="mb-1 flex items-center justify-between text-sm">
                <span className="font-medium text-foreground">
                  {formatStageLabel(stage)}
                </span>
                <span className="text-muted-foreground">
                  {count.toLocaleString()} sessions
                  {dropOffPct !== null && (
                    <span
                      className={dropOffPct > 0 ? "text-red-400" : "text-emerald-400"}
                    >
                      {" "}
                      ({dropOffPct > 0 ? "-" : "+"}
                      {Math.abs(dropOffPct)}%)
                    </span>
                  )}
                </span>
              </div>
              <div className="h-3 w-full rounded-full bg-muted/40">
                <div
                  className="h-3 rounded-full bg-purple-500"
                  style={{ width: `${(count / maxCount) * 100}%` }}
                />
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
