"use client";

import React, { useEffect, useState } from "react";
import Link from "next/link";
import { useTranslation } from "@/hooks/useTranslation";
import { useAuthStore } from "@/lib/stores/auth-store";
import {
  createListing,
  cancelListing,
  fetchCreatorOwnedNfts,
  fetchListingByNftId,
  normalizeNftMarketplaceItem,
  type MarketplaceItem,
} from "@/lib/services/marketplace-service";

type ActionState = {
  loading: boolean;
  error: string | null;
  price: string;
};

function getItemKey(item: MarketplaceItem) {
  return item.nft.contractId && item.nft.tokenId
    ? `${item.nft.contractId}:${item.nft.tokenId}`
    : item.nft.id;
}

export default function ListNFTsForSale() {
  const { t } = useTranslation();
  const { user } = useAuthStore();
  const [items, setItems] = useState<MarketplaceItem[] | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [actions, setActions] = useState<Record<string, ActionState>>({});
  const [refreshKey, setRefreshKey] = useState(0);

  useEffect(() => {
    if (!user?.sub) {
      setItems([]);
      setLoading(false);
      return;
    }

    let mounted = true;

    async function load() {
      setLoading(true);
      setError(null);

      try {
        const ownedNfts = await fetchCreatorOwnedNfts(user.sub);
        const loadedItems = await Promise.all(
          ownedNfts.map(async (nft) => {
            const listing = await fetchListingByNftId(nft.contractId || nft.id, nft.tokenId || "");
            return normalizeNftMarketplaceItem(nft, listing ?? undefined);
          })
        );

        if (!mounted) {
          return;
        }

        setItems(loadedItems);
        setActions(
          Object.fromEntries(
            loadedItems.map((item) => [
              getItemKey(item),
              { loading: false, error: null, price: "" },
            ])
          )
        );
      } catch (err) {
        if (!mounted) {
          return;
        }
        setError(err instanceof Error ? err.message : "Unable to load owned NFTs.");
      } finally {
        if (mounted) {
          setLoading(false);
        }
      }
    }

    load();
    return () => {
      mounted = false;
    };
  }, [user?.sub, refreshKey]);

  const handlePriceChange = (key: string, value: string) => {
    setActions((prev) => ({
      ...prev,
      [key]: {
        ...prev[key],
        price: value,
        error: null,
      },
    }));
  };

  const handleCreate = async (item: MarketplaceItem) => {
    const key = getItemKey(item);
    const currentAction = actions[key] ?? { loading: false, error: null, price: "" };
    const price = Number(currentAction.price);

    if (!item.nft.contractId || !item.nft.tokenId) {
      setActions((prev) => ({
        ...prev,
        [key]: {
          ...currentAction,
          error: "Unable to determine NFT contract or token ID.",
        },
      }));
      return;
    }

    if (!price || isNaN(price) || price <= 0) {
      setActions((prev) => ({
        ...prev,
        [key]: {
          ...currentAction,
          error: "Enter a valid price.",
        },
      }));
      return;
    }

    setActions((prev) => ({
      ...prev,
      [key]: {
        ...currentAction,
        loading: true,
        error: null,
      },
    }));

    try {
      const listing = await createListing({
        nftContractId: item.nft.contractId,
        nftTokenId: item.nft.tokenId,
        price,
        currency: "XLM",
        expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
      });

      setItems((current) =>
        current?.map((entry) =>
          getItemKey(entry) === key ? normalizeNftMarketplaceItem(entry.nft, listing) : entry
        ) ?? null
      );
    } catch (err) {
      setActions((prev) => ({
        ...prev,
        [key]: {
          ...currentAction,
          loading: false,
          error: err instanceof Error ? err.message : "Failed to create listing.",
        },
      }));
      return;
    }

    setActions((prev) => ({
      ...prev,
      [key]: {
        ...prev[key],
        loading: false,
        error: null,
      },
    }));
  };

  const handleCancel = async (item: MarketplaceItem) => {
    const key = getItemKey(item);
    if (!item.listing?.id) {
      return;
    }

    setActions((prev) => ({
      ...prev,
      [key]: {
        ...prev[key],
        loading: true,
        error: null,
      },
    }));

    try {
      await cancelListing(item.listing.id);

      setItems((current) =>
        current?.map((entry) =>
          getItemKey(entry) === key
            ? {
                ...entry,
                listing: {
                  ...entry.listing,
                  status: "cancelled",
                },
                status: "cancelled",
              }
            : entry
        ) ?? null
      );
    } catch (err) {
      setActions((prev) => ({
        ...prev,
        [key]: {
          ...prev[key],
          loading: false,
          error: err instanceof Error ? err.message : "Failed to cancel listing.",
        },
      }));
      return;
    }

    setActions((prev) => ({
      ...prev,
      [key]: {
        ...prev[key],
        loading: false,
      },
    }));
  };

  const renderStatus = (item: MarketplaceItem) => {
    switch (item.status) {
      case "active_listing":
        return <span className="px-2 py-1 rounded-full bg-green-100 text-green-700 text-xs">Active listing</span>;
      case "cancelled":
        return <span className="px-2 py-1 rounded-full bg-yellow-100 text-yellow-800 text-xs">Listing cancelled</span>;
      case "sold":
        return <span className="px-2 py-1 rounded-full bg-slate-100 text-slate-800 text-xs">Sold / completed</span>;
      default:
        return <span className="px-2 py-1 rounded-full bg-slate-800 text-white text-xs">Not listed</span>;
    }
  };

  return (
    <div className="p-6 lg:p-8 min-h-screen bg-background">
      <div className="mb-8">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <h1 className="text-3xl font-bold text-foreground">{t("creatorDashboard.listForSaleTitle") || "List NFTs for Sale"}</h1>
            <p className="text-muted-foreground mt-2 max-w-2xl">
              {t("creatorDashboard.listForSaleDescription") || "List your creator-owned NFTs for sale and update listing state quickly."}
            </p>
          </div>

          <div className="flex flex-wrap gap-3">
            <Link
              href="sales"
              className="inline-flex items-center px-4 py-2 rounded-lg bg-primary text-primary-foreground hover:bg-primary/90 transition"
            >
              {t("creatorDashboard.viewSales") || "View Sales"}
            </Link>
          </div>
        </div>
      </div>

      {loading ? (
        <div className="rounded-2xl border border-border bg-card p-8 text-center text-foreground">Loading owned NFTs...</div>
      ) : error ? (
        <div className="rounded-2xl border border-red-200 bg-red-50 p-6 text-red-800">
          <p className="font-semibold">{t("creatorDashboard.errorLoading") || "Unable to load creator inventory."}</p>
          <p>{error}</p>
          <button
            onClick={() => setRefreshKey((current) => current + 1)}
            className="mt-4 inline-flex items-center rounded-lg bg-red-600 px-4 py-2 text-white hover:bg-red-700 transition"
          >
            {t("creatorDashboard.retry") || "Retry"}
          </button>
        </div>
      ) : items?.length === 0 ? (
        <div className="rounded-2xl border border-border bg-card p-8 text-center text-foreground">
          <p className="text-lg font-semibold">{t("creatorDashboard.noOwnedNfts") || "No owned NFTs found."}</p>
          <p className="text-muted-foreground mt-2">
            {t("creatorDashboard.noOwnedNftsDescription") || "Mint or acquire NFTs before listing them for sale."}
          </p>
          <div className="mt-6 flex justify-center gap-3">
            <Link
              href="../mint-nft"
              className="inline-flex items-center px-4 py-2 rounded-lg bg-primary text-primary-foreground hover:bg-primary/90 transition"
            >
              {t("creatorDashboard.mintANewNft") || "Mint a new NFT"}
            </Link>
          </div>
        </div>
      ) : (
        <div className="grid gap-6 sm:grid-cols-2 xl:grid-cols-3">
          {items.map((item) => {
            const key = getItemKey(item);
            const actionState = actions[key] ?? { loading: false, error: null, price: "" };

            return (
              <div key={key} className="overflow-hidden rounded-3xl border border-border bg-card p-5 shadow-sm">
                <div className="mb-4 flex items-start justify-between gap-3">
                  <div>
                    <h2 className="text-lg font-semibold text-foreground">{item.nft.name || "Untitled NFT"}</h2>
                    <p className="text-sm text-muted-foreground mt-1">{item.nft.description || "A creator-owned NFT ready for listing."}</p>
                  </div>
                  {renderStatus(item)}
                </div>

                <div className="mb-4 h-48 overflow-hidden rounded-2xl bg-slate-950 text-white">
                  {item.nft.imageUrl ? (
                    <img
                      src={item.nft.imageUrl}
                      alt={item.nft.name || "NFT image"}
                      className="h-full w-full object-cover"
                    />
                  ) : (
                    <div className="flex h-full items-center justify-center bg-slate-900 text-sm text-slate-400">
                      Image not available
                    </div>
                  )}
                </div>

                <div className="space-y-4">
                  {item.status === "active_listing" ? (
                    <>
                      <div className="rounded-2xl bg-slate-950 p-4 text-sm text-foreground">
                        <div className="font-semibold">{t("creatorDashboard.currentListing") || "Current listing"}</div>
                        <div>{item.listing?.price} {item.listing?.currency || "XLM"}</div>
                        <div className="text-muted-foreground text-sm">{item.listing?.status}</div>
                      </div>
                      <button
                        type="button"
                        className="w-full rounded-xl bg-red-600 px-4 py-3 text-sm font-semibold text-white hover:bg-red-700 transition"
                        disabled={actionState.loading}
                        onClick={() => handleCancel(item)}
                      >
                        {actionState.loading ? "Cancelling..." : t("creatorDashboard.cancelListing") || "Cancel listing"}
                      </button>
                    </>
                  ) : item.status === "sold" || item.status === "cancelled" ? (
                    <div className="rounded-2xl bg-slate-950 p-4 text-sm text-foreground">
                      <div className="font-semibold">{t("creatorDashboard.listingComplete") || "Listing complete"}</div>
                      <div className="text-muted-foreground">{item.status === "sold" ? "Sold or completed." : "Cancelled listing."}</div>
                    </div>
                  ) : (
                    <>
                      <label className="text-sm font-semibold text-foreground">{t("creatorDashboard.listingPrice") || "Listing price"}</label>
                      <input
                        value={actionState.price}
                        onChange={(event) => handlePriceChange(key, event.target.value)}
                        placeholder={t("creatorDashboard.pricePlaceholder") || "Enter XLM price"}
                        className="w-full rounded-2xl border border-border bg-background px-4 py-3 text-foreground outline-none focus:border-primary"
                      />
                      {actionState.error ? (
                        <div className="text-sm text-red-500">{actionState.error}</div>
                      ) : null}
                      <button
                        type="button"
                        className="w-full rounded-xl bg-primary px-4 py-3 text-sm font-semibold text-primary-foreground hover:bg-primary/90 transition"
                        disabled={actionState.loading}
                        onClick={() => handleCreate(item)}
                      >
                        {actionState.loading ? "Listing..." : t("creatorDashboard.listForSaleButton") || "List for sale"}
                      </button>
                    </>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
