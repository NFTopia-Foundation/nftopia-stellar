"use client";

import { Button } from "@/components/ui/button";
import { Vault } from "@/components/Vault";
import { useTranslation } from "@/hooks/useTranslation";
import Link from "next/link";

export function MainHero() {
  const { t, locale } = useTranslation();

  return (
    <div className="flex flex-col  lg:flex-row gap-8 items-center py-8 sm:py-12 md:py-16 px-4 sm:px-8 lg:px-0 mt-8 sm:mt-12 md:mt-16">
      {/* Left Section */}
      <div className="w-full flex flex-col md:justify-center md:items-center lg:items-start lg:justify-start lg:w-1/2 space-y-6 md:space-y-8 pt-4 md:pt-0">
        <h1 className="text-3xl sm:text-4xl md:text-5xl lg:text-6xl font-bold leading-tight text-white font-display tracking-wide bg-clip-text text-transparent bg-gradient-to-r from-white to-purple-200 mb-2">
          {t("homepage.hero.titlePart1")}
          <br />
          <span className="text-4xl sm:text-5xl md:text-6xl bg-clip-text text-transparent bg-gradient-to-r from-[#4e3bff] to-[#9747ff] block mt-1 mb-1">
            {t("homepage.hero.titlePart2")}
          </span>
          <span className="tracking-tight block mt-1 text-white">
            {t("homepage.hero.titlePart3")}
          </span>
        </h1>
        <p className="text-gray-400 text-base sm:text-lg max-w-md">
          {t("homepage.hero.subtitle")}
        </p>
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3 sm:gap-4 pt-2 sm:pt-4">
          <Link href={`/${locale}/auth/register`}>
            <Button
              size="lg"
              className="bg-gradient-to-r from-[#4e3bff] via-[#9747ff] to-[#6d3bff] hover:opacity-90 rounded-full px-6 sm:px-8 py-4 sm:py-6 text-white shadow-lg shadow-purple-500/20 hover:shadow-purple-500/40 transition-all duration-300 text-sm sm:text-base font-semibold"
            >
              {t("homepage.hero.cta")}
            </Button>
          </Link>
          <Link href={`/${locale}/marketplace`}>
            <Button
              size="lg"
              variant="outline"
              className="relative border-2 border-transparent text-white hover:bg-gray-800/30 rounded-full px-6 sm:px-8 py-4 sm:py-6 group overflow-hidden transition-all duration-300 text-sm sm:text-base font-semibold"
            >
              <span className="absolute inset-0 rounded-full bg-gradient-to-r from-[#4e3bff] to-[#9747ff] opacity-20 group-hover:opacity-30 transition-opacity"></span>
              <span className="absolute inset-0 rounded-full border-2 border-[#ec796b] opacity-70 group-hover:opacity-100 transition-all duration-300 shadow-[0_0_15px_rgba(236,121,107,0.5)] group-hover:shadow-[0_0_20px_rgba(236,121,107,0.7)]"></span>
              <span className="absolute -inset-px rounded-full bg-[#181359] border border-gray-700"></span>
              <span className="relative z-10 flex items-center justify-center">
                <span className="mr-2">{t("homepage.hero.learnMore")}</span>
                <svg
                  width="16"
                  height="16"
                  viewBox="0 0 16 16"
                  fill="none"
                  xmlns="http://www.w3.org/2000/svg"
                  className="transition-transform group-hover:translate-x-1"
                >
                  <path
                    d="M3.33337 8H12.6667"
                    stroke="currentColor"
                    strokeWidth="1.5"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                  <path
                    d="M8 3.33331L12.6667 7.99998L8 12.6666"
                    stroke="currentColor"
                    strokeWidth="1.5"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                </svg>
              </span>
            </Button>
          </Link>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 sm:gap-6 pt-6 sm:pt-8 max-w-sm sm:max-w-md">
          <div className="relative bg-[#181359]/40 p-3 sm:p-4 rounded-xl text-center backdrop-blur-md border border-purple-500/20 shadow-lg hover:shadow-purple-500/20 transition-all duration-300 overflow-hidden group">
            <div className="absolute -right-6 -top-6 w-16 h-16 bg-purple-500/10 rounded-full blur-xl group-hover:bg-purple-500/20 transition-all duration-500"></div>
            <div className="absolute -left-6 -bottom-6 w-12 h-12 bg-[#ec796b]/10 rounded-full blur-lg group-hover:bg-[#ec796b]/20 transition-all duration-500"></div>
            <svg
              className="absolute opacity-5 -right-4 -bottom-4 w-20 h-20 text-purple-400"
              viewBox="0 0 24 24"
              fill="currentColor"
            >
              <path d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5"></path>
            </svg>
            <div className="text-xl sm:text-2xl font-bold text-white mb-1">
              100%
            </div>
            <div className="text-xs sm:text-sm text-purple-400 font-medium">
              {t("homepage.features.onChain")}
            </div>
            <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-purple-500/50 to-transparent"></div>
          </div>
          <div className="relative bg-[#181359]/40 p-3 sm:p-4 rounded-xl text-center backdrop-blur-md border border-purple-500/20 shadow-lg hover:shadow-purple-500/20 transition-all duration-300 overflow-hidden group">
            <div className="absolute -right-6 -top-6 w-16 h-16 bg-purple-500/10 rounded-full blur-xl group-hover:bg-purple-500/20 transition-all duration-500"></div>
            <div className="absolute -left-6 -bottom-6 w-12 h-12 bg-[#ec796b]/10 rounded-full blur-lg group-hover:bg-[#ec796b]/20 transition-all duration-500"></div>
            <svg
              className="absolute opacity-5 -right-4 -bottom-4 w-20 h-20 text-purple-400"
              viewBox="0 0 24 24"
              fill="currentColor"
            >
              <path d="M12 22c5.523 0 10-4.477 10-10S17.523 2 12 2 2 6.477 2 12s4.477 10 10 10zm0-15v5l4.5 2.5"></path>
            </svg>
            <div className="text-xl sm:text-2xl font-bold text-white mb-1 truncate">
              {t("homepage.features.starknet")}
            </div>
            <div className="text-xs sm:text-sm text-purple-400 font-medium">
              {t("homepage.features.ecosystem")}
            </div>
            <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-purple-500/50 to-transparent"></div>
          </div>
          <div className="relative bg-[#181359]/40 p-3 sm:p-4 rounded-xl text-center backdrop-blur-md border border-purple-500/20 shadow-lg hover:shadow-purple-500/20 transition-all duration-300 overflow-hidden group">
            <div className="absolute -right-6 -top-6 w-16 h-16 bg-purple-500/10 rounded-full blur-xl group-hover:bg-purple-500/20 transition-all duration-500"></div>
            <div className="absolute -left-6 -bottom-6 w-12 h-12 bg-[#ec796b]/10 rounded-full blur-lg group-hover:bg-[#ec796b]/20 transition-all duration-500"></div>
            <svg
              className="absolute opacity-5 -right-4 -bottom-4 w-20 h-20 text-purple-400"
              viewBox="0 0 24 24"
              fill="currentColor"
            >
              <path d="M12 22c5.523 0 10-4.477 10-10S17.523 2 12 2 2 6.477 2 12s4.477 10 10 10zm0-15v5l4.5 2.5"></path>
            </svg>
            <div className="text-xl sm:text-2xl font-bold text-white mb-1">
              {t("homepage.features.secure")}
            </div>
            <div className="text-xs sm:text-sm text-purple-400 font-medium">
              {t("homepage.features.storage")}
            </div>
            <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-purple-500/50 to-transparent"></div>
          </div>
        </div>
      </div>
      {/* Right Section */}
      <div className="w-full md:w-1/2 lg:flex hidden justify-center md:justify-end items-center mt-8 md:mt-0">
        <div className="relative max-w-xs sm:max-w-md md:max-w-lg lg:max-w-xl w-full md:w-[90%] lg:w-[85%] -mt-8 sm:-mt-12 md:-mt-16 lg:-mt-24 md:mr-4 lg:mr-8">
          <div className="relative h-[260px] sm:h-[340px] md:h-[400px] lg:h-[500px] flex items-center justify-center">
            <Vault />
          </div>
        </div>
      </div>
    </div>
  );
}
