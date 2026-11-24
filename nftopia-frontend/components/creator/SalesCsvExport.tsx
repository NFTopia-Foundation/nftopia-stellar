"use client";

import { useId, useMemo, useState } from "react";
import { Download } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  downloadCsv,
  filterByDateRange,
  salesCsvFilename,
  salesToCsv,
  type SaleRecord,
} from "@/lib/sales-export";

interface SalesCsvExportProps {
  sales: SaleRecord[];
  disabled?: boolean;
  /** Injectable for tests; defaults to a browser file download. */
  onDownload?: (csv: string, filename: string) => void;
}

const inputClass =
  "rounded-md border border-white/10 bg-transparent px-3 py-1.5 text-sm text-nftopia-text focus:outline-none focus:ring-2 focus:ring-nftopia-purple";

/**
 * "Export CSV" control for the creator Sales page (#758): an optional UTC date
 * range plus a button that downloads every realized sale in that range as a
 * tax-ready CSV. Generated entirely client-side from the full sales history
 * the page already loaded (not just the rows visible in the feed).
 */
export function SalesCsvExport({
  sales,
  disabled,
  onDownload = downloadCsv,
}: SalesCsvExportProps) {
  const fromId = useId();
  const toId = useId();
  const statusId = useId();
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");

  const invalidRange = Boolean(from && to && from > to);
  const inRange = useMemo(
    () => (invalidRange ? [] : filterByDateRange(sales, { from, to })),
    [sales, from, to, invalidRange],
  );

  const handleExport = () => {
    if (invalidRange || inRange.length === 0) return;
    onDownload(salesToCsv(inRange), salesCsvFilename({ from, to }));
  };

  let status: string;
  if (invalidRange) status = "The start date must be on or before the end date.";
  else if (inRange.length === 0) status = "No completed sales in this date range.";
  else status = `${inRange.length} sale${inRange.length === 1 ? "" : "s"} will be exported (dates in UTC).`;

  return (
    <section
      aria-labelledby={`${statusId}-title`}
      data-testid="sales-csv-export"
      className="rounded-lg border border-white/10 p-4"
    >
      <h2 id={`${statusId}-title`} className="mb-3 text-lg font-semibold text-nftopia-text">
        Export sales history
      </h2>
      <div className="flex flex-wrap items-end gap-3">
        <div className="flex flex-col gap-1">
          <label htmlFor={fromId} className="text-xs text-nftopia-subtext">
            From (UTC)
          </label>
          <input
            id={fromId}
            type="date"
            value={from}
            max={to || undefined}
            onChange={(e) => setFrom(e.target.value)}
            className={inputClass}
          />
        </div>
        <div className="flex flex-col gap-1">
          <label htmlFor={toId} className="text-xs text-nftopia-subtext">
            To (UTC)
          </label>
          <input
            id={toId}
            type="date"
            value={to}
            min={from || undefined}
            onChange={(e) => setTo(e.target.value)}
            className={inputClass}
          />
        </div>
        <Button
          type="button"
          onClick={handleExport}
          disabled={disabled || invalidRange || inRange.length === 0}
          aria-describedby={statusId}
        >
          <Download className="mr-2 size-4" aria-hidden="true" />
          Export CSV
        </Button>
      </div>
      <p
        id={statusId}
        role="status"
        className={`mt-2 text-xs ${invalidRange ? "text-red-400" : "text-nftopia-subtext"}`}
      >
        {status}
      </p>
    </section>
  );
}
