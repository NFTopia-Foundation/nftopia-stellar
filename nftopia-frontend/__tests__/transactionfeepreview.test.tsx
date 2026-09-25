import React from "react";
import { render, screen, waitFor } from "@testing-library/react";
import { TransactionFeePreview } from "@/components/wallet/TransactionFeePreview";
import * as stellarClient from "@/lib/stellar/client";

// Mock the wallet store
jest.mock("@/stores/walletStore", () => ({
  useWalletStore: () => ({
    network: "testnet",
    provider: "freighter",
    address: "GBRPYHIL2CI3FNQ4BXLFMNDLFJUNPU2HY3ZMFTGWEBUSXDIOOWYQMVOG",
    connected: true,
  }),
}));

describe("TransactionFeePreview Component", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("renders estimated fee correctly with mocked normal fee-stats response", async () => {
    const mockFeeStats = jest.fn().mockResolvedValue({
      last_ledger: "12345",
      last_ledger_base_fee: "100",
      ledger_capacity_usage: "0.10",
      fee_charged: {
        min: "100",
        mode: "100",
        p10: "100",
        p20: "100",
        p30: "100",
        p40: "100",
        p50: "100",
        p60: "100",
        p70: "100",
        p80: "100",
        p90: "100",
        p95: "100",
        p99: "100",
      },
      max_fee: {
        min: "100",
        mode: "100",
        p10: "100",
        p20: "100",
        p30: "100",
        p40: "100",
        p50: "100",
        p60: "100",
        p70: "100",
        p80: "100",
        p90: "100",
        p95: "100",
        p99: "100",
      },
    });

    jest.spyOn(stellarClient, "getHorizonServer").mockReturnValue({
      feeStats: mockFeeStats,
    } as any);

    render(<TransactionFeePreview />);

    await waitFor(() => {
      expect(screen.getByTestId("fee-xlm-amount")).toHaveTextContent("0.00001 XLM");
    });

    expect(screen.getByTestId("transaction-fee-preview")).toBeInTheDocument();
    expect(screen.getByTestId("fee-fiat-amount")).toHaveTextContent("< $0.01");
    expect(screen.queryByTestId("congestion-warning")).not.toBeInTheDocument();
  });

  it("renders elevated fee and congestion warning banner during network surge", async () => {
    const mockFeeStats = jest.fn().mockResolvedValue({
      last_ledger: "12345",
      last_ledger_base_fee: "100",
      ledger_capacity_usage: "0.95",
      fee_charged: {
        min: "500",
        mode: "600",
        p10: "500",
        p20: "500",
        p30: "500",
        p40: "500",
        p50: "500",
        p60: "600",
        p70: "800",
        p80: "900",
        p90: "1000",
        p95: "1500",
        p99: "2000",
      },
      max_fee: {
        min: "500",
        mode: "600",
        p10: "500",
        p20: "500",
        p30: "500",
        p40: "500",
        p50: "500",
        p60: "600",
        p70: "800",
        p80: "900",
        p90: "1000",
        p95: "1500",
        p99: "2000",
      },
    });

    jest.spyOn(stellarClient, "getHorizonServer").mockReturnValue({
      feeStats: mockFeeStats,
    } as any);

    render(<TransactionFeePreview />);

    await waitFor(() => {
      expect(screen.getByTestId("fee-xlm-amount")).toHaveTextContent("0.0001 XLM");
    });

    const warning = screen.getByTestId("congestion-warning");
    expect(warning).toBeInTheDocument();
    expect(warning).toHaveTextContent("High Network Congestion");
    expect(warning).toHaveTextContent("Elevated surge fee applied");
  });

  it("renders compact mode properly", async () => {
    const mockFeeStats = jest.fn().mockResolvedValue({
      last_ledger: "12345",
      last_ledger_base_fee: "100",
      ledger_capacity_usage: "0.05",
      fee_charged: {
        min: "100",
        mode: "100",
        p10: "100",
        p20: "100",
        p30: "100",
        p40: "100",
        p50: "100",
        p60: "100",
        p70: "100",
        p80: "100",
        p90: "100",
        p95: "100",
        p99: "100",
      },
      max_fee: {
        min: "100",
        mode: "100",
        p10: "100",
        p20: "100",
        p30: "100",
        p40: "100",
        p50: "100",
        p60: "100",
        p70: "100",
        p80: "100",
        p90: "100",
        p95: "100",
        p99: "100",
      },
    });

    jest.spyOn(stellarClient, "getHorizonServer").mockReturnValue({
      feeStats: mockFeeStats,
    } as any);

    render(<TransactionFeePreview compact label="Network Fee (Est.)" />);

    await waitFor(() => {
      expect(screen.getByTestId("fee-xlm-amount")).toHaveTextContent("0.00001 XLM");
    });

    expect(screen.getByText("Network Fee (Est.)")).toBeInTheDocument();
    expect(screen.getByTestId("fee-fiat-amount")).toHaveTextContent("(< $0.01)");
  });

  it("calls onFeeCalculated callback when estimate resolves", async () => {
    const mockCallback = jest.fn();
    const mockFeeStats = jest.fn().mockResolvedValue({
      last_ledger: "12345",
      last_ledger_base_fee: "100",
      ledger_capacity_usage: "0.1",
      fee_charged: {
        min: "100",
        mode: "100",
        p10: "100",
        p20: "100",
        p30: "100",
        p40: "100",
        p50: "100",
        p60: "100",
        p70: "100",
        p80: "100",
        p90: "100",
        p95: "100",
        p99: "100",
      },
      max_fee: {
        min: "100",
        mode: "100",
        p10: "100",
        p20: "100",
        p30: "100",
        p40: "100",
        p50: "100",
        p60: "100",
        p70: "100",
        p80: "100",
        p90: "100",
        p95: "100",
        p99: "100",
      },
    });

    jest.spyOn(stellarClient, "getHorizonServer").mockReturnValue({
      feeStats: mockFeeStats,
    } as any);

    render(<TransactionFeePreview onFeeCalculated={mockCallback} />);

    await waitFor(() => {
      expect(mockCallback).toHaveBeenCalled();
    });

    expect(mockCallback).toHaveBeenCalledWith(
      expect.objectContaining({
        feeStroops: 100,
        feeXlm: "0.00001",
        isCongested: false,
      })
    );
  });

  it("handles fallback gracefully when network fee estimation errors", async () => {
    const mockFeeStats = jest.fn().mockRejectedValue(new Error("Horizon timeout"));

    jest.spyOn(stellarClient, "getHorizonServer").mockReturnValue({
      feeStats: mockFeeStats,
    } as any);

    render(<TransactionFeePreview />);

    await waitFor(() => {
      expect(screen.getByTestId("fee-xlm-amount")).toHaveTextContent("0.00001 XLM");
    });

    expect(screen.getByTestId("transaction-fee-preview")).toBeInTheDocument();
    expect(screen.getByText(/standard base fee/i)).toBeInTheDocument();
  });
});
