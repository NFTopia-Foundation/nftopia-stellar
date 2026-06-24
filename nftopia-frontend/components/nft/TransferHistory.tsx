"use client";

import React, { useMemo, useState } from "react";
import { formatDistanceToNow, format } from "date-fns";
import { ExternalLink, Copy, Check, User, Award, TrendingUp, ArrowRight } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { Skeleton } from "@/components/ui/skeleton";

export interface TransferEvent {
  id: string;
  fromAddress: string;
  toAddress: string;
  transactionHash: string;
  eventType: "mint" | "sale" | "transfer";
  price?: string | null;
  currency?: string | null;
  timestamp: string | Date;
  fromAddressTruncated?: string;
  toAddressTruncated?: string;
  blockExplorerUrl?: string;
}

export interface TransferHistoryProps {
  events: TransferEvent[];
  totalCount: number;
  loading?: boolean;
  hasNextPage?: boolean;
  onLoadMore?: () => void;
  onViewTransaction?: (transactionHash: string) => void;
  className?: string;
  showHeader?: boolean;
  itemsPerPage?: number;
}

const EVENT_TYPE_LABELS = {
  mint: { label: "Minted", icon: Award, color: "text-emerald-400 bg-emerald-400/10 border-emerald-400/20" },
  sale: { label: "Sold", icon: TrendingUp, color: "text-blue-400 bg-blue-400/10 border-blue-400/20" },
  transfer: { label: "Transferred", icon: ArrowRight, color: "text-purple-400 bg-purple-400/10 border-purple-400/20" },
};

const EVENT_TYPE_ORDER = {
  mint: 0,
  sale: 1,
  transfer: 2,
};

function formatAddress(address: string, truncate: boolean = true): string {
  if (!address) return "Unknown";
  if (!truncate) return address;
  if (address === "0x0000000000000000000000000000000000000000") return "Zero Address";
  return `${address.slice(0, 6)}...${address.slice(-4)}`;
}

function getExplorerUrl(transactionHash: string): string {
  const horizonUrl = process.env.NEXT_PUBLIC_HORIZON_URL || "https://horizon-testnet.stellar.org";
  // Use the network-specific explorer
  const isTestnet = horizonUrl.includes("testnet");
  const baseUrl = isTestnet 
    ? "https://testnet.stellar.org" 
    : "https://stellar.org";
  return `${baseUrl}/tx/${transactionHash}`;
}

function EventSkeleton() {
  return (
    <div className="flex items-center gap-4 py-3 px-4 border-b border-gray-800/50 last:border-0">
      <Skeleton className="h-8 w-8 rounded-full" />
      <div className="flex-1 space-y-2">
        <Skeleton className="h-4 w-3/4" />
        <Skeleton className="h-3 w-1/2" />
      </div>
      <Skeleton className="h-8 w-24" />
    </div>
  );
}

