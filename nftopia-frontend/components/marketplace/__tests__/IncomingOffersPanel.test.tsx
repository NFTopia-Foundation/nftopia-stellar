import React from "react";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { IncomingOffersPanel } from "../IncomingOffersPanel";

const accept = jest.fn();
const refresh = jest.fn();

jest.mock("@/hooks/useNftOffers", () => ({
  useNftOffers: () => ({
    offers: [
      {
        id: "o1",
        nftId: "n1",
        amount: "5",
        currency: "XLM",
        bidder: "GBIDDERXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX",
        status: "active",
      },
    ],
    loading: false,
    error: null,
    accept,
    acceptingId: null,
    refresh,
  }),
}));

describe("IncomingOffersPanel (#756)", () => {
  beforeEach(() => jest.clearAllMocks());

  it("shows offers to everyone but Accept only for owner", () => {
    const { rerender } = render(<IncomingOffersPanel nftId="n1" isOwner={false} />);
    expect(screen.getByTestId("offer-row-o1")).toBeInTheDocument();
    expect(screen.queryByTestId("accept-offer-o1")).not.toBeInTheDocument();
    rerender(<IncomingOffersPanel nftId="n1" isOwner />);
    expect(screen.getByTestId("accept-offer-o1")).toBeInTheDocument();
  });

  it("confirm then accept success", async () => {
    accept.mockResolvedValue(undefined);
    render(<IncomingOffersPanel nftId="n1" isOwner />);
    fireEvent.click(screen.getByTestId("accept-offer-o1"));
    fireEvent.click(screen.getByTestId("confirm-accept-o1"));
    await waitFor(() => expect(accept).toHaveBeenCalledWith("o1"));
  });

  it("surfaces accept failure", async () => {
    accept.mockRejectedValue(new Error("not owner"));
    render(<IncomingOffersPanel nftId="n1" isOwner />);
    fireEvent.click(screen.getByTestId("accept-offer-o1"));
    fireEvent.click(screen.getByTestId("confirm-accept-o1"));
    await waitFor(() => expect(screen.getByRole("alert")).toHaveTextContent(/not owner/i));
  });
});
