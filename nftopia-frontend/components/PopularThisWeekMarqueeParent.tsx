"use client";

import React, { useState } from "react";
import PopularThisWeek from "./PopularThisWeek";
import { useTranslation } from "@/hooks/useTranslation";

export type NFTItem = {
  id: number;
  name: string;
  image: string;
  price: string;
  desc: string;
};

const nftItems: NFTItem[] = [
  {
    id: 1,
    name: "CyberPunk #01",
    image: "/nftopia-03.svg",
    price: "2.5 ETH",
    desc: "By Anthony Gargasz",
  },
  {
    id: 2,
    name: "Futuristic Sphere",
    image: "/nftopia-03.svg",
    desc: "By Anthony Gargasz",
    price: "1.8 ETH",
  },
  {
    id: 3,
    name: "Neon Samurai",
    image: "/nftopia-03.svg",
    desc: "By Anthony Gargasz",
    price: "3.2 ETH",
  },
  {
    id: 4,
    name: "Neon Samurai",
    image: "/nftopia-03.svg",
    desc: "By Anthony Gargasz",
    price: "3.2 ETH",
  },
  {
    id: 5,
    name: "Neon Samurai",
    image: "/nftopia-03.svg",
    desc: "By Anthony Gargasz",
    price: "3.2 ETH",
  },
];

export const PopularThisWeekMarqueeParent: React.FC = () => {
  const [hoveredCardId, setHoveredCardId] = useState<number | null>(null);

  const { t } = useTranslation();

  return (
    <div className="relative z-10 flex flex-col gap-4 sm:gap-6 lg:gap-8 items-center overflow-hidden px-4 sm:px-6 lg:px-8">
      {/* Header Section */}
      <div className="container flex flex-row justify-center items-center mx-auto relative z-10 w-full">
        <div className="flex flex-col items-center text-center">
          <div className="inline-block relative">
            <h2 className="text-2xl sm:text-3xl md:text-4xl lg:text-5xl font-bold text-center text-white tracking-wider font-display">
              {t("homepage.popularThisWeek.title")}
            </h2>
            <div className="absolute -bottom-2 sm:-bottom-3 left-0 right-0 h-[1px] bg-gradient-to-r from-transparent via-purple-500 to-transparent"></div>
            <div className="absolute -bottom-4 sm:-bottom-5 left-1/4 right-1/4 h-[1px] bg-gradient-to-r from-transparent via-blue-500/50 to-transparent"></div>
          </div>
          <p className="text-gray-400 mt-3 sm:mt-4 text-center max-w-xs sm:max-w-md lg:max-w-lg text-sm sm:text-base">
            {t("homepage.popularThisWeek.message")}
          </p>
        </div>
      </div>

      {/* Marquee Section */}
      <div
        className={`flex max-w-6xl mx-auto items-center h-auto sm:h-md p-4 sm:p-8 lg:p-20 pb-8 sm:pb-12 lg:pb-20 gap-4 sm:gap-8 lg:gap-16 whitespace-nowrap overflow-x-auto sm:overflow-x-hidden
        ${hoveredCardId !== null ? "animate-pause" : "animate-marquee"}`}
      >
        {nftItems
          .concat(nftItems)
          .map(({ id, name, price, image, desc }, index) => (
            <div
              key={index}
              className={`transition-transform duration-300 ease-in-out flex-shrink-0
              ${hoveredCardId === id ? "scale-105" : ""}`}
              onMouseEnter={() => setHoveredCardId(id)}
              onMouseLeave={() => setHoveredCardId(null)}
            >
              <PopularThisWeek
                desc={desc}
                id={id.toString()}
                name={name}
                price={price}
                image={image}
              />
            </div>
          ))}
      </div>
    </div>
  );
};

export default PopularThisWeekMarqueeParent;
