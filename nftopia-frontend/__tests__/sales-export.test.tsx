import React from "react";
import { fireEvent, render, screen } from "@testing-library/react";
import "@testing-library/jest-dom";

import {
  buildSaleRecords,
  escapeCsvField,
  filterByDateRange,
  salesCsvFilename,
  salesToCsv,
  type SaleRecord,
} from "@/lib/sales-export";
import { SalesCsvExport } from "@/components/creator/SalesCsvExport";
import type { Auction, Listing } from "@/types/marketplace";

const CREATOR = "creator-1";

const listing = (overrides: Partial<Listing> & Record<string, unknown> = {}): Listing =>
  ({
    id: "l1",
    nftContractId: "CCONTRACT",
    nftTokenId: "7",
    sellerId: CREATOR,
    price: 50,
    currency: "XLM",
    status: "SOLD",
    createdAt: "2026-03-01T00:00:00.000Z",
    updatedAt: "2026-03-02T10:30:00.000Z",
    ...overrides,
  }) as Listing;

const auction = (overrides: Partial<Auction> = {}): Auction => ({
  id: "a1",
  nftContractId: "CAUCTION",
  nftTokenId: "1",
  sellerId: CREATOR,
  startPrice: 10,
  currentPrice: 100,
  startTime: "2026-04-01T00:00:00.000Z",
  endTime: "2026-04-05T00:00:00.000Z",
  status: "SETTLED",
  createdAt: "2026-04-01T00:00:00.000Z",
  updatedAt: "2026-04-05T12:00:00.000Z",
  ...overrides,
});

const record = (overrides: Partial<SaleRecord> = {}): SaleRecord => ({
  id: "r",
  date: "2026-06-15T12:00:00.000Z",
  nft: "C:1",
  collection: "C",
  type: "primary",
  asset: "XLM",
  gross: 10,
  platformFee: null,
  royalty: null,
  net: 10,
  txHash: "",
  ...overrides,
});

describe("escapeCsvField", () => {
  it("leaves plain text and numbers untouched", () => {
    expect(escapeCsvField("hello")).toBe("hello");
    expect(escapeCsvField(12.5)).toBe("12.5");
    expect(escapeCsvField(-3)).toBe("-3");
  });

  it("quotes commas, quotes and newlines, doubling embedded quotes", () => {
    expect(escapeCsvField("a,b")).toBe('"a,b"');
    expect(escapeCsvField('say "hi"')).toBe('"say ""hi"""');
    expect(escapeCsvField("line1\nline2")).toBe('"line1\nline2"');
    expect(escapeCsvField("cr\r")).toBe('"cr\r"');
  });

  it("neutralizes spreadsheet formula injection in text fields", () => {
    expect(escapeCsvField("=HYPERLINK(1)")).toBe("'=HYPERLINK(1)");
    expect(escapeCsvField("+1")).toBe("'+1");
    expect(escapeCsvField("@cmd")).toBe("'@cmd");
    expect(escapeCsvField("=a,b")).toBe("\"'=a,b\"");
  });

  it("renders null/undefined/non-finite as empty cells", () => {
    expect(escapeCsvField(null)).toBe("");
    expect(escapeCsvField(undefined)).toBe("");
    expect(escapeCsvField(Number.NaN)).toBe("");
  });
});

describe("buildSaleRecords", () => {
  it("exports only the creator's realized sales, most recent first", () => {
    const records = buildSaleRecords(
      [
        listing(),
        listing({ id: "active", status: "ACTIVE" }),
        listing({ id: "theirs", sellerId: "someone-else" }),
      ],
      [auction(), auction({ id: "running", status: "ACTIVE" })],
      CREATOR,
    );

    expect(records.map((r) => r.id)).toEqual(["auction:a1", "listing:l1"]);
  });

  it("uses raw numbers and UTC ISO dates", () => {
    const [r] = buildSaleRecords([listing({ price: "0.1" as unknown as number })], [], CREATOR);
    expect(r.gross).toBe(0.1);
    expect(r.date).toBe("2026-03-02T10:30:00.000Z");
    expect(r.asset).toBe("XLM");
    expect(r.type).toBe("primary");
    expect(r.nft).toBe("CCONTRACT:7");
  });

  it("leaves unreported fee/royalty empty and nets out reported ones", () => {
    const [plain] = buildSaleRecords([listing()], [], CREATOR);
    expect(plain.platformFee).toBeNull();
    expect(plain.royalty).toBeNull();
    expect(plain.net).toBe(50);

    const [detailed] = buildSaleRecords(
      [
        listing({
          platformFee: "1.25",
          royaltyAmount: 2.5,
          transactionHash: "abc123",
          nftName: "Sunset #7",
          collectionName: "Sunsets",
          saleType: "SECONDARY",
        }),
      ],
      [],
      CREATOR,
    );
    expect(detailed).toMatchObject({
      platformFee: 1.25,
      royalty: 2.5,
      net: 46.25,
      txHash: "abc123",
      nft: "Sunset #7",
      collection: "Sunsets",
      type: "secondary",
    });
  });
});

