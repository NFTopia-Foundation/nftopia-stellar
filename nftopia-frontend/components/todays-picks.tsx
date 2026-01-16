"use client";

import Image from "next/image";
import { Button } from "@/components/ui/button";
import { Clock, Heart } from "lucide-react";
import { useTranslation } from "@/hooks/useTranslation";

type NFTItem = {
  id: string;
  name: string;
  creator: string;
  price: string;
  likes: number;
  isLive: boolean;
  isFeatured?: boolean;
  bgColor: string;
};

export function TodaysPicks() {
  const { t } = useTranslation();

  const nftItems: NFTItem[] = [
    {
      id: "1",
      name: "The Bone'Yonce Kitty",
      creator: "KittenSoul",
      price: "4.89 STRK",
      likes: 42,
      isLive: true,
      bgColor: "bg-pink-500",
    },
    {
      id: "2",
      name: "Space Babe - Night 2187",
      creator: "CosmicCreator",
      price: "4.89 STRK",
      likes: 36,
      isLive: true,
      isFeatured: true,
      bgColor: "bg-yellow-100",
    },
    {
      id: "3",
      name: "CyberPrimal 002 LAW",
      creator: "CyberArtist",
      price: "4.89 STRK",
      likes: 28,
      isLive: true,
      bgColor: "bg-yellow-300",
    },
    {
      id: "4",
      name: "Crypto Pug Plump #7",
      creator: "DigitalDreamer",
      price: "4.89 STRK",
      likes: 33,
      isLive: true,
      bgColor: "bg-green-400",
    },
    {
      id: "5",
      name: "Sweet Monkey Club #49",
      creator: "ApeSyndicate",
      price: "4.89 STRK",
      likes: 25,
      isLive: true,
      bgColor: "bg-pink-400",
    },
    {
      id: "6",
      name: "Sir Lion Swag #237",
      creator: "RoarCreations",
      price: "4.89 STRK",
      likes: 31,
      isLive: true,
      bgColor: "bg-purple-500",
    },
    {
      id: "7",
      name: "Cyber Doberman #768",
      creator: "PixelPuppers",
      price: "4.89 STRK",
      likes: 29,
      isLive: true,
      bgColor: "bg-orange-400",
    },
    {
      id: "8",
      name: "Living Tree 3D by Luna",
      creator: "NatureDigital",
      price: "4.89 STRK",
      likes: 38,
      isLive: true,
      bgColor: "bg-cyan-400",
    },
  ];

  return (
    <section className="py-16 relative">
      <div className="flex justify-between items-center mb-8">
        <h2 className="text-2xl font-bold">{t("todaysPicks.title")}</h2>
        <div className="flex gap-4">
          <div className="flex gap-2">
            <Button
              variant="outline"
              size="sm"
              className="rounded-full bg-[#1E1A45] border-purple-900/30 hover:bg-purple-900/40 hover:border-purple-500 hover:text-white text-sm transition-colors"
            >
              {t("todaysPicks.category")}
            </Button>
            <Button
              variant="outline"
              size="sm"
              className="rounded-full bg-[#1E1A45] border-purple-900/30 hover:bg-purple-900/40 hover:border-purple-500 hover:text-white text-sm transition-colors"
            >
              {t("todaysPicks.priceRange")}
            </Button>
            <Button
              variant="outline"
              size="sm"
              className="rounded-full bg-[#1E1A45] border-purple-900/30 hover:bg-purple-900/40 hover:border-purple-500 hover:text-white text-sm transition-colors"
            >
              {t("todaysPicks.saleType")}
            </Button>
            <Button
              variant="outline"
              size="sm"
              className="rounded-full bg-[#1E1A45] border-purple-900/30 hover:bg-purple-900/40 hover:border-purple-500 hover:text-white text-sm transition-colors"
            >
              {t("todaysPicks.blockchain")}
            </Button>
          </div>
          <Button
            variant="outline"
            size="sm"
            className="rounded-full bg-[#1E1A45] border-purple-900/30 hover:bg-purple-900/40 hover:border-purple-500 hover:text-white text-sm transition-colors"
          >
            {t("todaysPicks.sortBy")}
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {nftItems.map((item) => (
          <div
            key={item.id}
            className="bg-[#1E1A45] rounded-2xl overflow-hidden border border-purple-900/30 transition-all hover:shadow-lg hover:shadow-purple-500/10 hover:-translate-y-1"
          >
            <div className="relative">
              <div className="absolute top-3 left-3 z-10 bg-black/70 rounded-full px-3 py-1 text-xs font-medium">
                {item.isFeatured ? (
                  <span className="text-yellow-400">
                    {t("todaysPicks.comingSoon")}
                  </span>
                ) : (
                  <span>{t("todaysPicks.onSale")}</span>
                )}
              </div>
              <div className="absolute top-3 right-3 z-10 bg-black/70 rounded-full px-3 py-1 text-xs font-medium">
                <Heart className="h-3 w-3 text-red-400 inline mr-1" />
                <span>{item.likes}</span>
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
                    {item.creator.charAt(0)}
                  </div>
                  <span className="text-sm text-gray-300">{item.creator}</span>
                </div>
                <span className="text-sm font-medium text-purple-400">
                  {item.price}
                </span>
              </div>

              <div className="flex justify-between items-center pt-2 border-t border-purple-900/30">
                <Button
                  size="sm"
                  variant="ghost"
                  className="text-purple-400 hover:bg-transparent hover:text-purple-300 rounded-full px-4 py-1 text-xs"
                >
                  {t("todaysPicks.placeBid")}
                </Button>
                <Button
                  size="sm"
                  variant="ghost"
                  className="text-purple-400 hover:bg-transparent hover:text-purple-300 rounded-full px-4 py-1 text-xs"
                >
                  {t("todaysPicks.viewHistory")}
                </Button>
              </div>
            </div>
          </div>
        ))}
      </div>

      <div className="flex justify-center mt-10">
        <Button
          variant="ghost"
          className="text-purple-400 hover:bg-transparent hover:text-purple-300 rounded-full px-8"
        >
          {t("todaysPicks.loadMore")}
        </Button>
      </div>
    </section>
  );
}
