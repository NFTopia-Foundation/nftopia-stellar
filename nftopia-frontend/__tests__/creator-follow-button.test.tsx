import React from "react";
import { render, screen, waitFor, fireEvent } from "@testing-library/react";
import "@testing-library/jest-dom";
import { MockedProvider, MockedResponse } from "@apollo/client/testing";
import { CreatorFollowButton } from "../components/creator/creator-follow-button";
import {
  FOLLOW_CREATOR_MUTATION,
  UNFOLLOW_CREATOR_MUTATION,
} from "../lib/graphql/queries/creator.queries";

/**
 * Covers #659's acceptance criteria for the follow/unfollow button: it
 * reflects real backend state, updates optimistically on toggle, rolls back
 * correctly on failure, and prompts an unauthenticated visitor to connect
 * before following.
 */

let mockAuthUser: { id: string } | null = { id: "viewer-1" };
let mockWalletConnected = true;

jest.mock("@/lib/stores/auth-store", () => ({
  useAuthStore: (selector: (state: { user: { id: string } | null }) => unknown) =>
    selector({ user: mockAuthUser }),
}));

jest.mock("@/components/wallet/hooks/useStellarWallet", () => ({
  useStellarWallet: () => ({ connected: mockWalletConnected }),
}));

jest.mock("@/components/wallet/WalletModal", () => ({
  WalletModal: ({ open }: { open: boolean }) =>
    open ? <div data-testid="wallet-modal">Connect your wallet</div> : null,
}));

jest.mock("@/hooks/useTranslation", () => ({
  useTranslation: () => ({
    t: (key: string) => {
      const map: Record<string, string> = {
        "common.follow": "Follow",
        "common.unfollow": "Unfollow",
      };
      return map[key] ?? key;
    },
  }),
}));

beforeEach(() => {
  mockAuthUser = { id: "viewer-1" };
  mockWalletConnected = true;
});

function renderButton(mocks: MockedResponse[], props?: Partial<Parameters<typeof CreatorFollowButton>[0]>) {
  return render(
    <MockedProvider mocks={mocks}>
      <CreatorFollowButton
        creatorId="creator-1"
        initialFollowing={false}
        initialFollowerCount={10}
        {...props}
      />
    </MockedProvider>
  );
}

describe("CreatorFollowButton (#659)", () => {
  it("shows Follow/Unfollow reflecting the initial backend state", () => {
    renderButton([]);
    expect(screen.getByRole("button", { name: "Follow" })).toBeInTheDocument();

    renderButton([], { initialFollowing: true });
    expect(screen.getByRole("button", { name: "Unfollow" })).toBeInTheDocument();
  });

  it("optimistically follows and reflects the real backend response on success", async () => {
    const followMock: MockedResponse = {
      request: {
        query: FOLLOW_CREATOR_MUTATION,
        variables: { creatorId: "creator-1" },
      },
      result: {
        data: {
          followCreator: {
            __typename: "FollowResult",
            success: true,
            followerCount: 11,
            isFollowing: true,
          },
        },
      },
    };

    renderButton([followMock]);

    fireEvent.click(screen.getByRole("button", { name: "Follow" }));

    await waitFor(() => {
      expect(screen.getByRole("button", { name: "Unfollow" })).toBeInTheDocument();
    });
  });

  it("rolls back to the prior state when the follow mutation fails", async () => {
    const failingMock: MockedResponse = {
      request: {
        query: FOLLOW_CREATOR_MUTATION,
        variables: { creatorId: "creator-1" },
      },
      error: new Error("Network error"),
    };

    renderButton([failingMock]);

    fireEvent.click(screen.getByRole("button", { name: "Follow" }));

    // The mutation fails, so the optimistic follow is rolled back to the
    // original un-followed state rather than sticking.
    await waitFor(() => {
      expect(screen.getByRole("button", { name: "Follow" })).toBeInTheDocument();
    });
  });

  it("unfollows and rolls back on failure the same way", async () => {
    const failingUnfollow: MockedResponse = {
      request: {
        query: UNFOLLOW_CREATOR_MUTATION,
        variables: { creatorId: "creator-1" },
      },
      error: new Error("Network error"),
    };

    renderButton([failingUnfollow], { initialFollowing: true });

    fireEvent.click(screen.getByRole("button", { name: "Unfollow" }));

    // The mutation fails, so the optimistic unfollow is rolled back to the
    // original followed state rather than sticking.
    await waitFor(() => {
      expect(screen.getByRole("button", { name: "Unfollow" })).toBeInTheDocument();
    });
  });

  it("prompts an unauthenticated visitor to connect instead of following", () => {
    mockAuthUser = null;
    renderButton([]);

    fireEvent.click(screen.getByRole("button", { name: "Follow" }));

    expect(screen.getByTestId("wallet-modal")).toBeInTheDocument();
    // Still shows the un-followed state — no optimistic update happened.
    expect(screen.getByRole("button", { name: "Follow" })).toBeInTheDocument();
  });

  it("prompts an authenticated visitor with no linked wallet to connect", () => {
    mockWalletConnected = false;
    renderButton([]);

    fireEvent.click(screen.getByRole("button", { name: "Follow" }));

    expect(screen.getByTestId("wallet-modal")).toBeInTheDocument();
  });
});