describe("filterByDateRange", () => {
  const records = [
    record({ id: "before", date: "2026-05-31T23:59:59.999Z" }),
    record({ id: "start", date: "2026-06-01T00:00:00.000Z" }),
    record({ id: "end", date: "2026-06-30T23:59:59.999Z" }),
    record({ id: "after", date: "2026-07-01T00:00:00.000Z" }),
  ];

  it("includes both endpoints as whole UTC days", () => {
    const ids = filterByDateRange(records, { from: "2026-06-01", to: "2026-06-30" }).map(
      (r) => r.id,
    );
    expect(ids).toEqual(["start", "end"]);
  });

  it("treats a missing bound as open-ended", () => {
    expect(filterByDateRange(records, { from: "2026-06-30" }).map((r) => r.id)).toEqual([
      "end",
      "after",
    ]);
    expect(filterByDateRange(records, { to: "2026-05-31" }).map((r) => r.id)).toEqual([
      "before",
    ]);
    expect(filterByDateRange(records)).toHaveLength(4);
  });

  it("ignores malformed bounds and drops undated records", () => {
    expect(filterByDateRange(records, { from: "June 1" })).toHaveLength(4);
    expect(filterByDateRange([record({ date: "" })], {})).toHaveLength(0);
  });
});

describe("salesToCsv", () => {
  it("writes the tax columns header and escaped CRLF-separated rows", () => {
    const csv = salesToCsv([
      record({
        nft: 'Big, "Bold" NFT',
        collection: "Line\nBreak",
        gross: 100,
        platformFee: 2.5,
        royalty: null,
        net: 97.5,
        txHash: "deadbeef",
      }),
    ]);

    const [header, row, trailing] = csv.split("\r\n");
    expect(header).toBe(
      "date,nft,collection,type,asset,gross,platform_fee,royalty,net,tx_hash",
    );
    expect(row).toBe(
      '2026-06-15T12:00:00.000Z,"Big, ""Bold"" NFT","Line\nBreak",primary,XLM,100,2.5,,97.5,deadbeef',
    );
    expect(trailing).toBe("");
  });

  it("produces just the header for an empty export", () => {
    expect(salesToCsv([])).toBe(
      "date,nft,collection,type,asset,gross,platform_fee,royalty,net,tx_hash\r\n",
    );
  });
});

describe("salesCsvFilename", () => {
  it("encodes the range in the file name", () => {
    expect(salesCsvFilename({ from: "2026-01-01", to: "2026-12-31" })).toBe(
      "nftopia-sales_2026-01-01_to_2026-12-31.csv",
    );
    expect(salesCsvFilename()).toBe("nftopia-sales_start_to_now.csv");
  });
});

describe("<SalesCsvExport />", () => {
  const sales = [
    record({ id: "jan", date: "2026-01-10T00:00:00.000Z", nft: "JAN" }),
    record({ id: "jun", date: "2026-06-10T00:00:00.000Z", nft: "JUN" }),
  ];

  it("downloads every sale when no range is chosen", () => {
    const onDownload = jest.fn();
    render(<SalesCsvExport sales={sales} onDownload={onDownload} />);

    fireEvent.click(screen.getByRole("button", { name: /export csv/i }));

    const [csv, filename] = onDownload.mock.calls[0];
    expect(csv).toContain("JAN");
    expect(csv).toContain("JUN");
    expect(filename).toBe("nftopia-sales_start_to_now.csv");
  });

  it("only exports sales inside the selected date range", () => {
    const onDownload = jest.fn();
    render(<SalesCsvExport sales={sales} onDownload={onDownload} />);

    fireEvent.change(screen.getByLabelText("From (UTC)"), {
      target: { value: "2026-06-01" },
    });
    fireEvent.change(screen.getByLabelText("To (UTC)"), {
      target: { value: "2026-06-30" },
    });
    expect(screen.getByRole("status")).toHaveTextContent("1 sale will be exported");

    fireEvent.click(screen.getByRole("button", { name: /export csv/i }));

    const [csv, filename] = onDownload.mock.calls[0];
    expect(csv).toContain("JUN");
    expect(csv).not.toContain("JAN");
    expect(filename).toBe("nftopia-sales_2026-06-01_to_2026-06-30.csv");
  });

  it("blocks export for an inverted range", () => {
    const onDownload = jest.fn();
    render(<SalesCsvExport sales={sales} onDownload={onDownload} />);

    fireEvent.change(screen.getByLabelText("From (UTC)"), {
      target: { value: "2026-07-01" },
    });
    fireEvent.change(screen.getByLabelText("To (UTC)"), {
      target: { value: "2026-06-01" },
    });

    expect(screen.getByRole("button", { name: /export csv/i })).toBeDisabled();
    expect(screen.getByRole("status")).toHaveTextContent(/start date must be on or before/i);
  });
});
