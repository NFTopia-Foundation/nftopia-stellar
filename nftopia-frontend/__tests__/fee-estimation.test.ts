import {
  stroopsToXlm,
  xlmToStroops,
  formatFiatEstimate,
  evaluateCongestion,
  estimateNetworkFee,
  BASE_FEE_STROOPS,
  STROOPS_PER_XLM,
} from "@/lib/stellar/wallet/fee";
import * as stellarClient from "@/lib/stellar/client";

describe("Stellar Fee Estimation Utility", () => {
  describe("stroopsToXlm", () => {
    it("converts standard base fee (100 stroops) to 0.00001 XLM", () => {
      expect(stroopsToXlm(100)).toBe("0.00001");
      expect(stroopsToXlm("100")).toBe("0.00001");
    });

    it("converts 10,000,000 stroops to 1 XLM", () => {
      expect(stroopsToXlm(10000000)).toBe("1");
    });

    it("converts 500 stroops to 0.00005 XLM", () => {
      expect(stroopsToXlm(500)).toBe("0.00005");
    });

    it("handles invalid inputs gracefully", () => {
      expect(stroopsToXlm(NaN)).toBe("0.00001");
      expect(stroopsToXlm(-100)).toBe("0.00001");
    });
  });

  describe("xlmToStroops", () => {
    it("converts 0.00001 XLM to 100 stroops", () => {
      expect(xlmToStroops("0.00001")).toBe(100);
      expect(xlmToStroops(0.00001)).toBe(100);
    });

    it("converts 1 XLM to 10,000,000 stroops", () => {
      expect(xlmToStroops(1)).toBe(10000000);
    });

    it("handles invalid inputs gracefully", () => {
      expect(xlmToStroops("invalid")).toBe(BASE_FEE_STROOPS);
      expect(xlmToStroops(-1)).toBe(BASE_FEE_STROOPS);
    });
  });

  describe("formatFiatEstimate", () => {
    it("formats small amounts as < $0.01", () => {
      expect(formatFiatEstimate("0.00001", 0.12)).toBe("< $0.01");
      expect(formatFiatEstimate(0.00005, 0.15)).toBe("< $0.01");
    });

    it("formats larger fiat values with dollar prefix", () => {
      expect(formatFiatEstimate(100, 0.15)).toBe("$15.00");
    });

    it("handles invalid or zero amounts gracefully", () => {
      expect(formatFiatEstimate(0)).toBe("< $0.01");
      expect(formatFiatEstimate(-5)).toBe("< $0.01");
    });
  });

  describe("evaluateCongestion", () => {
    it("detects low congestion for normal usage and base fees", () => {
      const result = evaluateCongestion(0.2, 100, 100);
      expect(result.isCongested).toBe(false);
      expect(result.level).toBe("low");
      expect(result.message).toBeUndefined();
    });

    it("detects medium congestion when capacity usage >= 70%", () => {
      const result = evaluateCongestion(0.75, 100, 100);
      expect(result.isCongested).toBe(true);
      expect(result.level).toBe("medium");
      expect(result.message).toContain("Moderate network traffic");
    });

    it("detects medium congestion when mode fee is elevated above base fee", () => {
      const result = evaluateCongestion(0.4, 200, 100);
      expect(result.isCongested).toBe(true);
      expect(result.level).toBe("medium");
    });

    it("detects high congestion when capacity usage >= 85%", () => {
      const result = evaluateCongestion(0.92, 200, 100);
      expect(result.isCongested).toBe(true);
      expect(result.level).toBe("high");
      expect(result.message).toContain("High network congestion");
    });

    it("detects high congestion when mode fee >= 500 stroops", () => {
      const result = evaluateCongestion(0.5, 600, 100);
      expect(result.isCongested).toBe(true);
      expect(result.level).toBe("high");
    });
  });

  describe("estimateNetworkFee", () => {
    afterEach(() => {
      jest.restoreAllMocks();
    });

    it("estimates fee correctly from mocked Horizon feeStats on normal conditions", async () => {
      const mockFeeStats = jest.fn().mockResolvedValue({
        last_ledger: "12345",
        last_ledger_base_fee: "100",
        ledger_capacity_usage: "0.15",
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

      const estimate = await estimateNetworkFee({
        network: "testnet",
        operationsCount: 1,
        customXlmPriceUsd: 0.12,
      });

      expect(estimate.feeStroops).toBe(100);
      expect(estimate.feeXlm).toBe("0.00001");
      expect(estimate.fiatEstimate).toBe("< $0.01");
      expect(estimate.isCongested).toBe(false);
      expect(estimate.congestionLevel).toBe("low");
      expect(estimate.isFallback).toBe(false);
    });

    it("estimates elevated fee and identifies congestion during surge conditions", async () => {
      const mockFeeStats = jest.fn().mockResolvedValue({
        last_ledger: "12345",
        last_ledger_base_fee: "100",
        ledger_capacity_usage: "0.92",
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
          p90: "1200",
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
          p90: "1200",
          p95: "1500",
          p99: "2000",
        },
      });

      jest.spyOn(stellarClient, "getHorizonServer").mockReturnValue({
        feeStats: mockFeeStats,
      } as any);

      const estimate = await estimateNetworkFee({
        network: "testnet",
        operationsCount: 1,
        customXlmPriceUsd: 0.12,
      });

      expect(estimate.feeStroops).toBe(1200);
      expect(estimate.feeXlm).toBe("0.00012");
      expect(estimate.isCongested).toBe(true);
      expect(estimate.congestionLevel).toBe("high");
      expect(estimate.congestionMessage).toBeDefined();
    });

    it("handles multiple operations correctly", async () => {
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

      const estimate = await estimateNetworkFee({
        operationsCount: 3,
        customXlmPriceUsd: 0.12,
      });

      expect(estimate.feeStroops).toBe(300);
      expect(estimate.feeXlm).toBe("0.00003");
    });

    it("falls back to standard base fee if Horizon fails", async () => {
      jest.spyOn(stellarClient, "getHorizonServer").mockReturnValue({
        feeStats: jest.fn().mockRejectedValue(new Error("Network offline")),
      } as any);

      const estimate = await estimateNetworkFee({
        operationsCount: 1,
        customXlmPriceUsd: 0.12,
      });

      expect(estimate.feeStroops).toBe(100);
      expect(estimate.feeXlm).toBe("0.00001");
      expect(estimate.isCongested).toBe(false);
      expect(estimate.isFallback).toBe(true);
    });
  });
});
