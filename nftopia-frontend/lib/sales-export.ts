import type { Auction, Listing } from "@/types/marketplace";
import { toNftKey } from "@/lib/services/marketplace";

/**
 * Creator sales-history CSV export for tax reporting (#758).
 *
 * Only *realized* sales are exported (SOLD listings, COMPLETED/SETTLED
 * auctions) — an active listing or cancelled auction is not income. Values
 * are raw numbers and UTC ISO-8601 timestamps, never the localized display
 * strings from components/marketplace/format.ts, so spreadsheets and
 * accounting tools can parse them.
 *
 * Fee / royalty / tx hash / collection / NFT name are taken from the API
 * record when it provides them. The current REST listing and auction
 * payloads don't include them, so those cells are left empty (not 0) to
 * make clear they weren't reported, and `net` is gross minus whatever fee
 * and royalty *were* reported.
 */

export type SaleType = "primary" | "secondary" | "royalty";

export interface SaleRecord {
  id: string;
  /** UTC ISO-8601 timestamp of the sale. */
  date: string;
  nft: string;
  collection: string;
  type: SaleType;
  asset: string;
  gross: number;
  platformFee: number | null;
  royalty: number | null;
  net: number;
  txHash: string;
}

export interface DateRange {
  /** Inclusive start date, "YYYY-MM-DD" (interpreted as UTC midnight). */
  from?: string | null;
  /** Inclusive end date, "YYYY-MM-DD" (the whole UTC day is included). */
  to?: string | null;
}

export const SALES_CSV_COLUMNS = [
  "date",
  "nft",
  "collection",
  "type",
  "asset",
  "gross",
  "platform_fee",
  "royalty",
  "net",
  "tx_hash",
] as const;

/** Optional fields some API payloads carry; read defensively. */
interface OptionalSaleFields {
  nftName?: string | null;
  collectionName?: string | null;
  collection?: { name?: string | null } | string | null;
  platformFee?: number | string | null;
  royaltyAmount?: number | string | null;
  royalty?: number | string | null;
  transactionHash?: string | null;
  txHash?: string | null;
  saleType?: string | null;
  soldAt?: string | null;
}

const DEFAULT_ASSET = "XLM";
const DAY_MS = 24 * 60 * 60 * 1000;

function optionalNumber(value: unknown): number | null {
  if (value === null || value === undefined || value === "") return null;
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}

function toIsoUtc(value: string | null | undefined): string {
  if (!value) return "";
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? "" : d.toISOString();
}

function collectionOf(extra: OptionalSaleFields, fallback: string): string {
  if (typeof extra.collection === "string") return extra.collection;
  return extra.collection?.name ?? extra.collectionName ?? fallback;
}

function saleTypeOf(extra: OptionalSaleFields): SaleType {
  const t = extra.saleType?.toLowerCase();
  // Sales on the creator dashboard are the creator selling their own NFT,
  // i.e. primary sales, unless the API says otherwise.
  return t === "secondary" || t === "royalty" ? t : "primary";
}

function round7(n: number): number {
  // Stellar amounts have 7 decimal places; strip float noise.
  return Number(n.toFixed(7));
}

function buildRecord(
  id: string,
  base: { contractId: string; tokenId: string; amount: unknown; currency?: string | null; timestamp: string },
  extra: OptionalSaleFields,
): SaleRecord {
  const gross = round7(Number(base.amount) || 0);
  const platformFee = optionalNumber(extra.platformFee);
  const royalty = optionalNumber(extra.royaltyAmount ?? extra.royalty);
  return {
    id,
    date: toIsoUtc(extra.soldAt ?? base.timestamp),
    nft: extra.nftName || toNftKey(base.contractId, base.tokenId),
    collection: collectionOf(extra, base.contractId),
    type: saleTypeOf(extra),
    asset: base.currency || DEFAULT_ASSET,
    gross,
    platformFee,
    royalty,
    net: round7(gross - (platformFee ?? 0) - (royalty ?? 0)),
    txHash: extra.transactionHash ?? extra.txHash ?? "",
  };
}

