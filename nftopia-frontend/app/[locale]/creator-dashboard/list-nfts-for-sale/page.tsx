"use client";

import { useState } from "react";
import Image from "next/image";
import { Package, Tag, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { EmptyState } from "@/components/ui/empty-state";
import { Skeleton } from "@/components/ui/skeleton";
import { Card, CardContent, CardFooter } from "@/components/ui/card";
import { useToast } from "@/lib/stores";
import { useCreatorListings } from "@/hooks/useCreatorListings";
import { MarketStateBadge } from "@/components/marketplace/MarketStateBadge";
import { formatAmount } from "@/components/marketplace/format";
import type { MarketplaceNft } from "@/types/marketplace";

const FALLBACK_IMAGE = "/images/fallbacks/nft-fallback.svg";

/**
 * A single owned-NFT card: shows the NFT, its resolved market state, and the
 * contextual action (create listing for an unlisted NFT, cancel for an active
 * one). The create form is revealed inline to keep the action close to the item.
 */
function NftListingCard({
  nft,
  onCreate,
  onCancel,
}: {
  nft: MarketplaceNft;
  onCreate: (
    nft: MarketplaceNft,
    input: { price: number; currency: string },
  ) => Promise<void>;
  onCancel: (nft: MarketplaceNft) => Promise<void>;
}) {
  const [showForm, setShowForm] = useState(false);
  const [price, setPrice] = useState("");
  const [busy, setBusy] = useState(false);

  const submit = async () => {
    const parsed = Number(price);
    if (!Number.isFinite(parsed) || parsed <= 0) return;
    setBusy(true);
    try {
      await onCreate(nft, { price: parsed, currency: "XLM" });
      setShowForm(false);
      setPrice("");
    } finally {
      setBusy(false);
    }
  };

  const cancel = async () => {
    setBusy(true);
    try {
      await onCancel(nft);
    } finally {
      setBusy(false);
    }
  };

  return (
    <Card className="overflow-hidden">
      <div className="relative aspect-square w-full bg-zinc-900">
        <Image
          src={nft.imageUrl || FALLBACK_IMAGE}
          alt={nft.name || "NFT"}
          fill
          sizes="(max-width: 768px) 100vw, 33vw"
          className="object-cover"
        />
      </div>
      <CardContent className="space-y-2 pt-4">
        <div className="flex items-center justify-between gap-2">
          <h3 className="truncate font-semibold text-nftopia-text">
            {nft.name || `Token #${nft.tokenId}`}
          </h3>
          <MarketStateBadge state={nft.state} />
        </div>
        {nft.listing && (
          <p className="text-sm text-nftopia-subtext">
            Listed at {formatAmount(nft.listing.price, nft.listing.currency)}
          </p>
        )}
        {showForm && (
          <div className="space-y-2 pt-2">
            <Label htmlFor={`price-${nft.nftKey}`}>Price (XLM)</Label>
            <Input
              id={`price-${nft.nftKey}`}
              type="number"
              min="0"
              step="0.0000001"
              value={price}
              onChange={(e) => setPrice(e.target.value)}
              placeholder="25.0"
            />
          </div>
        )}
      </CardContent>
      <CardFooter className="gap-2">
        {nft.state === "ACTIVE" ? (
          <Button
            variant="danger-ghost"
            loading={busy}
            onClick={cancel}
            className="w-full"
          >
            <X className="size-4" /> Cancel listing
          </Button>
        ) : nft.state === "NOT_LISTED" ? (
          showForm ? (
            <>
              <Button
                variant="outline"
                onClick={() => setShowForm(false)}
                disabled={busy}
                className="flex-1"
              >
                Cancel
              </Button>
              <Button
                loading={busy}
                onClick={submit}
                disabled={!price}
                className="flex-1"
              >
                Confirm
              </Button>
            </>
          ) : (
            <Button onClick={() => setShowForm(true)} className="w-full">
              <Tag className="size-4" /> List for sale
            </Button>
          )
        ) : (
          <span className="w-full py-2 text-center text-sm text-nftopia-subtext">
            {nft.state === "SOLD" ? "Already sold" : "Listing expired"}
          </span>
        )}
      </CardFooter>
    </Card>
  );
}

/** Loading placeholder grid shown while owned NFTs resolve. */
function LoadingGrid() {
  return (
    <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
      {Array.from({ length: 6 }).map((_, i) => (
        <div key={i} className="space-y-3">
          <Skeleton className="aspect-square w-full rounded-lg" />
          <Skeleton className="h-4 w-2/3" />
          <Skeleton className="h-9 w-full" />
        </div>
      ))}
    </div>
  );
}

/**
 * "List NFTs for Sale" — the creator's inventory management view. Loads owned
 * NFTs, resolves each one's listing status, and lets the creator create or
 * cancel listings with immediate per-item feedback.
 */
export default function ListNFTsForSale() {
  const { nfts, loading, error, refetch, createListing, cancelListing } =
    useCreatorListings();
  const { showSuccess, showError } = useToast();

  const handleCreate = async (
    nft: MarketplaceNft,
    input: { price: number; currency: string },
  ) => {
    try {
      await createListing(nft, input);
      showSuccess("Listing created.");
    } catch (err) {
      showError(
        err instanceof Error ? err.message : "Could not create listing.",
      );
    }
  };

  const handleCancel = async (nft: MarketplaceNft) => {
    try {
      await cancelListing(nft);
      showSuccess("Listing cancelled.");
    } catch (err) {
      showError(
        err instanceof Error ? err.message : "Could not cancel listing.",
      );
    }
  };

  return (
    <div className="mx-auto w-full max-w-6xl px-4 py-8">
      <header className="mb-6">
        <h1 className="text-3xl font-bold text-nftopia-text">
          List NFTs For Sale
        </h1>
        <p className="text-nftopia-subtext">
          Create or cancel listings for the NFTs you own.
        </p>
      </header>

      {error && (
        <Alert variant="destructive" className="mb-6">
          <AlertTitle>Couldn&apos;t load your NFTs</AlertTitle>
          <AlertDescription className="flex items-center justify-between gap-4">
            <span>{error}</span>
            <Button variant="outline" size="sm" onClick={() => refetch()}>
              Retry
            </Button>
          </AlertDescription>
        </Alert>
      )}

      {loading ? (
        <LoadingGrid />
      ) : nfts.length === 0 && !error ? (
        <EmptyState
          icon={<Package className="size-10 text-nftopia-subtext" />}
          title="No NFTs to list"
          description="Once you own or mint NFTs, they'll appear here ready to list for sale."
        />
      ) : (
        <div
          data-testid="nft-grid"
          className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3"
        >
          {nfts.map((nft) => (
            <NftListingCard
              key={nft.nftKey}
              nft={nft}
              onCreate={handleCreate}
              onCancel={handleCancel}
            />
          ))}
        </div>
      )}
    </div>
  );
}
