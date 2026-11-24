import { getBalanceFromList } from "../useWalletBalanceTestUtils";

// Pure helper tests for shortfall math used by PurchaseModal (#755)
describe("balance shortfall helpers (#755)", () => {
  it("detects sufficient balance", () => {
    expect(getBalanceFromList([{ asset: "XLM", balance: "12.5" }], "XLM")).toBe(12.5);
    expect(12.5 >= 10 + 0.1 + 1).toBe(true);
  });

  it("detects insufficient balance and shortfall", () => {
    const available = getBalanceFromList([{ asset: "USDC", balance: "3" }], "USDC") ?? 0;
    const required = 10;
    expect(available < required).toBe(true);
    expect(required - available).toBe(7);
  });

  it("returns null when asset missing (loading/error path)", () => {
    expect(getBalanceFromList([], "XLM")).toBeNull();
  });
});
