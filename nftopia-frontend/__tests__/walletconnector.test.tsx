import React from "react";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { WalletConnector } from "@/components/wallet/WalletConnector";

const mockShowSuccess = jest.fn();
const mockShowError = jest.fn();
const mockDisconnect = jest.fn();
const mockUseWalletStore = jest.fn();

jest.mock("@/stores/walletStore", () => ({
  useWalletStore: () => mockUseWalletStore(),
}));

jest.mock("@/components/wallet/hooks/useStellarWallet", () => ({
  useStellarWallet: () => ({
    disconnect: mockDisconnect,
  }),
}));

jest.mock("@/lib/stores", () => ({
  useToast: () => ({
    showSuccess: mockShowSuccess,
    showError: mockShowError,
  }),
}));

jest.mock("@/hooks/useTranslation", () => ({
  useTranslation: () => ({
    t: (key: string) => {
      const map: Record<string, string> = {
        "connectWallet.connect": "Connect Wallet",
        "connectWallet.disconnect": "Disconnect",
        "connectWallet.copyAddress": "Copy Address",
      };
      return map[key] || key;
    },
  }),
}));

jest.mock("@/components/wallet/WalletModal", () => ({
  WalletModal: ({ open }: { open: boolean }) =>
    open ? <div data-testid="wallet-modal">Wallet Modal</div> : null,
}));

jest.mock("@/components/wallet/WalletNetworkStatus", () => ({
  WalletNetworkStatus: () => <span>testnet</span>,
}));

jest.mock("@/lib/stellar/network", () => ({
  getExplorerUrl: () => "https://stellar.expert/explorer/testnet/account/GTESTADDRESS1234",
}));

describe("WalletConnector", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    Object.assign(navigator, {
      clipboard: {
        writeText: jest.fn().mockResolvedValue(undefined),
      },
    });
  });

  it("renders connect wallet button when disconnected", () => {
    mockUseWalletStore.mockReturnValue({
      address: null,
      connected: false,
      provider: null,
      network: "testnet",
      connecting: false,
    });

    render(<WalletConnector forceVisible />);

    expect(screen.getByRole("button", { name: "Connect Wallet" })).toBeInTheDocument();
  });

  it("shows truncated address and allows copy + disconnect from dropdown", async () => {
    const address = "GABCDEF1234567890XYZ";
    mockUseWalletStore.mockReturnValue({
      address,
      connected: true,
      provider: "freighter",
      network: "testnet",
      connecting: false,
    });

    render(<WalletConnector />);

    expect(screen.getByText("GABC...0XYZ")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button"));

    fireEvent.click(screen.getByRole("button", { name: "Copy Address" }));
    await waitFor(() => {
      expect(navigator.clipboard.writeText).toHaveBeenCalledWith(address);
      expect(mockShowSuccess).toHaveBeenCalled();
    });

    fireEvent.click(screen.getByRole("button", { name: "Disconnect" }));
    expect(mockDisconnect).toHaveBeenCalled();
  });
});