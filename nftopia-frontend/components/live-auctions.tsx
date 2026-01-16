"use client";

import { useState, useEffect } from "react";
import Image from "next/image";
import { Button } from "@/components/ui/button";
import { Clock, ChevronRight, ChevronLeft } from "lucide-react";
import { useTranslation } from "@/hooks/useTranslation";

type AuctionItem = {
  id: string;
  name: string;
  creator: string;
  price: string;
  timeLeft: string;
  bidCount: number;
  isLive: boolean;
  bgColor: string;
};

export function LiveAuctions() {
  const { t } = useTranslation();

  const auctionItems: AuctionItem[] = [
    {
      id: "1",
      name: "Yonder Contemplation",
      creator: "KittenSoul",
      price: "4.89 STRK",
      timeLeft: "04:12:41",
      bidCount: 12,
      isLive: true,
      bgColor: "bg-blue-500/20",
    },
    {
      id: "2",
      name: "Tranquillizer Awakening",
      creator: "Nova Nexus",
      price: "4.89 STRK",
      timeLeft: "02:34:56",
      bidCount: 8,
      isLive: true,
      bgColor: "bg-green-500/20",
    },
    {
      id: "3",
      name: "Loving Vessel By Lumina",
      creator: "Cosmic Conjurer",
      price: "4.89 STRK",
      timeLeft: "01:23:45",
      bidCount: 15,
      isLive: true,
      bgColor: "bg-orange-500/20",
    },
    {
      id: "4",
      name: "Tame Beast By Solomon",
      creator: "Zen Voyager",
      price: "4.89 STRK",
      timeLeft: "00:59:59",
      bidCount: 7,
      isLive: true,
      bgColor: "bg-yellow-500/20",
    },
    {
      id: "5",
      name: "Cosmic Dreamer",
      creator: "Astral Artist",
      price: "5.12 STRK",
      timeLeft: "03:45:22",
      bidCount: 9,
      isLive: true,
      bgColor: "bg-purple-500/20",
    },
    {
      id: "6",
      name: "Digital Horizon",
      creator: "Pixel Prophet",
      price: "3.75 STRK",
      timeLeft: "05:30:15",
      bidCount: 11,
      isLive: true,
      bgColor: "bg-pink-500/20",
    },
    {
      id: "7",
      name: "Ethereal Whisper",
      creator: "Mystic Maker",
      price: "6.20 STRK",
      timeLeft: "01:15:33",
      bidCount: 14,
      isLive: true,
      bgColor: "bg-indigo-500/20",
    },
    {
      id: "8",
      name: "Neon Nostalgia",
      creator: "Retro Renderer",
      price: "4.50 STRK",
      timeLeft: "02:20:10",
      bidCount: 6,
      isLive: true,
      bgColor: "bg-cyan-500/20",
    },
  ];

  const itemsPerPage = 4;
  const totalPages = Math.ceil(auctionItems.length / itemsPerPage);
  const [currentPage, setCurrentPage] = useState(0);

  // Auto-rotate carousel
  useEffect(() => {
    const interval = setInterval(() => {
      setCurrentPage((prev) => (prev + 1) % totalPages);
    }, 5000);

    return () => clearInterval(interval);
  }, [totalPages]);

  const nextPage = () => {
    setCurrentPage((prev) => (prev + 1) % totalPages);
  };

  const prevPage = () => {
    setCurrentPage((prev) => (prev - 1 + totalPages) % totalPages);
  };

  // Get current items to display
  const currentItems = auctionItems.slice(
    currentPage * itemsPerPage,
    (currentPage + 1) * itemsPerPage
  );

  return (
    <section className="py-16 relative">
      <div className="flex justify-between items-center mb-8">
        <h2 className="text-2xl font-bold">{t("liveAuctions.title")}</h2>
        <Button
          variant="link"
          className="text-[#9398a8] hover:text-purple-300 flex items-center gap-1 text-xs"
        >
          {t("liveAuctions.exploreMore")}
          <ChevronRight className="h-3.5 w-3.5" />
        </Button>
      </div>

      {/* Carousel Navigation Buttons */}
      <button
        onClick={prevPage}
        className="absolute left-0 top-1/2 transform -translate-y-1/2 z-10 bg-black/50 hover:bg-black/70 text-white p-2 rounded-full -ml-4 lg:ml-0"
        aria-label={t("liveAuctions.previousPage")}
      >
        <ChevronLeft className="h-5 w-5" />
      </button>

      <button
        onClick={nextPage}
        className="absolute right-0 top-1/2 transform -translate-y-1/2 z-10 bg-black/50 hover:bg-black/70 text-white p-2 rounded-full -mr-4 lg:mr-0"
        aria-label={t("liveAuctions.nextPage")}
      >
        <ChevronRight className="h-5 w-5" />
      </button>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {currentItems.map((item) => (
          <div
            key={item.id}
            className="bg-[#1E1A45] rounded-2xl overflow-hidden border border-purple-900/30 transition-all hover:shadow-lg hover:shadow-purple-500/10 hover:-translate-y-1"
          >
            <div className="relative">
              <div className="absolute top-3 right-3 z-10 bg-black/70 rounded-full px-3 py-1 text-xs font-medium flex items-center gap-1">
                <Clock className="h-3 w-3 text-red-400" />
                <span>{item.timeLeft}</span>
              </div>
              <div
                className={`h-[240px] relative overflow-hidden ${item.bgColor}`}
              >
                <div className="absolute inset-0 flex items-center justify-center">
                  <Image
                    src="/nftopia-03.svg"
                    alt={item.name}
                    width={120}
                    height={120}
                    className="opacity-80"
                  />
                </div>
              </div>
            </div>

            <div className="p-4 space-y-3">
              <h3 className="font-semibold text-lg">{item.name}</h3>

              <div className="flex justify-between items-center">
                <div className="flex items-center gap-2">
                  <div className="h-6 w-6 rounded-full bg-purple-500 overflow-hidden relative flex items-center justify-center text-xs font-bold">
                    N
                  </div>
                  <span className="text-sm text-gray-300">{item.creator}</span>
                </div>
                <span className="text-sm font-medium text-purple-400">
                  {item.price}
                </span>
              </div>

              <div className="flex justify-between items-center pt-2 border-t border-purple-900/30">
                <div className="flex items-center gap-1">
                  <span className="text-xs text-gray-400">
                    {t("liveAuctions.currentBid")}
                  </span>
                  <span className="text-xs font-medium">{item.bidCount}</span>
                </div>
                <Button
                  size="sm"
                  className="bg-purple-600 hover:bg-purple-700 text-white rounded-full px-4 py-1 text-xs"
                >
                  {t("liveAuctions.bid")}
                </Button>
              </div>
            </div>
          </div>
        ))}
      </div>

      <div className="flex justify-center mt-8 gap-2">
        {Array.from({ length: totalPages }).map((_, i) => (
          <button
            key={i}
            onClick={() => setCurrentPage(i)}
            className={`h-2 rounded-full transition-all ${
              currentPage === i ? "w-6 bg-purple-500" : "w-2 bg-gray-600"
            }`}
            aria-label={t("liveAuctions.goToPage", { page: i + 1 })}
          />
        ))}
      </div>
    </section>
  );
}
