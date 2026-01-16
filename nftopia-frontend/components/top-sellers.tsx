"use client";

import { useRef, useEffect, useState } from "react";
import Image from "next/image";
import { cn } from "@/lib/utils";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { usePathname } from "next/navigation";
import { useTranslation } from "@/hooks/useTranslation";

interface Seller {
  id: string;
  name: string;
  amount: string;
  avatar: string;
  highlight?: boolean;
  bgColor?: string;
}

export function TopSellers() {
  const { t } = useTranslation();
  const pathname = usePathname();
  const isMarketplacePage = pathname === "/marketplace";
  const [showNavButtons, setShowNavButtons] = useState(false);

  const sellers: Seller[] = [
    {
      id: "1",
      name: isMarketplacePage ? "Crispyn Berry" : "Leighton Kramer",
      amount: isMarketplacePage ? "24.5 STRK" : "276.4 STK",
      avatar: "/avatars/avatar-1.jpg",
      highlight: true,
      bgColor: "bg-yellow-400",
    },
    {
      id: "2",
      name: isMarketplacePage ? "Samuel Rust" : "Haylie Arcand",
      amount: isMarketplacePage ? "20.8 STRK" : "146.8 STK",
      avatar: "/avatars/avatar-2.jpg",
      bgColor: "bg-teal-400",
    },
    {
      id: "3",
      name: isMarketplacePage ? "Tommy Alvarez" : "Bowen Higgins",
      amount: isMarketplacePage ? "19.3 STRK" : "98.2 STK",
      avatar: "/avatars/avatar-3.jpg",
      bgColor: "bg-purple-400",
    },
    {
      id: "4",
      name: isMarketplacePage ? "Wilbur Lane" : "Saige Fuentes",
      amount: isMarketplacePage ? "18.7 STRK" : "94.7 STK",
      avatar: "/avatars/avatar-4.jpg",
      bgColor: "bg-violet-400",
    },
    {
      id: "5",
      name: isMarketplacePage ? "Andy Huxford" : "Sophie Maddox",
      amount: isMarketplacePage ? "18.2 STRK" : "72.6 STK",
      avatar: "/avatars/avatar-5.jpg",
      bgColor: "bg-green-400",
    },
    {
      id: "6",
      name: isMarketplacePage ? "Blake Banks" : "Jeremy Burch",
      amount: isMarketplacePage ? "16.9 STRK" : "70.3 STK",
      avatar: "/avatars/avatar-6.jpg",
      bgColor: "bg-pink-300",
    },
    {
      id: "7",
      name: isMarketplacePage ? "Monroe Lucas" : "Amelia Griffin",
      amount: isMarketplacePage ? "15.8 STRK" : "65.4 STK",
      avatar: "/avatars/avatar-7.jpg",
      bgColor: "bg-rose-400",
    },
    {
      id: "8",
      name: isMarketplacePage ? "Nash Romero" : "Isabella Hart",
      amount: isMarketplacePage ? "14.4 STRK" : "59.2 STK",
      avatar: "/avatars/avatar-8.jpg",
      bgColor: "bg-orange-400",
    },
    {
      id: "9",
      name: isMarketplacePage ? "Harper Ritchie" : "Diego Bentley",
      amount: isMarketplacePage ? "13.5 STRK" : "50.7 STK",
      avatar: "/avatars/avatar-9.jpg",
      bgColor: "bg-fuchsia-400",
    },
    {
      id: "10",
      name: isMarketplacePage ? "Daisy Lozano" : "Daisy Lozano",
      amount: isMarketplacePage ? "12.1 STRK" : "45.1 STK",
      avatar: "/avatars/avatar-10.jpg",
      bgColor: "bg-emerald-400",
    },
    {
      id: "11",
      name: isMarketplacePage ? "Eliza Morgan" : "Eliza Morgan",
      amount: isMarketplacePage ? "11.8 STRK" : "42.3 STK",
      avatar: "/avatars/avatar-11.jpg",
      bgColor: "bg-blue-400",
    },
    {
      id: "12",
      name: isMarketplacePage ? "Jasper Reed" : "Jasper Reed",
      amount: isMarketplacePage ? "10.9 STRK" : "39.7 STK",
      avatar: "/avatars/avatar-12.jpg",
      bgColor: "bg-amber-400",
    },
    {
      id: "13",
      name: isMarketplacePage ? "Mila Chen" : "Mila Chen",
      amount: isMarketplacePage ? "10.2 STRK" : "36.5 STK",
      avatar: "/avatars/avatar-13.jpg",
      bgColor: "bg-lime-400",
    },
    {
      id: "14",
      name: isMarketplacePage ? "Felix Dawson" : "Felix Dawson",
      amount: isMarketplacePage ? "9.7 STRK" : "34.8 STK",
      avatar: "/avatars/avatar-14.jpg",
      bgColor: "bg-sky-400",
    },
    {
      id: "15",
      name: isMarketplacePage ? "Zoe Parker" : "Zoe Parker",
      amount: isMarketplacePage ? "9.1 STRK" : "32.6 STK",
      avatar: "/avatars/avatar-15.jpg",
      bgColor: "bg-red-400",
    },
  ];

  const scrollContainerRef = useRef<HTMLDivElement>(null);

  // Check if scrolling is possible
  useEffect(() => {
    if (scrollContainerRef.current) {
      const checkScrollable = () => {
        const container = scrollContainerRef.current;
        if (container) {
          setShowNavButtons(container.scrollWidth > container.clientWidth);
        }
      };

      checkScrollable();
      window.addEventListener("resize", checkScrollable);

      return () => {
        window.removeEventListener("resize", checkScrollable);
      };
    }
  }, []);

  const scroll = (direction: "left" | "right") => {
    if (scrollContainerRef.current) {
      const { current } = scrollContainerRef;
      // Adjust scroll amount to show approximately 3 new items
      const scrollAmount = 320;

      if (direction === "left") {
        current.scrollBy({ left: -scrollAmount, behavior: "smooth" });
      } else {
        current.scrollBy({ left: scrollAmount, behavior: "smooth" });
      }
    }
  };

  // Marketplace version (horizontal scrollable list)
  if (isMarketplacePage) {
    return (
      <section className="py-12 relative">
        <div className="flex justify-between items-center mb-6">
          <h2 className="text-2xl font-bold">{t("topSellers.title")}</h2>
          {showNavButtons && (
            <div className="flex gap-2">
              <button
                onClick={() => scroll("left")}
                className="bg-gray-800/50 hover:bg-gray-700/70 text-white p-2 rounded-full"
                aria-label={t("topSellers.scrollLeft")}
              >
                <ChevronLeft className="h-4 w-4" />
              </button>
              <button
                onClick={() => scroll("right")}
                className="bg-gray-800/50 hover:bg-gray-700/70 text-white p-2 rounded-full"
                aria-label={t("topSellers.scrollRight")}
              >
                <ChevronRight className="h-4 w-4" />
              </button>
            </div>
          )}
        </div>

        <div
          className="flex overflow-x-auto gap-5 pb-4 snap-x px-1 no-scrollbar"
          ref={scrollContainerRef}
          style={{ scrollbarWidth: "none", msOverflowStyle: "none" }}
        >
          {sellers.map((seller) => (
            <div
              key={seller.id}
              className="flex flex-col items-center min-w-[100px] snap-start"
            >
              <div
                className={`w-16 h-16 rounded-2xl ${seller.bgColor} mb-3 relative overflow-hidden flex items-center justify-center`}
              >
                <Image
                  src="/nftopia-03.svg"
                  alt={seller.name}
                  width={40}
                  height={40}
                  className="opacity-80"
                />
              </div>
              <h3 className="text-sm font-medium text-center whitespace-nowrap">
                {seller.name}
              </h3>
              <p className="text-xs text-[#9398a8]">{seller.amount}</p>
            </div>
          ))}
        </div>
      </section>
    );
  }

  // Original version (grid layout)
  return (
    <section className="py-20 overflow-hidden relative">
      {/* Background elements */}
      <div className="absolute inset-0 overflow-hidden">
        <div className="absolute top-1/4 right-1/4 w-64 h-64 bg-purple-500/10 rounded-full filter blur-3xl"></div>
        <div className="absolute bottom-1/4 left-1/3 w-80 h-80 bg-blue-500/10 rounded-full filter blur-3xl"></div>
      </div>

      <div className="container mx-auto px-4 relative z-10">
        <div className="flex flex-col items-center mb-16">
          <div className="inline-block relative">
            <h2 className="text-4xl font-bold text-center text-white tracking-wider font-display">
              {t("topSellers.title")}
            </h2>
            <div className="absolute -bottom-3 left-0 right-0 h-[1px] bg-gradient-to-r from-transparent via-purple-500 to-transparent"></div>
            <div className="absolute -bottom-5 left-1/4 right-1/4 h-[1px] bg-gradient-to-r from-transparent via-blue-500/50 to-transparent"></div>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
          {sellers.map((seller) => (
            <div
              key={seller.id}
              className={cn(
                "relative rounded-xl overflow-hidden group cursor-pointer transition-all duration-300 hover:-translate-y-1",
                seller.highlight
                  ? "bg-gradient-to-r from-blue-500/20 to-purple-500/20 border border-blue-500/30"
                  : "bg-gradient-to-r from-gray-900/80 to-gray-800/80 border border-gray-700/50"
              )}
            >
              <div className="flex items-center p-4 gap-3">
                <div className="relative w-12 h-12 rounded-full overflow-hidden border-2 border-white/20">
                  {/* <Image
                    src={seller.avatar}
                    alt={seller.name}
                    fill
                    className="object-cover"
                  /> */}
                </div>

                <div className="flex-1 min-w-0">
                  <h3 className="text-sm font-medium text-white truncate">
                    {seller.name}
                  </h3>
                  <p
                    className={cn(
                      "text-xs font-medium",
                      seller.highlight ? "text-blue-400" : "text-purple-400"
                    )}
                  >
                    {seller.amount}
                  </p>
                </div>
              </div>

              {/* Hover effect */}
              <div className="absolute inset-0 bg-gradient-to-r from-blue-500/10 to-purple-500/10 opacity-0 group-hover:opacity-100 transition-opacity duration-300"></div>

              {/* Top accent line */}
              <div className="absolute top-0 left-0 right-0 h-[2px] bg-gradient-to-r from-transparent via-blue-500/50 to-transparent transform scale-x-0 group-hover:scale-x-100 transition-transform duration-500"></div>
            </div>
          ))}
        </div>
      </div>

      {/* Section divider */}
      <div className="absolute bottom-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-purple-500/30 to-transparent"></div>
    </section>
  );
}
