"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
import Link from "next/link";
import { useTranslation } from "@/hooks/useTranslation";
import { useWalletStore } from "@/stores/walletStore";
import { CircuitBackground } from "@/components/circuit-background";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { API_CONFIG } from "@/lib/config";
import { cn } from "@/lib/utils";
import {
  ArrowLeft, Clock, Gavel, User, Award, Wallet, Check, Share2, Heart,
  TrendingUp, Loader2, Info, Tag,
} from "lucide-react";

interface AuctionNFTAttribute { traitType: string; value: string; displayType?: string; }
interface AuctionNFTCollection { id: string; name: string; symbol: string; image: string; }
interface AuctionNFT {
  id: string; name: string; image?: string; tokenId: string; description?: string;
  attributes?: AuctionNFTAttribute[]; collection?: AuctionNFTCollection;
  creator?: AuctionUser; owner?: AuctionUser;
}
interface AuctionUser { id: string; username?: string; walletAddress?: string; }
interface BidWithUser {
  id: string; amount: string; bidderId: string;
  bidder?: AuctionUser; createdAt: string;
}
interface AuctionDetail {
  id: string; nftId: string; sellerId: string; startPrice: string; currentPrice: string;
  reservePrice?: string; startTime: string; endTime: string; status: string;
  winnerId?: string; nft?: AuctionNFT; bids?: BidWithUser[]; highestBid?: BidWithUser;
  seller?: AuctionUser; winner?: AuctionUser;
}

function getTimeLeft(endTime: string) {
  const diff = new Date(endTime).getTime() - Date.now();
  if (diff <= 0) return { total: 0, d: 0, h: 0, m: 0, s: 0, ended: true };
  const total = Math.floor(diff / 1000);
  return { total, d: Math.floor(total / 86400), h: Math.floor((total % 86400) / 3600), m: Math.floor((total % 3600) / 60), s: total % 60, ended: false };
}

function formatAddress(addr?: string) {
  if (!addr) return "Unknown";
  return `${addr.slice(0, 6)}...${addr.slice(-4)}`;
}

function formatDate(dateStr: string) {
  return new Date(dateStr).toLocaleDateString("en-US", {
    year: "numeric", month: "short", day: "numeric", hour: "2-digit", minute: "2-digit",
  });
}

function AuctionDetailSkeleton() {
  return (
    <div className="max-w-7xl mx-auto px-4 py-8">
      <Skeleton className="h-5 w-32 mb-8" />
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        <Skeleton className="aspect-square w-full rounded-2xl" />
        <div className="space-y-6">
          <Skeleton className="h-9 w-3/4" />
          <div className="flex gap-4">
            <Skeleton className="h-24 flex-1 rounded-xl" />
            <Skeleton className="h-24 flex-1 rounded-xl" />
            <Skeleton className="h-24 flex-1 rounded-xl" />
          </div>
          <Skeleton className="h-32 w-full rounded-xl" />
          <Skeleton className="h-14 w-full rounded-xl" />
        </div>
      </div>
    </div>
  );
}

function CountdownTimer({ endTime, t }: { endTime: string; t: (key: string) => string }) {
  const [timeLeft, setTimeLeft] = useState(() => getTimeLeft(endTime));
  useEffect(() => {
    if (timeLeft.ended) return;
    const timer = setInterval(() => setTimeLeft(getTimeLeft(endTime)), 1000);
    return () => clearInterval(timer);
  }, [endTime, timeLeft.ended]);

  if (timeLeft.ended) {
    return (
      <div className="flex items-center gap-2 text-gray-400">
        <Clock className="h-5 w-5" />
        <span className="font-semibold">{t("auctionDetail.ended")}</span>
      </div>
    );
  }

  const isEndingSoon = timeLeft.total < 3600;
  return (
    <div className="flex items-center gap-3">
      <Clock className={cn("h-5 w-5", isEndingSoon ? "text-red-400 animate-pulse" : "text-purple-400")} />
      <div className="flex items-center gap-3">
        {timeLeft.d > 0 && <TimeUnit value={timeLeft.d} label={t("auctionDetail.countdown.days")} highlight={isEndingSoon} />}
        <TimeUnit value={timeLeft.h} label={t("auctionDetail.countdown.hours")} highlight={isEndingSoon} />
        <span className="text-lg font-light text-gray-600">:</span>
        <TimeUnit value={timeLeft.m} label={t("auctionDetail.countdown.minutes")} highlight={isEndingSoon} />
        <span className="text-lg font-light text-gray-600">:</span>
        <TimeUnit value={timeLeft.s} label={t("auctionDetail.countdown.seconds")} highlight={isEndingSoon} />
      </div>
    </div>
  );
}

