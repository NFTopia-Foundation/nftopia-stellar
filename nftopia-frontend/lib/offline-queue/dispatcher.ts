import { dispatchFavorite } from "./adapters/favorites";
import { dispatchFollow } from "./adapters/follow";
import { ActionDispatcher } from "./types";

/** Maps a queued action type to its write adapter. */
export const defaultDispatcher: ActionDispatcher = (action, context) => {
  switch (action.type) {
    case "favorite":
      return dispatchFavorite(action.payload, context);
    case "follow":
      return dispatchFollow(action.payload, context);
    default:
      return Promise.reject(
        new Error(
          `No offline replay adapter for action type: ${String(
            (action as { type: string }).type,
          )}`,
        ),
      );
  }
};
