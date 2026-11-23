import React from "react";
import { render, screen } from "@testing-library/react";
import { explorerTxUrl, PurchaseReceipt } from "../PurchaseReceipt";

describe("PurchaseReceipt (#757)", () => {
  it("renders breakdown and explorer link", () => {
    render(
      <PurchaseReceipt
        receipt={{
          nftName: "Orb",
          price: "10",
          currency: "XLM",
          platformFee: "0.00",
          networkFee: "0.01",
          royalty: "0.50",
          seller: "GSELLER",
          buyer: "GBUYER",
          timestamp: "2026-01-01T00:00:00.000Z",
          txHash: "abcdef1234567890",
        }}
      />,
    );
    expect(screen.getByTestId("purchase-receipt")).toHaveTextContent("Orb");
    expect(screen.getByTestId("purchase-receipt")).toHaveTextContent("0.50");
    const link = screen.getByTestId("receipt-explorer-link");
    expect(link).toHaveAttribute("href", explorerTxUrl("abcdef1234567890"));
  });

  it("formats explorer URL", () => {
    expect(explorerTxUrl("hash1")).toMatch(/\/tx\/hash1$/);
  });
});