function TimeUnit({ value, label, highlight }: { value: number; label: string; highlight: boolean }) {
  return (
    <div className="flex flex-col items-center">
      <span className={cn("text-2xl font-bold tabular-nums min-w-[2ch] text-center", highlight ? "text-red-400" : "text-white")}>
        {String(value).padStart(2, "0")}
      </span>
      <span className="text-[10px] uppercase tracking-wider text-gray-500">{label}</span>
    </div>
  );
}

export default function AuctionDetailClient({
  initialAuction,
  locale,
}: {
  initialAuction: AuctionDetail;
  locale: string;
}) {
  const { t } = useTranslation();
  const { connected } = useWalletStore();
  const [auction, setAuction] = useState<AuctionDetail>(initialAuction);
  const [bidAmount, setBidAmount] = useState("");
  const [placingBid, setPlacingBid] = useState(false);
  const [bidError, setBidError] = useState<string | null>(null);
  const [bidSuccess, setBidSuccess] = useState(false);
  const [copied, setCopied] = useState(false);
  const [isWatched, setIsWatched] = useState(false);

  const fetchAuction = useCallback(async () => {
    try {
      const res = await fetch(`${API_CONFIG.baseUrl}/auctions/${initialAuction.id}`);
      if (res.ok) {
        const data: AuctionDetail = await res.json();
        setAuction(data);
      }
    } catch {}
  }, [initialAuction.id]);

  useEffect(() => {
    if (auction.status !== "ACTIVE") return;
    const interval = setInterval(fetchAuction, 15000);
    return () => clearInterval(interval);
  }, [auction.status, fetchAuction]);

  const handlePlaceBid = useCallback(async () => {
    if (!auction || !bidAmount) return;
    setPlacingBid(true);
    setBidError(null);
    setBidSuccess(false);
    try {
      const minBid = parseFloat(auction.highestBid?.amount || auction.startPrice) + 0.01;
      const bidNum = parseFloat(bidAmount);
      if (Number.isNaN(bidNum) || bidNum < minBid) throw new Error(`Minimum bid is ${minBid} XLM`);

      const res = await fetch(`${API_CONFIG.baseUrl}/auctions/${auction.id}/bids`, {
        method: "POST", headers: { "Content-Type": "application/json" }, credentials: "include",
        body: JSON.stringify({ amount: bidAmount }),
      });
      if (!res.ok) {
        const errData = await res.json().catch(() => ({}));
        throw new Error(errData.message || "Failed to place bid");
      }
      setBidSuccess(true);
      setBidAmount("");
      setTimeout(fetchAuction, 1000);
    } catch (err) {
      setBidError(err instanceof Error ? err.message : "Failed to place bid");
    } finally {
      setPlacingBid(false);
    }
  }, [auction, bidAmount, fetchAuction]);

  const handleCopyLink = useCallback(async () => {
    try {
      await navigator.clipboard.writeText(window.location.href);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {}
  }, []);

  const timeLeft = useMemo(() => getTimeLeft(auction.endTime), [auction]);
  const isEnded = timeLeft.ended;
  const minBid = parseFloat(auction.highestBid?.amount || auction.startPrice) + 0.01;
  const nft = auction.nft;
  const sortedBids = auction.bids ? [...auction.bids].sort((a, b) => parseFloat(b.amount) - parseFloat(a.amount)) : [];

  return (
    <main className="min-h-screen relative text-white overflow-hidden">
      <CircuitBackground />
      <div className="relative z-10 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <Link
          href="/marketplace/auctions"
          className="inline-flex items-center gap-2 text-gray-400 hover:text-white transition-colors mb-6 group"
        >
          <ArrowLeft className="h-4 w-4 group-hover:-translate-x-1 transition-transform" />
          <span>{t("auctionDetail.backToAuctions")}</span>
        </Link>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          <div className="space-y-4">
            <div className="relative aspect-square w-full rounded-2xl overflow-hidden bg-gray-900/50 border border-gray-800/50">
              {nft?.image ? (
                <img src={nft.image} alt={nft.name} className="w-full h-full object-cover"
                  onError={(e) => { (e.target as HTMLImageElement).style.display = "none"; }} />
              ) : null}
              <div className="w-full h-full flex items-center justify-center text-gray-600 absolute inset-0 -z-10">
                <span className="text-8xl">🖼️</span>
              </div>
            </div>
            {nft?.collection && (
              <div className="flex items-center gap-3 p-3 rounded-xl bg-gray-900/30 border border-gray-800/50">
                {nft.collection.image ? (
                  <img src={nft.collection.image} alt={nft.collection.name} className="w-10 h-10 rounded-full object-cover" />
                ) : (
                  <div className="w-10 h-10 rounded-full bg-purple-500/20 flex items-center justify-center">
                    <span className="text-sm font-bold text-purple-400">{nft.collection.symbol?.slice(0, 3) || "C"}</span>
                  </div>
                )}
                <div>
                  <p className="text-sm font-medium text-white">{nft.collection.name}</p>
                  <p className="text-xs text-gray-400">{nft.collection.symbol}</p>
                </div>
              </div>
            )}
          </div>

          <div className="space-y-6">
            <div>
              <div className="flex items-start justify-between gap-4">
                <h1 className="text-3xl font-bold text-white">{nft?.name || "Untitled NFT"}</h1>
                <div className="flex items-center gap-2 flex-shrink-0">
                  <button onClick={() => setIsWatched(!isWatched)}
                    className={cn("p-2.5 rounded-xl border transition-all", isWatched
                      ? "bg-red-500/10 border-red-500/30 text-red-400"
                      : "bg-gray-900/30 border-gray-800/50 text-gray-400 hover:text-white hover:border-gray-700")}
                    title={isWatched ? t("auctionDetail.removeFromWatchlist") : t("auctionDetail.addToWatchlist")}>
                    <Heart className={cn("h-5 w-5", isWatched && "fill-current")} />
                  </button>
                  <button onClick={handleCopyLink}
                    className="p-2.5 rounded-xl border border-gray-800/50 bg-gray-900/30 text-gray-400 hover:text-white hover:border-gray-700 transition-all"
                    title={t("auctionDetail.share")}>
                    {copied ? <Check className="h-5 w-5 text-emerald-400" /> : <Share2 className="h-5 w-5" />}
                  </button>
                </div>
              </div>
              {auction.status !== "ACTIVE" && (
                <span className={cn("inline-block mt-2 text-xs font-semibold uppercase tracking-wider px-3 py-1 rounded-full",
                  auction.status === "COMPLETED" || auction.status === "SETTLED"
                    ? "bg-emerald-500/10 text-emerald-400 border border-emerald-500/30"
                    : auction.status === "CANCELLED" ? "bg-red-500/10 text-red-400 border border-red-500/30"
                    : "bg-gray-700/50 text-gray-400")}>{auction.status}</span>
              )}
            </div>

            {nft?.description && <p className="text-gray-300 leading-relaxed">{nft.description}</p>}

            <div className="grid grid-cols-3 gap-3">
              <div className="p-4 rounded-xl bg-[#1E1A45] border border-purple-900/30">
                <div className="flex items-center gap-1.5 text-xs text-gray-400 mb-1">
                  <Gavel className="h-3.5 w-3.5 text-purple-400" />
                  <span>{t("auctionDetail.currentBid")}</span>
                </div>
                <p className="text-lg font-bold text-white">{auction.highestBid?.amount || auction.startPrice} <span className="text-xs font-normal text-gray-400">XLM</span></p>
              </div>
              <div className="p-4 rounded-xl bg-[#1E1A45] border border-purple-900/30">
                <div className="flex items-center gap-1.5 text-xs text-gray-400 mb-1">
                  <Tag className="h-3.5 w-3.5 text-purple-400" />
                  <span>{t("auctionDetail.startingPrice")}</span>
                </div>
                <p className="text-lg font-bold text-white">{auction.startPrice} <span className="text-xs font-normal text-gray-400">XLM</span></p>
              </div>
              <div className="p-4 rounded-xl bg-[#1E1A45] border border-purple-900/30">
                <div className="flex items-center gap-1.5 text-xs text-gray-400 mb-1">
                  <Clock className="h-3.5 w-3.5 text-purple-400" />
                  <span>{t("auctionDetail.timeLeft")}</span>
                </div>
                <CountdownTimer endTime={auction.endTime} t={t} />
              </div>
            </div>

            {auction.reservePrice && (
              <div className={cn("flex items-center gap-2 text-sm p-3 rounded-xl border",
                parseFloat(auction.currentPrice) >= parseFloat(auction.reservePrice)
                  ? "bg-emerald-500/5 border-emerald-500/20 text-emerald-400"
                  : "bg-yellow-500/5 border-yellow-500/20 text-yellow-400")}>
                <Info className="h-4 w-4" />
                <span>{parseFloat(auction.currentPrice) >= parseFloat(auction.reservePrice)
                  ? t("auctionDetail.reserveMet") : t("auctionDetail.reserveNotMet")} ({auction.reservePrice} XLM)</span>
              </div>
            )}

            {isEnded && auction.winner && (
              <div className="p-4 rounded-xl bg-emerald-500/5 border border-emerald-500/20">
                <div className="flex items-center gap-2 text-sm text-emerald-400 mb-1">
                  <Award className="h-4 w-4" />
                  <span>{t("auctionDetail.winner")}</span>
                </div>
                <p className="text-white font-medium">{auction.winner.username || formatAddress(auction.winner.walletAddress)}</p>
                {auction.highestBid && <p className="text-sm text-emerald-400 mt-1">{t("auctionDetail.winningBid")}: {auction.highestBid.amount} XLM</p>}
              </div>
            )}

            <div className="p-5 rounded-xl bg-[#1E1A45] border border-purple-900/30 space-y-4">
              {connected ? (
                isEnded ? (
                  <div className="text-center py-3"><p className="text-gray-400 font-medium">{t("auctionDetail.auctionEnded")}</p></div>
                ) : (
                  <>
                    <div>
                      <label className="block text-xs font-medium text-gray-400 mb-2 uppercase tracking-wider">{t("auctionDetail.bidAmount")}</label>
                      <div className="relative">
                        <input type="number" value={bidAmount} onChange={(e) => setBidAmount(e.target.value)}
                          placeholder={t("auctionDetail.enterAmount")} min={minBid} step="0.01"
                          className="w-full bg-gray-900/50 border border-gray-700/50 rounded-xl px-4 py-3 pr-16 text-white placeholder:text-gray-500 focus:outline-none focus:border-purple-500/60 focus:ring-1 focus:ring-purple-500/40"
                          disabled={placingBid} />
                        <span className="absolute right-4 top-1/2 -translate-y-1/2 text-sm text-gray-400">XLM</span>
                      </div>
                      <p className="text-xs text-gray-500 mt-1.5">{t("auctionDetail.minBid")}: {minBid.toFixed(2)} XLM</p>
                    </div>
                    {bidError && <div className="p-3 rounded-lg bg-red-500/10 border border-red-500/20 text-red-400 text-sm">{bidError}</div>}
                    {bidSuccess && <div className="p-3 rounded-lg bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-sm">{t("auctionDetail.bidSuccess")}</div>}
                    <Button onClick={handlePlaceBid} disabled={!bidAmount || placingBid}
                      className="w-full bg-purple-600 hover:bg-purple-700 text-white py-3 rounded-xl font-semibold transition-all disabled:opacity-50">
                      {placingBid ? <><Loader2 className="h-4 w-4 animate-spin mr-2" />{t("auctionDetail.bidding")}</>
                        : <><Gavel className="h-4 w-4 mr-2" />{t("auctionDetail.placeBid")}</>}
                    </Button>
                  </>
                )
              ) : (
                <Button disabled className="w-full bg-gray-700 text-gray-400 py-3 rounded-xl font-semibold cursor-not-allowed">
                  <Wallet className="h-4 w-4 mr-2" />{t("auctionDetail.connectToBid")}
                </Button>
              )}
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="p-4 rounded-xl bg-[#1E1A45] border border-purple-900/30">
                <div className="flex items-center gap-2 text-xs text-gray-400 mb-2">
                  <Award className="h-4 w-4 text-emerald-400" />
                  <span>{t("auctionDetail.creator")}</span>
                </div>
                <p className="text-sm font-medium text-white">{nft?.creator?.username || formatAddress(nft?.creator?.walletAddress)}</p>
              </div>
              <div className="p-4 rounded-xl bg-[#1E1A45] border border-purple-900/30">
                <div className="flex items-center gap-2 text-xs text-gray-400 mb-2">
                  <User className="h-4 w-4 text-blue-400" />
                  <span>{t("auctionDetail.seller")}</span>
                </div>
                <p className="text-sm font-medium text-white">{auction.seller?.username || formatAddress(auction.seller?.walletAddress)}</p>
              </div>
            </div>

            {nft && nft.tokenId && (
              <div className="flex items-center justify-between text-sm p-3 rounded-lg bg-gray-900/20 border border-gray-800/30">
                <span className="text-gray-400">{t("auctionDetail.tokenId")}</span>
                <span className="font-mono text-white text-xs">{nft.tokenId}</span>
              </div>
            )}
          </div>
        </div>

        {nft?.attributes && nft.attributes.length > 0 && (
          <div className="mt-12">
            <h3 className="text-lg font-semibold text-white mb-4">{t("auctionDetail.attributes")}</h3>
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-3">
              {nft.attributes.map((attr, idx) => (
                <div key={idx} className="p-3 rounded-xl bg-[#1E1A45] border border-purple-900/30 text-center">
                  <p className="text-[10px] uppercase tracking-wider text-gray-500 mb-1">{attr.traitType}</p>
                  <p className="text-sm font-medium text-white truncate">{attr.value}</p>
                  {attr.displayType && <p className="text-[10px] text-gray-500 mt-0.5">{attr.displayType}</p>}
                </div>
              ))}
            </div>
          </div>
        )}

        <div className="mt-12">
          <h3 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
            <TrendingUp className="h-5 w-5 text-purple-400" />
            {t("auctionDetail.bidHistory")}
            {sortedBids.length > 0 && <span className="text-sm font-normal text-gray-400">({sortedBids.length} {sortedBids.length === 1 ? "bid" : "bids"})</span>}
          </h3>
          {sortedBids.length === 0 ? (
            <div className="p-8 rounded-2xl bg-[#1E1A45] border border-purple-900/30 text-center">
              <Gavel className="h-10 w-10 text-gray-600 mx-auto mb-3" />
              <p className="text-gray-400">{t("auctionDetail.noBids")}</p>
            </div>
          ) : (
            <div className="rounded-2xl bg-[#1E1A45] border border-purple-900/30 overflow-hidden">
              <div className="grid grid-cols-3 gap-4 px-5 py-3 text-xs font-medium text-gray-400 uppercase tracking-wider border-b border-purple-900/30 bg-[#1a1635]">
                <span>Bidder</span>
                <span className="text-center">Amount</span>
                <span className="text-right">Time</span>
              </div>
              <div className="divide-y divide-purple-900/20 max-h-[400px] overflow-y-auto">
                {sortedBids.map((bid, idx) => (
                  <div key={bid.id} className={cn("grid grid-cols-3 gap-4 px-5 py-3 items-center transition-colors hover:bg-purple-900/10", idx === 0 && "bg-purple-500/5")}>
                    <div className="flex items-center gap-2 min-w-0">
                      <div className="w-7 h-7 rounded-full bg-purple-500/20 flex items-center justify-center flex-shrink-0">
                        <User className="h-3.5 w-3.5 text-purple-400" />
                      </div>
                      <span className="text-sm text-white truncate">{bid.bidder?.username || formatAddress(bid.bidder?.walletAddress)}</span>
                      {idx === 0 && <span className="text-[10px] font-semibold text-purple-400 bg-purple-500/10 px-1.5 py-0.5 rounded flex-shrink-0">HIGHEST</span>}
                    </div>
                    <div className="text-center">
                      <span className="text-sm font-semibold text-white">{bid.amount}</span>
                      <span className="text-xs text-gray-400 ml-1">XLM</span>
                    </div>
                    <div className="text-right text-xs text-gray-400">{formatDate(bid.createdAt)}</div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </main>
  );
}
