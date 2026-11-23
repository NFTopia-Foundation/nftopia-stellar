import { FunnelStage } from './types';

/**
 * Canonical order the funnel dashboard (#662) displays stages in, and the
 * single source of truth for "what counts as a step in the funnel."
 *
 * To add a new funnel step:
 * 1. Add the new value to the `FunnelStage` enum and `FunnelStageName` type
 *    in ./types.ts.
 * 2. Add a route pattern for it to `ROUTE_TO_STAGE_MAP` in
 *    ./stage-resolver.ts so navigating there actually fires the stage.
 * 3. Insert it into this array wherever it belongs in the journey — array
 *    order is display order on the dashboard, not enum declaration order.
 *
 * No other file needs to change: useFunnelStageTracking already dispatches
 * whatever stage-resolver resolves, and the dashboard renders whatever
 * stages this array lists (a stage with zero sessions in the selected date
 * range just shows a count of 0, it isn't hidden).
 */
export const FUNNEL_STAGE_SEQUENCE: FunnelStage[] = [
  FunnelStage.LANDING,
  FunnelStage.EXPLORE_CATEGORIES,
  FunnelStage.MARKETPLACE_BROWSE,
  FunnelStage.MARKETPLACE_FILTERED,
  FunnelStage.COLLECTION_DETAIL,
  FunnelStage.ARTIST_PROFILE,
  FunnelStage.AUTHENTICATION,
  FunnelStage.VAULT_HOLDINGS,
  FunnelStage.CREATOR_ACTIVATION,
  FunnelStage.CREATE_COLLECTION,
  FunnelStage.MINT_NFT,
];
