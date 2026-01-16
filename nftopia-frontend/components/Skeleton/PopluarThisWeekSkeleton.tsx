"use client";

import React, { useState, useEffect } from "react";
import Skeleton from "react-loading-skeleton";
import "react-loading-skeleton/dist/skeleton.css";
import PopularThisWeek from "@/components/PopularThisWeek";

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

export const PopularThisWeekSkeleton: React.FC = () => {
  const [hoveredCardId, setHoveredCardId] = useState<number | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  // Simulate a loading delay (e.g., for fetching data)
  useEffect(() => {
    const timer = setTimeout(() => {
      setIsLoading(false);
    }, 2000);
    return () => clearTimeout(timer);
  }, []);

  return (
    <div className="relative z-10 overflow-hidden">
      <div
        className={`flex max-w-6xl mx-auto items-center min-h-[100svh] p-8 pb-20 gap-16 sm:p-20 whitespace-nowrap 
        ${hoveredCardId !== null ? "animate-pause" : "animate-marquee"}`}
      >
        {nftItems
          .concat(nftItems)
          .map(({ id, name, price, image, desc }, index) => (
            <div
              key={index}
              className={`transition-transform duration-300 ease-in-out ${
                hoveredCardId === id ? "scale-105" : ""
              }`}
              onMouseEnter={() => setHoveredCardId(id)}
              onMouseLeave={() => setHoveredCardId(null)}
            >
              {isLoading ? (
                // Skeleton placeholder for each card
                <div className="w-64 p-4">
                  <Skeleton height={200} />
                  <Skeleton height={20} width={150} className="mt-2" />
                  <Skeleton height={20} width={100} className="mt-1" />
                </div>
              ) : (
                <PopularThisWeek
                  desc={desc}
                  id={id.toString()}
                  name={name}
                  price={price}
                  image={image}
                />
              )}
            </div>
          ))}
      </div>
    </div>
  );
};

export default PopularThisWeekSkeleton;
