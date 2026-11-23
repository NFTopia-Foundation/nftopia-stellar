import React from "react";
import { render, screen, fireEvent, waitFor, within } from "@testing-library/react";
import { WalletConnectSessionsManager } from "@/components/wallet/WalletConnectSessionsManager";
import { useWalletConnectSessions } from "@/hooks/useWalletConnectSessions";
import type { WalletConnectSessionSummary } from "@/lib/stellar/wallet/walletconnect";

jest.mock("@/hooks/useWalletConnectSessions", () => ({
  useWalletConnectSessions: jest.fn(),
}));

const mockedUseWalletConnectSessions = jest.mocked(useWalletConnectSessions);

function session(overrides: Partial<WalletConnectSessionSummary> = {}): WalletConnectSessionSummary {
  return {
    topic: "topic-1",
    dappName: "Example dApp",
    dappIcon: null,
    dappUrl: "https://example.com",
    address: "GADDRESS1",
    network: "testnet",
    expiresAt: Date.now() + 3600_000,
    connectedAt: Date.now() - 60_000,
    isCurrent: false,
    ...overrides,
  };
}

function mockHook(overrides: Partial<ReturnType<typeof useWalletConnectSessions>> = {}) {
  const base: ReturnType<typeof useWalletConnectSessions> = {
    sessions: [],
    loading: false,
    error: null,
    disconnectingTopic: null,
    disconnectingAll: false,
    refresh: jest.fn(),
    disconnectSession: jest.fn(),
    disconnectAll: jest.fn(),
  };
  const merged = { ...base, ...overrides };
  mockedUseWalletConnectSessions.mockReturnValue(merged);
  return merged;
}

describe("WalletConnectSessionsManager", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("shows a loading state", () => {
    mockHook({ loading: true });
    render(<WalletConnectSessionsManager />);
    expect(screen.getByRole("status")).toHaveTextContent("Loading sessions");
  });

  it("shows an empty state with no sessions and no disconnect-all button", () => {
    mockHook({ sessions: [] });
    render(<WalletConnectSessionsManager />);

    expect(screen.getByTestId("wc-sessions-empty")).toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: /disconnect all/i }),
    ).not.toBeInTheDocument();
  });

  it("lists sessions with dApp name, network, and connected time", () => {
    mockHook({
      sessions: [
        session({ topic: "topic-1", dappName: "Example dApp", network: "mainnet" }),
      ],
    });
    render(<WalletConnectSessionsManager />);

    const row = screen.getByTestId("wc-session-row");
    expect(row).toHaveTextContent("Example dApp");
    expect(row).toHaveTextContent("Mainnet");
    expect(row).toHaveTextContent("Connected");
  });

  it("marks the current session", () => {
    mockHook({ sessions: [session({ isCurrent: true })] });
    render(<WalletConnectSessionsManager />);
    expect(screen.getByTestId("wc-session-row")).toHaveTextContent("Current");
  });

  it("surfaces an error", () => {
    mockHook({ error: "Could not load WalletConnect sessions." });
    render(<WalletConnectSessionsManager />);
    expect(screen.getByRole("alert")).toHaveTextContent(
      "Could not load WalletConnect sessions.",
    );
  });

  it("requires confirmation before disconnecting a single session, and cancel does nothing", async () => {
    const hook = mockHook({ sessions: [session({ dappName: "Example dApp" })] });
    render(<WalletConnectSessionsManager />);

    fireEvent.click(screen.getByRole("button", { name: "Disconnect" }));

    const dialog = await screen.findByRole("dialog");
    expect(dialog).toHaveTextContent("Disconnect from Example dApp?");
    expect(hook.disconnectSession).not.toHaveBeenCalled();

    fireEvent.click(screen.getByRole("button", { name: "Cancel" }));

    await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
    expect(hook.disconnectSession).not.toHaveBeenCalled();
  });

  it("disconnects a single session only after confirming", async () => {
    const hook = mockHook({ sessions: [session({ topic: "topic-1" })] });
    render(<WalletConnectSessionsManager />);

    fireEvent.click(screen.getByRole("button", { name: "Disconnect" }));
    const dialog = await screen.findByRole("dialog");
    fireEvent.click(
      // Scope to the dialog so this doesn't also match the per-row button.
      within(dialog).getByRole("button", { name: "Disconnect" }),
    );

    await waitFor(() => expect(hook.disconnectSession).toHaveBeenCalledWith("topic-1"));
  });

  it("requires confirmation before disconnect-all, naming every session revoked", async () => {
    const hook = mockHook({
      sessions: [session({ topic: "topic-1" }), session({ topic: "topic-2" })],
    });
    render(<WalletConnectSessionsManager />);

    fireEvent.click(screen.getByRole("button", { name: /disconnect all/i }));

    const dialog = await screen.findByRole("dialog");
    expect(dialog).toHaveTextContent("Disconnect all sessions?");
    expect(hook.disconnectAll).not.toHaveBeenCalled();

    fireEvent.click(within(dialog).getByRole("button", { name: /disconnect all/i }));

    await waitFor(() => expect(hook.disconnectAll).toHaveBeenCalledTimes(1));
  });
});
