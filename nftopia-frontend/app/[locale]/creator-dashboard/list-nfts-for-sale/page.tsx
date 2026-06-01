"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { AlertTriangle, Plus, RefreshCw } from "lucide-react";
import { useTranslation } from "@/hooks/useTranslation";
import { useAuthStore } from "@/lib/stores/auth-store";
import { useLocalizedRoute } from "@/lib/routing";

import { fetchWithAuth } from "@/lib/api/fetchWithAuth";
import { useToast } from "@/lib/stores";
import type { CreatorInventoryItem, CreatorNFTListingStatus } from "@/lib/marketplace/creatorMarketplaceTypes";
import { mapInventoryItems, toCreatorInventoryNFT } from "@/lib/marketplace/creatorMarketplaceMapper";

import {
  cancelListing,
  createListing,
  fetchCreatorOwnedNfts,
  fetchListingByNftId,
} from "@/lib/marketplace/creatorMarketplaceApi";

function ListingStatusPill({ status }: { status: CreatorNFTListingStatus }) {
  const base =
    "inline-flex items-center rounded-full px-3 py-1 text-xs font-semibold border";

  switch (status.kind) {
    case "active":
      return <span className={`${base} border-emerald-500/30 bg-emerald-500/10 text-emerald-200`}>Active</span>;
    case "sold":
      return <span className={`${base} border-amber-500/30 bg-amber-500/10 text-amber-200`}>Sold</span>;
    case "not_listed":
      return <span className={`${base} border-border bg-card text-muted-foreground`}>Not listed</span>;
    default:
      return <span className={`${base} border-border bg-card text-muted-foreground`}>Unknown</span>;
  }
}

