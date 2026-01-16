"use client";

import Image from "next/image";
import Link from "next/link";
import { useTranslation } from "@/hooks/useTranslation";

interface Category {
  id: string;
  name: string;
  count: number;
  images: string[];
}

function ExploreCategories() {
  const { t } = useTranslation();

  const categories: Category[] = [
    {
      id: "abstract",
      name: t("exploreCategories.categories.abstract"),
      count: 3025,
      images: [
        "/categories/abstract-1.jpg",
        "/categories/abstract-2.jpg",
        "/categories/abstract-3.jpg",
        "/categories/abstract-4.jpg",
      ],
    },
    {
      id: "3d",
      name: t("exploreCategories.categories.3d"),
      count: 4103,
      images: [
        "/categories/3d-1.jpg",
        "/categories/3d-2.jpg",
        "/categories/3d-3.jpg",
        "/categories/3d-4.jpg",
      ],
    },
    {
      id: "modern",
      name: t("exploreCategories.categories.modern"),
      count: 2789,
      images: [
        "/categories/modern-1.jpg",
        "/categories/modern-2.jpg",
        "/categories/modern-3.jpg",
        "/categories/modern-4.jpg",
      ],
    },
    {
      id: "game",
      name: t("exploreCategories.categories.game"),
      count: 1826,
      images: [
        "/categories/game-1.jpg",
        "/categories/game-2.jpg",
        "/categories/game-3.jpg",
        "/categories/game-4.jpg",
      ],
    },
    {
      id: "graffiti",
      name: t("exploreCategories.categories.graffiti"),
      count: 2154,
      images: [
        "/categories/graffiti-1.jpg",
        "/categories/graffiti-2.jpg",
        "/categories/graffiti-3.jpg",
        "/categories/graffiti-4.jpg",
      ],
    },
    {
      id: "watercolor",
      name: t("exploreCategories.categories.watercolor"),
      count: 1932,
      images: [
        "/categories/watercolor-1.jpg",
        "/categories/watercolor-2.jpg",
        "/categories/watercolor-3.jpg",
        "/categories/watercolor-4.jpg",
      ],
    },
  ];

  return (
    <section className="py-20 overflow-hidden relative">
      {/* Background elements */}
      <div className="absolute inset-0 overflow-hidden">
        <div className="absolute top-1/3 left-1/4 w-64 h-64 bg-purple-500/10 rounded-full filter blur-3xl"></div>
        <div className="absolute bottom-1/3 right-1/4 w-80 h-80 bg-blue-500/10 rounded-full filter blur-3xl"></div>
      </div>

      <div className="container mx-auto px-4 relative z-10">
        <div className="flex flex-col items-center mb-16">
          <div className="inline-block relative">
            <h2 className="text-4xl font-bold text-center text-white tracking-wider font-display">
              {t("exploreCategories.title")}
            </h2>
            <div className="absolute -bottom-3 left-0 right-0 h-[1px] bg-gradient-to-r from-transparent via-purple-500 to-transparent"></div>
            <div className="absolute -bottom-5 left-1/4 right-1/4 h-[1px] bg-gradient-to-r from-transparent via-blue-500/50 to-transparent"></div>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {categories.map((category) => (
            <Link
              href={`/category/${category.id}`}
              key={category.id}
              className="group"
            >
              <div className="bg-gray-900/40 backdrop-blur-sm rounded-2xl overflow-hidden border border-[#db74cf]/30 hover:border-[#db74cf]/50 transition-all duration-300 hover:shadow-lg hover:shadow-[#db74cf]/10 hover:-translate-y-1">
                <div className="p-3">
                  <div className="grid grid-cols-3 gap-2">
                    {/* Main image */}
                    <div
                      className="col-span-3 relative overflow-hidden rounded-xl"
                      style={{ height: "140px" }}
                    >
                      {/* <Image
                        src={category.images[0]}
                        alt={`${category.name} main artwork`}
                        fill
                        className="object-cover transition-transform duration-500 group-hover:scale-105"
                      /> */}
                      <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent"></div>
                    </div>

                    {/* Smaller images */}
                    {category.images.slice(1, 4).map((image, index) => (
                      <div
                        key={`${category.id}-${index + 1}`}
                        className="relative overflow-hidden rounded-lg"
                        style={{ height: "70px" }}
                      >
                        {/* <Image
                          src={image[0]}
                          alt={`${category.name} artwork ${index + 1}`}
                          fill
                          className="object-cover transition-transform duration-500 group-hover:scale-110"
                        /> */}
                      </div>
                    ))}
                  </div>
                </div>

                <div className="p-4 flex justify-between items-center">
                  <h3 className="font-medium text-white text-lg">
                    {category.name}
                  </h3>
                  <span className="text-xs text-blue-400 bg-blue-500/20 px-3 py-1 rounded-full border border-blue-500/30">
                    {category.count.toLocaleString()}
                  </span>
                </div>
              </div>
            </Link>
          ))}
        </div>
      </div>

      {/* Section divider */}
      <div className="absolute bottom-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-purple-500/30 to-transparent"></div>
    </section>
  );
}

export default ExploreCategories;
