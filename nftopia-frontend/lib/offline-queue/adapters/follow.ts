import {
  FOLLOW_CREATOR_MUTATION,
  UNFOLLOW_CREATOR_MUTATION,
} from "@/lib/graphql/queries/creator.queries";
import {
  classifyReplayError,
  OfflineActionConflictError,
} from "../errors";
import {
  DispatchResult,
  FollowActionPayload,
  ReplayContext,
} from "../types";

interface FollowResult {
  success: boolean;
  isFollowing: boolean;
  followerCount?: number;
}

/**
 * Follow/unfollow already has real GraphQL mutations (see
 * `lib/graphql/queries/creator.queries.ts`). The replay adapter reuses them
 * through the shared Apollo client instead of inventing a parallel REST API.
 *
 * `baseRevision` is not yet an argument of the GraphQL mutation; it is sent as
 * `If-Match` metadata so the server can start enforcing it, and conflicts are
 * detected from a 409 transport error, `extensions.code === "CONFLICT"` or a
 * revision-mismatch message.
 */
export async function dispatchFollow(
  payload: FollowActionPayload,
  context: ReplayContext,
): Promise<DispatchResult> {
  // Imported lazily so unit tests (and SSR) don't construct a GraphQL client.
  const { getApolloClient } = await import("@/lib/graphql/client");

  const headers: Record<string, string> = {
    "Idempotency-Key": context.idempotencyKey,
  };
  if (!context.force && context.baseRevision) {
    headers["If-Match"] = context.baseRevision;
  }
  if (context.force) headers["X-Offline-Force"] = "true";

  const result = await getApolloClient().mutate<{
    followCreator?: FollowResult;
    unfollowCreator?: FollowResult;
  }>({
    mutation: payload.following
      ? FOLLOW_CREATOR_MUTATION
      : UNFOLLOW_CREATOR_MUTATION,
    variables: { creatorId: payload.creatorId },
    context: { headers },
  });

  // The shared client uses errorPolicy: "all", so GraphQL errors arrive on
  // the result instead of being thrown. Convert them back into replay errors.
  const graphQlError = result.errors?.[0];
  if (graphQlError) {
    const failure = classifyReplayError({ graphQLErrors: [graphQlError] });
    if (failure.kind === "conflict" && failure.conflict) {
      throw new OfflineActionConflictError(failure.message, {
        serverRevision: failure.conflict.serverRevision,
        serverState: failure.conflict.serverState,
      });
    }
    throw graphQlError;
  }

  const data = result.data?.followCreator ?? result.data?.unfollowCreator;
  if (!data?.success) {
    throw new Error("The follow mutation did not succeed.");
  }

  return {
    serverState: {
      following: data.isFollowing,
      ...(typeof data.followerCount === "number"
        ? { followerCount: data.followerCount }
        : {}),
    },
  };
}