export default function ListNFTsForSalePage() {
  const { t } = useTranslation();
  const router = useRouter();
  const localizedRoute = useLocalizedRoute();
  const { showSuccess, showError } = useToast();

  const { user, isAuthenticated, accessToken } = useAuthStore();

  const ownerId = user?.sub;

  const [loading, setLoading] = useState(false);
  const [globalError, setGlobalError] = useState<string | null>(null);
  const [items, setItems] = useState<CreatorInventoryItem[]>([]);

  // Per NFT controls
  const [priceByNftId, setPriceByNftId] = useState<Record<string, string>>({});
  const [currencyByNftId, setCurrencyByNftId] = useState<Record<string, string>>({});
  const [expiresAtByNftId, setExpiresAtByNftId] = useState<Record<string, string>>({});

  const resolvedTokens = useMemo(() => {
    return items.map((x) => x.nft.id);
  }, [items]);

  useEffect(() => {
    if (!isAuthenticated) {
      router.push(localizedRoute("/auth/login"));
      return;
    }
    if (!ownerId) return;

    const run = async () => {
      setLoading(true);
      setGlobalError(null);
      try {
        const nfts = await fetchCreatorOwnedNfts({ ownerId, page: 1, limit: 20 });

        // Resolve listing state deterministically by calling /listings/nft/:nftId per NFT.
        // NOTE: If backend evolves to provide bulk listing state, replace this N+1 in a future refactor.
        const listingsByNftId: Record<string, Awaited<ReturnType<typeof fetchListingByNftId>> extends null ? string : string> = {} as any;
        const resolved: Record<string, any> = {};

        await Promise.all(
          nfts.map(async (nft) => {
            const creatorNft = toCreatorInventoryNFT(nft);
            const nftKey = `${creatorNft.contractId}:${creatorNft.tokenId}`;
            const listing = await fetchListingByNftId(nftKey);
            resolved[nftKey] = listing;
          })
        );

        setItems(mapInventoryItems(nfts, resolved));
      } catch (e: any) {
        const msg = e?.message || t("creatorMarketplace.errors.load") || "Failed to load listing data";
        setGlobalError(msg);
        showError(msg);
      } finally {
        setLoading(false);
      }
    };

    run();
  }, [isAuthenticated, ownerId, router, localizedRoute, showError, t, resolvedTokens]);

  const refetch = async () => {
    if (!ownerId) return;

    setLoading(true);
    setGlobalError(null);
    try {
      const nfts = await fetchCreatorOwnedNfts({ ownerId, page: 1, limit: 20 });
      const resolved: Record<string, any> = {};

      await Promise.all(
        nfts.map(async (nft) => {
          const creatorNft = toCreatorInventoryNFT(nft);
          const nftKey = `${creatorNft.contractId}:${creatorNft.tokenId}`;
          const listing = await fetchListingByNftId(nftKey);
          resolved[nftKey] = listing;
        })
      );

      setItems(mapInventoryItems(nfts, resolved));
    } catch (e: any) {
      const msg = e?.message || "Failed to refresh";
      setGlobalError(msg);
      showError(msg);
    } finally {
      setLoading(false);
    }
  };

  const handleCreate = async (nft: CreatorInventoryItem["nft"]) => {
    try {
      const priceRaw = priceByNftId[nft.id];
      const currency = currencyByNftId[nft.id] || "XLM";
      const expiresAt = expiresAtByNftId[nft.id];

      const price = priceRaw ? Number(priceRaw) : NaN;
      if (!Number.isFinite(price) || price <= 0) {
        showError(t("creatorMarketplace.errors.invalidPrice") || "Enter a valid price");
        return;
      }
      if (!expiresAt) {
        showError(t("creatorMarketplace.errors.invalidExpiry") || "Select an expiration date");
        return;
      }
      const dto = {
        nftContractId: nft.contractId,
        nftTokenId: nft.tokenId,
        price,
        currency,
        expiresAt: new Date(expiresAt).toISOString(),
      };

      await createListing(dto);
      showSuccess(t("creatorMarketplace.toasts.listingCreated") || "Listing created");

      // Refresh after mutation so List-for-Sale and Sales remain consistent.
      await refetch();
    } catch (e: any) {
      const msg = e?.message || "Failed to create listing";
      showError(msg);
    }
  };

  const handleCancel = async (listingId: string) => {
    try {
      await cancelListing(listingId);
      showSuccess(t("creatorMarketplace.toasts.listingCancelled") || "Listing cancelled");
      await refetch();
    } catch (e: any) {
      const msg = e?.message || "Failed to cancel listing";
      showError(msg);
    }
  };

  if (!isAuthenticated) return null;

  return (
    <div className="max-w-5xl mx-auto py-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-foreground">{t("creator.listForSale.title") || "List NFTs for Sale"}</h1>
          <p className="text-muted-foreground mt-1">
            {t("creator.listForSale.subtitle") || "Create listings from your owned inventory."}
          </p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={() => refetch()}
            disabled={loading}
            className="inline-flex items-center gap-2 px-3 py-2 rounded-lg border border-border bg-card text-sm text-card-foreground hover:bg-muted disabled:opacity-40"
            aria-label="Refresh"
          >
            <RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} />
            {t("common.refresh") || "Refresh"}
          </button>
        </div>
      </div>

      {globalError && (
        <div className="mt-6 p-3 bg-red-900/40 text-red-300 rounded-lg text-sm border border-red-500/20 flex items-start gap-2">
          <AlertTriangle className="h-4 w-4 text-red-400 mt-0.5" />
          <div className="flex-1">{globalError}</div>
        </div>
      )}

      {loading && items.length === 0 ? (
        <div className="mt-8 text-muted-foreground">{t("common.loading") || "Loading..."}</div>
      ) : items.length === 0 ? (
        <div className="mt-8 p-6 rounded-xl border border-border bg-card text-muted-foreground">
          {t("creator.listForSale.empty") || "No NFTs found for your inventory."}
        </div>
      ) : (
        <div className="mt-6 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {items.map((item) => {
            const nft = item.nft;
            const status = item.listing;
            const canList = status.kind === "not_listed" || status.kind === "unknown";
            const isActive = status.kind === "active";
            const displayImage = nft.imageUrl || "/";

            return (
              <div key={nft.id} className="rounded-2xl border border-border bg-card p-4">
                <div className="aspect-square w-full overflow-hidden rounded-xl bg-background">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={displayImage} alt={nft.name || "NFT"} className="h-full w-full object-cover" />
                </div>

                <div className="mt-3">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <div className="font-semibold text-foreground leading-tight line-clamp-2">
                        {nft.name || `NFT ${nft.tokenId}`}
                      </div>
                      <div className="text-xs text-muted-foreground mt-1">
                        {nft.contractId?.slice(0, 8)}…:{nft.tokenId}
                      </div>
                    </div>
                    <ListingStatusPill status={status} />
                  </div>

                  <div className="mt-4">
                    {isActive ? (
                      <div className="flex flex-col gap-2">
                        <button
                          onClick={() => handleCancel(status.listingId)}
                          className="w-full px-3 py-2 rounded-lg bg-destructive/90 text-destructive-foreground hover:bg-destructive disabled:opacity-40 text-sm"
                        >
                          {t("creator.listForSale.actions.cancel") || "Cancel listing"}
                        </button>
                      </div>
                    ) : canList ? (
                      <div className="space-y-2">
                        <input
                          type="number"
                          step="0.00001"
                          min="0"
                          placeholder={t("creator.listForSale.placeholders.price") || "Price"}
                          value={priceByNftId[nft.id] ?? ""}
                          onChange={(e) => setPriceByNftId((prev) => ({ ...prev, [nft.id]: e.target.value }))}
                          className="w-full px-3 py-2 rounded-lg bg-background border border-border text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-nftopia-primary"
                        />

                        <select
                          value={currencyByNftId[nft.id] ?? "XLM"}
                          onChange={(e) => setCurrencyByNftId((prev) => ({ ...prev, [nft.id]: e.target.value }))}
                          className="w-full px-3 py-2 rounded-lg bg-background border border-border text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-nftopia-primary"
                        >
                          <option value="STK">STK</option>
                          <option value="XLM">XLM</option>
                          <option value="USDC">USDC</option>
                        </select>

                        <input
                          type="date"
                          value={(() => {
                            const v = expiresAtByNftId[nft.id];
                            if (!v) return "";
                            try {
                              return new Date(v).toISOString().slice(0, 10);
                            } catch {
                              return "";
                            }
                          })()}
                          onChange={(e) => setExpiresAtByNftId((prev) => ({ ...prev, [nft.id]: e.target.value }))}
                          className="w-full px-3 py-2 rounded-lg bg-background border border-border text-sm text-foreground"
                        />

                        <button
                          onClick={() => handleCreate(nft)}
                          className="w-full flex items-center justify-center gap-2 px-3 py-2 rounded-lg bg-nftopia-primary text-nftopia-text hover:bg-nftopia-hover disabled:opacity-40 text-sm"
                        >
                          <Plus className="h-4 w-4" />
                          {t("creator.listForSale.actions.create") || "Create listing"}
                        </button>
                      </div>
                    ) : (
                      <div className="text-sm text-muted-foreground">{t("creator.listForSale.actions.sold") || "Sold/Completed"}</div>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      <div className="mt-8 text-xs text-muted-foreground">
        {t("creator.listForSale.note") || "After listing changes, the Sales page will refresh to reflect activity."}
      </div>
    </div>
  );
}