export function TransferHistory({
  events,
  totalCount,
  loading = false,
  hasNextPage = false,
  onLoadMore,
  onViewTransaction,
  className,
  showHeader = true,
  itemsPerPage = 10,
}: TransferHistoryProps) {
  const [copiedId, setCopiedId] = useState<string | null>(null);

  const sortedEvents = useMemo(() => {
    return [...events].sort((a, b) => {
      const dateA = new Date(a.timestamp).getTime();
      const dateB = new Date(b.timestamp).getTime();
      return dateB - dateA; // Newest first
    });
  }, [events]);

  const handleCopyAddress = async (address: string, eventId: string) => {
    try {
      await navigator.clipboard.writeText(address);
      setCopiedId(eventId);
      setTimeout(() => setCopiedId(null), 2000);
    } catch (error) {
      console.error("Failed to copy address:", error);
    }
  };

  const handleViewTransaction = (transactionHash: string) => {
    if (onViewTransaction) {
      onViewTransaction(transactionHash);
    } else {
      const url = getExplorerUrl(transactionHash);
      window.open(url, "_blank", "noopener,noreferrer");
    }
  };

  const renderEventIcon = (eventType: TransferEvent["eventType"]) => {
    const config = EVENT_TYPE_LABELS[eventType];
    if (!config) return null;
    const Icon = config.icon;
    return <Icon className={cn("h-4 w-4", config.color.split(" ")[0])} />;
  };

  const renderEventBadge = (eventType: TransferEvent["eventType"]) => {
    const config = EVENT_TYPE_LABELS[eventType];
    if (!config) return null;
    return (
      <span className={cn(
        "inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium border",
        config.color
      )}>
        {renderEventIcon(eventType)}
        {config.label}
      </span>
    );
  };

  const renderEventItem = (event: TransferEvent) => {
    const isMint = event.eventType === "mint";
    const formattedDate = format(new Date(event.timestamp), "MMM dd, yyyy HH:mm");
    const timeAgo = formatDistanceToNow(new Date(event.timestamp), { addSuffix: true });
    const isCopied = copiedId === event.id;

    return (
      <div
        key={event.id}
        className={cn(
          "flex flex-col sm:flex-row sm:items-center gap-3 py-3 px-4",
          "border-b border-gray-800/50 last:border-0",
          "hover:bg-white/5 transition-colors duration-150",
          "group"
        )}
      >
        {/* Event Type Badge */}
        <div className="flex items-center gap-3 sm:w-32 flex-shrink-0">
          {renderEventBadge(event.eventType)}
        </div>

        {/* Addresses */}
        <div className="flex-1 min-w-0 flex flex-col sm:flex-row sm:items-center gap-1 sm:gap-3">
          <div className="flex items-center gap-2 text-sm">
            <span className="text-gray-400">From:</span>
            <span className="text-white font-mono text-xs truncate">
              {isMint ? "✨ Creator" : formatAddress(event.fromAddress)}
            </span>
            {!isMint && event.fromAddress && event.fromAddress !== "0x0000000000000000000000000000000000000000" && (
              <button
                onClick={() => handleCopyAddress(event.fromAddress, `${event.id}-from`)}
                className="text-gray-500 hover:text-gray-300 transition-colors"
                aria-label="Copy from address"
              >
                {isCopied && copiedId === `${event.id}-from` ? (
                  <Check className="h-3 w-3 text-emerald-400" />
                ) : (
                  <Copy className="h-3 w-3" />
                )}
              </button>
            )}
          </div>

          <ArrowRight className="h-3 w-3 text-gray-600 hidden sm:block flex-shrink-0" />

          <div className="flex items-center gap-2 text-sm">
            <span className="text-gray-400">To:</span>
            <span className="text-white font-mono text-xs truncate">
              {formatAddress(event.toAddress)}
            </span>
            <button
              onClick={() => handleCopyAddress(event.toAddress, `${event.id}-to`)}
              className="text-gray-500 hover:text-gray-300 transition-colors"
              aria-label="Copy to address"
            >
              {isCopied && copiedId === `${event.id}-to` ? (
                <Check className="h-3 w-3 text-emerald-400" />
              ) : (
                <Copy className="h-3 w-3" />
              )}
            </button>
          </div>
        </div>

        {/* Price (if available) */}
        {event.price && event.eventType === "sale" && (
          <div className="flex items-center gap-1 text-sm text-emerald-400 font-medium flex-shrink-0">
            <span>{event.price}</span>
            <span className="text-gray-500 text-xs">{event.currency || "XLM"}</span>
          </div>
        )}

        {/* Timestamp & Transaction */}
        <div className="flex flex-col sm:flex-row sm:items-center gap-1 sm:gap-3 text-xs text-gray-400 flex-shrink-0">
          <span title={formattedDate}>{timeAgo}</span>
          <button
            onClick={() => handleViewTransaction(event.transactionHash)}
            className="flex items-center gap-1 text-primary hover:text-primary/80 transition-colors"
            aria-label="View on blockchain explorer"
          >
            <span className="hidden sm:inline">View Tx</span>
            <ExternalLink className="h-3 w-3" />
          </button>
        </div>
      </div>
    );
  };

  // Loading state
  if (loading && events.length === 0) {
    return (
      <Card className={cn("border-gray-800/50 bg-gray-900/30 backdrop-blur-sm", className)}>
        {showHeader && (
          <CardHeader>
            <CardTitle className="flex items-center justify-between text-lg">
              <span>Ownership History</span>
              <span className="text-sm font-normal text-gray-400">
                Loading...
              </span>
            </CardTitle>
          </CardHeader>
        )}
        <CardContent className="p-0 divide-y divide-gray-800/50">
          {Array.from({ length: 5 }).map((_, i) => (
            <EventSkeleton key={i} />
          ))}
        </CardContent>
      </Card>
    );
  }

  // Empty state
  if (events.length === 0 && !loading) {
    return (
      <Card className={cn("border-gray-800/50 bg-gray-900/30 backdrop-blur-sm", className)}>
        {showHeader && (
          <CardHeader>
            <CardTitle className="text-lg">Ownership History</CardTitle>
          </CardHeader>
        )}
        <CardContent>
          <EmptyState
            icon={<Award className="h-12 w-12 text-purple-400/60" />}
            title="No Transfer History"
            description="This NFT has no recorded transfers yet. It may be newly minted or the history hasn't been indexed."
          />
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className={cn("border-gray-800/50 bg-gray-900/30 backdrop-blur-sm", className)}>
      {showHeader && (
        <CardHeader>
          <CardTitle className="flex items-center justify-between text-lg">
            <span>Ownership History</span>
            <span className="text-sm font-normal text-gray-400">
              {totalCount} {totalCount === 1 ? "transfer" : "transfers"}
            </span>
          </CardTitle>
        </CardHeader>
      )}
      <CardContent className="p-0">
        <div className="divide-y divide-gray-800/50">
          {sortedEvents.map(renderEventItem)}
        </div>

        {/* Load More */}
        {hasNextPage && onLoadMore && (
          <div className="flex justify-center p-4 border-t border-gray-800/50">
            <Button
              variant="outline"
              size="sm"
              onClick={onLoadMore}
              disabled={loading}
              className="w-full sm:w-auto"
            >
              {loading ? "Loading..." : "Load More"}
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

export default TransferHistory;