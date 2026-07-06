"use client";

import React, { useState, useEffect, useCallback } from "react";
import { useTranslations } from "next-intl";
import { 
  ArrowLeft, 
  Copy, 
  Check, 
  User,
  Wallet,
  Award
} from "lucide-react";
import Link from "next/link";
import Image from "next/image";

import { CircuitBackground } from "@/components/circuit-background";
import { Card, CardContent } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { Skeleton } from "@/components/ui/skeleton";
import { useNFTByIdQuery, useNFTTransferHistoryQuery } from "@/hooks/graphql/useNFTQueries";
import TransferHistory from "@/components/nft/TransferHistory";

// Helper function to format address
function formatAddress(address: string | null | undefined): string {
  if (!address) return "Unknown";
  if (address === "0x0000000000000000000000000000000000000000") return "Zero Address";
  return `${address.slice(0, 6)}...${address.slice(-4)}`;
}

// Helper function to format date
function formatDate(date: string | Date | null | undefined): string {
  if (!date) return "N/A";
  const d = new Date(date);
  return d.toLocaleDateString("en-US", {
    year: "numeric",
    month: "long",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

// Skeleton component for NFT detail
function NftDetailSkeleton() {
  return (
    <div className="max-w-7xl mx-auto px-4 py-8">
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        <div className="space-y-4">
          <Skeleton className="aspect-square w-full rounded-xl" />
        </div>
        <div className="space-y-6">
          <Skeleton className="h-8 w-3/4" />
          <Skeleton className="h-4 w-1/2" />
          <Skeleton className="h-24 w-full" />
          <div className="grid grid-cols-2 gap-4">
            <Skeleton className="h-20 w-full" />
            <Skeleton className="h-20 w-full" />
          </div>
          <Skeleton className="h-12 w-full" />
        </div>
      </div>
    </div>
  );
}

// Client NFT Detail Page Component
export default function NFTDetailClient({
  nftId,
  initialNft,
}: {
  nftId: string;
  initialNft: any;
}) {
  const t = useTranslations("common");

  const [copiedAddress, setCopiedAddress] = useState<string | null>(null);
  const [transferHistoryPage, setTransferHistoryPage] = useState(1);

  // Fetch NFT data
  const {
    data: nftData,
    loading: nftLoading,
    error: nftError,
  } = useNFTByIdQuery({
    id: nftId,
  });

  // Fetch transfer history
  const {
    data: historyData,
    loading: historyLoading,
    refetch: refetchHistory,
  } = useNFTTransferHistoryQuery({
    nftId,
    page: transferHistoryPage,
    limit: 10,
  });

  // Refetch when page changes
  useEffect(() => {
    if (nftId) {
      refetchHistory({
        nftId,
        page: transferHistoryPage,
        limit: 10,
      });
    }
  }, [transferHistoryPage, nftId, refetchHistory]);

  const nft = nftData?.nft || initialNft;
  const transferEvents = historyData?.nftTransferHistory?.edges?.map((edge: any) => edge.node) || [];
  const totalTransfers = historyData?.nftTransferHistory?.totalCount || 0;
  const hasNextPage = historyData?.nftTransferHistory?.pageInfo?.hasNextPage || false;

  const handleCopyAddress = useCallback(async (address: string) => {
    try {
      await navigator.clipboard.writeText(address);
      setCopiedAddress(address);
      setTimeout(() => setCopiedAddress(null), 2000);
    } catch (error) {
      console.error("Failed to copy address:", error);
    }
  }, []);

  const handleLoadMore = useCallback(() => {
    if (hasNextPage) {
      setTransferHistoryPage((prev) => prev + 1);
    }
  }, [hasNextPage]);

  const handleViewTransaction = useCallback((transactionHash: string) => {
    const horizonUrl = process.env.NEXT_PUBLIC_HORIZON_URL || "https://horizon-testnet.stellar.org";
    const isTestnet = horizonUrl.includes("testnet");
    const baseUrl = isTestnet ? "https://testnet.stellar.org" : "https://stellar.org";
    window.open(`${baseUrl}/tx/${transactionHash}`, "_blank", "noopener,noreferrer");
  }, []);

  // Loading state
  if (nftLoading && !initialNft) {
    return (
      <main className="min-h-screen relative text-white overflow-hidden">
        <CircuitBackground />
        <div className="relative z-10">
          <NftDetailSkeleton />
        </div>
      </main>
    );
  }

  // Error state
  if ((nftError && !initialNft) || (!nft && !nftLoading)) {
    return (
      <main className="min-h-screen relative text-white overflow-hidden">
        <CircuitBackground />
        <div className="relative z-10 max-w-7xl mx-auto px-4 py-8">
          <EmptyState
            icon={<div className="text-4xl">🔍</div>}
            title="NFT Not Found"
            description={nftError?.message || "The NFT you're looking for doesn't exist or has been removed."}
            actionLabel="Go Back"
            onAction={() => window.history.back()}
          />
        </div>
      </main>
    );
  }

  const isCreator = nft.creator?.id === nft.ownerId;
  const creatorAddress = nft.creator?.walletAddress || nft.creator?.id || "Unknown";
  const creatorProfileSlug =
    nft.creator?.username || nft.creator?.id || creatorAddress;
  const ownerAddress = nft.owner?.walletAddress || nft.owner?.id || "Unknown";

  return (
    <main className="min-h-screen relative text-white overflow-hidden">
      <CircuitBackground />

      <div className="relative z-10 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Back Button */}
        <Link
          href="/marketplace"
          className="inline-flex items-center gap-2 text-gray-400 hover:text-white transition-colors mb-6"
        >
          <ArrowLeft className="h-4 w-4" />
          <span>Back to Marketplace</span>
        </Link>

        {/* NFT Detail Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          {/* Left Column - Image */}
          <div className="space-y-4">
            <div className="relative aspect-square w-full rounded-xl overflow-hidden bg-gray-900/50 border border-gray-800/50">
              {nft.image ? (
                <Image
                  src={nft.image}
                  alt={nft.name}
                  fill
                  className="object-cover"
                  sizes="(max-width: 768px) 100vw, 50vw"
                  priority
                />
              ) : (
                <div className="w-full h-full flex items-center justify-center text-gray-600">
                  <span className="text-6xl">🖼️</span>
                </div>
              )}
            </div>

            {/* Collection Info */}
            {nft.collection && (
              <div className="flex items-center gap-3 p-3 rounded-lg bg-gray-900/30 border border-gray-800/50">
                <div className="w-10 h-10 rounded-full bg-purple-500/20 flex items-center justify-center">
                  <span className="text-sm font-bold text-purple-400">
                    {nft.collection.symbol?.slice(0, 3) || "C"}
                  </span>
                </div>
                <div>
                  <p className="text-sm font-medium text-white">{nft.collection.name}</p>
                  <p className="text-xs text-gray-400">{nft.collection.symbol}</p>
                </div>
              </div>
            )}
          </div>

          {/* Right Column - Details */}
          <div className="space-y-6">
            {/* NFT Name & Token ID */}
            <div>
              <h1 className="text-3xl font-bold text-white mb-2">{nft.name}</h1>
              <div className="flex items-center gap-3 text-sm text-gray-400">
                <span>Token ID: <span className="font-mono text-gray-300">{nft.tokenId}</span></span>
                <button
                  onClick={() => handleCopyAddress(nft.tokenId)}
                  className="text-gray-500 hover:text-gray-300 transition-colors"
                  aria-label="Copy token ID"
                >
                  {copiedAddress === nft.tokenId ? (
                    <Check className="h-3 w-3 text-emerald-400" />
                  ) : (
                    <Copy className="h-3 w-3" />
                  )}
                </button>
              </div>
            </div>

            {/* Description */}
            {nft.description && (
              <p className="text-gray-300 leading-relaxed">{nft.description}</p>
            )}

            {/* Attributes Grid */}
            {nft.attributes && nft.attributes.length > 0 && (
              <div>
                <h3 className="text-sm font-semibold text-gray-400 mb-2">Attributes</h3>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                  {nft.attributes.map((attr: any, index: number) => (
                    <div
                      key={index}
                      className="p-2 rounded-lg bg-gray-900/30 border border-gray-800/50 text-center"
                    >
                      <p className="text-xs text-gray-400">{attr.traitType}</p>
                      <p className="text-sm font-medium text-white truncate">{attr.value}</p>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Owner & Creator Info */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {/* Creator */}
              <Card className="border-gray-800/50 bg-gray-900/30">
                <CardContent className="p-4">
                  <div className="flex items-center gap-2 text-sm text-gray-400 mb-1">
                    <Award className="h-4 w-4 text-emerald-400" />
                    <span>Creator</span>
                    {isCreator && (
                      <span className="ml-1 text-xs text-emerald-400 bg-emerald-400/10 px-2 py-0.5 rounded-full">
                        Owner
                      </span>
                    )}
                  </div>
                  <div className="flex items-center gap-2">
                    <Link
                      href={`/creator/${encodeURIComponent(creatorProfileSlug)}`}
                      className="font-mono text-sm text-white truncate hover:text-purple-300 transition-colors"
                    >
                      {nft.creator?.username || formatAddress(creatorAddress)}
                    </Link>
                    <button
                      onClick={() => handleCopyAddress(creatorAddress)}
                      className="text-gray-500 hover:text-gray-300 transition-colors flex-shrink-0"
                      aria-label="Copy creator address"
                    >
                      {copiedAddress === creatorAddress ? (
                        <Check className="h-3 w-3 text-emerald-400" />
                      ) : (
                        <Copy className="h-3 w-3" />
                      )}
                    </button>
                  </div>
                  <p className="text-xs text-gray-500 mt-1">
                    Minted {formatDate(nft.mintedAt)}
                  </p>
                </CardContent>
              </Card>

              {/* Owner */}
              <Card className="border-gray-800/50 bg-gray-900/30">
                <CardContent className="p-4">
                  <div className="flex items-center gap-2 text-sm text-gray-400 mb-1">
                    <User className="h-4 w-4 text-blue-400" />
                    <span>Current Owner</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="font-mono text-sm text-white truncate">
                      {formatAddress(ownerAddress)}
                    </span>
                    <button
                      onClick={() => handleCopyAddress(ownerAddress)}
                      className="text-gray-500 hover:text-gray-300 transition-colors flex-shrink-0"
                      aria-label="Copy owner address"
                    >
                      {copiedAddress === ownerAddress ? (
                        <Check className="h-3 w-3 text-emerald-400" />
                      ) : (
                        <Copy className="h-3 w-3" />
                      )}
                    </button>
                  </div>
                  {nft.lastPrice && (
                    <p className="text-xs text-emerald-400 mt-1">
                      Last Sale: {nft.lastPrice} XLM
                    </p>
                  )}
                </CardContent>
              </Card>
            </div>

            {/* Contract Address */}
            {nft.contractAddress && (
              <div className="flex items-center gap-2 text-sm text-gray-400 p-3 rounded-lg bg-gray-900/20 border border-gray-800/30">
                <Wallet className="h-4 w-4 flex-shrink-0" />
                <span className="truncate">Contract: {nft.contractAddress}</span>
                <button
                  onClick={() => handleCopyAddress(nft.contractAddress)}
                  className="text-gray-500 hover:text-gray-300 transition-colors flex-shrink-0 ml-auto"
                  aria-label="Copy contract address"
                >
                  {copiedAddress === nft.contractAddress ? (
                    <Check className="h-3 w-3 text-emerald-400" />
                  ) : (
                    <Copy className="h-3 w-3" />
                  )}
                </button>
              </div>
            )}
          </div>
        </div>

        {/* Transfer History / Provenance Section */}
        <div className="mt-12">
          <TransferHistory
            events={transferEvents.map((event: any) => ({
              ...event,
              blockExplorerUrl: event.blockExplorerUrl || undefined,
            }))}
            totalCount={totalTransfers}
            loading={historyLoading}
            hasNextPage={hasNextPage}
            onLoadMore={handleLoadMore}
            onViewTransaction={handleViewTransaction}
            className="border-gray-800/50 bg-gray-900/30 backdrop-blur-sm"
            showHeader={true}
          />
        </div>
      </div>
    </main>
  );
}
