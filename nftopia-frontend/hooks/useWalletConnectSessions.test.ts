import { act, renderHook, waitFor } from "@testing-library/react";
import { useWalletConnectSessions } from "./useWalletConnectSessions";
import {
  disconnectAllWalletConnectSessions,
  disconnectWalletConnectSession,
  getWalletConnectSessions,
  type WalletConnectSessionSummary,
} from "@/lib/stellar/wallet/walletconnect";

jest.mock("@/lib/stellar/wallet/walletconnect", () => ({
  getWalletConnectSessions: jest.fn(),
  disconnectWalletConnectSession: jest.fn(),
  disconnectAllWalletConnectSessions: jest.fn(),
}));

const mockedGetSessions = jest.mocked(getWalletConnectSessions);
const mockedDisconnectSession = jest.mocked(disconnectWalletConnectSession);
const mockedDisconnectAll = jest.mocked(disconnectAllWalletConnectSessions);

function session(overrides: Partial<WalletConnectSessionSummary> = {}): WalletConnectSessionSummary {
  return {
    topic: "topic-1",
    dappName: "Example dApp",
    dappIcon: null,
    dappUrl: null,
    address: "GADDRESS1",
    network: "testnet",
    expiresAt: Date.now() + 3600_000,
    connectedAt: Date.now(),
    isCurrent: false,
    ...overrides,
  };
}

describe("useWalletConnectSessions", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("loads sessions on mount", async () => {
    mockedGetSessions.mockResolvedValue([session()]);

    const { result } = renderHook(() => useWalletConnectSessions());

    expect(result.current.loading).toBe(true);
    await waitFor(() => expect(result.current.loading).toBe(false));

    expect(result.current.sessions).toHaveLength(1);
    expect(result.current.error).toBeNull();
  });

  it("surfaces an error when loading fails", async () => {
    mockedGetSessions.mockRejectedValue(new Error("relay unreachable"));

    const { result } = renderHook(() => useWalletConnectSessions());

    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.error).toBe("relay unreachable");
    expect(result.current.sessions).toEqual([]);
  });

  it("disconnects a session and refreshes the list", async () => {
    mockedGetSessions.mockResolvedValueOnce([session({ topic: "topic-1" })]);
    mockedGetSessions.mockResolvedValueOnce([]);
    mockedDisconnectSession.mockResolvedValue(undefined);

    const { result } = renderHook(() => useWalletConnectSessions());
    await waitFor(() => expect(result.current.loading).toBe(false));

    await act(async () => {
      await result.current.disconnectSession("topic-1");
    });

    expect(mockedDisconnectSession).toHaveBeenCalledWith("topic-1");
    expect(result.current.sessions).toEqual([]);
    expect(result.current.disconnectingTopic).toBeNull();
  });

  it("surfaces an error when disconnecting a session fails, without clearing the list", async () => {
    mockedGetSessions.mockResolvedValue([session({ topic: "topic-1" })]);
    mockedDisconnectSession.mockRejectedValue(new Error("could not reach relay"));

    const { result } = renderHook(() => useWalletConnectSessions());
    await waitFor(() => expect(result.current.loading).toBe(false));

    await act(async () => {
      await result.current.disconnectSession("topic-1");
    });

    expect(result.current.error).toBe("could not reach relay");
    expect(result.current.sessions).toHaveLength(1);
  });

  it("disconnects all sessions and refreshes the list", async () => {
    mockedGetSessions.mockResolvedValueOnce([
      session({ topic: "topic-1" }),
      session({ topic: "topic-2" }),
    ]);
    mockedGetSessions.mockResolvedValueOnce([]);
    mockedDisconnectAll.mockResolvedValue(undefined);

    const { result } = renderHook(() => useWalletConnectSessions());
    await waitFor(() => expect(result.current.loading).toBe(false));

    await act(async () => {
      await result.current.disconnectAll();
    });

    expect(mockedDisconnectAll).toHaveBeenCalledTimes(1);
    expect(result.current.sessions).toEqual([]);
    expect(result.current.disconnectingAll).toBe(false);
  });
});
