import React from "react";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { OfflineQueueManager } from "../OfflineQueueManager";
import {
  configureOfflineQueue,
  resetQueueConfiguration,
  useOfflineActionQueue,
} from "@/lib/offline-queue/store";
import {
  FOLLOW_STATE_EVENT,
  FollowStateEventDetail,
} from "@/lib/offline-queue/optimistic";
import { createQueuedAction } from "@/lib/offline-queue/utils";

const pendingFavorite = () =>
  createQueuedAction(
    {
      id: "pending-1",
      type: "favorite",
      payload: { itemType: "nft", itemId: "nft-1", favorited: true, label: "Cool NFT" },
    },
    1,
  );

const conflictFollow = () =>
  createQueuedAction(
    {
      id: "conflict-1",
      type: "follow",
      payload: { creatorId: "creator-1", following: true, label: "Alice" },
    },
    1,
  );

beforeEach(() => {
  localStorage.clear();
  configureOfflineQueue({
    dispatcher: jest.fn(async () => ({})),
    isOnline: () => false,
    scheduler: jest.fn(),
  });
  useOfflineActionQueue.getState().clear();
  localStorage.clear();
});

afterEach(() => {
  resetQueueConfiguration();
  localStorage.clear();
});

describe("OfflineQueueManager (#663)", () => {
  it("announces the pending count in an aria-live region", () => {
    useOfflineActionQueue.setState({
      actions: [pendingFavorite(), { ...pendingFavorite(), id: "pending-2", sequence: 2 }],
    });

    render(<OfflineQueueManager />);

    const status = screen.getByRole("status");
    expect(status).toHaveAttribute("aria-live", "polite");
    expect(status).toHaveTextContent("2 actions waiting to sync");
    expect(screen.getByRole("button", { name: "Sync pending actions now" })).toBeInTheDocument();
  });

  it("renders a per-action conflict with resolution buttons", () => {
    const action = {
      ...conflictFollow(),
      status: "conflict" as const,
      conflict: {
        code: "CONFLICT" as const,
        message: "This creator's follower count changed on the server.",
        serverRevision: "r5",
        serverState: { following: false, followerCount: 12 },
        detectedAt: Date.now(),
      },
    };
    useOfflineActionQueue.setState({ actions: [action] });

    render(<OfflineQueueManager />);

    const alert = screen.getByRole("alert");
    expect(alert).toHaveAttribute("aria-live", "assertive");
    expect(alert).toHaveTextContent("Conflict: Follow Alice");
    expect(alert).toHaveTextContent("follower count changed on the server");
    expect(screen.getByRole("button", { name: "Keep my change for Follow Alice" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Use server version for Follow Alice" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Dismiss conflict for Follow Alice" })).toBeInTheDocument();
  });

  it("dismiss removes the conflict from the queue and the UI", async () => {
    const action = {
      ...pendingFavorite(),
      status: "conflict" as const,
      conflict: {
        code: "CONFLICT" as const,
        message: "Changed",
        detectedAt: Date.now(),
      },
    };
    useOfflineActionQueue.setState({ actions: [action] });

    render(<OfflineQueueManager />);
    fireEvent.click(screen.getByRole("button", { name: /Dismiss conflict/ }));

    await waitFor(() => {
      expect(useOfflineActionQueue.getState().actions).toHaveLength(0);
    });
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
  });

  it("Use server applies server state locally before dropping the action", async () => {
    const listener = jest.fn((event: Event) => {
      return (event as CustomEvent<FollowStateEventDetail>).detail;
    });
    window.addEventListener(FOLLOW_STATE_EVENT, listener);
    const action = {
      ...conflictFollow(),
      status: "conflict" as const,
      conflict: {
        code: "CONFLICT" as const,
        message: "Changed",
        serverState: { following: false, followerCount: 7 },
        detectedAt: Date.now(),
      },
    };
    useOfflineActionQueue.setState({ actions: [action] });

    render(<OfflineQueueManager />);
    fireEvent.click(screen.getByRole("button", { name: /Use server version/ }));

    await waitFor(() => {
      expect(useOfflineActionQueue.getState().actions).toHaveLength(0);
    });
    expect(listener).toHaveBeenCalled();
    const event = listener.mock.calls[0][0] as CustomEvent<FollowStateEventDetail>;
    expect(event.detail).toMatchObject({
      creatorId: "creator-1",
      following: false,
      followerCount: 7,
      source: "server",
    });
    window.removeEventListener(FOLLOW_STATE_EVENT, listener);
  });
});