/** Builds the creator's realized-sales records, most recent first. */
export function buildSaleRecords(
  listings: Listing[],
  auctions: Auction[],
  creatorId: string,
): SaleRecord[] {
  const fromListings = listings
    .filter((l) => l.sellerId === creatorId && l.status === "SOLD")
    .map((l) =>
      buildRecord(
        `listing:${l.id}`,
        {
          contractId: l.nftContractId,
          tokenId: l.nftTokenId,
          amount: l.price,
          currency: l.currency,
          timestamp: l.updatedAt || l.createdAt,
        },
        l as Listing & OptionalSaleFields,
      ),
    );

  const fromAuctions = auctions
    .filter(
      (a) =>
        a.sellerId === creatorId &&
        (a.status === "COMPLETED" || a.status === "SETTLED"),
    )
    .map((a) =>
      buildRecord(
        `auction:${a.id}`,
        {
          contractId: a.nftContractId,
          tokenId: a.nftTokenId,
          amount: a.currentPrice ?? a.startPrice,
          currency: DEFAULT_ASSET,
          timestamp: a.updatedAt || a.endTime || a.createdAt,
        },
        a as Auction & OptionalSaleFields,
      ),
    );

  return [...fromListings, ...fromAuctions].sort(
    (a, b) => new Date(b.date).getTime() - new Date(a.date).getTime(),
  );
}

function parseDay(value: string | null | undefined): number | null {
  if (!value) return null;
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (!match) return null;
  const ms = Date.UTC(Number(match[1]), Number(match[2]) - 1, Number(match[3]));
  return Number.isNaN(ms) ? null : ms;
}

/** Keeps records whose date falls in [from 00:00 UTC, to 23:59:59.999 UTC]. */
export function filterByDateRange(records: SaleRecord[], range: DateRange = {}): SaleRecord[] {
  const from = parseDay(range.from);
  const toStart = parseDay(range.to);
  const toExclusive = toStart === null ? null : toStart + DAY_MS;

  return records.filter((r) => {
    const t = new Date(r.date).getTime();
    if (Number.isNaN(t)) return false;
    if (from !== null && t < from) return false;
    if (toExclusive !== null && t >= toExclusive) return false;
    return true;
  });
}

/**
 * Escapes one CSV field per RFC 4180: fields containing a comma, quote, CR or
 * LF are quoted, with embedded quotes doubled. Text fields that start with a
 * formula trigger (= + - @ tab CR) are prefixed with an apostrophe so a
 * spreadsheet doesn't execute them (CSV injection). Numbers are never
 * prefixed — negative amounts must stay numeric.
 */
export function escapeCsvField(value: string | number | null | undefined): string {
  if (value === null || value === undefined) return "";
  if (typeof value === "number") return Number.isFinite(value) ? String(value) : "";
  let text = value;
  if (/^[=+\-@\t\r]/.test(text)) text = `'${text}`;
  return /[",\r\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}

/** Serializes records to CSV (header row + CRLF line endings, per RFC 4180). */
export function salesToCsv(records: SaleRecord[]): string {
  const rows = records.map((r) =>
    [
      r.date,
      r.nft,
      r.collection,
      r.type,
      r.asset,
      r.gross,
      r.platformFee,
      r.royalty,
      r.net,
      r.txHash,
    ]
      .map(escapeCsvField)
      .join(","),
  );
  return [SALES_CSV_COLUMNS.join(","), ...rows].join("\r\n") + "\r\n";
}

/** File name like "nftopia-sales_2026-01-01_to_2026-12-31.csv". */
export function salesCsvFilename(range: DateRange = {}): string {
  const from = range.from || "start";
  const to = range.to || "now";
  return `nftopia-sales_${from}_to_${to}.csv`;
}

/** Triggers a browser download of `csv`. A UTF-8 BOM keeps Excel from mangling non-ASCII names. */
export function downloadCsv(csv: string, filename: string): void {
  const blob = new Blob(["﻿", csv], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  link.rel = "noopener";
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}
